import { supabase } from "./supabase";
import { callTts, fetchScriptVoiceLocks } from "./premiumTts";

/**
 * Normalise un nom de personnage pour comparaison insensible aux accents,
 * à la casse et aux espaces superflus.
 */
function normalizeName(name) {
  if (!name) return "";
  return String(name)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Répliques qui ne se lisent pas à voix haute (même règle que AudioMode.isDidascalie)
function isNonSpoken(r, normName) {
  const txt = (r.text || "").trim();
  return (
    normName === "DIDASCALIE" ||
    normName === "DIDASCALIES" ||
    normName === "CONTEXTE" ||
    r.is_context ||
    r.is_didascalie ||
    (txt.startsWith("(") && txt.endsWith(")")) ||
    (txt.startsWith("[") && txt.endsWith("]"))
  );
}

// Erreurs qui doivent arrêter tout le lot (inutile d'insister réplique après réplique)
const FATAL_CODES = new Set(["unauthorized", "not_premium", "quota_exceeded", "config"]);
// Seules les erreurs transitoires méritent une nouvelle tentative
const RETRYABLE_CODES = new Set(["network", "tts_failed"]);

/**
 * Service de pré-génération par lot (Batch TTS) pour RépliCoach - v4 (Tolérant).
 * Associe les voix par character_id ET par character_name normalisé.
 * Gère les répliques sans character_id direct et évite tout blocage silencieux.
 */
export class BatchTtsGenerator {
  constructor(scriptId, replicas = [], characters = []) {
    this.scriptId = scriptId;
    this.replicas = replicas;
    this.characters = characters;
    this.isPaused = false;
    this.isCancelled = false;
    this.isRunning = false;
  }

  /**
   * Construit une table de correspondance flexible :
   * - character_id -> voice_id
   * - character_name normalisé -> voice_id
   */
  async buildVoiceMap() {
    const rawLocks = await fetchScriptVoiceLocks(this.scriptId);
    const voiceById = new Map();
    const voiceByName = new Map();
    const charIdByName = new Map();

    // 1. Enregistre les verrous par character_id
    for (const [charId, voiceId] of Object.entries(rawLocks || {})) {
      if (voiceId) {
        voiceById.set(charId, voiceId);
      }
    }

    // 2. Si on a la liste des personnages du script, associe les noms aux voix
    if (Array.isArray(this.characters) && this.characters.length > 0) {
      for (const char of this.characters) {
        const voiceId = voiceById.get(char.id);
        if (voiceId) {
          const norm = normalizeName(char.name);
          if (norm) {
            voiceByName.set(norm, voiceId);
            charIdByName.set(norm, char.id);
          }
        }
      }
    }

    // 3. Fallback : si this.characters est vide dans le state, interroger Supabase
    if (voiceByName.size === 0 && voiceById.size > 0 && this.scriptId) {
      try {
        const { data: dbChars } = await supabase
          .from("characters")
          .select("id, name")
          .eq("script_id", this.scriptId);

        for (const c of dbChars || []) {
          const voiceId = voiceById.get(c.id);
          if (voiceId) {
            const norm = normalizeName(c.name);
            if (norm) {
              voiceByName.set(norm, voiceId);
              charIdByName.set(norm, c.id);
            }
          }
        }
      } catch (err) {
        console.warn("[BatchTTS] Erreur résolution noms personnages:", err);
      }
    }

    return { voiceById, voiceByName, charIdByName, rawLocks };
  }

  async getStatus() {
    if (!this.scriptId) return { total: 0, cached: 0, pending: 0, locks: {} };

    const { voiceById, voiceByName, charIdByName, rawLocks } = await this.buildVoiceMap();

    // Filtre les répliques :
    // - Exclut didascalies et contexte
    // - Vérifie si une voix est verrouillée soit par character_id, soit par nom
    const targetReplicas = this.replicas.filter((r) => {
      const rawName = r.character_name || r.character || "";
      const normName = normalizeName(rawName);

      if (isNonSpoken(r, normName)) return false;

      // Correspondance par ID
      if (r.character_id && voiceById.has(r.character_id)) {
        return true;
      }

      // Correspondance tolérante par Nom
      if (normName && voiceByName.has(normName)) {
        return true;
      }

      return false;
    }).map((r) => ({
      ...r,
      // Identifiant de personnage résolu (par id, sinon par nom) : c'est celui qu'on envoie à l'API
      _characterId:
        r.character_id ||
        charIdByName.get(normalizeName(r.character_name || r.character || "")) ||
        null,
    }));

    if (targetReplicas.length === 0) {
      return { total: 0, cached: 0, pending: 0, locks: rawLocks, targetReplicas: [] };
    }

    // Récupérer les répliques déjà en cache Supabase
    try {
      const { data: cachedRows } = await supabase
        .from("tts_audio_cache")
        .select("replica_id, voice_id")
        .eq("script_id", this.scriptId);

      const expectedVoice = new Map(
        targetReplicas.map((t) => [t.id, voiceById.get(t._characterId)])
      );
      // Une réplique n'est « en cache » que si l'audio existe avec la voix actuellement verrouillée
      const cachedReplicaIds = new Set(
        (cachedRows || [])
          .filter((row) => expectedVoice.get(row.replica_id) === row.voice_id)
          .map((row) => row.replica_id)
      );

      const pendingReplicas = targetReplicas.filter((r) => !cachedReplicaIds.has(r.id));
      const cachedReplicas = targetReplicas.filter((r) => cachedReplicaIds.has(r.id));

      return {
        total: targetReplicas.length,
        cached: cachedReplicas.length,
        pending: pendingReplicas.length,
        pendingReplicas,
        locks: rawLocks,
      };
    } catch (e) {
      console.warn("[BatchTTS] Erreur vérification cache TTS:", e);
      return {
        total: targetReplicas.length,
        cached: 0,
        pending: targetReplicas.length,
        pendingReplicas: targetReplicas,
        locks: rawLocks,
      };
    }
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  cancel() {
    this.isCancelled = true;
    this.isRunning = false;
  }

  async start(onProgress) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.isCancelled = false;

    const status = await this.getStatus();
    const pendingList = status.pendingReplicas || [];
    const totalToProcess = pendingList.length;

    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    if (onProgress) {
      onProgress({
        stage: "start",
        total: status.total,
        alreadyCached: status.cached,
        toGenerate: totalToProcess,
        current: 0,
        successCount: 0,
        errorCount: 0,
      });
    }

    if (totalToProcess === 0) {
      this.isRunning = false;
      if (onProgress) {
        onProgress({
          stage: "completed",
          total: status.total,
          alreadyCached: status.cached,
          toGenerate: 0,
          current: 0,
          successCount: 0,
          errorCount: 0,
        });
      }
      return { ok: true, generated: 0 };
    }

    for (let i = 0; i < pendingList.length; i++) {
      if (this.isCancelled) break;

      while (this.isPaused && !this.isCancelled) {
        await new Promise((res) => setTimeout(res, 300));
      }

      if (this.isCancelled) break;

      const replica = pendingList[i];
      processedCount++;

      if (onProgress) {
        onProgress({
          stage: "generating",
          total: status.total,
          alreadyCached: status.cached,
          toGenerate: totalToProcess,
          current: processedCount,
          replicaId: replica.id,
          characterId: replica.character_id,
          textSample: (replica.text || "").slice(0, 45) + "...",
          successCount,
          errorCount,
        });
      }

      // Appel contrôlé à l'API TTS (speak, cacheOnly: false)
      let success = false;
      let lastErrorMessage = "";

      let fatal = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await callTts("speak", {
          scriptId: this.scriptId,
          replicaId: replica.id,
          characterId: replica._characterId || replica.character_id,
          cacheOnly: false,
        });

        if (res.ok) {
          success = true;
          break;
        }

        lastErrorMessage = res.message || res.code || "Erreur inconnue";
        if (FATAL_CODES.has(res.code)) {
          fatal = res;
          break;
        }
        if (!RETRYABLE_CODES.has(res.code)) break; // 404, 409, 413... : réessayer ne sert à rien
        await new Promise((r) => setTimeout(r, 800));
      }

      if (fatal) {
        errorCount++;
        this.isRunning = false;
        if (onProgress) {
          onProgress({
            stage: "aborted",
            total: status.total,
            alreadyCached: status.cached + successCount,
            toGenerate: totalToProcess,
            current: processedCount,
            successCount,
            errorCount,
            fatalMessage: fatal.message || fatal.code,
          });
        }
        return { ok: false, generated: successCount, errors: errorCount, aborted: fatal.code };
      }

      if (success) {
        successCount++;
      } else {
        errorCount++;
        console.warn(`[BatchTTS] Réplique ${replica.id} en échec:`, lastErrorMessage);
      }

      // Pause de sécurité entre deux appels API pour ménager le quota et Vercel
      await new Promise((res) => setTimeout(res, 350));
    }

    this.isRunning = false;

    const finalStage = this.isCancelled ? "cancelled" : "completed";
    if (onProgress) {
      onProgress({
        stage: finalStage,
        total: status.total,
        alreadyCached: status.cached + successCount,
        toGenerate: totalToProcess,
        current: processedCount,
        successCount,
        errorCount,
      });
    }

    return { ok: true, generated: successCount, errors: errorCount };
  }
}
