import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { useAuthStore } from "../store/authStore";
import { useScriptStore } from "../store/scriptStore";
import { uploadFile } from "../lib/supabase";
import { extractTextFromFile } from "../lib/pdfProcessor";
import { parseScript } from "../lib/scriptParser";
import Loader from "../components/ui/Loader";

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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      console.log("All dropped files:", acceptedFiles);
      const validFiles = acceptedFiles.filter((file) => {
        const ext = file.name.split(".").pop().toLowerCase();
        return ["pdf", "txt"].includes(ext);
      });
      console.log("Valid files:", validFiles);
      if (validFiles.length > 0) {
        setFiles(validFiles);
        setError(null);
        setResults([]);
        setShowResults(false);
      } else if (acceptedFiles.length > 0) {
        setError("Seuls les fichiers PDF et TXT sont acceptés");
      }
    },
    maxFiles: 50,
    maxSize: 50 * 1024 * 1024,
    accept: undefined,
    useFsAccessApi: false,
  });

  const processOneFile = async (file, fileIndex, totalFiles) => {
    const result = {
      filename: file.name,
      success: false,
      error: null,
      title: "",
    };

    try {
      setCurrentFileName(file.name);
      const fileExtension = file.name.split(".").pop().toLowerCase();
      const isTextFile = fileExtension === "txt";

      const basePercent = (fileIndex / totalFiles) * 100;
      const filePercent = 100 / totalFiles;

      setProgress({
        step: isTextFile ? "Lecture du fichier texte..." : "Extraction du texte...",
        percent: basePercent + filePercent * 0.2,
      });

      const text = await extractTextFromFile(file, (ocrProgress) => {
        setProgress({
          step: "OCR en cours...",
          percent: basePercent + filePercent * 0.2 + ocrProgress * filePercent * 0.3,
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
        pdf_url: filePath,
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

  const handleManualSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    console.log("Manual selection:", selectedFiles);

    const validFiles = selectedFiles.filter((file) => {
      const ext = file.name.split(".").pop().toLowerCase();
      return ["pdf", "txt"].includes(ext);
    });

    if (validFiles.length > 0) {
      setFiles(validFiles);
      setError(null);
      setResults([]);
      setShowResults(false);
    }
  };

  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;

  const pdfCount = files.filter((f) => f.name.toLowerCase().endsWith(".pdf")).length;
  const txtCount = files.filter((f) => f.name.toLowerCase().endsWith(".txt")).length;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-display text-gold-500 mb-6">
        📄 Importer des textes
      </h1>

      {!processing && !showResults && (
        <>
          {/* Zone de drop */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${isDragActive ? "border-gold-500 bg-gold-500/10" : "border-gray-600 hover:border-primary-500"}
              ${files.length > 0 ? "border-green-500 bg-green-500/10" : ""}
            `}
          >
            <input {...getInputProps()} />

            {files.length > 0 ? (
              <div>
                <p className="text-4xl mb-3">✅</p>
                <p className="text-white font-semibold">
                  {files.length} fichier{files.length > 1 ? "s" : ""} sélectionné{files.length > 1 ? "s" : ""}
                </p>
                {(pdfCount > 0 || txtCount > 0) && (
                  <p className="text-gray-400 text-sm mt-1">
                    {pdfCount > 0 && `${pdfCount} PDF`}
                    {pdfCount > 0 && txtCount > 0 && " • "}
                    {txtCount > 0 && `${txtCount} TXT`}
                  </p>
                )}
                <div className="mt-3 max-h-40 overflow-y-auto">
                  {files.map((file, index) => (
                    <p key={index} className="text-gray-400 text-sm flex items-center justify-center gap-2">
                      <span>{file.name.toLowerCase().endsWith(".txt") ? "📝" : "📄"}</span>
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  ))}
                </div>
                <p className="text-primary-400 text-sm mt-3">Cliquez pour modifier la sélection</p>
              </div>
            ) : (
              <div>
                <p className="text-5xl mb-4">📄</p>
                <p className="text-gray-300 font-semibold">
                  {isDragActive ? "Déposez les fichiers ici..." : "Glissez vos fichiers ici"}
                </p>
                <p className="text-gray-500 text-sm mt-2">ou cliquez pour sélectionner</p>
                <div className="flex justify-center gap-4 mt-4">
                  <span className="text-sm px-3 py-1 bg-gray-700 rounded-full text-gray-300">📄 PDF</span>
                  <span className="text-sm px-3 py-1 bg-gray-700 rounded-full text-gray-300">📝 TXT</span>
                </div>
                <p className="text-gold-500 text-sm mt-3">📚 Jusqu'à 50 fichiers en une fois !</p>
              </div>
            )}
          </div>

          {/* Bouton alternatif */}
          <div className="mt-4 text-center">
            <label className="inline-block cursor-pointer px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full font-semibold">
              📁 Sélectionner manuellement
              <input
                type="file"
                multiple
                accept=".pdf,.txt"
                style={{ display: "none" }}
                onChange={handleManualSelect}
              />
            </label>
          </div>

          {/* Info fichiers texte */}
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-400 text-sm">
              💡 <strong>Astuce :</strong> Les fichiers .txt sont recommandés pour les scripts scannés
              qui ne sont pas reconnus correctement en PDF.
            </p>
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

      {processing && (
        <div className="text-center py-8">
          <Loader size="lg" text="" />
          <p className="text-white font-semibold mt-4">
            Fichier {currentFileIndex} / {files.length}
          </p>
          <p className="text-gold-500 text-sm mt-1">{currentFileName}</p>
          <p className="text-gray-400 mt-2">{progress.step}</p>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-4">
            <div
              className="bg-gold-500 h-2 rounded-full transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="text-gray-500 text-sm mt-2">{Math.round(progress.percent)}%</p>
        </div>
      )}

      {showResults && (
        <div>
          <div className="card mb-4">
            <h2 className="text-lg font-semibold text-white mb-3">📊 Résumé de l'import</h2>
            <div className="flex gap-4">
              <div className="flex-1 text-center p-3 bg-green-500/10 rounded-lg">
                <p className="text-3xl font-bold text-green-500">{successCount}</p>
                <p className="text-green-400 text-sm">Réussi{successCount > 1 ? "s" : ""}</p>
              </div>
              {errorCount > 0 && (
                <div className="flex-1 text-center p-3 bg-red-500/10 rounded-lg">
                  <p className="text-3xl font-bold text-red-500">{errorCount}</p>
                  <p className="text-red-400 text-sm">Erreur{errorCount > 1 ? "s" : ""}</p>
                </div>
              )}
            </div>
          </div>

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
                  <p className={`font-medium ${result.success ? "text-green-400" : "text-red-400"}`}>
                    {result.title || result.filename}
                  </p>
                  {result.success ? (
                    <p className="text-gray-500 text-sm">
                      {result.charactersCount} personnage{result.charactersCount > 1 ? "s" : ""} •{" "}
                      {result.replicasCount} réplique{result.replicasCount > 1 ? "s" : ""}
                    </p>
                  ) : (
                    <p className="text-red-400 text-sm">{result.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

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
