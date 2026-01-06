import { useState, useEffect, useRef } from 'react';
import { 
  uploadTroupeDocument, 
  fetchTroupeDocuments, 
  deleteTroupeDocument,
  isUserTroupeAdmin,
  getFileUrl 
} from '../lib/supabase';

/**
 * Composant pour gérer les documents/consignes d'une troupe
 * - Admin : peut uploader et supprimer
 * - Membre : lecture seule
 */
export function TroupeDocuments({ troupeId, userId, troupeName }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [troupeId, userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [docs, adminStatus] = await Promise.all([
        fetchTroupeDocuments(troupeId),
        isUserTroupeAdmin(troupeId, userId)
      ]);
      setDocuments(docs);
      setIsAdmin(adminStatus);
    } catch (err) {
      console.error('Error loading troupe documents:', err);
    }
    setLoading(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!docTitle) {
        setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setError(null);
    
    try {
      await uploadTroupeDocument(selectedFile, troupeId, userId, docTitle || selectedFile.name);
      setSuccess('Document ajouté !');
      setShowUploadForm(false);
      setSelectedFile(null);
      setDocTitle('');
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erreur: ' + err.message);
    }
    setUploading(false);
  };

  const handleDelete = async (doc) => {
    if (!confirm(`Supprimer "${doc.title}" ?`)) return;
    
    try {
      await deleteTroupeDocument(doc.id, doc.file_path);
      loadData();
    } catch (err) {
      setError('Erreur suppression: ' + err.message);
    }
  };

  const openDocument = (doc) => {
    const url = getFileUrl(doc.file_path);
    window.open(url, '_blank');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type) => {
    if (type?.includes('pdf')) return '📕';
    if (type?.includes('word') || type?.includes('document')) return '📘';
    if (type?.includes('image')) return '🖼️';
    if (type?.includes('text')) return '📄';
    return '📎';
  };

  if (loading) {
    return <div className="text-center py-4 text-gray-500">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          📋 Consignes - {troupeName}
        </h3>
        {isAdmin && (
          <span className="text-xs bg-gold-500 text-dark px-2 py-1 rounded-full font-bold">
            Admin
          </span>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-500/20 border border-green-500 rounded-lg text-green-400 text-sm">
          {success}
        </div>
      )}

      {/* Bouton ajouter (admin only) */}
      {isAdmin && !showUploadForm && (
        <button
          onClick={() => setShowUploadForm(true)}
          className="w-full py-3 border-2 border-dashed border-gray-600 rounded-xl
                     text-gray-400 hover:border-gold-500 hover:text-gold-500 transition"
        >
          + Ajouter une consigne
        </button>
      )}

      {/* Formulaire upload */}
      {showUploadForm && (
        <div className="p-4 bg-gray-800 rounded-xl border border-gray-600">
          <h4 className="font-semibold text-white mb-3">Nouvelle consigne</h4>
          
          <input
            type="text"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            placeholder="Titre du document"
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white mb-3"
          />
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 bg-gray-700 border border-gray-600 rounded-lg 
                       text-gray-300 hover:bg-gray-600 transition mb-3"
          >
            {selectedFile ? `📎 ${selectedFile.name}` : '📁 Choisir un fichier'}
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowUploadForm(false);
                setSelectedFile(null);
                setDocTitle('');
              }}
              className="flex-1 py-2 bg-gray-700 text-gray-300 rounded-lg"
            >
              Annuler
            </button>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="flex-1 py-2 bg-gold-500 text-dark rounded-lg font-semibold 
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? '⏳...' : '📤 Uploader'}
            </button>
          </div>
        </div>
      )}

      {/* Liste des documents */}
      {documents.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-4xl mb-2">📋</p>
          <p className="text-gray-500">Aucune consigne pour le moment</p>
          {!isAdmin && (
            <p className="text-gray-600 text-sm mt-1">
              Le metteur en scène ajoutera les documents ici
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="p-4 bg-gray-800 rounded-xl border border-gray-700 
                         hover:border-primary-500 transition"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getFileIcon(doc.file_type)}</span>
                
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => openDocument(doc)}
                >
                  <h4 className="font-semibold text-white">{doc.title}</h4>
                  <p className="text-gray-500 text-xs">
                    {formatFileSize(doc.file_size)} • 
                    {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => openDocument(doc)}
                    className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-500"
                    title="Ouvrir"
                  >
                    👁️
                  </button>
                  
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(doc)}
                      className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info pour les membres */}
      {!isAdmin && documents.length > 0 && (
        <p className="text-xs text-gray-500 text-center">
          📖 Documents en lecture seule
        </p>
      )}
    </div>
  );
}

export default TroupeDocuments;
