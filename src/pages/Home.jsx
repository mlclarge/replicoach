import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useScriptStore } from "../store/scriptStore";
import { useAuthStore } from "../store/authStore";
import { 
  uploadDirectorNote, 
  fetchDirectorNotes, 
  deleteDirectorNote,
  fetchUserTroupes,
  shareScript as shareScriptToTroupe,
  fetchUserTags,
  fetchScriptTags,
} from "../lib/supabase";
import Loader from "../components/ui/Loader";
import DocumentViewer from "../components/DocumentViewer";
import PublicLibrary from "../components/PublicLibrary";
import { ScriptTagsModal, ScriptTagBadges, TagFilter } from "../components/TagManager";
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

/**
 * Carte de script draggable - FOND BEIGE/CRÈME + CONTRASTE FORT
 */

// Couleurs de fond CLAIRES pour les cartes (alternées)
const CARD_BACKGROUNDS = [
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900' },
  { bg: 'bg-stone-100', border: 'border-stone-300', text: 'text-stone-900' },
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900' },
  { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900' },
];

function SortableScriptCard({ script, onDelete, onOpen, onShare, onManageTags, index = 0, notesCount = 0 }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: script.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  // Couleur de fond alternée selon l'index
  const colorScheme = CARD_BACKGROUNDS[index % CARD_BACKGROUNDS.length];

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* ===== CARTE AVEC FOND BEIGE/CRÈME ===== */}
      <div
        className={`block transition rounded-xl border-2 shadow-md
          ${isDragging 
            ? "shadow-lg ring-2 ring-gold-500 bg-amber-100 border-gold-500" 
            : `${colorScheme.bg} ${colorScheme.border} hover:border-primary-500 hover:shadow-lg`
          }`}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Poignée de drag - VISIBLE SUR FOND CLAIR */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-2 -m-2 text-gray-500 
                         hover:text-primary-600 hover:bg-primary-100 rounded-lg transition
                         touch-none select-none"
              style={{ touchAction: 'none' }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
              </svg>
            </div>

            {/* Contenu cliquable */}
            <div 
              className="flex-1 cursor-pointer"
              onClick={() => onOpen(script.id)}
            >
              <div className="flex items-center gap-3">
                {/* NUMÉRO - Fond coloré pour ressortir */}
                <span className="bg-primary-600 text-white font-bold text-lg px-3 py-1 rounded-lg min-w-[2.5rem] text-center">
                  #{script.display_order || "?"}
                </span>
                <div className="flex-1">
                  {/* TITRE - Texte foncé sur fond clair */}
                  <h3 className={`font-bold text-lg ${colorScheme.text}`}>{script.title}</h3>
                  {/* SOUS-TITRE - Gris foncé */}
                  <p className="text-gray-600 text-sm">
                    {script.characters?.length || 0} personnage
                    {(script.characters?.length || 0) > 1 ? "s" : ""} • {" "}
                    {script.replicas?.length || 0} réplique
                    {(script.replicas?.length || 0) > 1 ? "s" : ""}
                    {notesCount > 0 && (
                      <span className="ml-2 text-amber-600 font-semibold">
                        • 📝 {notesCount}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* TAGS DU SCRIPT */}
              {script.tags && script.tags.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {script.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: `${tag.color}25`,
                        color: tag.color,
                        border: `1px solid ${tag.color}50`,
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              {/* TAGS PERSONNAGES - Bien contrastés */}
              {script.characters && script.characters.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {script.characters.slice(0, 4).map((char) => (
                    <span
                      key={char.id}
                      className="text-xs px-3 py-1.5 rounded-full font-semibold border-2 shadow-sm"
                      style={{
                        backgroundColor: char.color,
                        color: 'white',
                        borderColor: char.color,
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      }}
                    >
                      {char.name}
                    </span>
                  ))}
                  {script.characters.length > 4 && (
                    <span className="text-xs px-3 py-1.5 rounded-full bg-gray-600 text-white font-semibold">
                      +{script.characters.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ===== BOUTONS D'ACTION - TRÈS VISIBLES ===== */}
            <div className="flex flex-col gap-2">
              {/* Bouton tags - FOND VIOLET */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onManageTags(script);
                }}
                className="p-2.5 text-xl bg-purple-500 hover:bg-purple-600 
                           text-white rounded-lg transition shadow-md
                           border-2 border-purple-600"
                title="Gérer les tags"
              >
                🏷️
              </button>
              
              {/* Bouton partager - FOND VERT SOLIDE */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(script);
                }}
                className="p-2.5 text-xl bg-green-500 hover:bg-green-600 
                           text-white rounded-lg transition shadow-md
                           border-2 border-green-600"
                title="Partager avec ma troupe"
              >
                👥
              </button>
              
              {/* Bouton supprimer - FOND ROUGE SOLIDE */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(script.id);
                }}
                className="p-2.5 text-xl bg-red-500 hover:bg-red-600 
                           text-white rounded-lg transition shadow-md
                           border-2 border-red-600"
                title="Supprimer"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Section Consignes Metteur en Scène - Expandable avec documents visibles
 */
function DirectorNotesSection({ 
  notes, 
  onUpload, 
  onDelete, 
  onViewDocument,
  uploading, 
  error,
  expanded,
  onToggleExpand 
}) {
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

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
    }
  }, [onUpload]);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
      e.target.value = '';
    }
  };

  const getFileIcon = (note) => {
    const name = note.file_name?.toLowerCase() || '';
    const type = note.file_type || '';
    
    if (type.includes('pdf') || name.endsWith('.pdf')) return '📕';
    if (type.includes('image') || /\.(jpg|jpeg|png|gif)$/.test(name)) return '🖼️';
    if (type.includes('word') || /\.(doc|docx)$/.test(name)) return '📘';
    if (type.includes('text') || name.endsWith('.txt')) return '📝';
    return '📄';
  };

  return (
    <div className="mb-6">
      {/* Header cliquable */}
      <div
        onClick={onToggleExpand}
        className="card cursor-pointer hover:border-yellow-500/50 transition group"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-yellow-500/20 rounded-xl flex items-center justify-center
                          group-hover:bg-yellow-500/30 transition">
            <span className="text-3xl">📁</span>
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-500">Consignes du metteur en scène</h3>
            <p className="text-gray-500 text-sm">
              {notes.length > 0 
                ? `${notes.length} document${notes.length > 1 ? 's' : ''}`
                : 'Aucun document pour le moment'
              }
            </p>
          </div>
          
          <div className={`text-gray-500 group-hover:text-yellow-500 transition transform ${expanded ? 'rotate-90' : ''}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Contenu expandable */}
      {expanded && (
        <div className="mt-3 space-y-3 pl-4 border-l-2 border-yellow-500/30">
          {/* Zone d'upload compacte */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-xl p-4 text-center transition
              ${dragActive 
                ? 'border-yellow-500 bg-yellow-500/10' 
                : 'border-gray-700 hover:border-yellow-500/50'
              }
            `}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader size="sm" />
                <span className="text-gray-400">Upload...</span>
              </div>
            ) : (
              <label className="cursor-pointer flex items-center justify-center gap-2">
                <span className="text-xl">📤</span>
                <span className="text-gray-400 text-sm">Ajouter un document</span>
                <input
                  type="file"
                  accept=".pdf,.txt,.doc,.docx,image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Erreur */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Liste des documents */}
          {notes.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-2">
              Glissez des fichiers ou cliquez pour ajouter
            </p>
          ) : (
            <div className="space-y-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition group"
                >
                  <span className="text-2xl">{getFileIcon(note)}</span>
                  
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onViewDocument(note)}
                  >
                    <p className="text-white font-medium truncate group-hover:text-yellow-500 transition">
                      {note.file_name}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {new Date(note.created_at).toLocaleDateString('fr-FR')}
                      {note.file_size && ` • ${(note.file_size / 1024).toFixed(0)} Ko`}
                    </p>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => onViewDocument(note)}
                    className="p-2 text-gray-400 hover:text-blue-400 rounded-lg hover:bg-blue-500/10 transition"
                    title="Voir"
                  >
                    👁️
                  </button>
                  <button
                    onClick={() => onDelete(note.id)}
                    className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition"
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Info */}
          <p className="text-gray-600 text-xs text-center">
            💡 Visibles par tous les comédiens
          </p>
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
  const [sortBy, setSortBy] = useState("order");
  const [activeId, setActiveId] = useState(null);
  const [notesCounts, setNotesCounts] = useState({}); // Compteur de notes par script
  
  // États pour les consignes metteur en scène
  const [directorNotesExpanded, setDirectorNotesExpanded] = useState(false);
  const [directorNotes, setDirectorNotes] = useState([]);
  const [uploadingNote, setUploadingNote] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  
  // État pour le viewer de document
  const [viewingDocument, setViewingDocument] = useState(null);
  
  // États pour le partage
  const [scriptToShare, setScriptToShare] = useState(null);
  const [shareTroupes, setShareTroupes] = useState([]);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(null);
  const [shareError, setShareError] = useState(null);

  // États pour les TAGS
  const [userTags, setUserTags] = useState([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState(null);
  const [scriptTagsMap, setScriptTagsMap] = useState({}); // { scriptId: [tags] }
  const [managingTagsFor, setManagingTagsFor] = useState(null); // script en cours d'édition tags

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (user) {
      fetchScripts(user.id);
      loadDirectorNotes();
      loadNotesCounts();
      loadUserTags();
    }
  }, [user, fetchScripts]);

  // Charger les tags de l'utilisateur
  const loadUserTags = async () => {
    if (!user) return;
    try {
      const tags = await fetchUserTags(user.id);
      setUserTags(tags || []);
    } catch (err) {
      console.error("Erreur chargement tags:", err);
    }
  };

  // Charger les tags de chaque script
  const loadScriptsTags = async () => {
    if (!user || scripts.length === 0) return;
    try {
      const tagsMap = {};
      await Promise.all(
        scripts.map(async (script) => {
          const tags = await fetchScriptTags(script.id);
          tagsMap[script.id] = tags || [];
        })
      );
      setScriptTagsMap(tagsMap);
    } catch (err) {
      console.error("Erreur chargement tags scripts:", err);
    }
  };

  // Charger les tags quand les scripts changent
  useEffect(() => {
    if (scripts.length > 0) {
      loadScriptsTags();
    }
  }, [scripts]);

  // Charger le nombre de notes par script
  const loadNotesCounts = async () => {
    if (!user || !countNotesForScripts) return;
    try {
      const counts = await countNotesForScripts(user.id);
      setNotesCounts(counts);
    } catch (err) {
      console.error("Erreur chargement notes:", err);
    }
  };

  const loadDirectorNotes = async () => {
    if (!user) return;
    try {
      const notes = await fetchDirectorNotes(user.id);
      setDirectorNotes(notes || []);
    } catch (error) {
      console.error('Erreur chargement consignes:', error);
    }
  };

  useEffect(() => {
    let sorted = [...scripts];

    // Filtrer par tag si sélectionné
    if (selectedTagFilter) {
      sorted = sorted.filter(script => {
        const scriptTags = scriptTagsMap[script.id] || [];
        return scriptTags.some(tag => tag.id === selectedTagFilter);
      });
    }

    switch (sortBy) {
      case "alpha":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "date":
        sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case "order":
      default:
        sorted.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    }

    setLocalScripts(sorted);
  }, [scripts, sortBy, selectedTagFilter, scriptTagsMap]);

  const handleOpenScript = (scriptId) => {
    navigate(`/script/${scriptId}`);
  };

  const handleDelete = (scriptId) => {
    setDeleteConfirm(scriptId);
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      await deleteScript(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (active.id !== over?.id) {
      const oldIndex = localScripts.findIndex((s) => s.id === active.id);
      const newIndex = localScripts.findIndex((s) => s.id === over.id);

      const newOrder = arrayMove(localScripts, oldIndex, newIndex);
      setLocalScripts(newOrder);

      const updates = newOrder.map((script, index) => ({
        id: script.id,
        display_order: index + 1,
      }));

      await updateScriptOrder(updates);
    }
  };

  const handleRenumber = async () => {
    const updates = localScripts.map((script, index) => ({
      id: script.id,
      display_order: index + 1,
    }));

    setLocalScripts(prev => prev.map((script, index) => ({
      ...script,
      display_order: index + 1,
    })));

    await updateScriptOrder(updates);
  };

  // Gestion des consignes metteur en scène
  const handleUploadDirectorNote = async (files) => {
    if (!user) return;
    
    setUploadingNote(true);
    setUploadError(null);

    try {
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          setUploadError(`Fichier trop volumineux: ${file.name}. Maximum 10 Mo.`);
          continue;
        }
        
        const uploaded = await uploadDirectorNote(file, user.id);
        setDirectorNotes(prev => [uploaded, ...prev]);
      }
    } catch (error) {
      console.error('Erreur upload:', error);
      setUploadError(`Erreur lors de l'upload: ${error.message}`);
    } finally {
      setUploadingNote(false);
    }
  };

  const handleDeleteDirectorNote = async (noteId) => {
    const note = directorNotes.find(n => n.id === noteId);
    if (!note) return;
    
    try {
      await deleteDirectorNote(noteId, note.file_path);
      setDirectorNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleViewDocument = (note) => {
    setViewingDocument(note);
  };

  // Handlers pour le partage
  const handleOpenShare = async (script) => {
    setScriptToShare(script);
    setShareError(null);
    setShareSuccess(null);
    
    try {
      const troupes = await fetchUserTroupes(user.id);
      setShareTroupes(troupes || []);
    } catch (err) {
      console.error("Erreur chargement troupes:", err);
      setShareTroupes([]);
    }
  };

  const handleConfirmShare = async (troupeId) => {
    if (!scriptToShare || !user) return;
    
    setSharingLoading(true);
    setShareError(null);
    
    try {
      await shareScriptToTroupe(scriptToShare.id, troupeId, user.id);
      setShareSuccess("✓ Texte partagé !");
      setTimeout(() => {
        setScriptToShare(null);
        setShareSuccess(null);
      }, 1500);
    } catch (err) {
      if (err.message?.includes("déjà partagé")) {
        setShareError("Ce texte est déjà partagé avec cette troupe");
      } else {
        setShareError(err.message || "Erreur lors du partage");
      }
    } finally {
      setSharingLoading(false);
    }
  };

  const activeScript = activeId 
    ? localScripts.find(s => s.id === activeId) 
    : null;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      {/* Boutons d'action */}
      <div className="flex gap-3 mb-4">
        <Link
          to="/upload"
          className="btn-gold flex-1 flex items-center justify-center gap-2"
        >
          <span>➕</span> Nouveau texte
        </Link>
      </div>

      {/* Section Consignes Metteur en Scène - Expandable */}
      <DirectorNotesSection
        notes={directorNotes}
        onUpload={handleUploadDirectorNote}
        onDelete={handleDeleteDirectorNote}
        onViewDocument={handleViewDocument}
        uploading={uploadingNote}
        error={uploadError}
        expanded={directorNotesExpanded}
        onToggleExpand={() => setDirectorNotesExpanded(!directorNotesExpanded)}
      />

      {/* Bibliothèque publique */}
      <PublicLibrary />

      {/* En-tête liste + Actions */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Mes saynètes</h2>
        
        <div className="flex items-center gap-2">
          {localScripts.length > 1 && (
            <button
              onClick={handleRenumber}
              className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-400 
                         hover:bg-primary-600 hover:text-white transition"
              title="Renuméroter à partir de 1"
            >
              🔄 1,2,3...
            </button>
          )}
          
          {localScripts.length > 1 && (
            <div className="flex gap-1 ml-2">
              <button
                onClick={() => setSortBy("order")}
                className={`px-2 py-1 rounded text-xs transition ${
                  sortBy === "order"
                    ? "bg-gold-500 text-dark"
                    : "bg-gray-700 text-gray-400"
                }`}
                title="Tri manuel"
              >
                #
              </button>
              <button
                onClick={() => setSortBy("alpha")}
                className={`px-2 py-1 rounded text-xs transition ${
                  sortBy === "alpha"
                    ? "bg-gold-500 text-dark"
                    : "bg-gray-700 text-gray-400"
                }`}
                title="Tri alphabétique"
              >
                A-Z
              </button>
              <button
                onClick={() => setSortBy("date")}
                className={`px-2 py-1 rounded text-xs transition ${
                  sortBy === "date"
                    ? "bg-gold-500 text-dark"
                    : "bg-gray-700 text-gray-400"
                }`}
                title="Tri par date"
              >
                📅
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filtre par Tags */}
      {userTags.length > 0 && (
        <div className="mb-4">
          <TagFilter 
            tags={userTags}
            selectedTagId={selectedTagFilter}
            onSelect={setSelectedTagFilter}
          />
        </div>
      )}

      {/* Indication drag & drop */}
      {sortBy === "order" && localScripts.length > 1 && !selectedTagFilter && (
        <p className="text-gray-500 text-xs mb-3 flex items-center gap-1">
          <span>💡</span> Maintenez appuyé sur ⋮⋮ pour réorganiser
        </p>
      )}

      {/* Liste des scripts */}
      {localScripts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-5xl mb-4">📄</p>
          <p className="text-gray-400">Aucun texte pour le moment</p>
          <p className="text-gray-600 text-sm mt-2">
            Uploadez votre premier fichier pour commencer !
          </p>
          <Link to="/upload" className="btn-primary mt-4 inline-block">
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
            items={localScripts.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {localScripts.map((script, index) => (
                <SortableScriptCard
                  key={script.id}
                  script={{
                    ...script,
                    tags: scriptTagsMap[script.id] || []
                  }}
                  index={index}
                  onDelete={handleDelete}
                  onOpen={handleOpenScript}
                  onShare={handleOpenShare}
                  onManageTags={(s) => setManagingTagsFor(s)}
                  notesCount={notesCounts[script.id] || 0}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeScript ? (
              <div className="card shadow-2xl ring-2 ring-gold-500 opacity-90">
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

      {/* Footer avec crédit */}
      <div className="mt-8 pt-4 border-t border-gray-800">
        <p className="text-gray-600 text-xs text-center">
          Fait avec ❤️ pour le Tpt par MLconseil
        </p>
      </div>

      {/* Modal de confirmation suppression */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark rounded-xl p-6 max-w-sm w-full border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-2">
              Supprimer ce texte ?
            </h3>
            <p className="text-gray-400 mb-6">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary flex-1"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-full font-semibold flex-1 transition"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewer de document intégré */}
      {viewingDocument && (
        <DocumentViewer
          document={viewingDocument}
          onClose={() => setViewingDocument(null)}
        />
      )}

      {/* Modal de partage */}
      {scriptToShare && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-dark rounded-xl max-w-sm w-full border border-gray-700">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                👥 Partager "{scriptToShare.title}"
              </h3>
            </div>

            <div className="p-4">
              {shareTroupes.length === 0 ? (
                <div className="text-center py-6">
                  <span className="text-4xl mb-3 block">🎭</span>
                  <p className="text-gray-400 mb-2">Vous n'avez pas encore de troupe</p>
                  <p className="text-gray-500 text-sm mb-4">
                    Créez ou rejoignez une troupe pour partager vos textes.
                  </p>
                  <Link 
                    to="/shared" 
                    onClick={() => setScriptToShare(null)}
                    className="btn-gold inline-block"
                  >
                    Gérer mes troupes
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm">
                    Choisissez une troupe :
                  </p>

                  <div className="space-y-2">
                    {shareTroupes.map((troupe) => (
                      <button
                        key={troupe.id}
                        onClick={() => handleConfirmShare(troupe.id)}
                        disabled={sharingLoading}
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

              {shareSuccess && (
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500 rounded-lg">
                  <p className="text-green-400 text-center font-medium">{shareSuccess}</p>
                </div>
              )}

              {shareError && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500 rounded-lg">
                  <p className="text-red-400 text-sm">{shareError}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-700">
              <button 
                onClick={() => setScriptToShare(null)} 
                className="btn-secondary w-full"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal gestion des tags */}
      {managingTagsFor && (
        <ScriptTagsModal
          scriptId={managingTagsFor.id}
          scriptTitle={managingTagsFor.title}
          userId={user?.id}
          onClose={() => {
            setManagingTagsFor(null);
            // Recharger les tags du script modifié
            loadScriptsTags();
            loadUserTags();
          }}
        />
      )}
    </div>
  );
}

export default Home;
