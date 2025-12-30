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
  '#8B1538', '#2563EB', '#059669', '#D97706', '#7C3AED',
  '#DC2626', '#0891B2', '#4F46E5', '#DB2777', '#65A30D',
]

// Prénoms français pour détection de genre
const PRENOMS_FEMININS = [
  'marie', 'jeanne', 'anne', 'marguerite', 'catherine', 'françoise', 'louise',
  'claire', 'sophie', 'julie', 'emma', 'léa', 'manon', 'chloé', 'camille',
  'sarah', 'laura', 'audrey', 'valérie', 'fabienne', 'claudette', 'rolande',
  'colette', 'suzanne', 'monique', 'nicole', 'sylvie', 'nathalie', 'isabelle',
  'christine', 'patricia', 'martine', 'sandrine', 'véronique', 'céline',
  'amavi', 'claudia', 'rosette', 'clémence', 'céleste', 'roberte'
]

const PRENOMS_MASCULINS = [
  'jean', 'pierre', 'michel', 'jacques', 'louis', 'henri', 'paul', 'andré',
  'maurice', 'christophe', 'philippe', 'alain', 'bernard', 'françois',
  'richard', 'robert', 'daniel', 'david', 'thomas', 'nicolas', 'julien',
  'charcut', 'repar', 'rikiya', 'chichiro', 'clément', 'consultant'
]

const MOTS_FEMININS = [
  'la ', 'madame', 'mme', 'dame', 'femme', 'fille', 'mère', 'soeur',
  'cliente', 'suspecte', 'chère', 'petite', 'rageologue', 'brigadière'
]

const MOTS_MASCULINS = [
  'le ', 'monsieur', 'mr', 'homme', 'père', 'frère', 'fils',
  'représentant', 'reporter', 'chef', 'policier', 'docteur', 'dr',
  'professeur', 'pr', 'gros', 'combinard', 'adjudant', 'consultant', 'répondeur'
]

/**
 * Parse un texte de script et extrait les personnages et répliques
 */
export function parseScript(text, filename = '') {
  const cleanedText = cleanText(text)
  const title = extractTitle(cleanedText, filename)
  
  // Détecter le format du script
  const format = detectScriptFormat(cleanedText)
  console.log(`[Parser] Format détecté: ${format}`)
  
  // Extraire la distribution (mapping rôle -> acteur)
  const distribution = extractDistribution(cleanedText, format)
  
  // Extraire personnages et répliques selon le format
  const { characters, replicas } = extractCharactersAndReplicas(cleanedText, distribution, format)
  
  // Assigner couleurs et genre
  const coloredCharacters = characters.map((char, index) => ({
    ...char,
    color: CHARACTER_COLORS[index % CHARACTER_COLORS.length],
    gender: detectGender(char.name, distribution)
  }))
  
  // Générer textes à trous et indices
  const enrichedReplicas = replicas.map((replica, index) => ({
    ...replica,
    textGaps: generateGapsText(replica.text),
    cueWords: generateCueWords(replicas, index)
  }))
  
  console.log(`[Parser] ${title}: ${coloredCharacters.length} personnages, ${enrichedReplicas.length} répliques`)
  
  return { title, characters: coloredCharacters, replicas: enrichedReplicas }
}

/**
 * Nettoie le texte extrait
 * CORRECTION v3.1: Encodage UTF-8 correct + nettoyage espaces
 */
function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/Page \d+ sur \d+/gi, '')
    .replace(/^\d+\s*\/\s*\d+$/gm, '')
    // Nettoyer les caractères spéciaux (carrés colorés, puces, etc.)
    // CORRECTION: Utiliser les codes Unicode explicites pour éviter les problèmes d'encodage
    .replace(/[\u25A0\u25A1\u25AA\u25AB\u25CF\u25CB\u25C6\u25C7\u2605\u2606\u25B6\u25BA\u25B7\u25B8\u25C0\u25C1\u25C2\u25C3\u2B1B\u2B1C]/g, '')
    .replace(/[\u{1F535}\u{1F7E2}\u{1F7E1}\u{1F7E0}\u{1F534}\u26AB\u26AA]/gu, '')
    .replace(/[\u2580-\u259F]/g, '') // Block elements
    .replace(/[\uE000-\uF8FF]/g, '') // Private use area
    .replace(/^\s*[\|\[\]]\s*/gm, '') // Pipes et crochets en début de ligne
    // CORRECTION v3.1: Nettoyer les espaces en début de ligne (après suppression des carrés colorés)
    .replace(/^[ \t]+/gm, '')
    .trim()
}

