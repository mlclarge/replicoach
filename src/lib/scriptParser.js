/**
 * Parser de scripts théâtraux - Version 3.1
 * CORRECTION: Encodage UTF-8 + nettoyage espaces début de ligne
 *
 * Formats supportés :
 * - Numéroté : "1. Maurice : texte"
 * - Majuscules + : "LE REPRÉSENTANT : texte"
 * - Nom composé 2-3 mots : "La mère Robert : texte" / "La petite teigne : texte"
 * - Initiale + point : "C. texte" / "R. (didascalie) texte"
 * - Nom + numéro : "Répondeur 1 : texte" / "Policier 2 : texte"
 * - Nom seul sur ligne : "L'ADJUDANT-CHEF" puis texte en dessous
 * - Prénom simple : "Rosette : texte" / "Consultant : texte"
 * - Colonnes avec espaces : "RIKIYA :      Ça va pas."
 * - Nom + didascalie : "PERSONNAGE (action) texte"
 */

// Couleurs pour les personnages
const CHARACTER_COLORS = [
  "#8B1538",
  "#2563EB",
  "#059669",
  "#D97706",
  "#7C3AED",
  "#DC2626",
  "#0891B2",
  "#4F46E5",
  "#DB2777",
  "#65A30D",
];

// Prénoms français pour détection de genre
const PRENOMS_FEMININS = [
  "marie",
  "jeanne",
  "anne",
  "marguerite",
  "catherine",
  "françoise",
  "louise",
  "claire",
  "sophie",
  "julie",
  "emma",
  "léa",
  "manon",
  "chloé",
  "camille",
  "sarah",
  "laura",
  "audrey",
  "valérie",
  "fabienne",
  "claudette",
  "rolande",
  "colette",
  "suzanne",
  "monique",
  "nicole",
  "sylvie",
  "nathalie",
  "isabelle",
  "christine",
  "patricia",
  "martine",
  "sandrine",
  "véronique",
  "céline",
  "amavi",
  "claudia",
  "rosette",
  "clémence",
  "céleste",
  "roberte",
  "lucie",
  "corinne",
  "emmanuelle",
  "elodie",
  "élodie",
  "adèle",
  "adele",
  "alice",
  "charlotte",
  "élise",
  "elise",
  "inès",
  "ines",
  "léonie",
];

const PRENOMS_MASCULINS = [
  "jean",
  "pierre",
  "michel",
  "jacques",
  "louis",
  "henri",
  "paul",
  "andré",
  "maurice",
  "christophe",
  "philippe",
  "alain",
  "bernard",
  "françois",
  "richard",
  "robert",
  "daniel",
  "david",
  "thomas",
  "nicolas",
  "julien",
  "charcut",
  "repar",
  "rikiya",
  "chichiro",
  "clément",
  "consultant",
];

const MOTS_FEMININS = [
  "la ",
  "madame",
  "mme",
  "dame",
  "femme",
  "fille",
  "mère",
  "soeur",
  "cliente",
  "suspecte",
  "chère",
  "petite",
  "rageologue",
  "brigadière",
];

const MOTS_MASCULINS = [
  "le ",
  "monsieur",
  "mr",
  "homme",
  "père",
  "frère",
  "fils",
  "représentant",
  "reporter",
  "chef",
  "policier",
  "docteur",
  "dr",
  "professeur",
  "pr",
  "gros",
  "combinard",
  "adjudant",
  "consultant",
  "répondeur",
];

/**
 * Pré-traitement : découpe les longues lignes OCR contenant plusieurs répliques inline.
 * Ex: "texte JACQUES (didascalie) - réplique LUCIE - autre" → 3 lignes séparées.
 * C'est la correction principale pour les PDF dont l'OCR fusionne plusieurs répliques.
 */
