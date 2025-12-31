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
  } = useScriptStore();

  const [viewMode, setViewMode] = useState("full");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [editingReplica, setEditingReplica] = useState(null);
  const [showOriginalFile, setShowOriginalFile] = useState(false);

  useEffect(() => {
    fetchScript(id);
    return () => clearCurrentScript();
  }, [id, fetchScript, clearCurrentScript]);

  const handleDelete = async () => {
    try {
      await deleteScript(id);
      navigate("/");
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

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

  // Compter les repliques par personnage (DOIT etre avant les early returns)
  const replicaCountByCharacter = useMemo(() => {
    if (!currentScript?.replicas) return {};
    const counts = {};
    currentScript.replicas.forEach((r) => {
      counts[r.character_id] = (counts[r.character_id] || 0) + 1;
    });
    return counts;
  }, [currentScript?.replicas]);

  // Handler pour sauvegarder les modifications d'une replique
  const handleSaveReplica = async (replicaId, newCharacterId, newText) => {
    try {
      await updateReplica(replicaId, {
        character_id: newCharacterId,
        text: newText,
      });
      setEditingReplica(null);
      // Rafraichir le script
      fetchScript(id);
    } catch (err) {
      console.error("Error updating replica:", err);
      alert("Erreur lors de la mise a jour de la replique");
    }
  };

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
        <p className="text-red-400 mb-4">Script non trouve</p>
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

  const filteredReplicas = selectedCharacter
    ? replicas.filter((r) => r.character_id === selectedCharacter)
    : replicas;

  return (
    <div className="p-4 pb-24">
      {/* En-tete */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h1 className="text-xl font-display text-gold-500">{title}</h1>
          <p className="text-gray-500 text-sm">
            {characters.length} personnage{characters.length > 1 ? "s" : ""} •{" "}
            {replicas.length} replique{replicas.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Bouton voir fichier original */}
          {(originalFileUrl || full_text) && (
            <button
              onClick={() => setShowOriginalFile(true)}
              className="text-gray-500 hover:text-blue-400 p-2"
              title="Voir le fichier original"
            >
              📄
            </button>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-gray-500 hover:text-red-400 p-2"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Didascalies / Informations de scene */}
      {stage_directions && (
        <div className="mb-4 p-4 bg-gray-800/50 rounded-lg border-l-4 border-gray-600">
          <p className="text-gray-400 italic text-sm whitespace-pre-line">
            {stage_directions}
          </p>
        </div>
      )}

      {/* Filtres personnages - Style pills avec compteur */}
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
              backgroundColor:
                selectedCharacter === char.id ? char.color : "#374151",
              color: selectedCharacter === char.id ? "white" : "#9CA3AF",
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
          🎭 Repliques
        </button>
      </div>

      {/* Liste des repliques - Style dialogue/bulles */}
      <div className="space-y-4">
        {filteredReplicas.map((replica, index) => {
          const character = characters.find(
            (c) => c.id === replica.character_id
          );
          const isRight = characterPositions[replica.character_id] === 1;

          return (
            <DialogueBubble
              key={replica.id}
              replica={replica}
              character={character}
              characters={characters}
              viewMode={viewMode}
              isRight={isRight}
              number={index + 1}
              onEdit={() => setEditingReplica(replica)}
            />
          );
        })}
      </div>

      {filteredReplicas.length === 0 && (
        <p className="text-center text-gray-500 py-8">
          Aucune replique{selectedCharacter ? " pour ce personnage" : ""}
        </p>
      )}

      {/* Bouton Audio flottant */}
      <Link
        to={`/script/${id}/audio`}
        className="fixed bottom-24 right-4 w-14 h-14 bg-gold-500 rounded-full
                   flex items-center justify-center text-2xl shadow-lg hover:bg-gold-400
                   transition transform hover:scale-110"
      >
        🔊
      </Link>

      {/* Modal d'edition de replique */}
      {editingReplica && (
        <EditReplicaModal
          replica={editingReplica}
          characters={characters}
          onSave={handleSaveReplica}
          onClose={() => setEditingReplica(null)}
        />
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

      {/* Modal de confirmation suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark rounded-xl p-6 max-w-sm w-full border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-2">
              Supprimer ?
            </h3>
            <p className="text-gray-400 mb-6">Cette action est irreversible.</p>
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
    </div>
  );
}

/**
 * Modal pour voir le fichier original
 */
function OriginalFileModal({ fileUrl, fullText, filename, onClose }) {
  const [showText, setShowText] = useState(!fileUrl);
  const isPdf = filename?.toLowerCase().endsWith(".pdf");

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-white">
              📄 Fichier original
            </h3>
            <p className="text-sm text-gray-400">{filename}</p>
          </div>
          <div className="flex gap-2">
            {fileUrl && fullText && (
              <button
                onClick={() => setShowText(!showText)}
                className={`px-3 py-1 rounded-lg text-sm ${
                  showText
                    ? "bg-primary-700 text-white"
                    : "bg-gray-700 text-gray-400"
                }`}
              >
                {showText ? "📄 PDF" : "📝 Texte"}
              </button>
            )}
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-gold-500 text-dark rounded-lg text-sm font-medium"
              >
                Telecharger
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white"
            >
              X
            </button>
          </div>
        </div>

        {/* Content */}
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
              <p className="text-gray-400 mb-4">
                Apercu non disponible pour ce type de fichier
              </p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold inline-block"
              >
                Telecharger le fichier
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Modal d'edition d'une replique
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

  const selectedChar = characters.find((c) => c.id === selectedCharId);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark rounded-xl max-w-lg w-full border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">
            Modifier la replique
          </h3>
        </div>

        <div className="p-4 space-y-4">
          {/* Selection du personnage */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Personnage
            </label>
            <div className="flex gap-2 flex-wrap">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharId(char.id)}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition"
                  style={{
                    backgroundColor:
                      selectedCharId === char.id ? char.color : "#374151",
                    color: selectedCharId === char.id ? "white" : "#9CA3AF",
                  }}
                >
                  {char.name}
                </button>
              ))}
            </div>
          </div>

          {/* Texte de la replique */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Texte</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="input w-full h-32 resize-none"
              placeholder="Texte de la replique..."
            />
          </div>

          {/* Previsualisation */}
          <div
            className="p-3 rounded-lg border-l-4"
            style={{
              backgroundColor: selectedChar?.color + "20",
              borderLeftColor: selectedChar?.color,
            }}
          >
            <p
              className="text-xs font-semibold mb-1"
              style={{ color: selectedChar?.color }}
            >
              {selectedChar?.name || "?"}
            </p>
            <p className="text-gray-300 text-sm">{text || "..."}</p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={saving}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="btn-gold flex-1"
            disabled={saving || !text.trim()}
          >
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Composant Bulle de dialogue style messagerie
 */
function DialogueBubble({
  replica,
  character,
  viewMode,
  isRight,
  number,
  onEdit,
}) {
  const [revealed, setRevealed] = useState(false);

  // Generer une couleur de fond claire basee sur la couleur du personnage
  const getBubbleStyle = () => {
    if (!character?.color) {
      return {
        backgroundColor: "#4B5563",
        borderColor: "#6B7280",
      };
    }

    const hex = character.color.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const lightBg = "rgba(" + r + ", " + g + ", " + b + ", 0.15)";
    const borderColor = "rgba(" + r + ", " + g + ", " + b + ", 0.4)";

    return {
      backgroundColor: lightBg,
      borderColor: borderColor,
    };
  };

  const bubbleStyle = getBubbleStyle();

  const renderContent = () => {
    switch (viewMode) {
      case "gaps":
        if (revealed) {
          return <p className="text-gray-200">{replica.text}</p>;
        } else {
          return (
            <p className="text-gray-300 font-mono text-sm">
              {replica.text_gaps || replica.text}
            </p>
          );
        }

      case "cue":
        return (
          <div>
            {replica.cue_words && (
              <p className="text-gray-500 italic text-xs mb-2 border-b border-gray-700 pb-2">
                {replica.cue_words}
              </p>
            )}
            {revealed ? (
              <p className="text-gray-200">{replica.text}</p>
            ) : (
              <p className="text-gray-500 text-sm text-center py-2">
                Toucher pour reveler
              </p>
            )}
          </div>
        );

      default:
        return <p className="text-gray-200 leading-relaxed">{replica.text}</p>;
    }
  };

  const isClickable = viewMode !== "full";

  return (
    <div className={"flex " + (isRight ? "justify-end" : "justify-start")}>
      <div
        className={
          "max-w-[85%] rounded-2xl p-4 relative group transition-all duration-200 border-2 " +
          (isClickable ? "cursor-pointer active:scale-[0.98] " : "") +
          (isRight ? "rounded-tr-sm" : "rounded-tl-sm")
        }
        style={{
          backgroundColor: bubbleStyle.backgroundColor,
          borderColor: bubbleStyle.borderColor,
        }}
        onClick={() => isClickable && setRevealed(!revealed)}
      >
        {/* Bouton editer (visible au hover) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="absolute -top-2 -right-2 w-8 h-8 bg-gray-700 hover:bg-gray-600 
                     rounded-full flex items-center justify-center text-sm
                     opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          title="Modifier cette replique"
        >
          ✏️
        </button>

        {/* Nom du personnage */}
        <div className="flex justify-between items-center mb-2">
          <span
            className="text-sm font-bold"
            style={{ color: character?.color || "#9CA3AF" }}
          >
            {character?.name || "Inconnu"}
          </span>
          <span className="text-xs text-gray-500 ml-2">#{number}</span>
        </div>

        {/* Contenu de la replique */}
        {renderContent()}

        {/* Indicateur cliquable */}
        {isClickable && (
          <div className="flex justify-end mt-2">
            <span className="text-xs text-gray-500">
              {revealed ? "Visible" : "Toucher"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScriptDetail;
