import { useState, useEffect } from 'react';
import { getActiveUsersCount, updateUserSession } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useLocation } from 'react-router-dom';

/**
 * Hook pour tracker la session utilisateur
 */
export function useSessionTracker() {
  const { user } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;

    // Mettre à jour immédiatement
    updateUserSession(user.id, location.pathname);

    // Mettre à jour toutes les 30 secondes
    const interval = setInterval(() => {
      updateUserSession(user.id, location.pathname);
    }, 30000);

    return () => clearInterval(interval);
  }, [user, location.pathname]);
}

/**
 * Composant pour afficher le monitoring (admin only)
 */
export function MonitoringBadge({ className = '' }) {
  const [activeUsers, setActiveUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadCount = async () => {
    try {
      const count = await getActiveUsersCount();
      setActiveUsers(count);
    } catch (err) {
      console.error('Error loading active users:', err);
    }
    setLoading(false);
  };

  if (loading) return null;

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      <span className={`w-2 h-2 rounded-full ${activeUsers > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
      <span className="text-gray-600">
        {activeUsers} utilisateur{activeUsers > 1 ? 's' : ''} en ligne
      </span>
    </div>
  );
}

/**
 * Page/Section monitoring complète
 */
export function MonitoringPanel() {
  const [activeUsers, setActiveUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    loadCount();
    const interval = setInterval(() => {
      loadCount();
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadCount = async () => {
    try {
      const count = await getActiveUsersCount();
      setActiveUsers(count);
    } catch (err) {
      console.error('Error:', err);
    }
    setLoading(false);
  };

  const getStatusColor = () => {
    if (activeUsers < 20) return 'bg-green-500';
    if (activeUsers < 40) return 'bg-yellow-500';
    if (activeUsers < 55) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (activeUsers < 20) return 'Charge normale';
    if (activeUsers < 40) return 'Charge modérée';
    if (activeUsers < 55) return 'Charge élevée';
    return '⚠️ Proche de la limite !';
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border">
      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        📊 Monitoring
      </h3>

      {loading ? (
        <p className="text-gray-500">Chargement...</p>
      ) : (
        <div className="space-y-3">
          {/* Jauge */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Connexions actives</span>
              <span className="font-bold">{activeUsers} / 60</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${getStatusColor()}`}
                style={{ width: `${Math.min((activeUsers / 60) * 100, 100)}%` }}
              />
            </div>
            <p className={`text-xs mt-1 ${activeUsers >= 55 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
              {getStatusText()}
            </p>
          </div>

          {/* Info */}
          <div className="text-xs text-gray-400">
            Dernière mise à jour : {lastRefresh.toLocaleTimeString()}
          </div>

          {/* Alerte si proche de la limite */}
          {activeUsers >= 50 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ⚠️ <strong>Attention :</strong> Vous approchez de la limite de 60 connexions simultanées (plan gratuit Supabase).
              Envisagez de passer au plan Pro si nécessaire.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MonitoringBadge;