function splitInlineTransitions(text) {
  const lines = text.split('\n')
  const result = []

  // Mots français courants en majuscules qui ne sont PAS des personnages
  const COMMON_CAPS = new Set([
    'MAIS', 'DONC', 'ALORS', 'BIEN', 'VRAI', 'VOILÀ', 'VOILA', 'VOICI',
    'AVANT', 'APRÈS', 'APRES', 'ENFIN', 'ENCORE', 'BREF', 'TOUT', 'RIEN',
    'JAMAIS', 'TOUJOURS', 'VITE', 'VRAI', 'FAUX', 'NON', 'OUI', 'LUI',
    'MOI', 'TOI', 'SOI', 'ELLE', 'EUX', 'ICI', 'LÀ', 'LA', 'LE', 'LES',
    'DES', 'UNE', 'CAR', 'CAD', 'SVP', 'STP', 'OK', 'HEY', 'HOP', 'AH',
    'OH', 'EH', 'BEN', 'BON', 'DIEU', 'SUPER', 'STOP', 'HELP', 'AIDE',
    'SNCF', 'EDF', 'OUI', 'NON', 'NOM', 'AVIS', 'ACTE', 'SCENE', 'SCÈNE',
    'TABLEAU', 'FIN', 'RIDEAU', 'PAGE', 'NOTE', 'JETTES', 'MERCI', 'PARDON'
  ])

  for (const line of lines) {
    // Seulement pour les lignes longues (> 80 chars)
    if (line.length < 80) {
      result.push(line)
      continue
    }

    // Chercher les transitions de personnage au milieu d'une ligne :
    // [espace][NOM_MAJUSCULES_3+_chars][espace?][didascalie?][tiret][espace]
    // Exemple : " JACQUES (désignant son œil) - T'es content"
    const pattern = /\s+([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]{3,}(?:\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]{2,})?)\s*(?:\([^)]*\))?\s*[-–—]\s/g

    const splits = [] // positions de début de nom à l'intérieur de la ligne
    let m
    while ((m = pattern.exec(line)) !== null) {
      // Position du début du nom (après l'espace initial dans le match)
      const namePos = m.index + m[0].search(/[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]/)
      if (namePos <= 0) continue // ne pas couper en début de ligne

      // Extraire juste le nom capturé
      const capturedName = m[1].trim()
      if (COMMON_CAPS.has(capturedName)) continue // ignorer les mots courants
      if (capturedName.length < 3) continue

      splits.push(namePos)
    }

    if (splits.length === 0) {
      result.push(line)
      continue
    }

    // Découper la ligne aux positions identifiées
    let prev = 0
    for (const pos of splits) {
      const part = line.substring(prev, pos).trim()
      if (part) result.push(part)
      prev = pos
    }
    const last = line.substring(prev).trim()
    if (last) result.push(last)
  }

  return result.join('\n')
}

/**
 * Parse un texte de script et extrait les personnages et répliques
 */
export function parseScript(text, filename = "") {
  const cleanedText = cleanText(text);
  // Pré-traitement : séparer les répliques inline sur une même ligne (artefact OCR PDF)
  const preprocessedText = splitInlineTransitions(cleanedText);

  // DEBUG : afficher les premières lignes après pré-traitement
  const _dbgLines = preprocessedText.split('\n');
  console.log(`[Parser DEBUG] ${filename}: ${_dbgLines.length} lignes après splitInlineTransitions`);
  console.log(`[Parser DEBUG] Lignes 0-14:`, _dbgLines.slice(0, 15).map((l, i) => `${i}:"${l.substring(0, 70)}"`).join('\n'));

  const title = extractTitle(preprocessedText, filename);

  // Détecter le format du script
  const format = detectScriptFormat(preprocessedText);
  console.log(`[Parser DEBUG] Format détecté: "${format}" pour "${title}"`);

  // Extraire la distribution (mapping rôle -> acteur)
  const distribution = extractDistribution(preprocessedText, format);

  // Extraire personnages et répliques selon le format
  const { characters, replicas } = extractCharactersAndReplicas(
    preprocessedText,
    distribution,
    format,
  );

  // Assigner couleurs et genre
  const coloredCharacters = characters.map((char, index) => ({
    ...char,
    color: CHARACTER_COLORS[index % CHARACTER_COLORS.length],
    gender: detectGender(char.name, distribution),
  }));

  // Générer textes à trous et indices
  const enrichedReplicas = replicas.map((replica, index) => ({
    ...replica,
    textGaps: generateGapsText(replica.text),
    cueWords: generateCueWords(replicas, index),
  }));

  console.log(
    `[Parser] ${title}: ${coloredCharacters.length} personnages, ${enrichedReplicas.length} répliques`,
  );
  console.log(`[Parser DEBUG] Personnages détectés:`, coloredCharacters.map(c => c.name).join(', '));
  if (enrichedReplicas.length > 0) {
    console.log(`[Parser DEBUG] Répliques 1-3:`, enrichedReplicas.slice(0, 3).map((r, i) => `#${i+1} [${r.character}]: "${r.text.substring(0, 50)}"`).join('\n'));
  }

  return { title, characters: coloredCharacters, replicas: enrichedReplicas };
}

/**
 * Nettoie le texte extrait
 * CORRECTION v3.1: Encodage UTF-8 correct + nettoyage espaces
 */
