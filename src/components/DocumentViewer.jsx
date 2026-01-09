import { useState, useEffect } from "react";

/**
 * Visionneuse de documents intégrée
 * Affiche PDF, images et texte sans quitter l'application
 */
function DocumentViewer({ document, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  if (!document) return null;

  const { file_name, file_url, file_type } = document;

  // Déterminer le type de contenu
  const isPDF = file_type === "application/pdf" || file_name?.endsWith(".pdf");
  const isImage =
    file_type?.startsWith("image/") ||
    /\.(jpg|jpeg|png|gif|webp)$/i.test(file_name);
  const isText = file_type === "text/plain" || file_name?.endsWith(".txt");
  const isWord =
    file_type?.includes("word") || /\.(doc|docx)$/i.test(file_name);

  const handleLoad = () => setLoading(false);
  const handleError = () => {
    setLoading(false);
    setError("Impossible de charger le document");
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-dark border-b border-gray-700">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold truncate">{file_name}</h3>
          <p className="text-gray-500 text-xs">
            {isPDF
              ? "PDF"
              : isImage
              ? "Image"
              : isText
              ? "Texte"
              : isWord
              ? "Word"
              : "Document"}
          </p>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {/* Bouton télécharger */}
          <a
            href={file_url}
            download={file_name}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
            title="Télécharger"
          >
            📥
          </a>

          {/* Bouton fermer */}
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-auto p-4">
        {loading && !error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin text-4xl mb-2">⏳</div>
              <p className="text-gray-400">Chargement...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <p className="text-5xl mb-4">😕</p>
            <p className="text-red-400 mb-4">{error}</p>
            <a
              href={file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              📥 Ouvrir dans un nouvel onglet
            </a>
          </div>
        )}

        {/* PDF */}
        {isPDF && (
          <iframe
            src={`${file_url}#toolbar=0&navpanes=0`}
            className={`w-full h-full min-h-[70vh] rounded-lg bg-white ${
              loading ? "hidden" : ""
            }`}
            onLoad={handleLoad}
            onError={handleError}
            title={file_name}
          />
        )}

        {/* Image */}
        {isImage && (
          <div
            className={`flex items-center justify-center h-full ${
              loading ? "hidden" : ""
            }`}
          >
            <img
              src={file_url}
              alt={file_name}
              className="max-w-full max-h-full object-contain rounded-lg"
              onLoad={handleLoad}
              onError={handleError}
            />
          </div>
        )}

        {/* Texte - On charge le contenu via fetch */}
        {isText && (
          <TextViewer
            url={file_url}
            onLoad={handleLoad}
            onError={handleError}
          />
        )}

        {/* Word - Afficher un message car non supporté nativement */}
        {isWord && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <p className="text-5xl mb-4">📄</p>
            <p className="text-gray-300 mb-2">{file_name}</p>
            <p className="text-gray-500 mb-6">
              Les fichiers Word ne peuvent pas être prévisualisés directement.
            </p>
            <a href={file_url} download={file_name} className="btn-gold">
              📥 Télécharger le document
            </a>
          </div>
        )}

        {/* Autres types */}
        {!isPDF && !isImage && !isText && !isWord && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <p className="text-5xl mb-4">📎</p>
            <p className="text-gray-300 mb-2">{file_name}</p>
            <p className="text-gray-500 mb-6">
              Ce type de fichier ne peut pas être prévisualisé.
            </p>
            <a href={file_url} download={file_name} className="btn-gold">
              📥 Télécharger
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Composant pour afficher les fichiers texte
 */
function TextViewer({ url, onLoad, onError }) {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Erreur chargement");
        return res.text();
      })
      .then((text) => {
        setContent(text);
        setLoaded(true);
        onLoad();
      })
      .catch(() => {
        onError();
      });
  }, [url]);

  if (!loaded) return null;

  return (
    <div className="bg-gray-900 rounded-lg p-4 h-full overflow-auto">
      <pre className="text-gray-200 whitespace-pre-wrap font-mono text-sm">
        {content}
      </pre>
    </div>
  );
}

export default DocumentViewer;
