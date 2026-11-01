/**
 * Gestionnaire de stockage IndexedDB pour les enregistrements vidéo RépliCoach.
 * Permet un stockage binaire haute capacité (vidéos WebM/MP4) directement sur l'appareil.
 */

const DB_NAME = "ReplicoachVideoDB";
const DB_VERSION = 1;
const STORE_NAME = "replica_videos";
const FREE_STORE_NAME = "free_videos";

export function openVideoDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB non disponible pour les vidéos"));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(FREE_STORE_NAME)) {
        db.createObjectStore(FREE_STORE_NAME, { autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadAllReplicaVideosDB(scriptId) {
  if (!scriptId) return {};
  const videosMap = {};

  try {
    const db = await openVideoDB();
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
            videosMap[replicaId] = cursor.value;
            videosMap[String(replicaId)] = cursor.value;
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => resolve();
    });
  } catch (err) {
    console.warn("Erreur chargement vidéos IndexedDB:", err);
  }

  return videosMap;
}

export async function saveReplicaVideoDB(scriptId, replicaId, videoData) {
  if (!scriptId || !replicaId) return;
  const key = `${scriptId}_${String(replicaId)}`;

  try {
    const db = await openVideoDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(videoData, key);
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Erreur sauvegarde vidéo IndexedDB:", err);
  }
}

export async function deleteReplicaVideoDB(scriptId, replicaId) {
  if (!scriptId || !replicaId) return;
  const keyStr = `${scriptId}_${String(replicaId)}`;
  const keyNum = `${scriptId}_${Number(replicaId)}`;

  try {
    const db = await openVideoDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(keyStr);
    store.delete(keyNum);
    await new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn("Erreur suppression vidéo IndexedDB:", err);
  }
}

export async function saveFreeVideoDB(videoData) {
  try {
    const db = await openVideoDB();
    const tx = db.transaction(FREE_STORE_NAME, "readwrite");
    const store = tx.objectStore(FREE_STORE_NAME);
    store.add(videoData);
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Erreur sauvegarde vidéo libre IndexedDB:", err);
  }
}
