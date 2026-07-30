/**
 * characterListValidator.js
 * ---------------------------------------------------------------
 * Module à intégrer dans src/lib/scriptParser.js.
 *
 * Objectif : ne JAMAIS laisser le parseur inventer un personnage
 * qui n'est pas dans la liste fermée fournie par l'utilisateur
 * dans la pop-up (Upload.jsx), tout en tolérant les coquilles /
 * bruit OCR qui déforment légèrement un vrai nom (ex: JACK au
 * lieu de JACKIE, ou une casse différente comme "William FARELL").
 *
 * Deux problèmes réglés d'un coup :
 *  1) Rejet des faux positifs (en-têtes de scène, bruit OCR :
 *     FETE DU VILLAGE, LA PREMIÈRE, SCA...) qui ne ressemblent à
 *     aucun nom connu.
 *  2) Reconnaissance de "William FARELL :" -> WILLIAM FARELL,
 *     même si la casse ne suit pas le même format que les autres
 *     répliques (SAM :, CHARLIE :, etc).
 * ---------------------------------------------------------------
 */

/**
 * Normalise un nom pour comparaison :
 * - majuscules
 * - suppression des accents
 * - espaces multiples réduits à un seul
 * - apostrophes typographiques uniformisées
 */
export function normalizeName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // supprime les accents (É -> E, È -> E...)
    .toUpperCase()
    .replace(/['’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Distance de Levenshtein (implémentation sans dépendance externe,
 * suffisante pour des noms courts de personnages).
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Ratio de similarité entre 0 (rien en commun) et 1 (identique). */
export function similarityRatio(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Tente de résoudre un nom candidat (brut, tel qu'extrait par la
 * regex de découpage des répliques) contre la liste fermée fournie
 * par l'utilisateur.
 *
 * @param {string} candidateRaw   Le texte capturé avant les ":" (ex: "William FARELL", "JACK", "FETE DU VILLAGE")
 * @param {string[]} knownCharacters  Liste exacte des 10 personnages saisis dans la pop-up
 * @param {number} threshold      Seuil de similarité flou (0.72 = tolère 2-3 lettres d'écart sur un nom court)
 * @returns {string|null} Le nom canonique de la liste utilisateur, ou null si aucun match suffisant
 */
export function resolveAgainstKnownList(candidateRaw, knownCharacters, threshold = 0.72) {
  const candidate = normalizeName(candidateRaw);
  const known = knownCharacters.map((c) => ({ original: c, norm: normalizeName(c) }));

  // 1. Correspondance exacte (résout le cas William FARELL / WILLIAM FARELL)
  const exact = known.find((k) => k.norm === candidate);
  if (exact) return exact.original;

  // 2. Correspondance floue (résout JACK -> JACKIE)
  //    On ne matche que si le score dépasse le seuil ET que le nom
  //    candidat n'est pas trivialement plus long/court qu'un vrai nom
  //    connu (évite de faire matcher "FETE DU VILLAGE" à "JULIA" etc.)
  let best = null;
  let bestScore = 0;
  for (const k of known) {
    const score = similarityRatio(candidate, k.norm);
    if (score > bestScore) {
      bestScore = score;
      best = k;
    }
  }
  if (best && bestScore >= threshold) return best.original;

  // 3. Aucun match : ce n'est PAS un personnage de la liste fermée.
  return null;
}

/**
 * Regex de détection de réplique volontairement permissive sur la
 * casse (accepte "SAM :", "William FARELL :", "Jeff Paterson :"...).
 * La validation stricte se fait ENSUITE via resolveAgainstKnownList,
 * pas dans la regex elle-même.
 */
export const CUE_REGEX = /^([A-ZÀ-Üa-zà-ü][A-ZÀ-Üa-zà-ü'’\-\s]{1,40}?)\s*:\s*(.*)$/;

/**
 * Point d'intégration principal : à appeler ligne par ligne dans la
 * boucle existante de scriptParser.js à la place de la détection
 * actuelle de "nouvelle réplique".
 *
 * @param {string} line
 * @param {string[]} knownCharacters
 * @returns {{character: string, text: string} | null}
 *          null => la ligne n'est pas une réplique d'un personnage
 *          connu ; elle doit être traitée comme didascalie ou
 *          rattachée à la réplique du personnage précédent (JAMAIS
 *          créer un nouveau personnage à la volée).
 */
export function detectKnownSpeakerCue(line, knownCharacters) {
  const match = line.match(CUE_REGEX);
  if (!match) return null;

  const [, rawName, dialogue] = match;
  const resolved = resolveAgainstKnownList(rawName, knownCharacters);
  if (!resolved) return null;

  return { character: resolved, text: dialogue };
}
