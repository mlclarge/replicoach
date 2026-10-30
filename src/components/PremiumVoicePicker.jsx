import { useRef, useState } from "react";
import { TTS_VOICES, ttsSamplePath, detectGender } from "../lib/ttsVoices";

/**
 * Choix de la voix Premium Google Cloud d'un personnage (10 Féminines / 5 Masculines).
 * Étape 1 : Bouton ▶ pour écouter l'échantillon HD sans sélectionner.
 * Étape 2 : Clic sur le badge de la voix pour la choisir.
 * Étape 3 : Clic sur "Valider & Verrouiller" pour enregistrer la voix pour le script.
 */
function PremiumVoicePicker({ character, lockedVoiceId, onLock }) {
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAllGenders, setShowAllGenders] = useState(false);
  const sampleRef = useRef(null);

  // Détection dynamique du genre (avec fallback intelligent detectGender)
  const charGender = character?.gender || detectGender(character?.name || "");

  // Filtrage intelligent par genre
  const filteredVoices = TTS_VOICES.filter((voice) => {
    if (showAllGenders) return true;
    return voice.gender === charGender;
  });

  const playSample = (e, voiceId) => {
    e.stopPropagation();
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
      `Verrouiller la voix « ${label} » pour ${character.name} ?\n\nCe choix activera les voix Google Cloud TTS HD pour ce personnage.`
    );
    if (!ok) return;
    setSaving(true);
    setError("");
    const result = await onLock(character.id, selected);
    if (!result.ok) setError(result.message || "Erreur lors du verrouillage");
    setSaving(false);
  };

  const selectedVoiceObj = TTS_VOICES.find((v) => v.id === (lockedVoiceId || selected));

  return (
    <div className="space-y-2.5 p-3.5 bg-white rounded-xl border border-amber-200 shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-xs"
            style={{ backgroundColor: character.color || "#D97706" }}
          />
          <span className="text-gray-900 text-xs sm:text-sm font-extrabold truncate">
            {character.name}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
            charGender === "female"
              ? "bg-pink-50 text-pink-800 border-pink-200"
              : "bg-blue-50 text-blue-800 border-blue-200"
          }`}>
            {charGender === "female" ? "♀ Rôle Féminin" : "♂ Rôle Masculin"}
          </span>
        </div>

        {lockedVoiceId ? (
          <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center gap-1 flex-shrink-0 shadow-xs">
            🔒 {selectedVoiceObj?.label || "Voix verrouillée"}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setShowAllGenders(!showAllGenders)}
            className="text-[11px] text-amber-800 hover:text-amber-950 font-semibold underline flex-shrink-0"
          >
            {showAllGenders ? "Filtrer par genre" : "Voir les 15 voix"}
          </button>
        )}
      </div>

      {/* Liste des choix de voix */}
      <div className="flex flex-wrap gap-2 pt-1">
        {filteredVoices.map((voice) => {
          const isLocked = lockedVoiceId === voice.id;
          const disabledByLock = !!lockedVoiceId && !isLocked;
          const isSelected = !lockedVoiceId && selected === voice.id;

          return (
            <div
              key={voice.id}
              onClick={() => {
                if (!lockedVoiceId) setSelected(voice.id);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                isLocked
                  ? "bg-emerald-600 text-white border-emerald-700 font-extrabold shadow-sm"
                  : disabledByLock
                    ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-50"
                    : isSelected
                      ? "bg-amber-500 text-black border-amber-600 font-extrabold shadow-md ring-2 ring-amber-300 scale-[1.02]"
                      : "bg-gray-50 hover:bg-amber-50/80 border-gray-300 text-gray-800"
              }`}
            >
              {/* Bouton pour écouter l'échantillon uniquement */}
              <button
                type="button"
                onClick={(e) => playSample(e, voice.id)}
                className="p-1 rounded-full bg-black/10 hover:bg-black/20 text-current transition active:scale-95"
                title="Écouter l'échantillon audio HD"
              >
                ▶
              </button>

              <span>{voice.label}</span>
              <span className="text-[10px] opacity-75">{voice.gender === "female" ? "♀" : "♂"}</span>
            </div>
          );
        })}
      </div>

      {!lockedVoiceId && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            disabled={!selected || saving}
            onClick={confirmLock}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40 transition shadow-md flex items-center justify-center gap-2"
          >
            <span>🔒</span>
            <span>
              {saving
                ? "Enregistrement..."
                : selectedVoiceObj
                  ? `Valider & Verrouiller « ${selectedVoiceObj.label} »`
                  : "Sélectionnez une voix ci-dessus"}
            </span>
          </button>
          <span className="text-[10px] text-gray-500 italic">
            Cliquez sur ▶ pour écouter, puis cliquez sur la voix pour la choisir
          </span>
        </div>
      )}

      {error && <p className="text-xs text-red-600 font-bold mt-1">⚠️ {error}</p>}
    </div>
  );
}

export default PremiumVoicePicker;
