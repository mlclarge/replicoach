import { useState, useEffect, useRef } from "react";
import {
  savePublicDocumentAsScript,
  getFileUrl,
  hasUserCopiedPublicDoc,
  copyPublicAudioToPersonal,
  hasUserCopiedPublicAudio,
} from "../lib/supabase";
import { useAuthStore } from "../store/authStore";
import { useScriptStore } from "../store/scriptStore";
import {
  fetchPublicDocuments,
  uploadPublicDocument,
  getPublicDocumentUrl,
  deletePublicDocument,
  fetchUserTroupes,
} from "../lib/supabase";
import { extractTextFromPDF } from "../lib/pdfProcessor";
import { parseScript } from "../lib/scriptParser";
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
    { id: "audio", label: "Audios", icon: "🎵" },
  ];

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case "pdf":
        return "📕";
      case "image":
        return "🖼️";
      case "txt":
        return "📝";
      case "audio":
        return "🎵";
      default:
        return "📄";
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
              {documents.length} document{documents.length > 1 ? "s" : ""}{" "}
              disponible{documents.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <span
          className={`text-gray-400 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>

      {/* Contenu déplié */}
      {expanded && (
        <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
          {/* Message d'aide permanent - uniquement si l'utilisateur est connecté */}
          {user?.id && (
            <div className="mb-4 p-3 bg-primary-900/30 border border-primary-700/50 rounded-lg flex items-center gap-2">
              <span className="text-xl">💡</span>
              <p className="text-primary-300 text-xs">
                Les <span className="font-bold">📜 Scripts</span> et{" "}
                <span className="font-bold">🎵 Audios</span> peuvent être copiés
                dans votre espace personnel.
              </p>
            </div>
          )}

          {/* Filtres par catégorie */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.id || "all"}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition font-medium flex items-center gap-1
                  ${
                    selectedCategory === cat.id
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
              <p className="text-gray-500 text-sm">
                Aucun document pour le moment
              </p>
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
                      window.open(url, "_blank");
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
      const result = await uploadPublicDocument(
        file,
        { title, description, category },
        userId
      );
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
          <h3 className="text-xl font-bold text-green-400 mb-2">
            Document ajouté !
          </h3>
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
          <h3 className="text-lg font-semibold text-white">
            📤 Proposer un document
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2"
          >
            ✕
          </button>
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
                ${
                  file
                    ? "border-green-500 bg-green-500/10"
                    : "border-gray-600 hover:border-primary-500 bg-gray-800/50"
                }`}
            >
              {file ? (
                <div>
                  <span className="text-3xl block mb-2">✅</span>
                  <p className="text-green-400 font-medium">{file.name}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-primary-400 text-sm mt-2">
                    Toucher pour changer
                  </p>
                </div>
              ) : (
                <div>
                  <span className="text-3xl block mb-2">📄</span>
                  <p className="text-gray-300">Toucher pour sélectionner</p>
                  <p className="text-gray-500 text-xs mt-1">PDF, TXT, Images, Audio (MP3, WAV...)</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.png,.jpg,.jpeg,.mp3,.wav,.m4a,.ogg,.flac,audio/*"
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
            <label className="block text-sm text-gray-400 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input w-full h-20 resize-none"
              placeholder="Décrivez brièvement ce document..."
            />
          </div>

          {/* Catégorie */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Catégorie
            </label>
            <div className="flex gap-2 flex-wrap">
              {[
                { id: "script", label: "Script", icon: "📜" },
                { id: "guide", label: "Guide", icon: "📖" },
                { id: "exercice", label: "Exercice", icon: "🎯" },
                { id: "audio", label: "Audio", icon: "🎵" },
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

          {error && <p className="text-red-400 text-sm">{error}</p>}

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
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [alreadyCopied, setAlreadyCopied] = useState(false);

  // Accès au store pour créer personnages, répliques et rafraîchir la liste
  const { addCharacter, addReplicas, fetchScripts } = useScriptStore();

  const isAudio = doc.category === "audio" || doc.file_type === "audio";

  // Vérifier si le document a déjà été copié par cet utilisateur
  useEffect(() => {
    const checkIfCopied = async () => {
      if (userId && doc.id) {
        if (doc.category === "script") {
          const copied = await hasUserCopiedPublicDoc(doc.id, userId);
          setAlreadyCopied(copied);
        } else if (isAudio) {
          const copied = await hasUserCopiedPublicAudio(doc.id, userId);
          setAlreadyCopied(copied);
        }
      }
    };
    checkIfCopied();
  }, [userId, doc.id, doc.category, saveSuccess, isAudio]);

  // Fonction pour copier un audio public vers les audios personnels
  const handleSaveAudioToPersonal = async () => {
    if (!userId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await copyPublicAudioToPersonal(doc, userId);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.message || "Erreur lors de l'import");
    } finally {
      setSaving(false);
    }
  };

  // Fonction pour copier le document et parser le PDF en répliques
  const handleSaveToMyTexts = async () => {
    if (!userId) return;
    setSaving(true);
    setSaveError(null);
    try {
      // 1. Appel API serveur pour copier le fichier
      const res = await fetch("/api/copy-public-to-private", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePath: doc.file_path,
          fileName: doc.file_name,
          userId: userId,
        }),
      });
      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error("Erreur serveur: réponse invalide");
      }
      if (!res.ok) {
        throw new Error(
          data?.error || data?.message || JSON.stringify(data) || "Erreur API"
        );
      }
      const newPath = data.newPath;

      // 2. Créer le script personnel dans Supabase (table scripts)
      const script = await savePublicDocumentAsScript(
        { ...doc, file_path: newPath },
        userId
      );

      // 3. Si c'est un PDF, le parser pour extraire personnages et répliques
      if (doc.file_type === "pdf" && script?.id) {
        try {
          // Télécharger le PDF copié
          const pdfUrl = getFileUrl(newPath);
          if (pdfUrl) {
            const pdfResponse = await fetch(pdfUrl);
            const pdfBlob = await pdfResponse.blob();
            const pdfFile = new File(
              [pdfBlob],
              doc.file_name || "document.pdf",
              { type: "application/pdf" }
            );

            // Extraire le texte du PDF
            const extraction = await extractTextFromPDF(pdfFile, () => {});
            const text = extraction?.text || "";

            if (text && text.trim().length > 50) {
              // Parser le script
              const { characters, replicas } = parseScript(
                text,
                doc.file_name || ""
              );

              // Créer les personnages
              const characterMap = {};
              for (const char of characters) {
                const created = await addCharacter(script.id, {
                  name: char.name,
                  color: char.color,
                });
                characterMap[char.name] = created.id;
              }

              // Créer les répliques
              const replicasToInsert = replicas.map((rep, index) => ({
                script_id: script.id,
                character_id: characterMap[rep.character],
                order_index: index,
                text: rep.text,
                text_gaps: rep.textGaps,
                cue_words: rep.cueWords,
              }));

              if (replicasToInsert.length > 0) {
                await addReplicas(replicasToInsert);
              }
            }
          }
        } catch (parseErr) {
          console.warn("Parsing PDF optionnel échoué:", parseErr);
          // Ne pas bloquer l'import si le parsing échoue
        }
      }

      // 4. Rafraîchir la liste des scripts pour afficher le nouveau texte
      await fetchScripts(userId);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  // Vérifier si le document est récent (moins de 48h)
  const isNew =
    doc.created_at &&
    Date.now() - new Date(doc.created_at).getTime() < 48 * 60 * 60 * 1000;

  // URL du fichier audio pour le player
  const audioUrl = isAudio ? getPublicDocumentUrl(doc.file_path) : null;

  return (
    <div className={`p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition group ${isAudio ? 'flex flex-col gap-2' : 'flex items-center gap-3'}`}>
      <div
        className={`flex items-center gap-3 ${isAudio ? '' : 'flex-1 min-w-0 cursor-pointer'}`}
        onClick={isAudio ? undefined : onView}
      >
        <span className="text-xl">{getFileIcon(doc.file_type)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white text-sm font-medium truncate">
              {doc.title}
            </p>
            {/* Badge "Nouveau" pour les documents récents */}
            {isNew && (
              <span className="px-1.5 py-0.5 bg-amber-500 text-black text-[10px] font-bold rounded animate-pulse">
                NEW
              </span>
            )}
          </div>
          {doc.description && (
            <p className="text-gray-500 text-xs truncate">{doc.description}</p>
          )}
          {/* Badge "Déjà dans Mes textes/audios" */}
          {alreadyCopied && (doc.category === "script" || isAudio) && (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-green-900/50 text-green-400 text-xs rounded-full">
              ✓ {isAudio ? 'Dans Mes audios' : 'Dans Mes textes'}
            </span>
          )}
        </div>
        
        {/* Boutons d'action (pour non-audio) */}
        {!isAudio && (
          <div className="flex items-center gap-2">
            <button
              onClick={onView}
              className="p-2 text-gray-400 hover:text-primary-400 hover:bg-gray-700 rounded-lg transition"
              title="Ouvrir le document"
            >
              👁️
            </button>
            {/* Bouton Ajouter à Mes textes - uniquement pour les scripts non encore copiés */}
            {!isOwner &&
              userId &&
              !saveSuccess &&
              !alreadyCopied &&
              doc.category === "script" && (
                <button
                  onClick={handleSaveToMyTexts}
                  className="px-3 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition flex items-center gap-2 shadow"
                  title="Copier ce texte dans votre espace Mes textes"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span className="text-xs font-semibold">
                        Import en cours...
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg">📜</span>
                      <span className="text-xs font-semibold">
                        Ajouter à Mes textes
                      </span>
                    </>
                  )}
                </button>
              )}
            {saveSuccess && doc.category === "script" && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-900/50 border border-green-500/50 rounded-lg animate-pulse">
                <span className="text-lg">✅</span>
                <div className="text-xs">
                  <p className="text-green-400 font-bold">
                    Texte importé avec succès !
                  </p>
                  <p className="text-green-300">Disponible dans « Mes Textes »</p>
                </div>
              </div>
            )}
            {isOwner && (
              <button
                onClick={onDelete}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                title="Supprimer"
              >
                🗑️
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Player audio et bouton d'import pour les audios */}
      {isAudio && (
        <div className="flex items-center gap-2 mt-1">
          <audio
            controls
            src={audioUrl}
            className="flex-1 h-10"
            style={{ minWidth: 0 }}
          />
          {!isOwner && userId && !saveSuccess && !alreadyCopied && (
            <button
              onClick={handleSaveAudioToPersonal}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition flex items-center gap-2 shadow whitespace-nowrap"
              title="Ajouter à Mes audios"
              disabled={saving}
            >
              {saving ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <>
                  <span>🎵</span>
                  <span className="text-xs font-semibold">Ajouter</span>
                </>
              )}
            </button>
          )}
          {saveSuccess && isAudio && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-900/50 border border-green-500/50 rounded-lg">
              <span>✅</span>
              <span className="text-green-400 text-xs font-bold">Importé !</span>
            </div>
          )}
          {isOwner && (
            <button
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
              title="Supprimer"
            >
              🗑️
            </button>
          )}
        </div>
      )}
      
      {saveError && (
        <div className="text-xs text-red-400">{saveError}</div>
      )}
    </div>
  );
}

export default PublicLibrary;
