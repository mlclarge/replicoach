import { useRef, useState } from "react";
import { TTS_VOICES, ttsSamplePath } from "../lib/ttsVoices";

/**
 * Choix de la voix Premium d'un personnage.
 * Une fois verrouillée, la voix ne peut plus être changée pour ce script.
 */
function PremiumVoicePicker({ character, lockedVoiceId, onLock }) {
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const sampleRef = useRef(null);

  const playSample = (voiceId) => {
    if (sampleRef.current) sampleRef.current.pause();
    const audio = new Audio(ttsSamplePath(voiceId));
    sampleRef.current = audio;
    audio.play().catch(() => {});
  };

  const confirmLock = async () => {
    if (!selected) return;
    const label = TTS_VOICES.find((v) => v.id === selected)?.label;
    const ok = window.confirm(
      `Verrouiller la voix « ${label} » pour ${character.name} ?\n\nCe choix est définitif pour ce script : il ne pourra plus être modifié.`
    );
    if (!ok) return;
    setSaving(true);
    setError("");
    const result = await onLock(character.id, selected);
    if (!result.ok) setError(result.message);
    setSaving(false);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: character.color }}
        />
        <span className="text-gray-700 text-sm font-semibold truncate">{character.name}</span>
        {lockedVoiceId && <span className="text-xs text-green-700">🔒 voix verrouillée</span>}
      </div>
      <div className="flex flex-wrap gap-1">
        {TTS_VOICES.map((voice) => {
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
              className={`px-2 py-1 rounded-full text-xs border transition ${
                isLocked
                  ? "bg-green-100 border-green-400 text-green-800 font-bold"
                  : disabledByLock
                    ? "bg-gray-100 border-gray-200 text-gray-400"
                    : isSelected
                      ? "bg-purple-100 border-purple-400 text-purple-800 font-bold"
                      : "bg-white border-gray-300 text-gray-700"
              }`}
              title="Écouter l'échantillon"
            >
              ▶ {voice.label} {voice.gender === "female" ? "♀" : "♂"}
            </button>
          );
        })}
      </div>
      {!lockedVoiceId && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!selected || saving}
            onClick={confirmLock}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-purple-600 text-white disabled:opacity-40"
          >
            {saving ? "…" : "Valider et verrouiller"}
          </button>
          <span className="text-xs text-gray-500">Choix définitif pour ce script.</span>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default PremiumVoicePicker;