/**
 * Extrait le titre du script
 */
function extractTitle(text, filename) {
  const lines = text.split('\n').slice(0, 5)
  
  for (const line of lines) {
    const trimmed = line.trim()
    const titleMatch = trimmed.match(/^N[°o]?\s*\d+\s*[-–]?\s*(.+)$/i)
    if (titleMatch) return trimmed
    
    if (trimmed.length > 3 && trimmed.length < 50 && trimmed === trimmed.toUpperCase()) {
      if (!/^(LE|LA|UN|UNE|LES|DES)\s/.test(trimmed) && !trimmed.includes(':')) {
        return trimmed
      }
    }
  }
  
  return filename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ').trim() || 'Sans titre'
}

/**
 * Détecte le format du script
 */
function detectScriptFormat(text) {
  const lines = text.split('\n').slice(0, 50)
  
  // Format initiales : C. : JEAN ou C. Alors...
  if (lines.some(l => /^[A-Z]\.\s*[:=]\s*[A-Z]/.test(l.trim()))) {
    return 'initials'
  }
  if (lines.some(l => /^[A-Z]\.\s+[A-ZÀ-ÿ]/.test(l.trim()))) {
    return 'initials'
  }
  
  // Format nom seul sur ligne (majuscules sans :)
  let hasStandaloneNames = false
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim()
    const nextLine = lines[i + 1]?.trim() || ''
    // Nom en majuscules seul, suivi d'une ligne qui commence par une majuscule ou minuscule
    if (/^(L')?[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s\-]+$/.test(line) && 
        line.length > 3 && line.length < 30 &&
        nextLine && /^[A-ZÀ-ÿ]/.test(nextLine) && !nextLine.includes(':')) {
      hasStandaloneNames = true
      break
    }
  }
  if (hasStandaloneNames) return 'standalone'
  
  // Format colonnes (beaucoup d'espaces)
  if (lines.some(l => /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]+\s*:\s{3,}/.test(l.trim()))) {
    return 'columns'
  }
  
  // Format avec titre : "LE Pr. CHARCUT :" ou "LE Dr REPAR :"
  if (lines.some(l => /^LE\s+(Pr|Dr)[.,]?\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]+\s*\.?\s*:/i.test(l.trim()))) {
    return 'titled'
  }
  
  // Format nom composé 3+ mots : "La mère Robert :"
  if (lines.some(l => /^(La|Le)\s+\w+\s+\w+\s*:/i.test(l.trim()))) {
    return 'compound3'
  }
  
  // Format nom + numéro : "Répondeur 1 :" ou "Policier 2 :"
  if (lines.some(l => /^[A-ZÀ-Ÿ][a-zà-ÿ]+\s+\d\s*:/u.test(l.trim()))) {
    return 'numbered'
  }
  
  // Format prénom simple avec : "Rosette :" ou "Consultant :"
  if (lines.some(l => /^[A-ZÀ-Ÿ][a-zà-ÿ]+\s*:/u.test(l.trim()))) {
    return 'firstname'
  }
  
  // Format standard avec : (majuscules)
  return 'standard'
}

/**
 * Extrait la distribution selon le format
 */
