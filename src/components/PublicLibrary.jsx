import { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import {
  fetchPublicDocuments,
  uploadPublicDocument,
  getPublicDocumentUrl,
} from "../lib/supabase";
import DocumentViewer from "./DocumentViewer";
import Loader from "./ui/Loader";

/**
 * Bibliothèque de documents publics
 * Affiche les documents partagés par la communauté
 */
function PublicLibrary() {
  const { user } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, [selectedCategory]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await fetchPublicDocuments(selectedCategory);
      setDocuments(docs || []);
    } catch (err) {
      console.error("Erreur chargement documents publics:", err);
      // La table n'existe peut-être pas encore
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
              <span className="text-4xl mb-2 block">📭</span>
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
                <div
                  key={doc.id}
                  onClick={() => setViewingDoc(doc)}
                  className="flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-700/50 
                             rounded-lg cursor-pointer transition"
                >
                  <span className="text-xl">{getFileIcon(doc.file_type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{doc.title}</p>
                    {doc.description && (
                      <p className="text-gray-500 text-xs truncate">{doc.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-gray-500 text-xs">
                      {doc.download_count || 0} 📥
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bouton proposer un document */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="mt-4 w-full p-3 border-2 border-dashed border-gray-600 hover:border-primary-500 
                       rounded-lg text-gray-400 hover:text-primary-400 text-sm transition
                       flex items-center justify-center gap-2"
          >
            <span>📤</span>
            <span>Proposer un document</span>
          </button>
        </div>
      )}

      {/* Modal de visualisation */}
      {viewingDoc && (
        <DocumentViewer
          file={{
            name: viewingDoc.file_name,
            url: getPublicDocumentUrl(viewingDoc.file_path),
            type: viewingDoc.file_type === 'pdf' ? 'application/pdf' : 
                  viewingDoc.file_type === 'image' ? 'image/jpeg' : 'text/plain',
          }}
          onClose={() => setViewingDoc(null)}
        />
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
 */
function UploadPublicDocModal({ userId, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("script");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Auto-remplir le titre avec le nom du fichier si vide
      if (!title) {
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
        setTitle(nameWithoutExt);
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) return;

    setUploading(true);
    setError(null);

    try {
      await uploadPublicDocument(file, { title, description, category }, userId);
      onSuccess();
    } catch (err) {
      setError(err.message || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark rounded-xl max-w-md w-full border border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">📤 Proposer un document</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Zone de fichier - AMÉLIORÉE POUR MOBILE */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Fichier</label>
            <label className="block">
              <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition
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
                type="file"
                accept=".pdf,.txt,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
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

          {/* Note de modération */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-yellow-500 text-xs">
              ℹ️ Votre document sera visible après validation par un modérateur.
            </p>
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1" disabled={uploading}>
            Annuler
          </button>
          <button
            onClick={handleUpload}
            className="btn-gold flex-1"
            disabled={!file || !title.trim() || uploading}
          >
            {uploading ? "Upload..." : "📤 Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PublicLibrary;
