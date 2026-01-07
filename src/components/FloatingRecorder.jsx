import { useState, useRef, useEffect } from 'react';

/**
 * Barre flottante d'enregistrement - ne masque pas le texte
 * S'affiche en bas de l'écran
 */
function FloatingRecorder({ onSave, onClose }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showNameModal, setShowNameModal] = useState(false);
  const [recordingName, setRecordingName] = useState('');
  const [pendingBlob, setPendingBlob] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const checkSilenceRef = useRef(null);
  
  const SILENCE_TIMEOUT = 15000;
  const MAX_DURATION = 60 * 60;

  useEffect(() => {
    return () => cleanup();
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (checkSilenceRef.current) cancelAnimationFrame(checkSilenceRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        setPendingBlob(audioBlob);
        setRecordingName(`Enregistrement ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
        setShowNameModal(true);
        cleanup();
      };
      
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_DURATION) { stopRecording(); return prev; }
          return prev + 1;
        });
      }, 1000);
      
      startSilenceDetection();
    } catch (err) {
      alert('Impossible d\'accéder au microphone');
    }
  };

  const startSilenceDetection = () => {
    const checkSilence = () => {
      if (!analyserRef.current) return;
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      
      if (average < 5) {
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => stopRecording(), SILENCE_TIMEOUT);
        }
      } else if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      checkSilenceRef.current = requestAnimationFrame(checkSilence);
    };
    checkSilence();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const confirmSave = () => {
    if (!pendingBlob || !recordingName.trim()) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const recording = {
        id: Date.now().toString(),
        name: recordingName.trim(),
        date: new Date().toISOString(),
        duration: recordingTime,
        data: reader.result
      };
      
      // Sauvegarder en local
      try {
        const saved = localStorage.getItem('freeRecordings');
        const recordings = saved ? JSON.parse(saved) : [];
        localStorage.setItem('freeRecordings', JSON.stringify([recording, ...recordings]));
      } catch (err) {
        console.error('Erreur sauvegarde:', err);
      }
      
      if (onSave) onSave(recording);
      setShowNameModal(false);
      setPendingBlob(null);
      setRecordingName('');
    };
    reader.readAsDataURL(pendingBlob);
  };

  const cancelSave = () => {
    setShowNameModal(false);
    setPendingBlob(null);
    onClose?.();
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Modal nommer
  if (showNameModal) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full">
          <h3 className="text-lg font-bold text-white mb-2">💾 Nommer l'enregistrement</h3>
          <p className="text-gray-400 text-sm mb-4">Durée : {formatDuration(recordingTime)}</p>
          <input
            type="text"
            value={recordingName}
            onChange={(e) => setRecordingName(e.target.value)}
            placeholder="Nom de l'enregistrement"
            className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg mb-4"
            autoFocus
          />
          <div className="flex gap-3">
            <button onClick={cancelSave} className="flex-1 py-3 bg-gray-700 text-white rounded-lg">
              🗑️ Annuler
            </button>
            <button 
              onClick={confirmSave} 
              disabled={!recordingName.trim()} 
              className="flex-1 py-3 bg-green-600 text-white rounded-lg disabled:opacity-50"
            >
              ✅ Sauvegarder
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Barre flottante
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 border-t border-gray-700 p-3 z-40 backdrop-blur">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        {isRecording ? (
          <>
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-pulse">🔴</span>
              <span className="text-white font-mono text-lg">{formatDuration(recordingTime)}</span>
            </div>
            <button
              onClick={stopRecording}
              className="px-6 py-2 bg-red-600 text-white rounded-full font-bold flex items-center gap-2"
            >
              ⏹️ Arrêter
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎤</span>
              <span className="text-gray-300 text-sm">Prêt à enregistrer</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={startRecording}
                className="px-6 py-2 bg-red-600 text-white rounded-full font-bold flex items-center gap-2"
              >
                ⏺️ Enregistrer
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 text-white rounded-full"
              >
                ✕
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default FloatingRecorder;