function cleanText(text) {
  return (
    text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\t/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/Page \d+ sur \d+/gi, "")
      .replace(/^\d+\s*\/\s*\d+$/gm, "")
      // Nettoyer les caractères spéciaux (carrés colorés, puces, etc.)
      // CORRECTION: Utiliser les codes Unicode explicites pour éviter les problèmes d'encodage
      .replace(
        /[\u25A0\u25A1\u25AA\u25AB\u25CF\u25CB\u25C6\u25C7\u2605\u2606\u25B6\u25BA\u25B7\u25B8\u25C0\u25C1\u25C2\u25C3\u2B1B\u2B1C]/g,
        "",
      )
      .replace(
        /[\u{1F535}\u{1F7E2}\u{1F7E1}\u{1F7E0}\u{1F534}\u26AB\u26AA]/gu,
        "",
      )
      .replace(/[\u2580-\u259F]/g, "") // Block elements
      .replace(/[\uE000-\uF8FF]/g, "") // Private use area
      .replace(/^\s*[\|\[\]]\s*/gm, "") // Pipes et crochets en début de ligne
      // CORRECTION v3.1: Nettoyer les espaces en début de ligne (après suppression des carrés colorés)
      .replace(/^[ \t]+/gm, "")
      .trim()
  );
}

/**
 * Extrait le titre du script
 */
function extractTitle(text, filename) {
  const lines = text.split("\n").slice(0, 5);

  for (const line of lines) {
    const trimmed = line.trim();
    const titleMatch = trimmed.match(/^N[°o]?\s*\d+\s*[-–]?\s*(.+)$/i);
    if (titleMatch) return trimmed;

    if (
      trimmed.length > 3 &&
      trimmed.length < 50 &&
      trimmed === trimmed.toUpperCase()
    ) {
      if (
        !/^(LE|LA|UN|UNE|LES|DES)\s/.test(trimmed) &&
        !trimmed.includes(":")
      ) {
        return trimmed;
      }
    }
  }

  return (
    filename
      .replace(/\.pdf$/i, "")
      .replace(/[-_]/g, " ")
      .trim() || "Sans titre"
  );
}

/**
 * Détecte le format du script
 */
function detectScriptFormat(text) {
  const lines = text.split("\n").slice(0, 50);

  // Format initiales : C. : JEAN ou C. Alors...
  if (lines.some((l) => /^[A-Z]\.\s*[:=]\s*[A-Z]/.test(l.trim()))) {
    return "initials";
  }
  if (lines.some((l) => /^[A-Z]\.\s+[A-ZÀ-ÿ]/.test(l.trim()))) {
    return "initials";
  }

  // Format tiret : "NOM - texte" ou "NOM (didascalie) - texte" (très courant dans les scripts français)
  // Inclut tiret court (-), demi-cadratin (–) et cadratin (—) pour couvrir les artefacts OCR
  const dashCount = lines.filter((l) =>
    /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s\-']{1,25}\s*(?:\([^)]+\))?\s*[-–—]\s+\S/.test(
      l.trim(),
    ),
  ).length;
  if (dashCount >= 2) return "dash";

  // Format nom seul sur ligne (majuscules sans :)
  let hasStandaloneNames = false;
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1]?.trim() || "";
    // Nom en majuscules seul, suivi d'une ligne qui commence par une majuscule ou minuscule
    if (
      /^(L')?[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s\-]+$/.test(line) &&
      line.length > 3 &&
      line.length < 30 &&
      nextLine &&
      /^[A-ZÀ-ÿ]/.test(nextLine) &&
      !nextLine.includes(":")
    ) {
      hasStandaloneNames = true;
      break;
    }
  }
  if (hasStandaloneNames) return "standalone";

  // Format colonnes (beaucoup d'espaces)
  if (lines.some((l) => /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]+\s*:\s{3,}/.test(l.trim()))) {
    return "columns";
  }

  // Format avec titre : "LE Pr. CHARCUT :" ou "LE Dr REPAR :"
  if (
    lines.some((l) =>
      /^LE\s+(Pr|Dr)[.,]?\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]+\s*\.?\s*:/i.test(l.trim()),
    )
  ) {
    return "titled";
  }

  // Format nom composé 3+ mots : "La mère Robert :"
  if (lines.some((l) => /^(La|Le)\s+\w+\s+\w+\s*:/i.test(l.trim()))) {
    return "compound3";
  }

  // Format nom + numéro : "Répondeur 1 :" ou "Policier 2 :"
  if (lines.some((l) => /^[A-ZÀ-Ÿ][a-zà-ÿ]+\s+\d\s*:/u.test(l.trim()))) {
    return "numbered";
  }

  // Format prénom + nom composé : "Jacques Lasségué :" ou "Corinne Lasségué :"
  // Détecté AVANT firstname car plus spécifique (2 mots capitalisés)
  if (
    lines.some((l) =>
      /^[A-ZÀ-Ÿ][a-zà-ÿ\-]+\s+[A-ZÀ-Ÿ][a-zà-ÿ\-]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ\-]+)?\s*(?:\([^)]+\))?\s*:/u.test(
        l.trim(),
      ),
    )
  ) {
    return "fullname";
  }

  // Format prénom simple avec : "Rosette :" ou "Consultant :"
  if (lines.some((l) => /^[A-ZÀ-Ÿ][a-zà-ÿ]+\s*:/u.test(l.trim()))) {
    return "firstname";
  }

  // Format standard avec : (majuscules)
  return "standard";
}

