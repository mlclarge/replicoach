import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "../store/authStore";
import {
  fetchPublicDocuments,
  uploadPublicDocument,
  getPublicDocumentUrl,
  deletePublicDocument,
  fetchUserTroupes,
} from "../lib/supabase";
import Loader from "./ui/Loader";

/**
 * Bibliothèque de documents publics
 * Upload réservé aux membres de troupes - visible par tous
 */
function PublicLibrary() {
  const { user } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [userTroupes, setUserTroupes] = useState([]);
  const [canUpload, setCanUpload] = useState(false);

  useEffect(() => {
    loadDocuments();
    checkUserTroupes();
  }, [selectedCategory, user]);

  const checkUserTroupes = async () => {
    if (!user?.id) {
      setCanUpload(false);
      return;
    }
    try {
      const troupes = await fetchUserTroupes(user.id);
      setUserTroupes(troupes || []);
      setCanUpload(troupes && troupes.length > 0);
    } catch (err) {
      console.error("Erreur vérification troupes:", err);
      setCanUpload(false);
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await fetchPublicDocuments(selectedCategory);
      setDocuments(docs || []);
    } catch (err) {
      console.error("Erreur chargement documents publics:", err);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: null, label: "Tous", icon: "📚" },
    { id: "script", label: "Scripts", icon: "📜" },
    { id: "guide", label: "Guides", icon: "📖" },
    { id: "exercice", label: "Exercices", icon: "🎯" },
  ];

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'pdf': return '📕';
      case 'image': return '🖼️';
      case 'txt': return '📝';
      default: return '📄';
    }
  };

  return (
    <div className="mb-6">
      {/* En-tête cliquable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-primary-900/50 to-primary-800/30 
                   rounded-xl border border-primary-700/50 hover:border-primary-600 transition mb-3"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📚</span>
          <div className="text-left">
            <h2 className="font-semibold text-white">Bibliothèque publique</h2>
            <p className="text-gray-400 text-xs">
              {documents.length} document{documents.length > 1 ? 's' : ''} disponible{documents.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <span className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Contenu déplié */}
      {expanded && (
        <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
          {/* Filtres par catégorie */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.id || 'all'}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition font-medium flex items-center gap-1
                  ${selectedCategory === cat.id
                    ? "bg-primary-600 text-white"
                    : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                  }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Liste des documents */}
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-6">
              <span className="text-4xl mb-2 block">🔭</span>
              <p className="text-gray-500 text-sm">Aucun document pour le moment</p>
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-primary-400 text-sm mt-2"
                >
                  Voir tous les documents
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {documents.map((doc) => (
                <PublicDocItem 
                  key={doc.id}
                  doc={doc}
                  userId={user?.id}
                  onView={() => {
                    const url = getPublicDocumentUrl(doc.file_path);
                    if (url) {
                      window.open(url, '_blank');
                    } else {
                      alert("Impossible d'ouvrir ce document");
                    }
                  }}
                  onDelete={async () => {
                    if (confirm(`Supprimer "${doc.title}" ?`)) {
                      try {
                        await deletePublicDocument(doc.id, doc.file_path);
                        loadDocuments();
                      } catch (err) {
                        console.error("Erreur suppression:", err);
                        alert("Erreur lors de la suppression");
                      }
                    }
                  }}
                  getFileIcon={getFileIcon}
                />
              ))}
            </div>
          )}

          {/* Bouton proposer un document */}
          {canUpload ? (
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-4 w-full p-3 border-2 border-dashed border-gray-600 hover:border-primary-500 
                         rounded-lg text-gray-400 hover:text-primary-400 text-sm transition
                         flex items-center justify-center gap-2"
            >
              <span>📤</span>
              <span>Proposer un document</span>
            </button>
          ) : (
            <div className="mt-4 p-3 bg-gray-700/30 rounded-lg text-center">
              <p className="text-gray-500 text-sm">
                💡 Rejoignez une troupe pour pouvoir partager des documents
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal d'upload */}
      {showUploadModal && (
        <UploadPublicDocModal
          userId={user?.id}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            loadDocuments();
          }}
        />
      )}
    </div>
  );
}

