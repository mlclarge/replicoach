import { useState, useEffect } from 'react';
import { 
  createReplicaGroup, 
  fetchReplicaGroups, 
  addReplicasToGroup,
  removeReplicaFromGroup,
  deleteReplicaGroup,
  updateReplicaGroup,
  fetchUserTags 
} from '../lib/supabase';

/**
 * Modal pour gérer les sous-ensembles de répliques
 */
export function ReplicaGroupsManager({ 
  scriptId, 
  userId, 
  replicas, 
  characters,
  onClose,
  onSelectGroup 
}) {
  const [groups, setGroups] = useState([]);
  const [userTags, setUserTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#6366F1');
  const [newGroupTagId, setNewGroupTagId] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [selectingForGroup, setSelectingForGroup] = useState(null);
  const [selectedReplicas, setSelectedReplicas] = useState(new Set());
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  const COLORS = [
    '#EF4444', '#F59E0B', '#10B981', '#3B82F6', 
    '#6366F1', '#8B5CF6', '#EC4899', '#6B7280'
  ];

  useEffect(() => {
    loadData();
  }, [scriptId, userId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupsData, tagsData] = await Promise.all([
        fetchReplicaGroups(scriptId, userId),
        fetchUserTags(userId)
      ]);
      setGroups(groupsData);
      setUserTags(tagsData);
    } catch (err) {
      console.error('Error loading groups:', err);
      setError('Erreur chargement: ' + err.message);
    }
    setLoading(false);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      setError('Veuillez entrer un nom pour le groupe');
      return;
    }
    
    setCreating(true);
    setError(null);
    
    try {
      console.log('Creating group:', { scriptId, userId, name: newGroupName.trim(), color: newGroupColor });
      const result = await createReplicaGroup(scriptId, userId, newGroupName.trim(), newGroupColor, newGroupTagId);
      console.log('Group created:', result);
      setNewGroupName('');
      setNewGroupTagId(null);
      setShowCreateForm(false);
      await loadData();
    } catch (err) {
      console.error('Error creating group:', err);
      setError('Erreur création: ' + err.message);
    }
    setCreating(false);
  };

  const handleDeleteGroup = async (groupId) => {
    if (!confirm('Supprimer ce groupe ?')) return;
    
    try {
      await deleteReplicaGroup(groupId);
      loadData();
    } catch (err) {
      console.error('Error deleting group:', err);
      setError('Erreur suppression: ' + err.message);
    }
  };

  const handleStartSelection = (group) => {
    setSelectingForGroup(group);
    // Pré-sélectionner les répliques déjà dans le groupe
    const existingIds = new Set(
      group.replica_group_items?.map(item => item.replica_id) || []
    );
    setSelectedReplicas(existingIds);
  };

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

  const handleSaveSelection = async () => {
    if (!selectingForGroup) return;
    
    try {
      const replicaIds = Array.from(selectedReplicas);
      await addReplicasToGroup(selectingForGroup.id, replicaIds);
      setSelectingForGroup(null);
      setSelectedReplicas(new Set());
      loadData();
    } catch (err) {
      console.error('Error saving selection:', err);
      setError('Erreur sauvegarde: ' + err.message);
    }
  };

  const handleStudyGroup = (group) => {
    const replicaIds = group.replica_group_items?.map(item => item.replica_id) || [];
    onSelectGroup({ replicaIds, name: group.name, color: group.color });
    onClose();
  };

  // Mode sélection de répliques
  if (selectingForGroup) {
    return (
      <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-lg max-h-[85vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
          <div className="p-4 border-b bg-primary-800 text-white flex-shrink-0">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">
                Sélectionner les répliques
              </h2>
              <button 
                onClick={() => setSelectingForGroup(null)} 
                className="text-2xl hover:text-gold-400"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-primary-200 mt-1">
              {selectingForGroup.name} • {selectedReplicas.size} sélectionnée(s)
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {replicas.map((replica, index) => {
                const character = characters.find(c => c.id === replica.character_id);
                const isSelected = selectedReplicas.has(replica.id);
                
                return (
                  <div
                    key={replica.id}
                    onClick={() => handleToggleReplica(replica.id)}
                    className={`p-3 rounded-lg cursor-pointer transition border-2 ${
                      isSelected 
                        ? 'border-primary-500 bg-primary-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {isSelected ? '✓' : index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold mb-1" style={{ color: character?.color }}>
                          {character?.name}
                        </p>
                        <p className="text-sm text-gray-700 line-clamp-2">{replica.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t bg-gray-50 flex gap-3 flex-shrink-0">
            <button
              onClick={() => setSelectingForGroup(null)}
              className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-full font-semibold"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveSelection}
              className="flex-1 py-3 bg-primary-600 text-white rounded-full font-semibold"
            >
              Enregistrer ({selectedReplicas.size})
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg max-h-[80vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b bg-primary-800 text-white flex-shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">📚 Sous-ensembles</h2>
            <button onClick={onClose} className="text-2xl hover:text-gold-400">✕</button>
          </div>
          <p className="text-sm text-primary-200 mt-1">
            Regroupez des répliques pour les réviser ensemble
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-8">
          {/* Erreur */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 rounded-lg text-red-700 text-sm">
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-500">Chargement...</div>
          ) : (
            <>
              {/* Liste des groupes */}
              {groups.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-4xl mb-2">📚</p>
                  <p className="text-gray-500">Aucun sous-ensemble</p>
                  <p className="text-sm text-gray-400">Créez-en un pour commencer</p>
                </div>
              ) : (
                <div className="space-y-3 mb-4">
                  {groups.map(group => (
                    <div 
                      key={group.id}
                      className="p-4 rounded-xl border-2 shadow-sm bg-white"
                      style={{ borderColor: group.color }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: group.color }}
                          />
                          <span className="font-semibold text-gray-800">{group.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleStartSelection(group)}
                            className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded"
                            title="Modifier les répliques"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(group.id)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Supprimer"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-500 mb-3">
                        {group.replica_group_items?.length || 0} réplique(s)
                      </p>
                      
                      {(group.replica_group_items?.length || 0) > 0 && (
                        <button
                          onClick={() => handleStudyGroup(group)}
                          className="w-full py-2 text-white rounded-lg font-semibold text-sm"
                          style={{ backgroundColor: group.color }}
                        >
                          📖 Réviser ce groupe
                        </button>
                      )}
                      
                      {group.user_tags && (
                        <div className="mt-2 pt-2 border-t">
                          <span 
                            className="text-xs px-2 py-1 rounded-full"
                            style={{ 
                              backgroundColor: group.user_tags.color + '20',
                              color: group.user_tags.color 
                            }}
                          >
                            {group.user_tags.name}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Formulaire création */}
              {showCreateForm ? (
                <div className="p-4 bg-gray-100 rounded-xl border border-gray-300">
                  <h3 className="font-semibold mb-3 text-gray-800">Nouveau sous-ensemble</h3>
                  
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Nom du groupe (ex: Acte 1, Scène finale...)"
                    className="w-full p-3 border border-gray-300 rounded-lg mb-3 
                               bg-white text-gray-900 placeholder-gray-400
                               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    autoFocus
                  />
                  
                  <div className="mb-3">
                    <label className="text-sm text-gray-600 block mb-2">Couleur</label>
                    <div className="flex gap-2 flex-wrap">
                      {COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewGroupColor(color)}
                          className={`w-8 h-8 rounded-full transition ${
                            newGroupColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  {userTags.length > 0 && (
                    <div className="mb-3">
                      <label className="text-sm text-gray-600 block mb-2">Tag (optionnel)</label>
                      <select
                        value={newGroupTagId || ''}
                        onChange={(e) => setNewGroupTagId(e.target.value || null)}
                        className="w-full p-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                      >
                        <option value="">Aucun tag</option>
                        {userTags.map(tag => (
                          <option key={tag.id} value={tag.id}>{tag.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewGroupName('');
                        setError(null);
                      }}
                      className="flex-1 py-3 bg-gray-300 text-gray-700 rounded-lg font-semibold"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateGroup}
                      disabled={!newGroupName.trim() || creating}
                      className="flex-1 py-3 bg-primary-600 text-white rounded-lg font-semibold 
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creating ? '⏳ Création...' : '✓ Créer'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setShowCreateForm(true);
                    setError(null);
                  }}
                  className="w-full py-4 border-2 border-dashed border-gray-400 rounded-xl
                             text-gray-600 hover:border-primary-500 hover:text-primary-600 
                             transition font-semibold"
                >
                  + Créer un sous-ensemble
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReplicaGroupsManager;