/**
 * Extrait la distribution selon le format
 */
function extractDistribution(text, format) {
  const distribution = new Map();
  const lines = text.split("\n").slice(0, 30);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 80) continue;

    let match;

    // Format initiales : "C. : JEAN" ou "R. : FABIENNE"
    if (format === "initials") {
      match = trimmed.match(
        /^([A-Z])\.\s*[:=]\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀ-ÿa-zà-ÿ\-]+)\s*$/,
      );
      if (match) {
        distribution.set(match[1], match[2]);
        continue;
      }
    }

    // Format nom + numéro : "Répondeur 1    : Audrey" (avec espaces multiples)
    match = trimmed.match(
      /^([A-ZÀ-Ÿ][a-zà-ÿ]+\s+\d)\s*[:=]\s*([A-ZÀ-Ÿ][a-zà-ÿ\-]+)\s*$/u,
    );
    if (match) {
      distribution.set(normalizeCharacterName(match[1]), match[2]);
      continue;
    }

    // Format prénom simple : "Consultant    : Jean" (avec espaces multiples)
    match = trimmed.match(
      /^([A-ZÀ-Ÿ][a-zà-ÿ]+)\s*[:=]\s*([A-ZÀ-Ÿ][a-zà-ÿ\-]+)\s*$/u,
    );
    if (match && match[2].length <= 20) {
      distribution.set(normalizeCharacterName(match[1]), match[2]);
      continue;
    }

    // Format nom composé : "La mère Robert : MARIE-PIERRE"
    match = trimmed.match(
      /^((?:La|Le)\s+\w+\s+\w+)\s*[:=]\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀ-ÿ\-]+)\s*$/i,
    );
    if (match) {
      distribution.set(normalizeCharacterName(match[1]), match[2]);
      continue;
    }

    // Format avec titre : "LE Pr. CHARCUT : JEAN" ou "LE Dr REPAR : MAURICE"
    match = trimmed.match(
      /^(LE\s+(?:Pr|Dr)[.,]?\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]+)\s*\.?\s*[:=]\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]+)\s*$/i,
    );
    if (match) {
      distribution.set(normalizeCharacterName(match[1]), match[2]);
      continue;
    }

    // Format standard : "PERSONNAGE : ACTEUR"
    match = trimmed.match(
      /^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s\d\-']+?)\s*[:=]\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀ-ÿa-zà-ÿ\-]+)\s*$/,
    );
    if (match && match[2].length <= 20) {
      distribution.set(match[1].trim(), match[2]);
    }
  }

  return distribution;
}

/**
 * Extrait les personnages et répliques
 */
function extractCharactersAndReplicas(text, distribution, format) {
  const characters = new Map();
  const replicas = [];
  const knownCharacters = new Set(distribution.keys());

  // Pré-remplir les personnages de la distribution
  for (const [charName, actorName] of distribution) {
    if (!characters.has(charName)) {
      characters.set(charName, { name: charName, actor: actorName });
    }
  }

  const lines = text.split("\n");
  let currentCharacter = null;
  let currentText = "";

  // Trouver où commence le dialogue
  const dialogueStart = findDialogueStart(lines, format);

  for (let i = dialogueStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^Page \d+/i.test(line) || /^\d+\s*\/\s*\d+$/.test(line)) continue;

    // Essayer de matcher une réplique selon le format
    const match = matchReplicaLine(line, lines, i, knownCharacters, format);

    if (match) {
      // Sauvegarder la réplique précédente
      if (currentCharacter && currentText.trim()) {
        replicas.push({
          character: currentCharacter,
          text: cleanReplicaText(currentText),
        });
      }

      currentCharacter = match.character;
      currentText = match.text;

      // Ajouter le personnage
      if (!characters.has(currentCharacter)) {
        characters.set(currentCharacter, { name: currentCharacter });
        knownCharacters.add(currentCharacter);
      }

      // Si format standalone, sauter les lignes déjà consommées
      if (match.skipLines) {
        i += match.skipLines;
      }
    } else if (currentCharacter) {
      // Vérifier si c'est un changement de personnage inline (format tiret + nom connu)
      // Ex: "JACQUES (désignant son œil) - T'es contente de toi ?"
      const inlineDash = matchInlineDash(line, knownCharacters);
      if (inlineDash) {
        if (currentText.trim()) {
          replicas.push({
            character: currentCharacter,
            text: cleanReplicaText(currentText),
          });
        }
        currentCharacter = inlineDash.character;
        currentText = inlineDash.text;
        if (!characters.has(currentCharacter)) {
          characters.set(currentCharacter, { name: currentCharacter });
          knownCharacters.add(currentCharacter);
        }
      } else {
        // Suite de la réplique
        currentText += " " + line;
      }
    }
  }

  // Sauvegarder la dernière réplique
  if (currentCharacter && currentText.trim()) {
    replicas.push({
      character: currentCharacter,
      text: cleanReplicaText(currentText),
    });
  }

  if (replicas.length === 0) {
    console.warn("[Parser] Aucune réplique détectée, parsing alternatif...");
    return fallbackParsing(text);
  }

  return { characters: Array.from(characters.values()), replicas };
}

