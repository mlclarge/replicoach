import { useEffect, useState, useMemo, useRef, forwardRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useScriptStore, extractScenes } from "../store/scriptStore";
import { useAuthStore } from "../store/authStore";
import { fetchCharacterRecordings, supabase } from "../lib/supabase";
import Loader from "../components/ui/Loader";
import PremiumVoicePicker from "../components/PremiumVoicePicker";
import { fetchTtsStatus, lockTtsVoice, fetchTtsAudioUrl } from "../lib/premiumTts";

const MALE_NAMES = ["maurice", "jean", "christophe", "pierre", "paul", "jacques", "michel", "philippe", "alain", "bernard", "françois", "patrick", "daniel", "nicolas", "marc", "david", "thomas", "louis", "antoine", "charles", "henri", "robert"];
const FEMALE_NAMES = ["valérie", "fabienne", "audrey", "marie", "anne", "sophie", "christine", "nathalie", "isabelle", "catherine", "sylvie", "martine", "françoise", "claire", "julie", "céline", "amavi", "laura", "emma", "léa", "sarah"];

function detectGender(name) {
  if (!name) return "male";
  const lower = name.toLowerCase().split("-")[0].trim();
  if (MALE_NAMES.includes(lower)) return "male";
  if (FEMALE_NAMES.includes(lower)) return "female";
  if (lower.endsWith("e") || lower.endsWith("a")) return "female";
  return "male";
}

