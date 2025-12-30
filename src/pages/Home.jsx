import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useScriptStore } from "../store/scriptStore";
import { useAuthStore } from "../store/authStore";
import { 
  uploadDirectorNote, 
  fetchDirectorNotes, 
  deleteDirectorNote 
} from "../lib/supabase";
import Loader from "../components/ui/Loader";
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
 * Carte de script draggable - CORRIGÉE
 * La poignée est maintenant SÉPARÉE du lien pour éviter les conflits
 */
function SortableScriptCard({ script, onDelete, onOpen }) {
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

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div
        className={`card block transition ${
          isDragging ? "shadow-lg ring-2 ring-gold-500" : "hover:border-gray-600"
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Poignée de drag - SÉPARÉE et avec touch-action */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-2 -m-2 text-gray-500 
                       hover:text-gold-500 hover:bg-gray-700/50 rounded-lg transition
                       touch-none select-none"
            style={{ touchAction: 'none' }}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
            </svg>
          </div>

          {/* Contenu cliquable - navigue vers le script */}
          <div 
            className="flex-1 cursor-pointer"
            onClick={() => onOpen(script.id)}
          >
            <div className="flex items-center gap-3">
              {/* Numéro */}
              <span className="text-gold-500 font-bold text-lg min-w-[2rem]">
                #{script.display_order || "?"}
              </span>

              {/* Infos */}
              <div className="flex-1">
                <h3 className="font-semibold text-white">{script.title}</h3>
                <p className="text-gray-500 text-sm">
                  {script.characters?.length || 0} personnage
                  {(script.characters?.length || 0) > 1 ? "s" : ""} • {" "}
                  {script.replicas?.length || 0} réplique
                  {(script.replicas?.length || 0) > 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Tags personnages */}
            {script.characters && script.characters.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {script.characters.slice(0, 4).map((char) => (
                  <span
                    key={char.id}
                    className="text-xs px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: char.color + "20",
                      color: char.color,
                    }}
                  >
                    {char.name}
                  </span>
                ))}
                {script.characters.length > 4 && (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-400">
                    +{script.characters.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Bouton supprimer */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(script.id);
            }}
            className="p-2 text-gray-500 hover:text-red-400 
                       hover:bg-red-500/10 rounded-lg transition"
            title="Supprimer"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Carte pour le dossier Consignes Metteur en Scène
 */
function DirectorNotesCard({ onClick, notesCount = 0 }) {
  return (
    <div
      onClick={onClick}
      className="card cursor-pointer hover:border-yellow-500/50 transition group"
    >
      <div className="flex items-center gap-4">
        {/* Icône dossier jaune */}
        <div className="w-14 h-14 bg-yellow-500/20 rounded-xl flex items-center justify-center
                        group-hover:bg-yellow-500/30 transition">
          <span className="text-3xl">📁</span>
        </div>
        
        <div className="flex-1">
          <h3 className="font-semibold text-yellow-500">Consignes du metteur en scène</h3>
          <p className="text-gray-500 text-sm">
            {notesCount > 0 
              ? `${notesCount} document${notesCount > 1 ? 's' : ''}`
              : 'Aucun document pour le moment'
            }
          </p>
        </div>
        
        <div className="text-gray-500 group-hover:text-yellow-500 transition">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal Consignes Metteur en Scène
 */
function DirectorNotesModal({ isOpen, onClose, notes, onUpload, onDelete, uploading }) {
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUpload(e.dataTransfer.files);
    }
  }, [onUpload]);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden border border-gray-700">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📁</span>
            <h2 className="text-lg font-semibold text-yellow-500">
              Consignes du metteur en scène
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Zone d'upload */}
        <div className="p-4 border-b border-gray-700">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-xl p-6 text-center transition
              ${dragActive 
                ? 'border-yellow-500 bg-yellow-500/10' 
                : 'border-gray-600 hover:border-yellow-500/50'
              }
            `}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader size="sm" />
                <p className="text-gray-400">Upload en cours...</p>
              </div>
            ) : (
              <>
                <span className="text-4xl">📤</span>
                <p className="text-gray-300 mt-2">
                  Glissez vos PDF de consignes ici
                </p>
                <p className="text-gray-500 text-sm mt-1">ou</p>
                <label className="btn-gold mt-3 cursor-pointer inline-block">
                  Parcourir
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </>
            )}
          </div>
        </div>

        {/* Liste des documents */}
        <div className="p-4 overflow-y-auto max-h-60">
          {notes.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              Aucune consigne pour le moment
            </p>
          ) : (
            <div className="space-y-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg"
                >
                  <span className="text-2xl">📄</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{note.filename}</p>
                    <p className="text-gray-500 text-xs">
                      {new Date(note.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <a
                    href={note.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-blue-400 rounded-lg hover:bg-blue-500/10"
                    title="Ouvrir"
                  >
                    👁️
                  </a>
                  <button
                    onClick={() => onDelete(note.id)}
                    className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10"
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <p className="text-gray-500 text-sm text-center">
            💡 Ces documents sont visibles par tous les comédiens de la troupe
          </p>
        </div>
      </div>
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
    renumberScripts 
  } = useScriptStore();
  
  const [activeTab, setActiveTab] = useState("mine");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [localScripts, setLocalScripts] = useState([]);
  const [sortBy, setSortBy] = useState("order");
  const [activeId, setActiveId] = useState(null);
  
  // États pour les consignes metteur en scène
  const [showDirectorNotes, setShowDirectorNotes] = useState(false);
  const [directorNotes, setDirectorNotes] = useState([]);
  const [uploadingNote, setUploadingNote] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Réduit pour meilleure réactivité
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (user) {
      fetchScripts(user.id);
      // Charger les notes du metteur en scène
      loadDirectorNotes();
    }
  }, [user, fetchScripts]);

  const loadDirectorNotes = async () => {
    if (!user) return;
    try {
      const notes = await fetchDirectorNotes(user.id);
      setDirectorNotes(notes);
    } catch (error) {
      console.error('Erreur chargement consignes:', error);
    }
  };

  useEffect(() => {
    let sorted = [...scripts];

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
  }, [scripts, sortBy]);

  const handleDelete = (scriptId) => {
    setDeleteConfirm(scriptId);
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      await deleteScript(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const handleOpenScript = (scriptId) => {
    navigate(`/script/${scriptId}`);
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

      // Mise à jour locale immédiate
      setLocalScripts(newOrder);

      // Mise à jour en base de données
      const updates = newOrder.map((script, index) => ({
        id: script.id,
        display_order: index + 1,
      }));

      await updateScriptOrder(updates);
    }
  };

  // Renuméroter à partir de 1
  const handleRenumber = async () => {
    const updates = localScripts.map((script, index) => ({
      id: script.id,
      display_order: index + 1,
    }));
    
    await updateScriptOrder(updates);
    
    // Mettre à jour localement
    setLocalScripts(prev => prev.map((script, index) => ({
      ...script,
      display_order: index + 1
    })));
  };

  // Upload de consigne metteur en scène
  const handleUploadDirectorNote = async (files) => {
    if (!user) return;
    setUploadingNote(true);
    
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadDirectorNote(file, user.id);
        setDirectorNotes(prev => [uploaded, ...prev]);
      }
    } catch (error) {
      console.error('Erreur upload:', error);
      alert('Erreur lors de l\'upload du fichier');
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

  // Script actif pour l'overlay de drag
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

      {/* Onglets */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("mine")}
          className={`flex-1 py-2 rounded-lg font-semibold transition
            ${
              activeTab === "mine"
                ? "bg-primary-700 text-white"
                : "bg-gray-800 text-gray-400"
            }`}
        >
          🎭 Mes textes
        </button>
        <button
          onClick={() => setActiveTab("shared")}
          className={`flex-1 py-2 rounded-lg font-semibold transition
            ${
              activeTab === "shared"
                ? "bg-primary-700 text-white"
                : "bg-gray-800 text-gray-400"
            }`}
        >
          👥 Partagés
        </button>
      </div>

      {/* Carte Consignes Metteur en Scène */}
      <div className="mb-6">
        <DirectorNotesCard 
          onClick={() => setShowDirectorNotes(true)}
          notesCount={directorNotes.length}
        />
      </div>

      {/* En-tête liste + Actions */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Mes saynètes</h2>
        
        <div className="flex items-center gap-2">
          {/* Bouton Renuméroter */}
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
          
          {/* Boutons de tri */}
          {localScripts.length > 1 && (
            <div className="flex gap-1 ml-2">
              <button
                onClick={() => setSortBy("order")}
                className={`px-2 py-1 rounded text-xs transition ${
                  sortBy === "order"
                    ? "bg-gold-500 text-dark"
                    : "bg-gray-700 text-gray-400"
                }`}
                title="Tri manuel (drag & drop)"
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

      {/* Indication drag & drop */}
      {sortBy === "order" && localScripts.length > 1 && (
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
            Uploadez votre premier PDF pour commencer !
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
            <div className="space-y-3">
              {localScripts.map((script) => (
                <SortableScriptCard
                  key={script.id}
                  script={script}
                  onDelete={handleDelete}
                  onOpen={handleOpenScript}
                />
              ))}
            </div>
          </SortableContext>

          {/* Overlay pendant le drag */}
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

      {/* Modal Consignes Metteur en Scène */}
      <DirectorNotesModal
        isOpen={showDirectorNotes}
        onClose={() => setShowDirectorNotes(false)}
        notes={directorNotes}
        onUpload={handleUploadDirectorNote}
        onDelete={handleDeleteDirectorNote}
        uploading={uploadingNote}
      />
    </div>
  );
}

export default Home;
