import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getUserRole } from "../lib/supabase";
import { useAuthStore } from "../store/authStore";

/**
 * Bouton flottant "+" - GAUCHE - BLEU
 */
function FloatingActionButton({ onAddVideo, onAddAudio, onRecordFree }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showVideoInfo, setShowVideoInfo] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoSaving, setVideoSaving] = useState(false);
  const [userRole, setUserRole] = useState("member");
  const [showAudioInput, setShowAudioInput] = useState(false);
  const [showAudioInfo, setShowAudioInfo] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const audioInputRef = useRef();

  useEffect(() => {
    if (user?.id) {
      getUserRole(user.id).then(setUserRole);
    }
  }, [user]);

  const hiddenPages = ["/login", "/upload", "/recordings"];
  if (hiddenPages.some((p) => location.pathname.startsWith(p))) {
    return null;
  }

  const canPostVideoAnywhere = userRole === "dev" || userRole === "director";

  const handleAudioInput = (e) => {
    const file = e.target.files[0];
    console.log('FloatingActionButton: fichier audio sélectionné', file);
    console.log('FloatingActionButton: onAddAudio disponible?', !!onAddAudio);
    if (file && onAddAudio) {
      console.log('FloatingActionButton: appel de onAddAudio...');
      onAddAudio(file);
    } else if (file && !onAddAudio) {
      console.error('FloatingActionButton: onAddAudio non défini!');
    }
    setShowAudioInput(false);
  };

  const actions = [
    {
      icon: "📄",
      label: "Nouveau texte",
      color: "bg-gold-500",
      onClick: () => {
        navigate("/upload");
        setIsOpen(false);
      },
    },
    {
      icon: "🎤",
      label: "Enregistrement libre",
      color: "bg-orange-500",
      onClick: () => {
        if (onRecordFree) {
          onRecordFree();
        } else {
          navigate("/recordings");
        }
        setIsOpen(false);
      },
    },
    {
      icon: "📹",
      label: "Ajouter vidéo",
      color: "bg-purple-500",
      onClick: () => {
        if (onAddVideo) {
          onAddVideo();
        } else if (canPostVideoAnywhere) {
          setShowVideoModal(true);
        } else {
          setShowVideoInfo(true);
        }
        setIsOpen(false);
      },
    },
    {
      icon: "🎵",
      label: "Ajouter un fichier son",
      color: "bg-blue-500",
      onClick: () => {
        setShowAudioInfo(true);
        setIsOpen(false);
      },
    },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* POSITION GAUCHE - bottom-24 pour alignement */}
      <div className="fixed bottom-24 left-4 z-50">
        {isOpen && (
          <div className="mb-3 space-y-2">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className={`flex items-center gap-3 px-4 py-3 rounded-full shadow-lg
                           ${action.color} text-white font-semibold
                           transform transition-all duration-200
                           animate-fade-in-up`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="text-xl">{action.icon}</span>
                <span className="text-sm whitespace-nowrap">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* COULEUR BLEUE */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full shadow-lg
                     flex items-center justify-center text-2xl
                     transition-all duration-300 transform
                     ${
                       isOpen
                         ? "bg-gray-700 text-white rotate-45"
                         : "bg-blue-600 text-white hover:bg-blue-500 hover:scale-110"
                     }`}
        >
          ➕
        </button>
      </div>

      {/* Modal info vidéo (membres sans troupe) */}
      {showVideoInfo && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowVideoInfo(false)}
        >
          <div
            className="bg-gray-800 rounded-xl p-6 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-5xl block mb-4">📹</span>
            <h3 className="text-lg font-bold text-white mb-3">
              Ajouter une vidéo
            </h3>
            <p className="text-gray-400 mb-4">
              Pour ajouter une vidéo YouTube, allez dans{" "}
              <strong>Partagés</strong> et sélectionnez votre troupe.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowVideoInfo(false)}
                className="flex-1 py-3 bg-gray-700 text-white rounded-lg"
              >
                Compris
              </button>
              <button
                onClick={() => {
                  setShowVideoInfo(false);
                  navigate("/shared");
                }}
                className="flex-1 py-3 bg-primary-600 text-white rounded-lg"
              >
                Aller aux Partagés
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ajout vidéo (dev/director) */}
      {showVideoModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowVideoModal(false)}
        >
          <div
            className="bg-gray-800 rounded-xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-2">
              📹 Ajouter une vidéo YouTube
            </h3>
            <div className="bg-gray-700/50 rounded-lg p-3 mb-4 text-sm text-gray-300">
              <p className="mb-2">
                📌 <strong>Comment faire :</strong>
              </p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Ouvrez YouTube et trouvez votre vidéo</li>
                <li>Appuyez sur "Partager" puis "Copier le lien"</li>
                <li>Collez le lien ci-dessous</li>
              </ol>
            </div>

            <input
              type="text"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="Titre de la vidéo"
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg mb-3"
            />

            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="URL YouTube"
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowVideoModal(false);
                  setVideoUrl("");
                  setVideoTitle("");
                }}
                className="flex-1 py-3 bg-gray-700 text-white rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (!videoUrl.trim() || !videoTitle.trim()) {
                    alert("Titre et URL requis");
                    return;
                  }
                  setVideoSaving(true);
                  try {
                    const { addGlobalVideo } = await import("../lib/supabase");
                    await addGlobalVideo(user.id, videoTitle, videoUrl);
                    alert("Vidéo ajoutée !");
                    setShowVideoModal(false);
                    setVideoUrl("");
                    setVideoTitle("");
                  } catch (err) {
                    alert("Erreur: " + err.message);
                  }
                  setVideoSaving(false);
                }}
                disabled={videoSaving || !videoUrl.trim() || !videoTitle.trim()}
                className="flex-1 py-3 bg-purple-600 text-white rounded-lg disabled:opacity-50"
              >
                {videoSaving ? "..." : "📤 Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal info audio - limite de taille */}
      {showAudioInfo && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAudioInfo(false)}
        >
          <div
            className="bg-gray-800 rounded-xl p-6 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-5xl block mb-4">🎵</span>
            <h3 className="text-lg font-bold text-white mb-3">
              Ajouter un fichier audio
            </h3>
            <div className="bg-blue-900/50 rounded-lg p-4 mb-4">
              <p className="text-blue-300 text-sm mb-2">
                📌 <strong>Formats acceptés :</strong>
              </p>
              <p className="text-gray-300 text-sm mb-3">
                MP3, WAV, M4A, OGG, FLAC...
              </p>
              <p className="text-yellow-400 font-semibold">
                ⚠️ Attention à la taille du fichier ! Maximum : 10 Mo
              </p>
            </div>
            <p className="text-gray-400 text-xs mb-4">
              Les fichiers plus volumineux peuvent être compressés avec un outil en ligne.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAudioInfo(false)}
                className="flex-1 py-3 bg-gray-700 text-white rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setShowAudioInfo(false);
                  if (audioInputRef.current) {
                    audioInputRef.current.click();
                  }
                }}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold"
              >
                📂 Choisir un fichier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input fichier audio */}
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        style={{ display: "none" }}
        onChange={handleAudioInput}
      />

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.2s ease-out forwards;
        }
      `}</style>
    </>
  );
}

export default FloatingActionButton;
