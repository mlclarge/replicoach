/**
 * Service de traitement des PDF via notre serveur Premium OCR (PaddleOCR)
 */
import { PDFDocument } from "pdf-lib";

/**
 * Découpe un fichier PDF par lots de pages
 * @param {File} file - Fichier PDF
 * @param {number} pagesPerChunk - Nombre de pages par lot
 * @returns {Promise<{chunks: Array<{file: File, startPage: number, endPage: number}>, pageCount: number}|null>} Les lots de PDF ou null si découpe non requise
 */
async function splitPdf(file, pagesPerChunk = 5) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pageCount = pdfDoc.getPageCount();

    if (pageCount <= pagesPerChunk) {
      return null; // Découpe non nécessaire
    }

    const chunks = [];
    for (let i = 0; i < pageCount; i += pagesPerChunk) {
      const chunkDoc = await PDFDocument.create();
      const end = Math.min(i + pagesPerChunk, pageCount);
      const pagesToCopy = Array.from(
        { length: end - i },
        (_, index) => i + index,
      );

      const copiedPages = await chunkDoc.copyPages(pdfDoc, pagesToCopy);
      copiedPages.forEach((page) => chunkDoc.addPage(page));

      const pdfBytes = await chunkDoc.save();
      const chunkFileName = `${file.name.replace(/\.pdf$/i, "")}_part${Math.floor(i / pagesPerChunk) + 1}.pdf`;
      const chunkFile = new File([pdfBytes], chunkFileName, {
        type: "application/pdf",
      });

      chunks.push({
        file: chunkFile,
        startPage: i + 1,
        endPage: end,
      });
    }
    return { chunks, pageCount };
  } catch (error) {
    console.error("Erreur lors de la découpe du PDF avec pdf-lib:", error);
    // En cas d'erreur de découpe, on retourne null pour tenter l'envoi direct
    return null;
  }
}

/**
 * Envoie un PDF ou des fragments de PDF à notre serveur PaddleOCR pour analyse complète du script théâtral
 * @param {File} file - Fichier PDF du script
 * @param {function} onProgress - Callback de progression (progress, message)
 * @returns {Promise<{title: string, characters: Array, replicas: Array}>} Le script analysé
 */
export async function processWithPaddleOCR(file, onProgress) {
  if (!file) {
    throw new Error("Aucun fichier fourni pour le scan premium");
  }

  try {
    if (onProgress) onProgress(0.1, "Préparation du fichier...");

    // Vérifier si le fichier est un PDF de plus de 5 pages pour découpage
    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    let pdfChunksData = null;

    if (isPdf) {
      pdfChunksData = await splitPdf(file, 5);
    }

    const hasEnvUrl = !!(
      import.meta.env.VITE_BACKEND_OCR_URL || import.meta.env.VITE_API_URL
    );
    if (!hasEnvUrl) {
      console.warn(
        "⚠️ [PaddleOCR] Ni VITE_BACKEND_OCR_URL ni VITE_API_URL ne sont définies dans l'environnement. " +
          "Utilisation du fallback local : http://127.0.0.1:8000/api/ocr",
      );
    }

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

    // Cas 1 : Pas de découpage requis (<= 5 pages ou erreur de découpe)
    if (!pdfChunksData) {
      console.log(
        "🚀 [PaddleOCR] Appel direct du service premium (en une seule requête) sur :",
        url,
      );
      if (onProgress) onProgress(0.3, "Envoi du fichier...");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (onProgress) onProgress(0.8, "Récupération des résultats...");

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Erreur service PaddleOCR: ${errorText || response.statusText}`,
        );
      }

      const data = await response.json();
      if (onProgress) onProgress(1.0, "Analyse terminée !");

      return {
        title: data.title || file.name.replace(/\.[^/.]+$/, ""),
        characters: data.characters || [],
        replicas: data.replicas || [],
      };
    }

    // Cas 2 : Découpage requis
    const { chunks, pageCount } = pdfChunksData;
    console.log(
      `✂️ [PaddleOCR] PDF découpé en ${chunks.length} lots de 5 pages pour un total de ${pageCount} pages.`,
    );

    const chunkResults = [];

    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index];
      const message = `Traitement : lot ${index + 1}/${chunks.length} (pages ${chunk.startPage} à ${chunk.endPage} / ${pageCount})`;
      const chunkProgressBase = index / chunks.length;

      if (onProgress) {
        onProgress(chunkProgressBase + 0.05 / chunks.length, message);
      }

      console.log(
        `🚀 [PaddleOCR] Envoi du chunk ${index + 1}/${chunks.length} (pages ${chunk.startPage}-${chunk.endPage})`,
      );

      const formData = new FormData();
      formData.append("file", chunk.file);

      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Erreur lors du traitement des pages ${chunk.startPage}-${chunk.endPage}: ${errorText || response.statusText}`,
        );
      }

      const data = await response.json();
      chunkResults.push(data);

      if (onProgress) {
        onProgress((index + 1) / chunks.length, message);
      }
    }

    // Fusion des résultats reçus à chaque étape
    const mergedData = {
      title: "",
      characters: [],
      replicas: [],
    };

    const uniqueCharacters = new Map();

    for (const chunkResult of chunkResults) {
      if (!mergedData.title && chunkResult.title) {
        mergedData.title = chunkResult.title;
      }

      if (chunkResult.characters) {
        for (const char of chunkResult.characters) {
          if (char && char.name) {
            const key = char.name.trim().toUpperCase();
            if (!uniqueCharacters.has(key)) {
              uniqueCharacters.set(key, char);
            }
          }
        }
      }

      if (chunkResult.replicas) {
        mergedData.replicas.push(...chunkResult.replicas);
      }
    }

    mergedData.characters = Array.from(uniqueCharacters.values());
    if (!mergedData.title) {
      mergedData.title = file.name.replace(/\.[^/.]+$/, "");
    }

    if (onProgress) onProgress(1.0, "Analyse et fusion terminées !");

    return mergedData;
  } catch (error) {
    console.error("Erreur dans processWithPaddleOCR:", error);
    throw new Error(`Échec du scan premium (PaddleOCR) : ${error.message}`);
  }
}
