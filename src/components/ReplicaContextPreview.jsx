import { useState } from 'react';

/**
 * Composant modal pour afficher le contexte complet des répliques précédentes
 * Utile en mode lecture avec filtres pour éviter de surcharger le contexte
 */
export function ReplicaContextPreview({ 
  replicas, 
  characters, 
  currentReplicaIndex,
  onClose 
}) {
  const [currentViewIndex, setCurrentViewIndex] = useState(0);

  if (!replicas || replicas.length === 0 || currentReplicaIndex === undefined) {
    return null;
  }

  // Repliques précédentes à afficher
  const contextReplicas = replicas.slice(0, currentReplicaIndex);
  const totalContext = contextReplicas.length;

  if (totalContext === 0) {
    return null;
  }

  const displayReplica = contextReplicas[currentViewIndex];
  const character = characters.find(c => c.id === displayReplica?.character_id);

  const handlePrev = () => {
    setCurrentViewIndex(Math.max(0, currentViewIndex - 1));
  };

  const handleNext = () => {
    setCurrentViewIndex(Math.min(totalContext - 1, currentViewIndex + 1));
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[75] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-4 border-b bg-primary-800 text-white flex-shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">
              👁️ Contexte — Répliques précédentes
            </h2>
            <button 
              onClick={onClose} 
              className="text-2xl hover:text-gold-400"
              title="Fermer"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-primary-200 mt-1">
            {currentViewIndex + 1} / {totalContext} réplique(s) du contexte
          </p>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="bg-white p-6 rounded-lg border-2 border-gray-200">
            {/* Personnage & numéro */}
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-2">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: character?.color || '#999' }}
                />
                <p className="text-sm font-bold" style={{ color: character?.color || '#666' }}>
                  {character?.name || 'Unknown'} 
                  {' '}<span className="text-gray-500">#{displayReplica.order_in_script || currentViewIndex + 1}</span>
                </p>
              </div>
            </div>

            {/* Texte complet */}
            <div className="prose prose-sm max-w-none">
              <p className="text-lg text-gray-800 leading-relaxed whitespace-pre-wrap">
                {displayReplica.text}
              </p>
            </div>

            {/* Notes si présentes */}
            {displayReplica.personal_notes && displayReplica.personal_notes.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  📝 Notes personnelles :
                </p>
                <div className="space-y-2">
                  {displayReplica.personal_notes.map((note, idx) => (
                    <div key={idx} className="text-sm text-gray-700 bg-yellow-50 p-2 rounded">
                      {note.note_text}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="p-4 border-t bg-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
          <button
            onClick={handlePrev}
            disabled={currentViewIndex === 0}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold
                       hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            ← Précédent
          </button>

          <div className="text-sm text-gray-600 font-semibold">
            {currentViewIndex + 1} / {totalContext}
          </div>

          <button
            onClick={handleNext}
            disabled={currentViewIndex === totalContext - 1}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold
                       hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Suivant →
          </button>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-white border-t text-center">
          <button
            onClick={onClose}
            className="py-2 px-6 bg-primary-600 text-white rounded-full font-semibold
                       hover:bg-primary-700 transition"
          >
            ✓ Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReplicaContextPreview;
