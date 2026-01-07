import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { fetchUserTroupes, uploadSharedRecording, fetchSharedRecordings } from '../lib/supabase';

/**
 * Enregistrements libres - Local + Partage troupe
 */
function FreeRecordings() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [recordings, setRecordings] = useState([]);
  const [sharedRecordings, setSharedRecordings] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(null);
  const [pendingBlob, setPendingBlob] = useState(null);
  const [recordingName, setRecordingName] = useState('');
  const [userTroupes, setUserTroupes] = useState([]);
  const [selectedTroupe, setSelectedTroupe] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [activeTab, setActiveTab] = useState('local');
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const checkSilenceRef = useRef(null);
  
  const MAX_DURATION = 60 * 60;
  const SILENCE_TIMEOUT = 15000;

  useEffect(() => {
    loadRecordings();
    loadTroupes();
    return () => cleanup();
  }, [user]);

  const loadRecordings = () => {
    try {
      const saved = localStorage.getItem('freeRecordings');
      if (saved) setRecordings(JSON.parse(saved));
    } catch (err) {
      console.error('Erreur chargement:', err);
    }
  };

  const loadTroupes = async () => {
    if (!user?.id) return;
    try {
      const troupes = await fetchUserTroupes(user.id);
      setUserTroupes(troupes || []);
      if (troupes?.length > 0) {
        setSelectedTroupe(troupes[0].id);
        loadSharedRecordings(troupes);
      }
    } catch (err) {
      console.error('Erreur troupes:', err);
    }
  };

  const loadSharedRecordings = async (troupes) => {
    try {
      const troupeIds = troupes.map(t => t.id);
      const shared = await fetchSharedRecordings(troupeIds);
      setSharedRecordings(shared || []);
    } catch (err) {
      console.error('Erreur enregistrements partagés:', err);
    }
  };

  const saveRecordings = (newRecordings) => {
    try {
      localStorage.setItem('freeRecordings', JSON.stringify(newRecordings));
      setRecordings(newRecordings);
    } catch (err) {
      alert('Espace de stockage insuffisant');
    }
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
        setRecordingName(`Enregistrement ${new Date().toLocaleDateString('fr-FR')}`);
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

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (checkSilenceRef.current) cancelAnimationFrame(checkSilenceRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
    timerRef.current = silenceTimerRef.current = checkSilenceRef.current = streamRef.current = audioContextRef.current = null;
  };

  const confirmSave = () => {
    if (!pendingBlob || !recordingName.trim()) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const newRecording = {
        id: Date.now().toString(),
        name: recordingName.trim(),
        date: new Date().toISOString(),
        duration: recordingTime,
        data: reader.result
      };
      saveRecordings([newRecording, ...recordings]);
      setShowNameModal(false);
      setPendingBlob(null);
      setRecordingName('');
    };
    reader.readAsDataURL(pendingBlob);
  };

  const cancelSave = () => {
    setShowNameModal(false);
    setPendingBlob(null);
    setRecordingName('');
  };

  const shareRecording = async (recording) => {
    if (!selectedTroupe) {
      alert('Sélectionnez une troupe');
      return;
    }
    
    setSharing(true);
    try {
      // Convertir base64 en blob
      const response = await fetch(recording.data);
      const blob = await response.blob();
      
      await uploadSharedRecording(blob, recording.name, selectedTroupe, user.id, recording.duration);
      
      alert('Enregistrement partagé !');
      setShowShareModal(null);
      loadSharedRecordings(userTroupes);
    } catch (err) {
      console.error('Erreur partage:', err);
      alert('Erreur lors du partage');
    } finally {
      setSharing(false);
    }
  };

  const playRecording = (recording) => {
    if (currentlyPlaying === recording.id) {
      setCurrentlyPlaying(null);
      return;
    }
    const audioSrc = recording.data || recording.audio_url;
    const audio = new Audio(audioSrc);
    audio.onended = () => setCurrentlyPlaying(null);
    audio.play();
    setCurrentlyPlaying(recording.id);
  };

  const deleteRecording = (id) => {
    saveRecordings(recordings.filter(r => r.id !== id));
    setShowDeleteConfirm(null);
  };

  const renameRecording = (id, newName) => {
    saveRecordings(recordings.map(r => r.id === id ? { ...r, name: newName } : r));
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStorageUsed = () => {
    try {
      const data = localStorage.getItem('freeRecordings') || '';
      return (new Blob([data]).size / 1024 / 1024).toFixed(2);
    } catch { return '0'; }
  };

  return (
    <div className="min-h-screen bg-dark">
      <header className="bg-primary-900 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-lg">←</button>
          <div>
            <h1 className="text-xl font-bold">🎤 Mes enregistrements</h1>
            <p className="text-sm text-gray-300">
              {recordings.length} local • {sharedRecordings.length} partagé{sharedRecordings.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </header>

      <div className="p-4 pb-32">
        {/* Zone d'enregistrement */}
        <div className="bg-gradient-to-br from-primary-900/50 to-primary-800/30 rounded-2xl p-6 mb-6 text-center border border-primary-700/50">
          {isRecording ? (
            <>
              <div className="text-6xl mb-4 animate-pulse">🔴</div>
              <p className="text-3xl font-mono text-white mb-2">{formatDuration(recordingTime)}</p>
              <p className="text-sm text-gray-400 mb-4">Auto-stop après 15s de silence</p>
              <button onClick={stopRecording} className="px-8 py-4 bg-red-600 text-white rounded-full font-bold text-lg">
                ⏹️ Arrêter
              </button>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4">🎤</div>
              <p className="text-gray-300 mb-4">Enregistrez-vous pour vous écouter</p>
              <button onClick={startRecording} className="px-8 py-4 bg-red-600 text-white rounded-full font-bold text-lg animate-pulse">
                ⏺️ Commencer
              </button>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('local')}
            className={`flex-1 py-2 rounded-lg font-medium ${activeTab === 'local' ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-400'}`}
          >
            📱 Local ({recordings.length})
          </button>
          <button
            onClick={() => setActiveTab('shared')}
            className={`flex-1 py-2 rounded-lg font-medium ${activeTab === 'shared' ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-400'}`}
          >
            👥 Partagés ({sharedRecordings.length})
          </button>
        </div>

        {/* Liste */}
        {activeTab === 'local' ? (
          recordings.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-5xl block mb-3">📭</span>
              <p className="text-gray-500">Aucun enregistrement local</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recordings.map((recording) => (
                <RecordingItem
                  key={recording.id}
                  recording={recording}
                  isPlaying={currentlyPlaying === recording.id}
                  onPlay={() => playRecording(recording)}
                  onDelete={() => setShowDeleteConfirm(recording.id)}
                  onRename={(newName) => renameRecording(recording.id, newName)}
                  onShare={userTroupes.length > 0 ? () => setShowShareModal(recording) : null}
                  formatDuration={formatDuration}
                />
              ))}
            </div>
          )
        ) : (
          sharedRecordings.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-5xl block mb-3">📭</span>
              <p className="text-gray-500">Aucun enregistrement partagé</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sharedRecordings.map((recording) => (
                <RecordingItem
                  key={recording.id}
                  recording={recording}
                  isPlaying={currentlyPlaying === recording.id}
                  onPlay={() => playRecording(recording)}
                  formatDuration={formatDuration}
                  isShared
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Modal nommer */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
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
              <button onClick={cancelSave} className="flex-1 py-3 bg-gray-700 text-white rounded-lg">🗑️ Supprimer</button>
              <button onClick={confirmSave} disabled={!recordingName.trim()} className="flex-1 py-3 bg-green-600 text-white rounded-lg disabled:opacity-50">✅ Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal partage */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white mb-4">👥 Partager avec une troupe</h3>
            <p className="text-gray-400 text-sm mb-4">"{showShareModal.name}"</p>
            
            {userTroupes.length > 1 ? (
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Choisir la troupe</label>
                <select
                  value={selectedTroupe || ''}
                  onChange={(e) => setSelectedTroupe(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg"
                >
                  {userTroupes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-gray-300 mb-4">Troupe : <strong>{userTroupes[0]?.name}</strong></p>
            )}
            
            <div className="flex gap-3">
              <button onClick={() => setShowShareModal(null)} className="flex-1 py-3 bg-gray-700 text-white rounded-lg">Annuler</button>
              <button 
                onClick={() => shareRecording(showShareModal)} 
                disabled={sharing}
                className="flex-1 py-3 bg-primary-600 text-white rounded-lg disabled:opacity-50"
              >
                {sharing ? '...' : '📤 Partager'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white mb-3">🗑️ Supprimer ?</h3>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-3 bg-gray-700 text-white rounded-lg">Annuler</button>
              <button onClick={() => deleteRecording(showDeleteConfirm)} className="flex-1 py-3 bg-red-600 text-white rounded-lg">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecordingItem({ recording, isPlaying, onPlay, onDelete, onRename, onShare, formatDuration, isShared }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(recording.name);

  const handleSaveName = () => {
    if (name.trim() && onRename) onRename(name.trim());
    setIsEditing(false);
  };

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
      <div className="flex items-center gap-3">
        <button
          onClick={onPlay}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition
            ${isPlaying ? 'bg-red-600 text-white' : 'bg-primary-600 text-white hover:bg-primary-500'}`}
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>

        <div className="flex-1 min-w-0">
          {isEditing && !isShared ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              className="w-full bg-gray-700 text-white px-2 py-1 rounded"
              autoFocus
            />
          ) : (
            <p 
              className={`text-white font-medium truncate ${!isShared ? 'cursor-pointer' : ''}`}
              onClick={() => !isShared && setIsEditing(true)}
            >
              {recording.name}
            </p>
          )}
          <p className="text-gray-500 text-sm">
            {formatDuration(recording.duration)} • {new Date(recording.date || recording.created_at).toLocaleDateString('fr-FR')}
            {isShared && recording.troupe_name && <span> • {recording.troupe_name}</span>}
          </p>
        </div>

        {onShare && (
          <button onClick={onShare} className="p-2 text-gray-400 hover:text-primary-400 rounded-lg" title="Partager">
            📤
          </button>
        )}
        
        {onDelete && (
          <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-400 rounded-lg">
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}

export default FreeRecordings;
