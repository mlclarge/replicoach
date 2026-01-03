import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useScriptStore } from "../store/scriptStore";
import { useAuthStore } from "../store/authStore";
import { getFileUrl, fetchUserTroupes, shareScript } from "../lib/supabase";
import Loader from "../components/ui/Loader";

function ScriptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
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
    <div className="pb-32 min-h-screen bg-amber-50">
      {/* ===== EN-TÊTE AVEC FOND COLORÉ ===== */}
      <div className="bg-gradient-to-b from-primary-800 to-primary-900 p-4 mb-4 border-b-2 border-primary-600 shadow-lg">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-2xl font-display text-gold-400 mb-1">{title}</h1>
            <p className="text-gray-300 text-sm">
              {characters.length} personnage{characters.length > 1 ? "s" : ""} •{" "}
              {replicas.length} réplique{replicas.length > 1 ? "s" : ""}
            </p>
          </div>
          {/* ===== ICÔNES HEADER AVEC FOND SOLIDE ===== */}
          <div className="flex gap-2">
            {/* Bouton voir fichier original - BLEU */}
            {(originalFileUrl || full_text) && (
              <button
                onClick={() => setShowOriginalFile(true)}
                className="p-2.5 rounded-lg transition shadow-md
                           bg-blue-500 hover:bg-blue-600 text-white
                           border-2 border-blue-600"
                title="Voir le fichier original"
              >
                📄
              </button>
            )}
            {/* Bouton partager - VERT */}
            <button
              onClick={() => setShowShareModal(true)}
              className="p-2.5 rounded-lg transition shadow-md
                         bg-green-500 hover:bg-green-600 text-white
                         border-2 border-green-600"
              title="Partager avec ma troupe"
            >
              👥
            </button>
            {/* Bouton supprimer - ROUGE */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2.5 rounded-lg transition shadow-md
                         bg-red-500 hover:bg-red-600 text-white
                         border-2 border-red-600"
              title="Supprimer"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>

      <div className="px-4">
        {/* Didascalies / Informations de scène */}
        {stage_directions && (
          <div className="mb-4 p-4 bg-white/80 rounded-lg border-l-4 border-amber-400 shadow">
            <p className="text-gray-700 italic text-sm whitespace-pre-line">
              {stage_directions}
            </p>
          </div>
        )}

        {/* Filtres personnages */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <button
            onClick={() => setSelectedCharacter(null)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition font-medium shadow
              ${
                !selectedCharacter
                  ? "bg-gold-500 text-dark"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-300"
              }`}
          >
            Tous ({replicas.length})
          </button>
          {characters.map((char) => (
            <button
              key={char.id}
              onClick={() => setSelectedCharacter(char.id)}
              className="px-4 py-2 rounded-full text-sm whitespace-nowrap transition font-medium shadow"
              style={{
                backgroundColor: selectedCharacter === char.id ? char.color : 'white',
                color: selectedCharacter === char.id ? 'white' : '#4B5563',
                border: selectedCharacter === char.id ? `2px solid ${char.color}` : '1px solid #D1D5DB',
              }}
            >
              {char.name} ({replicaCountByCharacter[char.id] || 0})
            </button>
          ))}
        </div>

        {/* Modes de vue - Adaptés au fond beige */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setViewMode("full")}
            className={`flex-1 py-3 px-3 rounded-lg text-sm font-semibold transition shadow
              ${
                viewMode === "full"
                  ? "bg-primary-700 text-white"
                  : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
              }`}
          >
            📖 Complet
          </button>
          <button
            onClick={() => setViewMode("gaps")}
            className={`flex-1 py-3 px-3 rounded-lg text-sm font-semibold transition shadow
              ${
                viewMode === "gaps"
                  ? "bg-primary-700 text-white"
                  : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
              }`}
          >
            🔤 Trous
          </button>
          <button
            onClick={() => setViewMode("cue")}
            className={`flex-1 py-3 px-3 rounded-lg text-sm font-semibold transition shadow
              ${
                viewMode === "cue"
                  ? "bg-primary-700 text-white"
                  : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
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
          <p className="text-center text-gray-600 py-8 bg-white/50 rounded-lg">
            Aucune réplique{selectedCharacter ? " pour ce personnage" : ""}
          </p>
        )}
      </div>

      {/* Boutons flottants */}
      <div className="fixed bottom-24 right-4 flex flex-col gap-3">
        {/* Bouton Ajouter/Éditer réplique */}
        <button
          onClick={() => setShowAddReplica(true)}
          className="w-14 h-14 bg-green-600 hover:bg-green-500 rounded-full
                     flex items-center justify-center text-2xl shadow-lg
                     transition transform hover:scale-110"
          title="Ajouter une réplique"
        >
          ✏️
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

      {/* Modal d'ajout de réplique - BOUTON VISIBLE */}
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

      {/* Modal partage - INTERNE avec sélection de troupe */}
      {showShareModal && (
        <ShareTroupeModal
          script={currentScript}
          userId={user?.id}
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
          return <p className="text-white">{replica.text}</p>;
        } else {
          return (
            <p className="text-white/80 font-mono text-sm tracking-wide">
              {replica.text_gaps || replica.text}
            </p>
          );
        }

      case "cue":
        return (
          <div>
            {replica.cue_words && (
              <p className="text-white/70 italic text-xs mb-2 pb-2 border-b border-white/20">
                💬 {replica.cue_words}
              </p>
            )}
            {revealed ? (
              <p className="text-white">{replica.text}</p>
            ) : (
              <p className="text-white/70 text-sm text-center py-2">
                👆 Toucher pour révéler
              </p>
            )}
          </div>
        );

      default:
        return <p className="text-white leading-relaxed">{replica.text}</p>;
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
        {/* Bulle principale - OMBRE POUR FOND BEIGE */}
        <div
          className={`
            px-4 py-3 rounded-2xl relative shadow-lg
            ${isRight ? 'rounded-br-md' : 'rounded-bl-md'}
          `}
          style={{
            backgroundColor: hexToRgba(bubbleColor, 0.85),
            border: `2px solid ${hexToRgba(bubbleColor, 0.9)}`,
          }}
        >
          {/* Triangle de la bulle */}
          <div
            className={`absolute bottom-0 w-3 h-3 ${isRight ? '-right-1.5' : '-left-1.5'}`}
            style={{
              backgroundColor: hexToRgba(bubbleColor, 0.85),
              clipPath: isRight 
                ? 'polygon(0 0, 100% 100%, 0 100%)' 
                : 'polygon(100% 0, 100% 100%, 0 100%)',
            }}
          />

          {/* En-tête avec nom et numéro - TEXTE BLANC POUR CONTRASTE */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-bold text-white drop-shadow">
              {character?.name || "Inconnu"}
            </span>
            <span className="text-xs text-white/70">#{number}</span>
          </div>

          {/* Contenu - TEXTE BLANC */}
          <div className="text-sm text-white">{renderContent()}</div>

          {/* Indicateur mode */}
          {isClickable && (
            <div className="flex justify-end mt-1">
              <span className="text-xs text-white/60">
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
 * Modal d'ajout d'une réplique - BOUTON TOUJOURS VISIBLE
 */
function AddReplicaModal({ characters, onAdd, onClose }) {
  const [selectedCharId, setSelectedCharId] = useState(characters[0]?.id || null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!text.trim() || !selectedCharId) return;
    setSaving(true);
    try {
      await onAdd(selectedCharId, text.trim());
    } catch (err) {
      console.error("Erreur ajout:", err);
      setSaving(false);
    }
  };

  const selectedChar = characters.find(c => c.id === selectedCharId);
  const canSubmit = text.trim() && selectedCharId && !saving;

  return (
    <div className="fixed inset-0 z-[60] bg-black/95">
      {/* Container avec hauteur maximale */}
      <div className="h-full flex flex-col max-h-screen">
        
        {/* Header - Hauteur fixe */}
        <div className="flex-none p-4 border-b border-gray-700 bg-dark flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">✏️ Ajouter une réplique</h3>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Contenu scrollable - Prend l'espace restant */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Sélection du personnage */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Personnage</label>
            <div className="flex gap-2 flex-wrap">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharId(char.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition"
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
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Texte de la réplique</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-28 bg-gray-800 border border-gray-600 rounded-xl p-4 
                         text-white text-base resize-none focus:border-gold-500 focus:outline-none"
              placeholder="Entrez le texte de la réplique..."
              autoFocus
            />
          </div>

          {/* Prévisualisation */}
          {text && selectedChar && (
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Aperçu</label>
              <div 
                className="p-4 rounded-xl"
                style={{ backgroundColor: `${selectedChar.color}dd` }}
              >
                <p className="text-xs font-semibold mb-1 text-white/80">
                  {selectedChar.name}
                </p>
                <p className="text-white">{text}</p>
              </div>
            </div>
          )}
        </div>

        {/* BOUTON FIXE EN BAS - Toujours visible */}
        <div className="flex-none p-4 border-t border-gray-700 bg-dark">
          <button 
            onClick={handleAdd} 
            disabled={!canSubmit}
            className={`w-full py-4 rounded-xl text-lg font-bold transition
              ${canSubmit
                ? 'bg-gold-500 hover:bg-gold-400 text-dark shadow-lg'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
          >
            {saving ? "⏳ Ajout en cours..." : "✅ AJOUTER LA RÉPLIQUE"}
          </button>
        </div>
        
      </div>
    </div>
  );
}

/**
 * Modal d'édition d'une réplique - BOUTON BIEN VISIBLE
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
    <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
      {/* Header fixe */}
      <div className="p-4 border-b border-gray-700 bg-dark flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">✏️ Modifier la réplique</h3>
        <button 
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
        >
          ✕
        </button>
      </div>

      {/* Contenu scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Sélection du personnage */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Personnage</label>
          <div className="flex gap-2 flex-wrap">
            {characters.map((char) => (
              <button
                key={char.id}
                onClick={() => setSelectedCharId(char.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition"
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
            className="input w-full h-32 resize-none text-base"
            placeholder="Texte de la réplique..."
          />
        </div>

        {/* Prévisualisation */}
        <div 
          className="p-4 rounded-lg"
          style={{ 
            backgroundColor: `${selectedChar?.color || '#666'}20`,
            borderLeft: `4px solid ${selectedChar?.color || '#666'}`,
          }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: selectedChar?.color || '#999' }}>
            {selectedChar?.name || "?"}
          </p>
          <p className="text-gray-300">{text || "..."}</p>
        </div>
      </div>

      {/* ===== BOUTON FIXE EN BAS - TRÈS VISIBLE ===== */}
      <div className="p-4 border-t border-gray-700 bg-dark safe-area-bottom">
        <button 
          onClick={handleSave} 
          className={`w-full py-4 rounded-xl text-lg font-bold transition
            ${saving || !text.trim()
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gold-500 hover:bg-gold-400 text-dark shadow-lg shadow-gold-500/30'
            }`}
          disabled={saving || !text.trim()}
        >
          {saving ? "⏳ Sauvegarde..." : "✓ SAUVEGARDER"}
        </button>
      </div>
    </div>
  );
}

/**
 * Modal fichier original
 */
function OriginalFileModal({ fileUrl, fullText, filename, onClose }) {
  // Détecter mobile
  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  const [showText, setShowText] = useState(isMobile); // Texte par défaut sur mobile
  const [pdfError, setPdfError] = useState(false);
  const [checkingPdf, setCheckingPdf] = useState(!isMobile);
  const isPdf = filename?.toLowerCase().endsWith('.pdf');

  // Vérifier si le PDF existe vraiment (seulement sur desktop)
  useEffect(() => {
    if (fileUrl && isPdf && !isMobile) {
      setCheckingPdf(true);
      fetch(fileUrl, { method: 'HEAD' })
        .then(res => {
          if (!res.ok) {
            setPdfError(true);
            setShowText(true);
          }
          setCheckingPdf(false);
        })
        .catch(() => {
          setPdfError(true);
          setShowText(true);
          setCheckingPdf(false);
        });
    } else {
      setCheckingPdf(false);
    }
  }, [fileUrl, isPdf, isMobile]);

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-dark">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold truncate">{filename || "Fichier original"}</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Bouton toggle PDF/Texte */}
          {fullText && fileUrl && !pdfError && (
            <button
              onClick={() => setShowText(!showText)}
              className={`px-3 py-1 rounded-lg text-sm transition ${
                showText ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              {showText ? '📄 PDF' : '📝 Texte'}
            </button>
          )}
          {/* Bouton télécharger */}
          {fileUrl && !pdfError && (
            <a
              href={fileUrl}
              download={filename}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
              title="Télécharger / Ouvrir"
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
        {checkingPdf ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400">Chargement...</p>
          </div>
        ) : showText || !fileUrl || pdfError ? (
          <div>
            {pdfError && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-400 text-sm">
                  ⚠️ Le fichier PDF original n'est plus disponible. Voici le texte extrait :
                </p>
              </div>
            )}
            {isMobile && !pdfError && fileUrl && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center justify-between">
                <p className="text-blue-400 text-sm">
                  📱 Sur mobile, le PDF s'ouvre dans une nouvelle fenêtre
                </p>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg"
                >
                  Ouvrir PDF
                </a>
              </div>
            )}
            <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono bg-gray-900 p-4 rounded-lg">
              {fullText || "Aucun texte disponible"}
            </pre>
          </div>
        ) : isPdf ? (
          <iframe
            src={fileUrl}
            className="w-full h-full min-h-[60vh] rounded-lg bg-white"
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
 * Modal de partage INTERNE - Sélection de troupe
 */
function ShareTroupeModal({ script, userId, onClose }) {
  const [troupes, setTroupes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTroupes();
  }, [userId]);

  const loadTroupes = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    try {
      const userTroupes = await fetchUserTroupes(userId);
      setTroupes(userTroupes || []);
    } catch (err) {
      console.error("Erreur chargement troupes:", err);
      setTroupes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (troupeId) => {
    setSharing(true);
    setError(null);
    
    try {
      await shareScript(script.id, troupeId, userId);
      setSuccess("✓ Texte partagé avec succès !");
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      if (err.message?.includes("déjà partagé")) {
        setError("Ce texte est déjà partagé avec cette troupe");
      } else {
        setError(err.message || "Erreur lors du partage");
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark rounded-xl max-w-sm w-full border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            👥 Partager "{script.title}"
          </h3>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader />
            </div>
          ) : troupes.length === 0 ? (
            <div className="text-center py-6">
              <span className="text-4xl mb-3 block">🎭</span>
              <p className="text-gray-400 mb-2">Vous n'avez pas encore de troupe</p>
              <p className="text-gray-500 text-sm mb-4">
                Créez ou rejoignez une troupe pour partager vos textes.
              </p>
              <Link 
                to="/shared" 
                onClick={onClose}
                className="btn-gold inline-block"
              >
                Gérer mes troupes
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Choisissez une troupe pour partager ce texte :
              </p>

              <div className="space-y-2">
                {troupes.map((troupe) => (
                  <button
                    key={troupe.id}
                    onClick={() => handleShare(troupe.id)}
                    disabled={sharing}
                    className="w-full p-4 bg-gray-800 hover:bg-primary-600/30 rounded-xl 
                               text-left transition flex items-center justify-between
                               border border-gray-700 hover:border-primary-500"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎭</span>
                      <div>
                        <p className="text-white font-medium">{troupe.name}</p>
                        <p className="text-gray-500 text-xs">Code: {troupe.code}</p>
                      </div>
                    </div>
                    <span className="text-primary-400 text-xl">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {success && (
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500 rounded-lg">
              <p className="text-green-400 text-center font-medium">{success}</p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
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
