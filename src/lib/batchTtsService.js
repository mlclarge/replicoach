import { supabase } from "./supabase";
import { callTts, fetchScriptVoiceLocks } from "./premiumTts";

/**
 * Service de pré-génération par lot (Batch TTS) pour RépliCoach.
 * Permet de remplir de manière séquentielle et sécurisée le cache Supabase `tts-cache`
 * sans jamais surcharger le serveur Serverless Vercel.
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

  async getStatus() {
    if (!this.scriptId) return { total: 0, cached: 0, pending: 0, locks: {} };

    // 1. Récupérer les voix verrouillées
    const locks = await fetchScriptVoiceLocks(this.scriptId);
    const lockedCharIds = new Set(Object.keys(locks));

    // 2. Filtrer les répliques qui ont un rôle avec une voix verrouillée
    const targetReplicas = this.replicas.filter(
      (r) => r.character_id && lockedCharIds.has(r.character_id)
    );

    if (targetReplicas.length === 0) {
      return { total: 0, cached: 0, pending: 0, locks, targetReplicas: [] };
    }

    // 3. Récupérer les répliques déjà en cache Supabase
    try {
      const { data: cachedRows } = await supabase
        .from("tts_audio_cache")
        .select("replica_id")
        .eq("script_id", this.scriptId);

      const cachedReplicaIds = new Set((cachedRows || []).map((row) => row.replica_id));

      const pendingReplicas = targetReplicas.filter((r) => !cachedReplicaIds.has(r.id));
      const cachedReplicas = targetReplicas.filter((r) => cachedReplicaIds.has(r.id));

      return {
        total: targetReplicas.length,
        cached: cachedReplicas.length,
        pending: pendingReplicas.length,
        pendingReplicas,
        locks,
      };
    } catch (e) {
      console.warn("Erreur vérification cache TTS:", e);
      return {
        total: targetReplicas.length,
        cached: 0,
        pending: targetReplicas.length,
        pendingReplicas: targetReplicas,
        locks,
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
          textSample: (replica.text || "").slice(0, 40) + "...",
          successCount,
          errorCount,
        });
      }

      // Appel contrôlé à l'API TTS
      let success = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await callTts("speak", {
          scriptId: this.scriptId,
          replicaId: replica.id,
          cacheOnly: false,
        });

        if (res.ok) {
          success = true;
          break;
        }
        // Petit délai de sécurité avant tentative
        await new Promise((res) => setTimeout(res, 500));
      }

      if (success) {
        successCount++;
      } else {
        errorCount++;
      }

      // Pause de sécurité entre deux appels API pour éviter toute surcharge Serverless
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