/**
 * Trouve où commence le dialogue
 */
function findDialogueStart(lines, format) {
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const line = lines[i].trim();

    // Didascalie d'ouverture
    if (/^\([^)]+\)\s*$/.test(line) && i > 3) return i + 1;

    // Première réplique détectée
    if (format === "initials" && /^[A-Z]\.\s+[A-ZÀ-ÿ]/.test(line)) return i;
    if (
      format === "standalone" &&
      /^(L')?[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s\-]+$/.test(line)
    )
      return i;
    if (
      format === "dash" &&
      /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s\-']{1,25}\s*(?:\([^)]+\))?\s*[-–—]\s+\S/.test(
        line,
      )
    )
      return i;
    // Format dash mixte OCR : nom seul avant les répliques (ex: "LUCIE" sur sa ligne avant "(off) - texte")
    if (
      format === "dash" &&
      i > 3 &&
      /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]{2,}(?:\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]{2,})?$/.test(line) &&
      line.length >= 3 &&
      line.length <= 25 &&
      !['ACTE', 'SCENE', 'SCÈNE', 'TABLEAU', 'FIN', 'RIDEAU', 'PAGE', 'NOTE', 'TOUT', 'BASCULE'].includes(line)
    )
      return i;
    if (
      format === "fullname" &&
      /^[A-ZÀ-Ÿ][a-zà-ÿ\-]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ\-]+)*\s*(?:\([^)]+\))?\s*:/u.test(
        line,
      )
    )
      return i;
    if (/^[A-ZÀ-Ÿ][a-zà-ÿ]+\s*:/.test(line) && line.length > 20) return i;
  }

  return Math.min(8, lines.length);
}

/**
 * Matcher une ligne de réplique selon le format
 */
