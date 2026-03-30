import { useEffect, useState, useRef, forwardRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useScriptStore } from "../store/scriptStore";
import { useAuthStore } from "../store/authStore";
import {
  fetchCharacterRecordings,
  uploadCharacterRecording,
  deleteCharacterRecording,
  supabase,
} from "../lib/supabase";
import Loader from "../components/ui/Loader";

// Prénoms pour détection du genre
const MALE_NAMES = [
  "maurice",
  "jean",
  "christophe",
  "pierre",
  "paul",
  "jacques",
  "michel",
  "philippe",
  "alain",
  "bernard",
  "françois",
  "patrick",
  "daniel",
  "nicolas",
  "marc",
  "david",
  "thomas",
  "louis",
  "antoine",
  "charles",
  "henri",
  "robert",
];

const FEMALE_NAMES = [
  "valérie",
  "fabienne",
  "audrey",
  "marie",
  "anne",
  "sophie",
  "christine",
  "nathalie",
  "isabelle",
  "catherine",
  "sylvie",
  "martine",
  "françoise",
  "claire",
  "julie",
  "céline",
  "amavi",
  "laura",
  "emma",
  "léa",
  "sarah",
];

function detectGender(name) {
  const lowerName = name.toLowerCase().split("-")[0].trim();
  if (MALE_NAMES.includes(lowerName)) return "male";
  if (FEMALE_NAMES.includes(lowerName)) return "female";
  if (lowerName.endsWith("e") || lowerName.endsWith("a")) return "female";
  return "male";
}

// Supprimer les balises HTML pour l'affichage (sans autres transformations)
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

