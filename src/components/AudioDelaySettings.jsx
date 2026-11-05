import { useState } from 'react';
import { useAudioSettings } from '../hooks/useAudioSettings';

/**
 * Composant pour gérer les délais audio en mode lecture
 * Permet au comédien de configurer le temps d'attente
 * avant et après sa réplique
 */
export function AudioDelaySettings({ userId }) {
  const {
    delayBeforeMs,
    delayAfterMs,
    loading,
    error,
    saveSettings,
    delayBeforeOptions,
    delayAfterOptions,
  } = useAudioSettings(userId);

  const [localDelayBefore, setLocalDelayBefore] = useState(delayBeforeMs);
  const [localDelayAfter, setLocalDelayAfter] = useState(delayAfterMs);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await saveSettings(parseInt(localDelayBefore), parseInt(localDelayAfter));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4 text-gray-500">Chargement...</div>;
  }

  return (
    <div className="space-y-6 p-4 bg-white rounded-lg border border-gray-200">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          🔊 Paramètres audio — Délais d'attente
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Configurez le temps d'attente avant et après la lecture de votre réplique.
          Utile pour la mémorisation en situation.
        </p>
      </div>

      {error && !saveError && (
        <div className="p-3 bg-yellow-100 border border-yellow-400 rounded text-yellow-800 text-sm">
          ⚠️ {error}
        </div>
      )}

      {saveError && (
        <div className="p-3 bg-red-100 border border-red-400 rounded text-red-800 text-sm">
          ❌ {saveError}
        </div>
      )}

      {saveSuccess && (
        <div className="p-3 bg-green-100 border border-green-400 rounded text-green-800 text-sm">
          ✓ Paramètres sauvegardés
        </div>
      )}

      {/* Avant réplique */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          ⏱️ Délai avant votre réplique
        </label>
        <div className="flex items-center gap-4">
          <select
            value={localDelayBefore}
            onChange={(e) => setLocalDelayBefore(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg 
                       bg-white text-gray-900 font-semibold
                       focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {delayBeforeOptions.map(ms => (
              <option key={ms} value={ms}>
                {(ms / 1000).toFixed(1)}s
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-600 w-16 text-right">
            {(parseInt(localDelayBefore) / 1000).toFixed(1)}s
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Les autres acteurs finiront de parler, puis {(parseInt(localDelayBefore) / 1000).toFixed(1)}s d'attente avant votre réplique.
        </p>
      </div>

      {/* Après réplique */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          ⏱️ Délai après votre réplique
        </label>
        <div className="flex items-center gap-4">
          <select
            value={localDelayAfter}
            onChange={(e) => setLocalDelayAfter(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg 
                       bg-white text-gray-900 font-semibold
                       focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {delayAfterOptions.map(ms => (
              <option key={ms} value={ms}>
                {(ms / 1000).toFixed(1)}s
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-600 w-16 text-right">
            {(parseInt(localDelayAfter) / 1000).toFixed(1)}s
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Après votre réplique, attente de {(parseInt(localDelayAfter) / 1000).toFixed(1)}s avant la prochaine.
        </p>
      </div>

      {/* Chrono simulation */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <p className="text-sm font-semibold text-gray-700 mb-2">⏰ Simulation timeline</p>
        <div className="space-y-2 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="w-20">Réplique N-1</span>
            <div className="h-1 flex-1 bg-blue-300 rounded"></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20">Attente</span>
            <div 
              className="h-1 bg-yellow-300 rounded" 
              style={{ width: `${(parseInt(localDelayBefore) / 3000) * 100}%` }}
            ></div>
            <span className="text-xs">+{(parseInt(localDelayBefore) / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 font-bold text-primary-600">YOUR REPLICA</span>
            <div className="h-2 flex-1 bg-primary-400 rounded"></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20">Attente</span>
            <div 
              className="h-1 bg-yellow-300 rounded"
              style={{ width: `${(parseInt(localDelayAfter) / 2000) * 100}%` }}
            ></div>
            <span className="text-xs">+{(parseInt(localDelayAfter) / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20">Réplique N+1</span>
            <div className="h-1 flex-1 bg-blue-300 rounded"></div>
          </div>
        </div>
      </div>

      {/* Boutons */}
      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={handleSave}
          disabled={saving || (delayBeforeMs === parseInt(localDelayBefore) && delayAfterMs === parseInt(localDelayAfter))}
          className="flex-1 py-3 bg-primary-600 text-white rounded-lg font-semibold
                     hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? '⏳ Sauvegarde...' : '✓ Sauvegarder'}
        </button>
      </div>
    </div>
  );
}

export default AudioDelaySettings;
