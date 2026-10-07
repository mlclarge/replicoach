// /api/tts.js : voix de synthèse Premium (Google Cloud TTS) avec cache privé par utilisateur.
// Actions : status | lock | speak
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  TTS_MONTHLY_QUOTA_CHARS,
  TTS_MAX_CHARS_PER_REQUEST,
  isAllowedVoice,
  cleanTextForTts,
} from "../src/lib/ttsVoices.js";

const BUCKET = "tts-cache";
const SIGNED_URL_TTL = 300;

const currentPeriod = () => new Date().toISOString().slice(0, 7);

function fail(res, status, code, message) {
  return res.status(status).json({ error: code, message });
}

async function readUsage(supabase, userId) {
  const { data } = await supabase
    .from("tts_usage")
    .select("chars_used")
    .eq("user_id", userId)
    .eq("period", currentPeriod())
    .maybeSingle();
  return { used: data?.chars_used || 0, limit: TTS_MONTHLY_QUOTA_CHARS };
}

async function signedUrl(supabase, path) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  return error ? null : data.signedUrl;
}

async function ownedScript(supabase, userId, scriptId) {
  if (!scriptId) return false;
  const { data } = await supabase
    .from("scripts")
    .select("id")
    .eq("id", scriptId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

async function synthesize(text, voiceId) {
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(
      process.env.GOOGLE_TTS_API_KEY
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "fr-FR", name: voiceId },
        audioConfig: { audioEncoding: "MP3" },
      }),
    }
  );
  if (!response.ok) throw new Error(`Google TTS ${response.status}`);
  const json = await response.json();
  if (!json.audioContent) throw new Error("Google TTS: réponse vide");
  return Buffer.from(json.audioContent, "base64");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey || !process.env.GOOGLE_TTS_API_KEY) {
    return fail(res, 500, "config", "Configuration serveur manquante");
  }
  if (req.method !== "POST") {
    return fail(res, 405, "method", "Méthode non autorisée");
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return fail(res, 401, "unauthorized", "Connexion requise");
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    return fail(res, 401, "unauthorized", "Session invalide");
  }
  const userId = authData.user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.is_premium) {
    return fail(res, 403, "not_premium", "Fonctionnalité réservée aux abonnés Premium");
  }

  const { action, scriptId, characterId, voiceId, replicaId } = req.body || {};

  try {
    if (action === "status") {
      if (!(await ownedScript(supabase, userId, scriptId))) {
        return fail(res, 404, "not_found", "Script introuvable");
      }
      const { data: locks } = await supabase
        .from("tts_voice_locks")
        .select("character_id, voice_id")
        .eq("user_id", userId)
        .eq("script_id", scriptId);
      return res.status(200).json({
        locks: Object.fromEntries((locks || []).map((l) => [l.character_id, l.voice_id])),
        usage: await readUsage(supabase, userId),
      });
    }

    if (action === "lock") {
      if (!isAllowedVoice(voiceId)) return fail(res, 400, "bad_voice", "Voix inconnue");
      if (!(await ownedScript(supabase, userId, scriptId))) {
        return fail(res, 404, "not_found", "Script introuvable");
      }
      const { data: character } = await supabase
        .from("characters")
        .select("id")
        .eq("id", characterId)
        .eq("script_id", scriptId)
        .maybeSingle();
      if (!character) return fail(res, 404, "not_found", "Personnage introuvable");

      const { error } = await supabase.from("tts_voice_locks").insert({
        user_id: userId,
        script_id: scriptId,
        character_id: characterId,
        voice_id: voiceId,
      });
      if (error) {
        if (error.code === "23505") {
          return fail(res, 409, "already_locked", "La voix de ce personnage est déjà verrouillée");
        }
        throw error;
      }
      return res.status(200).json({ ok: true });
    }

    if (action === "speak") {
      if (!(await ownedScript(supabase, userId, scriptId))) {
        return fail(res, 404, "not_found", "Script introuvable");
      }
      const { data: replica } = await supabase
        .from("replicas")
        .select("id, character_id, text")
        .eq("id", replicaId)
        .eq("script_id", scriptId)
        .maybeSingle();
      if (!replica) return fail(res, 404, "not_found", "Réplique introuvable");

      const text = cleanTextForTts(replica.text);
      if (!text) return fail(res, 400, "empty_text", "Aucun texte à lire");
      if (text.length > TTS_MAX_CHARS_PER_REQUEST) {
        return fail(res, 413, "too_long", "Réplique trop longue pour la voix Premium");
      }

      const { data: lock } = await supabase
        .from("tts_voice_locks")
        .select("voice_id")
        .eq("user_id", userId)
        .eq("script_id", scriptId)
        .eq("character_id", replica.character_id)
        .maybeSingle();
      if (!lock) return fail(res, 409, "voice_not_chosen", "Choisissez d'abord une voix");

      const textHash = createHash("sha256").update(text).digest("hex").slice(0, 32);

      const { data: cached } = await supabase
        .from("tts_audio_cache")
        .select("storage_path")
        .eq("user_id", userId)
        .eq("replica_id", replica.id)
        .eq("voice_id", lock.voice_id)
        .eq("text_hash", textHash)
        .maybeSingle();
      if (cached) {
        const url = await signedUrl(supabase, cached.storage_path);
        if (url) {
          return res.status(200).json({ url, cached: true, usage: await readUsage(supabase, userId) });
        }
      }

      const period = currentPeriod();
      const { data: reserved, error: reserveError } = await supabase.rpc("reserve_tts_quota", {
        p_user: userId,
        p_period: period,
        p_chars: text.length,
        p_limit: TTS_MONTHLY_QUOTA_CHARS,
      });
      if (reserveError) throw reserveError;
      if (reserved === -1) {
        return fail(res, 429, "quota_exceeded", "Quota mensuel de voix Premium atteint");
      }

      try {
        const audio = await synthesize(text, lock.voice_id);
        const path = `${userId}/${scriptId}/${replica.id}-${lock.voice_id}-${textHash}.mp3`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
        if (uploadError) throw uploadError;

        await supabase.from("tts_audio_cache").upsert(
          {
            user_id: userId,
            script_id: scriptId,
            replica_id: replica.id,
            voice_id: lock.voice_id,
            text_hash: textHash,
            storage_path: path,
            char_count: text.length,
          },
          { onConflict: "user_id,replica_id,voice_id,text_hash" }
        );

        const url = await signedUrl(supabase, path);
        if (!url) throw new Error("URL signée indisponible");
        return res.status(200).json({ url, cached: false, usage: await readUsage(supabase, userId) });
      } catch (err) {
        await supabase.rpc("release_tts_quota", {
          p_user: userId,
          p_period: period,
          p_chars: text.length,
        });
        throw err;
      }
    }

    return fail(res, 400, "bad_action", "Action inconnue");
  } catch (err) {
    console.error("[api/tts]", err?.message || err);
    return fail(res, 502, "tts_failed", "Service de voix indisponible");
  }
}
