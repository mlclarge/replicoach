import { useState, useEffect } from 'react';

/**
 * Composant qui affiche un indicateur quand l'utilisateur est hors-ligne
 * et informe sur le mode cache
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
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Vérifier l'état initial
    if (!navigator.onLine) {
      setIsOnline(false);
      setShowBanner(true);
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
        className={`px-4 py-2 text-center text-sm font-medium ${
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
      </div>
    </div>
  );
}

export default OfflineIndicator;
