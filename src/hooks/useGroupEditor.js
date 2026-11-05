import { useState, useCallback } from 'react';
import { addReplicasToGroup } from '../lib/supabase';

/**
 * Hook pour gérer l'édition des groupes de répliques
 * Gère l'état de sélection, sauvegarde, et erreurs
 */
export const useGroupEditor = () => {
  const [editingGroup, setEditingGroup] = useState(null);
  const [selectedReplicas, setSelectedReplicas] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Ouvrir l'éditeur pour un groupe
  const openEditor = useCallback((group) => {
    setEditingGroup(group);
    setError(null);
    
    // Pré-sélectionner les répliques déjà dans le groupe
    if (group?.replica_group_items) {
      const existingIds = new Set(
        group.replica_group_items.map(item => item.replica_id)
      );
      setSelectedReplicas(existingIds);
    } else {
      setSelectedReplicas(new Set());
    }
  }, []);

  // Fermer l'éditeur
  const closeEditor = useCallback(() => {
    setEditingGroup(null);
    setSelectedReplicas(new Set());
    setError(null);
  }, []);

  // Basculer une réplique
  const toggleReplica = useCallback((replicaId) => {
    setSelectedReplicas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(replicaId)) {
        newSet.delete(replicaId);
      } else {
        newSet.add(replicaId);
      }
      return newSet;
    });
  }, []);

  // Sauvegarder l'édition
  const saveChanges = useCallback(async () => {
    if (!editingGroup) return;

    setSaving(true);
    setError(null);

    try {
      const replicaIds = Array.from(selectedReplicas);
      
      if (replicaIds.length === 0) {
        throw new Error('Au moins une réplique doit être sélectionnée');
      }

      await addReplicasToGroup(editingGroup.id, replicaIds);
      
      return {
        success: true,
        groupId: editingGroup.id,
        replicaIds,
        count: replicaIds.length
      };
    } catch (err) {
      console.error('Error saving group:', err);
      const errorMessage = err.message || 'Erreur lors de la sauvegarde';
      setError(errorMessage);
      setSaving(false);
      throw err;
    }
  }, [editingGroup, selectedReplicas]);

  return {
    editingGroup,
    selectedReplicas,
    saving,
    error,
    openEditor,
    closeEditor,
    toggleReplica,
    saveChanges,
    selectedCount: selectedReplicas.size,
  };
};

export default useGroupEditor;
