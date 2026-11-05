import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

/**
 * Panneau des paramètres audio
 * Configure les délais avant/après la réplique du comédien
 */
export default function AudioSettingsPanel() {
  const { audioPreferences, updateAudioPreferences } = useAuthStore();
  const [localPrefs, setLocalPrefs] = useState(audioPreferences || {});
  const [showPreview, setShowPreview] = useState(false);
  const [previewTime, setPreviewTime] = useState(null);

  useEffect(() => {
    setLocalPrefs(audioPreferences || {});
  }, [audioPreferences]);

  const handleDelayChange = (key, value) => {
    const numValue = parseFloat(value);
    setLocalPrefs(prev => ({
      ...prev,
      [key]: numValue
    }));
  };

  const handleSave = () => {
    updateAudioPreferences(localPrefs);
    alert('✅ Paramètres audio sauvegardés');
  };

  const delayOptions = [
    { value: 0, label: 'Aucune (0s)' },
    { value: 1, label: '1 seconde' },
    { value: 1.5, label: '1.5 secondes' },
    { value: 2, label: '2 secondes' },
    { value: 2.5, label: '2.5 secondes' },
    { value: 3, label: '3 secondes' },
  ];

  const afterDelayOptions = [
    { value: 0, label: 'Aucune (0s)' },
    { value: 1, label: '1 seconde' },
    { value: 2, label: '2 secondes' },
    { value: 3, label: '3 secondes' },
  ];

  // Aperçu audio avec les délais
  const playPreview = async () => {
    setShowPreview(true);
    setPreviewTime('Lecture...');

    // Simule : 1s voix autres, délai, 2s MA voix, délai, 1.5s voix autres
    const beforeMs = 1000;
    const delayBeforeMs = (localPrefs.delayBeforeMine || 0) * 1000;
    const myVoiceMs = 2000;
    const delayAfterMs = (localPrefs.delayAfterMine || 0) * 1000;
    const afterMs = 1500;
    const totalMs = beforeMs + delayBeforeMs + myVoiceMs + delayAfterMs + afterMs;

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

      {/* 🎯 Délai AVANT MA réplique */}
      <div className="card border-2 border-gold-200">
        <h4 className="font-bold text-primary-900 mb-4 flex items-center gap-2">
          <span className="text-xl">⏳ Avant MA réplique</span>
          <span className="text-sm bg-gold-100 text-gold-800 px-2 py-1 rounded">Recommandé : 1-2s</span>
        </h4>
        <p className="text-sm text-gray-600 mb-4">
          Pause avant que votre réplique soit lue. Vous avez le temps de vous préparer mentalement.
        </p>
        
        <div className="space-y-3">
          <div className="flex gap-3">
            {delayOptions.slice(0, 3).map(opt => (
              <button
                key={opt.value}
                onClick={() => handleDelayChange('delayBeforeMine', opt.value)}
                className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all ${
                  localPrefs.delayBeforeMine === opt.value
                    ? 'bg-primary-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            {delayOptions.slice(3).map(opt => (
              <button
                key={opt.value}
                onClick={() => handleDelayChange('delayBeforeMine', opt.value)}
                className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all ${
                  localPrefs.delayBeforeMine === opt.value
                    ? 'bg-primary-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

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
        
        <div className="flex gap-3">
          {afterDelayOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleDelayChange('delayAfterMine', opt.value)}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all ${
                localPrefs.delayAfterMine === opt.value
                  ? 'bg-primary-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            💡 <strong>Cas d'usage :</strong> Quand vous avez besoin d'une pause après votre texte 
            (respiration, moment dramatique, etc.).
          </p>
        </div>
      </div>

      {/* 🎬 Délai AVANT la réplique suivante (Advanced) */}
      <div className="card border-2 border-gray-200 opacity-60">
        <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
          <span className="text-xl">⏭️ Avant la réplique suivante</span>
          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">À venir</span>
        </h4>
        <p className="text-sm text-gray-600">
          Cette option sera bientôt disponible pour configurer la pause avant la réplique de l'autre comédien.
        </p>
      </div>

      {/* 📊 Aperçu des délais */}
      <div className="card bg-gradient-to-br from-primary-50 to-gold-50 border-2 border-primary-300">
        <h4 className="font-bold text-primary-900 mb-3">📊 Résumé de vos délais</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
            <span className="text-gray-600">⏳ Avant MA réplique</span>
            <span className="font-bold text-primary-600">{localPrefs.delayBeforeMine || 0}s</span>
          </div>
          <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
            <span className="text-gray-600">⏸️ Après MA réplique</span>
            <span className="font-bold text-primary-600">{localPrefs.delayAfterMine || 0}s</span>
          </div>
          <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
            <span className="text-gray-600">⏱️ Temps total ajouté</span>
            <span className="font-bold text-gold-600">
              {(localPrefs.delayBeforeMine || 0) + (localPrefs.delayAfterMine || 0)}s par réplique
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={playPreview}
          disabled={showPreview}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                     text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
        >
          <span>🎧 Aperçu des délais</span>
          {showPreview && <span className="animate-spin">⌛</span>}
        </button>
        <button
          onClick={handleSave}
          className="flex-1 bg-gradient-to-r from-primary-600 to-gold-600 
                     hover:from-primary-700 hover:to-gold-700 text-white font-bold py-3 px-4 rounded-lg 
                     transition-all shadow-lg"
        >
          💾 Sauvegarder
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
