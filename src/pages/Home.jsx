import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
  const { user } = useAuthStore();
  const { scripts, loading, fetchScripts } = useScriptStore();

  // Navigation par onglets ('scripts', 'director', 'library')
  const [activeHomeTab, setActiveHomeTab] = useState("scripts");

  // Consignes Metteur en scène
  const [directorNotesExpanded, setDirectorNotesExpanded] = useState(true);
  const [directorNotes, setDirectorNotes] = useState([]);
  const [uploadingNote, setUploadingNote] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadTroupes, setUploadTroupes] = useState([]);

  // Documents
  const [viewingDocument, setViewingDocument] = useState(null);

  useEffect(() => {
    if (user?.id) {
      fetchScripts(user.id);
      loadDirectorNotes();
      loadUploadTroupes();
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

  const handleUploadDirectorNote = async (files) => {
    if (!user) return;
    setUploadingNote(true);
    setUploadError(null);
    try {
      for (const file of files) {
        await uploadDirectorNote(file, user.id, null);
      }
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 pt-4">
      
      {/* 🧭 TOP DE LA HOME : BARRE D'ONGLETS Navigation */}
      <div className="flex gap-2 mb-4 p-1.5 bg-gray-900/90 rounded-2xl border border-gray-800 backdrop-blur-sm max-w-2xl mx-auto shadow-xl">
        <button
          onClick={() => setActiveHomeTab("scripts")}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
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

      {/* 2 BOUTONS D'ACCÈS RAPIDE PAR ANCRAGE */}
      {activeHomeTab === "scripts" && (
        <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto mb-6">
          <button
            onClick={() => {
              const el = document.getElementById("comedien");
              if (el) el.scrollIntoView({ behavior: "smooth" });
              else navigate("/upload");
            }}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-extrabold text-xs sm:text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 active:scale-95"
          >
            <span>➕ Importer un texte</span>
            <span className="text-xs font-bold">↓</span>
          </button>

          <button
            onClick={() => {
              const el = document.getElementById("troupe");
              if (el) el.scrollIntoView({ behavior: "smooth" });
              else navigate("/shared");
            }}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-primary-700 hover:from-purple-500 hover:to-primary-600 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 active:scale-95"
          >
            <span>🎭 Accès metteur en scène</span>
            <span className="text-xs font-bold">↓</span>
          </button>
        </div>
      )}

      {/* 1. ONGLET : MES TEXTES (Cartes d'accès principales) */}
      {activeHomeTab === "scripts" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* CARTE 1 : COMÉDIEN INDÉPENDANT */}
            <div id="comedien">
              <Link
                to="/upload"
                className="relative bg-gradient-to-br from-gray-900/90 via-gray-800/90 to-amber-950/30 border-2 border-amber-500/60 hover:border-amber-400 rounded-2xl p-5 sm:p-6 transition-all duration-300 group shadow-xl hover:shadow-amber-500/20 flex flex-col justify-between overflow-hidden block"
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
            </div>

            {/* CARTE 2 : EN TROUPE / ATELIER */}
            <div id="troupe">
              <Link
                to="/shared"
                className="relative bg-gradient-to-br from-primary-950/90 via-gray-900 to-purple-950/90 border-2 border-purple-500/60 hover:border-purple-400 rounded-2xl p-5 sm:p-6 transition-all duration-300 group shadow-xl hover:shadow-purple-500/20 flex flex-col justify-between overflow-hidden block"
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
          <PublicLibrary />
        </div>
      )}

      {/* Viewer Document */}
      {viewingDocument && (
        <DocumentViewer document={viewingDocument} onClose={() => setViewingDocument(null)} />
      )}

      <FloatingActionButton />
    </div>
  );
}

export default Home;
