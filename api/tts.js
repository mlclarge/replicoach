// /api/tts.js : voix de synthèse Premium (Google Cloud TTS) avec cache privé par utilisateur et gestion de troupe.
// Actions : status | lock | speak
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  TTS_MONTHLY_QUOTA_CHARS,
  TTS_MAX_CHARS_PER_REQUEST,
  TTS_MAX_CHARS_PER_REPLICA,
  isAllowedVoice,
  cleanTextForTts,
} from "../src/lib/ttsVoices.js";

const BUCKET = "tts-cache";
const SIGNED_URL_TTL = 3600; // 1 heure de validité pour le cache comédien

const currentPeriod = () => new Date().toISOString().slice(0, 7);

function fail(res, status, code, message, details = null) {
  return res.status(status).json({ error: code, message, details });
}

// Une erreur Supabase (colonne inexistante, RLS, réseau...) ne doit JAMAIS être confondue
// avec « introuvable » : on la remonte pour qu'elle apparaisse dans les logs Vercel.
function must(result, label) {
  if (result?.error) {
    throw new Error(`${label} : ${result.error.message || result.error.code || "erreur Supabase"}`);
  }
  return result?.data ?? null;
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

// Renvoie le script si l'utilisateur y a accès, sinon null. Même logique que les règles RLS :
//  - propriétaire (scripts.user_id)
//  - script partagé avec une troupe dont il est membre (shared_scripts + troupe_members)
//  - texte affecté à son adresse e-mail (script_assignments.assigned_to_email)
async function hasScriptAccess(supabase, user, scriptId) {
  if (!scriptId) return null;

  const script = must(
    await supabase.from("scripts").select("id, user_id").eq("id", scriptId).maybeSingle(),
    "Lecture du script"
  );
  if (!script) return null;
  if (script.user_id === user.id) return script;

  const shared =
    must(
      await supabase.from("shared_scripts").select("troupe_id").eq("script_id", scriptId),
      "Lecture des partages de troupe"
    ) || [];
  const troupeIds = shared.map((s) => s.troupe_id).filter(Boolean);
  if (troupeIds.length > 0) {
    // Le propriétaire de la troupe (metteur en scène) accède aux scripts partagés dans sa troupe
    const ownedTroupe = must(
      await supabase
        .from("troupes")
        .select("id")
        .eq("owner_id", user.id)
        .in("id", troupeIds)
        .limit(1)
        .maybeSingle(),
      "Lecture de la troupe"
    );
    if (ownedTroupe) return script;

    const membership = must(
      await supabase
        .from("troupe_members")
        .select("id")
        .eq("user_id", user.id)
        .in("troupe_id", troupeIds)
        .limit(1)
        .maybeSingle(),
      "Lecture de l'appartenance à la troupe"
    );
    if (membership) return script;
  }

  const email = (user.email || "").trim().toLowerCase();
  if (email) {
    const assignments =
      must(
        await supabase.from("script_assignments").select("assigned_to_email").eq("script_id", scriptId),
        "Lecture des affectations"
      ) || [];
    if (assignments.some((a) => (a.assigned_to_email || "").trim().toLowerCase() === email)) {
      return script;
    }
  }
  return null;
}

// Metteur en scène : propriétaire d'une troupe (troupes.owner_id), ou membre avec le rôle "director".
async function isDirector(supabase, userId) {
  const owned = must(
    await supabase.from("troupes").select("id").eq("owner_id", userId).limit(1).maybeSingle(),
    "Lecture des troupes"
  );
  if (owned) return true;
  const asDirector = must(
    await supabase
      .from("troupe_members")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "director")
      .limit(1)
      .maybeSingle(),
    "Lecture du rôle en troupe"
  );
  return !!asDirector;
}

// Plusieurs utilisateurs peuvent avoir verrouillé une voix pour le même personnage :
// celle du propriétaire du script est prioritaire.
function pickLock(rows, ownerId) {
  if (!rows || rows.length === 0) return null;
  return rows.find((r) => r.user_id === ownerId) || rows[0];
}

