import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useScriptStore } from "../store/scriptStore";
import { useAuthStore } from "../store/authStore";
import { getFileUrl, fetchUserTroupes, shareScript } from "../lib/supabase";
import Loader from "../components/ui/Loader";
import ReplicaGroupsManager from "../components/ReplicaGroups";
import FloatingRecorder from "../components/FloatingRecorder";
import AICoachingModal from "../components/AICoachingModal";
import PremiumGateModal from "../components/PremiumGateModal";
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
import { useTheme, THEMES } from "../context/ThemeContext";

function ScriptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isPremium } = useAuthStore();
  const { theme } = useTheme();
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
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (id) {
      fetchScript(id);
      fetchPersonalNotes(id, user?.id);
    }
    return () => clearCurrentScript();
  }, [id, fetchScript, clearCurrentScript, fetchPersonalNotes, user?.id]);

  const characters = currentScript?.characters || [];
  const replicas = currentScript?.replicas || [];

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

  const filteredReplicas = useMemo(() => {
    let result = replicas;
    if (selectedCharacter) {
      result = result.filter((r) => r.character_id === selectedCharacter);
    }
    if (studyingGroup?.replicaIds?.length > 0) {
      const setIds = new Set(studyingGroup.replicaIds);
      result = result.filter((r) => setIds.has(r.id));
    }
    return result;
  }, [replicas, selectedCharacter, studyingGroup]);

  const notesByReplicaId = useMemo(() => {
    const map = {};
    const notes = currentScript?.personalNotes || [];
    notes.forEach((note) => {
      const key = note.after_replica_id || "beginning";
      if (!map[key]) map[key] = [];
      map[key].push(note);
    });
    return map;
  }, [currentScript?.personalNotes]);

  const totalNotes = (currentScript?.personalNotes || []).length;

  const characterPassages = useMemo(() => {
    if (!myCharacterId) return [];
    const passages = [];
    let currentPassage = null;

    replicas.forEach((r, index) => {
      if (r.character_id === myCharacterId) {
        if (!currentPassage) {
          currentPassage = {
            id: passages.length + 1,
            startReplicaIndex: index,
            anchorReplicaId: r.id,
            displayNumber: index + 1,
            replicasCount: 1,
          };
          passages.push(currentPassage);
        } else {
          currentPassage.replicasCount += 1;
        }
      } else {
        currentPassage = null;
      }
    });

    return passages;
  }, [replicas, myCharacterId]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = replicas.findIndex((r) => r.id === active.id);
    const newIndex = replicas.findIndex((r) => r.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(replicas, oldIndex, newIndex);

      const payload = reordered.map((r, index) => ({
        id: r.id,
        order_index: index + 1,
      }));

      try {
        await reorderReplicas(id, payload);
      } catch (err) {
        console.error("Erreur de réorganisation:", err);
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deleteScript(id);
      navigate("/");
    } catch (err) {
      console.error("Error deleting script:", err);
    }
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

  const handleSaveReplica = async (replicaId, charId, text) => {
    try {
      await updateReplica(replicaId, { character_id: charId, text });
      setEditingReplica(null);
    } catch (err) {
      console.error("Error updating replica:", err);
    }
  };

  const handleDeleteReplica = async (replicaId) => {
    try {
      await deleteReplica(replicaId);
      setDeleteReplicaConfirm(null);
    } catch (err) {
      console.error("Error deleting replica:", err);
    }
  };

  const handleAddReplicaAt = async (charId, text, positionIndex) => {
    try {
      let orderIndex = positionIndex + 1;
      await addSingleReplica(id, charId, text, orderIndex);
      setShowAddReplica(false);
      setInsertAfterIndex(null);
    } catch (err) {
      console.error("Error adding replica:", err);
    }
  };

  const handleAddCharacter = async (name, color) => {
    try {
      await addCharacter(id, name, color);
      setShowAddCharacter(false);
    } catch (err) {
      console.error("Error adding character:", err);
    }
  };

  const handleUpdateCharacter = async (charId, name, color) => {
    try {
      await updateCharacter(charId, { name, color });
      setEditingCharacter(null);
    } catch (err) {
      console.error("Error updating character:", err);
    }
  };

  const handleDeleteCharacter = async (charId) => {
    try {
      await deleteCharacter(charId);
      setDeleteCharacterConfirm(null);
    } catch (err) {
      console.error("Error deleting character:", err);
    }
  };

  const handleSplitReplica = async (replicaId, position, newCharId) => {
    const replica = replicas.find((r) => r.id === replicaId);
    if (!replica) return;

    const originalText = replica.text;
    const firstPart = originalText.substring(0, position).trim();
    const secondPart = originalText.substring(position).trim();

    try {
      await updateReplica(replicaId, { text: firstPart });
      const currentOrder = replica.order_index || 1;
      await addSingleReplica(id, newCharId, secondPart, currentOrder + 1);
      setSplittingReplica(null);
    } catch (err) {
      console.error("Error splitting replica:", err);
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

  const handleUpdateNote = async (noteId, text, noteType) => {
    try {
      await updatePersonalNote(noteId, { text, note_type: noteType });
      setEditingNote(null);
    } catch (err) {
      console.error("Error updating note:", err);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await deletePersonalNote(noteId);
      setDeleteNoteConfirm(null);
    } catch (err) {
      console.error("Error deleting note:", err);
    }
  };

  const handleCoachClick = (e, characterId) => {
    e.stopPropagation();
    if (!isPremium) {
      setShowPremiumModal(true);
    } else {
      setCoachingCharacterId(characterId);
      setCoachingMode("open");
    }
  };

  const handleSaveAICoachingNote = async (noteText) => {
    try {
      await addPersonalNote({
        user_id: user.id,
        script_id: id,
        after_replica_id: null,
        text: noteText,
        note_type: "intention",
      });
      alert("✓ Suggestion sauvegardée dans vos notes personnelles !");
    } catch (err) {
      console.error(err);
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

  const { title, stage_directions, full_text, original_filename } = currentScript;

  return (
    <div className="pb-32 min-h-screen bg-darker">
      {/* En-tête de la pièce */}
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

        {/* Filtres personnages */}
        <div className="mb-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedCharacter(null)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition font-medium shadow ${
                !selectedCharacter
                  ? "bg-gold-500 text-dark font-bold"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
              }`}
            >
              Tous ({replicas.length})
            </button>

            {characters.map((char) => (
              <div key={char.id} className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setSelectedCharacter(
                      selectedCharacter === char.id ? null : char.id
                    )
                  }
                  className="px-4 py-2 rounded-full text-sm whitespace-nowrap transition font-medium shadow text-white"
                  style={{
                    backgroundColor:
                      selectedCharacter === char.id ? char.color : "#374151",
                    border: `2px solid ${char.color}`,
                  }}
                >
                  {char.name} ({replicaCountByCharacter[char.id] || 0})
                </button>

                <button
                  onClick={(e) => handleCoachClick(e, char.id)}
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

        {/* DnD Liste des répliques */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredReplicas.map((r) => r.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {filteredReplicas.map((replica, index) => {
                const character = characters.find(
                  (c) => c.id === replica.character_id
                );
                const isRight = characterPositions[replica.character_id] === 1;

                return (
                  <div key={replica.id} id={`replica-anchor-${replica.id}`}>
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
                  </div>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

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
            .join("

")}
          coachingCharacterId={coachingCharacterId}
          allCharacters={characters}
          allReplicas={replicas}
          onSaveAsNote={handleSaveAICoachingNote}
        />
      )}

      {showPremiumModal && (
        <PremiumGateModal
          featureKey="AI_COACHING"
          onClose={() => setShowPremiumModal(false)}
        />
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: replica.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
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

  const stripHtml = (html) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html || "";
    return tmp.textContent || tmp.innerText || "";
  };

  return (
    <div className={`flex ${isRight ? "justify-end" : "justify-start"} mb-1`}>
      <div className="relative max-w-[85%] transition-transform duration-150">
        <div
          className={`px-4 py-3 rounded-2xl relative shadow-lg ${
            isRight ? "rounded-br-md" : "rounded-bl-md"
          }`}
          style={{
            backgroundColor: hexToRgba(bubbleColor, 0.9),
            border: `2px solid ${hexToRgba(bubbleColor, 0.95)}`,
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-bold text-white drop-shadow">
              {character?.name || "Inconnu"}
            </span>
            <span className="text-xs text-white/70">#{number}</span>
          </div>

          <div
            className="text-sm text-white leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(replica.text || ""),
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default ScriptDetail;
