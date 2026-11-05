import { useState, useEffect } from 'react';
import { addReplicasToGroup } from '../lib/supabase';

/**
 * Modal pour éditer les répliques d'un groupe existant
 * Remplace complètement la sélection et sauvegarde via addReplicasToGroup
 */
export function GroupEditorModal({
  group,
  replicas,
  characters,
  onSave,
  onClose,
}) {
  const [selectedReplicas, setSelectedReplicas] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Pré-sélectionner les répliques déjà dans le groupe
  useEffect(() => {
    if (group?.replica_group_items) {
      const existingIds = new Set(
        group.replica_group_items.map(item => item.replica_id)
      );
      setSelectedReplicas(existingIds);
    }
  }, [group]);

  const handleToggleReplica = (replicaId) => {
    setSelectedReplicas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(replicaId)) {
        newSet.delete(replicaId);
      } else {
        newSet.add(replicaId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!group) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const replicaIds = Array.from(selectedReplicas);
      await addReplicasToGroup(group.id, replicaIds);
      onSave?.(replicaIds);
      onClose();
    } catch (err) {
      console.error('Error saving group:', err);
      setError('Erreur sauvegarde: ' + err.message);
      setSaving(false);
    }
  };

  const selectedCount = selectedReplicas.size;

  return (
    <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg max-h-[85vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b bg-primary-800 text-white flex-shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">
              ✏️ Éditer {group?.name}
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
            {selectedCount} réplique(s) sélectionnée(s)
          </p>
        </div>

        {/* Erreur */}
        {error && (
          <div className="p-3 bg-red-100 border-b border-red-400 text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Liste des répliques */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {replicas.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucune réplique dans ce script
              </div>
            ) : (
              replicas.map((replica, index) => {
                const character = characters.find(c => c.id === replica.character_id);
                const isSelected = selectedReplicas.has(replica.id);
                
                return (
                  <div
                    key={replica.id}
                    onClick={() => handleToggleReplica(replica.id)}
                    className={`p-3 rounded-lg cursor-pointer transition border-2 ${
                      isSelected 
                        ? 'border-primary-500 bg-primary-50' 
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                        isSelected 
                          ? 'bg-primary-500 text-white' 
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {isSelected ? '✓' : index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold mb-1" style={{ color: character?.color || '#666' }}>
                          #{replica.order_in_script || index + 1} — {character?.name || 'Unknown'}
                        </p>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {replica.text}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-full font-semibold
                       hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selectedCount === 0}
            className="flex-1 py-3 bg-primary-600 text-white rounded-full font-semibold
                       hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? '⏳ Sauvegarde...' : `✓ Sauvegarder (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupEditorModal;