function normalizeStr(str) {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function stripHtml(text) {
  if (!text) return "";
  try {
    if (typeof document !== "undefined") {
      const tmp = document.createElement("div");
      tmp.innerHTML = text;
      return tmp.textContent || tmp.innerText || text;
    }
  } catch (e) {}
  return text.replace(/<[^>]+>/g, "");
}

function cleanTextForSpeech(text) {
  if (!text) return "";
  try {
    if (typeof document !== "undefined") {
      const tmp = document.createElement("div");
      tmp.innerHTML = text;
      text = tmp.textContent || tmp.innerText || text;
      text = text.replace(/<[^>]+>/g, " ");
    } else {
      text = text.replace(/<[^>]+>/g, " ");
    }
  } catch (e) {
    text = text.replace(/<[^>]+>/g, " ");
  }

  return text
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\{[^}]*\}/g, "")
    .replace(/^[\s]*[-–—]+[\s]*/g, "")
    .replace(/[\s]*[-–—]+[\s]*$/g, "")
    .replace(/[\s]+[-–—]+[\s]+/g, " ")
    .replace(/[*_#~`•·]/g, "")
    .replace(/^[«»']+|['«»]+\$/g, "")
    .replace(/\.{4,}/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

function AudioMode() {
  const { id } = useParams();
  const { user, isPremium } = useAuthStore();
  const { currentScript, loading, fetchScript } = useScriptStore();

  const [premiumLocks, setPremiumLocks] = useState({});
  const [ttsUsage, setTtsUsage] = useState(null);
  const [premiumNotice, setPremiumNotice] = useState("");

  const [voices, setVoices] = useState({ male: [], female: [], all: [] });
  const [characterVoices, setCharacterVoices] = useState({});
  const [characterGenders, setCharacterGenders] = useState({});

  const [characterRecordings, setCharacterRecordings] = useState({});
  const [replicaRecordings, setReplicaRecordings] = useState({});
  const [voiceMode, setVoiceMode] = useState({});

  const [recordingReplicaId, setRecordingReplicaId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rate, setRate] = useState(1);
  const [femalePitch, setFemalePitch] = useState(1.8);
  const [malePitch, setMalePitch] = useState(0.5);

  const [hiddenCharacters, setHiddenCharacters] = useState(new Set());
  const [waitingForClick, setWaitingForClick] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // 📍 Filtrage par Scène + Tiroir Flottant à Gauche
  const [selectedSceneKey, setSelectedSceneKey] = useState(null);
  const [isSceneDrawerOpen, setIsSceneDrawerOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [playingSingleBubble, setPlayingSingleBubble] = useState(null);
  const [tempRevealedReplicas, setTempRevealedReplicas] = useState({});

  const playingRef = useRef(false);
  const waitingRef = useRef(false);
  const currentReplicaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const audioContextRef = useRef(null);
  const ttsCacheRef = useRef({});

  useEffect(() => {
    if (!isPremium || !id) return;
    let cancelled = false;
    fetchTtsStatus(id).then((res) => {
      if (cancelled || !res.ok) return;
      setPremiumLocks(res.locks || {});
      setTtsUsage(res.usage || null);
    });
    return () => { cancelled = true; };
  }, [isPremium, id]);

  const handleLockVoice = async (characterId, voiceId) => {
    const res = await lockTtsVoice(id, characterId, voiceId);
    if (res.ok || res.code === "already_locked") {
      const status = await fetchTtsStatus(id);
      if (status.ok) setPremiumLocks(status.locks || {});
    }
    return res;
  };

  useEffect(() => {
    if (!currentScript || currentScript.id !== id) {
      fetchScript(id);
    }
  }, [id, currentScript, fetchScript]);

  const { title, characters = [], replicas = [] } = currentScript || {};

  // Extraction dynamique des scènes
  const { hasScenes, scenes } = useMemo(() => {
    return extractScenes(replicas);
  }, [replicas]);

  // Répliques filtrées selon la scène sélectionnée
  const activeReplicas = useMemo(() => {
    if (!selectedSceneKey) return replicas;
    return replicas.filter((r) => {
      const key = `${r.act_title || ""}_${r.scene_title || ""}`;
      return key === selectedSceneKey;
    });
  }, [replicas, selectedSceneKey]);

  useEffect(() => {
    const saved = localStorage.getItem(`replicaRecordings_${id}`);
    if (saved) {
      try { setReplicaRecordings(JSON.parse(saved)); } catch (e) {}
    }
  }, [id]);

  useEffect(() => {
    const loadVoices = () => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      const available = speechSynthesis.getVoices();
      const french = available.filter((v) => v.lang.startsWith("fr"));
      const voicesToUse = french.length > 0 ? french : available;
      setVoices({ male: voicesToUse, female: voicesToUse, all: voicesToUse });
    };
    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const stop = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      speechSynthesis.cancel();
    }
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch (e) {}
      audioPlayerRef.current = null;
    }
    setIsPlaying(false);
    setPlayingSingleBubble(null);
    playingRef.current = false;
    waitingRef.current = false;
    setWaitingForClick(false);
  };

  if (loading || !currentScript) {
    return (
      <div className="flex justify-center py-12 bg-amber-50 min-h-screen">
        <Loader />
      </div>
    );
  }

  const progress = activeReplicas.length > 0 ? ((currentIndex + 1) / activeReplicas.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-amber-50/60 pb-56 w-full relative">
      {/* 📌 MENU FLOTTANT À GAUCHE POUR LA NAVIGATION PAR SCÈNE (IDENTIQUE À SCRIPT DETAIL) */}
      {hasScenes && (
        <>
          {/* Bouton Onglet Flottant à Gauche */}
          <button
            onClick={() => setIsSceneDrawerOpen(!isSceneDrawerOpen)}
            className="fixed left-0 top-36 z-40 bg-gradient-to-r from-amber-500 to-gold-500 text-black font-extrabold text-xs px-2.5 py-3 rounded-r-xl shadow-2xl border-y border-r border-amber-300 flex items-center gap-1.5 transition-all hover:pl-3 transform hover:scale-105 active:scale-95"
            title="Ouvrir le sommaire des scènes"
          >
            <span className="text-base">📍</span>
            <span className="[writing-mode:vertical-lr] rotate-180 uppercase tracking-widest font-bold">
              Scènes ({scenes.length})
            </span>
          </button>

          {/* Tiroir Latéral Rétractable */}
          {isSceneDrawerOpen && (
            <div className="fixed inset-0 z-50 flex">
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setIsSceneDrawerOpen(false)}
              />
              <div className="relative w-72 max-w-[80vw] bg-gray-900 border-r border-gray-800 text-white p-4 flex flex-col h-full shadow-2xl z-10 animate-fade-in">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📍</span>
                    <h3 className="font-extrabold text-gold-400 text-sm uppercase tracking-wider">
                      Sommaire des Scènes
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsSceneDrawerOpen(false)}
                    className="p-1 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                  <button
                    onClick={() => {
                      setSelectedSceneKey(null);
                      setCurrentIndex(0);
                      setIsSceneDrawerOpen(false);
                      stop();
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                      !selectedSceneKey
                        ? "bg-amber-500 text-black"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    <span>📜 Pièce entière</span>
                    <span className="text-[10px] opacity-80">{replicas.length} rép.</span>
                  </button>

                  {scenes.map((scene) => {
                    const sceneKey = `${scene.actTitle || ""}_${scene.sceneTitle || ""}`;
                    const isSelected = selectedSceneKey === sceneKey;

                    return (
                      <button
                        key={scene.id}
                        onClick={() => {
                          setSelectedSceneKey(sceneKey);
                          setCurrentIndex(0);
                          setIsSceneDrawerOpen(false);
                          stop();
                          const el = document.getElementById(`audio-replica-${scene.firstReplicaId}`);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition flex flex-col gap-0.5 border ${
                          isSelected
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                            : "bg-gray-800/60 text-gray-300 border-gray-800 hover:bg-gray-800 hover:border-gray-700"
                        }`}
                      >
                        <span className="font-bold">{scene.fullLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Header */}
      <div className="bg-gradient-to-b from-primary-800 to-primary-900 p-4 shadow-lg sticky top-0 z-30">
        <div className="flex items-center justify-between gap-3 w-full max-w-7xl mx-auto">
          <button
            onClick={() => window.history.back()}
            className="px-3 py-2 bg-black/60 text-white rounded-xl text-xs font-semibold"
          >
            ← Retour
          </button>
          <div className="min-w-0">
            <h2 className="text-gold-400 text-base font-bold truncate">🔊 Mode Audio</h2>
            <p className="text-gray-300 text-xs truncate">{title}</p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 py-2 bg-gray-900 text-gold-400 rounded-xl text-xs font-bold border border-gold-500/40"
          >
            ⚙️ Voix
          </button>
        </div>

        <div className="mt-2 w-full max-w-7xl mx-auto">
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-gold-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-gray-300 text-[11px] mt-1 text-center font-mono">
            Réplique {currentIndex + 1} / {activeReplicas.length}
          </p>
        </div>
      </div>

      {/* Liste des répliques filtrées par scène */}
      <div className="p-4 space-y-4 w-full max-w-7xl mx-auto">
        {activeReplicas.map((replica, index) => {
          const character = characters.find((c) => c.id === replica.character_id);
          const isCurrent = index === currentIndex;
          const prevReplica = index > 0 ? activeReplicas[index - 1] : null;
          const isNewAct = replica.act_title && replica.act_title !== prevReplica?.act_title;
          const isNewScene = replica.scene_title && replica.scene_title !== prevReplica?.scene_title;

          return (
            <div key={replica.id} id={`audio-replica-${replica.id}`}>
              {(isNewAct || isNewScene) && (
                <div className="w-full my-4 text-center">
                  {isNewAct && (
                    <h2 className="text-lg font-extrabold text-amber-700 uppercase tracking-widest my-1">
                      {replica.act_title}
                    </h2>
                  )}
                  {isNewScene && (
                    <h3 className="text-xs font-bold text-black bg-amber-200 inline-block px-4 py-1 rounded-full border border-amber-300 shadow-sm uppercase tracking-wider">
                      {replica.scene_title}
                    </h3>
                  )}
                </div>
              )}

              <div
                className={`p-4 rounded-2xl transition-all shadow-md ${
                  isCurrent ? "ring-4 ring-gold-500 bg-white" : "bg-white/80"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: character?.color || "#6B7280" }}>
                    {character?.name || "Personnage"}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">#{index + 1}</span>
                </div>
                <p className="text-gray-900 text-sm leading-relaxed">{stripHtml(replica.text)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AudioMode;