// Découpe un texte en morceaux <= max caractères, aux fins de phrase si possible.
function splitForTts(text, max) {
  if (text.length <= max) return [text];
  const chunks = [];
  let current = "";
  const flush = () => {
    if (current) chunks.push(current);
    current = "";
  };
  for (const sentence of text.split(/(?<=[.!?…:;])\s+/)) {
    if (sentence.length > max) {
      flush();
      let part = "";
      for (const word of sentence.split(" ")) {
        const next = part ? `${part} ${word}` : word;
        if (next.length > max && part) {
          chunks.push(part);
          part = word;
        } else {
          part = next;
        }
      }
      if (part) chunks.push(part);
      continue;
    }
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > max) {
      flush();
      current = sentence;
    } else {
      current = next;
    }
  }
  flush();
  return chunks;
}

async function synthesize(text, voiceId) {
  const apiKey =
    process.env.GOOGLE_TTS_API_KEY ||
    process.env.GOOGLE_CLOUD_TTS_API_KEY ||
    process.env.VITE_GOOGLE_TTS_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_TTS_API_KEY manquante sur le serveur Vercel");
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

// Les répliques longues sont découpées (limite par requête), synthétisées en parallèle puis recollées.
async function synthesizeLong(text, voiceId) {
  const chunks = splitForTts(text, TTS_MAX_CHARS_PER_REQUEST);
  const buffers = await Promise.all(chunks.map((chunk) => synthesize(chunk, voiceId)));
  return Buffer.concat(buffers);
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

  const { action, scriptId, characterId, voiceId, replicaId, cacheOnly } = req.body || {};

  // Peut verrouiller des voix et générer de l'audio : abonné Premium OU metteur en scène.
  // (profiles n'a pas de colonne "role" : ne sélectionner que is_premium.)
  let eligibility = null;
  const isEligible = async () => {
    if (eligibility !== null) return eligibility;
    const profile = must(
      await supabase.from("profiles").select("is_premium").eq("id", userId).maybeSingle(),
      "Lecture du profil"
    );
    eligibility = !!profile?.is_premium || (await isDirector(supabase, userId));
    return eligibility;
  };

  try {
    if (action === "status") {
      const hasAccess = await hasScriptAccess(supabase, authData.user, scriptId);
      if (!hasAccess) {
        return fail(res, 404, "not_found", "Script introuvable");
      }

      // Verrous au niveau du script (ceux du propriétaire priment en cas de doublon)
      const lockRows =
        must(
          await supabase
            .from("tts_voice_locks")
            .select("character_id, voice_id, user_id")
            .eq("script_id", scriptId),
          "Lecture des verrous de voix"
        ) || [];
      const locks = {};
      for (const l of lockRows) {
        if (!(l.character_id in locks) || l.user_id === hasAccess.user_id) {
          locks[l.character_id] = l.voice_id;
        }
      }

      return res.status(200).json({
        locks,
        usage: await readUsage(supabase, userId),
        canGenerate: await isEligible(),
      });
    }

    if (action === "lock") {
      if (!(await isEligible())) {
        return fail(res, 403, "not_premium", "Fonctionnalité réservée aux abonnés Premium et aux metteurs en scène");
      }
      if (!isAllowedVoice(voiceId)) {
        return fail(res, 400, "bad_voice", `Voix HD inconnue : ${voiceId}`);
      }
      const hasAccess = await hasScriptAccess(supabase, authData.user, scriptId);
      if (!hasAccess) {
        return fail(res, 404, "not_found", "Script introuvable");
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
      const [hasAccess, replicaResult] = await Promise.all([
        hasScriptAccess(supabase, authData.user, scriptId),
        supabase
          .from("replicas")
          .select("id, character_id, text") // PAS de character_name : cette colonne n'existe pas
          .eq("id", replicaId)
          .eq("script_id", scriptId)
          .maybeSingle(),
      ]);

      if (!hasAccess) {
        return fail(res, 404, "not_found", "Script introuvable");
      }
      const replica = must(replicaResult, "Lecture de la réplique");
      if (!replica) {
        return fail(res, 404, "not_found", "Réplique introuvable");
      }

      const text = cleanTextForTts(replica.text);
      if (!text) return fail(res, 400, "empty_text", "Aucun texte à lire");
      if (text.length > TTS_MAX_CHARS_PER_REPLICA) {
        return fail(res, 413, "too_long", "Réplique trop longue pour la synthèse vocale");
      }

      // Recherche de la voix verrouillée pour ce personnage.
      // character_id vient de la réplique ; à défaut, celui envoyé par le client (vérifié dans le script).
      let lockCharacterId = replica.character_id || null;
      if (!lockCharacterId && characterId) {
        const char = must(
          await supabase
            .from("characters")
            .select("id")
            .eq("id", characterId)
            .eq("script_id", scriptId)
            .maybeSingle(),
          "Lecture du personnage"
        );
        lockCharacterId = char?.id || null;
      }

      let lock = null;
      if (lockCharacterId) {
        const lockRows = must(
          await supabase
            .from("tts_voice_locks")
            .select("voice_id, user_id")
            .eq("script_id", scriptId)
            .eq("character_id", lockCharacterId)
            .limit(20),
          "Lecture du verrou de voix"
        );
        lock = pickLock(lockRows, hasAccess.user_id);
      }

      if (!lock) {
        return fail(res, 409, "voice_not_chosen", "Aucune voix Premium n'est encore verrouillée pour ce personnage");
      }

      const textHash = createHash("sha256").update(text).digest("hex").slice(0, 32);

      // 1. Vérification dans la table de cache Supabase
      const cached = must(
        await supabase
          .from("tts_audio_cache")
          .select("storage_path")
          .eq("script_id", scriptId)
          .eq("replica_id", replica.id)
          .eq("voice_id", lock.voice_id)
          .eq("text_hash", textHash)
          .limit(1)
          .maybeSingle(),
        "Lecture du cache audio"
      );

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
      if (!(await isEligible())) {
        return fail(res, 403, "not_premium", "Génération réservée aux abonnés Premium et aux metteurs en scène");
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
        console.warn("[api/tts] RPC reserve_tts_quota fallback:", quotaErr?.message);
      }

      try {
        const audio = await synthesizeLong(text, lock.voice_id);
        const path = `${userId}/${scriptId}/${replica.id}-${lock.voice_id}-${textHash}.mp3`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, audio, { contentType: "audio/mpeg", upsert: true });

        if (uploadError) {
          throw new Error(`Échec stockage Supabase Storage: ${uploadError.message}`);
        }

        const { error: cacheError } = await supabase.from("tts_audio_cache").upsert(
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
        if (cacheError) {
          // L'audio est stocké : on le sert quand même, mais on le signale très fort
          // (sinon chaque lecture régénère l'audio et consomme du quota Google).
          console.error("[api/tts] Écriture tts_audio_cache en échec :", cacheError.message);
        }

        const url = await signedUrl(supabase, path);
        if (!url) {
          throw new Error("URL signée Supabase Storage indisponible après génération");
        }

        return res.status(200).json({
          url,
          cached: false,
          usage: await readUsage(supabase, userId),
        });
      } catch (err) {
        if (reservedTotal !== null) {
          await supabase.rpc("release_tts_quota", {
            p_user: userId,
            p_period: period,
            p_chars: text.length,
          }).catch(() => {});
        }
        throw err;
      }
    }

    return fail(res, 400, "bad_action", "Action inconnue demandée à l'API");
  } catch (err) {
    console.error("[api/tts fatal]", err?.message || err);
    return fail(
      res,
      502,
      "tts_failed",
      `Échec du service de voix Premium : ${err?.message || err}`,
      process.env.VERCEL_ENV === "production" ? null : err?.stack
    );
  }
}
