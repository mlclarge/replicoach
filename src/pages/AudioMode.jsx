import { useEffect, useState, useRef, forwardRef } from "react";
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
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rate, setRate] = useState(1);
  
  // Personnages masqués (pour le comédien)
  const [hiddenCharacters, setHiddenCharacters] = useState(new Set());
  
  // Afficher les paramètres
  const [showSettings, setShowSettings] = useState(false);

  const playingRef = useRef(false);
  const pausedRef = useRef(false);
  const currentReplicaRef = useRef(null);

  useEffect(() => {
    if (!currentScript || currentScript.id !== id) {
      fetchScript(id);
    }
  }, [id, currentScript, fetchScript]);

  // Charger les voix
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      const frenchVoices = availableVoices.filter((v) => v.lang.startsWith("fr"));
      const voicesToUse = frenchVoices.length > 0 ? frenchVoices : availableVoices;

      const maleVoices = voicesToUse.filter((v) =>
        v.name.toLowerCase().includes("male") ||
        v.name.toLowerCase().includes("homme") ||
        v.name.toLowerCase().includes("paul") ||
        v.name.toLowerCase().includes("thomas") ||
        (!v.name.toLowerCase().includes("female") &&
          !v.name.toLowerCase().includes("femme") &&
          !v.name.toLowerCase().includes("julie") &&
          !v.name.toLowerCase().includes("marie"))
      );

      const femaleVoices = voicesToUse.filter((v) =>
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

  // Assigner voix automatiquement
  useEffect(() => {
    if (currentScript?.characters && voices.all?.length > 0) {
      const autoVoices = {};
      let maleIndex = 0;
      let femaleIndex = 0;

      currentScript.characters.forEach((char) => {
        const gender = char.gender || detectGender(char.name);

        if (gender === "female" && voices.female.length > 0) {
          autoVoices[char.id] = voices.female[femaleIndex % voices.female.length]?.name;
          femaleIndex++;
        } else if (voices.male.length > 0) {
          autoVoices[char.id] = voices.male[maleIndex % voices.male.length]?.name;
          maleIndex++;
        } else {
          autoVoices[char.id] = voices.all[0]?.name;
        }
      });

      setCharacterVoices(autoVoices);
    }
  }, [currentScript, voices]);

  // Scroll vers réplique en cours
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

  // Lecture continue
  const playAll = async (startIndex = currentIndex) => {
    if (!currentScript?.replicas) return;

    setIsPlaying(true);
    setIsPaused(false);
    playingRef.current = true;
    pausedRef.current = false;

    for (let i = startIndex; i < currentScript.replicas.length; i++) {
      if (!playingRef.current) break;
      
      // Attendre si en pause
      while (pausedRef.current) {
        await new Promise(r => setTimeout(r, 100));
        if (!playingRef.current) break;
      }
      
      if (!playingRef.current) break;

      setCurrentIndex(i);
      const replica = currentScript.replicas[i];
      const voiceName = characterVoices[replica.character_id];

      // Si personnage masqué, ne pas lire (mais marquer une pause)
      if (hiddenCharacters.has(replica.character_id)) {
        // Pause pour laisser le comédien dire sa réplique
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      await speak(replica.text, voiceName);
    }

    setIsPlaying(false);
    playingRef.current = false;
  };

  const stop = () => {
    speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    playingRef.current = false;
    pausedRef.current = false;
  };

  const pause = () => {
    speechSynthesis.pause();
    setIsPaused(true);
    pausedRef.current = true;
  };

  const resume = () => {
    speechSynthesis.resume();
    setIsPaused(false);
    pausedRef.current = false;
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

  const goToPrevious = () => {
    const newIndex = Math.max(0, currentIndex - 1);
    if (isPlaying) {
      stop();
      setCurrentIndex(newIndex);
      playAll(newIndex);
    } else {
      setCurrentIndex(newIndex);
    }
  };

  const goToNext = () => {
    if (!currentScript?.replicas) return;
    const newIndex = Math.min(currentScript.replicas.length - 1, currentIndex + 1);
    if (isPlaying) {
      stop();
      setCurrentIndex(newIndex);
      playAll(newIndex);
    } else {
      setCurrentIndex(newIndex);
    }
  };

  const toggleHideCharacter = (charId) => {
    setHiddenCharacters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(charId)) {
        newSet.delete(charId);
      } else {
        newSet.add(charId);
      }
      return newSet;
    });
  };

  const updateCharacterVoice = (charId, voiceName) => {
    setCharacterVoices((prev) => ({ ...prev, [charId]: voiceName }));
  };

  if (loading || !currentScript) {
    return (
      <div className="flex justify-center py-12 bg-amber-50 min-h-screen">
        <Loader />
      </div>
    );
  }

  const { title, characters = [], replicas = [] } = currentScript;
  const progress = replicas.length > 0 ? ((currentIndex + 1) / replicas.length) * 100 : 0;

  // Déterminer position des personnages (gauche/droite)
  const characterPositions = {};
  characters.forEach((char, index) => {
    characterPositions[char.id] = index % 2;
  });

  return (
    <div className="min-h-screen bg-amber-50 pb-48">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary-800 to-primary-900 p-4 border-b-2 border-primary-600 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/script/${id}`} className="text-white hover:text-gold-400 text-xl">
              ←
            </Link>
            <div>
              <h1 className="text-lg font-display text-gold-400">🔊 Mode Audio</h1>
              <p className="text-gray-300 text-xs">{title}</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition ${
              showSettings ? 'bg-gold-500 text-dark' : 'bg-white/20 text-white'
            }`}
          >
            ⚙️
          </button>
        </div>

        {/* Barre de progression */}
        <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gold-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-gray-400 text-xs mt-1 text-center">
          Réplique {currentIndex + 1} / {replicas.length}
        </p>
      </div>

      {/* Paramètres (collapsible) */}
      {showSettings && (
        <div className="bg-white border-b border-gray-200 p-4 shadow-md">
          <h3 className="font-semibold text-gray-800 mb-3">🎭 Voix des personnages</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {characters.map((char) => {
              const gender = char.gender || detectGender(char.name);
              return (
                <div key={char.id} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: char.color }}
                  />
                  <span className="text-gray-700 text-sm flex-1 truncate">{char.name}</span>
                  <select
                    value={characterVoices[char.id] || ""}
                    onChange={(e) => updateCharacterVoice(char.id, e.target.value)}
                    className="bg-white border border-gray-300 text-gray-700 rounded px-2 py-1 text-xs max-w-[120px]"
                  >
                    {voices.all?.map((voice) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name.replace(/Microsoft|Google/gi, "").trim().substring(0, 15)}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          
          <div className="mt-3 pt-3 border-t border-gray-200">
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
      )}

      {/* Filtres personnages - avec bouton masquer */}
      <div className="p-4 bg-amber-50 sticky top-0 z-20 border-b border-amber-200">
        <p className="text-xs text-gray-500 mb-2">
          👆 Cliquez pour masquer les répliques (mode italienne)
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {characters.map((char) => {
            const isHidden = hiddenCharacters.has(char.id);
            return (
              <button
                key={char.id}
                onClick={() => toggleHideCharacter(char.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition
                  ${isHidden 
                    ? 'bg-gray-300 text-gray-500 line-through opacity-60' 
                    : 'text-white shadow-md'}`}
                style={!isHidden ? { backgroundColor: char.color } : {}}
              >
                {isHidden ? '👁️‍🗨️' : '👁️'} {char.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Liste des répliques - Style WhatsApp */}
      <div className="p-4 space-y-3">
        {replicas.map((replica, index) => {
          const character = characters.find((c) => c.id === replica.character_id);
          const isRight = characterPositions[replica.character_id] === 1;
          const isCurrent = index === currentIndex;
          const isCurrentPlaying = isCurrent && isPlaying;
          const isHidden = hiddenCharacters.has(replica.character_id);

          return (
            <AudioBubble
              key={replica.id}
              ref={isCurrentPlaying ? currentReplicaRef : null}
              replica={replica}
              character={character}
              isRight={isRight}
              number={index + 1}
              isCurrent={isCurrent}
              isPlaying={isCurrentPlaying}
              isHidden={isHidden}
              onClick={() => playOne(index)}
            />
          );
        })}
      </div>

      {/* Panneau de contrôle audio - FIXÉ EN BAS */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-gray-900 to-gray-800 border-t border-gray-700 shadow-2xl safe-area-bottom">
        {/* Info réplique en cours */}
        <div className="px-4 py-2 border-b border-gray-700">
          <div className="flex items-center gap-3">
            {isPlaying && (
              <span className="text-2xl animate-pulse">🔊</span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {characters.find(c => c.id === replicas[currentIndex]?.character_id)?.name || 'En attente'}
              </p>
              <p className="text-gray-400 text-xs truncate">
                {replicas[currentIndex]?.text?.substring(0, 50)}...
              </p>
            </div>
            <span className="text-gray-500 text-xs">
              {currentIndex + 1}/{replicas.length}
            </span>
          </div>
        </div>

        {/* Contrôles */}
        <div className="px-4 py-4 pb-6">
          <div className="flex items-center justify-center gap-4">
            {/* Retour */}
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className="w-14 h-14 rounded-full bg-gray-700 hover:bg-gray-600 
                         flex items-center justify-center text-2xl text-white
                         disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              ⏮️
            </button>

            {/* Play/Pause */}
            {isPlaying ? (
              isPaused ? (
                <button
                  onClick={resume}
                  className="w-20 h-20 rounded-full bg-gold-500 hover:bg-gold-400 
                             flex items-center justify-center text-4xl text-dark shadow-lg transition"
                >
                  ▶️
                </button>
              ) : (
                <button
                  onClick={pause}
                  className="w-20 h-20 rounded-full bg-gold-500 hover:bg-gold-400 
                             flex items-center justify-center text-4xl text-dark shadow-lg transition"
                >
                  ⏸️
                </button>
              )
            ) : (
              <button
                onClick={() => playAll(currentIndex)}
                className="w-20 h-20 rounded-full bg-gold-500 hover:bg-gold-400 
                           flex items-center justify-center text-4xl text-dark shadow-lg transition"
              >
                ▶️
              </button>
            )}

            {/* Avancer */}
            <button
              onClick={goToNext}
              disabled={currentIndex === replicas.length - 1}
              className="w-14 h-14 rounded-full bg-gray-700 hover:bg-gray-600 
                         flex items-center justify-center text-2xl text-white
                         disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              ⏭️
            </button>
          </div>

          {/* Bouton Stop */}
          {isPlaying && (
            <button
              onClick={stop}
              className="mt-3 w-full py-2 bg-red-600 hover:bg-red-500 text-white 
                         rounded-full font-semibold transition flex items-center justify-center gap-2"
            >
              ⏹️ Arrêter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Bulle audio style WhatsApp
 */
const AudioBubble = forwardRef(({ replica, character, isRight, number, isCurrent, isPlaying, isHidden, onClick }, ref) => {
  const bubbleColor = character?.color || '#6B7280';
  
  const hexToRgba = (hex, alpha) => {
    if (!hex) return `rgba(107, 114, 128, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <div 
      ref={ref}
      className={`flex ${isRight ? 'justify-end' : 'justify-start'} mb-2`}
    >
      <div
        onClick={onClick}
        className={`
          max-w-[85%] px-4 py-3 rounded-2xl cursor-pointer
          transition-all duration-200 shadow-md
          ${isRight ? 'rounded-br-md' : 'rounded-bl-md'}
          ${isCurrent ? 'ring-2 ring-gold-500 scale-[1.02]' : ''}
          ${isPlaying ? 'animate-pulse' : ''}
        `}
        style={{
          backgroundColor: isHidden ? '#d1d5db' : hexToRgba(bubbleColor, 0.9),
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className={`text-sm font-bold ${isHidden ? 'text-gray-500' : 'text-white'} drop-shadow`}>
            {character?.name || "Inconnu"}
          </span>
          <div className="flex items-center gap-2">
            {isPlaying && <span className="text-lg">🔊</span>}
            <span className={`text-xs ${isHidden ? 'text-gray-400' : 'text-white/70'}`}>#{number}</span>
          </div>
        </div>

        {/* Contenu - masqué ou visible */}
        {isHidden ? (
          <div className="py-4 text-center">
            <p className="text-gray-500 text-sm italic">
              🎭 Votre réplique - À vous de jouer !
            </p>
            <p className="text-gray-400 text-xs mt-1">
              (Cliquez pour écouter)
            </p>
          </div>
        ) : (
          <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
            {replica.text}
          </p>
        )}

        {/* Indicateur cliquable */}
        <div className={`flex justify-end mt-1 ${isHidden ? 'text-gray-400' : 'text-white/60'}`}>
          <span className="text-xs">
            {isPlaying ? '🔊 En cours...' : '▶️ Écouter'}
          </span>
        </div>
      </div>
    </div>
  );
});

AudioBubble.displayName = 'AudioBubble';

export default AudioMode;