function extractDistribution(text, format) {
  const distribution = new Map()
  const lines = text.split('\n').slice(0, 30)
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length > 80) continue
    
    let match
    
    // Format initiales : "C. : JEAN" ou "R. : FABIENNE"
    if (format === 'initials') {
      match = trimmed.match(/^([A-Z])\.\s*[:=]\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀ-ÿa-zà-ÿ\-]+)\s*$/)
      if (match) {
        distribution.set(match[1], match[2])
        continue
      }
    }
    
    // Format nom + numéro : "Répondeur 1    : Audrey" (avec espaces multiples)
    match = trimmed.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+\s+\d)\s*[:=]\s*([A-ZÀ-Ÿ][a-zà-ÿ\-]+)\s*$/u)
    if (match) {
      distribution.set(normalizeCharacterName(match[1]), match[2])
      continue
    }
    
    // Format prénom simple : "Consultant    : Jean" (avec espaces multiples)
    match = trimmed.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+)\s*[:=]\s*([A-ZÀ-Ÿ][a-zà-ÿ\-]+)\s*$/u)
    if (match && match[2].length <= 20) {
      distribution.set(normalizeCharacterName(match[1]), match[2])
      continue
    }
    
    // Format nom composé : "La mère Robert : MARIE-PIERRE"
    match = trimmed.match(/^((?:La|Le)\s+\w+\s+\w+)\s*[:=]\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀ-ÿ\-]+)\s*$/i)
    if (match) {
      distribution.set(normalizeCharacterName(match[1]), match[2])
      continue
    }
    
    // Format avec titre : "LE Pr. CHARCUT : JEAN" ou "LE Dr REPAR : MAURICE"
    match = trimmed.match(/^(LE\s+(?:Pr|Dr)[.,]?\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]+)\s*\.?\s*[:=]\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]+)\s*$/i)
    if (match) {
      distribution.set(normalizeCharacterName(match[1]), match[2])
      continue
    }
    
    // Format standard : "PERSONNAGE : ACTEUR"
    match = trimmed.match(/^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s\d\-']+?)\s*[:=]\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀ-ÿa-zà-ÿ\-]+)\s*$/)
    if (match && match[2].length <= 20) {
      distribution.set(match[1].trim(), match[2])
    }
  }
  
  return distribution
}

/**
 * Extrait les personnages et répliques
 */
function extractCharactersAndReplicas(text, distribution, format) {
  const characters = new Map()
  const replicas = []
  const knownCharacters = new Set(distribution.keys())
  
  // Pré-remplir les personnages de la distribution
  for (const [charName, actorName] of distribution) {
    if (!characters.has(charName)) {
      characters.set(charName, { name: charName, actor: actorName })
    }
  }
  
  const lines = text.split('\n')
  let currentCharacter = null
  let currentText = ''
  
  // Trouver où commence le dialogue
  const dialogueStart = findDialogueStart(lines, format)
  
  for (let i = dialogueStart; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (/^Page \d+/i.test(line) || /^\d+\s*\/\s*\d+$/.test(line)) continue
    
    // Essayer de matcher une réplique selon le format
    const match = matchReplicaLine(line, lines, i, knownCharacters, format)
    
    if (match) {
      // Sauvegarder la réplique précédente
      if (currentCharacter && currentText.trim()) {
        replicas.push({
          character: currentCharacter,
          text: cleanReplicaText(currentText)
        })
      }
      
      currentCharacter = match.character
      currentText = match.text
      
      // Ajouter le personnage
      if (!characters.has(currentCharacter)) {
        characters.set(currentCharacter, { name: currentCharacter })
        knownCharacters.add(currentCharacter)
      }
      
      // Si format standalone, sauter les lignes déjà consommées
      if (match.skipLines) {
        i += match.skipLines
      }
    } else if (currentCharacter) {
      // Suite de la réplique
      currentText += ' ' + line
    }
  }
  
  // Sauvegarder la dernière réplique
  if (currentCharacter && currentText.trim()) {
    replicas.push({
      character: currentCharacter,
      text: cleanReplicaText(currentText)
    })
  }
  
  if (replicas.length === 0) {
    console.warn('[Parser] Aucune réplique détectée, parsing alternatif...')
    return fallbackParsing(text)
  }
  
  return { characters: Array.from(characters.values()), replicas }
}

