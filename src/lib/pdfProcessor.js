import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Résultat de l'extraction avec métadonnées de qualité
 * @typedef {Object} ExtractionResult
 * @property {string} text - Le texte extrait
 * @property {number} confidence - Score de confiance (0-100), 100 si texte natif
 * @property {boolean} usedOCR - true si OCR utilisé
 * @property {string} quality - 'good', 'medium', 'poor'
 * @property {string|null} warning - Message d'avertissement si qualité faible
 */

/**
 * Extrait le texte d'un PDF avec informations de qualité
 * @param {File} file - Le fichier PDF
 * @param {Function} onOCRProgress - Callback de progression
 * @param {string[]} referenceCharacters - Liste optionnelle des personnages de référence
 * @returns {Promise<ExtractionResult>}
 */
export async function extractTextFromPDF(
  file,
  onOCRProgress = () => {},
  referenceCharacters = null,
) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const nativeResult = await extractNativeText(arrayBuffer);

    // Si suffisamment de texte natif, pas besoin d'OCR
    if (nativeResult.text.trim().length >= 100) {
      return {
        text: nativeResult.text,
        confidence: 100,
        usedOCR: false,
        quality: "good",
        warning: null,
      };
    }

    // Sinon, utiliser l'OCR
    console.log("Peu de texte natif trouvé, tentative OCR...");
    const freshBuffer = await file.arrayBuffer();
    return await extractWithOCR(
      freshBuffer,
      onOCRProgress,
      referenceCharacters,
    );
  } catch (error) {
    console.error("Erreur extraction native:", error);
    const freshBuffer = await file.arrayBuffer();
    return await extractWithOCR(
      freshBuffer,
      onOCRProgress,
      referenceCharacters,
    );
  }
}

/**
 * Extraction du texte natif (PDF avec texte intégré)
 */
async function extractNativeText(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    fullText += pageText + "\n\n";
  }

  return { text: fullText.trim() };
}

/**
 * Extraction avec OCR (Tesseract.js)
 * Retourne le texte avec le score de confiance
 */
async function extractWithOCR(
  arrayBuffer,
  onProgress,
  referenceCharacters = null,
) {
  const Tesseract = await import("tesseract.js");

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  let fullText = "";
  let totalConfidence = 0;
  let pageCount = 0;

  const worker = await Tesseract.createWorker("fra", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        const pageProgress = m.progress;
        const totalProgress =
          (fullText ? 0.5 : 0) + (pageProgress * 0.5) / numPages;
        onProgress(totalProgress);
      }
    },
  });

  try {
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);

      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      // Sécurité : ignorer les images trop petites pour éviter le crash de Tesseract
      if (canvas.width < 20 || canvas.height < 20) {
        console.warn(
          `Page ${i} ignorée pour l'OCR : image trop petite (${canvas.width}x${canvas.height})`,
        );
        onProgress(i / numPages);
        continue;
      }

      const { data } = await worker.recognize(canvas);

      // Nettoyage immédiat post-OCR Tesseract
      let pageText = data.text;

      fullText += pageText + "\n\n";

      // Accumuler la confiance moyenne
      if (data.confidence) {
        totalConfidence += data.confidence;
        pageCount++;
      }

      onProgress(i / numPages);
    }

    await worker.terminate();

    // Calculer la confiance moyenne
    const avgConfidence =
      pageCount > 0 ? Math.round(totalConfidence / pageCount) : 0;

    // Déterminer la qualité et le warning
    const { quality, warning } = evaluateQuality(avgConfidence, fullText);

    return {
      text: fullText.trim(),
      confidence: avgConfidence,
      usedOCR: true,
      quality,
      warning,
    };
  } catch (error) {
    await worker.terminate();
    throw error;
  }
}

/**
 * Évalue la qualité de l'extraction
 * @param {number} confidence - Score de confiance OCR (0-100)
 * @param {string} text - Texte extrait
 * @returns {{ quality: string, warning: string|null }}
 */
function evaluateQuality(confidence, text) {
  // Vérifications supplémentaires sur le texte
  const textLength = text.trim().length;
  const wordCount = text.trim().split(/\s+/).length;

  // Ratio de caractères "bizarres" (indicateur de mauvais OCR)
  const weirdCharsCount = (
    text.match(/[^\w\s\u00C0-\u017Fàâäéèêëïîôùûüÿœæç.,;:!?'"()\-–—«»\n]/gi) ||
    []
  ).length;
  const weirdCharRatio = textLength > 0 ? weirdCharsCount / textLength : 0;

  // Score ajusté
  let adjustedConfidence = confidence;

  // Pénaliser si beaucoup de caractères bizarres
  if (weirdCharRatio > 0.1) {
    adjustedConfidence -= 20;
  } else if (weirdCharRatio > 0.05) {
    adjustedConfidence -= 10;
  }

  // Pénaliser si très peu de mots
  if (wordCount < 50) {
    adjustedConfidence -= 15;
  }

  // Déterminer la qualité
  if (adjustedConfidence >= 70) {
    return {
      quality: "good",
      warning: null,
    };
  } else if (adjustedConfidence >= 50) {
    return {
      quality: "medium",
      warning: `⚠️ Qualité OCR moyenne (${confidence}%). Vérifiez le texte extrait et corrigez si nécessaire.`,
    };
  } else {
    return {
      quality: "poor",
      warning: `⚠️ Qualité OCR faible (${confidence}%). Le document est peut-être flou ou mal scanné.\n\n💡 Conseil : Demandez au metteur en scène de vous fournir le texte en format .txt ou .docx pour un meilleur résultat.`,
    };
  }
}

/**
 * Version simplifiée pour compatibilité (retourne juste le texte)
 * @deprecated Utiliser extractTextFromPDF qui retourne plus d'infos
 */
export async function extractTextSimple(file, onOCRProgress = () => {}) {
  const result = await extractTextFromPDF(file, onOCRProgress);
  return result.text;
}
