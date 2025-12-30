import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useScriptStore } from "../store/scriptStore";
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
  } = useScriptStore();

  const [viewMode, setViewMode] = useState("full");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(null);

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
  } = currentScript;

  const filteredReplicas = selectedCharacter
    ? replicas.filter((r) => r.character_id === selectedCharacter)
    : replicas;

  return (
    <div className="p-4 pb-24">
      {/* En-tête */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-xl font-display text-gold-500">{title}</h1>
          <p className="text-gray-500 text-sm">
            {characters.length} personnage{characters.length > 1 ? "s" : ""} •{" "}
            {replicas.length} réplique{replicas.length > 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="text-gray-500 hover:text-red-400 p-2"
        >
          🗑️
        </button>
      </div>

      {/* Didascalies / Informations de scène */}
      {stage_directions && (
        <div className="mb-4 p-4 bg-gray-800/50 rounded-lg border-l-4 border-gray-600">
          <p className="text-gray-400 italic text-sm whitespace-pre-line">
            {stage_directions}
          </p>
        </div>
      )}

      {/* Filtres personnages - Style pills */}
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
          Tous
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
            {char.name}
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

      {/* Liste des répliques - Style dialogue/bulles */}
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
              viewMode={viewMode}
              isRight={isRight}
              number={index + 1}
            />
          );
        })}
      </div>

      {filteredReplicas.length === 0 && (
        <p className="text-center text-gray-500 py-8">Aucune réplique</p>
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

      {/* Modal de confirmation suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark rounded-xl p-6 max-w-sm w-full border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-2">
              Supprimer ?
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
    </div>
  );
}

/**
 * Composant Bulle de dialogue style messagerie
 */
function DialogueBubble({ replica, character, viewMode, isRight, number }) {
  const [revealed, setRevealed] = useState(false);

  // Générer une couleur de fond claire basée sur la couleur du personnage
  const getBubbleStyle = () => {
    if (!character?.color) {
      return {
        backgroundColor: '#4B5563',
        borderColor: '#6B7280',
      };
    }
    
    // Convertir la couleur hex en RGB et créer une version plus claire/pastel
    const hex = character.color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Version claire (pastel) pour le fond
    const lightBg = `rgba(${r}, ${g}, ${b}, 0.15)`;
    // Version plus foncée pour la bordure
    const borderColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
    
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
                💬 {replica.cue_words}
              </p>
            )}
            {revealed ? (
              <p className="text-gray-200">{replica.text}</p>
            ) : (
              <p className="text-gray-500 text-sm text-center py-2">
                👆 Toucher pour révéler
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
    <div 
      className={`flex ${isRight ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`
          max-w-[85%] rounded-2xl p-4 
          ${isClickable ? 'cursor-pointer active:scale-[0.98]' : ''}
          transition-all duration-200
          border-2
          ${isRight ? 'rounded-tr-sm' : 'rounded-tl-sm'}
        `}
        style={{
          backgroundColor: bubbleStyle.backgroundColor,
          borderColor: bubbleStyle.borderColor,
        }}
        onClick={() => isClickable && setRevealed(!revealed)}
      >
        {/* Nom du personnage */}
        <div className="flex justify-between items-center mb-2">
          <span
            className="text-sm font-bold"
            style={{ color: character?.color || '#9CA3AF' }}
          >
            {character?.name || "Inconnu"}
          </span>
          <span className="text-xs text-gray-500 ml-2">#{number}</span>
        </div>

        {/* Contenu de la réplique */}
        {renderContent()}

        {/* Indicateur cliquable */}
        {isClickable && (
          <div className="flex justify-end mt-2">
            <span className="text-xs text-gray-500">
              {revealed ? "👁️ Visible" : "👆 Toucher"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScriptDetail;
