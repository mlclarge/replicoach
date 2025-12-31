import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Extrait le texte d'un fichier (PDF ou TXT)
 * @param {File} file - Le fichier à traiter
 * @param {Function} onOCRProgress - Callback pour la progression OCR
 * @returns {Promise<string>} Le texte extrait
 */
export async function extractTextFromFile(file, onOCRProgress = () => {}) {
  const fileExtension = file.name.split('.').pop().toLowerCase();
  
  // Fichier texte - lecture directe
  if (fileExtension === 'txt') {
    return await extractTextFromTXT(file);
  }
  
  // Fichier PDF
  return await extractTextFromPDF(file, onOCRProgress);
}

/**
 * Extrait le texte d'un fichier TXT
 */
async function extractTextFromTXT(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const text = event.target.result;
      resolve(text);
    };
    
    reader.onerror = (error) => {
      reject(new Error("Erreur de lecture du fichier texte: " + error.message));
    };
    
    // Lecture en UTF-8
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Extrait le texte d'un fichier PDF (natif ou OCR)
 */
export async function extractTextFromPDF(file, onOCRProgress = () => {}) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const text = await extractNativeText(arrayBuffer);

    if (text.trim().length < 100) {
      console.log("Peu de texte natif trouvé, tentative OCR...");
      const freshBuffer = await file.arrayBuffer();
      return await extractWithOCR(freshBuffer, onOCRProgress);
    }

    return text;
  } catch (error) {
    console.error("Erreur extraction native:", error);
    const freshBuffer = await file.arrayBuffer();
    return await extractWithOCR(freshBuffer, onOCRProgress);
  }
}

/**
 * Extraction du texte natif d'un PDF
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

  return fullText.trim();
}

/**
 * Extraction par OCR (pour PDF images)
 */
async function extractWithOCR(arrayBuffer, onProgress) {
  const Tesseract = await import("tesseract.js");

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  let fullText = "";

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

      const {
        data: { text },
      } = await worker.recognize(canvas);
      fullText += text + "\n\n";

      onProgress(i / numPages);
    }

    await worker.terminate();
    return fullText.trim();
  } catch (error) {
    await worker.terminate();
    throw error;
  }
}

// Export legacy pour compatibilité
export { extractTextFromPDF };
