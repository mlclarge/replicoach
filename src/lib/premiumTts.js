import { supabase } from "./supabase";

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
      return { ok: false, code: json.error || "error", message: json.message || "Erreur" };
    }
    return { ok: true, ...json };
  } catch {
    return { ok: false, code: "network", message: "Réseau indisponible" };
  }
}

export const fetchTtsStatus = (scriptId) => callTts("status", { scriptId });
export const lockTtsVoice = (scriptId, characterId, voiceId) =>
  callTts("lock", { scriptId, characterId, voiceId });
export const fetchTtsAudioUrl = (scriptId, replicaId) =>
  callTts("speak", { scriptId, replicaId });
