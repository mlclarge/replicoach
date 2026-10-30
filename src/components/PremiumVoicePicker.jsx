import { useRef, useState } from "react";
import { TTS_VOICES, ttsSamplePath } from "../lib/ttsVoices";

/**
 * Choix de la voix Premium Google Cloud d'un personnage (10 Féminines / 5 Masculines).
 * Permet au metteur en scène (ou créateur Premium) de sélectionner et verrouiller
 * la voix HD unique de chaque personnage pour tout le script.
 */
function PremiumVoicePicker({ character, lockedVoiceId, onLock }) {
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAllGenders, setShowAllGenders] = useState(false);
  const sampleRef = useRef(null);

  // Détection du genre du personnage
  const charGender = character?.gender || "female";

  // Filtrage intelligent : Voix correspondant au genre par défaut (10F ou 5M), ou toutes si activé
  const filteredVoices = TTS_VOICES.filter((voice) => {
    if (showAllGenders) return true;
    return voice.gender === charGender;
  });

  const playSample = (voiceId) => {
    if (sampleRef.current) sampleRef.current.pause();
    const audio = new Audio(ttsSamplePath(voiceId));
    sampleRef.current = audio;
    audio.play().catch(() => {});
  };

  const confirmLock = async () => {
    if (!selected) return;
    const voiceObj = TTS_VOICES.find((v) => v.id === selected);
    const label = voiceObj?.label || selected;
    const ok = window.confirm(
      
    );
    if (!ok) return;
    setSaving(true);
    setError("");
    const result = await onLock(character.id, selected);
    if (!result.ok) setError(result.message || "Erreur lors du verrouillage");
    setSaving(false);
  };

  return (
    <div className="space-y-2 p-3 bg-white/90 rounded-xl border border-amber-200 shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-xs"
            style={{ backgroundColor: character.color || "#D97706" }}
          />
          <span className="text-gray-900 text-xs sm:text-sm font-extrabold truncate">
            {character.name}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
            {charGender === "female" ? "♀ Rôle Féminin" : "♂ Rôle Masculin"}
          </span>
        </div>

        {lockedVoiceId ? (
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center gap-1 flex-shrink-0">
            🔒 Voix verrouillée
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setShowAllGenders(!showAllGenders)}
            className="text-[10px] text-gray-500 hover:text-amber-800 font-semibold underline flex-shrink-0"
          >
            {showAllGenders ? "Filtrer par genre" : "Voir toutes les 15 voix"}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        {filteredVoices.map((voice) => {
          const isLocked = lockedVoiceId === voice.id;
          const disabledByLock = !!lockedVoiceId && !isLocked;
          const isSelected = !lockedVoiceId && selected === voice.id;

          return (
            <button
              key={voice.id}
              type="button"
              onClick={() => {
                playSample(voice.id);
                if (!lockedVoiceId) setSelected(voice.id);
              }}
              className={}
              title="Écouter l'échantillon audio HD"
            >
              <span className="text-[10px]">▶</span>
              <span>{voice.label}</span>
              <span className="text-[10px] opacity-75">{voice.gender === "female" ? "♀" : "♂"}</span>
            </button>
          );
        })}
      </div>

      {!lockedVoiceId && (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
          <button
            type="button"
            disabled={!selected || saving}
            onClick={confirmLock}
            className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40 transition shadow-md flex items-center gap-1.5"
          >
            <span>🔒</span>
            <span>{saving ? "Enregistrement..." : "Valider & Verrouiller la voix"}</span>
          </button>
          <span className="text-[10px] text-gray-500 italic">
            Verrouillage définitif pour cette pièce
          </span>
        </div>
      )}

      {error && <p className="text-xs text-red-600 font-bold mt-1">⚠️ {error}</p>}
    </div>
  );
}

export default PremiumVoicePicker;
