// Filtrage de l'écoute selon le rôle du comédien.
// Fonctions pures : indépendantes de React pour rester testables.

export const SPEED_OPTIONS = [
  { value: 0.8, label: "Lent" },
  { value: 1, label: "Normal" },
  { value: 1.25, label: "Rapide" },
];

export const LISTEN_MODES = {
  all: "all", // tout écouter
  mineOnly: "mineOnly", // uniquement les répliques de mon rôle
  aroundMine: "aroundMine", // mon rôle + N secondes avant / après
};

export const MAX_AROUND = 3;

export function clampCount(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(MAX_AROUND, Math.max(0, n));
}

/**
 * Retourne l'ensemble des index de répliques à écouter.
 * - replicas : répliques de la portée courante (pièce entière ou scène)
 * - mineIds : ids des personnages du comédien (Set)
 * - mode : all | mineOnly | aroundMine
 * - before / after : nombre de répliques gardées avant / après chacune des miennes
 * Les répliques du rôle sont toujours conservées.
 */
export function computeListenIndices({ replicas, mineIds, mode, before = 1, after = 1 }) {
  const all = new Set(replicas.map((_, i) => i));
  if (mode === LISTEN_MODES.all || !mineIds || mineIds.size === 0) return all;

  const mine = [];
  replicas.forEach((r, i) => {
    if (mineIds.has(r.character_id)) mine.push(i);
  });
  if (mine.length === 0) return all;

  const b = mode === LISTEN_MODES.aroundMine ? clampCount(before) : 0;
  const a = mode === LISTEN_MODES.aroundMine ? clampCount(after) : 0;

  const result = new Set();
  for (const i of mine) {
    const from = Math.max(0, i - b);
    const to = Math.min(replicas.length - 1, i + a);
    for (let k = from; k <= to; k++) result.add(k);
  }
  return result;
}

/**
 * ⚡ OPTIMISATION : Teste si une réplique doit être affichée visuellement à l'écran.
 * - index : index de la réplique
 * - listenIndices : Set des index à écouter
 * - hideUnlistened : boolean (true si l'option de masquage visuel est activée)
 */
export function isReplicaVisible({ index, listenIndices, hideUnlistened }) {
  if (!hideUnlistened || !listenIndices) return true;
  return listenIndices.has(index);
}
