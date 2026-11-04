// Typologie unique des notes personnelles (valeurs stockées en base : ne pas modifier).
export const NOTE_TYPES = [
  { value: "general", icon: "📝", label: "Note générale", shortLabel: "Note", color: "amber" },
  { value: "movement", icon: "🚶", label: "Déplacement", shortLabel: "Déplacement", color: "blue" },
  { value: "intention", icon: "💭", label: "Intention de jeu", shortLabel: "Intention", color: "purple" },
  { value: "prop", icon: "🎪", label: "Accessoire", shortLabel: "Accessoire", color: "green" },
  { value: "cue", icon: "🎯", label: "Repère / Signal", shortLabel: "Repère", color: "red" },
];

// Anciennes valeurs éventuellement présentes en base
const LEGACY_ALIASES = { accessory: "prop" };

export function getNoteType(value) {
  const key = LEGACY_ALIASES[value] || value;
  return NOTE_TYPES.find((t) => t.value === key) || NOTE_TYPES[0];
}
