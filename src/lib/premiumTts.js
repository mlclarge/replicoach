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
        Authorization: "Bearer " + token,
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

// Récupère les verrous de voix directement depuis Supabase (Fallback pour membres gratuits / Troupe)
export async function fetchScriptVoiceLocks(scriptId) {
  try {
    const { data, error } = await supabase
      .from("tts_voice_locks")
      .select("character_id, voice_id")
      .eq("script_id", scriptId);
    if (!error && data) {
      return Object.fromEntries(data.map((l) => [l.character_id, l.voice_id]));
    }
  } catch (e) {
    console.warn("Erreur chargement verrous voix:", e);
  }
  return {};
}

// Verrouille la voix Google Cloud HD choisie pour un personnage
export const lockTtsVoice = (scriptId, characterId, voiceId) =>
  callTts("lock", { scriptId, characterId, voiceId });

// Récupère ou génère l'URL audio MP3 d'une réplique
export const fetchTtsAudioUrl = (scriptId, replicaId) =>
  callTts("speak", { scriptId, replicaId });

// Récupère l'audio pré-généré en cache pour les membres de la troupe (Accès Standard / Gratuit)
export async function fetchTroupeTtsAudioUrl(scriptId, replicaId) {
  // 1. Si l'utilisateur est Premium, tenter via l'API serveur
  const res = await fetchTtsAudioUrl(scriptId, replicaId);
  if (res && res.ok) return res;

  // 2. Fallback Troupe : recherche directe dans la table tts_audio_cache de Supabase
  try {
    const { data: cachedRow } = await supabase
      .from("tts_audio_cache")
      .select("storage_path")
      .eq("script_id", scriptId)
      .eq("replica_id", replicaId)
      .maybeSingle();

    if (cachedRow?.storage_path) {
      const { data, error } = await supabase.storage
        .from("tts-cache")
        .createSignedUrl(cachedRow.storage_path, 3600);

      if (!error && data?.signedUrl) {
        return { ok: true, url: data.signedUrl, cached: true };
      }
    }
  } catch (e) {
    console.warn("Erreur récupération cache troupe:", e);
  }

  return { ok: false, message: "Audio non disponible en cache" };
}