/**
 * Trouve où commence le dialogue
 */
function findDialogueStart(lines, format) {
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const line = lines[i].trim()
    
    // Didascalie d'ouverture
    if (/^\([^)]+\)\s*$/.test(line) && i > 3) return i + 1
    
    // Première réplique détectée
    if (format === 'initials' && /^[A-Z]\.\s+[A-ZÀ-ÿ]/.test(line)) return i
    if (format === 'standalone' && /^(L')?[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s\-]+$/.test(line)) return i
    if (/^[A-ZÀ-Ÿ][a-zà-ÿ]+\s*:/.test(line) && line.length > 20) return i
  }
  
  return Math.min(8, lines.length)
}

/**
 * Matcher une ligne de réplique selon le format
 */
function matchReplicaLine(line, lines, lineIndex, knownChars, format) {
  let match
  
  // Format initiales : "C. texte" ou "R. (didascalie) texte"
  if (format === 'initials') {
    match = line.match(/^([A-Z])\.\s*(\([^)]+\))?\s*(.+)$/)
    if (match) {
      const didascalie = match[2] ? match[2] + ' ' : ''
      return {
        character: match[1],
        text: didascalie + match[3]
      }
    }
  }
  
  // Format nom seul sur ligne (standalone)
  if (format === 'standalone') {
    // Vérifier si c'est un nom seul en majuscules
    if (/^(L')?[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s\-]+$/.test(line) && 
        line.length > 3 && line.length < 40 && !line.includes(':')) {
      // Chercher le texte sur les lignes suivantes
      let textLines = []
      let skipCount = 0
      for (let j = lineIndex + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim()
        if (!nextLine) break
        // Si on trouve un autre nom en majuscules, on arrête
        if (/^(L')?[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s\-]+$/.test(nextLine) && 
            nextLine.length > 3 && nextLine.length < 40) break
        textLines.push(nextLine)
        skipCount++
      }
      if (textLines.length > 0) {
        return {
          character: normalizeCharacterName(line),
          text: textLines.join(' '),
          skipLines: skipCount
        }
      }
    }
  }
  
  // Format colonnes : "RIKIYA :      Ça va pas."
  if (format === 'columns') {
    match = line.match(/^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]+)\s*:\s{2,}(.+)$/)
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2]
      }
    }
    // Aussi accepter le format normal
    match = line.match(/^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]+)\s*:\s*(\([^)]+\))?\s*(.+)$/)
    if (match) {
      const didascalie = match[2] ? match[2] + ' ' : ''
      return {
        character: normalizeCharacterName(match[1]),
        text: didascalie + match[3]
      }
    }
  }
  
  // Format nom composé 3 mots : "La mère Robert : texte"
  if (format === 'compound3') {
    match = line.match(/^((?:La|Le)\s+\w+\s+\w+)\s*:\s*(.+)$/i)
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2]
      }
    }
  }
  
  // Format avec titre : "LE Pr. CHARCUT : texte" ou "LE Dr REPAR : texte"
  if (format === 'titled') {
    // Gérer les variations: "LE Pr. CHARCUT", "LE Dr REPAR", "LE Pr, CHARCUT" (virgule OCR), "LE Pr. CHARCUT."
    match = line.match(/^(LE\s+(?:Pr|Dr)[.,]?\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]+)\s*\.?\s*:\s*(.+)$/i)
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2]
      }
    }
    // Avec didascalie : "LE Pr. CHARCUT : (sortant...) texte"
    match = line.match(/^(LE\s+(?:Pr|Dr)[.,]?\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ]+)\s*\.?\s*:\s*(\([^)]+\))\s*(.+)$/i)
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2] + ' ' + match[3]
      }
    }
  }
  
  // Format nom + numéro : "Répondeur 1 : texte" (format numbered)
  if (format === 'numbered' || format === 'firstname') {
    // D'abord essayer nom + numéro
    match = line.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+\s+\d)\s*:\s*(.+)$/u)
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2]
      }
    }
    // Puis prénom simple
    match = line.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+)\s*:\s*(.+)$/u)
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2]
      }
    }
    // Avec didascalie : "Consultant (raccroche) : texte"
    match = line.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+\d)?)\s*(\([^)]+\))\s*:\s*(.+)$/u)
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2] + ' ' + match[3]
      }
    }
    // Didascalie après le : "Consultant : (s'adressant au public) texte"
    match = line.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+\d)?)\s*:\s*(\([^)]+\))\s*(.+)$/u)
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2] + ' ' + match[3]
      }
    }
  }
  
  // Format prénom simple : "Rosette : texte" ou "Consultant : texte"
  if (format === 'firstname') {
    match = line.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+\d)?)\s*:\s*(.+)$/u)
    if (match) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2]
      }
    }
    // Aussi gérer "Clémence :" (3ème personnage qui apparaît)
    match = line.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+)\s+(.+)$/u)
    if (match && knownChars.has(match[1].toUpperCase())) {
      return {
        character: normalizeCharacterName(match[1]),
        text: match[2]
      }
    }
  }
  
  // Formats génériques (pour tous les formats)
  
  // Numéroté : "1. Maurice : texte"
  match = line.match(/^(\d+)\.\s*([A-ZÀ-ÿ][A-ZÀ-ÿa-zà-ÿ\-]+)\s*:\s*(.+)$/)
  if (match) {
    return {
      character: normalizeCharacterName(match[2]),
      text: match[3]
    }
  }
  
  // Nom + numéro avec espaces multiples (format colonnes) : "Répondeur 3 :     Tapez..."
  match = line.match(/^([A-ZÀ-Ÿ][a-zà-ÿéèêë]+\s+\d)\s*:\s+(.+)$/u)
  if (match) {
    return {
      character: normalizeCharacterName(match[1]),
      text: match[2].trim()
    }
  }
  
  // Nom composé 2 mots : "La petite teigne : texte"
  match = line.match(/^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][a-zàâäéèêëïîôùûüÿœæç]+\s+[a-zàâäéèêëïîôùûüÿœæç]+(?:\s+[a-zàâäéèêëïîôùûüÿœæç]+)?)\s*:\s*(.+)$/)
  if (match) {
    return {
      character: normalizeCharacterName(match[1]),
      text: match[2]
    }
  }
  
  // Nom + numéro : "Répondeur 1 : texte" ou "Policier 3 : texte"
  match = line.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+\s+\d)\s*:\s*(.+)$/u)
  if (match) {
    return {
      character: normalizeCharacterName(match[1]),
      text: match[2]
    }
  }
  
  // Majuscules avec : "LE REPRÉSENTANT : texte"
  match = line.match(/^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s\d\-']+?)\s*:\s*(.+)$/)
  if (match) {
    const charName = match[1].trim()
    const textPart = match[2].trim()
    if (textPart.length > 15 || !/^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\-]+$/.test(textPart)) {
      return {
        character: normalizeCharacterName(charName),
        text: textPart
      }
    }
  }
  
  // Majuscules avec didascalie : "PERSONNAGE (action) texte"
  match = line.match(/^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s\-']+?)\s*(\([^)]+\))\s*(.+)$/)
  if (match) {
    return {
      character: normalizeCharacterName(match[1]),
      text: match[2] + ' ' + match[3]
    }
  }
  
  return null
}

