import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useScriptStore, extractScenes } from "../store/scriptStore";
import { useAuthStore } from "../store/authStore";
import Loader from "../components/ui/Loader";
import {
  speakText,
  stopSpeech,
  getAvailableVoices,
  getGoogleTtsVoice,
  getElevenLabsVoice,
  getPlayHtVoice,
} from "../lib/tts";

function AudioMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentScript,
    loading,
    error,
    fetchScript,
    clearCurrentScript,
  } = useScriptStore();

  const [myCharacterId, setMyCharacterId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentReplicaIndex, setCurrentReplicaIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [loopMode, setLoopMode] = useState(false);
  const [selectedSceneKey, setSelectedSceneKey] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSceneList, setShowSceneList] = useState(false);
  const [ttsType, setTtsType] = useState("webSpeech");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [voices, setVoices] = useState([]);
  const [pauseDuration, setPauseDuration] = useState(2);

  const activeUtteranceRef = useRef(null);
  const isComponentMounted = useRef(true);

  useEffect(() => {
    isComponentMounted.current = true;
    fetchScript(id);
    return () => {
      isComponentMounted.current = false;
      stopSpeech();
      clearCurrentScript();
    };
  }, [id, fetchScript, clearCurrentScript]);

  const allReplicas = useMemo(() => {
    return currentScript?.replicas || [];
  }, [currentScript]);

  // Extraction dynamique des scènes
  const { hasScenes, scenes } = useMemo(() => {
    return extractScenes(allReplicas);
  }, [allReplicas]);

  // Filtrage des répliques pour la lecture audio si une scène est sélectionnée
  const replicas = useMemo(() => {
    if (!selectedSceneKey) return allReplicas;
    return allReplicas.filter((r) => {
      const key = `${r.act_title || ""}_${r.scene_title || ""}`;
      return key === selectedSceneKey;
    });
  }, [allReplicas, selectedSceneKey]);

  const characters = useMemo(() => {
    return currentScript?.characters || [];
  }, [currentScript]);

  const currentReplica = replicas[currentReplicaIndex];
  const isMyTurn =
    currentReplica &&
    myCharacterId &&
    currentReplica.character_id === myCharacterId;

  const speakCurrentReplica = async () => {
    if (!currentReplica) return;

    if (isMyTurn) {
      if (autoAdvance) {
        setTimeout(() => {
          if (isComponentMounted.current && isPlaying) {
            handleNext();
          }
        }, pauseDuration * 1000);
      }
      return;
    }

    try {
      let voiceToUse = selectedVoice;
      if (ttsType === "google") {
        voiceToUse = getGoogleTtsVoice(currentReplica.character_id);
      } else if (ttsType === "elevenlabs") {
        voiceToUse = getElevenLabsVoice(currentReplica.character_id);
      } else if (ttsType === "playht") {
        voiceToUse = getPlayHtVoice(currentReplica.character_id);
      }

      activeUtteranceRef.current = await speakText(currentReplica.text, {
        voiceName: voiceToUse,
        rate: playbackSpeed,
        onEnd: () => {
          if (isComponentMounted.current && isPlaying && autoAdvance) {
            handleNext();
          }
        },
        onError: (err) => {
          console.error("TTS Error:", err);
          if (isComponentMounted.current && isPlaying && autoAdvance) {
            handleNext();
          }
        },
      });
    } catch (err) {
      console.error("Error speaking:", err);
      if (isComponentMounted.current && isPlaying && autoAdvance) {
        handleNext();
      }
    }
  };

  useEffect(() => {
    if (isPlaying) {
      speakCurrentReplica();
    } else {
      stopSpeech();
    }
  }, [isPlaying, currentReplicaIndex]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    if (currentReplicaIndex < replicas.length - 1) {
      setCurrentReplicaIndex((prev) => prev + 1);
    } else {
      if (loopMode) {
        setCurrentReplicaIndex(0);
      } else {
        setIsPlaying(false);
      }
    }
  };

  const handlePrev = () => {
    stopSpeech();
    if (currentReplicaIndex > 0) {
      setCurrentReplicaIndex((prev) => prev - 1);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  if (error || !currentScript) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-400 mb-4">Script non trouvé</p>
        <Link to="/" className="btn-primary">
          Retour
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-32 min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 p-4 sticky top-0 z-20 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/script/${id}`)}
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition"
          >
            ← Retour
          </button>
          <div>
            <h1 className="font-display font-bold text-lg text-gold-400">
              {currentScript.title}
            </h1>
            <p className="text-xs text-gray-400">
              Mode Écoute & Répétition • Réplique {currentReplicaIndex + 1} / {replicas.length}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-300 border border-gray-700 transition"
        >
          ⚙️
        </button>
      </div>

      {/* Content */}
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* 📍 BLOC SÉLECTION DE SCÈNE EN MODE AUDIO */}
        {hasScenes && (
          <div className="bg-gray-900 p-3.5 rounded-2xl border border-amber-500/40 shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                📍 Choix de la Scène ({scenes.length})
              </span>
              <button
                onClick={() => setShowSceneList(!showSceneList)}
                className="text-[11px] font-semibold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30"
              >
                {showSceneList ? "Masquer ▲" : "Voir répliques ▼"}
              </button>
            </div>

            <select
              value={selectedSceneKey || ""}
              onChange={(e) => {
                setSelectedSceneKey(e.target.value || null);
                setCurrentReplicaIndex(0);
                stopSpeech();
              }}
              className="w-full bg-gray-800 text-white text-xs sm:text-sm font-semibold p-2.5 rounded-xl border border-gray-700 focus:outline-none focus:border-amber-500"
            >
              <option value="">📜 Toute la pièce ({allReplicas.length} répliques)</option>
              {scenes.map((scene) => (
                <option
                  key={scene.id}
                  value={`${scene.actTitle || ""}_${scene.sceneTitle || ""}`}
                >
                  {scene.fullLabel}
                </option>
              ))}
            </select>

            {/* Mini-liste pour sauter directement à une réplique */}
            {showSceneList && (
              <div className="max-h-48 overflow-y-auto space-y-1 pt-2 border-t border-gray-800 scrollbar-thin">
                {replicas.map((rep, idx) => {
                  const charName = characters.find((c) => c.id === rep.character_id)?.name || "Personnage";
                  const isCurrent = idx === currentReplicaIndex;
                  return (
                    <button
                      key={rep.id}
                      onClick={() => {
                        setCurrentReplicaIndex(idx);
                        stopSpeech();
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition flex items-center justify-between ${
                        isCurrent
                          ? "bg-amber-500 text-black font-bold"
                          : "bg-gray-800/60 text-gray-300 hover:bg-gray-800"
                      }`}
                    >
                      <span className="truncate max-w-[200px]">{charName}: {rep.text}</span>
                      <span className="text-[10px] opacity-75">#{idx + 1}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Role Selector */}
        <div className="bg-gray-900/80 p-3.5 rounded-2xl border border-gray-800">
          <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wider">
            Mon Rôle (Pausera automatiquement la lecture sur mes répliques) :
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setMyCharacterId(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                !myCharacterId
                  ? "bg-gold-500 text-black"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              Spectateur (Tout écouter)
            </button>
            {characters.map((char) => (
              <button
                key={char.id}
                onClick={() =>
                  setMyCharacterId(myCharacterId === char.id ? null : char.id)
                }
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition border ${
                  myCharacterId === char.id
                    ? "bg-gold-400 text-black border-gold-300"
                    : "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
                }`}
              >
                {char.name}
              </button>
            ))}
          </div>
        </div>

        {/* Display Act & Scene Badge above current replica if present */}
        {currentReplica && (currentReplica.act_title || currentReplica.scene_title) && (
          <div className="text-center py-2 bg-amber-500/10 rounded-2xl border border-amber-500/20">
            {currentReplica.act_title && (
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest mr-2">
                {currentReplica.act_title}
              </span>
            )}
            {currentReplica.scene_title && (
              <span className="text-xs font-semibold text-gray-300 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
                {currentReplica.scene_title}
              </span>
            )}
          </div>
        )}

        {/* Current Active Replica Display */}
        {currentReplica && (
          <div
            className={`p-6 rounded-3xl border-2 shadow-2xl transition-all transform ${
              isMyTurn
                ? "bg-amber-950/60 border-gold-400 ring-4 ring-gold-400/20 shadow-gold-500/10"
                : "bg-gray-900 border-gray-800"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider text-white shadow-sm"
                style={{
                  backgroundColor:
                    characters.find((c) => c.id === currentReplica.character_id)
                      ?.color || "#6B7280",
                }}
              >
                {characters.find((c) => c.id === currentReplica.character_id)
                  ?.name || "Personnage"}
              </span>
              {isMyTurn && (
                <span className="px-3 py-1 bg-gold-400/20 text-gold-300 text-xs font-bold rounded-full border border-gold-400/30 flex items-center gap-1 animate-pulse">
                  🎙️ À vous de jouer !
                </span>
              )}
            </div>

            <p className="text-lg md:text-xl font-medium leading-relaxed text-gray-100">
              {currentReplica.text}
            </p>
          </div>
        )}

        {/* Controls Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 p-4 shadow-2xl z-30">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <button
              onClick={handlePrev}
              className="p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-full transition shadow-md active:scale-95"
            >
              ⏮️
            </button>

            <button
              onClick={handlePlayPause}
              className={`px-8 py-4 rounded-full font-extrabold text-base transition shadow-xl transform active:scale-95 flex items-center gap-2 ${
                isPlaying
                  ? "bg-amber-500 text-black hover:bg-amber-400"
                  : "bg-gradient-to-r from-gold-400 via-gold-500 to-amber-500 text-black hover:scale-105"
              }`}
            >
              <span className="text-xl">{isPlaying ? "⏸️" : "▶️"}</span>
              <span>{isPlaying ? "Pause" : "Lecture"}</span>
            </button>

            <button
              onClick={handleNext}
              className="p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-full transition shadow-md active:scale-95"
            >
              ⏭️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AudioMode;
