import { useEffect, useState, useMemo, useRef, forwardRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useScriptStore, extractScenes } from "../store/scriptStore";
import { useAuthStore } from "../store/authStore";
import {
  fetchCharacterRecordings,
  supabase,
} from "../lib/supabase";
import {
  loadAllReplicaRecordingsDB,
  saveReplicaRecordingDB,
  deleteReplicaRecordingDB,
} from "../lib/audioStorage";
import Loader from "../components/ui/Loader";
import PremiumVoicePicker from "../components/PremiumVoicePicker";
import AICoachingModal from "../components/AICoachingModal";
import PremiumGateModal from "../components/PremiumGateModal";
import {
  fetchTtsStatus,
  fetchScriptVoiceLocks,
  lockTtsVoice,
  fetchTtsAudioUrl,
  fetchTroupeTtsAudioUrl,
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


// 👩 10 Profils Vocaux Féminins Locaux (Combinaison unique Voix + Pitch + Rythme)
const LOCAL_FEMALE_PROFILES = [
  { id: "f1", label: "Femme 1 (Aiguë & Dynamique)", pitch: 1.35, rateMul: 1.05 },
  { id: "f2", label: "Femme 2 (Grave & Posée)", pitch: 0.85, rateMul: 0.92 },
  { id: "f3", label: "Femme 3 (Médium & Naturelle)", pitch: 1.05, rateMul: 1.0 },
  { id: "f4", label: "Femme 4 (Aiguë & Rapide)", pitch: 1.45, rateMul: 1.15 },
  { id: "f5", label: "Femme 5 (Douce & Lente)", pitch: 0.95, rateMul: 0.88 },
  { id: "f6", label: "Femme 6 (Théâtrale Expressive)", pitch: 1.25, rateMul: 0.95 },
  { id: "f7", label: "Femme 7 (Très Aiguë & Vive)", pitch: 1.6, rateMul: 1.1 },
  { id: "f8", label: "Femme 8 (Chaleureuse Médium)", pitch: 0.9, rateMul: 0.98 },
  { id: "f9", label: "Femme 9 (Dynamique Aiguë)", pitch: 1.3, rateMul: 1.12 },
  { id: "f10", label: "Femme 10 (Sérieuse & Posée)", pitch: 0.8, rateMul: 0.9 },
];

// 👨 5 Profils Vocaux Masculins Locaux (Combinaison unique Voix + Pitch + Rythme)
const LOCAL_MALE_PROFILES = [
  { id: "m1", label: "Homme 1 (Grave & Clair)", pitch: 0.65, rateMul: 0.95 },
  { id: "m2", label: "Homme 2 (Médium Dynamique)", pitch: 0.95, rateMul: 1.05 },
  { id: "m3", label: "Homme 3 (Très Grave Théâtral)", pitch: 0.5, rateMul: 0.9 },
  { id: "m4", label: "Homme 4 (Jeune & Rythmé)", pitch: 1.1, rateMul: 1.12 },
  { id: "m5", label: "Homme 5 (Chaleureux & Posé)", pitch: 0.75, rateMul: 0.92 },
];

function detectGender(name) {
  if (!name) return "male";
  const lowerName = name.toLowerCase().split("-")[0].trim();
  if (MALE_NAMES.includes(lowerName)) return "male";
  if (FEMALE_NAMES.includes(lowerName)) return "female";
  if (lowerName.endsWith("e") || lowerName.endsWith("a")) return "female";
  return "male";
}

function normalizeStr(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

  // Voix Premium (Google TTS)
  const [premiumLocks, setPremiumLocks] = useState({});
  const [ttsUsage, setTtsUsage] = useState(null);
  const [premiumNotice, setPremiumNotice] = useState("");

  // Voix synthétiques
  const [voices, setVoices] = useState({ male: [], female: [], all: [] });
  const [characterVoices, setCharacterVoices] = useState({});
  const [characterGenders, setCharacterGenders] = useState({});

  // Voix enregistrées
  const [characterRecordings, setCharacterRecordings] = useState({});
  const [replicaRecordings, setReplicaRecordings] = useState({});
  const [voiceMode, setVoiceMode] = useState({});

  // Enregistrement réplique
  const [recordingReplicaId, setRecordingReplicaId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [coachingCharacterId, setCoachingCharacterId] = useState(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Lecture
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rate, setRate] = useState(1);
  const [femalePitch, setFemalePitch] = useState(1.8);
  const [malePitch, setMalePitch] = useState(0.5);

  // Mode italienne
  const [hiddenCharacters, setHiddenCharacters] = useState(new Set());
  const [waitingForClick, setWaitingForClick] = useState(false);

  // UI : Panneau de réglages fermé par défaut
  const [showSettings, setShowSettings] = useState(false);

  // 🔍 Recherche de réplique (#12 ou mot-clé)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSceneKey, setSelectedSceneKey] = useState(null);
  const [isSceneDrawerOpen, setIsSceneDrawerOpen] = useState(false);
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [playingSingleBubble, setPlayingSingleBubble] = useState(null);
  const [tempRevealedReplicas, setTempRevealedReplicas] = useState({});

  // Refs
  const playingRef = useRef(false);
  const waitingRef = useRef(false);
  const currentReplicaRef = useRef(null);
  const singleBubbleRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const audioContextRef = useRef(null);

  // 🚀 CACHE & PRÉCHARGEMENT AUDIO PREMIUM (Optimisation latence entre répliques)
  const ttsCacheRef = useRef({}); // Cache : { [replicaId]: { url, audio, usage } }

  // Charger le statut Premium et/ou les verrous de voix du script (Troupe)
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function loadVoiceLocks() {
      if (isPremium) {
        const res = await fetchTtsStatus(id);
        if (!cancelled && res.ok) {
          setPremiumLocks(res.locks || {});
          setTtsUsage(res.usage || null);
          return;
        }
      }
      // Pour les comptes Standard / Gratuit (ou si la requête serveur échoue) :
      // Récupérer les voix verrouillées par le metteur en scène directement depuis Supabase
      const locks = await fetchScriptVoiceLocks(id);
      if (!cancelled) {
        setPremiumLocks(locks || {});
      }
    }

    loadVoiceLocks();

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
    let active = true;
    async function initRecordings() {
      const dbRecordings = await loadAllReplicaRecordingsDB(id);
      if (active && dbRecordings && Object.keys(dbRecordings).length > 0) {
        setReplicaRecordings(dbRecordings);
      }
    }
    initRecordings();
    return () => {
      active = false;
    };
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
    const timer = setTimeout(() => {
      if (currentReplicaRef.current) {
        currentReplicaRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } else if (currentScript?.replicas?.[currentIndex]) {
        const replicaId = currentScript.replicas[currentIndex].id;
        const el = document.getElementById(`audio-replica-${replicaId}`);
        if (el) {
          el.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [currentIndex, currentScript]);

  const releaseMicrophone = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {}
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    setRecordingReplicaId(null);
  };

  useEffect(() => {
    return () => {
      releaseMicrophone();
      if (audioPlayerRef.current) {
        try {
          audioPlayerRef.current.pause();
        } catch (e) {}
        audioPlayerRef.current = null;
      }
    };
  }, []);

  const startReplicaRecording = async (replicaId) => {
    try {
      releaseMicrophone();

      chunksRef.current = [];
      setRecordingReplicaId(replicaId);
      setRecordingDuration(0);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported) {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/aac")) {
          mimeType = "audio/aac";
        }
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        if (mediaStreamRef.current) {
          try {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          } catch (e) {}
          mediaStreamRef.current = null;
        }
      };

      mediaRecorder.start(250);
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
      console.error("Erreur acces micro:", err);
      alert("Impossible d'accéder au microphone. Vérifiez les autorisations de votre navigateur.");
      releaseMicrophone();
    }
  };

  const stopReplicaRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);
  };

  const saveReplicaRecording = async (replicaId, characterName) => {
    if (!chunksRef.current || chunksRef.current.length === 0) {
      releaseMicrophone();
      return;
    }
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const reader = new FileReader();

    reader.onloadend = () => {
      const newRecording = {
        data: reader.result,
        name: `${characterName} - Réplique`,
        date: new Date().toISOString(),
        duration: recordingDuration,
      };

      const strId = String(replicaId);
      setReplicaRecordings((prev) => {
        const updated = {
          ...prev,
          [strId]: newRecording,
          [replicaId]: newRecording,
        };
        try {
          localStorage.setItem(`replicaRecordings_${id}`, JSON.stringify(updated));
        } catch (e) {
          console.warn("Quota LocalStorage dépassé sur mobile:", e);
        }
        return updated;
      });

      saveReplicaRecordingDB(id, replicaId, newRecording);
      releaseMicrophone();
      chunksRef.current = [];
    };

    reader.readAsDataURL(blob);
  };

  const deleteReplicaRecording = (replicaId) => {
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch (e) {}
      audioPlayerRef.current = null;
    }

    releaseMicrophone();

    const strId = String(replicaId);
    const numId = Number(replicaId);

    setReplicaRecordings((prev) => {
      const updated = { ...prev };
      delete updated[strId];
      if (!isNaN(numId)) delete updated[numId];

      try {
        localStorage.setItem(`replicaRecordings_${id}`, JSON.stringify(updated));
      } catch (e) {
        console.warn("Erreur suppression LocalStorage:", e);
      }
      deleteReplicaRecordingDB(id, replicaId);
      return updated;
    });

    setRecordingReplicaId(null);
  };

  const playReplicaRecording = (replicaId) => {
    return new Promise(async (resolve) => {
      const recording = replicaRecordings[replicaId] || replicaRecordings[String(replicaId)];
      if (!recording?.data) return resolve();

      if (audioPlayerRef.current) {
        try {
          audioPlayerRef.current.pause();
          audioPlayerRef.current.currentTime = 0;
        } catch (e) {}
        audioPlayerRef.current = null;
      }

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

      try {
        await audio.play();
      } catch (e) {
        console.warn("Erreur lecture enregistrement replica:", e);
        audioPlayerRef.current = null;
        resolve();
      }
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

      // Sélection du profil acoustique local (10F / 5M)
      const charIndex = currentScript?.characters?.findIndex((c) => c.id === characterId) || 0;
      if (gender === "female") {
        const profile = LOCAL_FEMALE_PROFILES[charIndex % LOCAL_FEMALE_PROFILES.length];
        utterance.pitch = profile.pitch;
        utterance.rate = rate * profile.rateMul;
      } else {
        const profile = LOCAL_MALE_PROFILES[charIndex % LOCAL_MALE_PROFILES.length];
        utterance.pitch = profile.pitch;
        utterance.rate = rate * profile.rateMul;
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

  // ⚡ PRÉCHARGEMENT DE LA RÉPLIQUE SUIVANTE (Anticipation TTS pour latence 0ms)
  const preloadNextTts = async (nextReplica) => {
    if (!nextReplica || ttsCacheRef.current[nextReplica.id]) return;

    try {
      let res = await fetchTroupeTtsAudioUrl(id, nextReplica.id);
      if (res && res.ok && res.url) {
        const audio = new Audio();
        audio.preload = "auto";
        audio.src = res.url;
        ttsCacheRef.current[nextReplica.id] = { res, audio };
      }
    } catch (e) {
      console.warn("Erreur préchargement TTS:", e);
    }
  };

  // Google Cloud TTS (Premium & Cache Troupe) avec Préchargement
  const speakPremium = async (replicaId) => {
    let cached = ttsCacheRef.current[replicaId];

    if (!cached) {
      // Pour les membres de la troupe (Accès Standard), tente d'abord la récupération en cache
      const res = await fetchTroupeTtsAudioUrl(id, replicaId);
      if (!res.ok) {
        setPremiumNotice(
          "Veuillez vérifier vos voix Premium verrouillées pour ce script."
        );
        return false;
      }
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = res.url;
      cached = { res, audio };
      ttsCacheRef.current[replicaId] = cached;
    }

    setPremiumNotice("");
    if (cached.res?.usage) setTtsUsage(cached.res.usage);

    try {
      await ensureAudioUnlocked();
    } catch (e) {}

    return await new Promise((resolve) => {
      const audio = cached.audio || new Audio(cached.res.url);
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

  const speak = async (text, characterId, replicaId = null, nextReplica = null) => {
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

    // Synergie Troupe & Premium : Si une voix est verrouillée pour ce personnage (par le metteur en scène),
    // lit le fichier audio HD en cache, même pour un comédien au statut Standard
    if (replicaId && premiumLocks[characterId]) {
      if (nextReplica && premiumLocks[nextReplica.character_id]) {
        preloadNextTts(nextReplica);
      }
      const played = await speakPremium(replicaId);
      if (played) return;
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
    if (!displayReplicas || displayReplicas.length === 0) return;

    stop();
    await new Promise((r) => setTimeout(r, 50));

    setIsPlaying(true);
    setPlayingSingleBubble(null);
    playingRef.current = true;
    waitingRef.current = false;
    singleBubbleRef.current = false;

    for (let i = startIndex; i < displayReplicas.length; i++) {
      if (!playingRef.current) break;

      setCurrentIndex(i);
      const replica = displayReplicas[i];
      const nextReplica = displayReplicas[i + 1] || null;

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

      await speak(replica.text, replica.character_id, replica.id, nextReplica);
    }

    setIsPlaying(false);
    playingRef.current = false;
    setWaitingForClick(false);
  };

  const playSingleBubble = async (index) => {
    if (!displayReplicas || displayReplicas.length === 0) return;

    stop();
    await new Promise((r) => setTimeout(r, 50));

    const replica = displayReplicas[index];

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
    const replica = displayReplicas[index];
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
    if (!displayReplicas || displayReplicas.length === 0) return;
    const newIndex = Math.min(
      displayReplicas.length - 1,
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

  // 🔍 Logic de recherche de répliques (#12 ou mot-clé)
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim() || !currentScript?.replicas) return [];
    const query = normalizeStr(searchQuery.trim());
    const numMatch = query.match(/^#?\s*(\d+)$/);
    if (numMatch) {
      const targetNum = parseInt(numMatch[1], 10);
      if (targetNum >= 1 && targetNum <= currentScript.replicas.length) {
        return [targetNum - 1];
      }
    }
    const matches = [];
    currentScript.replicas.forEach((rep, idx) => {
      const charName = currentScript.characters?.find((c) => c.id === rep.character_id)?.name || "";
      const plainText = normalizeStr(stripHtml(rep.text || ""));
      const normCharName = normalizeStr(charName);
      if (plainText.includes(query) || normCharName.includes(query)) {
        matches.push(idx);
      }
    });
    return matches;
  }, [searchQuery, currentScript]);

  useEffect(() => {
    if (searchMatches.length > 0) {
      const targetIdx =
        searchMatches[searchMatchIndex] !== undefined
          ? searchMatches[searchMatchIndex]
          : searchMatches[0];
      if (targetIdx !== undefined && targetIdx >= 0) {
        setCurrentIndex(targetIdx);
      }
    }
  }, [searchMatches, searchMatchIndex]);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setSearchMatchIndex(0);
  };

  const goToNextMatch = () => {
    if (searchMatches.length === 0) return;
    setSearchMatchIndex((prev) => (prev + 1) % searchMatches.length);
  };

  const goToPrevMatch = () => {
    if (searchMatches.length === 0) return;
    setSearchMatchIndex(
      (prev) => (prev - 1 + searchMatches.length) % searchMatches.length
    );
  };

  const replicas = useMemo(() => {
    return currentScript?.replicas || [];
  }, [currentScript]);

  const characters = useMemo(() => {
    return currentScript?.characters || [];
  }, [currentScript]);

  // 📍 Extraction des scènes (Hook exécuté TOUJOURS avant tout retour conditionnel)
  const { hasScenes, scenes } = useMemo(() => {
    return extractScenes(replicas);
  }, [replicas]);

  // 📍 Répliques filtrées selon la scène sélectionnée (Hook exécuté TOUJOURS)
  const displayReplicas = useMemo(() => {
    if (!selectedSceneKey) return replicas;
    return replicas.filter((r) => {
      const key = `${r.act_title || ""}_${r.scene_title || ""}`;
      return key === selectedSceneKey;
    });
  }, [replicas, selectedSceneKey]);

  if (loading || !currentScript) {
    return (
      <div className="flex justify-center py-12 bg-amber-50 min-h-screen">
        <Loader />
      </div>
    );
  }

  const { title } = currentScript;
  const progress =
    displayReplicas.length > 0 ? ((currentIndex + 1) / displayReplicas.length) * 100 : 0;

  const characterPositions = {};
  characters.forEach((char, index) => {
    characterPositions[char.id] = index % 2;
  });

  return (
    <div className="min-h-screen bg-amber-50/60 pb-56 w-full relative">
      {/* 📌 MENU FLOTTANT À GAUCHE POUR LA NAVIGATION PAR SCÈNE (Positionné en bas à gauche, au niveau du menu +) */}
      {hasScenes && (
        <>
          <button
            onClick={() => setIsSceneDrawerOpen(!isSceneDrawerOpen)}
            className="fixed left-0 top-[55%] -translate-y-1/2 z-40 bg-gradient-to-r from-amber-500 to-gold-500 text-black font-extrabold text-xs px-2.5 py-3 rounded-r-xl shadow-2xl border-y border-r border-amber-300 flex items-center gap-1.5 transition-all hover:pl-3 transform hover:scale-105 active:scale-95"
            title="Ouvrir le sommaire des scènes"
          >
            <span className="text-base">📍</span>
            <span className="[writing-mode:vertical-lr] rotate-180 uppercase tracking-widest font-bold">
              Scènes ({scenes.length})
            </span>
          </button>

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
                      setIsSceneDrawerOpen(false);
                      setCurrentIndex(0);
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
                          setIsSceneDrawerOpen(false);
                          const targetIdx = currentScript?.replicas?.findIndex(
                            (r) => r.id === scene.firstReplicaId
                          );
                          if (targetIdx !== undefined && targetIdx >= 0) {
                            setCurrentIndex(targetIdx);
                          }
                          stop();
                          setTimeout(() => {
                            const el = document.getElementById(`scene-header-${scene.firstReplicaId}`) ||
                                       document.getElementById(`audio-replica-${scene.firstReplicaId}`);
                            if (el) {
                              const headerOffset = 130;
                              const elementPosition = el.getBoundingClientRect().top + window.scrollY;
                              window.scrollTo({
                                top: Math.max(0, elementPosition - headerOffset),
                                behavior: "smooth"
                              });
                            }
                          }, 100);
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
      {/* En-tête Sticky Pleine Page */}
      <div className="bg-gradient-to-b from-primary-800 to-primary-900 p-4 shadow-lg sticky top-0 z-30">
        <div className="flex items-center justify-between gap-3 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-1.5 px-3 py-2 bg-black/60 hover:bg-black text-white rounded-xl transition text-xs font-semibold border border-white/20 flex-shrink-0"
            >
              <span className="text-base">←</span>
              <span className="hidden sm:inline">Retour au texte</span>
            </button>

            <div className="min-w-0">
              <h2 className="text-gold-400 text-base sm:text-lg font-bold truncate flex items-center gap-2">
                <span>🔊</span>
                <span>Mode Audio</span>
              </h2>
              <p className="text-gray-300 text-xs truncate">{title}</p>
            </div>
          </div>

          {/* Bouton pour ouvrir/fermer le panneau de réglages des voix */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md border ${
              showSettings
                ? "bg-gold-500 text-black border-gold-400 font-extrabold"
                : "bg-gray-900 text-gold-400 border-gold-500/40 hover:bg-gray-800"
            }`}
          >
            <span className="text-sm">🎙️</span>
            <span>Voix partenaire</span>
            <span className="text-[10px]">{showSettings ? "▲" : "▼"}</span>
          </button>
        </div>

                {/* Barre de progression */}
        <div className="mt-3 w-full max-w-7xl mx-auto">
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-gold-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-gray-300 text-[11px] mt-1 text-center font-mono">
            Réplique {currentIndex + 1} / {displayReplicas.length}
          </p>
        </div>

        {/* 🔍 Barre de recherche de réplique (#12 ou mot-clé) - Fond clair haute visibilité */}
        <div className="mt-2.5 w-full max-w-7xl mx-auto flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">🔍</span>
            <input
              type="text"
              placeholder="Rechercher par # (ex: #12) ou mot-clé..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-9 py-2 bg-white text-gray-900 placeholder-gray-500 text-xs sm:text-sm rounded-xl border-2 border-gold-400 focus:border-gold-500 focus:ring-2 focus:ring-gold-300 focus:outline-none transition shadow-md font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchMatchIndex(0);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs font-bold px-1"
                title="Effacer"
              >
                ✕
              </button>
            )}
          </div>

          {searchQuery && (
            <div className="flex items-center gap-1.5 bg-white text-primary-900 px-3 py-2 rounded-xl border-2 border-gold-400 text-xs font-mono font-bold flex-shrink-0 shadow-md">
              {searchMatches.length > 0 ? (
                <>
                  <span className="text-amber-800 font-extrabold">{searchMatchIndex + 1}/{searchMatches.length}</span>
                  <button
                    onClick={goToPrevMatch}
                    className="px-1 text-gray-700 hover:text-black font-bold transition"
                    title="Précédent"
                  >
                    ▲
                  </button>
                  <button
                    onClick={goToNextMatch}
                    className="px-1 text-gray-700 hover:text-black font-bold transition"
                    title="Suivant"
                  >
                    ▼
                  </button>
                </>
              ) : (
                <span className="text-red-600 font-sans text-xs">0 résultat</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Panneau de configuration des voix (fermé par défaut) */}
      {showSettings && (
        <div className="bg-white border-b-2 border-gold-500/30 p-4 shadow-xl w-full max-w-7xl mx-auto animate-fade-in my-3 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <span>🎙️</span> Configuration des voix du partenaire
            </h3>
            <button
              onClick={() => setShowSettings(false)}
              className="text-xs text-gray-500 hover:text-gray-800 font-bold px-2 py-1 bg-gray-100 rounded-lg"
            >
              ✕ Fermer
            </button>
          </div>

          {isPremium ? (
            <div className="p-3.5 bg-amber-50 border-l-4 border-amber-500 rounded-xl space-y-3">
              <p className="text-xs text-amber-900 font-bold">
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
            <div className="p-3.5 bg-blue-50/80 border-l-4 border-blue-500 rounded-xl space-y-4">
              <p className="text-xs text-blue-900 font-bold">
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
      <div className="p-3 bg-amber-100/90 border-b border-amber-200 w-full max-w-7xl mx-auto rounded-xl my-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-amber-900 font-bold flex items-center gap-1.5">
            <span>🎭</span> Mode italienne : cliquez sur un personnage pour masquer ses répliques
          </p>
          {characters?.length > 0 && (
            <button
              onClick={() => {
                if (isPremium) {
                  setCoachingCharacterId(characters[0].id);
                } else {
                  setShowPremiumModal(true);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold rounded-lg text-xs shadow transition active:scale-95 flex-shrink-0"
              title="Accompagnement Coach IA"
            >
              <span>✨</span>
              <span>Coach IA</span>
            </button>
          )}
        </div>
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

      {/* Liste des répliques - Responsive Full Width */}
      <div className="p-4 space-y-4 w-full max-w-7xl mx-auto">
        {displayReplicas.map((replica, index) => {
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

          const prevReplica = index > 0 ? displayReplicas[index - 1] : null;
          const isNewAct = replica.act_title && replica.act_title !== prevReplica?.act_title;
          const isNewScene = replica.scene_title && replica.scene_title !== prevReplica?.scene_title;

          return (
            <div key={replica.id}>
              {(isNewAct || isNewScene) && (
                <div id={`scene-header-${replica.id}`} className="w-full my-6 text-center animate-fade-in clear-both scroll-mt-32">
                  {isNewAct && (
                    <div className="py-2 px-6 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-white rounded-2xl shadow-lg border border-amber-300/40 inline-block mb-2">
                      <h2 className="text-lg sm:text-xl font-extrabold uppercase tracking-widest font-display">
                        {replica.act_title}
                      </h2>
                    </div>
                  )}
                  {isNewScene && (
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-amber-200 bg-gray-900 px-5 py-1.5 rounded-full border border-amber-500/30 shadow-md inline-block">
                        🎭 {replica.scene_title}
                      </h3>
                    </div>
                  )}
                </div>
              )}
              <AudioBubble
              key={replica.id}
              id={`audio-replica-${replica.id}`}
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
              releaseMicrophone={releaseMicrophone}
            />
            </div>
          );
        })}
      </div>

      {/* 📍 BARRE DE CONTRÔLE AUDIO FIXE EN BAS (STAY CLEAR OF FOOTER NAV ON DESKTOP: bottom-16 md:bottom-20) */}
      <div className="fixed bottom-16 md:bottom-20 left-0 right-0 z-40 bg-white border-t-2 border-gold-500 shadow-[0_-8px_30px_rgba(0,0,0,0.25)] py-2.5 px-4">
        {premiumNotice && (
          <div className="bg-amber-500 text-black px-4 py-1 text-xs font-bold text-center mb-1 rounded-md">
            ⚠️ {premiumNotice}
          </div>
        )}

        <div className="w-full max-w-5xl mx-auto">
          {/* Ligne 1 : Info réplique en cours */}
          <div className="flex items-center justify-between gap-3 mb-1.5 pb-1.5 border-b border-gray-200">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{
                  backgroundColor:
                    characters.find(
                      (c) => c.id === displayReplicas[currentIndex]?.character_id
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
                  : stripHtml(displayReplicas[currentIndex]?.text || "").substring(
                      0,
                      45
                    ) + "..."}
              </p>
            </div>
            <span className="text-gold-600 font-mono font-bold text-xs flex-shrink-0 bg-gold-50 px-2 py-0.5 rounded-md border border-gold-200">
              {currentIndex + 1} / {displayReplicas.length}
            </span>
          </div>

          {/* Ligne 2 : Les 5 boutons de contrôle audio */}
          <div className="flex items-center justify-center gap-3 sm:gap-8">
            {/* 1. Recommencer */}
            <button
              onClick={() => {
                stop();
                setCurrentIndex(0);
                setTimeout(() => playAll(0), 100);
              }}
              className="flex flex-col items-center gap-0.5 p-1.5 text-gray-700 hover:text-gold-600 transition active:scale-95"
              title="Recommencer depuis le début"
            >
              <span className="text-lg sm:text-xl">🔄</span>
              <span className="text-[10px] font-bold">Début</span>
            </button>

            {/* 2. Précédent */}
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className="flex flex-col items-center gap-0.5 p-1.5 text-gray-700 hover:text-gold-600 disabled:opacity-30 transition active:scale-95"
              title="Réplique précédente"
            >
              <span className="text-lg sm:text-xl">⏮️</span>
              <span className="text-[10px] font-bold">Recul</span>
            </button>

            {/* 3. PLAY / PAUSE CENTRAL (GRAND) */}
            <button
              onClick={() => (isPlaying ? stop() : playAll(currentIndex))}
              className={`flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl text-xl sm:text-2xl text-white shadow-lg transition-all transform active:scale-95 ${
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
              className="flex flex-col items-center gap-0.5 p-1.5 text-gray-700 hover:text-gold-600 disabled:opacity-30 transition active:scale-95"
              title="Réplique suivante"
            >
              <span className="text-lg sm:text-xl">⏭️</span>
              <span className="text-[10px] font-bold">Avance</span>
            </button>

            {/* 5. Arrêter */}
            <button
              onClick={stop}
              className="flex flex-col items-center gap-0.5 p-1.5 text-red-600 hover:text-red-700 transition active:scale-95"
              title="Arrêter la lecture"
            >
              <span className="text-lg sm:text-xl">⏹️</span>
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
      id,
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
      releaseMicrophone,
    },
    ref
  ) => {
    const bubbleColor = character?.color || "#6B7280";

    return (
      <div
        ref={ref}
        id={id || `audio-replica-${replica?.id}`}
        className={`p-4 sm:p-5 rounded-2xl transition-all duration-300 shadow-md ${
          isRight ? "ml-auto max-w-[85%] sm:max-w-[75%]" : "mr-auto max-w-[85%] sm:max-w-[75%]"
        } ${
          isCurrent
            ? "ring-4 ring-gold-500 shadow-xl scale-[1.01]"
            : "opacity-90 hover:opacity-100"
        }`}
        style={{
          backgroundColor: bubbleColor,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs sm:text-sm font-bold text-white/90">
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
                  🎭 C'est votre tour !
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
            <p className="text-white text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
              {stripHtml(replica.text)}
            </p>

            <div className="flex justify-end mt-3 pt-3 border-t border-white/20">
              {isBubblePlaying ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStop();
                  }}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs sm:text-sm font-bold transition active:scale-95 shadow-md"
                >
                  ⏹️ Arrêter
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay();
                  }}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white/25 hover:bg-white/35 text-white rounded-full text-xs sm:text-sm font-bold transition active:scale-95 shadow-md"
                >
                  ▶️ Écouter {hasRecording && "🎙️"}
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/20">
              {(replicaRecordings[replica.id] || replicaRecordings[String(replica.id)]) ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); playReplicaRecording(replica.id); }}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow-md transition active:scale-95"
                  >
                    ▶️ Prise
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteReplicaRecording(replica.id); }}
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
                  onClick={(e) => { e.stopPropagation(); startReplicaRecording(replica.id); }}
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
