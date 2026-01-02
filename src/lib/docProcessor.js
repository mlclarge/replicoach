/**
 * Processeur de fichiers Word (.doc, .docx)
 * Utilise mammoth.js pour extraire le texte
 */

/**
 * Extrait le texte d'un fichier Word (.docx)
 * @param {File} file - Le fichier Word
 * @param {Function} onProgress - Callback de progression (optionnel)
 * @returns {Promise<string>} - Le texte extrait
 */
export async function extractTextFromWord(file, onProgress = () => {}) {
  // Vérifier le type de fichier
  const extension = file.name.toLowerCase().split('.').pop();
  
  if (extension === 'doc') {
    // Les .doc (ancien format) ne sont pas supportés par mammoth
    // On tente quand même mais avec un warning
    console.warn('.doc format detected - extraction may be limited');
  }
  
  onProgress(0.1);
  
  try {
    // Import dynamique de mammoth pour réduire la taille du bundle
    const mammoth = await import('mammoth');
    
    onProgress(0.3);
    
    // Lire le fichier comme ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    onProgress(0.5);
    
    // Extraire le texte avec mammoth
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    onProgress(0.9);
    
    if (result.messages && result.messages.length > 0) {
      // Log les warnings éventuels
      result.messages.forEach(msg => {
        console.warn('[Word Parser]', msg.message);
      });
    }
    
    onProgress(1);
    
    return result.value || '';
    
  } catch (error) {
    console.error('Erreur extraction Word:', error);
    
    // Si mammoth échoue sur un .doc, essayer une extraction basique
    if (extension === 'doc') {
      return await extractTextFromDocFallback(file);
    }
    
    throw new Error(`Impossible d'extraire le texte: ${error.message}`);
  }
}

/**
 * Extraction de secours pour les anciens .doc
 * Tente de lire le texte brut (résultat limité)
 */
async function extractTextFromDocFallback(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Chercher les chaînes de texte dans le binaire
    // C'est très basique mais peut aider
    let text = '';
    let currentWord = '';
    
    for (let i = 0; i < uint8Array.length; i++) {
      const byte = uint8Array[i];
      // Caractères imprimables ASCII
      if (byte >= 32 && byte <= 126) {
        currentWord += String.fromCharCode(byte);
      } else if (currentWord.length > 0) {
        if (currentWord.length > 3) { // Ignorer les fragments trop courts
          text += currentWord + ' ';
        }
        currentWord = '';
      }
    }
    
    // Nettoyer le résultat
    text = text
      .replace(/\s+/g, ' ')
      .replace(/[^\x20-\x7E\xC0-\xFF]/g, '') // Garder ASCII + accents
      .trim();
    
    if (text.length < 50) {
      throw new Error('Format .doc trop ancien - impossible d\'extraire le texte');
    }
    
    return text;
    
  } catch (error) {
    throw new Error('Les fichiers .doc anciens ne sont pas supportés. Veuillez convertir en .docx ou .pdf');
  }
}

/**
 * Vérifie si un fichier est un document Word
 */
export function isWordDocument(file) {
  const extension = file.name.toLowerCase().split('.').pop();
  return extension === 'doc' || extension === 'docx';
}

/**
 * Vérifie si un fichier est un fichier texte
 */
export function isTextFile(file) {
  const extension = file.name.toLowerCase().split('.').pop();
  return extension === 'txt';
}

/**
 * Extrait le texte d'un fichier texte brut
 */
export async function extractTextFromTxt(file) {
  return await file.text();
}
