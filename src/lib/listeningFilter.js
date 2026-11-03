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

// Durée saisie par le comédien (en secondes) : nombre >= 0, sinon null
export function parseWindowSeconds(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Retourne l'ensemble des index de répliques à écouter.
 * - replicas : répliques de la portée courante (pièce entière ou scène)
 * - mineIds : ids des personnages du comédien (Set)
 * - mode : all | mineOnly | aroundMine
 * - windowSec : durée avant / après la réplique du rôle
 * - durationOf : (replica) => durée estimée en secondes
 * Les répliques du rôle sont toujours conservées.
 */
export function computeListenIndices({ replicas, mineIds, mode, windowSec, durationOf }) {
  const all = new Set(replicas.map((_, i) => i));
  if (mode === LISTEN_MODES.all || !mineIds || mineIds.size === 0) return all;

  const isMine = (r) => mineIds.has(r.character_id);
  const hasMine = replicas.some(isMine);
  if (!hasMine) return all;

  if (mode === LISTEN_MODES.mineOnly) {
    return new Set(replicas.map((r, i) => (isMine(r) ? i : -1)).filter((i) => i >= 0));
  }

  const win = windowSec ?? 0;
  const result = new Set();
  const n = replicas.length;

  // Distance (en secondes) avant la prochaine réplique du rôle
  const before = new Array(n).fill(Infinity);
  let acc = Infinity;
  for (let i = n - 1; i >= 0; i--) {
    if (isMine(replicas[i])) {
      acc = 0;
      before[i] = 0;
    } else if (acc !== Infinity) {
      acc += durationOf(replicas[i]);
      before[i] = acc;
    }
  }

  // Distance (en secondes) depuis la précédente réplique du rôle
  acc = Infinity;
  for (let i = 0; i < n; i++) {
    if (isMine(replicas[i])) {
      acc = 0;
      result.add(i);
    } else if (acc !== Infinity) {
      acc += durationOf(replicas[i]);
      if (acc <= win || before[i] <= win) result.add(i);
    } else if (before[i] <= win) {
      result.add(i);
    }
  }
  return result;
}
