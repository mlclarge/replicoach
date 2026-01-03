import { useState, useEffect } from 'react';
import {
  fetchUserTags,
  createTag,
  deleteTag,
  updateTag,
  fetchScriptTags,
  addTagToScript,
  removeTagFromScript,
} from '../lib/supabase';

// Couleurs prédéfinies pour les tags
const TAG_COLORS = [
  '#22C55E', // Vert
  '#EF4444', // Rouge
  '#3B82F6', // Bleu
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#EC4899', // Rose
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#84CC16', // Lime
  '#6366F1', // Indigo
];

/**
 * Modal pour gérer les tags d'un script
 */
export function ScriptTagsModal({ scriptId, scriptTitle, userId, onClose }) {
  const [userTags, setUserTags] = useState([]);
  const [scriptTags, setScriptTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tags, sTags] = await Promise.all([
        fetchUserTags(userId),
        fetchScriptTags(scriptId),
      ]);
      setUserTags(tags);
      setScriptTags(sTags);
    } catch (err) {
      console.error('Error loading tags:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setSaving(true);
    try {
      const newTag = await createTag(userId, newTagName.trim(), newTagColor);
      setUserTags([...userTags, newTag]);
      setNewTagName('');
      setShowCreateTag(false);
    } catch (err) {
      console.error('Error creating tag:', err);
      alert('Erreur lors de la création du tag');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTag = async (tag) => {
    const isTagged = scriptTags.some(t => t.id === tag.id);
    setSaving(true);
    try {
      if (isTagged) {
        await removeTagFromScript(scriptId, tag.id);
        setScriptTags(scriptTags.filter(t => t.id !== tag.id));
      } else {
        await addTagToScript(scriptId, tag.id);
        setScriptTags([...scriptTags, tag]);
      }
    } catch (err) {
      console.error('Error toggling tag:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTag = async (tagId) => {
    if (!confirm('Supprimer ce tag de tous vos textes ?')) return;
    try {
      await deleteTag(tagId);
      setUserTags(userTags.filter(t => t.id !== tagId));
      setScriptTags(scriptTags.filter(t => t.id !== tagId));
    } catch (err) {
      console.error('Error deleting tag:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-dark rounded-xl max-w-md w-full border border-gray-700 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">🏷️ Tags</h3>
            <p className="text-gray-500 text-xs truncate">{scriptTitle}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2">✕</button>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8">
              <span className="animate-spin text-2xl">⏳</span>
            </div>
          ) : (
            <>
              {/* Tags existants */}
              <div className="space-y-2 mb-4">
                {userTags.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">
                    Aucun tag créé.<br />Créez votre premier tag ci-dessous !
                  </p>
                ) : (
                  userTags.map(tag => {
                    const isSelected = scriptTags.some(t => t.id === tag.id);
                    return (
                      <div 
                        key={tag.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition
                          ${isSelected 
                            ? 'bg-gray-700 ring-2 ring-offset-2 ring-offset-dark' 
                            : 'bg-gray-800 hover:bg-gray-700'}`}
                        style={isSelected ? { ringColor: tag.color } : {}}
                        onClick={() => handleToggleTag(tag)}
                      >
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1 text-white">{tag.name}</span>
                        {isSelected && (
                          <span className="text-green-400">✓</span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTag(tag.id);
                          }}
                          className="p-1 text-gray-500 hover:text-red-400 transition"
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Créer un nouveau tag */}
              {showCreateTag ? (
                <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Nom du tag..."
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white text-sm"
                    autoFocus
                  />
                  
                  <div>
                    <p className="text-gray-400 text-xs mb-2">Couleur</p>
                    <div className="flex gap-2 flex-wrap">
                      {TAG_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => setNewTagColor(color)}
                          className={`w-8 h-8 rounded-full transition ${
                            newTagColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800' : ''
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCreateTag(false)}
                      className="flex-1 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleCreateTag}
                      disabled={!newTagName.trim() || saving}
                      className="flex-1 py-2 bg-gold-500 text-dark font-semibold rounded-lg text-sm
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? '...' : 'Créer'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateTag(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-600 hover:border-primary-500
                             rounded-lg text-gray-400 hover:text-primary-400 text-sm transition"
                >
                  ➕ Créer un nouveau tag
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-semibold"
          >
            Terminé
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Affichage des tags d'un script (badges)
 */
export function ScriptTagBadges({ tags = [], size = 'sm' }) {
  if (!tags || tags.length === 0) return null;

  const sizeClasses = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
  };

  return (
    <div className="flex gap-1 flex-wrap">
      {tags.map(tag => (
        <span
          key={tag.id}
          className={`rounded-full font-medium ${sizeClasses[size]}`}
          style={{
            backgroundColor: `${tag.color}20`,
            color: tag.color,
            border: `1px solid ${tag.color}50`,
          }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}

/**
 * Filtre par tags
 */
export function TagFilter({ tags = [], selectedTagId, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition
          ${!selectedTagId 
            ? 'bg-gold-500 text-dark font-semibold' 
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
      >
        Tous
      </button>
      {tags.map(tag => (
        <button
          key={tag.id}
          onClick={() => onSelect(tag.id)}
          className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition
            ${selectedTagId === tag.id ? 'font-semibold' : ''}`}
          style={
            selectedTagId === tag.id
              ? { backgroundColor: tag.color, color: 'white' }
              : { backgroundColor: `${tag.color}20`, color: tag.color }
          }
        >
          {tag.name}
        </button>
      ))}
    </div>
  );
}

export default { ScriptTagsModal, ScriptTagBadges, TagFilter };
