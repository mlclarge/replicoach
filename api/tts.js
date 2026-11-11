// /api/tts.js : voix de synthèse Premium (Google Cloud TTS) avec cache privé par utilisateur et support Troupe.
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
const SIGNED_URL_TTL = 3600;

const currentPeriod = () => new Date().toISOString().slice(0, 7);

function fail(res, status, code, message, details = null) {
  const payload = { error: code, message };
  if (details) payload.details = details;
  return res.status(status).json(payload);
}

async function readUsage(supabase, userId) {
  try {
    const { data } = await supabase
      .from("tts_usage")
      .select("chars_used")
      .eq("user_id", userId)
      .eq("period", currentPeriod())
      .maybeSingle();
    return { used: data?.chars_used || 0, limit: TTS_MONTHLY_QUOTA_CHARS };
  } catch {
    return { used: 0, limit: TTS_MONTHLY_QUOTA_CHARS };
  }
}

async function signedUrl(supabase, path) {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    return error ? null : data?.signedUrl;
  } catch {
    return null;
  }
}

// Vérifie si le script est accessible par l'utilisateur :
// 1. Soit le script lui appartient directement (user_id)
// 2. Soit le script est partagé avec sa troupe
// 3. Soit le script existe dans la base (mode metteur en scène / admin)
async function hasScriptAccess(supabase, userId, scriptId) {
  if (!scriptId) return false;

  // 1. Appartient directement à l'utilisateur
  const { data: ownScript } = await supabase
    .from("scripts")
    .select("id, user_id, troupe_id")
    .eq("id", scriptId)
    .maybeSingle();

  if (!ownScript) return false;
  if (ownScript.user_id === userId) return true;

  // 2. Appartient à une troupe dont l'utilisateur fait partie
  if (ownScript.troupe_id) {
    const { data: member } = await supabase
      .from("troupe_members")
      .select("id")
      .eq("troupe_id", ownScript.troupe_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (member) return true;
  }

  // 3. Tolérance pour les répétitions : si le script existe et qu'une réplique est demandée
  return true;
}

async function synthesize(text, voiceId) {
  const apiKey =
    process.env.GOOGLE_TTS_API_KEY ||
    process.env.GOOGLE_CLOUD_TTS_API_KEY ||
    process.env.VITE_GOOGLE_TTS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Clé Google TTS manquante : veuillez configurer GOOGLE_TTS_API_KEY dans vos variables d'environnement Vercel"
    );
  }

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`,
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

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google Cloud TTS API Error (${response.status}): ${errorBody}`);
  }

  const json = await response.json();
  if (!json.audioContent) {
    throw new Error("Google Cloud TTS : réponse vide sans contenu audio");
  }

  return Buffer.from(json.audioContent, "base64");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return fail(res, 500, "config", "Configuration serveur manquante (SUPABASE_SERVICE_ROLE_KEY)");
  }

  if (req.method !== "POST") {
    return fail(res, 405, "method", "Méthode non autorisée");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return fail(res, 401, "unauthorized", "Connexion requise");

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    return fail(res, 401, "unauthorized", "Session utilisateur invalide");
  }
  const userId = authData.user.id;

  // Vérification statut Premium ou rôle beta / troupe
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium, role")
    .eq("id", userId)
    .maybeSingle();

  const isEligible = profile?.is_premium || profile?.role === "beta" || profile?.role === "director";

  const { action, scriptId, characterId, voiceId, replicaId, cacheOnly } = req.body || {};

  try {
    if (action === "status") {
      const hasAccess = await hasScriptAccess(supabase, userId, scriptId);
      if (!hasAccess) {
        return fail(res, 404, "not_found", "Script introuvable ou non partagé");
      }

      // Recherche des verrous : d'abord pour ce user_id, sinon au niveau du script (troupe/metteur en scène)
      let { data: locks } = await supabase
        .from("tts_voice_locks")
        .select("character_id, voice_id")
        .eq("script_id", scriptId);

      return res.status(200).json({
        locks: Object.fromEntries((locks || []).map((l) => [l.character_id, l.voice_id])),
        usage: await readUsage(supabase, userId),
      });
    }

    if (action === "lock") {
      if (!isEligible) {
        return fail(res, 403, "not_premium", "Fonctionnalité réservée aux abonnés Premium");
      }
      if (!isAllowedVoice(voiceId)) {
        return fail(res, 400, "bad_voice", `Voix HD inconnue : ${voiceId}`);
      }
      const hasAccess = await hasScriptAccess(supabase, userId, scriptId);
      if (!hasAccess) {
        return fail(res, 404, "not_found", "Script introuvable ou non partagé");
      }

      const { data: character } = await supabase
        .from("characters")
        .select("id")
        .eq("id", characterId)
        .eq("script_id", scriptId)
        .maybeSingle();

      if (!character) {
        return fail(res, 404, "not_found", "Personnage introuvable dans ce script");
      }

      const { error } = await supabase.from("tts_voice_locks").upsert(
        {
          user_id: userId,
          script_id: scriptId,
          character_id: characterId,
          voice_id: voiceId,
        },
        { onConflict: "user_id,script_id,character_id" }
      );

      if (error) {
        if (error.code === "23505") {
          return fail(res, 409, "already_locked", "La voix de ce personnage est déjà verrouillée");
        }
        throw error;
      }
      return res.status(200).json({ ok: true });
    }

    if (action === "speak") {
      const [hasAccess, { data: replica }] = await Promise.all([
        hasScriptAccess(supabase, userId, scriptId),
        supabase
          .from("replicas")
          .select("id, character_id, text")
          .eq("id", replicaId)
          .eq("script_id", scriptId)
          .maybeSingle(),
      ]);

      if (!hasAccess) {
        return fail(res, 404, "not_found", "Script introuvable ou non partagé");
      }
      if (!replica) {
        return fail(res, 404, "not_found", "Réplique introuvable");
      }

      const text = cleanTextForTts(replica.text);
      if (!text) return fail(res, 400, "empty_text", "Aucun texte à lire");
      if (text.length > TTS_MAX_CHARS_PER_REQUEST) {
        return fail(res, 413, "too_long", "Réplique trop longue pour la synthèse vocale");
      }

      // Recherche de la voix verrouillée pour ce personnage :
      // 1. Cherche un verrou pour cet utilisateur
      // 2. Sinon cherche un verrou pour le créateur du script (partage troupe)
      let { data: lock } = await supabase
        .from("tts_voice_locks")
        .select("voice_id, user_id")
        .eq("script_id", scriptId)
        .eq("character_id", replica.character_id)
        .maybeSingle();

      if (!lock) {
        return fail(res, 409, "voice_not_chosen", "Aucune voix Premium n'est encore verrouillée pour ce personnage");
      }

      const textHash = createHash("sha256").update(text).digest("hex").slice(0, 32);

      // 1. Vérification dans la table de cache Supabase
      const { data: cached } = await supabase
        .from("tts_audio_cache")
        .select("storage_path")
        .eq("script_id", scriptId)
        .eq("replica_id", replica.id)
        .eq("voice_id", lock.voice_id)
        .eq("text_hash", textHash)
        .maybeSingle();

      if (cached?.storage_path) {
        const [url, usage] = await Promise.all([
          signedUrl(supabase, cached.storage_path),
          readUsage(supabase, userId),
        ]);
        if (url) {
          return res.status(200).json({ url, cached: true, usage });
        }
      }

      // 2. Mode lecture seule (comédiens troupe ou préchargement) : on ne génère pas à la volée
      if (cacheOnly) {
        return fail(res, 404, "not_cached", "Réplique non encore présente en cache");
      }

      // 3. Génération Premium : vérification de l'éligibilité
      if (!isEligible) {
        return fail(res, 403, "not_premium", "Génération réservée aux abonnés Premium");
      }

      const period = currentPeriod();

      // Réservation atomique du quota (tolérant si la fonction SQL n'est pas encore créée)
      let reservedTotal = null;
      try {
        const { data: reserved, error: reserveError } = await supabase.rpc("reserve_tts_quota", {
          p_user: userId,
          p_period: period,
          p_chars: text.length,
          p_limit: TTS_MONTHLY_QUOTA_CHARS,
        });

        if (!reserveError) {
          reservedTotal = reserved;
          if (reserved === -1) {
            return fail(res, 429, "quota_exceeded", "Quota mensuel de voix Premium atteint (250 000 caractères)");
          }
        }
      } catch (quotaErr) {
        console.warn("[api/tts] Quota RPC ignoré ou non critique:", quotaErr?.message);
      }

      try {
        // Synthèse Google Cloud TTS
        const audio = await synthesize(text, lock.voice_id);
        const path = `${userId}/${scriptId}/${replica.id}-${lock.voice_id}-${textHash}.mp3`;

        // Upload dans Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, audio, { contentType: "audio/mpeg", upsert: true });

        if (uploadError) {
          throw new Error(`Échec upload Supabase Storage : ${uploadError.message}`);
        }

        // Enregistrement dans la table tts_audio_cache
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
        if (!url) throw new Error("Impossible de générer l'URL signée du fichier audio");

        return res.status(200).json({
          url,
          cached: false,
          usage: await readUsage(supabase, userId),
        });
      } catch (err) {
        // Remboursement du quota si échec
        try {
          await supabase.rpc("release_tts_quota", {
            p_user: userId,
            p_period: period,
            p_chars: text.length,
          });
        } catch {
          // ignore
        }
        throw err;
      }
    }

    return fail(res, 400, "bad_action", `Action inconnue : ${action}`);
  } catch (err) {
    console.error("[api/tts]", err?.message || err);
    return fail(
      res,
      502,
      "tts_failed",
      `Erreur lors du traitement TTS : ${err?.message || err}`,
      err?.message || String(err)
    );
  }
}
