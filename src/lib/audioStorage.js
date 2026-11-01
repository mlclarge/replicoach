/**
 * Gestionnaire de stockage IndexedDB pour les auto-enregistrements RépliCoach.
 * Offre un stockage binaire haute capacité sur mobile (jusqu'à plusieurs centaines de Mo)
 * et élimine le blocage de la limite des 5 Mo du LocalStorage.
 */

const DB_NAME = "ReplicoachAudioDB";
const DB_VERSION = 1;
const STORE_NAME = "replica_recordings";

// Ouverture / Création de la base de données IndexedDB
export function openAudioDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB non disponible"));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Charger tous les enregistrements pour un script donné
export async function loadAllReplicaRecordingsDB(scriptId) {
  if (!scriptId) return {};
  const recordingsMap = {};

  // 1. Essayer de charger depuis IndexedDB
  try {
    const db = await openAudioDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    await new Promise((resolve) => {
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const key = String(cursor.key);
          const prefix = `${scriptId}_`;
          if (key.startsWith(prefix)) {
            const replicaId = key.substring(prefix.length);
            recordingsMap[replicaId] = cursor.value;
            recordingsMap[String(replicaId)] = cursor.value;
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => resolve();
    });
  } catch (err) {
    console.warn("Erreur chargement IndexedDB:", err);
  }

  // 2. Migration automatique & Fallback depuis LocalStorage (s'il y en a)
  try {
    const localSaved = localStorage.getItem(`replicaRecordings_${scriptId}`);
    if (localSaved) {
      const parsed = JSON.parse(localSaved);
      let migratedAny = false;

      for (const [repId, recObj] of Object.entries(parsed)) {
        if (!recordingsMap[repId]) {
          recordingsMap[repId] = recObj;
          migratedAny = true;
          // Sauvegarder dans IndexedDB pour pérenniser
          saveReplicaRecordingDB(scriptId, repId, recObj).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.warn("Erreur migration LocalStorage -> IndexedDB:", e);
  }

  return recordingsMap;
}

// Sauvegarder l'enregistrement d'une réplique dans IndexedDB
export async function saveReplicaRecordingDB(scriptId, replicaId, recordingData) {
  if (!scriptId || !replicaId) return;
  const key = `${scriptId}_${String(replicaId)}`;

  try {
    const db = await openAudioDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(recordingData, key);
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Erreur sauvegarde IndexedDB:", err);
  }
}

// Supprimer l'enregistrement d'une réplique dans IndexedDB
export async function deleteReplicaRecordingDB(scriptId, replicaId) {
  if (!scriptId || !replicaId) return;
  const keyStr = `${scriptId}_${String(replicaId)}`;
  const keyNum = `${scriptId}_${Number(replicaId)}`;

  try {
    const db = await openAudioDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(keyStr);
    store.delete(keyNum);
    await new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn("Erreur suppression IndexedDB:", err);
  }
}