function matchReplicaLine(line, lines, lineIndex, knownChars, format) {
  let match;

  // Format tiret : "NOM - texte" ou "NOM (didascalie) - texte"
  if (format === "dash") {
    match = line.match(
      /^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s\-']{0,25}?)\s*(?:\(([^)]+)\))?\s*[-–—]\s+(.{2,})$/,
    );
    if (match) {
      const didascalie = match[2] ? `(${match[2]}) ` : "";
      return {
        character: normalizeCharacterName(match[1]),
        text: didascalie + match[3],
      };
    }
    // Nom seul en majuscules (format mixte OCR page 1 : nom sur sa propre ligne)
    // ex: "LUCIE" ou "JEAN TOURILLE" → personnage sans texte, le texte suit sur la ligne d'après
    if (
      /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]{2,}(?:\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]{2,})?$/.test(line) &&
      line.length >= 3 &&
      line.length <= 25 &&
      !COMMON_CAPS_EXCL.has(line.split(' ')[0])
    ) {
      return { character: normalizeCharacterName(line), text: '' };
    }
  }

  // Format initiales : "C. texte" ou "R. (didascalie) texte"
  if (format === "initials") {
    match = line.match(/^([A-Z])\.\s*(\([^)]+\))?\s*(.+)$/);
    if (match) {
      const didascalie = match[2] ? match[2] + " " : "";
      return {
        character: match[1],
        text: didascalie + match[3],
      };
    }
  }

  // Format nom seul sur ligne (standalone)
  if (format === "standalone") {
    // Vérifier si c'est un nom seul en majuscules
    if (
      /^(L')?[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s\-]+$/.test(line) &&
      line.length > 3 &&
      line.length < 40 &&
      !line.includes(":")
    ) {
      // Chercher le texte sur les lignes suivantes
      let textLines = [];
      let skipCount = 0;
      for (let j = lineIndex + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (!nextLine) break;
        // Si on trouve un autre nom en majuscules, on arrête
        if (
          /^(L')?[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s\-]+$/.test(
            nextLine,
          ) &&
          nextLine.length > 3 &&
          nextLine.length < 40
        )
          break;
        textLines.push(nextLine);
        skipCount++;
      }
      if (textLines.length > 0) {
        return {
          character: normalizeCharacterName(line),
          text: textLines.join(" "),
          skipLines: skipCount,
        };
      }
    }
  }

  // Format colonnes : "RIKIYA :      Ça va pas."
  if (format === "columns") {
    match = line.match(/^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]+)\s*:\s{2,}(.+)$/);
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2],
      };
    }
    // Aussi accepter le format normal
    match = line.match(/^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]+)\s*:\s*(\([^)]+\))?\s*(.+)$/);
    if (match) {
      const didascalie = match[2] ? match[2] + " " : "";
      return {
        character: normalizeCharacterName(match[1]),
        text: didascalie + match[3],
      };
    }
  }

  // Format nom composé 3 mots : "La mère Robert : texte"
  if (format === "compound3") {
    match = line.match(/^((?:La|Le)\s+\w+\s+\w+)\s*:\s*(.+)$/i);
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2],
      };
    }
  }

  // Format avec titre : "LE Pr. CHARCUT : texte" ou "LE Dr REPAR : texte"
  if (format === "titled") {
    // Gérer les variations: "LE Pr. CHARCUT", "LE Dr REPAR", "LE Pr, CHARCUT" (virgule OCR), "LE Pr. CHARCUT."
    match = line.match(
      /^(LE\s+(?:Pr|Dr)[.,]?\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]+)\s*\.?\s*:\s*(.+)$/i,
    );
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2],
      };
    }
    // Avec didascalie : "LE Pr. CHARCUT : (sortant...) texte"
    match = line.match(
      /^(LE\s+(?:Pr|Dr)[.,]?\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]+)\s*\.?\s*:\s*(\([^)]+\))\s*(.+)$/i,
    );
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2] + " " + match[3],
      };
    }
  }

  // Format nom + numéro : "Répondeur 1 : texte" (format numbered)
  if (format === "numbered" || format === "firstname") {
    // D'abord essayer nom + numéro
    match = line.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+\s+\d)\s*:\s*(.+)$/u);
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2],
      };
    }
    // Puis prénom simple
    match = line.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+)\s*:\s*(.+)$/u);
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2],
      };
    }
    // Avec didascalie : "Consultant (raccroche) : texte"
    match = line.match(
      /^([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+\d)?)\s*(\([^)]+\))\s*:\s*(.+)$/u,
    );
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2] + " " + match[3],
      };
    }
    // Didascalie après le : "Consultant : (s'adressant au public) texte"
    match = line.match(
      /^([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+\d)?)\s*:\s*(\([^)]+\))\s*(.+)$/u,
    );
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2] + " " + match[3],
      };
    }
  }

  // Format prénom simple : "Rosette : texte" ou "Consultant : texte"
  if (format === "firstname") {
    match = line.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+\d)?)\s*:\s*(.+)$/u);
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2],
      };
    }
    // Aussi gérer "Clémence :" (3ème personnage qui apparaît)
    match = line.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+)\s+(.+)$/u);
    if (match && knownChars.has(match[1].toUpperCase())) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2],
      };
    }
  }

  // Format prénom + nom composé : "Jacques Lasségué : texte", "Lucie : texte", "Jean Tourille (irrité) : texte"
  if (format === "fullname") {
    // Avec ou sans didascalie avant le ":"
    match = line.match(
      /^([A-ZÀ-Ÿ][a-zà-ÿ\-]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ\-]+)*)\s*(\([^)]+\))?\s*:\s*(.+)$/u,
    );
    if (match) {
      const didascalie = match[2] ? match[2] + " " : "";
      return {
        character: normalizeCharacterName(match[1]),
        text: didascalie + match[3],
      };
    }
    // Avec didascalie après le ":" : "Jacques Lasségué : (entrant) texte"
    match = line.match(
      /^([A-ZÀ-Ÿ][a-zà-ÿ\-]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ\-]+)*)\s*:\s*(\([^)]+\))\s*(.+)$/u,
    );
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2] + " " + match[3],
      };
    }
  }

  // Formats génériques (pour tous les formats)

  // Numéroté : "1. Maurice : texte"
  match = line.match(/^(\d+)\.\s*([A-ZÀ-ÿ][A-ZÀ-ÿa-zà-ÿ\-]+)\s*:\s*(.+)$/);
  if (match) {
    return {
      character: normalizeCharacterName(match[2]),
      text: match[3],
    };
  }

  // Nom + numéro avec espaces multiples (format colonnes) : "Répondeur 3 :     Tapez..."
  match = line.match(/^([A-ZÀ-Ÿ][a-zà-ÿéèêë]+\s+\d)\s*:\s+(.+)$/u);
  if (match) {
    return {
      character: normalizeCharacterName(match[1]),
      text: match[2].trim(),
    };
  }

  // Nom composé 2 mots : "La petite teigne : texte"
  match = line.match(
    /^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][a-zàâäéèêëïîôùûüÿœæç]+\s+[a-zàâäéèêëïîôùûüÿœæç]+(?:\s+[a-zàâäéèêëïîôùûüÿœæç]+)?)\s*:\s*(.+)$/,
  );
  if (match) {
    return {
      character: normalizeCharacterName(match[1]),
      text: match[2],
    };
  }

  // Prénom Nom mixte (fallback) : "Jacques Lasségué : texte", "Michel Rolors : texte"
  // Deux mots max, les deux avec majuscule, pas de mots de mise en scène
  {
    const STAGE_WORDS = [
      "scène",
      "scene",
      "acte",
      "décor",
      "rideau",
      "note",
      "fin",
      "début",
      "suite",
      "tableau",
    ];
    const mixedMatch = line.match(
      /^([A-ZÀ-Ÿ][a-zà-ÿ\-]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ\-]+){1,2})\s*(?:\([^)]+\))?\s*:\s*(.+)$/u,
    );
    if (mixedMatch) {
      const charName = mixedMatch[1].trim();
      const textPart = mixedMatch[2].trim();
      if (
        textPart.length > 0 &&
        !STAGE_WORDS.some((w) => charName.toLowerCase().startsWith(w))
      ) {
        return { character: normalizeCharacterName(charName), text: textPart };
      }
    }
  }

  // Nom + numéro : "Répondeur 1 : texte" ou "Policier 3 : texte"
  match = line.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+\s+\d)\s*:\s*(.+)$/u);
  if (match) {
    return {
      character: normalizeCharacterName(match[1]),
      text: match[2],
    };
  }

  // Majuscules avec : "LE REPRÉSENTANT : texte"
  match = line.match(
    /^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s\d\-']+?)\s*:\s*(.+)$/,
  );
  if (match) {
    const charName = match[1].trim();
    const textPart = match[2].trim();
    if (textPart.length > 15 || !/^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\-]+$/.test(textPart)) {
      return {
        character: normalizeCharacterName(charName),
        text: textPart,
      };
    }
  }

  // Majuscules avec didascalie : "PERSONNAGE (action) texte"
  match = line.match(
    /^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s\-']+?)\s*(\([^)]+\))\s*(.+)$/,
  );
  if (match) {
    return {
      character: normalizeCharacterName(match[1]),
      text: match[2] + " " + match[3],
    };
  }

  return null;
}

