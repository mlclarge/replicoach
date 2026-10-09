import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
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

/**
 * Section Consignes Metteur en Scène (Sécurisée)
 */
function DirectorNotesSection({
  notes = [],
  onUpload,
  onDelete,
  onViewDocument,
  uploading,
  error,
  expanded = true,
  onToggleExpand,
}) {
  const safeNotes = Array.isArray(notes) ? notes : [];
  const [dragActive, setDragActive] = useState(false);

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
    <div className="mb-6 bg-gray-900/90 border border-gray-800 rounded-2xl p-4 shadow-xl">
      <div
        onClick={onToggleExpand}
        className="menu-director cursor-pointer transition group flex items-center justify-between p-2"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center group-hover:bg-yellow-500/30 transition">
            <span className="text-2xl">📁</span>
          </div>
          <div>
            <h3 className="section-title text-white text-base font-bold">
              Consignes du metteur en scène
            </h3>
            <p className="text-gray-400 text-xs mt-0.5">
              {safeNotes.length > 0 ? (
                <span className="font-bold text-yellow-400">
                  {safeNotes.length} document{safeNotes.length > 1 ? "s" : ""}
                </span>
              ) : (
                "Aucun document pour le moment"
              )}
            </p>
          </div>
        </div>
        {onToggleExpand && (
          <div className={`text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}>
            ▶
          </div>
        )}
      </div>

      {expanded && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`mt-4 pt-4 border-t border-gray-800 transition ${
            dragActive ? "bg-yellow-500/10 border-dashed border-yellow-500 rounded-xl p-4" : ""
          }`}
        >
          {error && (
            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
              {error}
            </div>
          )}

          {uploading && (
            <div className="py-4 text-center">
              <Loader size="sm" />
              <p className="text-gray-400 text-xs mt-2">Envoi du document en cours...</p>
            </div>
          )}

          {safeNotes.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-gray-800 rounded-xl">
              <p className="text-3xl mb-2">📂</p>
              <p className="text-gray-400 text-xs">
                Aucune consigne déposée. Glissez-déposez vos fichiers ici.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {safeNotes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-center justify-between p-3 bg-gray-800/60 rounded-xl border border-gray-700/50 hover:border-gray-600 transition"
                >
                  <div
                    onClick={() => onViewDocument && onViewDocument(note)}
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                  >
                    <span className="text-xl">📄</span>
                    <div className="truncate">
                      <p className="text-white text-sm font-medium truncate">{note.file_name}</p>
                      <p className="text-gray-500 text-[10px]">
                        {note.created_at
                          ? new Date(note.created_at).toLocaleDateString("fr-FR")
                          : ""}
                      </p>
                    </div>
                  </div>
                  {onDelete && (
                    <button
                      onClick={() => onDelete(note.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Composant principal Home
 */
function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
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

  // Navigation par onglets ('scripts', 'director', 'library')
  const [activeHomeTab, setActiveHomeTab] = useState("scripts");

  // Rôle utilisateur
  const [userRole, setUserRole] = useState("member");

  // Détection de l'onglet actif via l'URL (hash ou paramètre ?tab=library)
  useEffect(() => {
    if (location.hash === "#library" || location.search.includes("tab=library")) {
      setActiveHomeTab("library");
    } else if (location.hash === "#director" || location.search.includes("tab=director")) {
      setActiveHomeTab("director");
    } else if (location.hash === "#scripts" || location.search.includes("tab=scripts")) {
      setActiveHomeTab("scripts");
    }
  }, [location]);

  // Ordre verrouillé
  const [orderLocked, setOrderLocked] = useState(() => {
    try {
      return localStorage.getItem("replicoach-order-locked") === "true";
    } catch {
      return false;
    }
  });

  // Consignes Metteur en scène
  const [directorNotesExpanded, setDirectorNotesExpanded] = useState(true);
  const [directorNotes, setDirectorNotes] = useState([]);
  const [uploadingNote, setUploadingNote] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showTroupeSelector, setShowTroupeSelector] = useState(false);
  const [pendingFiles, setPendingFiles] = useState(null);
  const [uploadTroupes, setUploadTroupes] = useState([]);

  // Documents
  const [viewingDocument, setViewingDocument] = useState(null);

  // Partage
  const [scriptToShare, setScriptToShare] = useState(null);
  const [shareTroupes, setShareTroupes] = useState([]);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(null);
  const [shareError, setShareError] = useState(null);

  // Tags
  const [userTags, setUserTags] = useState([]);
  const [scriptTagsMap, setScriptTagsMap] = useState({});
  const [selectedTagFilter, setSelectedTagFilter] = useState(null);
  const [managingTagsFor, setManagingTagsFor] = useState(null);

  // Accès rapide
  const [recentScript, setRecentScript] = useState(null);

  // Audios
  const [personalAudios, setPersonalAudios] = useState([]);
  const [audioImportMsg, setAudioImportMsg] = useState(null);

  useEffect(() => {
    if (user?.id) {
      getUserRole(user.id)
        .then((role) => setUserRole(role || "member"))
        .catch(() => setUserRole("member"));

      fetchScripts(user.id);
      loadDirectorNotes();
      loadUploadTroupes();
      loadNotesCounts();
      loadUserTags();
      loadRecentScript();
      loadPersonalAudios();
    }
  }, [user?.id]);

  const loadDirectorNotes = async () => {
    if (!user?.id) return;
    try {
      const notes = await fetchDirectorNotes(user.id);
      setDirectorNotes(Array.isArray(notes) ? notes : []);
    } catch (err) {
      console.error("Erreur consignes:", err);
      setDirectorNotes([]);
    }
  };

  const loadUploadTroupes = async () => {
    if (!user?.id) return;
    try {
      const troupes = await fetchUserTroupes(user.id);
      setUploadTroupes(Array.isArray(troupes) ? troupes : []);
    } catch (err) {
      console.error("Erreur troupes:", err);
      setUploadTroupes([]);
    }
  };

  const loadNotesCounts = async () => {
    if (!user?.id) return;
    try {
      const counts = await countNotesForScripts(user.id);
      setNotesCounts(counts || {});
    } catch (err) {
      console.error("Erreur notes counts:", err);
    }
  };

  const loadUserTags = async () => {
    if (!user?.id) return;
    try {
      const tags = await fetchUserTags(user.id);
      setUserTags(Array.isArray(tags) ? tags : []);
    } catch (err) {
      console.error("Erreur tags:", err);
    }
  };

  const loadRecentScript = () => {
    try {
      const stored = localStorage.getItem("replicoach_recent_script");
      if (stored) setRecentScript(JSON.parse(stored));
    } catch (e) {
      console.error(e);
    }
  };

  const loadPersonalAudios = async () => {
    if (!user?.id) return;
    try {
      const audios = await fetchPersonalAudios(user.id);
      setPersonalAudios(Array.isArray(audios) ? audios : []);
    } catch (err) {
      console.error("Erreur audios:", err);
    }
  };

  useEffect(() => {
    if (Array.isArray(scripts)) {
      let filtered = [...scripts];

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        filtered = filtered.filter((s) => s.title?.toLowerCase().includes(q));
      }

      if (selectedTagFilter) {
        filtered = filtered.filter((s) => {
          const tags = scriptTagsMap[s.id] || [];
          return tags.some((t) => t.id === selectedTagFilter);
        });
      }

      setLocalScripts(filtered);
    } else {
      setLocalScripts([]);
    }
  }, [scripts, searchQuery, selectedTagFilter, scriptTagsMap]);

  useEffect(() => {
    loadScriptsTags();
  }, [scripts]);

  const loadScriptsTags = async () => {
    if (!Array.isArray(scripts) || scripts.length === 0) return;
    const map = {};
    for (const script of scripts) {
      try {
        const tags = await fetchScriptTags(script.id);
        map[script.id] = tags || [];
      } catch (err) {
        console.error(err);
      }
    }
    setScriptTagsMap(map);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: orderLocked ? 999999 : 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event) => {
    if (orderLocked) return;
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    setActiveId(null);
    if (orderLocked) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localScripts.findIndex((s) => s.id === active.id);
    const newIndex = localScripts.findIndex((s) => s.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(localScripts, oldIndex, newIndex);
      setLocalScripts(reordered);

      const itemsToUpdate = reordered.map((s, idx) => ({
        id: s.id,
        display_order: idx + 1,
      }));

      try {
        await updateScriptOrder(itemsToUpdate);
      } catch (err) {
        console.error("Erreur ordre:", err);
      }
    }
  };

  const toggleOrderLock = () => {
    const next = !orderLocked;
    setOrderLocked(next);
    try {
      localStorage.setItem("replicoach-order-locked", String(next));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = (scriptId) => setDeleteConfirm(scriptId);

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteScript(deleteConfirm);
      setDeleteConfirm(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenScript = (scriptId) => {
    const targetScript = scripts.find((s) => s.id === scriptId);
    if (targetScript) {
      const existing = recentScript && recentScript.scriptId === scriptId ? recentScript.count || 0 : 0;
      const updated = {
        scriptId,
        title: targetScript.title,
        lastAccess: new Date().toISOString(),
        count: existing + 1,
      };
      localStorage.setItem("replicoach_recent_script", JSON.stringify(updated));
      setRecentScript(updated);
    }
    navigate(`/script/${scriptId}`);
  };

  const handleOpenShare = async (script) => {
    setScriptToShare(script);
    setShareSuccess(null);
    setShareError(null);
    setSharingLoading(true);
    try {
      const troupes = await fetchUserTroupes(user.id);
      setShareTroupes(troupes || []);
    } catch (err) {
      console.error(err);
      setShareTroupes([]);
    } finally {
      setSharingLoading(false);
    }
  };

  const handleConfirmShare = async (troupeId) => {
    if (!scriptToShare || !user) return;
    setSharingLoading(true);
    setShareError(null);
    try {
      await shareScriptToTroupe(scriptToShare.id, troupeId, user.id);
      setShareSuccess("Texte partagé avec succès !");
      setTimeout(() => setScriptToShare(null), 1500);
    } catch (err) {
      setShareError(err.message || "Erreur lors du partage");
    } finally {
      setSharingLoading(false);
    }
  };

  const handleUploadDirectorNote = async (files) => {
    if (!user) return;
    if (uploadTroupes.length > 0) {
      setPendingFiles(Array.from(files));
      setShowTroupeSelector(true);
    } else {
      await doUploadDirectorNotes(Array.from(files), null);
    }
  };

  const doUploadDirectorNotes = async (files, troupeId) => {
    setUploadingNote(true);
    setUploadError(null);
    try {
      for (const file of files) {
        await uploadDirectorNote(file, user.id, troupeId);
      }
      setShowTroupeSelector(false);
      setPendingFiles(null);
      await loadDirectorNotes();
    } catch (err) {
      console.error(err);
      setUploadError(err.message || "Erreur lors de l'envoi");
    } finally {
      setUploadingNote(false);
    }
  };

  const handleDeleteDirectorNote = async (noteId) => {
    const note = directorNotes.find((n) => n.id === noteId);
    if (!note) return;
    try {
      await deleteDirectorNote(noteId, note.file_path);
      setDirectorNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la suppression");
    }
  };

  const handleViewDocument = (note) => {
    setViewingDocument({
      file_name: note.file_name,
      file_url: getDirectorNoteUrl(note.file_path),
      file_type: note.file_type,
    });
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

  const activeScript = activeId ? localScripts.find((s) => s.id === activeId) : null;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 w-full max-w-7xl mx-auto sm:px-6 lg:px-8">
      {/* 🎭 BLOC D'ACCUEIL : BIENVENUE SUR REPLICOACH */}
      <div className="mb-6 p-5 bg-gray-900/90 border border-gray-800 rounded-2xl shadow-xl backdrop-blur-sm">
        <h2 className="text-white font-bold text-lg mb-1 flex items-center gap-2 font-display">
          <span>🎭</span> Bienvenue sur RépliCoach !
        </h2>
        <p className="text-gray-400 text-xs mb-4">
          Choisissez votre mode d'utilisation pour accéder rapidement à vos textes :
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Carte 1 : Comédien indépendant */}
          <Link
            to="/upload"
            className="p-4 bg-gray-800/80 hover:bg-gray-800 border border-gold-500/30 hover:border-amber-400 rounded-xl transition-all duration-200 group shadow-md hover:shadow-amber-500/15 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-gold-400 font-bold text-sm flex items-center gap-2">
                  <span>👤</span> Comédien indépendant
                </p>
                <span className="text-gold-400 text-base transform group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>
              <p className="text-gray-300 text-xs leading-relaxed">
                Importez jusqu'à <strong>2 textes personnels</strong> gratuitement.
              </p>
            </div>
            <span className="text-[10px] text-gold-500/70 mt-3 font-semibold uppercase tracking-wider">
              Importer un fichier
            </span>
          </Link>

          {/* Carte 2 : En troupe / Atelier */}
          <Link
            to="/shared"
            className="p-4 bg-gray-800/80 hover:bg-gray-800 border border-primary-500/30 hover:border-primary-400 rounded-xl transition-all duration-200 group shadow-md hover:shadow-primary-500/15 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-primary-300 font-bold text-sm flex items-center gap-2">
                  <span>👥</span> En troupe / Atelier
                </p>
                <span className="text-primary-300 text-base transform group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>
              <p className="text-gray-300 text-xs leading-relaxed">
                Saisissez le code fourni par votre metteur en scène pour accéder aux pièces.
              </p>
            </div>
            <span className="text-[10px] text-primary-400/70 mt-3 font-semibold uppercase tracking-wider">
              Accéder aux Troupes
            </span>
          </Link>
        </div>
      </div>

      {/* 🧭 BARRE D'ONGLETS Navigation */}
      <div className="flex gap-2 mb-6 p-1.5 bg-gray-900/80 rounded-2xl border border-gray-800 backdrop-blur-sm">
        <button
          onClick={() => setActiveHomeTab("scripts")}
          className={`flex-1 py-2.5 px-3 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
            activeHomeTab === "scripts"
              ? "bg-gold-500 text-black shadow-lg shadow-gold-500/10 font-bold"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60"
          }`}
        >
          <span>🎭</span>
          <span>Mes textes</span>
          <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded-full font-mono">
            {scripts?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveHomeTab("director")}
          className={`flex-1 py-2.5 px-3 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
            activeHomeTab === "director"
              ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20 font-bold"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60"
          }`}
        >
          <span>📁</span>
          <span>Consignes</span>
          <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded-full font-mono">
            {(directorNotes || []).length}
          </span>
        </button>

        <button
          onClick={() => setActiveHomeTab("library")}
          className={`flex-1 py-2.5 px-3 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
            activeHomeTab === "library"
              ? "bg-amber-600 text-white shadow-lg shadow-amber-500/20 font-bold"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60"
          }`}
        >
          <span>📚</span>
          <span>Bibliothèque</span>
        </button>
      </div>

      {/* 1. ONGLET : MES TEXTES */}
      {activeHomeTab === "scripts" && (
        <div className="space-y-4">
          {/* Accès rapide au texte récent */}
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

          {/* Filtre par Tags */}
          {userTags.length > 0 && (
            <TagFilter
              tags={userTags}
              selectedTagId={selectedTagFilter}
              onSelect={setSelectedTagFilter}
            />
          )}

          {/* Recherche locale */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">📣</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher parmi mes saynètes..."
              className="w-full p-3 pl-10 pr-10 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Option de verrouillage */}
          {localScripts.length > 1 && !selectedTagFilter && (
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

          {/* Liste des saynètes */}
          {localScripts.length === 0 ? (
            <div className="text-center py-12 bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
              <p className="text-4xl mb-3">📄</p>
              <p className="text-gray-400 text-sm">Aucun texte pour le moment</p>
              <p className="text-gray-600 text-xs mt-1">
                Importez votre premier fichier pour commencer !
              </p>
              <Link to="/upload" className="btn-gold mt-4 inline-block text-xs py-2 px-4">
                📤 Importer un texte
              </Link>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={[
                  ...localScripts.map((s) => s.id),
                  ...personalAudios.map((a) => a.id),
                ]}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    ...localScripts,
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
          )}
        </div>
      )}

      {/* 2. ONGLET : CONSIGNES */}
      {activeHomeTab === "director" && (
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
      )}

      {/* 3. ONGLET : BIBLIOTHÈQUE */}
      {activeHomeTab === "library" && (
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
      )}

      {/* Modale de confirmation suppression */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full border border-gray-800 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Supprimer ce texte ?</h3>
            <p className="text-gray-400 text-xs mb-6">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 py-2.5">
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

      {/* Viewer Document */}
      {viewingDocument && (
        <DocumentViewer document={viewingDocument} onClose={() => setViewingDocument(null)} />
      )}

      {/* Modale Partage */}
      {scriptToShare && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl max-w-sm w-full border border-gray-800 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">👥 Partager "{scriptToShare.title}"</h3>
            <p className="text-gray-400 text-xs mb-4">Choisissez la troupe destinataire :</p>
            {shareTroupes.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-4">Aucune troupe disponible.</p>
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
            {shareSuccess && <p className="text-green-400 text-xs mb-4">{shareSuccess}</p>}
            {shareError && <p className="text-red-400 text-xs mb-4">{shareError}</p>}
            <button onClick={() => setScriptToShare(null)} className="btn-secondary w-full py-2.5">
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Modale Tags */}
      {managingTagsFor && (
        <ScriptTagsModal
          scriptId={managingTagsFor.id}
          scriptTitle={managingTagsFor.title}
          userId={user?.id}
          onClose={() => {
            setManagingTagsFor(null);
            loadScriptsTags();
            loadUserTags();
          }}
        />
      )}

      {/* Notifications Audio */}
      {audioImportMsg && (
        <div className="fixed bottom-32 left-4 right-4 z-50 px-4 py-3 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-2xl flex items-center justify-between">
          <span>{audioImportMsg.text}</span>
          <button onClick={() => setAudioImportMsg(null)} className="text-xs">✕</button>
        </div>
      )}

      <FloatingActionButton />
    </div>
  );
}

/**
 * Composants auxiliaires pour la liste DnD
 */
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
      className="card hover:border-amber-500/60 transition cursor-pointer group bg-gray-800/90 border border-gray-700/80 p-4 rounded-2xl shadow-md flex flex-col justify-between"
    >
      <div className="flex items-center gap-3">
        {!orderLocked && (
          <button
            {...attributes}
            {...listeners}
            className="touch-none text-gray-500 hover:text-gold-500 p-1 cursor-grab active:cursor-grabbing text-lg"
          >
            ⋮⋮
          </button>
        )}

        <div onClick={() => onOpen(script.id)} className="flex-1 flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-gold-500/10 border border-gold-500/30 rounded-xl flex items-center justify-center text-gold-400 font-bold text-xs flex-shrink-0">
            #{index + 1}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-base truncate group-hover:text-amber-400 transition">
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
            className="p-1.5 text-gray-400 hover:text-gold-400 hover:bg-gray-700/60 rounded-lg transition"
            title="Tags"
          >
            🏷️
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare(script);
            }}
            className="p-1.5 text-gray-400 hover:text-primary-300 hover:bg-gray-700/60 rounded-lg transition"
            title="Partager"
          >
            👥
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(script.id);
            }}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition"
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
      className="bg-gray-800/80 border border-blue-500/30 rounded-xl p-3 shadow-md"
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
          <p className="text-white text-xs font-medium truncate">{audio.title || audio.file_name}</p>
          <audio src={audioUrl} controls className="w-full h-7 mt-1" />
        </div>

        <button
          onClick={() => onDelete(audio.id, audio.audio_path)}
          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

export default Home;