/**
 * Parsing de secours
 */
function fallbackParsing(text) {
  const characters = new Map()
  const replicas = []
  const lines = text.split('\n')
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length < 10) continue
    
    let match
    
    // Pattern nom + numéro : "Répondeur 1 : texte"
    match = trimmed.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+\s+\d)\s*:\s*(.{5,})$/u)
    if (match) {
      const charName = normalizeCharacterName(match[1])
      if (!characters.has(charName)) {
        characters.set(charName, { name: charName })
      }
      replicas.push({ character: charName, text: match[2].trim() })
      continue
    }
    
    // Pattern prénom simple : "Consultant : texte"
    match = trimmed.match(/^([A-ZÀ-Ÿ][a-zà-ÿ]+)\s*:\s*(.{5,})$/u)
    if (match) {
      const charName = normalizeCharacterName(match[1])
      const excludeWords = ['ACTE', 'SCENE', 'SCÈNE', 'FIN', 'DÉBUT', 'RIDEAU', 'PAGE']
      if (!excludeWords.includes(charName)) {
        if (!characters.has(charName)) {
          characters.set(charName, { name: charName })
        }
        replicas.push({ character: charName, text: match[2].trim() })
        continue
      }
    }
    
    // Pattern générique majuscules
    match = trimmed.match(/^([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ][A-ZÀ-ÿa-zà-ÿ\s\-']{1,30}?)\s*:\s*([A-Za-zÀ-ÿ«(].{10,})$/)
    if (match) {
      const charName = normalizeCharacterName(match[1])
      const text = match[2].trim()
      
      const excludeWords = ['ACTE', 'SCENE', 'SCÈNE', 'FIN', 'DÉBUT', 'RIDEAU', 'PAGE']
      if (excludeWords.some(w => charName.includes(w))) continue
      
      if (!characters.has(charName)) {
        characters.set(charName, { name: charName })
      }
      replicas.push({ character: charName, text })
    }
  }
  
  if (replicas.length === 0) {
    const narrator = 'NARRATEUR'
    characters.set(narrator, { name: narrator })
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 30)
    paragraphs.forEach(p => {
      replicas.push({ character: narrator, text: cleanReplicaText(p) })
    })
  }
  
  return { characters: Array.from(characters.values()), replicas }
}