/**
 * Détecte un changement de personnage via format tiret.
 * Après splitInlineTransitions, la ligne commence déjà par le nom du personnage.
 * Accepte les personnages connus ET les nouveaux noms qui ne sont pas des mots courants.
 */
const COMMON_CAPS_EXCL = new Set([
  'MAIS', 'DONC', 'ALORS', 'BIEN', 'VRAI', 'VOILÀ', 'VOILA', 'VOICI',
  'AVANT', 'APRÈS', 'APRES', 'ENFIN', 'ENCORE', 'BREF', 'TOUT', 'RIEN',
  'JAMAIS', 'TOUJOURS', 'VITE', 'FAUX', 'ICI', 'DIEU', 'SUPER', 'STOP',
  'ACTE', 'SCENE', 'SCÈNE', 'TABLEAU', 'FIN', 'RIDEAU', 'PAGE', 'NOTE',
  'MERCI', 'PARDON', 'JETTES', 'AIDE', 'SNCF', 'EDF',
])

function matchInlineDash(line, knownCharacters) {
  const match = line.match(
    /^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]{2,}(?:\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]{2,})?)\s*(?:\(([^)]+)\))?\s*[-–—]\s+(.{5,})$/,
  );
  if (!match) return null;
  const charName = normalizeCharacterName(match[1].trim());
  if (COMMON_CAPS_EXCL.has(charName)) return null;
  const didascalie = match[2] ? `(${match[2]}) ` : '';
  return { character: charName, text: didascalie + match[3] };
}

/**
 * Parsing de secours
 */
function fallbackParsing(text) {
  const characters = new Map();
  const replicas = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 10) continue;

    let match;

    // Pattern nom + numéro : "Répondeur 1 : texte"
    match = trimmed.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+\s+\d)\s*:\s*(.{5,})$/u);
    if (match) {
      const charName = normalizeCharacterName(match[1]);
      if (!characters.has(charName)) {
        characters.set(charName, { name: charName });
      }
      replicas.push({ character: charName, text: match[2].trim() });
      continue;
    }

    // Pattern prénom simple : "Consultant : texte"
    match = trimmed.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+)\s*:\s*(.{5,})$/u);
    if (match) {
      const charName = normalizeCharacterName(match[1]);
      const excludeWords = [
        "ACTE",
        "SCENE",
        "SCÈNE",
        "FIN",
        "DÉBUT",
        "RIDEAU",
        "PAGE",
      ];
      if (!excludeWords.includes(charName)) {
        if (!characters.has(charName)) {
          characters.set(charName, { name: charName });
        }
        replicas.push({ character: charName, text: match[2].trim() });
        continue;
      }
    }

    // Pattern générique majuscules
    match = trimmed.match(
      /^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀ-ÿa-zà-ÿ\s\-']{1,30}?)\s*:\s*([A-Za-zÀ-ÿ«(].{10,})$/,
    );
    if (match) {
      const charName = normalizeCharacterName(match[1]);
      const text = match[2].trim();

      const excludeWords = [
        "ACTE",
        "SCENE",
        "SCÈNE",
        "FIN",
        "DÉBUT",
        "RIDEAU",
        "PAGE",
      ];
      if (excludeWords.some((w) => charName.includes(w))) continue;

      if (!characters.has(charName)) {
        characters.set(charName, { name: charName });
      }
      replicas.push({ character: charName, text });
    }
  }

  if (replicas.length === 0) {
    const narrator = "NARRATEUR";
    characters.set(narrator, { name: narrator });
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 30);
    paragraphs.forEach((p) => {
      replicas.push({ character: narrator, text: cleanReplicaText(p) });
    });
  }

  return { characters: Array.from(characters.values()), replicas };
}

