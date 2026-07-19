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
 * @returns {Promise<ExtractionResult>}
 */
export async function extractTextFromPDF(
  file,
  onOCRProgress = () => {},
  metadata = {},
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

    // Sinon, utiliser l'OCR (on force l'OCR local car on a des métadonnées obligatoires et un post-processing robuste)
    console.log("Peu de texte natif trouvé, tentative OCR Python...");
    return await extractWithOCR(file, onOCRProgress, metadata);
  } catch (error) {
    console.error("Erreur extraction native, bascule vers OCR local:", error);
    return await extractWithOCR(file, onOCRProgress, metadata);
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
 * Extraction avec OCR (PaddleOCR via API Python locale)
 * Retourne le texte (markdown) avec le score de confiance
 */
async function extractWithOCR(file, onProgress, metadata = {}) {
  try {
    // On simule une progression très lente car l'OCR en local sur CPU
    // peut prendre plusieurs minutes par page.
    let progressValue = 0.01;
    const progressInterval = setInterval(() => {
      // Ralentit la barre de progression au fur et à mesure pour ne pas bloquer à 90% trop vite
      const increment = (0.95 - progressValue) * 0.02;
      progressValue = Math.min(progressValue + increment, 0.95);
      onProgress(progressValue);
    }, 3000);

    const formData = new FormData();
    formData.append("file", file);

    // Injecter les métadonnées obligatoires de scan dans la requête
    if (metadata.characters) {
      formData.append("characters", metadata.characters);
    }
    if (metadata.acts) {
      formData.append("acts", metadata.acts);
    }

    // URL de l'API locale FastAPI (à lancer avec uvicorn)
    const API_URL = "http://127.0.0.1:8000/api/ocr";

    const response = await fetch(API_URL, {
      method: "POST",
      body: formData,
    });

    clearInterval(progressInterval);
    onProgress(1.0);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Erreur serveur API: ${response.status}`,
      );
    }

    const data = await response.json();

    const avgConfidence = data.confidence || 0;
    // On utilise le markdown généré par le layout analyzer,
    // car il est déjà structuré et propre.
    const fullText = data.markdown || "";

    const { quality, warning } = evaluateQuality(avgConfidence, fullText);

    return {
      text: fullText.trim(),
      confidence: Math.round(avgConfidence),
      usedOCR: true,
      quality,
      warning,
    };
  } catch (error) {
    console.error("Erreur avec l'API OCR:", error);
    throw new Error(
      "Impossible de joindre le service OCR Python. Vérifiez qu'il est bien démarré sur le port 8000.",
    );
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
