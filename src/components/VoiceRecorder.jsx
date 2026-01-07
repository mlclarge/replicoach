import { useState, useRef, useEffect } from 'react';

/**
 * Composant pour enregistrer une note vocale
 */
export function VoiceRecorder({ onRecordingComplete, onCancel, maxDuration = 60 }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      setError(null);
      chunksRef.current = [];
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Arrêter toutes les pistes
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      
      // Timer pour la durée
      timerRef.current = setInterval(() => {
        setDuration(d => {
          if (d >= maxDuration) {
            stopRecording();
            return d;
          }
          return d + 1;
        });
      }, 1000);
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Impossible d\'accéder au microphone. Vérifiez les permissions.');
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

  const handleSave = () => {
    if (chunksRef.current.length > 0) {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      onRecordingComplete(blob, duration);
    }
  };

  const handleRetry = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
    chunksRef.current = [];
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 bg-gray-100 rounded-xl">
      {error && (
        <div className="mb-3 p-2 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {!audioUrl ? (
        // Mode enregistrement
        <div className="text-center">
          {isRecording ? (
            <>
              <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-red-500 animate-pulse 
                              flex items-center justify-center">
                <span className="text-3xl">🎙️</span>
              </div>
              <p className="text-lg font-bold text-red-600 mb-2">
                {formatDuration(duration)} / {formatDuration(maxDuration)}
              </p>
              <p className="text-sm text-gray-500 mb-4">Enregistrement en cours...</p>
              <button
                onClick={stopRecording}
                className="px-6 py-2 bg-red-600 text-white rounded-full font-semibold"
              >
                ⏹️ Arrêter
              </button>
            </>
          ) : (
            <>
              <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-gray-300 
                              flex items-center justify-center">
                <span className="text-3xl">🎙️</span>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Appuyez pour enregistrer (max {maxDuration}s)
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-full"
                >
                  Annuler
                </button>
                <button
                  onClick={startRecording}
                  className="px-6 py-2 bg-red-500 text-white rounded-full font-semibold"
                >
                  🎙️ Enregistrer
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        // Mode prévisualisation
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-3">
            Durée : {formatDuration(duration)}
          </p>
          
          <audio src={audioUrl} controls className="w-full mb-4" />
          
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-full"
            >
              🔄 Recommencer
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-full"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-green-500 text-white rounded-full font-semibold"
            >
              ✓ Sauvegarder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Composant pour afficher une note vocale
 */
export function VoiceNotePlayer({ audioUrl, duration, onDelete }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-purple-100 rounded-lg">
      <audio 
        ref={audioRef} 
        src={audioUrl} 
        onEnded={() => setIsPlaying(false)}
      />
      
      <button
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center text-white
          ${isPlaying ? 'bg-orange-500' : 'bg-purple-500'}`}
      >
        {isPlaying ? '⏸️' : '▶️'}
      </button>
      
      <div className="flex-1">
        <p className="text-purple-700 text-sm font-semibold">🎙️ Note vocale</p>
        <p className="text-purple-500 text-xs">{formatDuration(duration)}</p>
      </div>
      
      {onDelete && (
        <button
          onClick={onDelete}
          className="p-2 text-red-500 hover:bg-red-100 rounded"
        >
          🗑️
        </button>
      )}
    </div>
  );
}

/**
 * Modal pour enregistrer une note vocale
 */
export function VoiceNoteModal({ onSave, onClose }) {
  const [saving, setSaving] = useState(false);

  const handleSave = async (blob, duration) => {
    setSaving(true);
    try {
      await onSave(blob, duration);
      onClose();
    } catch (err) {
      console.error('Error saving voice note:', err);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 bg-purple-600 text-white">
          <h2 className="text-lg font-bold">🎙️ Note vocale</h2>
          <p className="text-sm text-purple-200">Enregistrez votre note</p>
        </div>
        
        <div className="p-4">
          {saving ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Sauvegarde en cours...</p>
            </div>
          ) : (
            <VoiceRecorder 
              onRecordingComplete={handleSave}
              onCancel={onClose}
              maxDuration={120}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default VoiceRecorder;
