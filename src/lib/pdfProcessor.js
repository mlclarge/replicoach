import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Extrait le texte d'un fichier (PDF ou TXT)
 */
export async function extractTextFromFile(file, onOCRProgress = () => {}) {
  const fileExtension = file.name.split(".").pop().toLowerCase();

  if (fileExtension === "txt") {
    return await extractTextFromTXT(file);
  }

  return await extractTextFromPDF(file, onOCRProgress);
}

/**
 * Extrait le texte d'un fichier TXT
 */
async function extractTextFromTXT(file) {
  // Essayer d'abord de lire le contenu brut
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  console.log("File size in bytes:", uint8Array.length);
  console.log("First 20 bytes:", Array.from(uint8Array.slice(0, 20)));

  // Essayer différents encodages
  const encodings = ["UTF-8", "ISO-8859-1", "windows-1252"];

  for (const encoding of encodings) {
    try {
      const decoder = new TextDecoder(encoding);
      const text = decoder.decode(uint8Array);

      if (text && text.trim().length > 0) {
        console.log(
          `Successfully decoded with ${encoding}, length: ${text.length}`
        );
        return text;
      }
    } catch (e) {
      console.log(`Failed to decode with ${encoding}:`, e);
    }
  }

  // Fallback avec FileReader
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      console.log("FileReader result length:", text.length);
      resolve(text);
    };
    reader.onerror = () => reject(new Error("Erreur de lecture"));
    reader.readAsText(file);
  });
}

/**
 * Extrait le texte d'un fichier PDF
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