// Prénoms connus pour corriger les artefacts OCR (ex: FEMMANUELLE → EMMANUELLE)
const ALL_PRENOMS_UPPER = [
  'MARIE','JEANNE','ANNE','CATHERINE','FRANÇOISE','LOUISE','CLAIRE','SOPHIE','JULIE',
  'EMMA','LÉA','LEA','MANON','CHLOÉ','CHLOE','CAMILLE','SARAH','LAURA','AUDREY',
  'VALÉRIE','VALERIE','FABIENNE','COLETTE','SUZANNE','MONIQUE','NICOLE','SYLVIE',
  'NATHALIE','ISABELLE','CHRISTINE','PATRICIA','MARTINE','SANDRINE','VÉRONIQUE',
  'VERONIQUE','CÉLINE','CELINE','ROSETTE','LUCIE','CORINNE','EMMANUELLE','ÉLODIE',
  'ELODIE','ALICE','CHARLOTTE','ÉLISE','ELISE','JEAN','PIERRE','MICHEL','JACQUES',
  'LOUIS','HENRI','PAUL','ANDRÉ','ANDRE','MAURICE','CHRISTOPHE','PHILIPPE','ALAIN',
  'BERNARD','FRANCOIS','RICHARD','ROBERT','DANIEL','DAVID','THOMAS','NICOLAS','JULIEN'
]

/**
 * Normalise un nom de personnage
 */
function normalizeCharacterName(name) {
  let normalized = name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[:\.\-]+$/, '')
    .trim();
  // Normaliser les variations de ponctuation après Pr/Dr
  normalized = normalized.replace(/^(LE\s+(?:PR|DR))[,.]?\s+/i, '$1. ');
  // Artefact OCR : lettre isolée + espace avant nom (ex: "F EMMANUELLE" → "EMMANUELLE")
  normalized = normalized.replace(/^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ])\s+([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]{3})/, '$2');
  // Artefact OCR : lettre isolée fusionnée sans espace (ex: "FEMMANUELLE" → "EMMANUELLE")
  if (/^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]{5,}$/.test(normalized)) {
    const withoutFirst = normalized.slice(1);
    if (ALL_PRENOMS_UPPER.some(p => withoutFirst === p || (withoutFirst.startsWith(p) && p.length >= 4))) {
      normalized = withoutFirst;
    }
  }
  return normalized;
}

/**
 * Nettoie le texte d'une réplique
 */
function cleanReplicaText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/^\s*[:\.\-–—]\s*/, "")
    .trim();
}

/**
 * Détecte le genre d'un personnage
 */
function detectGender(characterName, distribution) {
  const name = characterName.toLowerCase();
  const acteur = distribution.get(characterName)?.toLowerCase() || "";

  if (acteur) {
    if (PRENOMS_FEMININS.some((p) => acteur.includes(p))) return "female";
    if (PRENOMS_MASCULINS.some((p) => acteur.includes(p))) return "male";
  }

  if (MOTS_FEMININS.some((m) => name.includes(m))) return "female";
  if (MOTS_MASCULINS.some((m) => name.includes(m))) return "male";

  const words = name.split(/\s+/);
  for (const word of words) {
    if (PRENOMS_FEMININS.includes(word)) return "female";
    if (PRENOMS_MASCULINS.includes(word)) return "male";
  }

  return "unknown";
}

/**
 * Génère le texte à trous
 */
function generateGapsText(text) {
  return text.replace(/\b(\w)(\w+)\b/g, (match, first, rest) => {
    return first + "_".repeat(Math.min(rest.length, 5));
  });
}

/**
 * Génère les mots d'indices
 */
function generateCueWords(replicas, currentIndex) {
  if (currentIndex === 0) return "";
  const previousReplica = replicas[currentIndex - 1];
  if (!previousReplica) return "";

  const cleanedText = previousReplica.text.replace(/\([^)]+\)/g, "").trim();
  const words = cleanedText.split(/\s+/);
  return "..." + words.slice(-3).join(" ");
}

export { generateGapsText, generateCueWords, detectGender };
