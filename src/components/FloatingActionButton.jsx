import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUserRole, addGlobalVideo } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

/**
 * Bouton flottant "+" - GAUCHE - BLEU
 */
function FloatingActionButton({ onAddVideo, onAddAudio, onRecordFree }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showVideoInfo, setShowVideoInfo] = useState(false);
  const [userRole, setUserRole] = useState('member');
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoSaving, setVideoSaving] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.id) {
      getUserRole(user.id).then(setUserRole);
    }
  }, [user]);

  const hiddenPages = ['/login', '/upload', '/recordings'];
  if (hiddenPages.some(p => location.pathname.startsWith(p))) {
    return null;
  }

  const canPostVideoAnywhere = userRole === 'dev' || userRole === 'director';

  const actions = [
    {
      icon: '📄',
      label: 'Nouveau texte',
      color: 'bg-gold-500',
      onClick: () => {
        navigate('/upload');
        setIsOpen(false);
      }
    },
    {
      icon: '🎙️',
      label: 'Voix personnage',
      color: 'bg-red-500',
      onClick: () => {
        if (onAddAudio) {
          onAddAudio();
        } else if (location.pathname.startsWith('/script/')) {
          const scriptId = location.pathname.split('/')[2];
          navigate(`/script/${scriptId}/audio`);
        } else {
          alert('Ouvrez d\'abord un texte pour enregistrer des voix de personnages');
        }
        setIsOpen(false);
      }
    },
    {
      icon: '🎤',
      label: 'Enregistrement libre',
      color: 'bg-orange-500',
      onClick: () => {
        if (onRecordFree) {
          onRecordFree();
        } else {
          navigate('/recordings');
        }
        setIsOpen(false);
      }
    },
    {
      icon: '📹',
      label: 'Ajouter vidéo',
      color: 'bg-purple-500',
      onClick: () => {
        if (onAddVideo) {
          onAddVideo();
        } else if (canPostVideoAnywhere) {
          setShowVideoModal(true); // Ouvrir modal directement
        } else {
          setShowVideoInfo(true);
        }
        setIsOpen(false);
      }
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

      <div className="fixed bottom-20 left-4 z-50">
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
                <span className="text-sm whitespace-nowrap">{action.label}</span>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full shadow-lg
                     flex items-center justify-center text-2xl
                     transition-all duration-300 transform
                     ${isOpen 
                       ? 'bg-gray-700 text-white rotate-45' 
                       : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-110'}`}
        >
          ➕
        </button>
      </div>

      {showVideoInfo && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowVideoInfo(false)}
        >
          <div 
            className="bg-gray-800 rounded-xl p-6 max-w-sm w-full text-center"
            onClick={e => e.stopPropagation()}
          >
            <span className="text-5xl block mb-4">📹</span>
            <h3 className="text-lg font-bold text-white mb-3">Ajouter une vidéo</h3>
            <p className="text-gray-400 mb-4">
              Pour ajouter une vidéo YouTube, allez dans <strong>Partagés</strong> et sélectionnez votre troupe.
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
                  navigate('/shared');
                }}
                className="flex-1 py-3 bg-primary-600 text-white rounded-lg"
              >
                Aller aux Partagés
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ajout vidéo globale */}
      {showVideoModal && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowVideoModal(false)}
        >
          <div 
            className="bg-gray-800 rounded-xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-4">📹 Ajouter une vidéo YouTube</h3>
            
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
              placeholder="URL YouTube (ex: https://youtube.com/watch?v=...)"
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg mb-4"
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowVideoModal(false);
                  setVideoUrl('');
                  setVideoTitle('');
                }}
                className="flex-1 py-3 bg-gray-700 text-white rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (!videoUrl.trim() || !videoTitle.trim()) {
                    alert('Titre et URL requis');
                    return;
                  }
                  setVideoSaving(true);
                  try {
                    await addGlobalVideo(user.id, videoTitle, videoUrl);
                    alert('Vidéo ajoutée !');
                    setShowVideoModal(false);
                    setVideoUrl('');
                    setVideoTitle('');
                  } catch (err) {
                    alert('Erreur: ' + err.message);
                  }
                  setVideoSaving(false);
                }}
                disabled={videoSaving || !videoUrl.trim() || !videoTitle.trim()}
                className="flex-1 py-3 bg-purple-600 text-white rounded-lg disabled:opacity-50"
              >
                {videoSaving ? '...' : '📤 Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

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
