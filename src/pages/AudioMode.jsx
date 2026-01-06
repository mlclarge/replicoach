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

// Nettoyer le texte pour la lecture audio (enlever didascalies et caractères spéciaux)
function cleanTextForSpeech(text) {
  return text
    // Enlever les didascalies (texte entre parenthèses)
    .replace(/\([^)]*\)/g, '')
    // Enlever les crochets
    .replace(/\[[^\]]*\]/g, '')
    // Enlever les tirets du 6 et 8 isolés
    .replace(/\s*[-–—]\s*/g, ' ')
    // Enlever les caractères spéciaux
    .replace(/[*_#~`]/g, '')
    // Nettoyer les espaces multiples
    .replace(/\s+/g, ' ')
    .trim();
}

function AudioMode() {
  const { id } = useParams();
  const { currentScript, loading, fetchScript } = useScriptStore();

  const [voices, setVoices] = useState({ male: [], female: [], all: [] });
  const [characterVoices, setCharacterVoices] = useState({});
  const [characterGenders, setCharacterGenders] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rate, setRate] = useState(1);
  const [femalePitch, setFemalePitch] = useState(2.0);
  const [malePitch, setMalePitch] = useState(0.4);
  
  // Personnages masqués (mode italienne)
  const [hiddenCharacters, setHiddenCharacters] = useState(new Set());
  
  // État pour attendre le clic sur bulle masquée
  const [waitingForClick, setWaitingForClick] = useState(false);
  
  // Afficher les paramètres
  const [showSettings, setShowSettings] = useState(false);

  const playingRef = useRef(false);
  const waitingRef = useRef(false);
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
      currentScript.characters.forEach((char) => {
        autoVoices[char.id] = voices.all[0]?.name;
      });
      setCharacterVoices(autoVoices);
    }
  }, [currentScript, voices]);

  // Scroll vers réplique en cours
  useEffect(() => {
    if (currentReplicaRef.current) {
      currentReplicaRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentIndex]);

  // Fonction speak avec pitch et nettoyage didascalies
  const speak = (text, characterId) => {
    return new Promise((resolve) => {
      // Nettoyer le texte (enlever didascalies)
      const cleanedText = cleanTextForSpeech(text);
      
      if (!cleanedText) {
        resolve(); // Texte vide après nettoyage
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanedText);
      
      // Déterminer le genre
      const character = currentScript?.characters?.find(c => c.id === characterId);
      const gender = characterGenders[characterId] || character?.gender || detectGender(character?.name || '');
      
      // Sélectionner une voix
      const voiceName = characterVoices[characterId];
      const selectedVoice = voices.all?.find((v) => v.name === voiceName);
      if (selectedVoice) utterance.voice = selectedVoice;
      
      utterance.lang = "fr-FR";

      // Appliquer pitch selon genre
      if (gender === 'female') {
        utterance.pitch = femalePitch;
        utterance.rate = rate * 1.05;
      } else {
        utterance.pitch = malePitch;
        utterance.rate = rate * 0.95;
      }

      utterance.onend = resolve;
      utterance.onerror = resolve;

      speechSynthesis.speak(utterance);
    });
  };

  // Test voix
  const testVoice = (gender) => {
    const testText = gender === 'female' 
      ? "Bonjour, je suis une voix féminine."
      : "Bonjour, je suis une voix masculine.";
    
    const utterance = new SpeechSynthesisUtterance(testText);
    utterance.lang = "fr-FR";
    utterance.pitch = gender === 'female' ? femalePitch : malePitch;
    utterance.rate = rate;
    
    if (voices.all?.length > 0) {
      utterance.voice = voices.all[0];
    }
    
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  // Lecture continue avec mode italienne (attend le clic sur bulles masquées)
  const playAll = async (startIndex = currentIndex) => {
    if (!currentScript?.replicas) return;

    setIsPlaying(true);
    playingRef.current = true;
    waitingRef.current = false;

    for (let i = startIndex; i < currentScript.replicas.length; i++) {
      if (!playingRef.current) break;

      setCurrentIndex(i);
      const replica = currentScript.replicas[i];

      // Si personnage masqué = MODE ITALIENNE
      // On ATTEND que l'utilisateur clique sur la bulle
      if (hiddenCharacters.has(replica.character_id)) {
        setWaitingForClick(true);
        waitingRef.current = true;
        
        // Attendre que l'utilisateur clique (waitingRef devient false)
        while (waitingRef.current && playingRef.current) {
          await new Promise(r => setTimeout(r, 100));
        }
        
        setWaitingForClick(false);
        
        if (!playingRef.current) break;
        continue; // Passer à la réplique suivante
      }

      // Lire la réplique (non masquée)
      await speak(replica.text, replica.character_id);
    }

    setIsPlaying(false);
    playingRef.current = false;
    setWaitingForClick(false);
  };

  // STOP complet
  const stop = () => {
    speechSynthesis.cancel();
    setIsPlaying(false);
    playingRef.current = false;
    waitingRef.current = false;
    setWaitingForClick(false);
  };

  // Clic sur une bulle masquée = continuer la lecture
  const onBubbleClick = (index) => {
    const replica = currentScript?.replicas[index];
    
    if (waitingForClick && hiddenCharacters.has(replica?.character_id)) {
      // L'utilisateur clique sur sa bulle masquée = continuer
      waitingRef.current = false;
    } else if (!isPlaying) {
      // Si pas en lecture, lancer depuis cette position
      playAll(index);
    } else {
      // En lecture mais pas en attente = on peut lire cette bulle spécifique puis reprendre
      // Pour simplifier, on continue juste
    }
  };

  // Navigation
  const goToPrevious = () => {
    const newIndex = Math.max(0, currentIndex - 1);
    setCurrentIndex(newIndex);
    if (isPlaying) {
      stop();
      setTimeout(() => playAll(newIndex), 100);
    }
  };

  const goToNext = () => {
    if (!currentScript?.replicas) return;
    const newIndex = Math.min(currentScript.replicas.length - 1, currentIndex + 1);
    setCurrentIndex(newIndex);
    if (isPlaying) {
      stop();
      setTimeout(() => playAll(newIndex), 100);
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

  const toggleCharacterGender = (charId, currentGender) => {
    const newGender = currentGender === 'female' ? 'male' : 'female';
    setCharacterGenders((prev) => ({ ...prev, [charId]: newGender }));
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

  // Position des personnages (gauche/droite)
  const characterPositions = {};
  characters.forEach((char, index) => {
    characterPositions[char.id] = index % 2;
  });

  return (
    <div className="min-h-screen bg-amber-50 pb-52">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary-800 to-primary-900 p-4 shadow-lg sticky top-0 z-30">
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
          <h3 className="font-semibold text-gray-800 mb-2">🎭 Réglages voix</h3>
          <p className="text-xs text-gray-500 mb-3">
            Pitch : ♀ = aigu, ♂ = grave
          </p>
          
          <div className="space-y-3">
            {/* Vitesse */}
            <div>
              <div className="flex items-center justify-between mb-1">
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

            {/* Pitch féminin */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-600 text-sm">Voix ♀</span>
                <span className="text-pink-600 font-semibold">{femalePitch.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="2.0"
                step="0.1"
                value={femalePitch}
                onChange={(e) => setFemalePitch(parseFloat(e.target.value))}
                className="w-full accent-pink-500"
              />
            </div>

            {/* Pitch masculin */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-600 text-sm">Voix ♂</span>
                <span className="text-blue-600 font-semibold">{malePitch.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={malePitch}
                onChange={(e) => setMalePitch(parseFloat(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            {/* Test voix */}
            <div className="flex gap-2">
              <button
                onClick={() => testVoice('female')}
                className="flex-1 py-2 bg-pink-100 text-pink-700 rounded-lg text-sm font-semibold"
              >
                🔊 Test ♀
              </button>
              <button
                onClick={() => testVoice('male')}
                className="flex-1 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold"
              >
                🔊 Test ♂
              </button>
            </div>

            {/* Genre par personnage */}
            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Genre des personnages :</p>
              <div className="flex flex-wrap gap-2">
                {characters.map((char) => {
                  const gender = characterGenders[char.id] || char.gender || detectGender(char.name);
                  return (
                    <button
                      key={char.id}
                      onClick={() => toggleCharacterGender(char.id, gender)}
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        gender === 'female' 
                          ? 'bg-pink-100 text-pink-600' 
                          : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {char.name.substring(0, 8)} {gender === 'female' ? '♀' : '♂'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode italienne - Sélection des personnages à masquer */}
      <div className="p-3 bg-amber-100 border-b border-amber-200">
        <p className="text-xs text-amber-800 mb-2 font-semibold">
          🎭 Mode italienne : cliquez pour masquer vos répliques
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {characters.map((char) => {
            const isHidden = hiddenCharacters.has(char.id);
            return (
              <button
                key={char.id}
                onClick={() => toggleHideCharacter(char.id)}
                className={`flex items-center gap-1 px-3 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition shadow
                  ${isHidden 
                    ? 'bg-gray-400 text-white ring-2 ring-red-500' 
                    : 'text-white'}`}
                style={!isHidden ? { backgroundColor: char.color } : {}}
              >
                {isHidden ? '🙈' : '👁️'} {char.name}
              </button>
            );
          })}
        </div>
        {hiddenCharacters.size > 0 && (
          <p className="text-xs text-amber-700 mt-2">
            ℹ️ Vos répliques seront masquées. Cliquez dessus quand c'est votre tour !
          </p>
        )}
      </div>

      {/* Indicateur d'attente (mode italienne) */}
      {waitingForClick && (
        <div className="bg-green-500 text-white p-3 text-center animate-pulse sticky top-[120px] z-20">
          <p className="font-bold">🎭 C'est à vous !</p>
          <p className="text-sm">Cliquez sur votre bulle pour continuer</p>
        </div>
      )}

      {/* Liste des répliques */}
      <div className="p-4 space-y-3">
        {replicas.map((replica, index) => {
          const character = characters.find((c) => c.id === replica.character_id);
          const isRight = characterPositions[replica.character_id] === 1;
          const isCurrent = index === currentIndex;
          const isHidden = hiddenCharacters.has(replica.character_id);
          const isWaitingOnThis = waitingForClick && isCurrent && isHidden;

          return (
            <AudioBubble
              key={replica.id}
              ref={isCurrent ? currentReplicaRef : null}
              replica={replica}
              character={character}
              isRight={isRight}
              number={index + 1}
              isCurrent={isCurrent}
              isPlaying={isPlaying && isCurrent && !isHidden}
              isHidden={isHidden}
              isWaiting={isWaitingOnThis}
              onClick={() => onBubbleClick(index)}
            />
          );
        })}
      </div>

      {/* Panneau de contrôle FIXE en bas - TOUJOURS VISIBLE */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t-2 border-gold-500 shadow-2xl">
        {/* Info réplique */}
        <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`text-2xl ${isPlaying && !waitingForClick ? 'animate-pulse' : ''}`}>
              {waitingForClick ? '🎭' : isPlaying ? '🔊' : '⏸️'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {characters.find(c => c.id === replicas[currentIndex]?.character_id)?.name || '-'}
              </p>
              <p className="text-gray-400 text-xs truncate">
                {waitingForClick ? 'À vous de jouer !' : replicas[currentIndex]?.text?.substring(0, 40)}...
              </p>
            </div>
            <span className="text-gold-500 text-sm font-bold">
              {currentIndex + 1}/{replicas.length}
            </span>
          </div>
        </div>

        {/* Contrôles principaux */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-center gap-3">
            {/* STOP - Toujours visible */}
            <button
              onClick={stop}
              className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 
                         flex items-center justify-center text-xl text-white shadow-lg transition"
            >
              ⏹️
            </button>

            {/* Retour */}
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 
                         flex items-center justify-center text-xl text-white
                         disabled:opacity-30 transition"
            >
              ⏮️
            </button>

            {/* Play */}
            <button
              onClick={() => isPlaying ? stop() : playAll(currentIndex)}
              className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-lg transition
                ${isPlaying 
                  ? 'bg-orange-500 hover:bg-orange-400 text-white' 
                  : 'bg-gold-500 hover:bg-gold-400 text-dark'}`}
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>

            {/* Avancer */}
            <button
              onClick={goToNext}
              disabled={currentIndex === replicas.length - 1}
              className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 
                         flex items-center justify-center text-xl text-white
                         disabled:opacity-30 transition"
            >
              ⏭️
            </button>

            {/* Depuis le début */}
            <button
              onClick={() => { stop(); setCurrentIndex(0); setTimeout(() => playAll(0), 100); }}
              className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 
                         flex items-center justify-center text-xl text-white transition"
            >
              🔄
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Bulle audio style WhatsApp
 */
const AudioBubble = forwardRef(({ replica, character, isRight, number, isCurrent, isPlaying, isHidden, isWaiting, onClick }, ref) => {
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
          ${isWaiting ? 'ring-4 ring-green-500 animate-bounce' : ''}
        `}
        style={{
          backgroundColor: isHidden ? '#9ca3af' : hexToRgba(bubbleColor, 0.9),
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className={`text-sm font-bold text-white drop-shadow`}>
            {character?.name || "Inconnu"}
          </span>
          <div className="flex items-center gap-2">
            {isPlaying && <span className="text-lg">🔊</span>}
            {isWaiting && <span className="text-lg">👆</span>}
            <span className="text-xs text-white/70">#{number}</span>
          </div>
        </div>

        {/* Contenu */}
        {isHidden ? (
          <div className="py-3 text-center">
            {isWaiting ? (
              <>
                <p className="text-white text-sm font-bold">
                  🎭 C'est à vous !
                </p>
                <p className="text-white/80 text-xs mt-1">
                  Cliquez ici pour continuer
                </p>
              </>
            ) : (
              <>
                <p className="text-white/80 text-sm italic">
                  Votre réplique (masquée)
                </p>
                <p className="text-white/60 text-xs mt-1">
                  Cliquez pour révéler
                </p>
              </>
            )}
          </div>
        ) : (
          <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
            {replica.text}
          </p>
        )}
      </div>
    </div>
  );
});

AudioBubble.displayName = 'AudioBubble';

export default AudioMode;
