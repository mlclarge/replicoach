import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { useAuthStore } from "../store/authStore";
import { useScriptStore } from "../store/scriptStore";
import { uploadFile } from "../lib/supabase";
import { extractTextFromPDF } from "../lib/pdfProcessor";
import { extractTextFromWord, isWordDocument, isTextFile, extractTextFromTxt } from "../lib/docProcessor";
import { parseScript } from "../lib/scriptParser";
import Loader from "../components/ui/Loader";

// Types de fichiers acceptés
const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
};

// Extensions supportées pour l'affichage
const SUPPORTED_EXTENSIONS = "PDF, Word (.doc, .docx), TXT";

// Liste des emails autorisés à uploader (metteur en scène / développeur)
const ADMIN_EMAILS = [
  'moz2611@gmail.com',
  // Ajouter d'autres emails d'admins ici
];

function Upload() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createScript, addCharacter, addReplicas } = useScriptStore();

  // Vérifier si l'utilisateur est admin
  const isAdmin = user && ADMIN_EMAILS.includes(user.email?.toLowerCase());

  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [currentFileName, setCurrentFileName] = useState("");
  const [progress, setProgress] = useState({ step: "", percent: 0 });
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFiles(acceptedFiles);
      setError(null);
      setResults([]);
      setShowResults(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxFiles: 50,
    maxSize: 50 * 1024 * 1024,
  });

  /**
   * Extrait le texte selon le type de fichier
   * Retourne { text, confidence, usedOCR, quality, warning }
   */
  const extractText = async (file, onProgress) => {
    const extension = file.name.toLowerCase().split('.').pop();
    
    if (extension === 'pdf') {
      // extractTextFromPDF retourne maintenant un objet avec métadonnées
      return await extractTextFromPDF(file, onProgress);
    } else if (extension === 'docx' || extension === 'doc') {
      const text = await extractTextFromWord(file, onProgress);
      return { text, confidence: 100, usedOCR: false, quality: 'good', warning: null };
    } else if (extension === 'txt') {
      onProgress(0.5);
      const text = await extractTextFromTxt(file);
      onProgress(1);
      return { text, confidence: 100, usedOCR: false, quality: 'good', warning: null };
    } else {
      throw new Error(`Format non supporté: .${extension}`);
    }
  };

  /**
   * Retourne l'icône selon le type de fichier
   */
  const getFileIcon = (filename) => {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf': return '📕';
      case 'doc':
      case 'docx': return '📘';
      case 'txt': return '📄';
      default: return '📁';
    }
  };

  const processOneFile = async (file, fileIndex, totalFiles) => {
    const result = {
      filename: file.name,
      success: false,
      error: null,
      title: "",
      warning: null,
      quality: null,
      usedOCR: false,
      confidence: null,
    };

    try {
      setCurrentFileName(file.name);
      const extension = file.name.toLowerCase().split('.').pop();

      // Étape 1: Extraction du texte
      const basePercent = (fileIndex / totalFiles) * 100;
      const filePercent = 100 / totalFiles;

      setProgress({
        step: `Extraction du texte (${extension.toUpperCase()})...`,
        percent: basePercent + filePercent * 0.2,
      });

      const extraction = await extractText(file, (extractProgress) => {
        setProgress({
          step: extension === 'pdf' ? `OCR en cours...` : `Lecture du fichier...`,
          percent: basePercent + filePercent * 0.2 + extractProgress * filePercent * 0.3,
        });
      });

      // Récupérer le texte et les métadonnées de qualité
      const text = extraction.text;
      result.warning = extraction.warning;
      result.quality = extraction.quality;
      result.usedOCR = extraction.usedOCR;
      result.confidence = extraction.confidence;

      if (!text || text.trim().length === 0) {
        throw new Error("Aucun texte extrait");
      }

      setProgress({
        step: "Analyse du script...",
        percent: basePercent + filePercent * 0.5,
      });
      const { title, characters, replicas } = parseScript(text, file.name);
      result.title = title;

      setProgress({
        step: "Upload du fichier...",
        percent: basePercent + filePercent * 0.6,
      });
      const filePath = await uploadFile(file, user.id);

      setProgress({
        step: "Sauvegarde...",
        percent: basePercent + filePercent * 0.7,
      });
      const script = await createScript({
        user_id: user.id,
        title: title,
        full_text: text,
        original_filename: file.name,
        pdf_url: filePath, // Garde le même nom de champ pour compatibilité
      });

      setProgress({
        step: "Création des personnages...",
        percent: basePercent + filePercent * 0.8,
      });
      const characterMap = {};

      for (const char of characters) {
        const created = await addCharacter(script.id, {
          name: char.name,
          color: char.color,
        });
        characterMap[char.name] = created.id;
      }

      setProgress({
        step: "Création des répliques...",
        percent: basePercent + filePercent * 0.9,
      });

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

      result.success = true;
      result.charactersCount = characters.length;
      result.replicasCount = replicas.length;
    } catch (err) {
      console.error(`Error processing ${file.name}:`, err);
      result.error = err.message;
    }

    return result;
  };

  const handleProcess = async () => {
    if (files.length === 0 || !user) return;

    setProcessing(true);
    setError(null);
    setResults([]);
    setCurrentFileIndex(0);

    const allResults = [];

    for (let i = 0; i < files.length; i++) {
      setCurrentFileIndex(i + 1);
      const result = await processOneFile(files[i], i, files.length);
      allResults.push(result);
    }

    setProgress({ step: "Terminé !", percent: 100 });
    setResults(allResults);
    setShowResults(true);
    setProcessing(false);
  };

  const handleReset = () => {
    setFiles([]);
    setResults([]);
    setShowResults(false);
    setError(null);
  };

  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;
  const warningCount = results.filter((r) => r.success && r.warning).length;

  // Page d'accès refusé pour les non-admins
  if (!isAdmin) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="text-center py-12">
          <p className="text-6xl mb-4">🔒</p>
          <h1 className="text-2xl font-display text-gold-500 mb-4">
            Accès réservé
          </h1>
          <p className="text-gray-400 mb-2">
            L'importation de textes est réservée au metteur en scène.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Demandez à votre metteur en scène d'importer les textes, <br />
            puis de les partager avec vous via une troupe.
          </p>
          
          <div className="bg-gray-800/50 rounded-xl p-4 mb-6 max-w-sm mx-auto">
            <p className="text-gray-400 text-sm mb-2">💡 Comment ça marche ?</p>
            <ol className="text-left text-gray-500 text-sm space-y-2">
              <li>1. Le metteur en scène importe les textes</li>
              <li>2. Il crée une troupe et vous invite</li>
              <li>3. Il partage les textes avec la troupe</li>
              <li>4. Vous recevez les textes dans "Partagés"</li>
            </ol>
          </div>
          
          <Link to="/shared" className="btn-gold inline-block">
            👥 Voir les textes partagés
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-display text-gold-500 mb-6">
        📄 Importer des textes
      </h1>

      {/* Zone de drop */}
      {!processing && !showResults && (
        <>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${
                isDragActive
                  ? "border-gold-500 bg-gold-500/10"
                  : "border-gray-600 hover:border-primary-500"
              }
              ${files.length > 0 ? "border-green-500 bg-green-500/10" : ""}
            `}
          >
            <input {...getInputProps()} />

            {files.length > 0 ? (
              <div>
                <p className="text-4xl mb-3">✅</p>
                <p className="text-white font-semibold">
                  {files.length} fichier{files.length > 1 ? "s" : ""}{" "}
                  sélectionné{files.length > 1 ? "s" : ""}
                </p>
                <div className="mt-3 max-h-40 overflow-y-auto">
                  {files.map((file, index) => (
                    <p key={index} className="text-gray-400 text-sm flex items-center justify-center gap-2">
                      <span>{getFileIcon(file.name)}</span>
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  ))}
                </div>
                <p className="text-primary-400 text-sm mt-3">
                  Cliquez pour modifier la sélection
                </p>
              </div>
            ) : (
              <div>
                <p className="text-5xl mb-4">📄</p>
                <p className="text-gray-300 font-semibold">
                  {isDragActive
                    ? "Déposez les fichiers ici..."
                    : "Glissez vos fichiers ici"}
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  ou cliquez pour sélectionner
                </p>
                {/* Formats supportés */}
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">📕 PDF</span>
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">📘 Word</span>
                  <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">📄 TXT</span>
                </div>
                <p className="text-gold-500 text-sm mt-3">
                  📚 Jusqu'à 50 fichiers en une fois !
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {files.length > 0 && (
            <div className="mt-6 flex gap-3">
              <button onClick={handleReset} className="btn-secondary flex-1">
                ✕ Annuler
              </button>
              <button onClick={handleProcess} className="btn-gold flex-1">
                🚀 Importer {files.length} fichier{files.length > 1 ? "s" : ""}
              </button>
            </div>
          )}
        </>
      )}

      {/* Progression */}
      {processing && (
        <div className="text-center py-8">
          <Loader size="lg" text="" />
          <p className="text-white font-semibold mt-4">
            Fichier {currentFileIndex} / {files.length}
          </p>
          <p className="text-gold-500 text-sm mt-1 flex items-center justify-center gap-2">
            <span>{getFileIcon(currentFileName)}</span>
            {currentFileName}
          </p>
          <p className="text-gray-400 mt-2">{progress.step}</p>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-4">
            <div
              className="bg-gold-500 h-2 rounded-full transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="text-gray-500 text-sm mt-2">
            {Math.round(progress.percent)}%
          </p>
        </div>
      )}

      {/* Résultats */}
      {showResults && (
        <div>
          {/* Résumé */}
          <div className="card mb-4">
            <h2 className="text-lg font-semibold text-white mb-3">
              📊 Résumé de l'import
            </h2>
            <div className="flex gap-4">
              <div className="flex-1 text-center p-3 bg-green-500/10 rounded-lg">
                <p className="text-3xl font-bold text-green-500">
                  {successCount - warningCount}
                </p>
                <p className="text-green-400 text-sm">
                  ✅ Parfait{(successCount - warningCount) > 1 ? "s" : ""}
                </p>
              </div>
              {warningCount > 0 && (
                <div className="flex-1 text-center p-3 bg-yellow-500/10 rounded-lg">
                  <p className="text-3xl font-bold text-yellow-500">
                    {warningCount}
                  </p>
                  <p className="text-yellow-400 text-sm">
                    ⚠️ À vérifier
                  </p>
                </div>
              )}
              {errorCount > 0 && (
                <div className="flex-1 text-center p-3 bg-red-500/10 rounded-lg">
                  <p className="text-3xl font-bold text-red-500">
                    {errorCount}
                  </p>
                  <p className="text-red-400 text-sm">
                    ❌ Erreur{errorCount > 1 ? "s" : ""}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Détails */}
          <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  !result.success 
                    ? "bg-red-500/10" 
                    : result.warning 
                      ? "bg-yellow-500/10" 
                      : "bg-green-500/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {!result.success ? "❌" : result.warning ? "⚠️" : "✅"}
                  </span>
                  <div className="flex-1">
                    <p
                      className={`font-medium flex items-center gap-2 ${
                        !result.success 
                          ? "text-red-400" 
                          : result.warning 
                            ? "text-yellow-400" 
                            : "text-green-400"
                      }`}
                    >
                      <span>{getFileIcon(result.filename)}</span>
                      {result.title || result.filename}
                      {result.usedOCR && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                          OCR
                        </span>
                      )}
                    </p>
                    {result.success ? (
                      <p className="text-gray-500 text-sm">
                        {result.charactersCount} personnage
                        {result.charactersCount > 1 ? "s" : ""} •{" "}
                        {result.replicasCount} réplique
                        {result.replicasCount > 1 ? "s" : ""}
                        {result.confidence !== null && result.usedOCR && (
                          <span className={`ml-2 ${
                            result.confidence >= 70 ? 'text-green-500' :
                            result.confidence >= 50 ? 'text-yellow-500' : 'text-red-500'
                          }`}>
                            • Confiance: {result.confidence}%
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-red-400 text-sm">{result.error}</p>
                    )}
                  </div>
                </div>
                {/* Warning OCR */}
                {result.success && result.warning && (
                  <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-sm whitespace-pre-line">
                    {result.warning}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={handleReset} className="btn-secondary flex-1">
              📄 Importer d'autres fichiers
            </button>
            <button onClick={() => navigate("/")} className="btn-gold flex-1">
              🏠 Voir mes textes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Upload;
