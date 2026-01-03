import { useState, useEffect } from 'react';

/**
 * Composant qui affiche un indicateur quand l'utilisateur est hors-ligne
 * et informe sur le mode cache - DISPARAÎT APRÈS 5 SECONDES
 */
function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Montrer brièvement le message "Connexion rétablie"
        setShowBanner(true);
        setTimeout(() => setShowBanner(false), 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowBanner(true);
      // Masquer le bandeau après 5 secondes
      setTimeout(() => setShowBanner(false), 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Vérifier l'état initial
    if (!navigator.onLine) {
      setIsOnline(false);
      setShowBanner(true);
      // Masquer après 5 secondes au chargement aussi
      setTimeout(() => setShowBanner(false), 5000);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  if (!showBanner) return null;

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
        showBanner ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div 
        className={`px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 ${
          isOnline 
            ? 'bg-green-600 text-white' 
            : 'bg-amber-500 text-amber-950'
        }`}
      >
        {isOnline ? (
          <span>✅ Connexion rétablie</span>
        ) : (
          <span>📴 Mode hors-ligne • Les textes déjà consultés restent accessibles</span>
        )}
        {/* Bouton pour fermer manuellement */}
        <button 
          onClick={() => setShowBanner(false)}
          className="ml-2 p-1 hover:bg-black/10 rounded"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default OfflineIndicator;
