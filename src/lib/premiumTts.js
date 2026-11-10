import { supabase } from "./supabase";

/**
 * Service Client pour le moteur de synthèse vocale Premium (Google Cloud TTS).
 * Permet au metteur en scène de verrouiller les voix HD et à la troupe (membres gratuits)
 * d'accéder aux répliques pré-synthétisées en cache sur le serveur Supabase.
 */
export async function callTts(action, payload = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return { ok: false, code: "unauthorized", message: "Connexion requise" };

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, code: json.error || "error", message: json.message || "Erreur synthèse vocale" };
    }
    return { ok: true, ...json };
  } catch {
    return { ok: false, code: "network", message: "Réseau indisponible" };
  }
}

// Interroge le statut des voix verrouillées et du quota mensuel
export const fetchTtsStatus = (scriptId) => callTts("status", { scriptId });

// Récupère les verrous de voix directement dans la table Supabase (accessible aux membres de la troupe/comédiens)
export async function fetchScriptVoiceLocks(scriptId) {
  if (!scriptId) return {};
  try {
    const { data, error } = await supabase
      .from("tts_voice_locks")
      .select("character_id, voice_id")
      .eq("script_id", scriptId);
    if (error || !data) return {};
    return Object.fromEntries(data.map((l) => [l.character_id, l.voice_id]));
  } catch {
    return {};
  }
}

// Verrouille la voix Google Cloud HD choisie pour un personnage
export const lockTtsVoice = (scriptId, characterId, voiceId) =>
  callTts("lock", { scriptId, characterId, voiceId });

// Récupère ou génère l'URL audio MP3 d'une réplique
export const fetchTtsAudioUrl = (scriptId, replicaId, cacheOnly = false) =>
  callTts("speak", { scriptId, replicaId, cacheOnly });

// Récupère l'audio pré-généré en cache pour les membres de la troupe (Accès Standard / Gratuit)
// cacheOnly : ne déclenche jamais de génération (donc aucun coût Google TTS)
export async function fetchTroupeTtsAudioUrl(scriptId, replicaId, cacheOnly = false) {
  // 1. Tenter via l'API TTS (si Vercel répond et génère ou signe l'URL)
  const res = await fetchTtsAudioUrl(scriptId, replicaId, cacheOnly);
  if (res?.ok && res?.url) return res;

  // 2. Fallback robuste : recherche directe dans le stockage Supabase
  // RLS Supabase vérifie que le dossier racine correspond à l'auth.uid() de l'utilisateur ou du metteur en scène
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUserId = sessionData?.session?.user?.id;

    // D'abord vérifier dans tts_audio_cache si on a le storage_path exact
    if (replicaId) {
      const { data: cacheRow } = await supabase
        .from("tts_audio_cache")
        .select("storage_path")
        .eq("replica_id", replicaId)
        .maybeSingle();

      if (cacheRow?.storage_path) {
        const { data: signedData, error: signErr } = await supabase.storage
          .from("tts-cache")
          .createSignedUrl(cacheRow.storage_path, 3600);

        if (!signErr && signedData?.signedUrl) {
          return { ok: true, url: signedData.signedUrl, cached: true };
        }
      }
    }

    // Sinon, tester les chemins candidats standard conformes à la politique RLS
    const candidatePaths = [
      currentUserId ? `${currentUserId}/${scriptId}/${replicaId}.mp3` : null,
      currentUserId ? `${currentUserId}/${replicaId}.mp3` : null,
      `${scriptId}/${replicaId}.mp3`,
    ].filter(Boolean);

    for (const path of candidatePaths) {
      const { data, error } = await supabase.storage
        .from("tts-cache")
        .createSignedUrl(path, 3600);

      if (!error && data?.signedUrl) {
        return { ok: true, url: data.signedUrl, cached: true };
      }
    }
  } catch (e) {
    console.warn("Erreur récupération cache troupe:", e);
  }

  return { ok: false, message: "Audio non disponible en cache" };
}
