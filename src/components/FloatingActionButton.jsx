import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Bouton flottant "+" avec menu d'actions
 * Affiché sur toutes les pages principales
 */
function FloatingActionButton({ onAddVideo, onAddAudio }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Ne pas afficher sur certaines pages
  const hiddenPages = ['/login', '/upload'];
  if (hiddenPages.some(p => location.pathname.startsWith(p))) {
    return null;
  }

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
      label: 'Enregistrer voix',
      color: 'bg-red-500',
      onClick: () => {
        if (onAddAudio) {
          onAddAudio();
        } else {
          // Si on est sur un script, ouvrir mode audio
          if (location.pathname.startsWith('/script/')) {
            const scriptId = location.pathname.split('/')[2];
            navigate(`/script/${scriptId}/audio`);
          } else {
            alert('Ouvrez d\'abord un texte pour enregistrer des voix');
          }
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
        } else {
          // Rediriger vers partage si pas de callback
          navigate('/shared');
        }
        setIsOpen(false);
      }
    },
  ];

  return (
    <>
      {/* Overlay pour fermer */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Menu d'actions */}
      <div className="fixed bottom-20 right-4 z-50">
        {/* Actions (visibles quand ouvert) */}
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

        {/* Bouton principal */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full shadow-lg
                     flex items-center justify-center text-2xl
                     transition-all duration-300 transform
                     ${isOpen 
                       ? 'bg-gray-700 text-white rotate-45' 
                       : 'bg-red-500 text-white hover:bg-red-400 hover:scale-110'}`}
        >
          ➕
        </button>
      </div>

      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.2s ease-out forwards;
        }
      `}</style>
    </>
  );
}

export default FloatingActionButton;
