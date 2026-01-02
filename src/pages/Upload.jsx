import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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

function Upload() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createScript, addCharacter, addReplicas } = useScriptStore();

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
   */
  const extractText = async (file, onProgress) => {
    const extension = file.name.toLowerCase().split('.').pop();
    
    if (extension === 'pdf') {
      return await extractTextFromPDF(file, onProgress);
    } else if (extension === 'docx' || extension === 'doc') {
      return await extractTextFromWord(file, onProgress);
    } else if (extension === 'txt') {
      onProgress(0.5);
      const text = await extractTextFromTxt(file);
      onProgress(1);
      return text;
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

      const text = await extractText(file, (extractProgress) => {
        setProgress({
          step: extension === 'pdf' ? `OCR en cours...` : `Lecture du fichier...`,
          percent: basePercent + filePercent * 0.2 + extractProgress * filePercent * 0.3,
        });
      });

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
                  {successCount}
                </p>
                <p className="text-green-400 text-sm">
                  Réussi{successCount > 1 ? "s" : ""}
                </p>
              </div>
              {errorCount > 0 && (
                <div className="flex-1 text-center p-3 bg-red-500/10 rounded-lg">
                  <p className="text-3xl font-bold text-red-500">
                    {errorCount}
                  </p>
                  <p className="text-red-400 text-sm">
                    Erreur{errorCount > 1 ? "s" : ""}
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
                className={`p-3 rounded-lg flex items-center gap-3 ${
                  result.success ? "bg-green-500/10" : "bg-red-500/10"
                }`}
              >
                <span className="text-xl">{result.success ? "✅" : "❌"}</span>
                <div className="flex-1">
                  <p
                    className={`font-medium flex items-center gap-2 ${
                      result.success ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    <span>{getFileIcon(result.filename)}</span>
                    {result.title || result.filename}
                  </p>
                  {result.success ? (
                    <p className="text-gray-500 text-sm">
                      {result.charactersCount} personnage
                      {result.charactersCount > 1 ? "s" : ""} •{" "}
                      {result.replicasCount} réplique
                      {result.replicasCount > 1 ? "s" : ""}
                    </p>
                  ) : (
                    <p className="text-red-400 text-sm">{result.error}</p>
                  )}
                </div>
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
