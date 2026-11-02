import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { fetchUserTroupes, uploadSharedRecording, fetchSharedRecordings } from '../lib/supabase';
import { loadAllFreeVideosDB, saveFreeVideoDB, deleteFreeVideoDB } from '../lib/videoStorage';

/**
 * Enregistrements libres (Audio & Vidéo) - Local + Partage troupe
 */
function FreeRecordings() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [recordings, setRecordings] = useState([]);
  const [freeVideos, setFreeVideos] = useState([]);
  const [sharedRecordings, setSharedRecordings] = useState([]);
  const [mode, setMode] = useState('audio');
  
  // Audio State
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(null);
  const [pendingBlob, setPendingBlob] = useState(null);
  const [recordingName, setRecordingName] = useState('');
  
  // Video State
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const [recordedVideoBlob, setRecordedVideoBlob] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [videoTitle, setVideoTitle] = useState('');
  
  const [userTroupes, setUserTroupes] = useState([]);
  const [selectedTroupe, setSelectedTroupe] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [activeTab, setActiveTab] = useState('local');
  
  // Audio Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const checkSilenceRef = useRef(null);
  
  // Video Refs
  const videoLiveRef = useRef(null);
  const videoStreamRef = useRef(null);
  const videoMediaRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const videoTimerRef = useRef(null);
  
  const MAX_DURATION = 60 * 60;
  const SILENCE_TIMEOUT = 15000;

  useEffect(() => {
    loadRecordings();
    loadFreeVideos();
    loadTroupes();
    
    const handleFreeVideoUpdated = () => {
      loadFreeVideos();
    };
    window.addEventListener('free-video-updated', handleFreeVideoUpdated);
    return () => {
      cleanupAudio();
      cleanupVideo();
      window.removeEventListener('free-video-updated', handleFreeVideoUpdated);
    };
  }, [user]);

  const loadRecordings = () => {
    try {
      const saved = localStorage.getItem('freeRecordings');
      if (saved) setRecordings(JSON.parse(saved));
    } catch (err) {
      console.error('Erreur chargement audio:', err);
    }
  };

  const loadFreeVideos = async () => {
    try {
      const vids = await loadAllFreeVideosDB();
      setFreeVideos(vids || []);
    } catch (err) {
      console.error('Erreur chargement vidéos:', err);
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

  // --- AUDIO RECORDING ---
  const startAudioRecording = async () => {
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
        setShowNameModal(true);
      };
      
      mediaRecorder.start(100);
      setIsRecordingAudio(true);
      setAudioTime(0);
      
      timerRef.current = setInterval(() => {
        setAudioTime(prev => {
          if (prev >= MAX_DURATION) {
            stopAudioRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      
      let lastSoundTime = Date.now();
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      checkSilenceRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        
        if (average > 15) {
          lastSoundTime = Date.now();
        } else if (Date.now() - lastSoundTime > SILENCE_TIMEOUT) {
          stopAudioRecording();
        }
      }, 500);

    } catch (err) {
      console.error('Erreur accès micro:', err);
      alert("Impossible d'accéder au microphone");
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      cleanupAudio();
    }
  };

  const cleanupAudio = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (checkSilenceRef.current) clearInterval(checkSilenceRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
  };

  const handleSaveAudioName = () => {
    if (!pendingBlob) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const newRec = {
        id: Date.now().toString(),
        name: recordingName.trim() || "Enregistrement vocal",
        data: reader.result,
        duration: audioTime,
        date: new Date().toISOString()
      };
      saveRecordings([newRec, ...recordings]);
      setShowNameModal(false);
      setPendingBlob(null);
      setRecordingName('');
    };
    reader.readAsDataURL(pendingBlob);
  };

  // --- VIDEO RECORDING ---
  const startCamera = async () => {
    try {
      videoChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      videoStreamRef.current = stream;
      if (videoLiveRef.current) {
        videoLiveRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Erreur accès caméra:', err);
      alert("Impossible d'accéder à la caméra ou au microphone");
    }
  };

  const cleanupVideo = () => {
    if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    if (videoMediaRecorderRef.current && videoMediaRecorderRef.current.state !== 'inactive') {
      try { videoMediaRecorderRef.current.stop(); } catch (e) {}
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(t => t.stop());
      videoStreamRef.current = null;
    }
    setIsRecordingVideo(false);
  };

  const startVideoRecording = async () => {
    if (!videoStreamRef.current) {
      await startCamera();
    }
    if (!videoStreamRef.current) return;

    videoChunksRef.current = [];
    setRecordedVideoBlob(null);
    setVideoPreviewUrl(null);
    setVideoTime(0);

    let mimeType = 'video/webm';
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm;codecs=vp9';
      }
    }

    try {
      const mediaRecorder = new MediaRecorder(videoStreamRef.current, { mimeType });
      videoMediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) videoChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: mimeType });
        setRecordedVideoBlob(blob);
        setVideoPreviewUrl(URL.createObjectURL(blob));
      };

      mediaRecorder.start(250);
      setIsRecordingVideo(true);

      videoTimerRef.current = setInterval(() => {
        setVideoTime(d => d + 1);
      }, 1000);
    } catch (err) {
      console.error('Erreur démarrage vidéo:', err);
      alert("Impossible de démarrer l'enregistrement vidéo");
    }
  };

  const stopVideoRecording = () => {
    if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    if (videoMediaRecorderRef.current && videoMediaRecorderRef.current.state !== 'inactive') {
      videoMediaRecorderRef.current.stop();
    }
    setIsRecordingVideo(false);
  };

  const handleSaveVideo = () => {
    if (!recordedVideoBlob) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const videoData = {
        title: videoTitle.trim() || "Vidéo libre",
        data: reader.result,
        duration: videoTime,
        date: new Date().toISOString(),
      };
      await saveFreeVideoDB(videoData);
      loadFreeVideos();
      setRecordedVideoBlob(null);
      setVideoPreviewUrl(null);
      setVideoTitle('');
      cleanupVideo();
      window.dispatchEvent(new CustomEvent('free-video-updated'));
    };
    reader.readAsDataURL(recordedVideoBlob);
  };

  // --- ACTIONS ---
  const deleteRecording = async (id, isVideo = false) => {
    if (isVideo) {
      await deleteFreeVideoDB(id);
      loadFreeVideos();
    } else {
      const updated = recordings.filter(r => r.id !== id);
      saveRecordings(updated);
    }
    setShowDeleteConfirm(null);
  };

  const renameRecording = (id, newName) => {
    const updated = recordings.map(r => r.id === id ? { ...r, name: newName } : r);
    saveRecordings(updated);
  };

  const shareRecording = async (recording) => {
    if (!selectedTroupe || !user?.id) return;
    setSharing(true);
    try {
      await uploadSharedRecording(recording, selectedTroupe, user.id);
      setShowShareModal(null);
      loadSharedRecordings(userTroupes);
      alert('✓ Enregistrement partagé avec la troupe !');
    } catch (err) {
      alert('Erreur lors du partage : ' + err.message);
    } finally {
      setSharing(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return ;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 pb-24">
      <div className="max-w-4xl mx-auto">
        
        {/* Header avec bouton Retour */}
        <div className="flex items-center gap-3 mb-6">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-300 font-bold transition flex items-center gap-1"
          >
            ← Retour
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
              <span>🎙️</span> Mes enregistrements libres
            </h1>
            <p className="text-xs text-gray-400 font-medium">
              {recordings.length + freeVideos.length} local • {sharedRecordings.length} partagé
            </p>
          </div>
        </div>

        {/* Sélecteur Mode enregistrement (Audio / Vidéo) */}
        <div className="flex justify-center gap-3 mb-6">
          <button
            onClick={() => { setMode('audio'); cleanupVideo(); }}
            className={}
          >
            <span>🎙️</span> Enregistrement Audio
          </button>
          <button
            onClick={() => { setMode('video'); startCamera(); }}
            className={}
          >
            <span>🎥</span> Enregistrement Vidéo
          </button>
        </div>

        {/* --- ZONE D'ENREGISTREMENT AUDIO --- */}
        {mode === 'audio' && (
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 text-center shadow-2xl mb-8">
            <div className="w-16 h-16 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              🎙️
            </div>
            <p className="text-sm font-bold text-amber-200 mb-4">
              {isRecordingAudio ? 'Enregistrement audio en cours...' : 'Enregistrez-vous librement pour vous écouter'}
            </p>

            {isRecordingAudio && (
              <div className="text-3xl font-mono font-extrabold text-amber-400 mb-6 animate-pulse">
                {formatTime(audioTime)}
              </div>
            )}

            <button
              onClick={isRecordingAudio ? stopAudioRecording : startAudioRecording}
              className={}
            >
              <span>{isRecordingAudio ? '⏹️' : '🔵'}</span>
              <span>{isRecordingAudio ? "Arrêter l'enregistrement" : "Commencer l'audio"}</span>
            </button>
          </div>
        )}

        {/* --- ZONE D'ENREGISTREMENT VIDÉO --- */}
        {mode === 'video' && (
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 border-2 border-rose-500/40 rounded-3xl p-6 text-center shadow-2xl mb-8 max-w-xl mx-auto">
            <div className="relative bg-black rounded-2xl overflow-hidden aspect-video shadow-2xl border border-gray-700 mb-4 flex items-center justify-center max-h-[350px]">
              {videoPreviewUrl ? (
                <video src={videoPreviewUrl} controls className="w-full h-full object-contain mx-auto" />
              ) : (
                <video ref={videoLiveRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
              )}

              {isRecordingVideo && (
                <div className="absolute top-3 left-3 bg-red-600/90 text-white text-xs font-mono font-extrabold px-3 py-1 rounded-full animate-pulse flex items-center gap-1.5 shadow-lg">
                  <span>🔴</span> REC {formatTime(videoTime)}
                </div>
              )}
            </div>

            {!isRecordingVideo && !videoPreviewUrl && (
              <button
                onClick={startVideoRecording}
                className="px-8 py-3.5 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2 mx-auto"
              >
                <span>🔴</span> Démarrer la vidéo
              </button>
            )}

            {isRecordingVideo && (
              <button
                onClick={stopVideoRecording}
                className="px-8 py-3.5 bg-gray-800 hover:bg-gray-700 text-white font-extrabold rounded-2xl shadow-xl border border-red-500 transition active:scale-95 flex items-center justify-center gap-2 mx-auto"
              >
                <span>⏹️</span> Arrêter la vidéo
              </button>
            )}

            {videoPreviewUrl && (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Titre de la vidéo (optionnel)"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-white font-medium text-xs text-center"
                />
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => { setVideoPreviewUrl(null); setRecordedVideoBlob(null); startCamera(); }}
                    className="px-4 py-2 bg-gray-800 text-gray-300 font-bold rounded-xl text-xs"
                  >
                    🔄 Recommencer
                  </button>
                  <button
                    onClick={handleSaveVideo}
                    className="px-6 py-2 bg-rose-500 hover:bg-rose-400 text-white font-extrabold rounded-xl text-xs shadow-lg"
                  >
                    💾 Enregistrer la vidéo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- TABS LOCAL / PARTAGÉS --- */}
        <div className="flex border-b border-gray-800 mb-6">
          <button
            onClick={() => setActiveTab('local')}
            className={}
          >
            📱 Local ({recordings.length + freeVideos.length})
          </button>
          <button
            onClick={() => setActiveTab('shared')}
            className={}
          >
            👥 Partagés ({sharedRecordings.length})
          </button>
        </div>

        {/* --- LISTE LOCAL --- */}
        {activeTab === 'local' && (
          <div className="space-y-4">
            {recordings.length === 0 && freeVideos.length === 0 ? (
              <p className="text-center text-gray-500 py-12 text-sm font-medium">
                Aucun enregistrement local (audio ou vidéo).
              </p>
            ) : (
              <>
                {/* Vidéos Libres */}
                {freeVideos.map((vid) => (
                  <div key={vid.id} className="bg-gray-800/60 border border-rose-500/30 rounded-2xl p-4 shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🎥</span>
                        <div>
                          <h4 className="font-extrabold text-rose-300 text-xs sm:text-sm">
                            {vid.title || 'Vidéo libre'}
                          </h4>
                          <p className="text-[10px] text-gray-400 font-mono">
                            {formatTime(vid.duration || 0)} • {new Date(vid.date || Date.now()).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowDeleteConfirm({ id: vid.id, isVideo: true })}
                        className="p-2 text-gray-400 hover:text-red-400 rounded-lg transition"
                      >
                        🗑️
                      </button>
                    </div>
                    <div className="relative bg-black rounded-xl overflow-hidden max-h-[350px] flex items-center justify-center border border-white/10">
                      <video src={vid.data} controls playsInline className="w-full max-h-[340px] object-contain mx-auto" />
                    </div>
                  </div>
                ))}

                {/* Audios Libres */}
                {recordings.map((rec) => (
                  <RecordingItem
                    key={rec.id}
                    recording={rec}
                    isPlaying={currentlyPlaying === rec.id}
                    onPlay={() => {
                      if (currentlyPlaying === rec.id) {
                        setCurrentlyPlaying(null);
                      } else {
                        setCurrentlyPlaying(rec.id);
                        const audio = new Audio(rec.data);
                        audio.play();
                        audio.onended = () => setCurrentlyPlaying(null);
                      }
                    }}
                    onDelete={() => setShowDeleteConfirm({ id: rec.id, isVideo: false })}
                    onRename={(newName) => renameRecording(rec.id, newName)}
                    onShare={userTroupes.length > 0 ? () => setShowShareModal(rec) : null}
                    formatDuration={formatTime}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* --- LISTE PARTAGÉS --- */}
        {activeTab === 'shared' && (
          <div className="space-y-4">
            {sharedRecordings.length === 0 ? (
              <p className="text-center text-gray-500 py-12 text-sm font-medium">
                Aucun enregistrement partagé dans votre troupe.
              </p>
            ) : (
              sharedRecordings.map((rec) => (
                <RecordingItem
                  key={rec.id}
                  recording={rec}
                  isPlaying={currentlyPlaying === rec.id}
                  onPlay={() => {
                    if (currentlyPlaying === rec.id) {
                      setCurrentlyPlaying(null);
                    } else {
                      setCurrentlyPlaying(rec.id);
                      const audio = new Audio(rec.audio_url);
                      audio.play();
                      audio.onended = () => setCurrentlyPlaying(null);
                    }
                  }}
                  formatDuration={formatTime}
                  isShared={true}
                />
              ))
            )}
          </div>
        )}

        {/* Modal Nom Audio */}
        {showNameModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full space-y-4 border border-amber-500/40">
              <h3 className="text-base font-extrabold text-amber-300">💾 Nommer l'enregistrement audio</h3>
              <input
                type="text"
                placeholder="Ex: Répétition monologue"
                value={recordingName}
                onChange={(e) => setRecordingName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white font-medium text-xs"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowNameModal(false); setPendingBlob(null); }}
                  className="flex-1 py-2.5 bg-gray-700 text-gray-300 rounded-xl text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveAudioName}
                  className="flex-1 py-2.5 bg-amber-500 text-gray-950 font-extrabold rounded-xl text-xs shadow-lg"
                >
                  Sauvegarder
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Suppression */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full space-y-4 border border-red-500/40">
              <h3 className="text-base font-extrabold text-white">🗑️ Supprimer cet enregistrement ?</h3>
              <div className="flex gap-2">
                <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 bg-gray-700 text-gray-300 rounded-xl text-xs font-bold">Annuler</button>
                <button onClick={() => deleteRecording(showDeleteConfirm.id, showDeleteConfirm.isVideo)} className="flex-1 py-2.5 bg-red-600 text-white font-extrabold rounded-xl text-xs">Supprimer</button>
              </div>
            </div>
          </div>
        )}

      </div>
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
    <div className="bg-gray-800/60 rounded-2xl p-4 border border-gray-700/60 shadow-md">
      <div className="flex items-center gap-3">
        <button
          onClick={onPlay}
          className={}
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
              className="w-full bg-gray-900 text-white px-2 py-1 rounded text-xs"
              autoFocus
            />
          ) : (
            <p 
              className={}
              onClick={() => !isShared && setIsEditing(true)}
            >
              {recording.name}
            </p>
          )}
          <p className="text-gray-400 text-[10px] sm:text-xs font-mono">
            {formatDuration(recording.duration)} • {new Date(recording.date || recording.created_at).toLocaleDateString('fr-FR')}
            {isShared && recording.troupe_name && <span> • {recording.troupe_name}</span>}
          </p>
        </div>

        {onShare && (
          <button onClick={onShare} className="p-2 text-gray-400 hover:text-amber-400 rounded-lg" title="Partager">
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