/**
 * Modal pour uploader un document public
 * Fix mobile: empêcher la propagation des events
 */
function UploadPublicDocModal({ userId, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("script");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const selectedFile = e.target.files?.[0];
    console.log("Fichier sélectionné:", selectedFile);
    
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      if (!title) {
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
        setTitle(nameWithoutExt);
      }
    }
  };

  const handleUpload = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    console.log("=== Début upload ===");
    console.log("File:", file);
    console.log("Title:", title);

    if (!file) {
      setError("Veuillez sélectionner un fichier");
      return;
    }
    if (!title.trim()) {
      setError("Veuillez entrer un titre");
      return;
    }
    if (!userId) {
      setError("Vous devez être connecté");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const result = await uploadPublicDocument(file, { title, description, category }, userId);
      console.log("Upload réussi:", result);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error("Erreur upload:", err);
      setError(err.message || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  // État succès
  if (success) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-dark rounded-xl max-w-md w-full border border-green-500 p-8 text-center">
          <span className="text-6xl block mb-4">✅</span>
          <h3 className="text-xl font-bold text-green-400 mb-2">Document ajouté !</h3>
          <p className="text-gray-400">Il est maintenant visible par tous.</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-dark rounded-xl max-w-md w-full border border-gray-700 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">📤 Proposer un document</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2">✕</button>
        </div>

        <form onSubmit={handleUpload} className="p-4 space-y-4">
          {/* Zone de fichier - FIX MOBILE */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Fichier</label>
            <div
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition
                ${file 
                  ? 'border-green-500 bg-green-500/10' 
                  : 'border-gray-600 hover:border-primary-500 bg-gray-800/50'}`}
            >
              {file ? (
                <div>
                  <span className="text-3xl block mb-2">✅</span>
                  <p className="text-green-400 font-medium">{file.name}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-primary-400 text-sm mt-2">Toucher pour changer</p>
                </div>
              ) : (
                <div>
                  <span className="text-3xl block mb-2">📄</span>
                  <p className="text-gray-300">Toucher pour sélectionner</p>
                  <p className="text-gray-500 text-xs mt-1">PDF, TXT, Images</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Titre */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Titre *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input w-full"
              placeholder="Ex: Guide d'improvisation"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input w-full h-20 resize-none"
              placeholder="Décrivez brièvement ce document..."
            />
          </div>

          {/* Catégorie */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Catégorie</label>
            <div className="flex gap-2">
              {[
                { id: "script", label: "Script", icon: "📜" },
                { id: "guide", label: "Guide", icon: "📖" },
                { id: "exercice", label: "Exercice", icon: "🎯" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex-1 py-2 rounded-lg text-sm transition ${
                    category === cat.id
                      ? "bg-primary-600 text-white"
                      : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button 
              type="button"
              onClick={onClose} 
              className="btn-secondary flex-1" 
              disabled={uploading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn-gold flex-1"
              disabled={!file || !title.trim() || uploading}
            >
              {uploading ? "Upload..." : "📤 Envoyer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Item de document public avec boutons d'action
 */
function PublicDocItem({ doc, userId, onView, onDelete, getFileIcon }) {
  const isOwner = userId && doc.uploaded_by === userId;
  
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-700/50 
                    rounded-lg transition group">
      <div 
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        onClick={onView}
      >
        <span className="text-xl">{getFileIcon(doc.file_type)}</span>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{doc.title}</p>
          {doc.description && (
            <p className="text-gray-500 text-xs truncate">{doc.description}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-xs">
          {doc.download_count || 0} 📥
        </span>
        
        <button
          onClick={onView}
          className="p-2 text-gray-400 hover:text-primary-400 hover:bg-gray-700 
                     rounded-lg transition"
          title="Ouvrir"
        >
          👁️
        </button>
        
        {isOwner && (
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 
                       rounded-lg transition"
            title="Supprimer"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}

export default PublicLibrary;
