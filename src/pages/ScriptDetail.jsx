import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useScriptStore } from "../store/scriptStore";
import { getFileUrl } from "../lib/supabase";
import Loader from "../components/ui/Loader";

function ScriptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    currentScript,
    loading,
    error,
    fetchScript,
    deleteScript,
    clearCurrentScript,
    updateReplica,
    addSingleReplica,
    deleteReplica,
  } = useScriptStore();

  const [viewMode, setViewMode] = useState("full");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [editingReplica, setEditingReplica] = useState(null);
  const [showOriginalFile, setShowOriginalFile] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAddReplica, setShowAddReplica] = useState(false);
  const [deleteReplicaConfirm, setDeleteReplicaConfirm] = useState(null);

  // ⚠️ TOUS LES HOOKS DOIVENT ÊTRE AVANT LES RETURNS CONDITIONNELS

  useEffect(() => {
    fetchScript(id);
    return () => clearCurrentScript();
  }, [id, fetchScript, clearCurrentScript]);

  // Calculer l'index de position pour chaque personnage (pour alterner gauche/droite)
  const characterPositions = useMemo(() => {
    if (!currentScript?.characters) return {};
    const positions = {};
    currentScript.characters.forEach((char, index) => {
      positions[char.id] = index % 2; // 0 = gauche, 1 = droite
    });
    return positions;
  }, [currentScript?.characters]);

  // URL du fichier original
  const originalFileUrl = useMemo(() => {
    if (!currentScript?.pdf_url) return null;
    return getFileUrl(currentScript.pdf_url);
  }, [currentScript?.pdf_url]);

  // Compter les répliques par personnage
  const replicaCountByCharacter = useMemo(() => {
    if (!currentScript?.replicas) return {};
    const counts = {};
    currentScript.replicas.forEach(r => {
      counts[r.character_id] = (counts[r.character_id] || 0) + 1;
    });
    return counts;
  }, [currentScript?.replicas]);

  // Répliques filtrées
  const filteredReplicas = useMemo(() => {
    if (!currentScript?.replicas) return [];
    return selectedCharacter
      ? currentScript.replicas.filter((r) => r.character_id === selectedCharacter)
      : currentScript.replicas;
  }, [currentScript?.replicas, selectedCharacter]);

  // Handler pour supprimer le script
  const handleDelete = async () => {
    try {
      await deleteScript(id);
      navigate("/");
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // Handler pour sauvegarder les modifications d'une réplique
  const handleSaveReplica = async (replicaId, newCharacterId, newText) => {
    try {
      await updateReplica(replicaId, {
        character_id: newCharacterId,
        text: newText,
      });
      setEditingReplica(null);
    } catch (err) {
      console.error("Error updating replica:", err);
      alert("Erreur lors de la mise à jour de la réplique");
    }
  };

  // Handler pour ajouter une nouvelle réplique
  const handleAddReplica = async (characterId, text, afterIndex) => {
    try {
      const newOrderIndex = afterIndex !== undefined 
        ? afterIndex + 0.5 
        : (currentScript?.replicas?.length || 0);
      
      await addSingleReplica({
        script_id: id,
        character_id: characterId,
        text: text,
        order_index: newOrderIndex,
        text_gaps: generateGapsText(text),
        cue_words: '',
      });
      
      setShowAddReplica(false);
      // Rafraîchir pour avoir le bon ordre
      fetchScript(id);
    } catch (err) {
      console.error("Error adding replica:", err);
      alert("Erreur lors de l'ajout de la réplique");
    }
  };

  // Handler pour supprimer une réplique
  const handleDeleteReplica = async (replicaId) => {
    try {
      await deleteReplica(replicaId);
      setDeleteReplicaConfirm(null);
    } catch (err) {
      console.error("Error deleting replica:", err);
      alert("Erreur lors de la suppression de la réplique");
    }
  };

  // Générer le texte à trous
  const generateGapsText = (text) => {
    return text.replace(/\b(\w)(\w+)\b/g, (match, first, rest) => {
      return first + '_'.repeat(Math.min(rest.length, 5));
    });
  };

  // Partager le script
  const handleShare = async () => {
    setShowShareModal(true);
  };

  // ⚠️ RETURNS CONDITIONNELS APRÈS TOUS LES HOOKS

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  if (error || !currentScript) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-400 mb-4">Script non trouvé</p>
        <Link to="/" className="btn-primary">
          Retour
        </Link>
      </div>
    );
  }

  const {
    title,
    characters = [],
    replicas = [],
    stage_directions,
    full_text,
    original_filename,
  } = currentScript;

  return (
    <div className="p-4 pb-32">
      {/* En-tête */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h1 className="text-xl font-display text-gold-500">{title}</h1>
          <p className="text-gray-500 text-sm">
            {characters.length} personnage{characters.length > 1 ? "s" : ""} •{" "}
            {replicas.length} réplique{replicas.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-1">
          {/* Bouton voir fichier original */}
          {(originalFileUrl || full_text) && (
            <button
              onClick={() => setShowOriginalFile(true)}
              className="text-gray-500 hover:text-blue-400 p-2 rounded-lg hover:bg-blue-500/10 transition"
              title="Voir le fichier original"
            >
              📄
            </button>
          )}
          {/* Bouton partager */}
          <button
            onClick={handleShare}
            className="text-gray-500 hover:text-green-400 p-2 rounded-lg hover:bg-green-500/10 transition"
            title="Partager ce texte"
          >
            📤
          </button>
          {/* Bouton supprimer */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition"
            title="Supprimer"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Didascalies / Informations de scène */}
      {stage_directions && (
        <div className="mb-4 p-4 bg-gray-800/50 rounded-lg border-l-4 border-gray-600">
          <p className="text-gray-400 italic text-sm whitespace-pre-line">
            {stage_directions}
          </p>
        </div>
      )}

      {/* Filtres personnages */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        <button
          onClick={() => setSelectedCharacter(null)}
          className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition font-medium
            ${
              !selectedCharacter
                ? "bg-gold-500 text-dark"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
        >
          Tous ({replicas.length})
        </button>
        {characters.map((char) => (
          <button
            key={char.id}
            onClick={() => setSelectedCharacter(char.id)}
            className="px-4 py-2 rounded-full text-sm whitespace-nowrap transition font-medium"
            style={{
              backgroundColor: selectedCharacter === char.id ? char.color : '#374151',
              color: selectedCharacter === char.id ? 'white' : '#9CA3AF',
            }}
          >
            {char.name} ({replicaCountByCharacter[char.id] || 0})
          </button>
        ))}
      </div>

      {/* Modes de vue */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setViewMode("full")}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition
            ${
              viewMode === "full"
                ? "bg-primary-700 text-white"
                : "bg-gray-800 text-gray-400"
            }`}
        >
          📖 Complet
        </button>
        <button
          onClick={() => setViewMode("gaps")}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition
            ${
              viewMode === "gaps"
                ? "bg-primary-700 text-white"
                : "bg-gray-800 text-gray-400"
            }`}
        >
          🔤 Trous
        </button>
        <button
          onClick={() => setViewMode("cue")}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition
            ${
              viewMode === "cue"
                ? "bg-primary-700 text-white"
                : "bg-gray-800 text-gray-400"
            }`}
        >
          🎭 Répliques
        </button>
      </div>

      {/* Liste des répliques - Style WhatsApp */}
      <div className="space-y-3">
        {filteredReplicas.map((replica, index) => {
          const character = characters.find(
            (c) => c.id === replica.character_id
          );
          const isRight = characterPositions[replica.character_id] === 1;
          
          return (
            <ChatBubble
              key={replica.id}
              replica={replica}
              character={character}
              characters={characters}
              viewMode={viewMode}
              isRight={isRight}
              number={index + 1}
              onEdit={() => setEditingReplica(replica)}
              onDelete={() => setDeleteReplicaConfirm(replica)}
            />
          );
        })}
      </div>

      {filteredReplicas.length === 0 && (
        <p className="text-center text-gray-500 py-8">
          Aucune réplique{selectedCharacter ? " pour ce personnage" : ""}
        </p>
      )}

      {/* Boutons flottants */}
      <div className="fixed bottom-24 right-4 flex flex-col gap-3">
        {/* Bouton Ajouter réplique */}
        <button
          onClick={() => setShowAddReplica(true)}
          className="w-14 h-14 bg-green-600 hover:bg-green-500 rounded-full
                     flex items-center justify-center text-2xl shadow-lg
                     transition transform hover:scale-110"
          title="Ajouter une réplique"
        >
          ➕
        </button>
        
        {/* Bouton Audio */}
        <Link
          to={`/script/${id}/audio`}
          className="w-14 h-14 bg-gold-500 rounded-full
                     flex items-center justify-center text-2xl shadow-lg hover:bg-gold-400
                     transition transform hover:scale-110"
        >
          🔊
        </Link>
      </div>

      {/* Modal d'édition de réplique */}
      {editingReplica && (
        <EditReplicaModal
          replica={editingReplica}
          characters={characters}
          onSave={handleSaveReplica}
          onClose={() => setEditingReplica(null)}
        />
      )}

      {/* Modal d'ajout de réplique */}
      {showAddReplica && (
        <AddReplicaModal
          characters={characters}
          onAdd={handleAddReplica}
          onClose={() => setShowAddReplica(false)}
        />
      )}

      {/* Modal de confirmation suppression réplique */}
      {deleteReplicaConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark rounded-xl p-6 max-w-sm w-full border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-2">
              Supprimer cette réplique ?
            </h3>
            <p className="text-gray-400 text-sm mb-4 line-clamp-2">
              "{deleteReplicaConfirm.text}"
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteReplicaConfirm(null)}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteReplica(deleteReplicaConfirm.id)}
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-full font-semibold flex-1"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation suppression script */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark rounded-xl p-6 max-w-sm w-full border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-2">
              Supprimer ce texte ?
            </h3>
            <p className="text-gray-400 mb-6">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-full font-semibold flex-1"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal fichier original */}
      {showOriginalFile && (
        <OriginalFileModal
          fileUrl={originalFileUrl}
          fullText={full_text}
          filename={original_filename}
          onClose={() => setShowOriginalFile(false)}
        />
      )}

      {/* Modal partage */}
      {showShareModal && (
        <ShareModal
          script={currentScript}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}

/**
 * Bulle de chat style WhatsApp
 */
function ChatBubble({ replica, character, viewMode, isRight, number, onEdit, onDelete }) {
  const [revealed, setRevealed] = useState(false);

  const bubbleColor = character?.color || '#6B7280';
  
  const hexToRgba = (hex, alpha) => {
    if (!hex) return `rgba(107, 114, 128, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const renderContent = () => {
    switch (viewMode) {
      case "gaps":
        if (revealed) {
          return <p className="text-gray-100">{replica.text}</p>;
        } else {
          return (
            <p className="text-gray-300 font-mono text-sm tracking-wide">
              {replica.text_gaps || replica.text}
            </p>
          );
        }

      case "cue":
        return (
          <div>
            {replica.cue_words && (
              <p className="text-gray-400 italic text-xs mb-2 pb-2 border-b border-white/10">
                💬 {replica.cue_words}
              </p>
            )}
            {revealed ? (
              <p className="text-gray-100">{replica.text}</p>
            ) : (
              <p className="text-gray-400 text-sm text-center py-2">
                👆 Toucher pour révéler
              </p>
            )}
          </div>
        );

      default:
        return <p className="text-gray-100 leading-relaxed">{replica.text}</p>;
    }
  };

  const isClickable = viewMode !== "full";

  return (
    <div className={`flex ${isRight ? 'justify-end' : 'justify-start'} mb-1`}>
      <div
        className={`
          relative max-w-[85%] group
          ${isClickable ? 'cursor-pointer active:scale-[0.98]' : ''}
          transition-transform duration-150
        `}
        onClick={() => isClickable && setRevealed(!revealed)}
      >
        {/* Bulle principale */}
        <div
          className={`
            px-4 py-3 rounded-2xl relative
            ${isRight ? 'rounded-br-md' : 'rounded-bl-md'}
          `}
          style={{
            backgroundColor: hexToRgba(bubbleColor, 0.2),
            border: `1px solid ${hexToRgba(bubbleColor, 0.3)}`,
          }}
        >
          {/* Triangle de la bulle */}
          <div
            className={`absolute bottom-0 w-3 h-3 ${isRight ? '-right-1.5' : '-left-1.5'}`}
            style={{
              backgroundColor: hexToRgba(bubbleColor, 0.2),
              clipPath: isRight 
                ? 'polygon(0 0, 100% 100%, 0 100%)' 
                : 'polygon(100% 0, 100% 100%, 0 100%)',
            }}
          />

          {/* En-tête avec nom et numéro */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-bold" style={{ color: bubbleColor }}>
              {character?.name || "Inconnu"}
            </span>
            <span className="text-xs text-gray-500">#{number}</span>
          </div>

          {/* Contenu */}
          <div className="text-sm">{renderContent()}</div>

          {/* Indicateur mode */}
          {isClickable && (
            <div className="flex justify-end mt-1">
              <span className="text-xs text-gray-500">
                {revealed ? "✓ Visible" : "👆"}
              </span>
            </div>
          )}
        </div>

        {/* Boutons d'action (visible au hover/touch) */}
        <div className={`absolute -top-2 ${isRight ? '-left-2' : '-right-2'} flex gap-1 
                        opacity-0 group-hover:opacity-100 transition-opacity`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="w-7 h-7 bg-gray-700 hover:bg-primary-600 
                       rounded-full flex items-center justify-center text-xs shadow-lg"
            title="Modifier"
          >
            ✏️
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-7 h-7 bg-gray-700 hover:bg-red-600 
                       rounded-full flex items-center justify-center text-xs shadow-lg"
            title="Supprimer"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal d'ajout d'une réplique
 */
function AddReplicaModal({ characters, onAdd, onClose }) {
  const [selectedCharId, setSelectedCharId] = useState(characters[0]?.id || null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!text.trim() || !selectedCharId) return;
    setSaving(true);
    await onAdd(selectedCharId, text.trim());
    setSaving(false);
  };

  const selectedChar = characters.find(c => c.id === selectedCharId);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark rounded-xl max-w-lg w-full border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">➕ Ajouter une réplique</h3>
        </div>

        <div className="p-4 space-y-4">
          {/* Sélection du personnage */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Personnage</label>
            <div className="flex gap-2 flex-wrap">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharId(char.id)}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition"
                  style={{
                    backgroundColor: selectedCharId === char.id ? char.color : '#374151',
                    color: selectedCharId === char.id ? 'white' : '#9CA3AF',
                  }}
                >
                  {char.name}
                </button>
              ))}
            </div>
          </div>

          {/* Texte de la réplique */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Texte de la réplique</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="input w-full h-32 resize-none"
              placeholder="Entrez le texte de la réplique..."
              autoFocus
            />
          </div>

          {/* Prévisualisation */}
          {text && (
            <div 
              className="p-3 rounded-lg"
              style={{ 
                backgroundColor: `${selectedChar?.color || '#666'}20`,
                borderLeft: `4px solid ${selectedChar?.color || '#666'}`,
              }}
            >
              <p className="text-xs font-semibold mb-1" style={{ color: selectedChar?.color || '#999' }}>
                {selectedChar?.name || "?"}
              </p>
              <p className="text-gray-300 text-sm">{text}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1" disabled={saving}>
            Annuler
          </button>
          <button 
            onClick={handleAdd} 
            className="btn-gold flex-1"
            disabled={saving || !text.trim() || !selectedCharId}
          >
            {saving ? "Ajout..." : "➕ Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal d'édition d'une réplique
 */
function EditReplicaModal({ replica, characters, onSave, onClose }) {
  const [selectedCharId, setSelectedCharId] = useState(replica.character_id);
  const [text, setText] = useState(replica.text);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await onSave(replica.id, selectedCharId, text.trim());
    setSaving(false);
  };

  const selectedChar = characters.find(c => c.id === selectedCharId);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark rounded-xl max-w-lg w-full border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">✏️ Modifier la réplique</h3>
        </div>

        <div className="p-4 space-y-4">
          {/* Sélection du personnage */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Personnage</label>
            <div className="flex gap-2 flex-wrap">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharId(char.id)}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition"
                  style={{
                    backgroundColor: selectedCharId === char.id ? char.color : '#374151',
                    color: selectedCharId === char.id ? 'white' : '#9CA3AF',
                  }}
                >
                  {char.name}
                </button>
              ))}
            </div>
          </div>

          {/* Texte de la réplique */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Texte</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="input w-full h-32 resize-none"
              placeholder="Texte de la réplique..."
            />
          </div>

          {/* Prévisualisation */}
          <div 
            className="p-3 rounded-lg"
            style={{ 
              backgroundColor: `${selectedChar?.color || '#666'}20`,
              borderLeft: `4px solid ${selectedChar?.color || '#666'}`,
            }}
          >
            <p className="text-xs font-semibold mb-1" style={{ color: selectedChar?.color || '#999' }}>
              {selectedChar?.name || "?"}
            </p>
            <p className="text-gray-300 text-sm">{text || "..."}</p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1" disabled={saving}>
            Annuler
          </button>
          <button 
            onClick={handleSave} 
            className="btn-gold flex-1"
            disabled={saving || !text.trim()}
          >
            {saving ? "Sauvegarde..." : "💾 Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal fichier original
 */
function OriginalFileModal({ fileUrl, fullText, filename, onClose }) {
  const [showText, setShowText] = useState(false);
  const isPdf = filename?.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-dark">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold truncate">{filename || "Fichier original"}</h3>
        </div>
        <div className="flex items-center gap-2">
          {fullText && fileUrl && (
            <button
              onClick={() => setShowText(!showText)}
              className={`px-3 py-1 rounded-lg text-sm transition ${
                showText ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              {showText ? '📄 PDF' : '📝 Texte'}
            </button>
          )}
          {fileUrl && (
            <a
              href={fileUrl}
              download={filename}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
            >
              ⬇️
            </a>
          )}
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {showText || !fileUrl ? (
          <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono bg-gray-900 p-4 rounded-lg">
            {fullText || "Aucun texte disponible"}
          </pre>
        ) : isPdf ? (
          <iframe
            src={fileUrl}
            className="w-full h-full min-h-[60vh] rounded-lg"
            title="PDF original"
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">Aperçu non disponible pour ce type de fichier</p>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold inline-block"
            >
              Télécharger le fichier
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Modal de partage
 */
function ShareModal({ script, onClose }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/shared/${script.id}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: script.title,
          text: `Texte de théâtre : ${script.title}`,
          url: shareUrl,
        });
      } catch (err) {
        console.log("Partage annulé");
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark rounded-xl max-w-sm w-full border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            📤 Partager "{script.title}"
          </h3>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-gray-400 text-sm">
            Partagez ce texte avec les membres de votre troupe.
          </p>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-500 text-sm flex items-center gap-2">
              🚧 Fonctionnalité en développement
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Le partage entre utilisateurs sera bientôt disponible !
            </p>
          </div>

          <button
            onClick={shareNative}
            className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-lg 
                       font-semibold transition flex items-center justify-center gap-2"
          >
            {copied ? "✓ Copié !" : "📱 Partager"}
          </button>
        </div>

        <div className="p-4 border-t border-gray-700">
          <button onClick={onClose} className="btn-secondary w-full">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScriptDetail;
