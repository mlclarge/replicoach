import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useScriptStore } from "../store/scriptStore";
import Loader from "../components/ui/Loader";

// Prénoms pour détection du genre
const MALE_NAMES = [
  "maurice", "jean", "christophe", "pierre", "paul", "jacques", "michel",
  "philippe", "alain", "bernard", "françois", "patrick", "daniel", "nicolas",
  "marc", "david", "thomas", "louis", "antoine", "charles", "henri", "robert",
];

const FEMALE_NAMES = [
  "valérie", "fabienne", "audrey", "marie", "anne", "sophie", "christine",
  "nathalie", "isabelle", "catherine", "sylvie", "martine", "françoise",
  "claire", "julie", "céline", "amavi", "laura", "emma", "léa", "sarah",
];

function detectGender(name) {
  const lowerName = name.toLowerCase().split("-")[0].trim();
  if (MALE_NAMES.includes(lowerName)) return "male";
  if (FEMALE_NAMES.includes(lowerName)) return "female";
  if (lowerName.endsWith("e") || lowerName.endsWith("a")) return "female";
  return "male";
}

function AudioMode() {
  const { id } = useParams();
  const { currentScript, loading, fetchScript } = useScriptStore();

  const [voices, setVoices] = useState({ male: [], female: [] });
  const [characterVoices, setCharacterVoices] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rate, setRate] = useState(1);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const playingRef = useRef(false);

  useEffect(() => {
    if (!currentScript || currentScript.id !== id) {
      fetchScript(id);
    }
  }, [id, currentScript, fetchScript]);

  // Charger et trier les voix par genre
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      const frenchVoices = availableVoices.filter((v) =>
        v.lang.startsWith("fr")
      );
      const voicesToUse =
        frenchVoices.length > 0 ? frenchVoices : availableVoices;

      const maleVoices = voicesToUse.filter(
        (v) =>
          v.name.toLowerCase().includes("male") ||
          v.name.toLowerCase().includes("homme") ||
          v.name.toLowerCase().includes("paul") ||
          v.name.toLowerCase().includes("thomas") ||
          (!v.name.toLowerCase().includes("female") &&
            !v.name.toLowerCase().includes("femme") &&
            !v.name.toLowerCase().includes("julie") &&
            !v.name.toLowerCase().includes("marie"))
      );

      const femaleVoices = voicesToUse.filter(
        (v) =>
          v.name.toLowerCase().includes("female") ||
          v.name.toLowerCase().includes("femme") ||
          v.name.toLowerCase().includes("julie") ||
          v.name.toLowerCase().includes("marie") ||
          v.name.toLowerCase().includes("hortense") ||
          v.name.toLowerCase().includes("amélie")
      );

      setVoices({
        male: maleVoices.length > 0 ? maleVoices : voicesToUse,
        female: femaleVoices.length > 0 ? femaleVoices : voicesToUse,
        all: voicesToUse,
      });
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.cancel();
    };
  }, []);

  // Assigner automatiquement des voix selon le genre du personnage
  useEffect(() => {
    if (currentScript?.characters && voices.all?.length > 0) {
      const autoVoices = {};
      let maleIndex = 0;
      let femaleIndex = 0;

      currentScript.characters.forEach((char) => {
        const gender = char.gender || detectGender(char.name);

        if (gender === "female" && voices.female.length > 0) {
          autoVoices[char.id] =
            voices.female[femaleIndex % voices.female.length]?.name;
          femaleIndex++;
        } else if (voices.male.length > 0) {
          autoVoices[char.id] =
            voices.male[maleIndex % voices.male.length]?.name;
          maleIndex++;
        } else {
          autoVoices[char.id] = voices.all[0]?.name;
        }
      });

      setCharacterVoices(autoVoices);
    }
  }, [currentScript, voices]);

  // Répliques filtrées par personnage
  const filteredReplicas = useMemo(() => {
    if (!currentScript?.replicas) return [];
    if (!selectedCharacter) return currentScript.replicas;
    return currentScript.replicas.filter(r => r.character_id === selectedCharacter);
  }, [currentScript?.replicas, selectedCharacter]);

  const speak = (text, voiceName) => {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = voices.all?.find((v) => v.name === voiceName);

      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      utterance.lang = "fr-FR";

      utterance.onend = resolve;
      utterance.onerror = resolve;

      speechSynthesis.speak(utterance);
    });
  };

  const playAll = async () => {
    if (filteredReplicas.length === 0) return;

    setIsPlaying(true);
    playingRef.current = true;

    for (let i = currentIndex; i < filteredReplicas.length; i++) {
      if (!playingRef.current) break;

      setCurrentIndex(i);
      const replica = filteredReplicas[i];
      const voiceName = characterVoices[replica.character_id];

      await speak(replica.text, voiceName);
    }

    setIsPlaying(false);
    playingRef.current = false;
  };

  const stop = () => {
    speechSynthesis.cancel();
    setIsPlaying(false);
    playingRef.current = false;
  };

  const playOne = async (index) => {
    if (filteredReplicas.length === 0) return;

    stop();
    setCurrentIndex(index);
    setIsPlaying(true);
    playingRef.current = true;

    const replica = filteredReplicas[index];
    const voiceName = characterVoices[replica.character_id];

    await speak(replica.text, voiceName);
    setIsPlaying(false);
    playingRef.current = false;
  };

  const updateCharacterVoice = (charId, voiceName) => {
    setCharacterVoices((prev) => ({ ...prev, [charId]: voiceName }));
  };

  // Reset index quand on change de filtre
  useEffect(() => {
    setCurrentIndex(0);
    stop();
  }, [selectedCharacter]);

  if (loading || !currentScript) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  const { title, characters = [], replicas = [] } = currentScript;

  return (
    <div className="p-4 pb-48">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link to={`/script/${id}`} className="text-gray-400 hover:text-white">
            ←
          </Link>
          <div>
            <h1 className="text-xl font-display text-gold-500">🔊 Mode Audio</h1>
            <p className="text-gray-500 text-sm">{title}</p>
          </div>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-lg transition ${
            showSettings ? "bg-primary-700 text-white" : "bg-gray-800 text-gray-400"
          }`}
        >
          ⚙️
        </button>
      </div>

      {/* Paramètres voix (collapsible) */}
      {showSettings && (
        <div className="card mb-4">
          <h2 className="font-semibold text-white mb-3">
            🎭 Voix des personnages
          </h2>

          <div className="space-y-3">
            {characters.map((char) => {
              const gender = char.gender || detectGender(char.name);
              return (
                <div key={char.id} className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: char.color }}
                  />
                  <span className="text-gray-300 flex-1">
                    {char.name}
                    <span className="text-xs text-gray-500 ml-2">
                      {gender === "female" ? "♀" : "♂"}
                    </span>
                  </span>
                  <select
                    value={characterVoices[char.id] || ""}
                    onChange={(e) =>
                      updateCharacterVoice(char.id, e.target.value)
                    }
                    className="input !w-auto !py-1 text-sm"
                  >
                    <optgroup
                      label={
                        gender === "female" ? "Voix féminines" : "Voix masculines"
                      }
                    >
                      {(gender === "female" ? voices.female : voices.male)?.map(
                        (voice) => (
                          <option key={voice.name} value={voice.name}>
                            {voice.name.replace(/Microsoft|Google/gi, "").trim()}
                          </option>
                        )
                      )}
                    </optgroup>
                    <optgroup label="Toutes les voix">
                      {voices.all?.map((voice) => (
                        <option key={voice.name + "_all"} value={voice.name}>
                          {voice.name.replace(/Microsoft|Google/gi, "").trim()}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Vitesse</span>
              <span className="text-gold-500 font-semibold">{rate}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Filtres personnages */}
      <div className="mb-4">
        <h3 className="text-sm text-gray-400 mb-2">Filtrer par personnage :</h3>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCharacter(null)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition font-medium
              ${!selectedCharacter
                ? "bg-gold-500 text-dark"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
          >
            Tous ({replicas.length})
          </button>
          {characters.map((char) => {
            const count = replicas.filter(r => r.character_id === char.id).length;
            return (
              <button
                key={char.id}
                onClick={() => setSelectedCharacter(char.id)}
                className="px-4 py-2 rounded-full text-sm whitespace-nowrap transition font-medium"
                style={{
                  backgroundColor: selectedCharacter === char.id ? char.color : '#374151',
                  color: selectedCharacter === char.id ? 'white' : '#9CA3AF',
                }}
              >
                {char.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Compteur de répliques filtrées */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-white">📜 Répliques</h2>
        <span className="text-sm text-gray-500">
          {filteredReplicas.length} réplique{filteredReplicas.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Liste des répliques */}
      <div className="space-y-2">
        {filteredReplicas.map((replica, index) => {
          const character = characters.find(
            (c) => c.id === replica.character_id
          );
          const isCurrent = index === currentIndex && isPlaying;

          return (
            <div
              key={replica.id}
              onClick={() => playOne(index)}
              className={`card cursor-pointer transition-all ${
                isCurrent ? "ring-2 ring-gold-500 bg-gold-500/10" : ""
              }`}
              style={{
                borderLeftColor: character?.color,
                borderLeftWidth: "3px",
              }}
            >
              <div className="flex items-start gap-3">
                <span className={`text-lg ${isCurrent ? "animate-pulse" : ""}`}>
                  {isCurrent ? "🔊" : "▶️"}
                </span>
                <div className="flex-1">
                  <p
                    className="text-xs font-semibold mb-1"
                    style={{ color: character?.color }}
                  >
                    {character?.name}
                  </p>
                  <p className="text-gray-300 text-sm line-clamp-2">
                    {replica.text}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredReplicas.length === 0 && (
        <p className="text-center text-gray-500 py-8">
          Aucune réplique pour ce personnage
        </p>
      )}

      {/* Bouton STOP flottant bien visible (quand lecture en cours) */}
      {isPlaying && (
        <button
          onClick={stop}
          className="fixed top-20 right-4 z-50 w-16 h-16 bg-red-600 hover:bg-red-500 
                     rounded-full flex items-center justify-center shadow-xl
                     animate-pulse transition-transform active:scale-95"
        >
          <span className="text-3xl">⏹️</span>
        </button>
      )}

      {/* Barre de contrôle fixe en bas */}
      <div className="fixed bottom-0 left-0 right-0 bg-darker border-t border-gray-800 p-4 z-40">
        <div className="max-w-md mx-auto">
          {/* Barre de progression */}
          {filteredReplicas.length > 0 && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Réplique {currentIndex + 1} / {filteredReplicas.length}</span>
                <span>{Math.round(((currentIndex + 1) / filteredReplicas.length) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1">
                <div
                  className="bg-gold-500 h-1 rounded-full transition-all"
                  style={{ width: `${((currentIndex + 1) / filteredReplicas.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Boutons de contrôle */}
          <div className="flex gap-3">
            {isPlaying ? (
              <button 
                onClick={stop} 
                className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white rounded-full 
                           font-bold text-lg flex items-center justify-center gap-2 
                           transition-all active:scale-95 shadow-lg"
              >
                <span className="text-2xl">⏹️</span>
                ARRÊTER
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setCurrentIndex(0);
                    setTimeout(playAll, 100);
                  }}
                  className="btn-secondary flex-1 py-4"
                  disabled={filteredReplicas.length === 0}
                >
                  ⏮️ Début
                </button>
                <button 
                  onClick={playAll} 
                  className="btn-gold flex-1 py-4 text-lg font-bold"
                  disabled={filteredReplicas.length === 0}
                >
                  ▶️ Lecture
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AudioMode;
