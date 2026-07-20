/**
 * Service de traitement des PDF via notre serveur Premium OCR (PaddleOCR)
 */

/**
 * Envoie un PDF à notre serveur PaddleOCR pour analyse complète du script théâtral
 * @param {File} file - Fichier PDF du script
 * @param {function} onProgress - Callback de progression
 * @returns {Promise<{title: string, characters: Array, replicas: Array}>} Le script analysé
 */
export async function processWithPaddleOCR(file, onProgress) {
  if (!file) {
    throw new Error("Aucun fichier fourni pour le scan premium");
  }

  try {
    if (onProgress) onProgress(0.1);

    const formData = new FormData();
    formData.append("file", file);

    const backendUrl =
      import.meta.env.VITE_BACKEND_OCR_URL ||
      import.meta.env.VITE_API_URL ||
      "http://127.0.0.1:8000/api/ocr";

    let url = backendUrl;
    if (url.endsWith("/api/ocr")) {
      url = url.replace("/api/ocr", "/api/extract-premium");
    } else if (!url.endsWith("/api/extract-premium")) {
      url = url.replace(/\/$/, "") + "/api/extract-premium";
    }

    console.log("Appel PaddleOCR Premium sur :", url);

    if (onProgress) onProgress(0.3);

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (onProgress) onProgress(0.8);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Erreur service PaddleOCR: ${errorText || response.statusText}`,
      );
    }

    const data = await response.json();

    if (onProgress) onProgress(1.0);

    return {
      title: data.title || file.name.replace(/\.[^/.]+$/, ""),
      characters: data.characters || [],
      replicas: data.replicas || [],
    };
  } catch (error) {
    console.error("Erreur dans processWithPaddleOCR:", error);
    throw new Error(`Échec du scan premium (PaddleOCR) : ${error.message}`);
  }
}