/**
 * Normalise un nom de personnage
 */
function normalizeCharacterName(name) {
  let normalized = name.trim().toUpperCase().replace(/\s+/g, ' ').replace(/[:\.\-]+$/, '').trim()
  // Normaliser les variations de ponctuation après Pr/Dr : "LE PR, CHARCUT" -> "LE PR. CHARCUT"
  normalized = normalized.replace(/^(LE\s+(?:PR|DR))[,.]?\s+/i, '$1. ')
  return normalized
}

/**
 * Nettoie le texte d'une réplique
 */
function cleanReplicaText(text) {
  return text.replace(/\s+/g, ' ').replace(/^\s*[:\.\-–—]\s*/, '').trim()
}

/**
 * Détecte le genre d'un personnage
 */
function detectGender(characterName, distribution) {
  const name = characterName.toLowerCase()
  const acteur = distribution.get(characterName)?.toLowerCase() || ''
  
  if (acteur) {
    if (PRENOMS_FEMININS.some(p => acteur.includes(p))) return 'female'
    if (PRENOMS_MASCULINS.some(p => acteur.includes(p))) return 'male'
  }
  
  if (MOTS_FEMININS.some(m => name.includes(m))) return 'female'
  if (MOTS_MASCULINS.some(m => name.includes(m))) return 'male'
  
  const words = name.split(/\s+/)
  for (const word of words) {
    if (PRENOMS_FEMININS.includes(word)) return 'female'
    if (PRENOMS_MASCULINS.includes(word)) return 'male'
  }
  
  return 'unknown'
}

/**
 * Génère le texte à trous
 */
function generateGapsText(text) {
  return text.replace(/\b(\w)(\w+)\b/g, (match, first, rest) => {
    return first + '_'.repeat(Math.min(rest.length, 5))
  })
}

/**
 * Génère les mots d'indices
 */
function generateCueWords(replicas, currentIndex) {
  if (currentIndex === 0) return ''
  const previousReplica = replicas[currentIndex - 1]
  if (!previousReplica) return ''
  
  const cleanedText = previousReplica.text.replace(/\([^)]+\)/g, '').trim()
  const words = cleanedText.split(/\s+/)
  return '...' + words.slice(-3).join(' ')
}

export { generateGapsText, generateCueWords, detectGender }
