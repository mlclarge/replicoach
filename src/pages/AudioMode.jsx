import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useScriptStore } from "../store/scriptStore";
import Loader from "../components/ui/Loader";

/**
 * Mode Audio - Version améliorée pour Android/iOS
 * - Meilleure détection des voix
 * - UI/UX claire
 * - Bouton retour visible
 */

function AudioMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentScript, loading, fetchScript } = useScriptStore();

  const [voices, setVoices] = useState([]);
  const [frenchVoices, setFrenchVoices] = useState([]);
  const [characterVoices, setCharacterVoices] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rate, setRate] = useState(1);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [testingVoice, setTestingVoice] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);

  const playingRef = useRef(false);
  const utteranceRef = useRef(null);

  useEffect(() => {
    if (!currentScript || currentScript.id !== id) {
      fetchScript(id);
    }
  }, [id, currentScript, fetchScript]);

  // Charger les voix - Compatible Android/iOS/Desktop
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      
      if (availableVoices.length === 0) return;
      
      setVoices(availableVoices);
      
      // Filtrer les voix françaises
      const frVoices = availableVoices.filter(v => 
        v.lang.includes('fr-FR') || 
        v.lang.includes('fr_FR') || 
        v.lang.includes('fr-CA') ||
        v.lang === 'fr'
      );
      
      // Si pas de voix FR, prendre toutes les voix
      const voicesToUse = frVoices.length > 0 ? frVoices : availableVoices;
      
      console.log("Voix françaises trouvées:", voicesToUse.map(v => ({
        name: v.name,
        lang: v.lang,
        local: v.localService
      })));
      
      setFrenchVoices(voicesToUse);
    };

    // Charger immédiatement
    loadVoices();
    
    // Et aussi quand les voix changent (nécessaire pour Chrome/Android)
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Assigner automatiquement des voix aux personnages
  useEffect(() => {
    if (currentScript?.characters && frenchVoices.length > 0) {
      const autoVoices = {};
      
      currentScript.characters.forEach((char, index) => {
        // Distribuer les voix disponibles entre les personnages
        const voiceIndex = index % frenchVoices.length;
        autoVoices[char.id] = frenchVoices[voiceIndex]?.name || frenchVoices[0]?.name;
      });

      setCharacterVoices(autoVoices);
    }
  }, [currentScript, frenchVoices]);

  // Nettoyer le texte pour la synthèse vocale
  const cleanTextForSpeech = (text) => {
    return text
      // Supprimer les didascalies entre parenthèses
      .replace(/\([^)]*\)/g, '')
      // Supprimer les caractères spéciaux problématiques
      .replace(/[—–\-]{2,}/g, ' ')
      .replace(/[\/\\|_]/g, ' ')
      .replace(/[«»""„]/g, '')
      .replace(/\.{3,}/g, '...')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const speak = (text, voiceName) => {
    return new Promise((resolve) => {
      // Annuler toute synthèse en cours
      window.speechSynthesis.cancel();
      
      const cleanedText = cleanTextForSpeech(text);
      if (!cleanedText) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utteranceRef.current = utterance;
      
      // Trouver la voix
      const voice = voices.find((v) => v.name === voiceName);
      if (voice) utterance.voice = voice;
      
      utterance.rate = rate;
      utterance.lang = "fr-FR";
      utterance.pitch = 1;

      utterance.onend = () => resolve();
      utterance.onerror = (e) => {
        console.error("Erreur synthèse:", e);
        resolve();
      };

      // Workaround pour Android - pause/resume
      window.speechSynthesis.speak(utterance);
      
      // Fix pour Chrome Android qui s'arrête après 15s
      const resumeInterval = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          clearInterval(resumeInterval);
        } else {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 10000);

      utterance.onend = () => {
        clearInterval(resumeInterval);
        resolve();
      };
    });
  };

  const testVoice = async (voiceName) => {
    setTestingVoice(voiceName);
    await speak("Bonjour, ceci est un test de voix.", voiceName);
    setTestingVoice(null);
  };

  const playAll = async () => {
    if (!currentScript?.replicas) return;

    const replicasToPlay = selectedCharacter
      ? currentScript.replicas.filter(r => r.character_id === selectedCharacter)
      : currentScript.replicas;

    if (replicasToPlay.length === 0) return;

    setIsPlaying(true);
    playingRef.current = true;

    for (let i = currentIndex; i < replicasToPlay.length; i++) {
      if (!playingRef.current) break;

      setCurrentIndex(i);
      const replica = replicasToPlay[i];
      const voiceName = characterVoices[replica.character_id];

      await speak(replica.text, voiceName);
    }

    setIsPlaying(false);
    playingRef.current = false;
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    playingRef.current = false;
  };

  const playOne = async (index) => {
    if (!currentScript?.replicas) return;

    stop();
    setCurrentIndex(index);
    setIsPlaying(true);
    playingRef.current = true;

    const replicasToPlay = selectedCharacter
      ? currentScript.replicas.filter(r => r.character_id === selectedCharacter)
      : currentScript.replicas;

    const replica = replicasToPlay[index];
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

  const filteredReplicas = selectedCharacter
    ? replicas.filter((r) => r.character_id === selectedCharacter)
    : replicas;

  // Compter les répliques par personnage
  const replicaCountByChar = {};
  replicas.forEach(r => {
    replicaCountByChar[r.character_id] = (replicaCountByChar[r.character_id] || 0) + 1;
  });

  return (
    <div className="min-h-screen bg-darker">
      {/* Header fixe avec bouton retour VISIBLE */}
      <div className="sticky top-0 z-40 bg-gradient-to-b from-darker via-darker to-transparent pb-4">
        <div className="bg-primary-800 p-4">
          <div className="flex items-center gap-3">
            {/* Bouton retour bien visible */}
            <button
              onClick={() => navigate(`/script/${id}`)}
              className="flex items-center justify-center w-10 h-10 bg-white/20 hover:bg-white/30 
                         rounded-full transition text-white font-bold text-lg"
            >
              ←
            </button>
            
            <div className="flex-1">
              <h1 className="text-lg font-display text-white flex items-center gap-2">
                🔊 Mode Audio
              </h1>
              <p className="text-primary-200 text-sm truncate">{title}</p>
            </div>

            {/* Bouton paramètres voix - Icône améliorée */}
            <button
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              className={`flex items-center justify-center w-10 h-10 rounded-full transition
                ${showVoiceSettings 
                  ? 'bg-gold-500 text-dark' 
                  : 'bg-white/20 hover:bg-white/30 text-white'
                }`}
              title="Paramètres des voix"
            >
              🎙️
            </button>
          </div>
        </div>

        {/* Panneau paramètres voix */}
        {showVoiceSettings && (
          <div className="mx-4 mt-2 p-4 bg-gray-800 rounded-xl border border-gray-700 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white flex items-center gap-2">
                🎙️ Voix des personnages
              </h2>
              <span className="text-xs text-gray-500">
                {frenchVoices.length} voix disponibles
              </span>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {characters.map((char) => (
                <div key={char.id} className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: char.color }}
                  />
                  <span className="text-gray-300 text-sm flex-1 truncate">
                    {char.name}
                  </span>
                  
                  <select
                    value={characterVoices[char.id] || ""}
                    onChange={(e) => updateCharacterVoice(char.id, e.target.value)}
                    className="input !w-auto !py-1 text-xs max-w-[140px]"
                  >
                    {frenchVoices.map((voice) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name.replace(/Microsoft|Google|Speech|Synthesis/gi, "").trim().substring(0, 20)}
                      </option>
                    ))}
                  </select>

                  {/* Bouton test voix */}
                  <button
                    onClick={() => testVoice(characterVoices[char.id])}
                    disabled={testingVoice !== null}
                    className={`p-1.5 rounded-lg text-xs transition ${
                      testingVoice === characterVoices[char.id]
                        ? 'bg-gold-500 text-dark'
                        : 'bg-gray-700 text-gray-400 hover:text-white'
                    }`}
                    title="Tester cette voix"
                  >
                    {testingVoice === characterVoices[char.id] ? '🔊' : '▶️'}
                  </button>
                </div>
              ))}
            </div>

            {/* Vitesse */}
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
                className="w-full accent-gold-500"
              />
            </div>

            {/* Info Android */}
            <p className="text-gray-500 text-xs mt-3">
              💡 Sur Android, testez chaque voix avec ▶️ pour trouver celle qui vous convient
            </p>
          </div>
        )}
      </div>

      {/* Filtres personnages */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => {
              setSelectedCharacter(null);
              setCurrentIndex(0);
            }}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition flex items-center gap-1
              ${!selectedCharacter
                ? "bg-gold-500 text-dark font-semibold"
                : "bg-gray-800 text-gray-400"
              }`}
          >
            Tous
            <span className="text-xs opacity-70">({replicas.length})</span>
          </button>
          
          {characters.map((char) => (
            <button
              key={char.id}
              onClick={() => {
                setSelectedCharacter(char.id);
                setCurrentIndex(0);
              }}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition flex items-center gap-1
                ${selectedCharacter === char.id
                  ? "font-semibold"
                  : "bg-gray-800 text-gray-400"
                }`}
              style={
                selectedCharacter === char.id
                  ? { backgroundColor: char.color, color: "white" }
                  : {}
              }
            >
              {char.name}
              <span className="text-xs opacity-70">({replicaCountByChar[char.id] || 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Liste des répliques */}
      <div className="px-4 pb-40 space-y-2">
        {filteredReplicas.map((replica, index) => {
          const character = characters.find((c) => c.id === replica.character_id);
          const isCurrent = index === currentIndex && isPlaying;

          return (
            <div
              key={replica.id}
              onClick={() => playOne(index)}
              className={`p-3 rounded-xl cursor-pointer transition-all ${
                isCurrent 
                  ? "ring-2 ring-gold-500 bg-gold-500/10" 
                  : "bg-gray-800/50 hover:bg-gray-800"
              }`}
              style={{
                borderLeft: `4px solid ${character?.color || '#666'}`,
              }}
            >
              <div className="flex items-start gap-3">
                <span className={`text-lg ${isCurrent ? "animate-pulse" : ""}`}>
                  {isCurrent ? "🔊" : "▶️"}
                </span>
                <div className="flex-1 min-w-0">
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

        {filteredReplicas.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            Aucune réplique pour ce personnage
          </p>
        )}
      </div>

      {/* Contrôles de lecture fixes en bas */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-darker via-darker to-transparent">
        <div className="flex gap-3 max-w-md mx-auto">
          {isPlaying ? (
            <button 
              onClick={stop} 
              className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white font-semibold 
                         rounded-full transition flex items-center justify-center gap-2 text-lg"
            >
              <span className="text-2xl">🔇</span> STOP
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setCurrentIndex(0);
                  playAll();
                }}
                className="btn-secondary flex-1 py-4"
              >
                ⏮️ Début
              </button>
              <button 
                onClick={playAll} 
                className="btn-gold flex-1 py-4 flex items-center justify-center gap-2"
              >
                ▶️ Lecture
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AudioMode;