// Nettoyer le texte pour la lecture audio
function cleanTextForSpeech(text) {
  if (!text) return "";
  // Supprimer les balises HTML et décoder les entités si possible
  try {
    if (typeof document !== "undefined") {
      const tmp = document.createElement("div");
      tmp.innerHTML = text;
      // Decodage des entités HTML
      text = tmp.textContent || tmp.innerText || text;
      // Si le texte contient encore des chevrons (ex: "&lt;mark&gt;...&lt;/mark&gt;" décodés en texte), supprimer les balises restantes
      text = text.replace(/<[^>]+>/g, " ");
    } else {
      // fallback: simple suppression des balises
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
    .replace(/^['"«»']+|['"«»']+$/g, "")
    .replace(/\.{4,}/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

function isMobile() {
  return window.innerWidth < 768;
}

function AudioMode() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const { currentScript, loading, fetchScript } = useScriptStore();

  // Voix synthétiques
  const [voices, setVoices] = useState({ male: [], female: [], all: [] });
  const [characterVoices, setCharacterVoices] = useState({});
  const [characterGenders, setCharacterGenders] = useState({});

  // Voix enregistrées
  const [characterRecordings, setCharacterRecordings] = useState({}); // { charId: { audioPath, audioUrl } }
  const [replicaRecordings, setReplicaRecordings] = useState({}); // { replicaId: { data, name, date } }
  const [voiceMode, setVoiceMode] = useState({}); // { charId: 'synth' | 'recorded' }
  const [recordingCharacter, setRecordingCharacter] = useState(null); // Personnage en cours d'enregistrement
  const [isRecording, setIsRecording] = useState(false);
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

  // UI
  const [showSettings, setShowSettings] = useState(!isMobile());
  const [playingSingleBubble, setPlayingSingleBubble] = useState(null);
  const [savingRecording, setSavingRecording] = useState(false);
  const [tempRevealedReplicas, setTempRevealedReplicas] = useState({});

  // Refs
  const playingRef = useRef(false);
  const waitingRef = useRef(false);
  const currentReplicaRef = useRef(null);
  const singleBubbleRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const audioContextRef = useRef(null);

  // Charger le script
  useEffect(() => {
    if (!currentScript || currentScript.id !== id) {
      fetchScript(id);
    }
  }, [id, currentScript, fetchScript]);

  // Mode dev: injection d'un script mock si `?devMock=1` présent dans l'URL.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("devMock") === "1") {
        const mock = {
          id: "dev-mock",
          title: "Script de test (mock)",
          characters: [
            { id: "c1", name: "Le Brigadier", color: "#7f1d1d" },
            { id: "c2", name: "Adjudant", color: "#374151" },
          ],
          replicas: [
            {
              id: "r1",
              character_id: "c1",
              text: "Tout de suite, adjudant-chef.",
              order_index: 0,
            },
            {
              id: "r2",
              character_id: "c2",
              text: "Faites votre rapport, brigadière Robert...",
              order_index: 1,
            },
            { id: "r3", character_id: "c1", text: "Merci.", order_index: 2 },
          ],
        };

        // Injecter directement dans le store pour simplifier les tests locaux.
        if (useScriptStore && typeof useScriptStore.setState === "function") {
          useScriptStore.setState({ currentScript: mock, loading: false });
        }
      }
    } catch (e) {
      // noop
    }
  }, []);

  // Dans le useEffect de chargement, charger les enregistrements par réplique depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`replicaRecordings_${id}`);
    if (saved) {
      try {
        setReplicaRecordings(JSON.parse(saved));
      } catch (e) {
        console.warn(
          "Impossible de parser replicaRecordings depuis localStorage",
          e,
        );
      }
    }
  }, [id]);

  // Charger les voix synthétiques
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      const frenchVoices = availableVoices.filter((v) =>
        v.lang.startsWith("fr"),
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
            !v.name.toLowerCase().includes("marie")),
      );

      const femaleVoices = voicesToUse.filter(
        (v) =>
          v.name.toLowerCase().includes("female") ||
          v.name.toLowerCase().includes("femme") ||
          v.name.toLowerCase().includes("julie") ||
          v.name.toLowerCase().includes("marie") ||
          v.name.toLowerCase().includes("hortense") ||
          v.name.toLowerCase().includes("amélie"),
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
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Charger les enregistrements existants
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
        // Générer l'URL signée pour l'audio
        const { data } = await supabase.storage
          .from("audio-recordings")
          .createSignedUrl(rec.audio_path, 3600); // 1h

        recordingsMap[rec.character_id] = {
          audioPath: rec.audio_path,
          audioUrl: data?.signedUrl,
        };
        modeMap[rec.character_id] = "recorded"; // Par défaut utiliser l'enregistrement si dispo
      }

      setCharacterRecordings(recordingsMap);
      setVoiceMode((prev) => ({ ...prev, ...modeMap }));
    } catch (err) {
      console.error("Error loading recordings:", err);
    }
  };

  // Assigner voix synthétiques automatiquement
  useEffect(() => {
    if (currentScript?.characters && voices.all?.length > 0) {
      const autoVoices = {};
      const autoModes = {};

      currentScript.characters.forEach((char) => {
        autoVoices[char.id] = voices.all[0]?.name;
        // Si pas d'enregistrement, utiliser synth par défaut
        if (!voiceMode[char.id]) {
          autoModes[char.id] = "synth";
        }
      });

      setCharacterVoices(autoVoices);
      setVoiceMode((prev) => ({ ...autoModes, ...prev }));
    }
  }, [currentScript, voices]);

  // Scroll vers réplique en cours
  useEffect(() => {
    if (currentReplicaRef.current && isPlaying) {
      currentReplicaRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentIndex, isPlaying]);

  // ==================== ENREGISTREMENT ====================

  const startRecording = async (charId) => {
    try {
      chunksRef.current = [];
      setRecordingCharacter(charId);
      setRecordingDuration(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => {
          if (d >= 30) {
            // Max 30 secondes
            stopRecording();
            return d;
          }
          return d + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Error starting recording:", err);
      alert("Impossible d'accéder au microphone. Vérifiez les permissions.");
      setRecordingCharacter(null);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const saveRecording = async () => {
    if (chunksRef.current.length === 0 || !recordingCharacter || !user) return;

    setSavingRecording(true);

    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      await uploadCharacterRecording(blob, recordingCharacter, user.id);

      // Recharger les enregistrements
      await loadRecordings();

      setRecordingCharacter(null);
      setShowVoiceRecorder(false);
      chunksRef.current = [];
    } catch (err) {
      console.error("Error saving recording:", err);
      alert("Erreur lors de la sauvegarde: " + err.message);
    }

    setSavingRecording(false);
  };

  const cancelRecording = () => {
    if (isRecording) {
      stopRecording();
    }
    setRecordingCharacter(null);
    chunksRef.current = [];
  };

  // Enregistrer pour une réplique spécifique
  const [recordingReplicaId, setRecordingReplicaId] = useState(null);

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
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
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
      } catch (e) {
        // ignore
      }

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

  const deleteRecording = async (charId) => {
    if (!confirm("Supprimer cet enregistrement ?")) return;

    try {
      await deleteCharacterRecording(charId, user.id);

      setCharacterRecordings((prev) => {
        const newRec = { ...prev };
        delete newRec[charId];
        return newRec;
      });

      setVoiceMode((prev) => ({ ...prev, [charId]: "synth" }));
    } catch (err) {
      console.error("Error deleting recording:", err);
    }
  };

  // ==================== LECTURE ====================

  // Lecture avec synthèse vocale
  const speakSynth = async (text, characterId) => {
    await ensureAudioUnlocked();

    return new Promise((resolve) => {
      const originalText = text;
      const cleanedText = cleanTextForSpeech(text);

      // Log temporaire pour debug local : montrer ce qui est réellement envoyé au TTS
      try {
        // eslint-disable-next-line no-console
        console.log("TTS text:", {
          original: originalText,
          cleaned: cleanedText,
        });
      } catch (e) {}

      if (!cleanedText) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanedText);

      const character = currentScript?.characters?.find(
        (c) => c.id === characterId,
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

  // Lecture avec enregistrement
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

  // Ensure audio is unlocked (resume AudioContext / prime speechSynthesis)
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
          } catch (e) {
            // ignore
          }
        }

        // Play a tiny silent buffer to fully unlock audio on some mobiles
        try {
          const buffer = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          src.connect(ctx.destination);
          try {
            src.start(0);
          } catch (e) {
            // ignore
          }
        } catch (e) {
          // ignore
        }
      }

      if (speechSynthesis && typeof speechSynthesis.getVoices === "function") {
        // Prime TTS voices
        speechSynthesis.getVoices();
      }

      setAudioUnlocked(true);
    } catch (e) {
      console.warn("Error unlocking audio:", e);
    }
  };

  // Fonction speak unifiée
  // Fonction speak unifiée: priorise enregistrement par réplique, puis par personnage, sinon TTS
  const speak = async (text, characterId, replicaId = null) => {
    // Nettoyer systématiquement le texte destiné au TTS (debug + robustesse)
    const cleanedForDecision = cleanTextForSpeech(text || "");

    // Log pour debug local
    try {
      // eslint-disable-next-line no-console
      console.log("speak() called:", {
        original: text,
        cleaned: cleanedForDecision,
        characterId,
        replicaId,
      });
    } catch (e) {}

    // 1) Enregistrement par réplique (local)
    if (replicaId && replicaRecordings[replicaId]?.data) {
      return await playReplicaRecording(replicaId);
    }

    // 2) Enregistrement par personnage (remote)
    const mode = voiceMode[characterId] || "synth";
    if (mode === "recorded" && characterRecordings[characterId]?.audioUrl) {
      return await speakRecorded(characterId);
    }

    // 3) Synthèse vocale — passer le texte nettoyé
    return await speakSynth(cleanedForDecision, characterId);
  };

  // Test voix synthétique
  const testVoice = (gender) => {
    speechSynthesis.cancel();
    const testText =
      gender === "female"
        ? "Bonjour, je suis une voix féminine."
        : "Bonjour, je suis une voix masculine.";

    const utterance = new SpeechSynthesisUtterance(testText);
    utterance.lang = "fr-FR";
    utterance.pitch = gender === "female" ? femalePitch : malePitch;
    utterance.rate = rate;

    if (voices.all?.length > 0) {
      utterance.voice = voices.all[0];
    }

    speechSynthesis.speak(utterance);
  };

  // Test enregistrement
  const testRecording = (charId) => {
    const recording = characterRecordings[charId];
    if (!recording?.audioUrl) return;

    const audio = new Audio(recording.audioUrl);
    audio.play();
  };

  // Lecture continue
  const playAll = async (startIndex = currentIndex) => {
    if (!currentScript?.replicas) return;

    setIsPlaying(true);
    setPlayingSingleBubble(null);
    playingRef.current = true;
    waitingRef.current = false;
    singleBubbleRef.current = false;

    for (let i = startIndex; i < currentScript.replicas.length; i++) {
      if (!playingRef.current) break;

      setCurrentIndex(i);
      const replica = currentScript.replicas[i];

      // Mode italienne
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

  // Lecture d'une seule bulle
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
    speechSynthesis.cancel();
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setPlayingSingleBubble(null);
    singleBubbleRef.current = false;
  };

  const stop = () => {
    speechSynthesis.cancel();
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    setIsPlaying(false);
    setPlayingSingleBubble(null);
    playingRef.current = false;
    waitingRef.current = false;
    singleBubbleRef.current = false;
    setWaitingForClick(false);
  };

  const onBubbleClick = (index) => {
    const replica = currentScript?.replicas[index];
    if (!replica) return;

    const isHidden = hiddenCharacters.has(replica.character_id);

    // Si la bulle est masquée, on la révèle temporairement et on joue l'audio
    if (isHidden) {
      setTempRevealedReplicas((prev) => ({ ...prev, [replica.id]: true }));

      // lever l'attente si on était en attente
      if (waitingForClick) {
        setWaitingForClick(false);
        waitingRef.current = false;
      }

      // Marquer la bulle en train d'être jouée
      setPlayingSingleBubble(index);
      setCurrentIndex(index);

      (async () => {
        try {
          await speak(replica.text || "", replica.character_id, replica.id);
        } catch (e) {
          console.warn("Erreur lecture réplique masquée:", e);
        }

        // nettoyer l'état temporaire
        setPlayingSingleBubble(null);
        setTempRevealedReplicas((prev) => {
          const copy = { ...prev };
          delete copy[replica.id];
          return copy;
        });
      })();

      return;
    }

    // Clic normal sur une bulle visible: lecture unique
    playSingleBubble(index);
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
    const newIndex = Math.min(
      currentScript.replicas.length - 1,
      currentIndex + 1,
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

  const toggleCharacterGender = (charId, currentGender) => {
    const newGender = currentGender === "female" ? "male" : "female";
    setCharacterGenders((prev) => ({ ...prev, [charId]: newGender }));
  };

  const toggleVoiceMode = (charId) => {
    setVoiceMode((prev) => ({
      ...prev,
      [charId]: prev[charId] === "recorded" ? "synth" : "recorded",
    }));
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

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-amber-50 pb-80">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary-800 to-primary-900 p-4 shadow-lg sticky top-0 z-30">
        <div className="flex items-center justify-between">
          {/* Bouton retour VISIBLE */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-gray-900 
                         text-white rounded-lg transition font-medium border border-gray-700"
            >
              <span className="text-xl">←</span>
              <span className="text-sm">Retour au texte</span>
            </button>

            <div>
              <h2 className="text-gold-400 text-lg font-semibold flex items-center gap-2">
                🔊 Mode Audio
              </h2>
              <p className="text-gray-300 text-xs">{title}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {/* bouton enregistrement supprimé */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition ${
                showSettings
                  ? "bg-gold-500 text-dark"
                  : "bg-white/20 text-white"
              }`}
            >
              ⚙️
            </button>
          </div>
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

      {/* ====== PARAMÈTRES VOIX SYNTHÉTIQUE ====== */}
      {showSettings && (
        <div className="bg-white border-b border-gray-200 p-4 shadow-md">
          <h3 className="font-semibold text-gray-800 mb-3">
            🔊 Réglages voix synthétique
          </h3>

          <div className="space-y-4">
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
                <span className="text-gray-600 text-sm">Pitch ♀ (aigu)</span>
                <span className="text-pink-600 font-semibold">
                  {femalePitch.toFixed(1)}
                </span>
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
                <span className="text-gray-600 text-sm">Pitch ♂ (grave)</span>
                <span className="text-blue-600 font-semibold">
                  {malePitch.toFixed(1)}
                </span>
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
                onClick={() => testVoice("female")}
                className="flex-1 py-2 bg-pink-100 text-pink-700 rounded-lg text-sm font-semibold"
              >
                🔊 Test ♀
              </button>
              <button
                onClick={() => testVoice("male")}
                className="flex-1 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold"
              >
                🔊 Test ♂
              </button>
            </div>

            {/* Genre par personnage */}
            <div className="pt-3 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2 font-semibold">
                Genre des personnages :
              </p>
              <div className="flex flex-wrap gap-2">
                {characters.map((char) => {
                  const gender =
                    characterGenders[char.id] ||
                    char.gender ||
                    detectGender(char.name);
                  return (
                    <button
                      key={char.id}
                      onClick={() => toggleCharacterGender(char.id, gender)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                        gender === "female"
                          ? "bg-pink-100 text-pink-600 border-2 border-pink-300"
                          : "bg-blue-100 text-blue-600 border-2 border-blue-300"
                      }`}
                    >
                      {char.name.substring(0, 10)}{" "}
                      {gender === "female" ? "♀" : "♂"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Choix de voix par personnage (DESKTOP) */}
            {!isMobile() && voices.all?.length > 1 && (
              <div className="pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2 font-semibold">
                  Voix par personnage :
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {characters.map((char) => (
                    <div key={char.id} className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: char.color }}
                      />
                      <span className="text-gray-700 text-sm flex-shrink-0 w-24 truncate">
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
                        className="flex-1 p-1 border rounded text-xs bg-white"
                      >
                        {voices.all?.map((voice) => (
                          <option key={voice.name} value={voice.name}>
                            {voice.name
                              .replace(/Microsoft|Google/gi, "")
                              .trim()}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode italienne */}
      <div className="p-3 bg-amber-100 border-b border-amber-200">
        <p className="text-xs text-amber-800 mb-2 font-semibold">
          🎭 Mode italienne : cliquez pour masquer vos répliques
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
                className={`flex items-center gap-1 px-3 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition shadow
                  ${
                    isHidden
                      ? "bg-gray-400 text-white ring-2 ring-red-500"
                      : "text-white"
                  }`}
                style={!isHidden ? { backgroundColor: char.color } : {}}
              >
                {isHidden ? "🙈" : "👁️"} {char.name}
                {hasRecording && currentMode === "recorded" && (
                  <span className="text-xs">🎙️</span>
                )}
              </button>
            );
          })}
        </div>
        {hiddenCharacters.size > 0 && (
          <p className="text-xs text-amber-700 mt-2">
            ℹ️ Vos répliques seront masquées. Cliquez dessus quand c'est votre
            tour !
          </p>
        )}
      </div>

      {/* Indicateur d'attente */}
      {waitingForClick && (
        <div className="bg-green-500 text-white p-3 text-center animate-pulse sticky top-[120px] z-20">
          <p className="font-bold">🎭 C'est à vous !</p>
          <p className="text-sm">Cliquez sur votre bulle pour continuer</p>
        </div>
      )}

      {/* Liste des répliques */}
      <div className="p-4 space-y-3">
        {replicas.map((replica, index) => {
          const character = characters.find(
            (c) => c.id === replica.character_id,
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

      {/* ====== PANNEAU DE CONTRÔLE - THÉÂTRAL ====== */}
      <div className="fixed bottom-16 left-0 right-0 z-50 bg-black border-t-4 border-red-800 shadow-2xl relative overflow-hidden">
        {/* Effet rideau théâtral */}
        <div className="absolute inset-0 opacity-20 bg-gradient-to-b from-red-900/20 to-black pointer-events-none"></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-900 via-red-700 to-red-900"></div>

        {/* Infos réplique */}
        <div className="px-4 py-2 bg-black/80 border-b border-red-900/50">
          <div className="flex items-center gap-3 relative z-10">
            <div
              className={`text-2xl ${
                isPlaying && !waitingForClick ? "animate-pulse" : ""
              }`}
            >
              {waitingForClick ? "🎭" : isPlaying ? "🔊" : "⏸️"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold truncate">
                {characters.find(
                  (c) => c.id === replicas[currentIndex]?.character_id,
                )?.name || "-"}
              </p>
              <p className="text-gray-400 text-xs truncate">
                {waitingForClick
                  ? "À vous de jouer !"
                  : (stripHtml(replicas[currentIndex]?.text || "").substring(
                      0,
                      40,
                    ) || "") + "..."}
              </p>
            </div>
            <span className="text-red-400 text-sm font-bold drop-shadow">
              {currentIndex + 1}/{replicas.length}
            </span>
          </div>
        </div>

        {/* Contrôles - Design épuré minimaliste */}
        <div className="px-4 py-8 pb-8 relative z-10">
          <div className="flex items-center justify-center gap-10 sm:gap-16">
            {/* Arrêter */}
            <button
              onClick={stop}
              title="Arrêter"
              className="text-4xl sm:text-5xl text-white/60 hover:text-white transition-colors duration-200 hover:scale-115 active:scale-95"
            >
              ⏹️
            </button>

            {/* Précédent */}
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              title="Réplique précédente"
              className="text-4xl sm:text-5xl text-white/60 hover:text-white transition-colors duration-200 hover:scale-115 active:scale-95 disabled:opacity-30"
            >
              ⏮️
            </button>

            {/* PLAY PRINCIPAL - Juste l'emoji énorme vert */}
            <button
              onClick={() => (isPlaying ? stop() : playAll(currentIndex))}
              title={isPlaying ? "Pause" : "Lecture"}
              className="text-8xl sm:text-9xl text-emerald-500 hover:text-emerald-400 transition-colors duration-200 transform hover:scale-120 active:scale-95 drop-shadow-xl"
            >
              {isPlaying ? "⏸️" : "▶️"}
            </button>

            {/* Suivant */}
            <button
              onClick={goToNext}
              disabled={currentIndex === replicas.length - 1}
              title="Réplique suivante"
              className="text-4xl sm:text-5xl text-white/60 hover:text-white transition-colors duration-200 hover:scale-115 active:scale-95 disabled:opacity-30"
            >
              ⏭️
            </button>

            {/* Recommencer */}
            <button
              onClick={() => {
                stop();
                setCurrentIndex(0);
                setTimeout(() => playAll(0), 100);
              }}
              title="Recommencer"
              className="text-4xl sm:text-5xl text-white/60 hover:text-white transition-colors duration-200 hover:scale-115 active:scale-95"
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
 * Bulle audio
 */
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
    ref,
  ) => {
    const bubbleColor = character?.color || "#6B7280";

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
        className={`flex ${isRight ? "justify-end" : "justify-start"} mb-2`}
      >
        <div
          className={`
          max-w-[85%] px-4 py-3 rounded-2xl
          transition-all duration-200 shadow-md
          ${isRight ? "rounded-br-md" : "rounded-bl-md"}
          ${isCurrent ? "ring-2 ring-gold-500 scale-[1.02]" : ""}
          ${isPlaying ? "animate-pulse" : ""}
          ${isWaiting ? "ring-4 ring-green-500 animate-bounce" : ""}
        `}
          style={{
            backgroundColor: isHidden ? "#9ca3af" : hexToRgba(bubbleColor, 0.9),
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-bold text-white drop-shadow flex items-center gap-1">
              {character?.name || "Inconnu"}
              {hasRecording && <span className="text-xs">🎙️</span>}
            </span>
            <div className="flex items-center gap-2">
              {isPlaying && <span className="text-lg">🔊</span>}
              {isWaiting && <span className="text-lg">👆</span>}
              <span className="text-xs text-white/70">#{number}</span>
            </div>
          </div>

          {/* Contenu */}
          {isHidden && !isTemporarilyRevealed ? (
            <div
              className="py-3 text-center cursor-pointer"
              onClick={onBubbleClick}
              onTouchStart={(e) => {
                e.stopPropagation();
                if (typeof onBubbleClick === "function") onBubbleClick();
              }}
            >
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
            <>
              <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                {stripHtml(replica.text)}
              </p>

              {/* Bouton play/stop */}
              <div className="flex justify-end mt-3 pt-3 border-t border-white/20">
                {isBubblePlaying ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStop();
                    }}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 
                             text-white rounded-full text-sm font-bold transition active:scale-95 shadow-md"
                  >
                    ⏹️ Arrêter
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay();
                    }}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white/25 hover:bg-white/35 
                             text-white rounded-full text-sm font-bold transition active:scale-95 shadow-md"
                  >
                    ▶️ Écouter {hasRecording && "🎙️"}
                  </button>
                )}
              </div>
              {/* Sous chaque bulle de réplique : enregistrement / lecture locale */}
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/20">
                {replicaRecordings[replica.id] ? (
                  <>
                    <button
                      onClick={() => playReplicaRecording(replica.id)}
                      className="flex items-center justify-center gap-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold shadow-md transition active:scale-95"
                    >
                      ▶️ Écouter ma prise
                    </button>
                    <button
                      onClick={() => deleteReplicaRecording(replica.id)}
                      className="flex items-center justify-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-md transition active:scale-95"
                    >
                      🗑️ Supprimer
                    </button>
                  </>
                ) : recordingReplicaId === replica.id ? (
                  <div className="w-full flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                    <span className="text-red-600 font-bold animate-pulse flex items-center gap-2">
                      🔴 {recordingDuration}s
                    </span>
                    <button
                      onClick={() => {
                        stopReplicaRecording();
                        saveReplicaRecording(
                          replica.id,
                          character?.name || "Inconnu",
                        );
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-md transition active:scale-95"
                    >
                      ⏹️ Finir
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startReplicaRecording(replica.id)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold shadow-md transition active:scale-95 w-full sm:w-auto"
                  >
                    🎤 Enregistrer ma voix
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  },
);

AudioBubble.displayName = "AudioBubble";

export default AudioMode;
