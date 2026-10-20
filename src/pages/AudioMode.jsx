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

// ==========================================
// INDEXEDDB DATABASE HELPERS (PERMANENT INTER-SESSION STORAGE)
// ==========================================
const IDB_NAME = "ReplicoachAudioDB";
const IDB_VERSION = 1;
const IDB_STORE = "replica_takes";

function openAudioDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject("IndexedDB not supported");
    }
    const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveTakeToIDB(scriptId, replicaId, takeNum, blob, characterName, duration) {
  try {
    const db = await openAudioDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const item = {
      id: ,
      scriptId,
      replicaId,
      takeNum,
      blob,
      characterName,
      date: new Date().toISOString(),
      duration,
    };
    store.put(item);
    return new Promise((res, rej) => {
      tx.oncomplete = () => res(item);
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error("IndexedDB save error:", err);
  }
}

async function loadTakesFromIDB(scriptId) {
  try {
    const db = await openAudioDB();
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const request = store.getAll();
    return new Promise((res, rej) => {
      request.onsuccess = () => {
        const items = request.result || [];
        const scriptItems = items.filter((it) => it.scriptId === scriptId);
        const map = {};
        scriptItems.forEach((it) => {
          if (!map[it.replicaId]) map[it.replicaId] = [];
          const url = URL.createObjectURL(it.blob);
          map[it.replicaId].push({
            id: it.id,
            takeNum: it.takeNum,
            blob: it.blob,
            url,
            date: it.date,
            duration: it.duration,
            characterName: it.characterName,
          });
        });
        Object.keys(map).forEach((rId) => {
          map[rId].sort((a, b) => a.takeNum - b.takeNum);
        });
        res(map);
      };
      request.onerror = () => rej(request.error);
    });
  } catch (err) {
    console.error("IndexedDB load error:", err);
    return {};
  }
}

async function deleteTakeFromIDB(scriptId, replicaId, takeNum) {
  try {
    const db = await openAudioDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    store.delete();
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error("IndexedDB delete error:", err);
  }
}

function cleanTextForSpeech(text) {
  if (!text) return "";
  let cleaned = text.replace(/<[^>]*>/g, " ");
  cleaned = cleaned.replace(/\([^)]*\)/g, " ");
  cleaned = cleaned.replace(/\[[^\]]*\]/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

function stripHtml(html) {
  if (!html) return "";
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function AudioMode() {
  const { id } = useParams();
  const { user, isPremium } = useAuthStore();
  const { currentScript, loading, error, fetchScript } = useScriptStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [waitingForClick, setWaitingForClick] = useState(false);
  const [rate, setRate] = useState(1);
  const [voices, setVoices] = useState({ male: [], female: [], all: [] });
  const [characterVoices, setCharacterVoices] = useState({});
  const [voiceMode, setVoiceMode] = useState({});
  const [myCharacterId, setMyCharacterId] = useState(null);
  const [tempRevealedReplicas, setTempRevealedReplicas] = useState({});

  const [characterRecordings, setCharacterRecordings] = useState({});
  const [replicaRecordings, setReplicaRecordings] = useState({});
  const [recordingReplicaId, setRecordingReplicaId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const [premiumLocks, setPremiumLocks] = useState({});
  const [premiumNotice, setPremiumNotice] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const currentReplicaRef = useRef(null);
  const preloadedAudioRef = useRef({});

  // CHARGEMENT DES PRISES AUDIO ENREGISTRÉES DEPUIS INDEXEDDB
  useEffect(() => {
    if (!id) return;
    loadTakesFromIDB(id).then((map) => {
      setReplicaRecordings(map);
    });
  }, [id]);

  useEffect(() => {
    if (!currentScript || currentScript.id !== id) {
      fetchScript(id);
    }
  }, [id, currentScript, fetchScript]);

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
    if (isPremium && id) {
      fetchTtsStatus(id).then((res) => {
        if (res.ok) setPremiumLocks(res.locks || {});
      });
    }
  }, [isPremium, id]);

  const handleLockVoice = async (characterId, voiceName) => {
    const res = await lockTtsVoice(id, characterId, voiceName);
    if (res.ok || res.code === "already_locked") {
      const status = await fetchTtsStatus(id);
      if (status.ok) setPremiumLocks(status.locks || {});
    }
    return res;
  };

  useEffect(() => {
    if (currentScript?.characters && voices.all.length > 0) {
      const autoVoices = { ...characterVoices };
      const autoModes = { ...voiceMode };

      currentScript.characters.forEach((char) => {
        if (!characterVoices[char.id]) {
          const charName = char.name.toLowerCase();
          const isFemale =
            charName.includes("elle") ||
            charName.includes("femme") ||
            charName.endsWith("e");
          const pool = isFemale ? voices.female : voices.male;
          autoVoices[char.id] = pool[0]?.name || voices.all[0]?.name || "";
        }

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

  // FONCTION DECLENCHEMENT ENREGISTREMENT MICRO
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
            stopAndSaveReplicaRecording(replicaId, "Inconnu");
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

  // FLUX 1-CLIC : FERMETURE MICRO + SAUVEGARDE DANS INDEXEDDB
  const stopAndSaveReplicaRecording = async (replicaId, characterName) => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }

    setTimeout(async () => {
      if (chunksRef.current.length === 0) {
        setRecordingReplicaId(null);
        return;
      }

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const currentTakes = replicaRecordings[replicaId] || [];
      const nextTakeNum = currentTakes.length >= 1 ? 2 : 1;

      await saveTakeToIDB(
        id,
        replicaId,
        nextTakeNum,
        blob,
        characterName,
        recordingDuration
      );

      const updatedMap = await loadTakesFromIDB(id);
      setReplicaRecordings(updatedMap);

      setRecordingReplicaId(null);
      chunksRef.current = [];
    }, 200);
  };

  const deleteReplicaRecording = async (replicaId, takeNum = 1) => {
    await deleteTakeFromIDB(id, replicaId, takeNum);
    const updatedMap = await loadTakesFromIDB(id);
    setReplicaRecordings(updatedMap);
  };

  const playReplicaRecording = (replicaId, takeIndex = 0) => {
    return new Promise(async (resolve) => {
      const takes = replicaRecordings[replicaId] || [];
      const take = takes[takeIndex] || takes[0];
      if (!take?.url) return resolve();

      try {
        await ensureAudioUnlocked();
      } catch (e) {}

      const audio = new Audio(take.url);
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

  const ensureAudioUnlocked = () => {
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.resume();
      }
      resolve();
    });
  };

  const speakSynth = async (text, characterId) => {
    await ensureAudioUnlocked();
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        return resolve();
      }

      window.speechSynthesis.cancel();
      const cleaned = cleanTextForSpeech(text);
      if (!cleaned) return resolve();

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.rate = rate;
      utterance.lang = "fr-FR";

      const voiceName = characterVoices[characterId];
      if (voiceName) {
        const selectedVoice = voices.all.find((v) => v.name === voiceName);
        if (selectedVoice) utterance.voice = selectedVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    });
  };

  const speakRecorded = async (characterId) => {
    const rec = characterRecordings[characterId];
    if (!rec?.audioUrl) return;

    await ensureAudioUnlocked();

    return new Promise((resolve) => {
      const audio = new Audio(rec.audioUrl);
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

  const speakPremium = async (replicaId) => {
    try {
      if (preloadedAudioRef.current[replicaId]) {
        const audio = preloadedAudioRef.current[replicaId];
        delete preloadedAudioRef.current[replicaId];
        audioPlayerRef.current = audio;
        audio.playbackRate = rate;

        return new Promise((resolve) => {
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
      }

      const res = await fetchTtsAudioUrl(id, replicaId);
      if (!res.ok || !res.audioUrl) return false;

      const audio = new Audio(res.audioUrl);
      audioPlayerRef.current = audio;
      audio.playbackRate = rate;

      return new Promise((resolve) => {
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
    } catch (e) {
      return false;
    }
  };

  const preloadNextTts = async (nextReplica) => {
    if (!nextReplica?.id) return;
    try {
      const res = await fetchTtsAudioUrl(id, nextReplica.id);
      if (res.ok && res.audioUrl) {
        const audio = new Audio(res.audioUrl);
        audio.preload = "auto";
        preloadedAudioRef.current[nextReplica.id] = audio;
      }
    } catch (e) {}
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

    // SI LE COMÉDIEN A ENREGISTRÉ SA VOIX SUR CETTE RÉPLIQUE
    if (replicaId && replicaRecordings[replicaId]?.length > 0) {
      return await playReplicaRecording(replicaId, 0);
    }

    const mode = voiceMode[characterId] || "synth";
    if (mode === "recorded" && characterRecordings[characterId]?.audioUrl) {
      return await speakRecorded(characterId);
    }

    if (isPremium) {
      if (replicaId && premiumLocks[characterId]) {
        if (nextReplica && premiumLocks[nextReplica.character_id]) {
          preloadNextTts(nextReplica);
        }

        const played = await speakPremium(replicaId);
        if (played) return;
      }
      setPremiumNotice(
        "Veuillez sélectionner et verrouiller une voix Premium pour ce personnage."
      );
      return;
    }

    if (!cleanedForDecision) return;
    await speakSynth(text, characterId);
  };

  const stop = () => {
    setIsPlaying(false);
    setWaitingForClick(false);
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
  };

  const playAll = async (startIndex = currentIndex) => {
    const replicas = currentScript?.replicas || [];
    if (replicas.length === 0) return;

    setIsPlaying(true);
    setWaitingForClick(false);

    for (let i = startIndex; i < replicas.length; i++) {
      setCurrentIndex(i);
      const replica = replicas[i];
      const isMyRole = myCharacterId && replica.character_id === myCharacterId;

      if (isMyRole) {
        setWaitingForClick(true);
        setIsPlaying(false);
        return;
      }

      const nextReplica = replicas[i + 1] || null;
      await speak(replica.text, replica.character_id, replica.id, nextReplica);

      if (!isPlaying) break;
    }

    setIsPlaying(false);
  };

  const goToNext = () => {
    const replicas = currentScript?.replicas || [];
    if (currentIndex < replicas.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      if (isPlaying) {
        stop();
        setTimeout(() => playAll(nextIndex), 100);
      }
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      if (isPlaying) {
        stop();
        setTimeout(() => playAll(prevIndex), 100);
      }
    }
  };

  const playSingleBubble = async (index) => {
    const replicas = currentScript?.replicas || [];
    const replica = replicas[index];
    if (!replica) return;

    stop();
    setCurrentIndex(index);
    const nextReplica = replicas[index + 1] || null;
    await speak(replica.text, replica.character_id, replica.id, nextReplica);
  };

  const stopSingleBubble = () => {
    stop();
  };

  const onBubbleClick = (index) => {
    const replicas = currentScript?.replicas || [];
    const replica = replicas[index];
    if (!replica) return;

    if (waitingForClick && index === currentIndex) {
      setWaitingForClick(false);
      setTempRevealedReplicas((prev) => ({ ...prev, [replica.id]: true }));

      const nextIndex = index + 1;
      if (nextIndex < replicas.length) {
        setTimeout(() => playAll(nextIndex), 300);
      }
    } else {
      playSingleBubble(index);
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

  const { title, characters = [], replicas = [] } = currentScript;

  return (
    <div className="pb-36 min-h-screen bg-gray-950 text-white">
      {/* En-tête de navigation */}
      <div className="bg-gray-900 border-b border-gray-800 p-4 sticky top-0 z-30 shadow-lg">
        <div className="flex items-center justify-between gap-4 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Link
              to={}
              className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition font-bold"
            >
              ←
            </Link>
            <div>
              <h1 className="text-lg font-bold text-amber-400 truncate max-w-[200px] sm:max-w-md">
                {title}
              </h1>
              <p className="text-xs text-gray-400">Mode Lecture Audio</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-bold hidden xs:inline">Vitesse</span>
            <select
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
              className="bg-gray-800 text-amber-400 border border-gray-700 rounded-xl px-2 py-1 text-xs font-bold font-mono focus:outline-none focus:border-amber-400"
            >
              <option value="0.75">0.75x</option>
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Sélection rôle */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 shadow-xl">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            🎭 Sélectionnez votre rôle (masquage automatique) :
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setMyCharacterId(null)}
              className={}
            >
              Spectateur (Aucun)
            </button>
            {characters.map((char) => (
              <button
                key={char.id}
                onClick={() => setMyCharacterId(char.id)}
                className={}
              >
                {char.name}
              </button>
            ))}
          </div>
        </div>

        {/* Sélection des Voix */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 shadow-xl space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            🎙️ Voix des comédiens partenaires :
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {characters.map((char) => {
              const currentMode = voiceMode[char.id] || "synth";
              const hasRecorded = !!characterRecordings[char.id]?.audioUrl;

              return (
                <div
                  key={char.id}
                  className="bg-gray-800/80 p-3 rounded-xl border border-gray-700 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: char.color || "#D97706" }}
                      />
                      <span className="font-bold text-xs text-white truncate">
                        {char.name}
                      </span>
                    </div>

                    <select
                      value={currentMode}
                      onChange={(e) =>
                        setVoiceMode((prev) => ({
                          ...prev,
                          [char.id]: e.target.value,
                        }))
                      }
                      className="bg-gray-900 text-xs font-bold text-amber-400 border border-gray-700 rounded-lg px-2 py-1"
                    >
                      <option value="synth">🗣️ Voix Web</option>
                      {hasRecorded && (
                        <option value="recorded">🎙️ Enregistrement studio</option>
                      )}
                    </select>
                  </div>

                  {currentMode === "synth" && (
                    <div className="space-y-1 pt-1">
                      {isPremium ? (
                        <PremiumVoicePicker
                          scriptId={id}
                          characterId={char.id}
                          characterName={char.name}
                          lockedVoiceName={premiumLocks[char.id]}
                          onLockVoice={(voiceName) =>
                            handleLockVoice(char.id, voiceName)
                          }
                        />
                      ) : (
                        <select
                          value={characterVoices[char.id] || ""}
                          onChange={(e) =>
                            setCharacterVoices((prev) => ({
                              ...prev,
                              [char.id]: e.target.value,
                            }))
                          }
                          className="w-full bg-gray-900 text-xs text-gray-300 border border-gray-700 rounded-lg p-1.5 truncate"
                        >
                          {voices.all.map((v) => (
                            <option key={v.name} value={v.name}>
                              {v.name} ({v.lang})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Liste des bulles de répliques */}
        <div className="space-y-4 pt-2">
          {replicas.map((replica, index) => {
            const char = characters.find((c) => c.id === replica.character_id);
            const isRight = char?.id === myCharacterId;
            const isCurrent = index === currentIndex;
            const isHidden = myCharacterId && replica.character_id === myCharacterId;
            const isBubblePlaying = isPlaying && isCurrent;
            const isWaitingOnThis = waitingForClick && isCurrent;
            const hasRecording = (replicaRecordings[replica.id] || []).length > 0;

            return (
              <AudioBubble
                key={replica.id}
                ref={isCurrent ? currentReplicaRef : null}
                replica={replica}
                character={char}
                isRight={isRight}
                isCurrent={isCurrent}
                isHidden={isHidden}
                isTemporarilyRevealed={!!tempRevealedReplicas[replica.id]}
                isWaiting={isWaitingOnThis}
                isBubblePlaying={isBubblePlaying}
                hasRecording={hasRecording}
                onBubbleClick={() => onBubbleClick(index)}
                onPlay={() => playSingleBubble(index)}
                onStop={stopSingleBubble}
                replicaRecordings={replicaRecordings}
                recordingReplicaId={recordingReplicaId}
                recordingDuration={recordingDuration}
                startReplicaRecording={startReplicaRecording}
                stopReplicaRecording={stopReplicaRecording}
                stopAndSaveReplicaRecording={stopAndSaveReplicaRecording}
                deleteReplicaRecording={deleteReplicaRecording}
                playReplicaRecording={playReplicaRecording}
              />
            );
          })}
        </div>
      </div>

      {/* BARRE FIXE PLAYER AUDIO */}
      <div className="fixed bottom-16 md:bottom-20 left-0 right-0 z-40 bg-white border-t-2 border-gold-500 shadow-[0_-8px_30px_rgba(0,0,0,0.25)] py-2.5 px-4">
        {premiumNotice && (
          <div className="bg-amber-500 text-black px-4 py-1 text-xs font-bold text-center mb-1 rounded-md">
            ⚠️ {premiumNotice}
          </div>
        )}

        <div className="w-full max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-1.5 pb-1.5 border-b border-gray-200">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-full shrink-0"
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
                  : stripHtml(replicas[currentIndex]?.text || "").substring(
                      0,
                      45
                    ) + "..."}
              </p>
            </div>
            <span className="text-amber-700 font-mono font-bold text-xs shrink-0 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              {currentIndex + 1} / {replicas.length}
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 sm:gap-8">
            <button
              onClick={() => {
                stop();
                setCurrentIndex(0);
                setTimeout(() => playAll(0), 100);
              }}
              className="flex flex-col items-center gap-0.5 p-1.5 text-gray-700 hover:text-amber-600 transition active:scale-95"
              title="Recommencer depuis le début"
            >
              <span className="text-lg sm:text-xl">🔄</span>
              <span className="text-[10px] font-bold">Début</span>
            </button>

            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className="flex flex-col items-center gap-0.5 p-1.5 text-gray-700 hover:text-amber-600 disabled:opacity-30 transition active:scale-95"
              title="Réplique précédente"
            >
              <span className="text-lg sm:text-xl">⏮️</span>
              <span className="text-[10px] font-bold">Recul</span>
            </button>

            <button
              onClick={() => (isPlaying ? stop() : playAll(currentIndex))}
              className={}
              title={isPlaying ? "Mettre en pause" : "Lancer la lecture"}
            >
              {isPlaying ? "⏸️" : "▶️"}
            </button>

            <button
              onClick={goToNext}
              disabled={currentIndex === replicas.length - 1}
              className="flex flex-col items-center gap-0.5 p-1.5 text-gray-700 hover:text-amber-600 disabled:opacity-30 transition active:scale-95"
              title="Réplique suivante"
            >
              <span className="text-lg sm:text-xl">⏭️</span>
              <span className="text-[10px] font-bold">Avance</span>
            </button>

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
      character,
      isRight,
      isCurrent,
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
      stopAndSaveReplicaRecording,
      deleteReplicaRecording,
      playReplicaRecording,
    },
    ref
  ) => {
    const bubbleColor = character?.color || "#6B7280";
    const takes = replicaRecordings[replica.id] || [];

    return (
      <div
        ref={ref}
        className={}
        style={{ backgroundColor: bubbleColor }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs sm:text-sm font-bold text-white/90">
            {character?.name || "Personnage"}
          </span>
          <span className="text-[10px] text-white/70 font-mono">
            #{replica.display_order || replica.order_index || "-"}
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

            {/* BARRE D'ENREGISTREMENT ET DE COMPARAISON DES 2 PRISES */}
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/20">
              {recordingReplicaId === replica.id ? (
                <div className="w-full flex items-center justify-between bg-red-950/80 border border-red-500/50 rounded-xl px-3 py-2">
                  <span className="text-red-300 font-bold animate-pulse flex items-center gap-2 text-xs">
                    🔴 Enregistrement : {recordingDuration}s
                  </span>
                  <button
                    onClick={() =>
                      stopAndSaveReplicaRecording(
                        replica.id,
                        character?.name || "Inconnu"
                      )
                    }
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-md transition active:scale-95"
                  >
                    ⏹️ Valider
                  </button>
                </div>
              ) : (
                <>
                  {/* AFFICHAGE DES PRISES EXISTANTES (MAX 2) */}
                  {takes.map((take, tIdx) => (
                    <div key={take.id || tIdx} className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-white/20">
                      <button
                        onClick={() => playReplicaRecording(replica.id, tIdx)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-bold shadow-sm transition active:scale-95"
                        title={}
                      >
                        ▶️ Prise {tIdx + 1}
                      </button>
                      <button
                        onClick={() => deleteReplicaRecording(replica.id, take.takeNum)}
                        className="px-1.5 py-1 bg-red-600/80 hover:bg-red-600 text-white rounded-md text-xs transition active:scale-95"
                        title="Supprimer cette prise"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}

                  {/* BOUTON D'ENREGISTREMENT (SI MOINS DE 2 PRISES) */}
                  {takes.length < 2 && (
                    <button
                      onClick={() => startReplicaRecording(replica.id)}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-lg text-xs shadow-md transition active:scale-95"
                    >
                      🎙️ {takes.length === 1 ? "Prise 2" : "Enregistrer"}
                    </button>
                  )}
                </>
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
