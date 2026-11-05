import { useState, useEffect } from 'react';

/**
 * Hook pour déterminer si l'utilisateur est en ligne ou hors ligne
 * Écoute les événements 'online' et 'offline' du navigateur
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() => {
    // Vérifier l'état initial du navigateur
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => {
      console.log('[useOnlineStatus] Application went online');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('[useOnlineStatus] Application went offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

export default useOnlineStatus;
