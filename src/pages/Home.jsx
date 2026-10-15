import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useScriptStore } from "../store/scriptStore";
import { useAuthStore } from "../store/authStore";
import {
  getUserRole,
  uploadDirectorNote,
  fetchDirectorNotes,
  deleteDirectorNote,
  getDirectorNoteUrl,
  fetchUserTroupes,
  shareScript as shareScriptToTroupe,
  fetchUserTags,
  fetchScriptTags,
  fetchPersonalAudios,
  deletePersonalAudio,
  getAudioUrl,
} from "../lib/supabase";
import Loader from "../components/ui/Loader";
import DocumentViewer from "../components/DocumentViewer";
import PublicLibrary from "../components/PublicLibrary";
import {
  ScriptTagsModal,
  ScriptTagBadges,
  TagFilter,
} from "../components/TagManager";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import FloatingActionButton from "../components/FloatingActionButton";
import "../styles/mes-saynetes.css";

function DirectorNotesSection({
  notes,
  onUpload,
  onDelete,
  onViewDocument,
  uploading,
  error,
  expanded,
  onToggleExpand,
}) {
  const [dragActive, setDragActive] = useState(false);
  const safeNotes = Array.isArray(notes) ? notes : [];

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        onUpload(e.dataTransfer.files);
      }
    },
    [onUpload]
  );

  return (
    <div className="mb-6 bg-gradient-to-r from-amber-100 via-amber-200 to-amber-100 border-2 border-amber-400 rounded-2xl p-4 shadow-xl text-gray-950">
      <div
        onClick={onToggleExpand}
        className="menu-director cursor-pointer transition group flex items-center justify-between p-2"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500/30 rounded-xl flex items-center justify-center group-hover:bg-amber-500/40 transition border border-amber-600/30">
            <span className="text-2xl">📁</span>
          </div>
          <div>
            <h3 className="section-title text-gray-950 text-base font-black tracking-tight">
              Consignes du metteur en scène
            </h3>
            <p className="text-gray-800 text-xs font-bold mt-0.5">
              {safeNotes.length > 0 ? (
                <span className="font-extrabold text-amber-900">
                  {safeNotes.length} document{safeNotes.length > 1 ? "s" : ""}
                </span>
              ) : (
                "Aucun document pour le moment"
              )}
            </p>
          </div>
        </div>
        {onToggleExpand && (
          <div
            className={`text-gray-900 font-bold transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          >
            ▶
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-amber-300 transition">
          {error && <p className="text-rose-700 font-bold text-xs mb-3">{error}</p>}

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-4 text-center transition mb-4 ${
              dragActive
                ? "border-amber-600 bg-amber-300/40"
                : "border-amber-400 bg-amber-50/80 hover:border-amber-600"
            }`}
          >
            <p className="text-xs text-gray-900 font-bold mb-2">
              Glissez vos consignes (PDF, Word, TXT, Images) ici
            </p>
            <label className="btn-gold text-xs px-3 py-1.5 inline-block cursor-pointer font-bold shadow-md">
              {uploading ? "⏳ Upload..." : "📤 Parcourir les fichiers"}
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) =>
                  e.target.files && onUpload && onUpload(e.target.files)
                }
                disabled={uploading}
              />
            </label>
          </div>

          {safeNotes.length === 0 ? (
            <p className="text-xs text-gray-700 italic text-center py-2">
              Aucune consigne déposée
            </p>
          ) : (
            <div className="space-y-2">
              {safeNotes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-center justify-between p-3 bg-white/90 border border-amber-300 rounded-xl shadow-sm hover:shadow transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl">📄</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-950 truncate">
                        {note.file_name || "Document"}
                      </p>
                      <p className="text-[10px] text-gray-600 font-medium">
                        {note.created_at
                          ? new Date(note.created_at).toLocaleDateString()
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onViewDocument(note)}
                      className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition"
                    >
                      👁️ Voir
                    </button>
                    <button
                      onClick={() => onDelete(note.id)}
                      className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SortableScriptCard({
  script,
  index,
  onDelete,
  onOpen,
  onShare,
  onManageTags,
  notesCount,
  orderLocked,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: script.id, disabled: orderLocked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card hover:border-amber-500/60 transition cursor-pointer group bg-gray-800/90 border border-gray-700/80 p-4 rounded-2xl shadow-md hover:shadow-amber-500/10 flex flex-col justify-between"
    >
      <div className="flex items-center gap-3">
        {!orderLocked && (
          <button
            {...attributes}
            {...listeners}
            className="touch-none text-gray-500 hover:text-amber-400 p-1 cursor-grab active:cursor-grabbing text-lg"
          >
            ⋮⋮
          </button>
        )}

        <div onClick={() => onOpen(script.id)} className="flex-1 flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-400 font-bold text-xs flex-shrink-0">
            #{index + 1}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm truncate group-hover:text-amber-300 transition">
              {script.title}
            </h3>

            <div className="flex items-center gap-2 mt-1 text-gray-300 text-xs flex-wrap">
              <span>{script.characters?.length || 0} pers.</span>
              <span>•</span>
              <span>{script.replicas?.length || 0} répl.</span>
              {notesCount > 0 && (
                <>
                  <span>•</span>
                  <span className="text-amber-400 font-medium">📝 {notesCount}</span>
                </>
              )}
            </div>

            {script.tags && script.tags.length > 0 && (
              <div className="mt-2">
                <ScriptTagBadges tags={script.tags} size="xs" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-700/60 pt-3 mt-3">
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onManageTags(script);
            }}
            className="p-1.5 bg-gray-700/60 hover:bg-amber-500/20 text-gray-300 hover:text-amber-300 rounded-lg text-xs transition"
            title="Gérer les tags"
          >
            🏷️
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare(script);
            }}
            className="p-1.5 bg-gray-700/60 hover:bg-blue-500/20 text-gray-300 hover:text-blue-300 rounded-lg text-xs transition"
            title="Partager à une troupe"
          >
            📢
          </button>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(script.id);
          }}
          className="p-1.5 bg-gray-700/60 hover:bg-rose-500/20 text-gray-300 hover:text-rose-400 rounded-lg text-xs transition"
          title="Supprimer"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

function SortableAudioCard({ audio, audioUrl, onDelete, orderLocked }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: audio.id, disabled: orderLocked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card border-purple-500/40 hover:border-purple-400 transition bg-purple-950/20 border p-4 rounded-2xl shadow-md flex flex-col justify-between"
    >
      <div className="flex items-center gap-3">
        {!orderLocked && (
          <button
            {...attributes}
            {...listeners}
            className="touch-none text-purple-400 hover:text-purple-200 p-1 cursor-grab active:cursor-grabbing text-lg"
          >
            ⋮⋮
          </button>
        )}

        <div className="w-10 h-10 bg-purple-500/20 border border-purple-500/40 rounded-xl flex items-center justify-center text-purple-300 text-lg flex-shrink-0">
          🎙️
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-sm truncate">
            {audio.title || "Audio personnel"}
          </h3>
          <p className="text-purple-300/70 text-[11px] mt-0.5">Fichier audio importé</p>
        </div>
      </div>

      {audioUrl && (
        <audio controls src={audioUrl} className="w-full mt-3 h-8 rounded-lg" />
      )}

      <div className="flex items-center justify-end border-t border-purple-900/40 pt-2.5 mt-3">
        <button
          onClick={() => onDelete(audio.id)}
          className="p-1.5 bg-purple-900/40 hover:bg-rose-500/20 text-purple-300 hover:text-rose-400 rounded-lg text-xs transition"
          title="Supprimer l'audio"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const activeHomeTab = searchParams.get("tab") || "scripts";
  const {
    scripts,
    loading,
    fetchScripts,
    deleteScript,
    updateScriptOrder,
    countNotesForScripts,
  } = useScriptStore();

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [localScripts, setLocalScripts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [notesCounts, setNotesCounts] = useState({});

  const [directorNotes, setDirectorNotes] = useState([]);
  const [uploadingNote, setUploadingNote] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [directorNotesExpanded, setDirectorNotesExpanded] = useState(false);
  const [viewingDocument, setViewingDocument] = useState(null);

  const [scriptToShare, setScriptToShare] = useState(null);
  const [shareTroupes, setShareTroupes] = useState([]);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(null);
  const [shareError, setShareError] = useState(null);

  const [userTags, setUserTags] = useState([]);
  const [scriptTagsMap, setScriptTagsMap] = useState({});
  const [selectedTagFilter, setSelectedTagFilter] = useState(null);
  const [managingTagsFor, setManagingTagsFor] = useState(null);

  const [personalAudios, setPersonalAudios] = useState([]);
  const [audioImportMsg, setAudioImportMsg] = useState(null);
  const [orderLocked, setOrderLocked] = useState(() => {
    try {
      return localStorage.getItem("replicoach-order-locked") === "true";
    } catch {
      return false;
    }
  });

  const [recentScript, setRecentScript] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      await fetchScripts(user.id);
      const notes = await fetchDirectorNotes(user.id);
      setDirectorNotes(notes || []);

      const tags = await fetchUserTags(user.id);
      setUserTags(tags || []);

      const audios = await fetchPersonalAudios(user.id);
      setPersonalAudios(audios || []);
    } catch (err) {
      console.error(err);
    }
  }, [user, fetchScripts]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (scripts) {
      let filtered = [...scripts];
      if (searchQuery.trim()) {
        filtered = filtered.filter((s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      if (selectedTagFilter) {
        filtered = filtered.filter((s) => {
          const tags = scriptTagsMap[s.id] || [];
          return tags.some((t) => t.id === selectedTagFilter);
        });
      }
      setLocalScripts(filtered);

      if (scripts.length > 0) {
        countNotesForScripts(scripts.map((s) => s.id)).then(setNotesCounts);
      }
    }
  }, [scripts, searchQuery, selectedTagFilter, scriptTagsMap, countNotesForScripts]);

  const loadScriptsTags = useCallback(async () => {
    if (!scripts || scripts.length === 0) return;
    const map = {};
    for (const s of scripts) {
      try {
        const tags = await fetchScriptTags(s.id);
        map[s.id] = tags || [];
      } catch (e) {
        console.error(e);
      }
    }
    setScriptTagsMap(map);
  }, [scripts]);

  useEffect(() => {
    loadScriptsTags();
  }, [loadScriptsTags]);

  const toggleOrderLock = () => {
    const next = !orderLocked;
    setOrderLocked(next);
    try {
      localStorage.setItem("replicoach-order-locked", String(next));
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenScript = (id) => {
    navigate(`/script/${id}`);
  };

  const handleDelete = (id) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteScript(deleteConfirm);
      setDeleteConfirm(null);
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadDirectorNote = async (files) => {
    if (!user || !files || files.length === 0) return;
    setUploadingNote(true);
    setUploadError(null);
    try {
      for (const file of files) {
        await uploadDirectorNote(user.id, file);
      }
      const updated = await fetchDirectorNotes(user.id);
      setDirectorNotes(updated || []);
    } catch (err) {
      console.error(err);
      setUploadError("Erreur lors de l'upload. Réessayez.");
    } finally {
      setUploadingNote(false);
    }
  };

  const handleDeleteDirectorNote = async (noteId) => {
    try {
      await deleteDirectorNote(noteId);
      setDirectorNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewDocument = async (note) => {
    try {
      const url = await getDirectorNoteUrl(note.file_path);
      setViewingDocument({
        url,
        fileName: note.file_name,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenShare = async (script) => {
    setScriptToShare(script);
    setShareSuccess(null);
    setShareError(null);
    try {
      const userTroupes = await fetchUserTroupes(user.id);
      setShareTroupes(userTroupes || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShareToTroupe = async (troupeId) => {
    if (!scriptToShare) return;
    setSharingLoading(true);
    setShareSuccess(null);
    setShareError(null);
    try {
      await shareScriptToTroupe(scriptToShare.id, troupeId);
      setShareSuccess("Saynète partagée avec succès à la troupe !");
      setTimeout(() => setScriptToShare(null), 2000);
    } catch (e) {
      console.error(e);
      setShareError("Erreur lors du partage. Réessayez.");
    } finally {
      setSharingLoading(false);
    }
  };

  const handleDeleteAudio = async (audioId) => {
    try {
      await deletePersonalAudio(audioId);
      setPersonalAudios((prev) => prev.filter((a) => a.id !== audioId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const displayList = localScripts.length > 0 ? localScripts : (scripts || []);
    const oldIndex = displayList.findIndex((s) => s.id === active.id);
    const newIndex = displayList.findIndex((s) => s.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(displayList, oldIndex, newIndex);
      setLocalScripts(reordered);

      const updates = reordered.map((item, index) => ({
        id: item.id,
        display_order: index + 1,
      }));

      try {
        await updateScriptOrder(updates);
      } catch (err) {
        console.error(err);
        await loadData();
      }
    }
  };

  const displayScripts = localScripts.length > 0 ? localScripts : (scripts || []);
  const activeScript = activeId ? displayScripts.find((s) => s.id === activeId) : null;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 pt-4">
      {activeHomeTab === "director" ? (
        <div className="space-y-4">
          <DirectorNotesSection
            notes={directorNotes || []}
            onUpload={handleUploadDirectorNote}
            onDelete={handleDeleteDirectorNote}
            onViewDocument={handleViewDocument}
            uploading={uploadingNote}
            error={uploadError}
            expanded={directorNotesExpanded}
            onToggleExpand={() => setDirectorNotesExpanded(!directorNotesExpanded)}
          />
        </div>
      ) : activeHomeTab === "library" ? (
        <div className="space-y-4">
          <PublicLibrary
            onAddPersonalAudio={(audio) => {
              setPersonalAudios((prev) => [...prev, audio]);
              setAudioImportMsg({
                type: "info",
                text: "Audio ajouté ! Glissez-le sur la bonne saynète pour l'associer.",
              });
              setTimeout(() => setAudioImportMsg(null), 3500);

              (async () => {
                try {
                  await new Promise((r) => setTimeout(r, 900));
                  const audios = await fetchPersonalAudios(user.id);
                  setPersonalAudios(audios || []);
                } catch (e) {
                  console.warn(e);
                }
              })();
            }}
          />
        </div>
      ) : (
        /* ACCUEIL PRINCIPAL : LISTE DE TEXTES ON TOP + LES 2 PARCOURS EN DESSOUS */
        <div className="space-y-8">
          {/* 1. BLOC ON TOP : MES TEXTES & SAYNÈTES */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <span>🎭</span> Mes textes & saynètes
              </h2>
              <span className="text-xs font-bold px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-mono">
                {displayScripts.length} texte{displayScripts.length > 1 ? "s" : ""}
              </span>
            </div>

            {recentScript && scripts?.some((s) => s.id === recentScript.scriptId) && (
              <button
                onClick={() => handleOpenScript(recentScript.scriptId)}
                className="w-full p-4 bg-gradient-to-r from-amber-500/20 to-gold-500/20 hover:from-amber-500/30 hover:to-gold-500/30 border-2 border-amber-500/50 hover:border-amber-400 rounded-2xl transition-all flex items-center gap-4 group shadow-lg text-left"
              >
                <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                  <span className="text-2xl">⚡</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wide">
                      Accès rapide
                    </span>
                    <span className="text-amber-500/50 text-[10px]">
                      • {recentScript.count} fois
                    </span>
                  </div>
                  <h3 className="text-white font-bold text-base truncate group-hover:text-amber-300 transition">
                    {recentScript.title}
                  </h3>
                </div>
                <span className="text-amber-400 text-xl group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </button>
            )}

            {userTags.length > 0 && (
              <TagFilter
                tags={userTags}
                selectedTagId={selectedTagFilter}
                onSelect={setSelectedTagFilter}
              />
            )}

            {/* Option de verrouillage */}
            {displayScripts.length > 1 && !selectedTagFilter && (
              <div className="flex items-center justify-between py-1">
                <p className="text-gray-500 text-xs flex items-center gap-1">
                  {orderLocked ? (
                    <>
                      <span>🔒</span> Ordre verrouillé
                    </>
                  ) : (
                    <>
                      <span>💡</span> Glissez-déposez pour réorganiser
                    </>
                  )}
                </p>
                <button
                  onClick={toggleOrderLock}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                    orderLocked
                      ? "bg-green-500/20 text-green-400 border border-green-500/50"
                      : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-white"
                  }`}
                >
                  {orderLocked ? "🔓 Déverrouiller" : "🔒 Verrouiller"}
                </button>
              </div>
            )}

            {/* Liste des saynètes en grille responsive */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={[
                  ...displayScripts.map((s) => s.id),
                  ...personalAudios.map((a) => a.id),
                ]}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    ...displayScripts,
                    ...personalAudios.map((a) => ({ ...a, type: "audio" })),
                  ]
                    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                    .map((item, index) =>
                      item.type === "audio" ? (
                        <SortableAudioCard
                          key={item.id}
                          audio={item}
                          audioUrl={getAudioUrl(item.audio_path)}
                          onDelete={handleDeleteAudio}
                          orderLocked={orderLocked}
                        />
                      ) : (
                        <SortableScriptCard
                          key={item.id}
                          script={{
                            ...item,
                            tags: scriptTagsMap[item.id] || [],
                          }}
                          index={index}
                          onDelete={handleDelete}
                          onOpen={handleOpenScript}
                          onShare={handleOpenShare}
                          onManageTags={(s) => setManagingTagsFor(s)}
                          notesCount={notesCounts[item.id] || 0}
                          orderLocked={orderLocked}
                        />
                      )
                    )}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeScript ? (
                  <div className="card shadow-2xl ring-2 ring-gold-500 opacity-90 p-4 bg-gray-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-gold-500 font-bold text-lg">
                        #{activeScript.display_order}
                      </span>
                      <h3 className="font-semibold text-white">{activeScript.title}</h3>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>

          {/* 2. BLOC DESSOUS : LES 2 CARTES DE PARCOURS */}
          <div className="p-5 sm:p-6 bg-gradient-to-b from-gray-900/95 to-gray-950/95 border border-gray-800 rounded-3xl shadow-2xl backdrop-blur-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CARTE 1 : PARCOURS COMÉDIEN INDÉPENDANT */}
              <div className="flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-gray-800/90 via-gray-900/90 to-primary-950/60 border border-primary-500/30 hover:border-amber-500/50 transition-all duration-300 shadow-xl group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />
                
                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between">
                    <span className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-300 text-2xl group-hover:scale-110 transition-transform">
                      🎭
                    </span>
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-full text-[11px] font-extrabold uppercase tracking-wider">
                      Seul en scène
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                      Comédien Indépendant
                    </h3>
                    <p className="text-gray-400 text-xs mt-1.5 leading-relaxed">
                      Importez votre texte, choisissez un personnage et répétez vos répliques avec l'IA.
                    </p>
                  </div>

                  <ul className="space-y-2 pt-2 text-xs text-gray-300">
                    <li className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold">✓</span> Import de pièces & scripts (PDF, Word, TXT)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold">✓</span> Donner la réplique en audio (IA)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold">✓</span> Suivi de mémorisation & masquage
                    </li>
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-800 relative z-10">
                  <Link
                    to="/upload"
                    className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 via-gold-500 to-amber-600 hover:from-amber-400 hover:to-gold-400 text-gray-950 font-extrabold rounded-xl shadow-lg hover:shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs"
                  >
                    <span>📤</span> Importer une nouvelle pièce
                  </Link>
                </div>
              </div>

              {/* CARTE 2 : PARCOURS TROUPE & ATELIER */}
              <div className="flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-gray-800/90 via-gray-900/90 to-purple-950/60 border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300 shadow-xl group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all pointer-events-none" />

                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between">
                    <span className="p-3 bg-purple-500/15 border border-purple-500/30 rounded-2xl text-purple-300 text-2xl group-hover:scale-110 transition-transform">
                      👥
                    </span>
                    <span className="px-3 py-1 bg-purple-500/10 text-purple-300 border border-purple-500/30 rounded-full text-[11px] font-extrabold uppercase tracking-wider">
                      Collectif
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-purple-300 transition-colors">
                      Troupe & Atelier Théâtre
                    </h3>
                    <p className="text-gray-400 text-xs mt-1.5 leading-relaxed">
                      Créez ou rejoignez une troupe pour partager des textes, distribuer les rôles et suivre les consignes.
                    </p>
                  </div>

                  <ul className="space-y-2 pt-2 text-xs text-gray-300">
                    <li className="flex items-center gap-2">
                      <span className="text-purple-400 font-bold">✓</span> Espace troupe & distribution des rôles
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-purple-400 font-bold">✓</span> Partage instantané de scripts & consignes
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-purple-400 font-bold">✓</span> Notes de mise en scène & répétitions
                    </li>
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-800 relative z-10">
                  <Link
                    to="/troupes"
                    className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-xl shadow-lg hover:shadow-purple-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs"
                  >
                    <span>👥</span> Accéder à mes Troupes
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAB Bouton Flottant d'Importation */}
      <FloatingActionButton />

      {/* MODALE SUPPRESSION */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="text-center">
              <span className="text-4xl">⚠️</span>
              <h3 className="text-white font-bold text-base mt-2">
                Supprimer ce texte ?
              </h3>
              <p className="text-gray-400 text-xs mt-1">
                Cette action est définitive et supprimera toutes les répliques associées.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs rounded-xl transition"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE TAGS */}
      {managingTagsFor && (
        <ScriptTagsModal
          script={managingTagsFor}
          userTags={userTags}
          scriptTags={scriptTagsMap[managingTagsFor.id] || []}
          onClose={() => setManagingTagsFor(null)}
          onTagsUpdated={async () => {
            const tags = await fetchScriptTags(managingTagsFor.id);
            setScriptTagsMap((prev) => ({
              ...prev,
              [managingTagsFor.id]: tags || [],
            }));
          }}
        />
      )}

      {/* MODALE PARTAGE TROUPE */}
      {scriptToShare && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>📢</span> Partager à une troupe
              </h3>
              <button
                onClick={() => setScriptToShare(null)}
                className="text-gray-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-300">
              Choisissez la troupe avec laquelle partager le texte{" "}
              <strong className="text-amber-300">"{scriptToShare.title}"</strong> :
            </p>

            {shareSuccess && (
              <p className="text-emerald-400 text-xs font-bold bg-emerald-950/40 border border-emerald-800 p-2.5 rounded-xl">
                {shareSuccess}
              </p>
            )}
            {shareError && (
              <p className="text-rose-400 text-xs font-bold bg-rose-950/40 border border-rose-800 p-2.5 rounded-xl">
                {shareError}
              </p>
            )}

            {shareTroupes.length === 0 ? (
              <div className="text-center py-6 bg-gray-800/40 rounded-xl border border-gray-800 p-4">
                <p className="text-gray-400 text-xs">
                  Vous ne faites partie d'aucune troupe pour le moment.
                </p>
                <Link
                  to="/troupes"
                  onClick={() => setScriptToShare(null)}
                  className="btn-gold mt-3 inline-block text-xs py-1.5 px-3"
                >
                  👥 Créer ou rejoindre une troupe
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {shareTroupes.map((troupe) => (
                  <button
                    key={troupe.id}
                    onClick={() => handleShareToTroupe(troupe.id)}
                    disabled={sharingLoading}
                    className="w-full p-3 bg-gray-800 hover:bg-amber-500/20 border border-gray-700 hover:border-amber-500/50 rounded-xl transition text-left flex items-center justify-between group"
                  >
                    <div>
                      <p className="text-xs font-bold group-hover:text-amber-300">
                        {troupe.name}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {troupe.role === "admin" ? "👑 Admin" : "🎭 Membre"}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">
                      Partager →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DOCUMENT VIEWER */}
      {viewingDocument && (
        <DocumentViewer
          url={viewingDocument.url}
          fileName={viewingDocument.fileName}
          onClose={() => setViewingDocument(null)}
        />
      )}
    </div>
  );
}
