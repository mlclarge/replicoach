// src/pages/AudioMode.jsx
import { useEffect, useState, useRef, forwardRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useScriptStore } from "../store/scriptStore";
import { useAuthStore } from "../store/authStore";
import {
  fetchCharacterRecordings,
  supabase,
} from "../lib/supabase";
import Loader from "../components/ui/Loader";
import PremiumVoicePicker from "../components/PremiumVoicePicker";
import {
  fetchTtsStatus,
  lockTtsVoice,
  fetchTtsAudioUrl,
} from "../lib/premiumTts";

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
  if (!name) return "male";
  const lowerName = name.toLowerCase().split("-")[0].trim();
  if (MALE_NAMES.includes(lowerName)) return "male";
  if (FEMALE_NAMES.includes(lowerName)) return "female";
  if (lowerName.endsWith("e") || lowerName.endsWith("a")) return "female";
  return "male";
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
    .replace(/^['"«»']+|['"«»']+\$/g, "")
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
  const [playingSingleBubble, setPlayingSingleBubble] = useState(null);
  const [tempRevealedReplicas, setTempRevealedReplicas] = useState({});

  const playingRef = useRef(false);
  const waitingRef = useRef(false);
  const currentReplicaRef = useRef(null);
  const singleBubbleRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const audioContextRef = useRef(null);

  useEffect(() => {
    if (!isPremium || !id) return;
    let cancelled = false;
    fetchTtsStatus(id).then((res) => {
      if (cancelled || !res.ok) return;
      setPremiumLocks(res.locks || {});
      setTtsUsage(res.usage || null);
    });
    return () => {
      cancelled = true;
    };
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

  useEffect(() => {
    const saved = localStorage.getItem(`replicaRecordings_${id}`);
    if (saved) {
      try {
        setReplicaRecordings(JSON.parse(saved));
      } catch (e) {
        console.warn("Impossible de parser replicaRecordings", e);
      }
    }
  }, [id]);

  useEffect(() => {
    const loadVoices = () => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      const availableVoices = speechSynthesis.getVoices();
      const frenchVoices = availableVoices.filter((v) =>
        v.lang.startsWith("fr")
      );
      const voicesToUse = frenchVoices.length > 0 ? frenchVoices : availableVoices;

      const maleVoices = voicesToUse.filter(
        (v) =>
          v.name.toLowerCase().includes("male") ||
          v.name.toLowerCase().includes("homme") ||
          v.name.toLowerCase().includes("paul") ||
          v.name.toLowerCase().includes("thomas")
      );

      const femaleVoices = voicesToUse.filter(
        (v) =>
          v.name.toLowerCase().includes("female") ||
          v.name.toLowerCase().includes("femme") ||
          v.name.toLowerCase().includes("julie") ||
          v.name.toLowerCase().includes("marie")
      );

      setVoices({
        male: maleVoices.length > 0 ? maleVoices : voicesToUse,
        female: femaleVoices.length > 0 ? femaleVoices : voicesToUse,
        all: voicesToUse,
      });
    };

    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        speechSynthesis.cancel();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (currentScript?.characters && user) {
      loadRecordings();
    }
  }, [currentScript, user]);

  const loadRecordings = async () => {
    if (!currentScript?.characters || !user) return;
    try {
      const charIds = currentScript.characters.map((c) => c.id);
      const recordings = await fetchCharacterRecordings(charIds, user.id);

      const recordingsMap = {};
      const modeMap = {};

      for (const rec of recordings) {
        const { data } = await supabase.storage
          .from("audio-recordings")
          .createSignedUrl(rec.audio_path, 3600);

        recordingsMap[rec.character_id] = {
          audioPath: rec.audio_path,
          audioUrl: data?.signedUrl,
        };
        modeMap[rec.character_id] = "recorded";
      }

      setCharacterRecordings(recordingsMap);
      setVoiceMode((prev) => ({ ...prev, ...modeMap }));
    } catch (err) {
      console.error("Error loading recordings:", err);
    }
  };

  useEffect(() => {
    if (currentScript?.characters && voices.all?.length > 0) {
      const autoVoices = {};
      const autoModes = {};

      currentScript.characters.forEach((char) => {
        autoVoices[char.id] = voices.all[0]?.name;
        if (!voiceMode[char.id]) {
          autoModes[char.id] = "synth";
        }
      });

      setCharacterVoices(autoVoices);
      setVoiceMode((prev) => ({ ...autoModes, ...prev }));
    }
  }, [currentScript, voices]);

  useEffect(() => {
    if (currentReplicaRef.current && isPlaying) {
      currentReplicaRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentIndex, isPlaying]);

  const startReplicaRecording = async (replicaId) => {
    try {
      chunksRef.current = [];
      setRecordingReplicaId(replicaId);
      setRecordingDuration(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => {
          if (d >= 60) {
            stopReplicaRecording();
            return d;
          }
          return d + 1;
        });
      }, 1000);
    } catch (err) {
      alert("Impossible d'accéder au microphone");
      setRecordingReplicaId(null);
    }
  };

  const stopReplicaRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const saveReplicaRecording = async (replicaId, characterName) => {
    if (chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const reader = new FileReader();

    reader.onloadend = () => {
      const newRecording = {
        data: reader.result,
        name: `${characterName} - Réplique`,
        date: new Date().toISOString(),
        duration: recordingDuration,
      };

      const updated = {
        ...replicaRecordings,
        [replicaId]: newRecording,
      };

      setReplicaRecordings(updated);
      localStorage.setItem(`replicaRecordings_${id}`, JSON.stringify(updated));

      setRecordingReplicaId(null);
      chunksRef.current = [];
    };

    reader.readAsDataURL(blob);
  };

  const deleteReplicaRecording = (replicaId) => {
    const updated = { ...replicaRecordings };
    delete updated[replicaId];
    setReplicaRecordings(updated);
    localStorage.setItem(`replicaRecordings_${id}`, JSON.stringify(updated));
  };

  const playReplicaRecording = (replicaId) => {
    return new Promise(async (resolve) => {
      const recording = replicaRecordings[replicaId];
      if (!recording?.data) return resolve();

      try {
        await ensureAudioUnlocked();
      } catch (e) {}

      const audio = new Audio(recording.data);
      audioPlayerRef.current = audio;
      audio.playbackRate = rate;

      audio.onended = () => {
        audioPlayerRef.current = null;
        resolve();
      };
      audio.onerror = () => {
        audioPlayerRef.current = null;
        resolve();
      };

      audio.play().catch(() => resolve());
    });
  };

  const speakSynth = async (text, characterId) => {
    await ensureAudioUnlocked();

    return new Promise((resolve) => {
      const cleanedText = cleanTextForSpeech(text);
      if (!cleanedText) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanedText);
      const character = currentScript?.characters?.find(
        (c) => c.id === characterId
      );
      const gender =
        characterGenders[characterId] ||
        character?.gender ||
        detectGender(character?.name || "");

      const voiceName = characterVoices[characterId];
      const selectedVoice = voices.all?.find((v) => v.name === voiceName);
      if (selectedVoice) utterance.voice = selectedVoice;

      utterance.lang = "fr-FR";

      if (gender === "female") {
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

  const speakRecorded = (characterId) => {
    return new Promise(async (resolve) => {
      await ensureAudioUnlocked();
      const recording = characterRecordings[characterId];

      if (!recording?.audioUrl) {
        resolve();
        return;
      }

      const audio = new Audio(recording.audioUrl);
      audioPlayerRef.current = audio;
      audio.playbackRate = rate;

      audio.onended = resolve;
      audio.onerror = resolve;

      audio.play().catch(resolve);
    });
  };

  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const ensureAudioUnlocked = async () => {
    if (audioUnlocked) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
        const ctx = audioContextRef.current;
        if (ctx.state === "suspended") {
          try {
            await ctx.resume();
          } catch (e) {}
        }
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        speechSynthesis.getVoices();
      }
      setAudioUnlocked(true);
    } catch (e) {
      console.warn("Error unlocking audio:", e);
    }
  };

  const speakPremium = async (replicaId) => {
    const res = await fetchTtsAudioUrl(id, replicaId);
    if (!res.ok) {
      setPremiumNotice(
        "Veuillez vérifier vos voix Premium verrouillées pour ce script."
      );
      return false;
    }

    setPremiumNotice("");
    if (res.usage) setTtsUsage(res.usage);

    try {
      await ensureAudioUnlocked();
    } catch (e) {}

    return await new Promise((resolve) => {
      const audio = new Audio(res.url);
      audioPlayerRef.current = audio;
      audio.playbackRate = rate;

      audio.onended = () => {
        audioPlayerRef.current = null;
        resolve(true);
      };
      audio.onerror = () => {
        audioPlayerRef.current = null;
        resolve(false);
      };

      audio.play().catch(() => resolve(false));
    });
  };

  const speak = async (text, characterId, replicaId = null) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch (e) {}
      audioPlayerRef.current = null;
    }

    const cleanedForDecision = cleanTextForSpeech(text || "");

    if (replicaId && replicaRecordings[replicaId]?.data) {
      return await playReplicaRecording(replicaId);
    }

    const mode = voiceMode[characterId] || "synth";
    if (mode === "recorded" && characterRecordings[characterId]?.audioUrl) {
      return await speakRecorded(characterId);
    }

    if (isPremium) {
      if (replicaId && premiumLocks[characterId]) {
        const played = await speakPremium(replicaId);
        if (played) return;
      }
      setPremiumNotice(
        "Veuillez sélectionner et verrouiller une voix Premium pour ce personnage."
      );
      return;
    }

    return await speakSynth(cleanedForDecision, characterId);
  };

  const stop = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
        audioPlayerRef.current.src = "";
      } catch (e) {}
      audioPlayerRef.current = null;
    }
    setIsPlaying(false);
    setPlayingSingleBubble(null);
    playingRef.current = false;
    waitingRef.current = false;
    singleBubbleRef.current = false;
    setWaitingForClick(false);
  };

  const playAll = async (startIndex = currentIndex) => {
    if (!currentScript?.replicas) return;

    stop();
    await new Promise((r) => setTimeout(r, 50));

    setIsPlaying(true);
    setPlayingSingleBubble(null);
    playingRef.current = true;
    waitingRef.current = false;
    singleBubbleRef.current = false;

    for (let i = startIndex; i < currentScript.replicas.length; i++) {
      if (!playingRef.current) break;

      setCurrentIndex(i);
      const replica = currentScript.replicas[i];

      if (hiddenCharacters.has(replica.character_id)) {
        setWaitingForClick(true);
        waitingRef.current = true;

        while (waitingRef.current && playingRef.current) {
          await new Promise((r) => setTimeout(r, 100));
        }

        setWaitingForClick(false);
        if (!playingRef.current) break;
        continue;
      }

      await speak(replica.text, replica.character_id, replica.id);
    }

    setIsPlaying(false);
    playingRef.current = false;
    setWaitingForClick(false);
  };

  const playSingleBubble = async (index) => {
    if (!currentScript?.replicas) return;

    stop();
    await new Promise((r) => setTimeout(r, 50));

    const replica = currentScript.replicas[index];

    setPlayingSingleBubble(index);
    setCurrentIndex(index);
    singleBubbleRef.current = true;

    await speak(replica.text, replica.character_id, replica.id);

    setPlayingSingleBubble(null);
    singleBubbleRef.current = false;
  };

  const stopSingleBubble = () => {
    stop();
  };

  const onBubbleClick = (index) => {
    const replica = currentScript?.replicas[index];
    if (!replica) return;

    const isHidden = hiddenCharacters.has(replica.character_id);

    if (isHidden) {
      setTempRevealedReplicas((prev) => ({ ...prev, [replica.id]: true }));

      if (waitingForClick) {
        setWaitingForClick(false);
        waitingRef.current = false;
      }

      setPlayingSingleBubble(index);
      setCurrentIndex(index);

      (async () => {
        try {
          await speak(replica.text || "", replica.character_id, replica.id);
        } catch (e) {
          console.warn("Erreur lecture réplique masquée:", e);
        }

        setPlayingSingleBubble(null);
        setTempRevealedReplicas((prev) => {
          const copy = { ...prev };
          delete copy[replica.id];
          return copy;
        });
      })();

      return;
    }

    playSingleBubble(index);
  };

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
    const newIndex = Math.min(
      currentScript.replicas.length - 1,
      currentIndex + 1
    );
    setCurrentIndex(newIndex);
    if (isPlaying) {
      stop();
      setTimeout(() => playAll(newIndex), 100);
    }
  };

  const toggleHideCharacter = (charId) => {
    setHiddenCharacters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(charId)) {
        newSet.delete(charId);
      } else {
        newSet.add(charId);
      }
      return newSet;
    });
  };

  if (loading || !currentScript) {
    return (
      <div className="flex justify-center py-12 bg-amber-50 min-h-screen">
        <Loader />
      </div>
    );
  }

  const { title, characters = [], replicas = [] } = currentScript;
  const progress =
    replicas.length > 0 ? ((currentIndex + 1) / replicas.length) * 100 : 0;

  const characterPositions = {};
  characters.forEach((char, index) => {
    characterPositions[char.id] = index % 2;
  });

  return (
    /* 📍 POINT 5 : Layout Responsif Pleine Page (w-full max-w-7xl mx-auto) */
    <div className="min-h-screen bg-amber-50 pb-52 w-full">
      {/* Header Sticky avec titre et bouton explicite pour les Voix */}
      <div className="bg-gradient-to-b from-primary-800 to-primary-900 p-4 shadow-lg sticky top-0 z-30">
        <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-1.5 px-3 py-2 bg-black/60 hover:bg-black text-white rounded-xl transition text-xs font-semibold border border-white/20 flex-shrink-0"
            >
              <span className="text-base">←</span>
              <span className="hidden sm:inline">Retour au texte</span>
            </button>

            <div className="min-w-0">
              <h2 className="text-amber-400 text-base sm:text-lg font-bold truncate flex items-center gap-2">
                <span>🔊</span>
                <span>Mode Audio</span>
              </h2>
              <p className="text-gray-300 text-xs truncate">{title}</p>
            </div>
          </div>

          {/* 📍 POINT 3 : Bouton d'ouverture explicite avec texte clair */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md border ${
              showSettings
                ? "bg-amber-500 text-black border-amber-400 font-extrabold"
                : "bg-gray-800 text-amber-400 border-amber-500/40 hover:bg-gray-700"
            }`}
          >
            <span className="text-sm">🎙️</span>
            <span>Voix partenaire</span>
            <span className="text-[10px]">{showSettings ? "▲" : "▼"}</span>
          </button>
        </div>

        {/* Barre de progression */}
        <div className="mt-3 max-w-7xl mx-auto px-4">
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-gray-300 text-[11px] mt-1 text-center font-mono">
            Réplique {currentIndex + 1} / {replicas.length}
          </p>
        </div>
      </div>

      {/* 📍 POINT 3 : PANNEAU RÉGLAGES FERMÉ PAR DÉFAUT (Fermeture facile) */}
      {showSettings && (
        <div className="bg-white border-b-2 border-amber-500/30 p-4 sm:p-6 shadow-xl max-w-7xl mx-auto animate-fade-in my-2 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 text-sm sm:text-base flex items-center gap-2">
              <span>🎙️</span> Configuration des voix du partenaire
            </h3>
            <button
              onClick={() => setShowSettings(false)}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition"
            >
              ✕ Fermer
            </button>
          </div>

          {isPremium ? (
            /* CAS PREMIUM */
            <div className="p-4 bg-amber-50/80 border-l-4 border-amber-500 rounded-xl space-y-4">
              <p className="text-xs sm:text-sm text-amber-900 font-bold">
                ✨ Voix Premium Google Cloud TTS (verrouillage par personnage) :
              </p>

              {characters.map((char) => (
                <PremiumVoicePicker
                  key={char.id}
                  character={char}
                  lockedVoiceId={premiumLocks[char.id]}
                  onLock={handleLockVoice}
                />
              ))}

              {ttsUsage && (
                <p className="text-[11px] text-gray-500 pt-2 border-t border-amber-200 font-mono">
                  Quota du mois : {ttsUsage.used.toLocaleString("fr-FR")} /{" "}
                  {ttsUsage.limit.toLocaleString("fr-FR")} caractères
                </p>
              )}
            </div>
          ) : (
            /* CAS STANDARD */
            <div className="p-4 bg-blue-50/80 border-l-4 border-blue-500 rounded-xl space-y-4">
              <p className="text-xs sm:text-sm text-blue-900 font-bold">
                🔊 Voix locales de votre appareil (Standard) :
              </p>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-700 text-xs font-semibold">Vitesse de lecture</span>
                  <span className="text-primary-700 font-bold text-xs">
                    {rate}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  className="w-full accent-primary-600 cursor-pointer"
                />
              </div>

              {voices.all?.length > 0 && (
                <div className="space-y-2">
                  {characters.map((char) => (
                    <div key={char.id} className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: char.color }}
                      />
                      <span className="text-gray-800 text-xs font-bold w-28 truncate">
                        {char.name}
                      </span>
                      <select
                        value={characterVoices[char.id] || ""}
                        onChange={(e) =>
                          setCharacterVoices((prev) => ({
                            ...prev,
                            [char.id]: e.target.value,
                          }))
                        }
                        className="flex-1 p-2 border border-gray-300 rounded-lg text-xs bg-white text-gray-900 font-semibold focus:outline-none shadow-sm"
                      >
                        {voices.all?.map((voice) => (
                          <option
                            key={voice.name}
                            value={voice.name}
                            className="text-gray-900 bg-white font-medium"
                          >
                            {voice.name.replace(/Microsoft|Google/gi, "").trim()}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mode italienne */}
      <div className="p-3 bg-amber-100/90 border-b border-amber-200 max-w-7xl mx-auto my-2 rounded-xl">
        <p className="text-xs text-amber-900 mb-2 font-bold flex items-center gap-1.5">
          <span>🎭</span> Mode italienne : cliquez sur un personnage pour masquer ses répliques
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {characters.map((char) => {
            const isHidden = hiddenCharacters.has(char.id);
            const hasRecording = !!characterRecordings[char.id];
            const currentMode = voiceMode[char.id] || "synth";

            return (
              <button
                key={char.id}
                onClick={() => toggleHideCharacter(char.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition shadow-sm
                  ${
                    isHidden
                      ? "bg-gray-700 text-white ring-2 ring-red-500"
                      : "text-white"
                  }`}
                style={!isHidden ? { backgroundColor: char.color } : {}}
              >
                {isHidden ? "🙈" : "👁️"} {char.name}
                {hasRecording && currentMode === "recorded" && (
                  <span className="text-[10px]">🎙️</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Indicateur d'attente */}
      {waitingForClick && (
        <div className="bg-emerald-600 text-white p-3 text-center animate-pulse sticky top-[110px] z-20 shadow-lg font-bold text-xs sm:text-sm max-w-7xl mx-auto rounded-xl">
          🎭 C'est votre tour ! Cliquez sur votre réplique pour continuer.
        </div>
      )}

      {/* Liste des répliques (Responsive sur Desktop) */}
      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        {replicas.map((replica, index) => {
          const character = characters.find(
            (c) => c.id === replica.character_id
          );
          const isRight = characterPositions[replica.character_id] === 1;
          const isCurrent = index === currentIndex;
          const isHidden = hiddenCharacters.has(replica.character_id);
          const isWaitingOnThis = waitingForClick && isCurrent && isHidden;
          const isBubblePlaying = playingSingleBubble === index;
          const hasRecording = !!characterRecordings[replica.character_id];
          const currentMode = voiceMode[replica.character_id] || "synth";

          return (
            <AudioBubble
              key={replica.id}
              ref={isCurrent ? currentReplicaRef : null}
              replica={replica}
              character={character}
              isRight={isRight}
              number={index + 1}
              isCurrent={isCurrent}
              isPlaying={
                (isPlaying && isCurrent && !isHidden) || isBubblePlaying
              }
              isHidden={isHidden}
              isTemporarilyRevealed={!!tempRevealedReplicas[replica.id]}
              isWaiting={isWaitingOnThis}
              isBubblePlaying={isBubblePlaying}
              hasRecording={hasRecording && currentMode === "recorded"}
              onBubbleClick={() => onBubbleClick(index)}
              onPlay={() => playSingleBubble(index)}
              onStop={stopSingleBubble}
              replicaRecordings={replicaRecordings}
              recordingReplicaId={recordingReplicaId}
              recordingDuration={recordingDuration}
              startReplicaRecording={startReplicaRecording}
              stopReplicaRecording={stopReplicaRecording}
              saveReplicaRecording={saveReplicaRecording}
              deleteReplicaRecording={deleteReplicaRecording}
              playReplicaRecording={playReplicaRecording}
            />
          );
        })}
      </div>

      {/* 📍 POINT 6 : PANNEAU DE CONTRÔLE CLAIR, DEBONNAIRE ET VISIBLE AVEC TOUS LES BOUTONS (PLAY, PAUSE, RECUL, AVANCE, STOP) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-amber-500 shadow-[0_-8px_30px_rgba(0,0,0,0.2)] pb-4 pt-2.5">
        {premiumNotice && (
          <div className="bg-amber-500 text-black px-4 py-1 text-xs font-bold text-center mb-1">
            ⚠️ {premiumNotice}
          </div>
        )}

        <div className="max-w-4xl mx-auto px-4">
          {/* Info réplique courante */}
          <div className="flex items-center justify-between gap-3 mb-2 pb-2 border-b border-gray-200">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor:
                    characters.find(
                      (c) => c.id === replicas[currentIndex]?.character_id
                    )?.color || "#D97706",
                }}
              />
              <p className="text-gray-900 font-extrabold text-xs sm:text-sm truncate">
                {characters.find(
                  (c) => c.id === replicas[currentIndex]?.character_id
                )?.name || "-"}
              </p>
              <span className="text-gray-400 text-xs">•</span>
              <p className="text-gray-600 text-xs truncate max-w-[200px] sm:max-w-md">
                {waitingForClick
                  ? "À vous de jouer !"
                  : (stripHtml(replicas[currentIndex]?.text || "").substring(
                      0,
                      40
                    ) || "") + "..."}
              </p>
            </div>
            <span className="text-amber-600 font-mono font-bold text-xs flex-shrink-0 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
              {currentIndex + 1} / {replicas.length}
            </span>
          </div>

          {/* 📍 POINT 6 : BARRE COMPLÈTE DE 5 BOUTONS DE CONTRÔLE (REPLAY, PREV, PLAY/PAUSE, NEXT, STOP) */}
          <div className="flex items-center justify-center gap-3 sm:gap-8">
            {/* 1. Recommencer */}
            <button
              onClick={() => {
                stop();
                setCurrentIndex(0);
                setTimeout(() => playAll(0), 100);
              }}
              className="flex flex-col items-center gap-0.5 p-2 text-gray-700 hover:text-amber-600 transition active:scale-95"
              title="Recommencer depuis le début"
            >
              <span className="text-xl">🔄</span>
              <span className="text-[10px] font-bold">Début</span>
            </button>

            {/* 2. Précédent */}
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className="flex flex-col items-center gap-0.5 p-2 text-gray-700 hover:text-amber-600 disabled:opacity-30 transition active:scale-95"
              title="Réplique précédente"
            >
              <span className="text-xl">⏮️</span>
              <span className="text-[10px] font-bold">Recul</span>
            </button>

            {/* 3. GRAND BOUTON CENTRAL PLAY / PAUSE */}
            <button
              onClick={() => (isPlaying ? stop() : playAll(currentIndex))}
              className={`flex items-center justify-center w-14 h-14 rounded-2xl text-2xl text-white shadow-lg transition-all transform active:scale-95 ${
                isPlaying
                  ? "bg-amber-600 hover:bg-amber-500 ring-4 ring-amber-300"
                  : "bg-emerald-600 hover:bg-emerald-500 ring-4 ring-emerald-300"
              }`}
              title={isPlaying ? "Mettre en pause" : "Lancer la lecture"}
            >
              {isPlaying ? "⏸️" : "▶️"}
            </button>

            {/* 4. Suivant */}
            <button
              onClick={goToNext}
              disabled={currentIndex === replicas.length - 1}
              className="flex flex-col items-center gap-0.5 p-2 text-gray-700 hover:text-amber-600 disabled:opacity-30 transition active:scale-95"
              title="Réplique suivante"
            >
              <span className="text-xl">⏭️</span>
              <span className="text-[10px] font-bold">Avance</span>
            </button>

            {/* 5. Arrêter */}
            <button
              onClick={stop}
              className="flex flex-col items-center gap-0.5 p-2 text-red-600 hover:text-red-700 transition active:scale-95"
              title="Arrêter la lecture"
            >
              <span className="text-xl">⏹️</span>
              <span className="text-[10px] font-bold">Stop</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const AudioBubble = forwardRef(
  (
    {
      replica,
      character,
      isRight,
      number,
      isCurrent,
      isPlaying,
      isHidden,
      isTemporarilyRevealed,
      isWaiting,
      isBubblePlaying,
      hasRecording,
      onBubbleClick,
      onPlay,
      onStop,
      replicaRecordings,
      recordingReplicaId,
      recordingDuration,
      startReplicaRecording,
      stopReplicaRecording,
      saveReplicaRecording,
      deleteReplicaRecording,
      playReplicaRecording,
    },
    ref
  ) => {
    const bubbleColor = character?.color || "#6B7280";

    return (
      <div
        ref={ref}
        className={`p-4 rounded-2xl transition-all duration-300 shadow-md ${
          isRight ? "ml-auto max-w-[85%]" : "mr-auto max-w-[85%]"
        } ${
          isCurrent
            ? "ring-4 ring-amber-400 shadow-xl scale-[1.01]"
            : "opacity-90 hover:opacity-100"
        }`}
        style={{
          backgroundColor: bubbleColor,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-white/90">
            {character?.name || "Personnage"}
          </span>
          <span className="text-[10px] text-white/70 font-mono">
            #{number}
          </span>
        </div>

        {isHidden && !isTemporarilyRevealed ? (
          <div
            className="py-3 text-center cursor-pointer"
            onClick={onBubbleClick}
          >
            {isWaiting ? (
              <>
                <p className="text-white text-sm font-bold animate-pulse">
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
          <>
            <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
              {stripHtml(replica.text)}
            </p>

            <div className="flex justify-end mt-3 pt-3 border-t border-white/20">
              {isBubblePlaying ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStop();
                  }}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-full text-sm font-bold transition active:scale-95 shadow-md"
                >
                  ⏹️ Arrêter
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay();
                  }}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white/25 hover:bg-white/35 text-white rounded-full text-sm font-bold transition active:scale-95 shadow-md"
                >
                  ▶️ Écouter {hasRecording && "🎙️"}
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/20">
              {replicaRecordings[replica.id] ? (
                <>
                  <button
                    onClick={() => playReplicaRecording(replica.id)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow-md transition active:scale-95"
                  >
                    ▶️ Prise
                  </button>
                  <button
                    onClick={() => deleteReplicaRecording(replica.id)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-md transition active:scale-95"
                  >
                    🗑️ Supprimer
                  </button>
                </>
              ) : recordingReplicaId === replica.id ? (
                <div className="w-full flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                  <span className="text-red-600 font-bold animate-pulse flex items-center gap-2 text-xs">
                    🔴 Enregistrement : {recordingDuration}s
                  </span>
                  <button
                    onClick={() => {
                      stopReplicaRecording();
                      saveReplicaRecording(
                        replica.id,
                        character?.name || "Inconnu"
                      );
                    }}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-md transition active:scale-95"
                  >
                    ⏹️ Valider
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => startReplicaRecording(replica.id)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-md transition active:scale-95"
                >
                  🎤 Enregistrer ma voix
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }
);

AudioBubble.displayName = "AudioBubble";
export default AudioMode;
