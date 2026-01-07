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

  const COLORS = [
    '#EF4444', '#F59E0B', '#10B981', '#3B82F6', 
    '#6366F1', '#8B5CF6', '#EC4899', '#6B7280'
  ];

  useEffect(() => {
    loadData();
  }, [scriptId, userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsData, tagsData] = await Promise.all([
        fetchReplicaGroups(scriptId, userId),
        fetchUserTags(userId)
      ]);
      setGroups(groupsData);
      setUserTags(tagsData);
    } catch (err) {
      console.error('Error loading groups:', err);
    }
    setLoading(false);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    
    try {
      await createReplicaGroup(scriptId, userId, newGroupName.trim(), newGroupColor, newGroupTagId);
      setNewGroupName('');
      setNewGroupTagId(null);
      setShowCreateForm(false);
      loadData();
    } catch (err) {
      console.error('Error creating group:', err);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!confirm('Supprimer ce groupe ?')) return;
    
    try {
      await deleteReplicaGroup(groupId);
      loadData();
    } catch (err) {
      console.error('Error deleting group:', err);
    }
  };

  const handleStartSelection = (group) => {
    setSelectingForGroup(group);
    // Pré-sélectionner les répliques déjà dans le groupe
    const existingIds = new Set(group.replica_group_items?.map(item => item.replica_id) || []);
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
      // Ajouter les nouvelles sélections
      await addReplicasToGroup(selectingForGroup.id, Array.from(selectedReplicas));
      setSelectingForGroup(null);
      setSelectedReplicas(new Set());
      loadData();
    } catch (err) {
      console.error('Error saving selection:', err);
    }
  };

  const handleStudyGroup = (group) => {
    // Passer les IDs des répliques du groupe au parent
    const replicaIds = group.replica_group_items?.map(item => item.replica_id) || [];
    onSelectGroup(replicaIds, group.name);
    onClose();
  };

  // Mode sélection des répliques
  if (selectingForGroup) {
    return (
      <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-lg max-h-[85vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
          <div className="p-4 border-b bg-primary-800 text-white">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-bold">Sélectionner les répliques</h2>
                <p className="text-sm text-primary-200">Pour : {selectingForGroup.name}</p>
              </div>
              <button onClick={() => setSelectingForGroup(null)} className="text-2xl">✕</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-sm text-gray-500 mb-3">
              {selectedReplicas.size} réplique(s) sélectionnée(s)
            </p>
            
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
                      <div className={`w-6 h-6 rounded flex items-center justify-center text-white text-sm ${
                        isSelected ? 'bg-primary-500' : 'bg-gray-300'
                      }`}>
                        {isSelected ? '✓' : index + 1}
                      </div>
                      <div className="flex-1">
                        <span 
                          className="text-xs font-bold"
                          style={{ color: character?.color }}
                        >
                          {character?.name}
                        </span>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {replica.text}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t bg-gray-50 flex gap-3">
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
            <button onClick={onClose} className="text-2xl">✕</button>
          </div>
          <p className="text-sm text-primary-200 mt-1">
            Regroupez des répliques pour les réviser ensemble
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-8">
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
                      className="p-4 rounded-xl border-2 shadow-sm"
                      style={{ borderColor: group.color }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: group.color }}
                          />
                          <span className="font-semibold">{group.name}</span>
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
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          {group.replica_group_items?.length || 0} réplique(s)
                        </span>
                        
                        {group.replica_group_items?.length > 0 && (
                          <button
                            onClick={() => handleStudyGroup(group)}
                            className="px-4 py-2 rounded-full text-sm font-semibold text-white"
                            style={{ backgroundColor: group.color }}
                          >
                            📖 Réviser
                          </button>
                        )}
                      </div>
                      
                      {group.user_tags && (
                        <div className="mt-2">
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
                <div className="p-4 bg-gray-50 rounded-xl border">
                  <h3 className="font-semibold mb-3">Nouveau sous-ensemble</h3>
                  
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Nom du groupe (ex: Acte 1, Scène finale...)"
                    className="w-full p-3 border rounded-lg mb-3"
                    autoFocus
                  />
                  
                  <div className="mb-3">
                    <label className="text-sm text-gray-600 block mb-2">Couleur</label>
                    <div className="flex gap-2 flex-wrap">
                      {COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => setNewGroupColor(color)}
                          className={`w-8 h-8 rounded-full transition ${
                            newGroupColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''
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
                        className="w-full p-2 border rounded-lg"
                      >
                        <option value="">Aucun tag</option>
                        {userTags.map(tag => (
                          <option key={tag.id} value={tag.id}>{tag.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleCreateGroup}
                      disabled={!newGroupName.trim()}
                      className="flex-1 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
                    >
                      Créer
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl
                             text-gray-500 hover:border-primary-500 hover:text-primary-600 transition"
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
