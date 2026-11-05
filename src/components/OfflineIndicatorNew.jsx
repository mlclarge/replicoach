import { useState, useEffect } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Composant pour afficher le statut hors ligne de l'application PWA
 * Badge avec couleur + tooltip avec date de dernière synchro
 */
export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const [lastSyncDate, setLastSyncDate] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // Récupérer la date de dernière synchro du localStorage
  useEffect(() => {
    const stored = localStorage.getItem('last_sync_date');
    if (stored) {
      setLastSyncDate(new Date(stored));
    }
  }, []);

  // Mettre à jour la date de synchro lors du retour en ligne
  useEffect(() => {
    if (isOnline) {
      const now = new Date().toISOString();
      localStorage.setItem('last_sync_date', now);
      setLastSyncDate(new Date(now));
    }
  }, [isOnline]);

  const formatSyncDate = (date) => {
    if (!date) return 'Jamais';
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes}m`;
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${days}j`;
  };

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold transition ${
          isOnline
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
        }`}
        title={isOnline ? 'Connecté à internet' : 'Mode hors ligne - Données en cache'}
      >
        <span className={`text-lg ${isOnline ? '' : 'animate-pulse'}`}>
          {isOnline ? '📶' : '📵'}
        </span>
        <span className="hidden sm:inline">
          {isOnline ? 'Connecté' : 'Hors ligne'}
        </span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full mt-2 right-0 bg-gray-800 text-white text-xs rounded-lg p-3 whitespace-nowrap z-[50] shadow-lg">
          {isOnline ? (
            <>
              <div className="font-semibold mb-1">✓ Connecté</div>
              <div>Dernière synchro : {formatSyncDate(lastSyncDate)}</div>
            </>
          ) : (
            <>
              <div className="font-semibold mb-1">📵 Hors ligne</div>
              <div>Données en cache</div>
              <div className="mt-2 text-yellow-300">
                La synchro reprendra lors de la reconnexion
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default OfflineIndicator;
