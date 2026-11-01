import { useState, useRef, useEffect } from "react";

/**
 * Modale de capture vidéo immersives pour le travail du comédien
 */
export default function VideoRecorderModal({
  isOpen,
  onClose,
  onSave,
  replicas = [],
  characters = [],
  scenes = [],
  initialTargetReplicaId = null,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [targetReplicaId, setTargetReplicaId] = useState(initialTargetReplicaId || (replicas[0]?.id || null));
  const [selectedCharacterId, setSelectedCharacterId] = useState(characters[0]?.id || null);
  const [title, setTitle] = useState("");
  const [cameraError, setCameraError] = useState(null);

  const videoLiveRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setCameraError(null);
      if (initialTargetReplicaId) setTargetReplicaId(initialTargetReplicaId);
      else if (replicas.length > 0 && !targetReplicaId) setTargetReplicaId(replicas[0].id);
      if (characters.length > 0 && !selectedCharacterId) setSelectedCharacterId(characters[0].id);
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, initialTargetReplicaId, replicas, characters]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      chunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      mediaStreamRef.current = stream;
      if (videoLiveRef.current) {
        videoLiveRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Erreur accès caméra/micro:", err);
      setCameraError("Impossible d'accéder à la caméra ou au microphone. Vérifiez les autorisations de votre navigateur.");
    }
  };

  const stopCamera = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
  };

  const startRecording = () => {
    if (!mediaStreamRef.current) return;
    chunksRef.current = [];
    setRecordedBlob(null);
    setVideoPreviewUrl(null);
    setRecordingDuration(0);

    let mimeType = "video/webm";
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported) {
      if (MediaRecorder.isTypeSupported("video/mp4")) {
        mimeType = "video/mp4";
      } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
        mimeType = "video/webm;codecs=vp9";
      }
    }

    try {
      const mediaRecorder = new MediaRecorder(mediaStreamRef.current, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setVideoPreviewUrl(url);
      };

      mediaRecorder.start(250);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error("Erreur démarrage enregistrement vidéo:", err);
      alert("Impossible de démarrer l'enregistrement vidéo.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSave = () => {
    if (!recordedBlob) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const videoData = {
        data: reader.result,
        title: title.trim() || "Vidéo de travail",
        characterId: selectedCharacterId,
        duration: recordingDuration,
        date: new Date().toISOString(),
      };
      if (onSave) onSave(targetReplicaId, videoData);
      onClose();
    };
    reader.readAsDataURL(recordedBlob);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-lg p-5 text-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎥</span>
            <h3 className="font-extrabold text-amber-400 text-sm sm:text-base">
              Studio Vidéo — Enregistrement Caméra
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300"
          >
            ✕
          </button>
        </div>

        {/* Dynamic Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {cameraError ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-xs space-y-2">
              <p className="font-bold">⚠️ Erreur d'accès Caméra :</p>
              <p>{cameraError}</p>
              <button
                onClick={startCamera}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition"
              >
                🔄 Réessayer l'accès
              </button>
            </div>
          ) : (
            <div className="relative bg-black rounded-2xl overflow-hidden aspect-video shadow-2xl border border-gray-800 flex items-center justify-center">
              {videoPreviewUrl ? (
                <video
                  src={videoPreviewUrl}
                  controls
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  ref={videoLiveRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              )}

              {isRecording && (
                <div className="absolute top-3 left-3 bg-red-600/90 text-white text-xs font-mono font-extrabold px-3 py-1 rounded-full animate-pulse flex items-center gap-1.5 shadow-lg">
                  <span>🔴</span> REC {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, "0")}
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            {!isRecording && !videoPreviewUrl && !cameraError && (
              <button
                onClick={startRecording}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-2xl shadow-lg transition active:scale-95 flex items-center gap-2"
              >
                <span>🔴</span> Démarrer la vidéo
              </button>
            )}

            {isRecording && (
              <button
                onClick={stopRecording}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-extrabold rounded-2xl shadow-lg border border-red-500 transition active:scale-95 flex items-center gap-2"
              >
                <span>⏹️</span> Arrêter l'enregistrement
              </button>
            )}

            {videoPreviewUrl && (
              <button
                onClick={() => {
                  setVideoPreviewUrl(null);
                  setRecordedBlob(null);
                  startCamera();
                }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl text-xs transition"
              >
                🔄 Recommencer
              </button>
            )}
          </div>

          {/* Formulaire d'Ancrage */}
          <div className="space-y-3 bg-gray-950/60 p-3.5 rounded-2xl border border-white/10 text-xs">
            {replicas.length > 0 ? (
              <div>
                <label className="block text-gray-400 font-bold mb-1">
                  📌 Emplacement dans la pièce :
                </label>
                <select
                  value={targetReplicaId || ""}
                  onChange={(e) => setTargetReplicaId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2.5 text-white font-medium focus:outline-none focus:border-amber-400"
                >
                  {replicas.map((r, idx) => (
                    <option key={r.id} value={r.id}>
                      #{idx + 1} — {r.character?.name || "Perso"}: {r.text?.substring(0, 35)}...
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 font-medium">
                🎥 Mode Vidéo Libre (Non ancrée dans un script)
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {characters.length > 0 && (
                <div>
                  <label className="block text-gray-400 font-bold mb-1">👤 Personnage :</label>
                  <select
                    value={selectedCharacterId || ""}
                    onChange={(e) => setSelectedCharacterId(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2 text-white font-medium"
                  >
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={characters.length > 0 ? "" : "col-span-2"}>
                <label className="block text-gray-400 font-bold mb-1">🏷️ Titre de travail :</label>
                <input
                  type="text"
                  placeholder="Ex: Intentions Scène 2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2 text-white font-medium placeholder-gray-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-gray-800 flex justify-end gap-2 mt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl text-xs"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!recordedBlob}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-extrabold rounded-xl text-xs shadow-lg disabled:opacity-40 transition"
          >
            💾 Insérer dans le script
          </button>
        </div>
      </div>
    </div>
  );
}
