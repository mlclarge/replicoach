import { useEffect, useState, useRef } from "react";
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

  const playingRef = useRef(false);
  const currentReplicaRef = useRef(null);

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

  // Scroll automatique vers la réplique en cours
  useEffect(() => {
    if (isPlaying && currentReplicaRef.current) {
      currentReplicaRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentIndex, isPlaying]);

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
    if (!currentScript?.replicas) return;

    setIsPlaying(true);
    playingRef.current = true;

    for (let i = currentIndex; i < currentScript.replicas.length; i++) {
      if (!playingRef.current) break;

      setCurrentIndex(i);
      const replica = currentScript.replicas[i];
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
    if (!currentScript?.replicas) return;

    stop();
    setCurrentIndex(index);
    setIsPlaying(true);
    playingRef.current = true;

    const replica = currentScript.replicas[index];
    const voiceName = characterVoices[replica.character_id];

    await speak(replica.text, voiceName);
    setIsPlaying(false);
    playingRef.current = false;
  };

  const updateCharacterVoice = (charId, voiceName) => {
    setCharacterVoices((prev) => ({ ...prev, [charId]: voiceName }));
  };

  if (loading || !currentScript) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  const { title, characters = [], replicas = [] } = currentScript;
  const progress = replicas.length > 0 ? ((currentIndex + 1) / replicas.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-amber-50 p-4 pb-40">
      {/* BOUTON STOP FLOTTANT - Toujours visible pendant la lecture */}
      {isPlaying && (
        <div className="fixed top-0 left-0 right-0 z-50 animate-slideDown">
          {/* Barre de progression */}
          <div className="h-1 bg-gray-800">
            <div 
              className="h-full bg-gold-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          {/* Bandeau Stop */}
          <div className="bg-red-600 shadow-lg">
            <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl animate-pulse">🔊</span>
                <div>
                  <p className="text-white font-semibold text-sm">
                    Lecture en cours...
                  </p>
                  <p className="text-red-200 text-xs">
                    Réplique {currentIndex + 1} / {replicas.length}
                  </p>
                </div>
              </div>
              
              <button
                onClick={stop}
                className="flex items-center gap-2 bg-white text-red-600 px-4 py-2 rounded-full font-bold shadow-lg hover:bg-red-100 transition active:scale-95"
              >
                <span className="text-xl">⏹</span>
                STOP
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <Link to={`/script/${id}`} className="text-primary-700 hover:text-primary-900">
          ←
        </Link>
        <div>
          <h1 className="text-xl font-display text-primary-800">🔊 Mode Audio</h1>
          <p className="text-gray-600 text-sm">{title}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 mb-6 border border-gray-200">
        <h2 className="font-semibold text-gray-800 mb-3">
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
                <span className="text-gray-700 flex-1">
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
                  className="bg-white border border-gray-300 text-gray-700 rounded-lg px-2 py-1 text-sm"
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

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Vitesse</span>
            <span className="text-primary-700 font-semibold">{rate}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="w-full accent-primary-600"
          />
        </div>
      </div>

      <h2 className="font-semibold text-gray-800 mb-3">📜 Répliques</h2>

      <div className="space-y-2">
        {replicas.map((replica, index) => {
          const character = characters.find(
            (c) => c.id === replica.character_id
          );
          const isCurrent = index === currentIndex;
          const isCurrentPlaying = isCurrent && isPlaying;

          return (
            <div
              key={replica.id}
              ref={isCurrentPlaying ? currentReplicaRef : null}
              onClick={() => playOne(index)}
              className={`rounded-xl p-4 cursor-pointer transition-all shadow-md ${
                isCurrentPlaying 
                  ? "ring-2 ring-gold-500 scale-[1.02]" 
                  : isCurrent 
                    ? "ring-1 ring-gold-500/50"
                    : ""
              }`}
              style={{
                backgroundColor: character?.color ? `${character.color}dd` : '#6b7280',
              }}
            >
              <div className="flex items-start gap-3">
                <span className={`text-lg ${isCurrentPlaying ? "animate-pulse" : ""}`}>
                  {isCurrentPlaying ? "🔊" : "▶️"}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-semibold text-white drop-shadow">
                      {character?.name}
                    </p>
                    <span className="text-xs text-white/70">#{index + 1}</span>
                  </div>
                  <p className="text-white text-sm line-clamp-2">
                    {replica.text}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Barre de contrôle en bas */}
      <div className="fixed bottom-24 left-0 right-0 p-4 bg-gradient-to-t from-amber-50 via-amber-50 to-transparent">
        <div className="flex gap-3 max-w-md mx-auto">
          {isPlaying ? (
            <button 
              onClick={stop} 
              className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-full font-semibold flex-1 transition flex items-center justify-center gap-2 shadow-lg"
            >
              <span className="text-xl">⏹</span> Arrêter
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setCurrentIndex(0);
                  playAll();
                }}
                className="bg-white border-2 border-primary-600 text-primary-700 px-6 py-3 rounded-full font-semibold flex-1 transition hover:bg-primary-50"
              >
                ⏮️ Début
              </button>
              <button onClick={playAll} className="btn-gold flex-1">
                ▶️ Lecture
              </button>
            </>
          )}
        </div>
      </div>

      {/* Style pour l'animation */}
      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default AudioMode;
