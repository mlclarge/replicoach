import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useScriptStore } from "../store/scriptStore";
import { useAuthStore } from "../store/authStore";
import Loader from "../components/ui/Loader";
import AICoachingModal from "../components/AICoachingModal";
import DocumentViewer from "../components/DocumentViewer";
import {
  fetchScriptNotes,
  createScriptNote,
  deleteScriptNote,
  updateScriptNote,
  uploadNoteAttachment,
  deleteNoteAttachment,
  getDirectorNoteUrl,
} from "../lib/supabase";
import PremiumGateModal from "../components/PremiumGateModal";
import "../styles/mes-saynetes.css";

function ScriptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Récupération de user et isPremium pour la gestion du Coach IA
  const { user, isPremium } = useAuthStore();

  const { currentScript, loading, fetchScript, updateReplica, deleteScript } =
    useScriptStore();

  // Personnage sélectionné par l'utilisateur
  const [myCharacterId, setMyCharacterId] = useState(() => {
    return localStorage.getItem(`myCharacter_${id}`) || null;
  });

  // Mode de travail ('all' = tout voir, 'cues' = uniquement mes répliques + amorces, 'gaps' = trous)
  const [workMode, setWorkMode] = useState("all");

  // Masquage progressif pour révision ('none', 'first_words', 'hidden')
  const [hideMode, setHideMode] = useState("none");

  // Filtre par personnage unique
  const [selectedCharacter, setSelectedCharacter] = useState(null);

  // Vue par groupes de scènes/séquences
  const [studyingGroup, setStudyingGroup] = useState(null);

  // État d'édition d'une réplique
  const [editingReplicaId, setEditingReplicaId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editCharacterId, setEditCharacterId] = useState("");

  // État d'affichage des notes par réplique
  const [activeNoteReplicaId, setActiveNoteReplicaId] = useState(null);
  const [notes, setNotes] = useState({});
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteType, setNewNoteType] = useState("general");
  const [newNoteFile, setNewNoteFile] = useState(null);

  // État du Modal Coach IA
  const [coachingMode, setCoachingMode] = useState(null);
  const [coachingCharacterId, setCoachingCharacterId] = useState(null);

  // État pour le Paywall Premium Coach IA
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // Viewer de document attaché
  const [viewingDoc, setViewingDoc] = useState(null);

  useEffect(() => {
    fetchScript(id);
  }, [id, fetchScript]);

  useEffect(() => {
    if (id) {
      loadNotes();
    }
  }, [id]);

  const loadNotes = async () => {
    try {
      const scriptNotes = await fetchScriptNotes(id);
      const notesMap = {};
      scriptNotes.forEach((n) => {
        if (!notesMap[n.replica_id]) notesMap[n.replica_id] = [];
        notesMap[n.replica_id].push(n);
      });
      setNotes(notesMap);
    } catch (err) {
      console.error("Erreur chargement notes:", err);
    }
  };

  const handleSetMyCharacter = (charId) => {
    const next = myCharacterId === charId ? null : charId;
    setMyCharacterId(next);
    if (next) {
      localStorage.setItem(`myCharacter_${id}`, next);
    } else {
      localStorage.removeItem(`myCharacter_${id}`);
    }
  };

  // Filtrage des répliques selon les modes choisis
  const filteredReplicas = useMemo(() => {
    if (!currentScript?.replicas) return [];

    let result = [...currentScript.replicas];

    // Mode 'cues' : uniquement mes répliques et celles juste avant (les amorces)
    if (workMode === "cues" && myCharacterId) {
      const cueIndices = new Set();
      result.forEach((rep, idx) => {
        if (rep.character_id === myCharacterId) {
          cueIndices.add(idx);
          if (idx > 0) cueIndices.add(idx - 1);
        }
      });
      result = result.filter((_, idx) => cueIndices.has(idx));
    }

    if (selectedCharacter) {
      result = result.filter((r) => r.character_id === selectedCharacter);
    }

    return result;
  }, [currentScript?.replicas, selectedCharacter, studyingGroup]);

  // Fonction d'interception du clic Coach (Sécurisée avec Paywall Premium)
  const handleCoachClick = (e, characterId) => {
    e.stopPropagation();
    if (isPremium) {
      setCoachingMode("character");
      setCoachingCharacterId(characterId);
    } else {
      setShowPremiumModal(true);
    }
  };

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
      setEditingReplicaId(null);
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const handleAddNote = async (replicaId) => {
    if (!newNoteText.trim() && !newNoteFile) return;

    try {
      let filePath = null;
      let fileName = null;
      let fileType = null;

      if (newNoteFile) {
        const res = await uploadNoteAttachment(newNoteFile, user.id);
        filePath = res.filePath;
        fileName = res.fileName;
        fileType = res.fileType;
      }

      const created = await createScriptNote({
        script_id: id,
        replica_id: replicaId,
        user_id: user?.id,
        text: newNoteText,
        type: newNoteType,
        file_path: filePath,
        file_name: fileName,
        file_type: fileType,
      });

      setNotes((prev) => ({
        ...prev,
        [replicaId]: [...(prev[replicaId] || []), created],
      }));

      setNewNoteText("");
      setNewNoteType("general");
      setNewNoteFile(null);
      setActiveNoteReplicaId(null);
    } catch (err) {
      console.error("Note creation error:", err);
    }
  };

  const handleDeleteNote = async (replicaId, noteId, filePath) => {
    try {
      if (filePath) {
        await deleteNoteAttachment(filePath);
      }
      await deleteScriptNote(noteId);
      setNotes((prev) => ({
        ...prev,
        [replicaId]: (prev[replicaId] || []).filter((n) => n.id !== noteId),
      }));
    } catch (err) {
      console.error("Note delete error:", err);
    }
  };

  const handleSaveAICoachingNote = async ({ text, type }) => {
    if (!currentScript?.replicas?.[0]) return;
    const firstReplicaId = currentScript.replicas[0].id;

    try {
      const created = await createScriptNote({
        script_id: id,
        replica_id: firstReplicaId,
        user_id: user?.id,
        text: `[Coach IA] ${text}`,
        type: type || "intention",
      });

      setNotes((prev) => ({
        ...prev,
        [firstReplicaId]: [...(prev[firstReplicaId] || []), created],
      }));
    } catch (err) {
      console.error("Save AI note error:", err);
    }
  };

  if (loading || !currentScript) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  const { title, characters = [] } = currentScript;

  // Calcul des passages associés à mon personnage
  const characterPassages = myCharacterId
    ? filteredReplicas.filter((r) => r.character_id === myCharacterId)
    : [];

  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto">
      {/* En-tête de la pièce */}
      <div className="mb-6 bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <Link
            to="/"
            className="text-gray-400 hover:text-white flex items-center gap-2 text-sm font-semibold transition"
          >
            ← Retour
          </Link>
          <div className="flex gap-2">
            <Link
              to={`/audio/${id}`}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-gold-500 hover:from-amber-600 hover:to-gold-600 text-black font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-lg transition"
            >
              <span>🔊</span> Mode Audio
            </Link>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
          {title}
        </h1>

        {/* Sélection de rôle rapide */}
        <div className="mt-4 pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-400 font-semibold mb-2">
            🎭 Mon rôle dans cette pièce :
          </p>
          <div className="flex flex-wrap gap-2">
            {characters.map((char) => (
              <div key={char.id} className="flex items-center gap-1">
                <button
                  onClick={() => handleSetMyCharacter(char.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition border flex items-center gap-2 ${
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

                {/* BOUTON COACH IA - AFFICHÉ UNIQUEMENT POUR LES MEMBRES PREMIUM */}
                {isPremium && (
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
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sommaire des Passages */}
        {myCharacterId && characterPassages.length > 0 && (
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl shadow-sm">
            <p className="font-semibold text-indigo-900 text-sm mb-2 flex items-center gap-2">
              📍 Accès direct à vos passages ({characterPassages.length})
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {characterPassages.map((passage, pIdx) => (
                <button
                  key={passage.id}
                  onClick={() => {
                    const el = document.getElementById(`replica-${passage.id}`);
                    if (el)
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="px-3 py-1 bg-white border border-indigo-300 hover:bg-indigo-100 text-indigo-800 text-xs rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1 flex-shrink-0 shadow-sm"
                >
                  <span className="text-indigo-500 font-bold">#{pIdx + 1}</span>
                  <span className="truncate max-w-[120px]">
                    {passage.text ? passage.text.substring(0, 20) + "..." : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Barre d'outils de mémorisation */}
      <div className="mb-6 bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-xl flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400 font-bold">Affichage :</span>
          <button
            onClick={() => setWorkMode("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              workMode === "all"
                ? "bg-gold-500 text-black font-bold"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            Toutes les répliques
          </button>
          <button
            onClick={() => setWorkMode("cues")}
            disabled={!myCharacterId}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              workMode === "cues"
                ? "bg-gold-500 text-black font-bold"
                : "bg-gray-800 text-gray-400 hover:text-white disabled:opacity-40"
            }`}
          >
            Mes amorces
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400 font-bold">Récitation :</span>
          <select
            value={hideMode}
            onChange={(e) => setHideMode(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white text-xs rounded-xl px-3 py-1.5 focus:outline-none"
          >
            <option value="none">Texte complet</option>
            <option value="first_words">Premiers mots</option>
            <option value="hidden">Texte masqué</option>
          </select>
        </div>
      </div>

      {/* Liste des Répliques */}
      <div className="space-y-4">
        {filteredReplicas.map((replica, index) => {
          const character = characters.find(
            (c) => c.id === replica.character_id
          );
          const isMyReplica = myCharacterId === replica.character_id;
          const replicaNotes = notes[replica.id] || [];

          return (
            <div
              key={replica.id}
              id={`replica-${replica.id}`}
              className={`p-4 rounded-2xl transition border ${
                isMyReplica
                  ? "bg-gray-900/90 border-gold-500/50 shadow-lg shadow-gold-500/5"
                  : "bg-gray-900/50 border-gray-800"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: character?.color || "#e5e7eb" }}
                  />
                  <span className="font-bold text-white text-sm">
                    {character?.name || "Personnage inconnu"}
                  </span>
                  {isMyReplica && (
                    <span className="text-[10px] bg-gold-500/20 text-gold-400 border border-gold-500/40 px-2 py-0.5 rounded-full font-bold">
                      Mon rôle
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 font-mono">
                  #{index + 1}
                </span>
              </div>

              {/* Texte de la réplique */}
              <div className="text-gray-200 text-sm leading-relaxed mb-3">
                {hideMode === "hidden" && isMyReplica ? (
                  <span className="italic text-gray-500">
                    [Texte masqué pour révision - Cliquez pour afficher]
                  </span>
                ) : hideMode === "first_words" && isMyReplica ? (
                  <span>
                    {replica.text?.split(" ").slice(0, 3).join(" ")} ...
                  </span>
                ) : (
                  <span>{replica.text}</span>
                )}
              </div>

              {/* Notes rattachées */}
              {replicaNotes.length > 0 && (
                <div className="mt-2 space-y-1.5 border-t border-gray-800 pt-2">
                  {replicaNotes.map((note) => (
                    <div
                      key={note.id}
                      className="p-2 bg-gray-800/80 rounded-xl text-xs flex items-center justify-between gap-2"
                    >
                      <span className="text-amber-300 font-medium">
                        {note.text}
                      </span>
                      <button
                        onClick={() =>
                          handleDeleteNote(replica.id, note.id, note.file_path)
                        }
                        className="text-gray-500 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Paywall Premium pour le Coach IA */}
      {showPremiumModal && (
        <PremiumGateModal onClose={() => setShowPremiumModal(false)} />
      )}

      {/* Modal Coach IA */}
      {coachingMode && (
        <AICoachingModal
          scriptId={id}
          characterId={coachingCharacterId}
          onClose={() => {
            setCoachingMode(null);
            setCoachingCharacterId(null);
          }}
          onSaveAsNote={handleSaveAICoachingNote}
        />
      )}

      {/* Document Viewer */}
      {viewingDoc && (
        <DocumentViewer
          document={viewingDoc}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </div>
  );
}

export default ScriptDetail;
