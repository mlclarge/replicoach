import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useScriptStore } from "../store/scriptStore";
import { useAuthStore } from "../store/authStore";
import { getFileUrl, fetchUserTroupes, shareScript } from "../lib/supabase";
import Loader from "../components/ui/Loader";
import ReplicaGroupsManager from "../components/ReplicaGroups";
import FloatingRecorder from "../components/FloatingRecorder";
import AICoachingModal from "../components/AICoachingModal";
import { filterScenesByCharacterIds } from "../lib/sceneFilter";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DOMPurify from "dompurify";

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
    addCharacter,
    updateCharacter,
    deleteCharacter,
    reorderReplicas,
    fetchPersonalNotes,
    addPersonalNote,
    updatePersonalNote,
    deletePersonalNote,
    updateScript,
  } = useScriptStore();

  const [viewMode, setViewMode] = useState("full");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [editingReplica, setEditingReplica] = useState(null);
  const [showOriginalFile, setShowOriginalFile] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAddReplica, setShowAddReplica] = useState(false);
  const [deleteReplicaConfirm, setDeleteReplicaConfirm] = useState(null);
  const [splittingReplica, setSplittingReplica] = useState(null);
  const [showAddCharacter, setShowAddCharacter] = useState(false);
  const [showAddNote, setShowAddNote] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [deleteNoteConfirm, setDeleteNoteConfirm] = useState(null);

  const [editMode, setEditMode] = useState(false);
  const [showCharacterManager, setShowCharacterManager] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [deleteCharacterConfirm, setDeleteCharacterConfirm] = useState(null);
  const [insertAfterIndex, setInsertAfterIndex] = useState(null);
  const [showNotesListModal, setShowNotesListModal] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const [showReplicaGroups, setShowReplicaGroups] = useState(false);
  const [studyingGroup, setStudyingGroup] = useState(null);
  const [showFloatingRecorder, setShowFloatingRecorder] = useState(false);
  const [myCharacterId, setMyCharacterId] = useState(null);
  const [hideMyReplicas, setHideMyReplicas] = useState(false);
  const [coachingMode, setCoachingMode] = useState(null);
  const [coachingCharacterId, setCoachingCharacterId] = useState(null);

  // NOUVEAUX STATES : Mode "Ciblage de scène"
  const [isSceneTargetMode, setIsSceneTargetMode] = useState(false);
  const [targetPartners, setTargetPartners] = useState([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    fetchScript(id);
    return () => clearCurrentScript();
  }, [id, fetchScript, clearCurrentScript]);

  useEffect(() => {
    if (currentScript?.id && user?.id) {
      fetchPersonalNotes(currentScript.id, user.id);
    }
  }, [currentScript?.id, user?.id, fetchPersonalNotes]);

  const characterPositions = useMemo(() => {
    if (!currentScript?.characters) return {};
    const positions = {};
    currentScript.characters.forEach((char, index) => {
      positions[char.id] = index % 2;
    });
    return positions;
  }, [currentScript?.characters]);

  const originalFileUrl = useMemo(() => {
    if (!currentScript?.pdf_url) return null;
    return getFileUrl(currentScript.pdf_url);
  }, [currentScript?.pdf_url]);

  const replicaCountByCharacter = useMemo(() => {
    if (!currentScript?.replicas) return {};
    const counts = {};
    currentScript.replicas.forEach((r) => {
      counts[r.character_id] = (counts[r.character_id] || 0) + 1;
    });
    return counts;
  }, [currentScript?.replicas]);

  // Répliques filtrées (par personnage, par groupe, OU par scène ciblée)
  const filteredReplicas = useMemo(() => {
    if (!currentScript?.replicas) return [];

    let result = currentScript.replicas;

    // NOUVEAU FILTRE : Mode Ciblage de Scène
    if (isSceneTargetMode && myCharacterId && targetPartners.length > 0) {
      result = filterScenesByCharacterIds(
        result,
        myCharacterId,
        targetPartners,
      );
    } else {
      // Filtres classiques (si le ciblage n'est pas actif)
      if (studyingGroup?.replicaIds?.length > 0) {
        const groupSet = new Set(studyingGroup.replicaIds);
        result = result.filter((r) => groupSet.has(r.id));
      }

      if (selectedCharacter) {
        result = result.filter((r) => r.character_id === selectedCharacter);
      }
    }

    return result;
  }, [
    currentScript?.replicas,
    selectedCharacter,
    studyingGroup,
    isSceneTargetMode,
    myCharacterId,
    targetPartners,
  ]);

  const handleDelete = async () => {
    try {
      await deleteScript(id);
      navigate("/");
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

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

  const handleAddReplica = async (characterId, text, afterIndex) => {
    try {
      const newOrderIndex =
        afterIndex !== undefined
          ? afterIndex + 0.5
          : currentScript?.replicas?.length || 0;

      await addSingleReplica({
        script_id: id,
        character_id: characterId,
        text: text,
        order_index: newOrderIndex,
        text_gaps: generateGapsText(text),
        cue_words: "",
      });

      setShowAddReplica(false);
      fetchScript(id);
    } catch (err) {
      console.error("Error adding replica:", err);
      alert("Erreur lors de l'ajout de la réplique");
    }
  };

  const handleDeleteReplica = async (replicaId) => {
    try {
      await deleteReplica(replicaId);
      setDeleteReplicaConfirm(null);
    } catch (err) {
      console.error("Error deleting replica:", err);
      alert("Erreur lors de la suppression de la réplique");
    }
  };

  const handleAddCharacter = async (name, color) => {
    try {
      const newChar = await addCharacter(id, { name, color });
      setShowAddCharacter(false);
      return newChar;
    } catch (err) {
      console.error("Error adding character:", err);
      if (err.code === "23505") {
        alert("Un personnage avec ce nom existe déjà dans ce script");
      } else if (err.code === "42501") {
        alert(
          "Vous n'avez pas la permission d'ajouter un personnage à ce script",
        );
      } else {
        alert(
          `Erreur lors de l'ajout du personnage: ${err.message || "Erreur inconnue"}`,
        );
      }
      throw err;
    }
  };

  const handleSplitReplica = async (
    originalReplica,
    splitIndex,
    newCharacterId,
  ) => {
    try {
      const originalText = originalReplica.text;
      const firstPart = originalText.substring(0, splitIndex).trim();
      const secondPart = originalText.substring(splitIndex).trim();

      if (!firstPart || !secondPart) {
        alert("Les deux parties doivent contenir du texte");
        return;
      }

      await updateReplica(originalReplica.id, {
        text: firstPart,
        text_gaps: generateGapsText(firstPart),
      });

      const maxOrderIndex =
        Math.max(...replicas.map((r) => r.order_index || 0)) + 1000;

      const newReplica = await addSingleReplica({
        script_id: id,
        character_id: newCharacterId,
        text: secondPart,
        order_index: maxOrderIndex,
        text_gaps: generateGapsText(secondPart),
        cue_words: "..." + firstPart.split(/\s+/).slice(-3).join(" "),
      });

      const originalIndex = replicas.findIndex(
        (r) => r.id === originalReplica.id,
      );
      const replicasBefore = replicas.slice(0, originalIndex + 1);
      const replicasAfter = replicas.slice(originalIndex + 1);

      const newOrder = [
        ...replicasBefore.map((r) => r.id),
        newReplica.id,
        ...replicasAfter.map((r) => r.id),
      ];

      await reorderReplicas(id, newOrder);
      setSplittingReplica(null);
    } catch (err) {
      console.error("Error splitting replica:", err);
      alert(
        "Erreur lors de la division de la réplique: " +
          (err.message || "Erreur inconnue"),
      );
    }
  };

  const generateGapsText = (text) => {
    return text.replace(/\b(\w)(\w+)\b/g, (match, first, rest) => {
      return first + "_".repeat(Math.min(rest.length, 5));
    });
  };

  const handleSaveTitle = async () => {
    if (!newTitle.trim()) return;
    try {
      await updateScript(id, { title: newTitle.trim() });
      setEditingTitle(false);
    } catch (err) {
      console.error("Error updating title:", err);
      alert("Erreur lors de la modification du titre");
    }
  };

  const handleAddNote = async (afterReplicaId, text, noteType) => {
    try {
      await addPersonalNote({
        user_id: user.id,
        script_id: id,
        after_replica_id: afterReplicaId,
        text: text,
        note_type: noteType,
      });
      setShowAddNote(null);
    } catch (err) {
      console.error("Error adding note:", err);
      alert("Erreur lors de l'ajout de la note");
    }
  };

  const handleSaveAICoachingNote = async ({ text, type }) => {
    try {
      await addPersonalNote({
        user_id: user.id,
        script_id: id,
        after_replica_id: null,
        text: text,
        note_type: type,
      });
    } catch (err) {
      console.error("Error saving AI coaching note:", err);
      throw err;
    }
  };

  const handleUpdateNote = async (noteId, text, noteType) => {
    try {
      await updatePersonalNote(noteId, { text, note_type: noteType });
      setEditingNote(null);
    } catch (err) {
      console.error("Error updating note:", err);
      alert("Erreur lors de la modification de la note");
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await deletePersonalNote(noteId);
      setDeleteNoteConfirm(null);
    } catch (err) {
      console.error("Error deleting note:", err);
      alert("Erreur lors de la suppression de la note");
    }
  };

  const notesByReplicaId = useMemo(() => {
    const notes = currentScript?.personalNotes || [];
    const grouped = {};
    notes.forEach((note) => {
      const key = note.after_replica_id || "start";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(note);
    });
    return grouped;
  }, [currentScript?.personalNotes]);

  const totalNotes = currentScript?.personalNotes?.length || 0;

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = replicas.findIndex((r) => r.id === active.id);
    const newIndex = replicas.findIndex((r) => r.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(replicas, oldIndex, newIndex);
    const replicaIds = newOrder.map((r) => r.id);

    try {
      await reorderReplicas(id, replicaIds);
    } catch (err) {
      console.error("Error reordering:", err);
      alert("Erreur lors du réordonnancement");
    }
  };

  const handleUpdateCharacter = async (characterId, name, color) => {
    try {
      await updateCharacter(characterId, { name, color });
      setEditingCharacter(null);
    } catch (err) {
      console.error("Error updating character:", err);
      alert("Erreur lors de la modification du personnage");
    }
  };

  const handleDeleteCharacter = async (characterId) => {
    try {
      await deleteCharacter(characterId);
      setDeleteCharacterConfirm(null);
    } catch (err) {
      console.error("Error deleting character:", err);
      alert("Erreur lors de la suppression du personnage");
    }
  };

  const handleAddReplicaAt = async (characterId, text, afterIndex) => {
    try {
      const maxOrderIndex =
        Math.max(...replicas.map((r) => r.order_index || 0), 0) + 1000;

      const newReplica = await addSingleReplica({
        script_id: id,
        character_id: characterId,
        text: text,
        order_index: maxOrderIndex,
        text_gaps: generateGapsText(text),
        cue_words: "",
      });

      if (afterIndex !== undefined && afterIndex !== null && afterIndex >= -1) {
        let newOrder;
        if (afterIndex === -1) {
          newOrder = [newReplica.id, ...replicas.map((r) => r.id)];
        } else {
          const replicasBefore = replicas.slice(0, afterIndex + 1);
          const replicasAfter = replicas.slice(afterIndex + 1);
          newOrder = [
            ...replicasBefore.map((r) => r.id),
            newReplica.id,
            ...replicasAfter.map((r) => r.id),
          ];
        }
        await reorderReplicas(id, newOrder);
      } else {
        fetchScript(id);
      }

      setShowAddReplica(false);
      setInsertAfterIndex(null);
    } catch (err) {
      console.error("Error adding replica:", err);
      alert(
        "Erreur lors de l'ajout de la réplique: " +
          (err.message || "Erreur inconnue"),
      );
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
      <div className="bg-black p-4 mb-4 border-b-2 border-gray-800 shadow-lg">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {editingTitle ? (
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="flex-1 bg-white/20 border border-gold-400 rounded-lg px-3 py-1 text-xl text-gold-400 font-display placeholder-gold-400/50"
                  placeholder="Titre du texte"
                  autoFocus
                />
                <button
                  onClick={handleSaveTitle}
                  className="p-2 bg-green-500 text-white rounded-lg"
                >
                  ✓
                </button>
                <button
                  onClick={() => setEditingTitle(false)}
                  className="p-2 bg-gray-600 text-white rounded-lg"
                >
                  ✕
                </button>
              </div>
            ) : (
              <h1
                className="text-2xl font-display text-gold-400 mb-1 cursor-pointer hover:text-gold-300 flex items-center gap-2 group"
                onClick={() => {
                  setNewTitle(title);
                  setEditingTitle(true);
                }}
                title="Cliquer pour modifier le titre"
              >
                {title}
                <span className="text-sm opacity-0 group-hover:opacity-100 transition">
                  ✏️
                </span>
              </h1>
            )}
            <p className="text-gray-300 text-sm">
              {characters.length} personnage{characters.length > 1 ? "s" : ""} •{" "}
              {replicas.length} réplique{replicas.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {(originalFileUrl || full_text) && (
              <button
                onClick={() => setShowOriginalFile(true)}
                className="p-2.5 rounded-lg transition shadow-md bg-blue-500 hover:bg-blue-600 text-white border-2 border-blue-600"
                title="Voir le fichier original"
              >
                📄
              </button>
            )}
            <button
              onClick={() => setShowShareModal(true)}
              className="p-2.5 rounded-lg transition shadow-md bg-green-500 hover:bg-green-600 text-white border-2 border-green-600"
              title="Partager avec ma troupe"
            >
              👥
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2.5 rounded-lg transition shadow-md bg-red-500 hover:bg-red-600 text-white border-2 border-red-600"
              title="Supprimer"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>

      <div className="px-4">
        {stage_directions && (
          <div className="mb-4 p-4 bg-white/80 rounded-lg border-l-4 border-amber-400 shadow">
            <p className="text-gray-700 italic text-sm whitespace-pre-line">
              {stage_directions}
            </p>
          </div>
        )}

        <div className="mb-4">
          {myCharacterId && (
            <div className="mb-2">
              <button
                onClick={() => setHideMyReplicas(!hideMyReplicas)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition border-2 shadow-md whitespace-nowrap
                  ${
                    hideMyReplicas
                      ? "bg-red-600 text-white border-red-700 hover:bg-red-700"
                      : "bg-white text-gray-700 border-gray-300 hover:border-red-400 hover:bg-red-50"
                  }`}
              >
                <span className="text-lg">{hideMyReplicas ? "🚫" : "👁️"}</span>
                <span>{hideMyReplicas ? "Cachées" : "Visibles"}</span>
              </button>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
              <div key={char.id} className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedCharacter(
                      selectedCharacter === char.id ? null : char.id,
                    );
                  }}
                  className="px-4 py-2 rounded-full text-sm whitespace-nowrap transition font-medium shadow"
                  style={{
                    backgroundColor:
                      selectedCharacter === char.id ? char.color : "white",
                    color: selectedCharacter === char.id ? "white" : "#4B5563",
                    border:
                      selectedCharacter === char.id
                        ? `2px solid ${char.color}`
                        : "1px solid #D1D5DB",
                  }}
                >
                  {char.name} ({replicaCountByCharacter[char.id] || 0})
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMyCharacterId(
                      myCharacterId === char.id ? null : char.id,
                    );
                    if (hideMyReplicas && myCharacterId === char.id)
                      setHideMyReplicas(false);
                  }}
                  title={
                    myCharacterId === char.id
                      ? "Retirer mon rôle"
                      : "Marquer comme mon rôle"
                  }
                  className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition border-2 whitespace-nowrap shadow-md ${
                    myCharacterId === char.id
                      ? "bg-gold-400 text-white border-gold-500 hover:bg-gold-500"
                      : "bg-white text-gray-600 border-gray-300 hover:border-gold-400 hover:bg-gold-50"
                  }`}
                >
                  <span className="text-lg">👁️</span>
                  <span className="hidden sm:inline text-sm">
                    {myCharacterId === char.id ? "Mon rôle" : ""}
                  </span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCoachingMode("character");
                    setCoachingCharacterId(char.id);
                  }}
                  title={`Coaching IA pour ${char.name}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition border-2 whitespace-nowrap text-white border-violet-700 hover:shadow-lg active:scale-95 shadow-md"
                  style={{
                    background:
                      "linear-gradient(135deg, #a855f7 0%, #9333ea 100%)",
                  }}
                >
                  <span className="text-lg">✨</span>
                  <span className="hidden sm:inline text-sm">Coach</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* NOUVEAU : Menu "Ciblage de Scènes" (Apparaît si "Mon rôle" est défini) */}
        {myCharacterId && (
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-semibold text-indigo-900 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSceneTargetMode}
                  onChange={(e) => setIsSceneTargetMode(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                🎯 Isoler mes scènes avec...
              </label>
            </div>

            {isSceneTargetMode && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mt-3">
                {characters
                  .filter((c) => c.id !== myCharacterId) // Exclure le rôle du comédien lui-même
                  .map((char) => {
                    const isSelected = targetPartners.includes(char.id);
                    return (
                      <button
                        key={char.id}
                        onClick={() => {
                          setTargetPartners((prev) =>
                            isSelected
                              ? prev.filter((id) => id !== char.id)
                              : [...prev, char.id],
                          );
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition shadow-sm border whitespace-nowrap
                          ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-700"
                              : "bg-white text-gray-600 border-gray-300 hover:bg-indigo-50"
                          }`}
                      >
                        {isSelected ? "✓ " : "+ "}
                        {char.name}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setViewMode("full")}
            className={`py-3 px-3 rounded-lg text-sm font-semibold transition shadow
              ${viewMode === "full" ? "bg-primary-700 text-white" : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"}`}
          >
            📖 Complet
          </button>
          <button
            onClick={() => setViewMode("gaps")}
            className={`py-3 px-3 rounded-lg text-sm font-semibold transition shadow
              ${viewMode === "gaps" ? "bg-primary-700 text-white" : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"}`}
          >
            🔤 Trous
          </button>
          <button
            onClick={() => setViewMode("first3")}
            className={`py-3 px-3 rounded-lg text-sm font-semibold transition shadow
              ${viewMode === "first3" ? "bg-primary-700 text-white" : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"}`}
          >
            3️⃣ 3 mots
          </button>
          <button
            onClick={() => setViewMode("debut_fin")}
            className={`py-3 px-3 rounded-lg text-sm font-semibold transition shadow
              ${viewMode === "debut_fin" ? "bg-primary-700 text-white" : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"}`}
          >
            🟢 Début/Fin
          </button>
          <button
            onClick={() => setViewMode("last_word")}
            className={`py-3 px-3 rounded-lg text-sm font-semibold transition shadow
              ${viewMode === "last_word" ? "bg-primary-700 text-white" : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"}`}
          >
            🟣 Derniers Mots
          </button>
          <button
            onClick={() => setViewMode("cue")}
            className={`py-3 px-3 rounded-lg text-sm font-semibold transition shadow
              ${viewMode === "cue" ? "bg-primary-700 text-white" : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"}`}
          >
            🎭 Répliques
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition
              ${editMode ? "bg-orange-500 text-white shadow-lg" : "bg-white text-gray-600 border border-gray-300 hover:bg-orange-50"}`}
          >
            {editMode ? "✅ Terminer" : "✏️ Mode édition"}
          </button>
          <button
            onClick={() => setShowCharacterManager(true)}
            className="py-2 px-4 rounded-lg text-sm font-semibold bg-white text-gray-600 border border-gray-300 hover:bg-purple-50 transition"
          >
            👥 Personnages
          </button>
          <button
            onClick={() => setShowReplicaGroups(true)}
            className="py-2 px-4 rounded-lg text-sm font-semibold bg-white text-gray-600 border border-gray-300 hover:bg-indigo-50 transition"
          >
            📚 Groupes
          </button>
        </div>

        {studyingGroup && (
          <div className="mb-4 p-3 bg-indigo-100 border border-indigo-300 rounded-lg flex items-center justify-between">
            <p className="text-indigo-800 text-sm">
              <strong>📚 Groupe :</strong> {studyingGroup.name} (
              {studyingGroup.replicaIds?.length} répliques)
            </p>
            <button
              onClick={() => setStudyingGroup(null)}
              className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm"
            >
              ✕ Quitter
            </button>
          </div>
        )}

        {editMode && (
          <div className="mb-4 p-3 bg-orange-100 border border-orange-300 rounded-lg">
            <p className="text-orange-800 text-sm">
              <strong>🔄 Mode édition activé</strong> - Glissez les répliques
              pour les réorganiser. Cliquez sur ➕ pour insérer une réplique à
              un endroit précis.
            </p>
          </div>
        )}

        {totalNotes > 0 && (
          <div className="mb-3">
            <button
              onClick={() => setShowNotesListModal(true)}
              className="flex items-center gap-2 text-sm bg-amber-500/20 text-amber-700 px-3 py-2 rounded-full hover:bg-amber-500/30 transition"
            >
              <span>📝</span>
              <span>
                {totalNotes} note{totalNotes > 1 ? "s" : ""} personnelle
                {totalNotes > 1 ? "s" : ""}
              </span>
              <span className="text-amber-500">→</span>
            </button>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredReplicas
              .filter((r) => r.type !== "divider")
              .map((r) => r.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {filteredReplicas.map((replica, index) => {
                // NOUVEAU : Affichage du séparateur de scène
                if (replica.type === "divider") {
                  return (
                    <div
                      key={replica.id}
                      className="flex items-center justify-center my-6"
                    >
                      <div className="h-px bg-indigo-300 flex-1"></div>
                      <span className="px-4 text-xs font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 rounded-full py-1 shadow-sm border border-indigo-200">
                        {replica.text}
                      </span>
                      <div className="h-px bg-indigo-300 flex-1"></div>
                    </div>
                  );
                }

                const character = characters.find(
                  (c) => c.id === replica.character_id,
                );
                const isRight = characterPositions[replica.character_id] === 1;
                const notesAfterThisReplica =
                  notesByReplicaId[replica.id] || [];

                return (
                  <div key={replica.id}>
                    {editMode && index === 0 && (
                      <button
                        onClick={() => {
                          setInsertAfterIndex(-1);
                          setShowAddReplica(true);
                        }}
                        className="w-full py-2 mb-2 border-2 border-dashed border-orange-400 rounded-lg text-orange-600 text-sm hover:bg-orange-50 transition"
                      >
                        ➕ Insérer au début
                      </button>
                    )}

                    <SortableReplicaBubble
                      replica={replica}
                      character={character}
                      characters={characters}
                      viewMode={viewMode}
                      isRight={isRight}
                      number={index + 1}
                      editMode={editMode}
                      myCharacterId={myCharacterId}
                      hideMyReplicas={hideMyReplicas}
                      onEdit={() => setEditingReplica(replica)}
                      onDelete={() => setDeleteReplicaConfirm(replica)}
                      onSplit={() => setSplittingReplica(replica)}
                      onAddNote={() =>
                        setShowAddNote({ afterReplicaId: replica.id })
                      }
                    />

                    {notesAfterThisReplica.map((note) => (
                      <NoteBubble
                        key={note.id}
                        note={note}
                        onEdit={() => setEditingNote(note)}
                        onDelete={() => setDeleteNoteConfirm(note)}
                      />
                    ))}

                    {editMode && (
                      <button
                        onClick={() => {
                          setInsertAfterIndex(index);
                          setShowAddReplica(true);
                        }}
                        className="w-full py-2 mt-2 border-2 border-dashed border-orange-400 rounded-lg text-orange-600 text-sm hover:bg-orange-50 transition opacity-50 hover:opacity-100"
                      >
                        ➕ Insérer après #{index + 1}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {filteredReplicas.length === 0 && (
          <p className="text-center text-gray-600 py-8 bg-white/50 rounded-lg">
            Aucune réplique{selectedCharacter ? " pour ce personnage" : ""}
          </p>
        )}
      </div>

      <FloatingActionMenu
        onAddNote={() => setShowAddNote({ afterReplicaId: null })}
        onAddCharacter={() => setShowAddCharacter(true)}
        onAddReplica={() => setShowAddReplica(true)}
        audioLink={`/script/${id}/audio`}
      />

      {editingReplica && (
        <EditReplicaModal
          replica={editingReplica}
          characters={characters}
          onSave={handleSaveReplica}
          onClose={() => setEditingReplica(null)}
        />
      )}

      {showAddReplica && (
        <AddReplicaModal
          characters={characters}
          insertAfterIndex={insertAfterIndex}
          onAdd={handleAddReplicaAt}
          onClose={() => {
            setShowAddReplica(false);
            setInsertAfterIndex(null);
          }}
        />
      )}

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

      {splittingReplica && (
        <SplitReplicaModal
          replica={splittingReplica}
          characters={characters}
          onSplit={handleSplitReplica}
          onAddCharacter={handleAddCharacter}
          onClose={() => setSplittingReplica(null)}
        />
      )}

      {showAddCharacter && (
        <AddCharacterModal
          existingColors={characters.map((c) => c.color)}
          onAdd={handleAddCharacter}
          onClose={() => setShowAddCharacter(false)}
        />
      )}

      {showCharacterManager && (
        <CharacterManagerModal
          characters={characters}
          onEdit={(char) => {
            setEditingCharacter(char);
            setShowCharacterManager(false);
          }}
          onDelete={(char) => {
            setDeleteCharacterConfirm(char);
            setShowCharacterManager(false);
          }}
          onClose={() => setShowCharacterManager(false)}
        />
      )}

      {editingCharacter && (
        <EditCharacterModal
          character={editingCharacter}
          existingColors={characters
            .filter((c) => c.id !== editingCharacter.id)
            .map((c) => c.color)}
          onSave={handleUpdateCharacter}
          onClose={() => setEditingCharacter(null)}
        />
      )}

      {deleteCharacterConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark rounded-xl p-6 max-w-sm w-full border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-2">
              Supprimer {deleteCharacterConfirm.name} ?
            </h3>
            <p className="text-red-400 text-sm mb-4">
              ⚠️ Toutes les répliques de ce personnage seront également
              supprimées !
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteCharacterConfirm(null)}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteCharacter(deleteCharacterConfirm.id)}
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-full font-semibold flex-1"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddNote && (
        <AddNoteModal
          replicas={replicas}
          afterReplicaId={showAddNote.afterReplicaId}
          onAdd={handleAddNote}
          onClose={() => setShowAddNote(null)}
        />
      )}

      {editingNote && (
        <EditNoteModal
          note={editingNote}
          onSave={handleUpdateNote}
          onClose={() => setEditingNote(null)}
        />
      )}

      {deleteNoteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark rounded-xl p-6 max-w-sm w-full border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-2">
              Supprimer cette note ?
            </h3>
            <p className="text-gray-400 text-sm mb-4 line-clamp-2">
              "{deleteNoteConfirm.text}"
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteNoteConfirm(null)}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteNote(deleteNoteConfirm.id)}
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-full font-semibold flex-1"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

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

      {showOriginalFile && (
        <OriginalFileModal
          fileUrl={originalFileUrl}
          fullText={full_text}
          filename={original_filename}
          onClose={() => setShowOriginalFile(false)}
        />
      )}

      {showShareModal && (
        <ShareTroupeModal
          script={currentScript}
          userId={user?.id}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showNotesListModal && (
        <NotesListModal
          notes={currentScript?.personalNotes || []}
          replicas={replicas}
          onClose={() => setShowNotesListModal(false)}
          onEdit={(note) => {
            setShowNotesListModal(false);
            setEditingNote(note);
          }}
          onDelete={(note) => {
            setShowNotesListModal(false);
            setDeleteNoteConfirm(note);
          }}
        />
      )}

      {showReplicaGroups && (
        <ReplicaGroupsManager
          scriptId={id}
          userId={user?.id}
          replicas={replicas}
          characters={characters}
          onClose={() => setShowReplicaGroups(false)}
          onSelectGroup={(group) => setStudyingGroup(group)}
        />
      )}

      {showFloatingRecorder && (
        <FloatingRecorder
          onSave={(recording) => {
            console.log("Enregistrement sauvegardé:", recording);
            setShowFloatingRecorder(false);
          }}
          onClose={() => setShowFloatingRecorder(false)}
        />
      )}

      {coachingMode && (
        <AICoachingModal
          isOpen={true}
          onClose={() => {
            setCoachingMode(null);
            setCoachingCharacterId(null);
          }}
          characterName={
            characters.find((c) => c.id === coachingCharacterId)?.name ||
            "Personnage"
          }
          scriptText={replicas
            .map((r) => `${r.character?.name}: ${r.text}`)
            .join("\n\n")}
          coachingCharacterId={coachingCharacterId}
          allCharacters={characters}
          allReplicas={replicas}
          onSaveAsNote={handleSaveAICoachingNote}
        />
      )}
    </div>
  );
}

function FloatingActionMenu({
  onAddNote,
  onAddCharacter,
  onAddReplica,
  audioLink,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showVoiceHelp, setShowVoiceHelp] = useState(false);
  const navigate = useNavigate();

  const actions = [
    {
      icon: "🎙️",
      label: "Écouter / s'enregistrer",
      color: "bg-gold-500",
      onClick: () => setShowVoiceHelp(true),
    },
    {
      icon: "💬",
      label: "Ajouter réplique",
      color: "bg-green-600",
      onClick: onAddReplica,
    },
    {
      icon: "👤",
      label: "Ajouter personnage",
      color: "bg-purple-600",
      onClick: onAddCharacter,
    },
    {
      icon: "📝",
      label: "Ajouter note",
      color: "bg-amber-500",
      onClick: onAddNote,
    },
  ];

  return (
    <div className="fixed bottom-24 right-4 z-40">
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 -z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
      {isOpen && (
        <div className="absolute bottom-16 right-0 mb-3 space-y-2">
          {actions.map((action, index) =>
            action.link ? (
              <Link
                key={index}
                to={action.link}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-full shadow-lg ${action.color} text-white font-semibold transform transition-all duration-200 animate-fade-in`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="text-xl">{action.icon}</span>
                <span className="text-sm whitespace-nowrap">
                  {action.label}
                </span>
              </Link>
            ) : (
              <button
                key={index}
                onClick={() => {
                  setIsOpen(false);
                  action.onClick();
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-full shadow-lg ${action.color} text-white font-semibold transform transition-all duration-200 animate-fade-in`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="text-xl">{action.icon}</span>
                <span className="text-sm whitespace-nowrap">
                  {action.label}
                </span>
              </button>
            ),
          )}
        </div>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition-all duration-300 transform ${
          isOpen
            ? "bg-gray-700 text-white rotate-45"
            : "bg-red-500 text-white hover:bg-red-400 hover:scale-110"
        }`}
      >
        ➕
      </button>
      {showVoiceHelp && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowVoiceHelp(false)}
        >
          <div
            className="bg-gray-800 rounded-xl p-6 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-3">
              Écouter / s'enregistrer
            </h3>
            <span className="text-5xl block mb-4">🎙️</span>
            <p className="text-gray-300 mb-4">
              Écoutez ou enregistrez votre voix sur{" "}
              <strong>chaque réplique</strong> individuellement.
            </p>
            <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 mb-4">
              <p className="text-orange-300 text-sm">
                👉 Appuyez sur le bouton{" "}
                <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs">
                  ▶️ Écouter
                </span>{" "}
                ou{" "}
                <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs">
                  🎤 Enregistrer
                </span>{" "}
                sous chaque bulle
              </p>
            </div>
            <p className="text-gray-500 text-xs mb-4">
              Vous pouvez effacer et recommencer autant de fois que vous voulez.
            </p>
            <button
              onClick={() => {
                setShowVoiceHelp(false);
                navigate(audioLink);
              }}
              className="w-full py-3 bg-red-600 text-white rounded-lg font-bold"
            >
              C'est compris ! →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableReplicaBubble({
  replica,
  character,
  characters,
  viewMode,
  isRight,
  number,
  editMode,
  onEdit,
  onDelete,
  onSplit,
  onAddNote,
  myCharacterId,
  hideMyReplicas,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: replica.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {editMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing bg-orange-500 text-white p-2 rounded-lg shadow-lg hover:bg-orange-600"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          </svg>
        </div>
      )}
      <ChatBubble
        replica={replica}
        character={character}
        viewMode={viewMode}
        isRight={isRight}
        number={number}
        editMode={editMode}
        onEdit={onEdit}
        onDelete={onDelete}
        onSplit={onSplit}
        onAddNote={onAddNote}
        myCharacterId={myCharacterId}
        hideMyReplicas={hideMyReplicas}
      />
    </div>
  );
}

function ChatBubble({
  replica,
  character,
  viewMode,
  isRight,
  number,
  editMode,
  onEdit,
  onDelete,
  onSplit,
  onAddNote,
  myCharacterId,
  hideMyReplicas,
}) {
  const [revealed, setRevealed] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const bubbleColor = character?.color || "#6B7280";

  const hexToRgba = (hex, alpha) => {
    if (!hex) return `rgba(107, 114, 128, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const isHiddenReplica =
    hideMyReplicas &&
    myCharacterId &&
    replica.character_id === myCharacterId &&
    !revealed;

  const renderContent = () => {
    if (isHiddenReplica) {
      return (
        <div className="text-center py-3">
          <p className="text-white/40 italic">(Réplique cachée)</p>
          <p className="text-white/60 text-xs mt-2">👆 Touchez pour révéler</p>
        </div>
      );
    }
    const stripHtml = (html) => {
      const tmp = document.createElement("div");
      tmp.innerHTML = html || "";
      return tmp.textContent || tmp.innerText || "";
    };

    const getFirst3Words = (text) => {
      const plain = stripHtml(text || "");
      const words = plain.trim().split(/\s+/).slice(0, 3);
      return (
        words.join(" ") + (plain.trim().split(/\s+/).length > 3 ? "..." : "")
      );
    };

    switch (viewMode) {
      case "gaps":
        if (revealed) {
          return (
            <p
              className="text-white whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(replica.text || ""),
              }}
            />
          );
        } else {
          return (
            <p className="text-white/80 font-mono text-sm tracking-wide whitespace-pre-wrap">
              {replica.text_gaps || stripHtml(replica.text)}
            </p>
          );
        }

      case "first3":
        return (
          <div>
            <p className="text-white font-bold">
              {getFirst3Words(replica.text)}
            </p>
            {revealed ? (
              <p
                className="text-white whitespace-pre-wrap mt-2 pt-2 border-t border-white/20"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(replica.text || ""),
                }}
              />
            ) : (
              <p className="text-white/60 text-xs text-center mt-2">
                👆 Toucher pour voir la suite
              </p>
            )}
          </div>
        );

      case "debut_fin":
        const getFirstAndLast = (text) => {
          const plain = stripHtml(text || "").trim();
          if (!plain) return "";
          const words = plain.split(/\s+/);
          if (words.length <= 2) return words.join(" ");
          return `${words[0]} ... ${words[words.length - 1]}`;
        };

        return (
          <div>
            <p className="text-white font-bold">
              {getFirstAndLast(replica.text)}
            </p>
            {revealed ? (
              <p
                className="text-white whitespace-pre-wrap mt-2 pt-2 border-t border-white/20"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(replica.text || ""),
                }}
              />
            ) : (
              <p className="text-white/60 text-xs text-center mt-2">
                👆 Toucher pour voir la suite
              </p>
            )}
          </div>
        );

      case "last_word":
        const getLastWord = (text) => {
          const plain = stripHtml(text || "").trim();
          if (!plain) return "";
          const words = plain.split(/\s+/);
          return words[words.length - 1] || "";
        };

        return (
          <div>
            <p className="text-white font-bold">{getLastWord(replica.text)}</p>
            {revealed ? (
              <p
                className="text-white whitespace-pre-wrap mt-2 pt-2 border-t border-white/20"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(replica.text || ""),
                }}
              />
            ) : (
              <p className="text-white/60 text-xs text-center mt-2">
                👆 Toucher pour voir la suite
              </p>
            )}
          </div>
        );

      case "cue":
        return (
          <div>
            {replica.cue_words && (
              <p className="text-white/70 italic text-xs mb-2 pb-2 border-b border-white/20">
                💬 {replica.cue_words}
              </p>
            )}
            {revealed ? (
              <p
                className="text-white whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(replica.text || ""),
                }}
              />
            ) : (
              <p className="text-white/70 text-sm text-center py-2">
                👆 Toucher pour révéler
              </p>
            )}
          </div>
        );

      default:
        return (
          <p
            className="text-white leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(replica.text || ""),
            }}
          />
        );
    }
  };

  const isClickable = viewMode !== "full" || isHiddenReplica;

  const handleBubbleClick = () => {
    if (isClickable) setRevealed(!revealed);
  };

  return (
    <div className={`flex ${isRight ? "justify-end" : "justify-start"} mb-1`}>
      <div
        className={`relative max-w-[85%] ${isClickable ? "cursor-pointer active:scale-[0.98]" : ""} transition-transform duration-150`}
        onClick={handleBubbleClick}
      >
        <div
          className={`px-4 py-3 rounded-2xl relative shadow-lg ${isRight ? "rounded-br-md" : "rounded-bl-md"}`}
          style={{
            backgroundColor: hexToRgba(bubbleColor, 0.85),
            border: `2px solid ${hexToRgba(bubbleColor, 0.9)}`,
          }}
        >
          <div
            className={`absolute bottom-0 w-3 h-3 ${isRight ? "-right-1.5" : "-left-1.5"}`}
            style={{
              backgroundColor: hexToRgba(bubbleColor, 0.85),
              clipPath: isRight
                ? "polygon(0 0, 100% 100%, 0 100%)"
                : "polygon(100% 0, 100% 100%, 0 100%)",
            }}
          />
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white drop-shadow">
                {character?.name || "Inconnu"}
              </span>
              {editMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="text-xs bg-white/10 text-white px-2 py-1 rounded-md hover:bg-white/20"
                  title="Modifier"
                >
                  ✏️
                </button>
              )}
            </div>
            <span className="text-xs text-white/70">#{number}</span>
          </div>
          <div className="text-sm text-white">{renderContent()}</div>
          {isClickable && (
            <div className="flex justify-end mt-1">
              <span className="text-xs text-white/60">
                {revealed ? "✓ Visible" : "👆"}
              </span>
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center bg-white border-2 border-gray-300 shadow-md hover:border-primary-400 hover:shadow-lg transition-all z-10"
            title="Options"
          >
            <span className="text-gray-400 text-sm font-bold leading-none">
              ⋯
            </span>
          </button>
        </div>
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
              }}
            />
            <div className="absolute z-50 right-0 top-6 bg-gray-900 border border-gray-700 rounded-xl shadow-xl py-2 min-w-[160px]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onEdit();
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-primary-600 flex items-center gap-3 transition"
              >
                <span>✏️</span> Modifier
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onAddNote();
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-amber-600 flex items-center gap-3 transition"
              >
                <span>📝</span> Ajouter note
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onSplit();
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-orange-600 flex items-center gap-3 transition"
              >
                <span>✂️</span> Diviser
              </button>
              <div className="border-t border-gray-700 my-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onDelete();
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-600 hover:text-white flex items-center gap-3 transition"
              >
                <span>🗑️</span> Supprimer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AddReplicaModal({ characters, insertAfterIndex, onAdd, onClose }) {
  const [selectedCharId, setSelectedCharId] = useState(
    characters[0]?.id || null,
  );
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!text.trim() || !selectedCharId) return;
    setSaving(true);
    try {
      await onAdd(selectedCharId, text.trim(), insertAfterIndex);
    } catch (err) {
      console.error("Erreur ajout:", err);
      setSaving(false);
    }
  };

  const selectedChar = characters.find((c) => c.id === selectedCharId);
  const canSubmit = text.trim() && selectedCharId && !saving;
  const insertMessage =
    insertAfterIndex === -1
      ? "📍 Sera inséré au début du texte"
      : insertAfterIndex !== null && insertAfterIndex !== undefined
        ? `📍 Sera inséré après la réplique #${insertAfterIndex + 1}`
        : "📍 Sera ajouté à la fin du texte";

  return (
    <div className="fixed inset-0 z-[60] bg-black/95">
      <div className="h-full flex flex-col max-h-screen">
        <div className="flex-none p-4 border-b border-gray-700 bg-dark flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            ✏️ Ajouter une réplique
          </h3>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 p-3 bg-orange-500/20 border border-orange-500/50 rounded-lg">
            <p className="text-orange-400 text-sm font-medium">
              {insertMessage}
            </p>
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Personnage
            </label>
            <div className="flex gap-2 flex-wrap">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharId(char.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition"
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
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Texte de la réplique
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-28 bg-gray-800 border border-gray-600 rounded-xl p-4 text-white text-base resize-none focus:border-gold-500 focus:outline-none"
              placeholder="Entrez le texte de la réplique..."
              autoFocus
            />
          </div>
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
        <div className="flex-none p-4 border-t border-gray-700 bg-dark">
          <button
            onClick={handleAdd}
            disabled={!canSubmit}
            className={`w-full py-4 rounded-xl text-lg font-bold transition ${canSubmit ? "bg-gold-500 hover:bg-gold-400 text-dark shadow-lg" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
          >
            {saving ? "⏳ Ajout en cours..." : "✅ AJOUTER LA RÉPLIQUE"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditReplicaModal({ replica, characters, onSave, onClose }) {
  const [selectedCharId, setSelectedCharId] = useState(replica.character_id);
  const [text, setText] = useState(replica.text || "");
  const [saving, setSaving] = useState(false);
  const editableRef = useRef(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarStyle, setToolbarStyle] = useState({ top: 0, left: 0 });
  const touchPos = useRef({ x: 0, y: 0 });
  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

  useEffect(() => {
    if (editableRef.current) {
      editableRef.current.innerHTML = replica.text || "";
      setText(replica.text || "");
    }
  }, [replica]);

  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        setShowToolbar(false);
        return;
      }
      const range = sel.getRangeAt(0);
      const container = range.commonAncestorContainer;
      if (!editableRef.current || !editableRef.current.contains(container)) {
        setShowToolbar(false);
        return;
      }
      const rect = range.getBoundingClientRect();
      setToolbarStyle({
        top: rect.top - 48 + window.scrollY,
        left: rect.left + window.scrollX,
      });
      setShowToolbar(!sel.isCollapsed);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  useEffect(() => {
    const onTouchEnd = (e) => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      if (
        !editableRef.current ||
        !editableRef.current.contains(range.commonAncestorContainer)
      )
        return;
      const rect = range.getBoundingClientRect();
      const top =
        rect && rect.top
          ? rect.top - 48 + window.scrollY
          : touchPos.current.y - 48 + window.scrollY;
      const left =
        rect && rect.left
          ? rect.left + window.scrollX
          : touchPos.current.x + window.scrollX;
      setToolbarStyle({ top, left });
      setShowToolbar(true);
    };
    const onTouchStart = (e) => {
      const t = e.touches && e.touches[0];
      if (t) touchPos.current = { x: t.clientX, y: t.clientY };
    };
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    return () => {
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchstart", onTouchStart);
    };
  }, []);

  const handleInput = (e) => setText(e.currentTarget.innerHTML);
  const applyHighlight = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!editableRef.current.contains(range.commonAncestorContainer)) return;
    const mark = document.createElement("mark");
    mark.className = "rc-highlight";
    mark.style.backgroundColor = "#ffe58a";
    mark.style.borderRadius = "2px";
    mark.style.padding = "0 2px";
    try {
      range.surroundContents(mark);
    } catch (e) {
      const contents = range.extractContents();
      mark.appendChild(contents);
      range.insertNode(mark);
    }
    sel.removeAllRanges();
    setShowToolbar(false);
    setText(editableRef.current.innerHTML);
  };

  const removeHighlight = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    let node = range.commonAncestorContainer;
    if (node.nodeType === 3) node = node.parentNode;
    if (!node.querySelectorAll) return;
    const marks = node.querySelectorAll("mark.rc-highlight");
    marks.forEach((m) => {
      const parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
    });
    sel.removeAllRanges();
    setShowToolbar(false);
    setText(editableRef.current.innerHTML);
  };

  const handleSave = async () => {
    if (!editableRef.current) return;
    const raw = editableRef.current.innerHTML;
    if (!raw || !raw.trim()) return;
    const clean = DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ["mark", "b", "i", "em", "strong", "br", "p", "span"],
      ALLOWED_ATTR: ["class"],
    });
    setSaving(true);
    try {
      await onSave(replica.id, selectedCharId, clean);
    } finally {
      setSaving(false);
    }
  };

  const selectedChar = characters.find((c) => c.id === selectedCharId);

  return (
    <div className="fixed inset-0 z-[60] bg-black/95">
      <div className="h-full flex flex-col max-h-screen">
        <div className="flex-none p-4 border-b border-gray-700 bg-dark flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            ✏️ Modifier la réplique
          </h3>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Personnage
            </label>
            <div className="flex gap-2 flex-wrap">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharId(char.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition"
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
          <div>
            <label className="block text-sm text-gray-400 mb-2">Texte</label>
            <div
              ref={editableRef}
              onInput={handleInput}
              contentEditable
              suppressContentEditableWarning
              className="w-full min-h-[8rem] bg-gray-800 border border-gray-600 rounded-xl p-4 text-white text-base focus:border-gold-500 focus:outline-none"
              placeholder="Texte de la réplique..."
            />
          </div>
          {showToolbar && (
            <div
              className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg flex items-center gap-2 p-2"
              style={{ top: toolbarStyle.top, left: toolbarStyle.left }}
            >
              <button
                onClick={applyHighlight}
                className="px-2 py-1 bg-amber-400 text-dark rounded"
              >
                Surligner
              </button>
              <button
                onClick={removeHighlight}
                className="px-2 py-1 bg-gray-700 text-white rounded"
              >
                Retirer
              </button>
            </div>
          )}
          {isMobile && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex gap-3">
              <button
                onClick={() => {
                  applyHighlight();
                  setTimeout(() => setShowToolbar(false), 200);
                }}
                className="px-4 py-2 bg-amber-400 text-dark rounded-xl shadow-lg"
              >
                Surligner
              </button>
              <button
                onClick={() => {
                  removeHighlight();
                  setTimeout(() => setShowToolbar(false), 200);
                }}
                className="px-4 py-2 bg-gray-700 text-white rounded-xl shadow-lg"
              >
                Retirer
              </button>
            </div>
          )}
          <div
            className="p-4 rounded-lg"
            style={{
              backgroundColor: `${selectedChar?.color || "#666"}20`,
              borderLeft: `4px solid ${selectedChar?.color || "#666"}`,
            }}
          >
            <p
              className="text-xs font-semibold mb-1"
              style={{ color: selectedChar?.color || "#999" }}
            >
              {selectedChar?.name || "?"}
            </p>
            <div
              className="text-gray-300 text-sm"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(text || "..."),
              }}
            />
          </div>
        </div>
        <div className="flex-none p-4 border-t border-gray-700 bg-dark">
          <button
            onClick={handleSave}
            disabled={!text.trim() || saving}
            className={`w-full py-4 rounded-xl text-lg font-bold transition ${text.trim() && !saving ? "bg-gold-500 hover:bg-gold-400 text-dark shadow-lg" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
          >
            {saving ? "⏳ Sauvegarde..." : "✅ SAUVEGARDER"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OriginalFileModal({ fileUrl, fullText, filename, onClose }) {
  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
  const [showText, setShowText] = useState(isMobile);
  const [pdfError, setPdfError] = useState(false);
  const [checkingPdf, setCheckingPdf] = useState(!isMobile);
  const isPdf = filename?.toLowerCase().endsWith(".pdf");

  useEffect(() => {
    if (fileUrl && isPdf && !isMobile) {
      setCheckingPdf(true);
      fetch(fileUrl, { method: "HEAD" })
        .then((res) => {
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
          <h3 className="text-white font-semibold truncate">
            {filename || "Fichier original"}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {fullText && fileUrl && !pdfError && (
            <button
              onClick={() => setShowText(!showText)}
              className={`px-3 py-1 rounded-lg text-sm transition ${showText ? "bg-primary-600 text-white" : "bg-gray-700 text-gray-300"}`}
            >
              {showText ? "📄 PDF" : "📝 Texte"}
            </button>
          )}
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
                  ⚠️ Le fichier PDF original n'est plus disponible. Voici le
                  texte extrait :
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
            <p className="text-gray-400 mb-4">
              Aperçu non disponible pour ce type de fichier
            </p>
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

function ShareTroupeModal({ script, userId, onClose }) {
  const [troupes, setTroupes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadTroupes = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        const userTroupes = await fetchUserTroupes(userId);
        setTroupes(userTroupes || []);
      } catch (err) {
        console.error(err);
        setTroupes([]);
      } finally {
        setLoading(false);
      }
    };
    loadTroupes();
  }, [userId]);

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
      if (err.message?.includes("déjà partagé"))
        setError("Ce texte est déjà partagé avec cette troupe");
      else setError(err.message || "Erreur lors du partage");
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
              <p className="text-gray-400 mb-2">
                Vous n'avez pas encore de troupe
              </p>
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
                    className="w-full p-4 bg-gray-800 hover:bg-primary-600/30 rounded-xl text-left transition flex items-center justify-between border border-gray-700 hover:border-primary-500"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎭</span>
                      <div>
                        <p className="text-white font-medium">{troupe.name}</p>
                        <p className="text-gray-500 text-xs">
                          Code: {troupe.code}
                        </p>
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
              <p className="text-green-400 text-center font-medium">
                {success}
              </p>
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

function SplitReplicaModal({
  replica,
  characters,
  onSplit,
  onAddCharacter,
  onClose,
}) {
  const [splitPosition, setSplitPosition] = useState(null);
  const [selectedCharId, setSelectedCharId] = useState(null);
  const [showNewCharForm, setShowNewCharForm] = useState(false);
  const [newCharName, setNewCharName] = useState("");
  const [saving, setSaving] = useState(false);

  const text = replica.text;
  const CHARACTER_COLORS = [
    "#8B1538",
    "#2563EB",
    "#059669",
    "#D97706",
    "#7C3AED",
    "#DC2626",
    "#0891B2",
    "#4F46E5",
    "#DB2777",
    "#65A30D",
    "#0D9488",
    "#6366F1",
    "#EA580C",
    "#84CC16",
    "#EC4899",
  ];
  const usedColors = characters.map((c) => c.color);
  const availableColors = CHARACTER_COLORS.filter(
    (c) => !usedColors.includes(c),
  );
  const [newCharColor, setNewCharColor] = useState(
    availableColors[0] || CHARACTER_COLORS[0],
  );

  const findPotentialSplitPoints = () => {
    const regex = /([A-ZÀ-Ÿ]{2,}(?:[-'\s][A-ZÀ-Ÿ]+)*)\s*[:\-–]/g;
    const points = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > 10)
        points.push({
          position: match.index,
          name: match[1].trim(),
          preview: text.substring(
            Math.max(0, match.index - 20),
            match.index + 30,
          ),
        });
    }
    return points;
  };
  const potentialSplitPoints = findPotentialSplitPoints();

  const handleSplit = async () => {
    if (splitPosition === null || !selectedCharId) return;
    setSaving(true);
    try {
      await onSplit(replica, splitPosition, selectedCharId);
    } catch (err) {
      console.error("Erreur division:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAndSelect = async () => {
    if (!newCharName.trim()) return;
    setSaving(true);
    try {
      const newChar = await onAddCharacter(
        newCharName.trim().toUpperCase(),
        newCharColor,
      );
      setSelectedCharId(newChar.id);
      setShowNewCharForm(false);
    } catch (err) {
      console.error("Erreur création personnage:", err);
    } finally {
      setSaving(false);
    }
  };

  const firstPart =
    splitPosition !== null ? text.substring(0, splitPosition).trim() : text;
  const secondPart =
    splitPosition !== null ? text.substring(splitPosition).trim() : "";
  const currentChar = characters.find((c) => c.id === replica.character_id);
  const selectedChar = characters.find((c) => c.id === selectedCharId);

  return (
    <div className="fixed inset-0 z-[70] bg-black/95">
      <div className="h-full flex flex-col max-h-screen">
        <div className="flex-none p-4 border-b border-gray-700 bg-dark flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            ✂️ Diviser la réplique
          </h3>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gold-500 mb-2">
              1️⃣ Où voulez-vous couper ?
            </h4>
            {potentialSplitPoints.length > 0 && (
              <div className="mb-4">
                <p className="text-gray-400 text-xs mb-2">
                  Points de coupure détectés :
                </p>
                <div className="space-y-2">
                  {potentialSplitPoints.map((point, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSplitPosition(point.position)}
                      className={`w-full text-left p-3 rounded-lg border transition text-sm ${splitPosition === point.position ? "bg-orange-600/20 border-orange-500 text-orange-300" : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500"}`}
                    >
                      <span className="font-bold text-white">{point.name}</span>
                      <span className="text-gray-500 ml-2 text-xs">
                        Position {point.position}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-4">
              <label className="text-gray-400 text-xs mb-1 block">
                Ou entrez la position manuellement :
              </label>
              <input
                type="number"
                min="1"
                max={text.length - 1}
                value={splitPosition || ""}
                onChange={(e) =>
                  setSplitPosition(parseInt(e.target.value) || null)
                }
                className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-white"
                placeholder="Position du caractère..."
              />
            </div>
          </div>
          {splitPosition !== null && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gold-500 mb-2">
                📝 Aperçu
              </h4>
              <div className="space-y-3">
                <div
                  className="p-3 rounded-xl"
                  style={{
                    backgroundColor: `${currentChar?.color || "#666"}dd`,
                  }}
                >
                  <p className="text-xs font-bold text-white/80 mb-1">
                    {currentChar?.name} (conservé)
                  </p>
                  <p className="text-white text-sm">{firstPart || "(vide)"}</p>
                </div>
                <div className="text-center text-gray-500">
                  ✂️ - - - - - - - - - - ✂️
                </div>
                <div
                  className="p-3 rounded-xl"
                  style={{
                    backgroundColor: `${selectedChar?.color || "#666"}dd`,
                  }}
                >
                  <p className="text-xs font-bold text-white/80 mb-1">
                    {selectedChar?.name || "❓ Choisir le personnage"}
                  </p>
                  <p className="text-white text-sm">{secondPart || "(vide)"}</p>
                </div>
              </div>
            </div>
          )}
          {splitPosition !== null && secondPart && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gold-500 mb-2">
                2️⃣ Attribuer à quel personnage ?
              </h4>
              <div className="flex gap-2 flex-wrap mb-3">
                {characters.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => {
                      setSelectedCharId(char.id);
                      setShowNewCharForm(false);
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition"
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
              <button
                onClick={() => setShowNewCharForm(!showNewCharForm)}
                className={`w-full p-3 rounded-lg border-2 border-dashed transition text-sm ${showNewCharForm ? "border-green-500 bg-green-500/10 text-green-400" : "border-gray-600 text-gray-400 hover:border-gray-500"}`}
              >
                ➕ Créer un nouveau personnage
              </button>
              {showNewCharForm && (
                <div className="mt-3 p-4 bg-gray-800 rounded-xl border border-gray-700">
                  <div className="mb-3">
                    <label className="text-gray-400 text-xs mb-1 block">
                      Nom du personnage
                    </label>
                    <input
                      type="text"
                      value={newCharName}
                      onChange={(e) => setNewCharName(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white uppercase"
                      placeholder="Ex: L'ADJUDANT-CHEF"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="text-gray-400 text-xs mb-1 block">
                      Couleur
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {CHARACTER_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewCharColor(color)}
                          className={`w-8 h-8 rounded-full transition ${newCharColor === color ? "ring-2 ring-white ring-offset-2 ring-offset-gray-800" : ""}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleCreateAndSelect}
                    disabled={!newCharName.trim() || saving}
                    className={`w-full py-3 rounded-lg font-semibold transition ${newCharName.trim() && !saving ? "bg-green-600 hover:bg-green-500 text-white" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
                  >
                    {saving ? "⏳ Création..." : "✓ Créer et sélectionner"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex-none p-4 border-t border-gray-700 bg-dark">
          <button
            onClick={handleSplit}
            disabled={
              splitPosition === null || !selectedCharId || !secondPart || saving
            }
            className={`w-full py-4 rounded-xl text-lg font-bold transition ${splitPosition !== null && selectedCharId && secondPart && !saving ? "bg-orange-500 hover:bg-orange-400 text-white shadow-lg" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
          >
            {saving ? "⏳ Division en cours..." : "✂️ DIVISER LA RÉPLIQUE"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddCharacterModal({ existingColors, onAdd, onClose }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const CHARACTER_COLORS = [
    "#8B1538",
    "#2563EB",
    "#059669",
    "#D97706",
    "#7C3AED",
    "#DC2626",
    "#0891B2",
    "#4F46E5",
    "#DB2777",
    "#65A30D",
    "#0D9488",
    "#6366F1",
    "#EA580C",
    "#84CC16",
    "#EC4899",
  ];
  const availableColors = CHARACTER_COLORS.filter(
    (c) => !existingColors.includes(c),
  );
  const [color, setColor] = useState(availableColors[0] || CHARACTER_COLORS[0]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onAdd(name.trim().toUpperCase(), color);
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4">
      <div className="bg-dark rounded-xl max-w-md w-full border border-gray-700">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            ➕ Nouveau personnage
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2"
          >
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-gray-400 text-sm mb-2 block">
              Nom du personnage
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-white uppercase"
              placeholder="Ex: L'ADJUDANT-CHEF"
              autoFocus
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Couleur</label>
            <div className="flex gap-2 flex-wrap">
              {CHARACTER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-full transition ${color === c ? "ring-2 ring-white ring-offset-2 ring-offset-dark" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {name && (
            <div
              className="p-3 rounded-xl"
              style={{ backgroundColor: `${color}dd` }}
            >
              <p className="text-white font-bold">{name.toUpperCase()}</p>
              <p className="text-white/70 text-sm">Aperçu de la couleur</p>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || saving}
            className={`w-full py-3 rounded-xl font-bold transition ${name.trim() && !saving ? "bg-gold-500 hover:bg-gold-400 text-dark" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
          >
            {saving ? "⏳ Création..." : "✓ CRÉER LE PERSONNAGE"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteBubble({ note, onEdit, onDelete }) {
  const NOTE_TYPES = {
    general: { icon: "📝", label: "Note" },
    movement: { icon: "🚶", label: "Déplacement" },
    intention: { icon: "💭", label: "Intention" },
    prop: { icon: "🎪", label: "Accessoire" },
    cue: { icon: "🎯", label: "Repère" },
  };
  const typeInfo = NOTE_TYPES[note.note_type] || NOTE_TYPES.general;

  return (
    <div className="flex justify-center my-2">
      <div className="relative max-w-[90%] group">
        <div className="px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500/90 to-amber-600/90 border-2 border-amber-400 border-dashed shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{typeInfo.icon}</span>
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
              {typeInfo.label}
            </span>
          </div>
          <p className="text-amber-950 text-sm font-medium leading-relaxed">
            {note.text}
          </p>
        </div>
        <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="w-6 h-6 bg-gray-700 hover:bg-primary-600 rounded-full flex items-center justify-center text-xs shadow-lg"
            title="Modifier"
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            className="w-6 h-6 bg-gray-700 hover:bg-red-600 rounded-full flex items-center justify-center text-xs shadow-lg"
            title="Supprimer"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}

function AddNoteModal({ replicas, afterReplicaId, onAdd, onClose }) {
  const [text, setText] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [selectedReplicaId, setSelectedReplicaId] = useState(afterReplicaId);
  const [saving, setSaving] = useState(false);

  const NOTE_TYPES = [
    { value: "general", icon: "📝", label: "Note générale" },
    { value: "movement", icon: "🚶", label: "Déplacement" },
    { value: "intention", icon: "💭", label: "Intention de jeu" },
    { value: "prop", icon: "🎪", label: "Accessoire" },
    { value: "cue", icon: "🎯", label: "Repère / Signal" },
  ];

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onAdd(selectedReplicaId, text.trim(), noteType);
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/95">
      <div className="h-full flex flex-col max-h-screen">
        <div className="flex-none p-4 border-b border-gray-700 bg-dark flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            📝 Ajouter une note
          </h3>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Type de note
            </label>
            <div className="grid grid-cols-2 gap-2">
              {NOTE_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setNoteType(type.value)}
                  className={`p-3 rounded-lg text-sm font-medium transition flex items-center gap-2 ${noteType === type.value ? "bg-amber-500 text-amber-950" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
                >
                  <span className="text-lg">{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Votre note
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-32 bg-gray-800 border border-gray-600 rounded-xl p-4 text-white text-base resize-none focus:border-amber-500 focus:outline-none"
              placeholder="Ex: Avancer vers le public, prendre la chaise..."
              autoFocus
            />
          </div>
          {replicas && replicas.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                Placer après la réplique (optionnel)
              </label>
              <select
                value={selectedReplicaId || ""}
                onChange={(e) => setSelectedReplicaId(e.target.value || null)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-white"
              >
                <option value="">-- Au début du texte --</option>
                {replicas.slice(0, 20).map((r, idx) => (
                  <option key={r.id} value={r.id}>
                    #{idx + 1} - {r.text.substring(0, 40)}...
                  </option>
                ))}
              </select>
            </div>
          )}
          {text && (
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Aperçu</label>
              <div className="px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500/90 to-amber-600/90 border-2 border-amber-400 border-dashed">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">
                    {NOTE_TYPES.find((t) => t.value === noteType)?.icon}
                  </span>
                  <span className="text-xs font-bold text-amber-900 uppercase">
                    {NOTE_TYPES.find((t) => t.value === noteType)?.label}
                  </span>
                </div>
                <p className="text-amber-950 text-sm font-medium">{text}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex-none p-4 border-t border-gray-700 bg-dark">
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || saving}
            className={`w-full py-4 rounded-xl text-lg font-bold transition ${text.trim() && !saving ? "bg-amber-500 hover:bg-amber-400 text-amber-950 shadow-lg" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
          >
            {saving ? "⏳ Enregistrement..." : "✅ AJOUTER LA NOTE"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditNoteModal({ note, onSave, onClose }) {
  const [text, setText] = useState(note.text);
  const [noteType, setNoteType] = useState(note.note_type || "general");
  const [saving, setSaving] = useState(false);

  const NOTE_TYPES = [
    { value: "general", icon: "📝", label: "Note générale" },
    { value: "movement", icon: "🚶", label: "Déplacement" },
    { value: "intention", icon: "💭", label: "Intention de jeu" },
    { value: "prop", icon: "🎪", label: "Accessoire" },
    { value: "cue", icon: "🎯", label: "Repère / Signal" },
  ];

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onSave(note.id, text.trim(), noteType);
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/95">
      <div className="h-full flex flex-col max-h-screen">
        <div className="flex-none p-4 border-b border-gray-700 bg-dark flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            ✏️ Modifier la note
          </h3>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Type de note
            </label>
            <div className="grid grid-cols-2 gap-2">
              {NOTE_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setNoteType(type.value)}
                  className={`p-3 rounded-lg text-sm font-medium transition flex items-center gap-2 ${noteType === type.value ? "bg-amber-500 text-amber-950" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
                >
                  <span className="text-lg">{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Votre note
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-32 bg-gray-800 border border-gray-600 rounded-xl p-4 text-white text-base resize-none focus:border-amber-500 focus:outline-none"
              autoFocus
            />
          </div>
        </div>
        <div className="flex-none p-4 border-t border-gray-700 bg-dark">
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || saving}
            className={`w-full py-4 rounded-xl text-lg font-bold transition ${text.trim() && !saving ? "bg-amber-500 hover:bg-amber-400 text-amber-950 shadow-lg" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
          >
            {saving ? "⏳ Enregistrement..." : "✅ ENREGISTRER"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CharacterManagerModal({ characters, onEdit, onDelete, onClose }) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/95">
      <div className="h-full flex flex-col max-h-screen">
        <div className="flex-none p-4 border-b border-gray-700 bg-dark flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            👥 Gérer les personnages
          </h3>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {characters.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun personnage</p>
          ) : (
            <div className="space-y-3">
              {characters.map((char) => (
                <div
                  key={char.id}
                  className="flex items-center gap-3 p-4 bg-gray-800 rounded-xl border border-gray-700"
                >
                  <div
                    className="w-10 h-10 rounded-full shadow-lg"
                    style={{ backgroundColor: char.color }}
                  />
                  <div className="flex-1">
                    <p className="text-white font-medium">{char.name}</p>
                    <p className="text-gray-500 text-xs">{char.color}</p>
                  </div>
                  <button
                    onClick={() => onEdit(char)}
                    className="p-2 bg-gray-700 hover:bg-primary-600 rounded-lg transition"
                    title="Modifier"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => onDelete(char)}
                    className="p-2 bg-gray-700 hover:bg-red-600 rounded-lg transition"
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex-none p-4 border-t border-gray-700 bg-dark">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function EditCharacterModal({ character, existingColors, onSave, onClose }) {
  const [name, setName] = useState(character.name);
  const [color, setColor] = useState(character.color);
  const [saving, setSaving] = useState(false);
  const CHARACTER_COLORS = [
    "#8B1538",
    "#2563EB",
    "#059669",
    "#D97706",
    "#7C3AED",
    "#DC2626",
    "#0891B2",
    "#4F46E5",
    "#DB2777",
    "#65A30D",
    "#0D9488",
    "#6366F1",
    "#EA580C",
    "#84CC16",
    "#EC4899",
  ];

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(character.id, name.trim().toUpperCase(), color);
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/95">
      <div className="h-full flex flex-col max-h-screen">
        <div className="flex-none p-4 border-b border-gray-700 bg-dark flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            ✏️ Modifier le personnage
          </h3>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Nom du personnage
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-white font-semibold focus:border-purple-500 focus:outline-none"
              placeholder="NOM DU PERSONNAGE"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Couleur</label>
            <div className="grid grid-cols-5 gap-2">
              {CHARACTER_COLORS.map((c) => {
                const isUsed = existingColors.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => !isUsed && setColor(c)}
                    disabled={isUsed}
                    className={`w-12 h-12 rounded-xl transition ${color === c ? "ring-4 ring-white scale-110" : ""} ${isUsed ? "opacity-30 cursor-not-allowed" : "hover:scale-105"}`}
                    style={{ backgroundColor: c }}
                    title={isUsed ? "Déjà utilisé" : c}
                  />
                );
              })}
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Aperçu</label>
            <div
              className="p-4 rounded-xl text-white font-bold text-center"
              style={{ backgroundColor: color }}
            >
              {name || "NOM"}
            </div>
          </div>
        </div>
        <div className="flex-none p-4 border-t border-gray-700 bg-dark">
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || saving}
            className={`w-full py-4 rounded-xl text-lg font-bold transition ${name.trim() && !saving ? "bg-purple-600 hover:bg-purple-500 text-white shadow-lg" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
          >
            {saving ? "⏳ Enregistrement..." : "✅ ENREGISTRER"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NotesListModal({ notes, replicas, onClose, onEdit, onDelete }) {
  const NOTE_TYPES = {
    general: { icon: "📝", label: "Note générale", color: "amber" },
    movement: { icon: "🚶", label: "Déplacement", color: "blue" },
    intention: { icon: "🎭", label: "Intention", color: "purple" },
    accessory: { icon: "🎒", label: "Accessoire", color: "green" },
    cue: { icon: "⏰", label: "Repère", color: "red" },
  };

  const getReplicaContext = (afterReplicaId) => {
    if (!afterReplicaId) return "Au début du texte";
    const replica = replicas.find((r) => r.id === afterReplicaId);
    if (!replica) return "Réplique inconnue";
    return (
      replica.text?.substring(0, 50) + (replica.text?.length > 50 ? "..." : "")
    );
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-dark rounded-xl max-w-lg w-full border border-gray-700 max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            📝 Mes notes personnelles
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notes.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Aucune note pour ce texte
            </p>
          ) : (
            notes.map((note) => {
              const noteType = NOTE_TYPES[note.note_type] || NOTE_TYPES.general;
              return (
                <div
                  key={note.id}
                  className={`p-4 rounded-lg border-l-4 bg-${noteType.color}-500/10 border-${noteType.color}-500`}
                  style={{
                    backgroundColor: `rgba(245, 158, 11, 0.1)`,
                    borderLeftColor:
                      noteType.color === "amber"
                        ? "#f59e0b"
                        : noteType.color === "blue"
                          ? "#3b82f6"
                          : noteType.color === "purple"
                            ? "#8b5cf6"
                            : noteType.color === "green"
                              ? "#22c55e"
                              : "#ef4444",
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-sm">
                      <span>{noteType.icon}</span>
                      <span className="text-gray-400">{noteType.label}</span>
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onEdit(note)}
                        className="text-gray-400 hover:text-blue-400 text-sm"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onDelete(note)}
                        className="text-gray-400 hover:text-red-400 text-sm"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <p className="text-white whitespace-pre-wrap">{note.text}</p>
                  <p className="text-gray-500 text-xs mt-2 italic">
                    Après : "{getReplicaContext(note.after_replica_id)}"
                  </p>
                </div>
              );
            })
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
