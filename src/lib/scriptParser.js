/**
 * scriptParser.js (v4) - Parseur de scripts de théâtre pour Scan Classique Standard (Front-end)
 * Supporte :
 * 1. Le format avec deux-points ("SAM : Bonjour")
 * 2. Le format sans deux-points avec nom en majuscules ("IVANA\nEst-ce que tout le monde est prêt?")
 * 3. La détection automatique des Actes et Scènes ("# Scène 1", "Scène 2", "Acte 1")
 */

// Regex pour repérer les actes et scènes
const ACT_REGEX = /^(?:#\s*)?(?:ACTE|Acte)\s+([IVXLCDM\d]+|\bUN\b|\bDEUX\b|\bTROIS\b|\bQUATRE\b|\bCINQ\b|PREMIER)/i;
const SCENE_REGEX = /^(?:#\s*)?(?:SCÈNE|SCENE|Scène|Scene)\s*([\dIVXLCDM]+)?\s*[:\-\.]?\s*(.*)/i;
const ACT_SCENE_INLINE_REGEX = /(?:ACTE|Acte)\s*([\dIVXLCDM]+)?\s*(?:SCÈNE|SCENE|Scène|Scene)\s*([\dIVXLCDM]+)?\s*[:\-\.]?\s*(.*)/i;

/**
 * Nettoie et normalise une ligne de texte
 */
function cleanLine(line) {
  if (!line) return '';
  return line.trim();
}

/**
 * Détermine si une ligne contient un personnage avec deux-points ("JOHN : Bonjour")
 */
function parseColonCharacterLine(line) {
  const match = line.match(/^([A-ZÀ-ÖØ-ß0-9\s'\-\.\+]{2,35})\s*:\s*(.*)/);
  if (match) {
    const rawChar = match[1].trim();
    const rest = match[2].trim();
    if (ACT_REGEX.test(rawChar) || SCENE_REGEX.test(rawChar) || rawChar.startsWith('PAGE')) {
      return null;
    }
    return { character: rawChar, text: rest };
  }
  return null;
}

/**
 * Détermine si une ligne est un nom de personnage seul en majuscules ("IVANA" ou "LINA + AYA")
 */
function isStandaloneCharacterLine(line) {
  if (!line || line.length < 2 || line.length > 35) return false;
  
  // Doit être en majuscules
  if (line !== line.toUpperCase()) return false;

  // Exclure mots-clés système / didascalies isolées
  if (ACT_REGEX.test(line) || SCENE_REGEX.test(line) || line.startsWith('PAGE') || line === 'NOIR' || line === '(NOIR)' || line === 'FIN' || line === '(FIN)') {
    return false;
  }

  // Ne doit pas se terminer par une ponctuation de phrase
  if (/[\?\!\;\,\.]$/.test(line)) return false;

  return true;
}

/**
 * Fonction principale de parsing du texte d'un script PDF / Textuel
 * @param {string} fullText - Le texte brut extrait du PDF
 * @param {string} fileName - Nom du fichier
 * @returns {Object} { title, characters, replicas, stats }
 */
export function parseScriptText(fullText, fileName = '') {
  if (!fullText || typeof fullText !== 'string') {
    return {
      title: fileName.replace(/\.[^/.]+$|\$/, '') || 'Sans titre',
      characters: [],
      replicas: [],
      stats: { charactersCount: 0, replicasCount: 0 }
    };
  }

  const rawLines = fullText.split(/\r?\n/);
  const replicas = [];
  const characterSet = new Set();

  let currentActTitle = null;
  let currentSceneTitle = null;
  let currentCharacter = null;
  let currentReplicaText = '';
  let currentPageNumber = 1;
  let currentActNumber = 0;
  let currentSceneNumber = 0;

  rawLines.forEach((rawLine, lineIndex) => {
    const line = cleanLine(rawLine);
    if (!line) return;

    // Détection de numéro de page
    const pageMatch = line.match(/^(?:Page|\-\s*)\s*(\d+)\s*\-?$/i);
    if (pageMatch) {
      currentPageNumber = parseInt(pageMatch[1], 10);
      return;
    }

    // 1. Détection "Acte X Scène Y"
    const actSceneMatch = line.match(ACT_SCENE_INLINE_REGEX);
    if (actSceneMatch) {
      if (currentReplicaText && currentCharacter) {
        pushReplica();
      }
      currentActNumber = actSceneMatch[1] ? actSceneMatch[1] : (currentActNumber + 1);
      currentSceneNumber = actSceneMatch[2] ? actSceneMatch[2] : (currentSceneNumber + 1);
      currentActTitle = `Acte ${currentActNumber}`;
      const subtitle = actSceneMatch[3] ? ` : ${actSceneMatch[3].trim()}` : '';
      currentSceneTitle = `Scène ${currentSceneNumber}${subtitle}`;
      return;
    }

    // 2. Détection "Acte X" seul
    const actMatch = line.match(ACT_REGEX);
    if (actMatch) {
      if (currentReplicaText && currentCharacter) {
        pushReplica();
      }
      currentActNumber++;
      currentActTitle = `Acte ${actMatch[1] || currentActNumber}`;
      currentSceneTitle = null;
      currentSceneNumber = 0;
      return;
    }

    // 3. Détection "Scène Y" seul (ex: "# Scène 1" ou "Scène 2")
    const sceneMatch = line.match(SCENE_REGEX);
    if (sceneMatch && !parseColonCharacterLine(line)) {
      if (currentReplicaText && currentCharacter) {
        pushReplica();
      }
      currentSceneNumber++;
      const sceneNum = sceneMatch[1] || currentSceneNumber;
      const sceneSub = sceneMatch[2] ? ` : ${sceneMatch[2].trim()}` : '';
      currentSceneTitle = `Scène ${sceneNum}${sceneSub}`;
      return;
    }

    // 4. Détection Personnage avec deux-points ("SAM : Bonjour")
    const colonChar = parseColonCharacterLine(line);
    if (colonChar) {
      if (currentReplicaText && currentCharacter) {
        pushReplica();
      }
      currentCharacter = colonChar.character;
      characterSet.add(currentCharacter);
      currentReplicaText = colonChar.text;
      return;
    }

    // 5. Détection Personnage seul en majuscules ("IVANA" ou "LINA + AYA")
    if (isStandaloneCharacterLine(line)) {
      if (currentReplicaText && currentCharacter) {
        pushReplica();
      }
      currentCharacter = line;
      characterSet.add(currentCharacter);
      currentReplicaText = '';
      return;
    }

    // 6. Continuation du texte ou didascalie/contexte
    if (currentCharacter) {
      if (currentReplicaText) {
        currentReplicaText += ' ' + line;
      } else {
        currentReplicaText = line;
      }
    } else {
      // Didascalie de décor/ambiance avant première réplique
      if (line.startsWith('(') || line.startsWith('[')) {
        replicas.push({
          id: `rep-ctx-${lineIndex}`,
          character: 'CONTEXTE',
          character_name: 'CONTEXTE',
          text: line,
          act_title: currentActTitle,
          scene_title: currentSceneTitle,
          is_context: true,
          page_number: currentPageNumber,
          order_index: (replicas.length + 1) * 1000
        });
      }
    }
  });

  if (currentReplicaText && currentCharacter) {
    pushReplica();
  }

  function pushReplica() {
    if (!currentReplicaText.trim()) return;
    const isContext = currentReplicaText.trim().startsWith('(') && currentReplicaText.trim().endsWith(')');

    replicas.push({
      id: `rep-${replicas.length + 1}`,
      character: currentCharacter,
      character_name: currentCharacter,
      text: currentReplicaText.trim(),
      act_title: currentActTitle,
      scene_title: currentSceneTitle,
      is_context: isContext,
      page_number: currentPageNumber,
      order_index: (replicas.length + 1) * 1000
    });

    currentReplicaText = '';
  }

  const characters = Array.from(characterSet).map((name, idx) => ({
    name,
    color: getRandomColor(idx)
  }));

  const title = fileName ? fileName.replace(/\.[^/.]+$|\$/, '') : 'Sans titre';

  return {
    title,
    characters,
    replicas,
    stats: {
      charactersCount: characters.length,
      replicasCount: replicas.length,
      actsCount: currentActNumber,
      scenesCount: currentSceneNumber
    }
  };
}

function getRandomColor(index) {
  const colors = [
    '#E53E3E', '#DD6B20', '#D69E2E', '#38A169', '#319795',
    '#3182CE', '#00B5D8', '#805AD5', '#D53F8C', '#B83280',
  ];
  return colors[index % colors.length];
}

// Exports multiples pour compatibilité avec Upload.jsx et scriptStore.js
export const parseScript = parseScriptText;
export default parseScriptText;
