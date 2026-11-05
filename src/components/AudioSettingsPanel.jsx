import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAudioSettings } from '../hooks/useAudioSettings';

/**
 * Panneau des paramètres audio
 * Configure les délais avant/après la réplique du comédien
 * Persiste dans Supabase via useAudioSettings hook
 */
export default function AudioSettingsPanel() {
  const { user } = useAuthStore();
  const {
    delayBeforeMs,
    delayAfterMs,
    loading,
    error,
    saveSettings,
  } = useAudioSettings(user?.id);

  const [localDelayBefore, setLocalDelayBefore] = useState(delayBeforeMs || 1500);
  const [localDelayAfter, setLocalDelayAfter] = useState(delayAfterMs || 1000);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTime, setPreviewTime] = useState(null);
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

  const delayBeforeOptions = [1000, 1500, 2000, 2500, 3000];
  const delayAfterOptions = [500, 1000, 1500, 2000];

  // Aperçu audio avec les délais
  const playPreview = async () => {
    setShowPreview(true);
    setPreviewTime('Lecture...');

    // Simule : 1s voix autres, délai, 2s MA voix, délai, 1.5s voix autres
    const beforeMs = 1000;
    const delayBeforeActual = parseInt(localDelayBefore);
    const myVoiceMs = 2000;
    const delayAfterActual = parseInt(localDelayAfter);
    const afterMs = 1500;
    const totalMs = beforeMs + delayBeforeActual + myVoiceMs + delayAfterActual + afterMs;

    setPreviewTime(`Total simulé : ${(totalMs / 1000).toFixed(1)}s`);

    // Attendre que la simulation se termine
    await new Promise(r => setTimeout(r, totalMs));
    setPreviewTime('Aperçu terminé ✅');
    setTimeout(() => setShowPreview(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* 📝 Introduction */}
      <div className="bg-primary-50 border-2 border-primary-300 rounded-xl p-6">
        <h3 className="text-lg font-bold text-primary-900 mb-2">⏱️ Délais personnalisés</h3>
        <p className="text-primary-700">
          Configurez des pauses avant et après votre réplique pour avoir le temps de vous préparer 
          et de respirer entre les échanges. Ces délais ne s'appliquent qu'en <strong>mode lecture audio</strong>.
        </p>
      </div>

      {/* Messages d'erreur/succès */}
      {error && (
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

      {loading && (
        <div className="text-center py-4 text-gray-500">⏳ Chargement...</div>
      )}

      {/* 🎯 Délai AVANT MA réplique */}
      <div className="card border-2 border-gold-200">
        <h4 className="font-bold text-primary-900 mb-4 flex items-center gap-2">
          <span className="text-xl">⏳ Avant MA réplique</span>
          <span className="text-sm bg-gold-100 text-gold-800 px-2 py-1 rounded">Recommandé : 1-2s</span>
        </h4>
        <p className="text-sm text-gray-600 mb-4">
          Pause avant que votre réplique soit lue. Vous avez le temps de vous préparer mentalement.
        </p>
        
        <select
          value={localDelayBefore}
          onChange={(e) => setLocalDelayBefore(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 font-semibold
                     focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {delayBeforeOptions.map(ms => (
            <option key={ms} value={ms}>
              {(ms / 1000).toFixed(1)}s
            </option>
          ))}
        </select>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            💡 <strong>Astuce :</strong> Utilisez ce délai si vous avez besoin de respirer avant de parler,
            ou si vous préférez avoir un moment pour lire votre réplique.
          </p>
        </div>
      </div>

      {/* 😤 Délai APRÈS MA réplique */}
      <div className="card border-2 border-gold-200">
        <h4 className="font-bold text-primary-900 mb-4 flex items-center gap-2">
          <span className="text-xl">⏸️ Après MA réplique</span>
          <span className="text-sm bg-gold-100 text-gold-800 px-2 py-1 rounded">Recommandé : 1s</span>
        </h4>
        <p className="text-sm text-gray-600 mb-4">
          Pause silencieuse après que vous ayez dit votre réplique. Permet de respirer avant la réplique suivante.
        </p>
        
        <select
          value={localDelayAfter}
          onChange={(e) => setLocalDelayAfter(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 font-semibold
                     focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {delayAfterOptions.map(ms => (
            <option key={ms} value={ms}>
              {(ms / 1000).toFixed(1)}s
            </option>
          ))}
        </select>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            💡 <strong>Cas d'usage :</strong> Quand vous avez besoin d'une pause après votre texte 
            (respiration, moment dramatique, etc.).
          </p>
        </div>
      </div>

      {/* 📊 Résumé des délais */}
      <div className="card bg-gradient-to-br from-primary-50 to-gold-50 border-2 border-primary-300">
        <h4 className="font-bold text-primary-900 mb-3">📊 Résumé de vos délais</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
            <span className="text-gray-600">⏳ Avant MA réplique</span>
            <span className="font-bold text-primary-600">{(parseInt(localDelayBefore) / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
            <span className="text-gray-600">⏸️ Après MA réplique</span>
            <span className="font-bold text-primary-600">{(parseInt(localDelayAfter) / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
            <span className="text-gray-600">⏱️ Temps total ajouté</span>
            <span className="font-bold text-gold-600">
              {((parseInt(localDelayBefore) + parseInt(localDelayAfter)) / 1000).toFixed(1)}s par réplique
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={playPreview}
          disabled={showPreview || loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                     text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
        >
          <span>🎧 Aperçu des délais</span>
          {showPreview && <span className="animate-spin">⌛</span>}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || loading || (delayBeforeMs === parseInt(localDelayBefore) && delayAfterMs === parseInt(localDelayAfter))}
          className="flex-1 bg-gradient-to-r from-primary-600 to-gold-600 
                     hover:from-primary-700 hover:to-gold-700 text-white font-bold py-3 px-4 rounded-lg 
                     transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '⏳ Sauvegarde...' : '💾 Sauvegarder'}
        </button>
      </div>

      {previewTime && (
        <div className="text-center p-4 bg-green-50 border-2 border-green-200 rounded-lg">
          <p className="text-green-700 font-semibold">{previewTime}</p>
        </div>
      )}

      {/* Note importante */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
        <p className="text-sm text-amber-900">
          <strong>⚠️ Note :</strong> Ces délais s'appliquent uniquement en <strong>mode Audio</strong> 
          lors de la lecture continu des répliques. En mode manuel (réplique par réplique), 
          vous contrôlez le rythme directement.
        </p>
      </div>
    </div>
  );
}
