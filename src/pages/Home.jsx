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
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onUpload && onUpload(e.dataTransfer.files);
      }
    },
    [onUpload]
  );

  return (
    <div className="mb-6 bg-gradient-to-r from-amber-100 via-amber-200 to-amber-100 border-2 border-amber-300 rounded-2xl p-4 shadow-xl">
      <div
        onClick={onToggleExpand}
        className="menu-director cursor-pointer transition group flex items-center justify-between p-2"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500/30 rounded-xl flex items-center justify-center group-hover:bg-amber-500/40 transition border border-amber-500/40 shadow-sm">
            <span className="text-2xl">📁</span>
          </div>
          <div>
            <h3 className="section-title text-gray-950 text-base font-extrabold tracking-tight">
              Consignes du metteur en scène
            </h3>
            <p className="text-gray-900 font-bold text-xs mt-0.5">
              {safeNotes.length > 0 ? (
                <span className="font-extrabold text-amber-950">
                  {safeNotes.length} document{safeNotes.length > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="font-bold text-gray-800">
                  Aucun document pour le moment
                </span>
              )}
            </p>
          </div>
        </div>
        {onToggleExpand && (
          <div
            className={`text-gray-950 font-bold transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          >
            ▶
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-amber-300/80 transition text-gray-900">
          {error && <p className="text-red-600 text-xs font-bold mb-3">{error}</p>}

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-4 text-center transition mb-4 ${
              dragActive
                ? "border-amber-600 bg-amber-300/50"
                : "border-amber-400/80 bg-amber-50/60 hover:border-amber-500"
            }`}
          >
            <p className="text-xs text-gray-900 font-semibold mb-2">
              Glissez vos consignes (PDF, Word, TXT, Images) ici
            </p>
            <label className="btn-gold text-xs px-3 py-1.5 inline-block cursor-pointer font-bold bg-amber-500 text-gray-950 rounded-lg border border-amber-600 shadow">
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
            <p className="text-gray-700 text-xs font-medium text-center py-3">
              Aucune consigne ajoutée.
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {safeNotes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-center justify-between p-2.5 bg-amber-50 rounded-xl border border-amber-300 hover:border-amber-400 transition text-xs shadow-sm"
                >
                  <div
                    onClick={() => onViewDocument(note)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                  >
                    <span className="text-base">
                      {note.file_name?.endsWith(".pdf") ? "📕" : "📝"}
                    </span>
                    <span className="text-gray-900 font-bold truncate">
                      {note.file_name}
                    </span>
                  </div>
                  <button
                    onClick={() => onDelete(note.id, note.file_path)}
                    className="p-1 text-gray-600 hover:text-red-600 rounded transition"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenShare = async (script) => {
    setScriptToShare(script);
    setShareSuccess(null);
    setShareError(null);
    try {
      const troupes = await fetchUserTroupes(user.id);
      setShareTroupes(troupes || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmShare = async (troupeId) => {
    if (!scriptToShare) return;
    setSharingLoading(true);
    setShareError(null);
    try {
      await shareScriptToTroupe(scriptToShare.id, troupeId, user.id);
      setShareSuccess("✓ Texte partagé avec succès !");
      setTimeout(() => setScriptToShare(null), 1200);
    } catch (err) {
      setShareError(err.message || "Erreur lors du partage");
    } finally {
      setSharingLoading(false);
    }
  };

  const handleDragStart = (e) => setActiveId(e.active.id);

  const handleDragEnd = async (e) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const currentList = displayScripts;
    const oldIndex = currentList.findIndex((s) => s.id === active.id);
    const newIndex = currentList.findIndex((s) => s.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(currentList, oldIndex, newIndex);
      setLocalScripts(reordered);
      try {
        await updateScriptOrder(
          reordered.map((s, idx) => ({ id: s.id, display_order: idx + 1 }))
        );
      } catch (err) {
        console.error("Erreur ordre:", err);
      }
    }
  };

  const handleUploadDirectorNote = async (files) => {
    if (!files || files.length === 0) return;
    setUploadingNote(true);
    setUploadError(null);
    try {
      for (const file of files) {
        await uploadDirectorNote(user.id, file);
      }
      const notes = await fetchDirectorNotes(user.id);
      setDirectorNotes(notes || []);
    } catch (err) {
      setUploadError(err.message || "Erreur d'upload");
    } finally {
      setUploadingNote(false);
    }
  };

  const handleDeleteDirectorNote = async (noteId, filePath) => {
    if (!confirm("Supprimer cette consigne ?")) return;
    try {
      await deleteDirectorNote(noteId, filePath);
      setDirectorNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewDocument = (note) => {
    const url = getDirectorNoteUrl(note.file_path);
    if (url) {
      setViewingDocument({ title: note.file_name, url });
    }
  };

  const handleDeleteAudio = async (audioId, audioPath) => {
    if (!confirm("Supprimer cet audio personnel ?")) return;
    try {
      await deletePersonalAudio(audioId, audioPath);
      setPersonalAudios((prev) => prev.filter((a) => a.id !== audioId));
    } catch (err) {
      console.error(err);
    }
  };

  // Liste effective des scripts (découplage immédiat du store Supabase)
  const displayScripts =
    localScripts && localScripts.length > 0
      ? localScripts
      : scripts && scripts.length > 0
      ? scripts
      : [];

  const activeScript = activeId
    ? displayScripts.find((s) => s.id === activeId)
    : null;

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
            onToggleExpand={() =>
              setDirectorNotesExpanded(!directorNotesExpanded)
            }
          />
        </div>
      ) : activeHomeTab === "library" ? (
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

            {/* Grille directe des textes */}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {[
                    ...displayScripts.map((s) => ({ ...s, type: "script" })),
                    ...personalAudios.map((a) => ({ ...a, type: "audio" })),
                  ]
                    .sort(
                      (a, b) => (a.display_order || 0) - (b.display_order || 0)
                    )
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
            </DndContext>
          </div>

          {/* 2. BLOC DESSOUS : BIBLIOTHÈQUE PUBLIQUE */}
          <div className="space-y-4 pt-4 border-t border-gray-800/80">
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              <span>📚</span> Bibliothèque publique
            </h2>
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

            {recentScript &&
              scripts?.some((s) => s.id === recentScript.scriptId) && (
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

            {/* Grille directe des textes */}
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
                    .sort(
                      (a, b) => (a.display_order || 0) - (b.display_order || 0)
                    )
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
                      <h3 className="font-semibold text-white">
                        {activeScript.title}
                      </h3>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>

          {/* 2. BLOC DESSOUS : LES 2 CARTES DE PARCOURS */}
          <div className="p-5 sm:p-6 bg-gradient-to-b from-gray-900/95 to-gray-950/95 border border-gray-800 rounded-3xl shadow-2xl backdrop-blur-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CARTE 1 : COMÉDIEN INDÉPENDANT */}
              <Link
                to="/upload"
                className="relative bg-gradient-to-br from-gray-900/90 via-gray-800/90 to-amber-950/30 border-2 border-amber-500/60 hover:border-amber-400 rounded-2xl p-5 sm:p-6 transition-all duration-300 group shadow-xl hover:shadow-amber-500/20 flex flex-col justify-between overflow-hidden"
              >
                <div className="absolute -top-10 -right-10 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-all" />
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                      <span>👤</span> Comédien Indépendant
                    </span>
                    <span className="text-xs text-amber-400 font-semibold group-hover:translate-x-1 transition-transform">
                      Solo →
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">
                    Travaillez vos textes personnels
                  </h3>
                  <p className="text-gray-300 text-xs sm:text-sm leading-relaxed mb-4">
                    Importez directement vos pièces personnelles, scripts ou livrets pour répéter vos répliques en toute autonomie.
                  </p>
                  <ul className="space-y-2 text-xs sm:text-sm text-gray-300 mb-6">
                    <li className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold">✓</span> Importation PDF, TXT ou Scan photo
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold">✓</span> Audio, italienne & mémorisation interactive
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold">✓</span> Espace de travail 100 % privé
                    </li>
                  </ul>
                </div>
                <div className="mt-2 pt-3 border-t border-amber-500/20">
                  <span className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 group-hover:from-amber-400 group-hover:to-amber-500 text-gray-950 rounded-xl font-extrabold text-xs sm:text-sm transition-all duration-200 shadow-md flex items-center justify-center gap-2">
                    <span>➕ Importer un texte</span>
                    <span>→</span>
                  </span>
                </div>
              </Link>

              {/* CARTE 2 : TROUPE & ATELIER */}
              <Link
                to="/shared"
                className="relative bg-gradient-to-br from-primary-950/90 via-gray-900 to-purple-950/90 border-2 border-purple-500/60 hover:border-purple-400 rounded-2xl p-5 sm:p-6 transition-all duration-300 group shadow-xl hover:shadow-purple-500/20 flex flex-col justify-between overflow-hidden"
              >
                <div className="absolute -top-10 -right-10 w-28 h-28 bg-purple-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-500/20 transition-all" />
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                      <span>👥</span> Troupe & Atelier
                    </span>
                    <span className="text-xs text-purple-300 font-semibold group-hover:translate-x-1 transition-transform">
                      Espace Partagé →
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                    Espace Partagé & Metteur en Scène
                  </h3>
                  <p className="text-purple-100/70 text-xs sm:text-sm leading-relaxed mb-4">
                    Accédez aux pièces partagées par votre metteuse/metteur en scène à l'aide d'un code de troupe ou gérez vos groupes.
                  </p>
                  <ul className="space-y-2 text-xs sm:text-sm text-purple-100/80 mb-6">
                    <li className="flex items-center gap-2">
                      <span className="text-purple-400 font-bold">✓</span> Connexion par code de troupe sécurisé
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-purple-400 font-bold">✓</span> Consignes & notes de mise en scène
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-purple-400 font-bold">✓</span> Synchronisation des rôles distribués
                    </li>
                  </ul>
                </div>
                <div className="mt-2 pt-3 border-t border-purple-500/20">
                  <span className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-primary-700 group-hover:from-purple-500 group-hover:to-primary-600 text-white rounded-xl font-extrabold text-xs sm:text-sm transition-all duration-200 shadow-md flex items-center justify-center gap-2">
                    <span>🎭 Accéder à mes Troupes</span>
                    <span>→</span>
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Modale de confirmation suppression */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full border border-gray-800 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">
              Supprimer ce texte ?
            </h3>
            <p className="text-gray-400 text-xs mb-6">
              Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary flex-1 py-2.5"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl flex-1 py-2.5 transition"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingDocument && (
        <DocumentViewer
          document={viewingDocument}
          onClose={() => setViewingDocument(null)}
        />
      )}

      {scriptToShare && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl max-w-sm w-full border border-gray-800 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">
              👥 Partager "{scriptToShare.title}"
            </h3>
            <p className="text-gray-400 text-xs mb-4">
              Choisissez la troupe destinataire :
            </p>
            {shareTroupes.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-4">
                Aucune troupe disponible.
              </p>
            ) : (
              <div className="space-y-2 mb-4">
                {shareTroupes.map((troupe) => (
                  <button
                    key={troupe.id}
                    onClick={() => handleConfirmShare(troupe.id)}
                    disabled={sharingLoading}
                    className="w-full p-3 bg-gray-800 hover:bg-primary-600 rounded-xl text-left transition flex items-center justify-between text-sm"
                  >
                    <span className="text-white font-medium">{troupe.name}</span>
                    <span className="text-primary-400">→</span>
                  </button>
                ))}
              </div>
            )}
            {shareSuccess && (
              <p className="text-green-400 text-xs mb-4">{shareSuccess}</p>
            )}
            {shareError && (
              <p className="text-red-400 text-xs mb-4">{shareError}</p>
            )}
            <button
              onClick={() => setScriptToShare(null)}
              className="btn-secondary w-full py-2.5"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {managingTagsFor && (
        <ScriptTagsModal
          scriptId={managingTagsFor.id}
          scriptTitle={managingTagsFor.title}
          userId={user?.id}
          onClose={() => {
            setManagingTagsFor(null);
            loadScriptsTags();
          }}
        />
      )}

      {audioImportMsg && (
        <div className="fixed bottom-32 left-4 right-4 z-50 px-4 py-3 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-2xl flex items-center justify-between">
          <span>{audioImportMsg.text}</span>
          <button
            onClick={() => setAudioImportMsg(null)}
            className="text-xs"
          >
            ✕
          </button>
        </div>
      )}

      <FloatingActionButton />
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

        <div
          onClick={() => onOpen(script.id)}
          className="flex-1 flex items-center gap-3 min-w-0"
        >
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
                  <span className="text-amber-400 font-medium">
                    📝 {notesCount}
                  </span>
                </>
              )}
            </div>

            {script.tags && script.tags.length > 0 && (
              <div className="mt-2">
                <ScriptTagBadges tags={script.tags} />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onManageTags(script);
            }}
            className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-gray-700 rounded-lg transition"
            title="Tags"
          >
            🏷️
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare(script);
            }}
            className="p-1.5 text-gray-400 hover:text-primary-300 hover:bg-gray-700 rounded-lg transition"
            title="Partager"
          >
            👥
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(script.id);
            }}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
            title="Supprimer"
          >
            🗑️
          </button>
        </div>
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
      className="bg-gray-800/90 border border-blue-500/30 rounded-xl p-3 shadow-md"
    >
      <div className="flex items-center gap-3">
        {!orderLocked && (
          <button
            {...attributes}
            {...listeners}
            className="touch-none text-gray-500 hover:text-blue-400 p-1 cursor-grab active:cursor-grabbing text-lg"
          >
            ⋮⋮
          </button>
        )}

        <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 text-sm">
          🎵
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-medium truncate">
            {audio.title || audio.file_name}
          </p>
          <audio src={audioUrl} controls className="w-full h-7 mt-1" />
        </div>

        <button
          onClick={() => onDelete(audio.id, audio.audio_path)}
          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
