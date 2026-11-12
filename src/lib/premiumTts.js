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
      // Visible dans la console du navigateur (F12) : action, statut HTTP, code et message du serveur
      console.warn(`[TTS] /api/tts « ${action} » → HTTP ${res.status}`, json);
      return { ok: false, code: json.error || "error", message: json.message || "Erreur synthèse vocale" };
    }
    return { ok: true, ...json };
  } catch {
    return { ok: false, code: "network", message: "Réseau indisponible" };
  }
}

// Interroge le statut des voix verrouillées et du quota mensuel
export const fetchTtsStatus = (scriptId) => callTts("status", { scriptId });

// Récupère les verrous de voix du script (API en priorité, table Supabase en repli)
export async function fetchScriptVoiceLocks(scriptId) {
  if (!scriptId) return {};

  // 1. Via l'API (service_role) : fonctionne aussi pour les comédiens de la troupe, car la table
  //    tts_voice_locks n'est lisible en direct que par l'utilisateur qui a verrouillé la voix (RLS).
  const status = await fetchTtsStatus(scriptId);
  if (status.ok && status.locks) return status.locks;

  // 2. Repli : lecture directe (ne renvoie que les verrous de l'utilisateur courant)
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

  // 2. Repli direct sur Supabase UNIQUEMENT si l'API est indisponible (réseau / erreur serveur).
  // Pour une vraie réponse de l'API (réplique non encore en cache, voix non verrouillée, quota...),
  // on la renvoie telle quelle : un repli pourrait servir un audio périmé (texte ou voix modifiés).
  if (!["network", "tts_failed"].includes(res?.code)) {
    return { ok: false, ...res, message: res?.message || "Audio non disponible en cache" };
  }

  // Lecture seule du cache de l'utilisateur courant (RLS : ses propres lignes).
  try {
    if (replicaId) {
      const { data: cacheRow } = await supabase
        .from("tts_audio_cache")
        .select("storage_path")
        .eq("replica_id", replicaId)
        .order("created_at", { ascending: false })
        .limit(1)
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
  } catch (e) {
    console.warn("Erreur récupération cache troupe:", e);
  }

  return { ok: false, message: "Audio non disponible en cache" };
}
