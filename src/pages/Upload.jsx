import { useState, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { useAuthStore } from "../store/authStore";
import PremiumGateModal from "../components/PremiumGateModal";
import { useScriptStore } from "../store/scriptStore";
import { uploadFile, supabase, getUserRole } from "../lib/supabase";
import { extractTextFromPDF, hasNativeText } from "../lib/pdfProcessor";
import {
  extractTextFromWord,
  isWordDocument,
  isTextFile,
  extractTextFromTxt,
} from "../lib/docProcessor";
import {
  parseScript,
  CharacterResolver,
  generateGapsText,
  generateCueWords,
  detectGender,
} from "../lib/scriptParser";
import { processWithGemini, warmUpOcrBackend } from "../lib/geminiOcrService";
import { withTimeout } from "../lib/withTimeout";
import Loader from "../components/ui/Loader";

// Le stockage du fichier source est facultatif : on n'attend pas plus longtemps
const UPLOAD_TIMEOUT_MS = 30_000;

// Types de fichiers acceptés
const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "text/plain": [".txt"],
};

// Liste des emails autorisés à uploader en illimité sans abonnement
const ADMIN_EMAILS = ["moz2611@gmail.com", "consulting@mauricelargeron.com"];

function Upload() {
  const navigate = useNavigate();
  const { user, isPremium } = useAuthStore();
  const { scripts, createScript, addCharacter, addReplicas, fetchScripts } =
    useScriptStore();

  const [userRole, setUserRole] = useState("member");

  // Charger le rôle utilisateur et les scripts existants
  useEffect(() => {
    if (user?.id) {
      getUserRole(user.id).then(setUserRole);
      fetchScripts(user.id);
    }
  }, [user, fetchScripts]);

  // Accès illimité si Premium, Dev, Metteur en scène ou Admin
  const isUnlimited =
    isPremium ||
    userRole === "dev" ||
    userRole === "director" ||
    userRole === "admin" ||
    (user?.email && ADMIN_EMAILS.includes(user.email?.toLowerCase()));

  const userScriptsCount = scripts?.length || 0;

  // Onglet actif : 'file' ou 'paste'
  const [activeTab, setActiveTab] = useState("file");

  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [currentFileName, setCurrentFileName] = useState("");
  const [progress, setProgress] = useState({ step: "", percent: 0 });
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  // État pour le texte collé
  const [pastedText, setPastedText] = useState("");
  const [pastedTitle, setPastedTitle] = useState("");

  // Option de scan : 'classic' ou 'premium'
  const [scanMode, setScanMode] = useState("classic");

  // États pour les métadonnées de personnages (V1 Post-OCR)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userCharacters, setUserCharacters] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  // Paywall du Scan Express
  const [showOcrPremiumModal, setShowOcrPremiumModal] = useState(false);
  const [nativeTextHint, setNativeTextHint] = useState(false);

  useEffect(() => {
    if (isPremium) warmUpOcrBackend();
  }, [isPremium]);

  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles;
        setSelectedFile(file);
        setError(null);
        setResults([]);
        setShowResults(false);

        if (scanMode === "premium") {
          if (!isPremium) {
            setShowOcrPremiumModal(true);
            return;
          }

          const ext = file.name.toLowerCase().split(".").pop();
          if (ext !== "pdf") {
            setError(
              "Le scan premium prend uniquement en charge les fichiers PDF pour le moment.",
            );
            return;
          }
          setFiles([file]);
          setNativeTextHint(false);
          hasNativeText(file).then(setNativeTextHint);
          handleProcessPremium(file);
        } else {
          setIsModalOpen(true);
        }
      }
    },
    [scanMode, isPremium],
  );

  const handleCharSubmit = async (e) => {
    e.preventDefault();
    if (!userCharacters.trim() || !selectedFile) return;
    const fileToProcess = selectedFile;

    const referenceList = userCharacters
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    setFiles([fileToProcess]);
    setIsModalOpen(false);

    await handleProcess([fileToProcess], referenceList);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxFiles: 50,
    maxSize: 50 * 1024 * 1024,
  });

  const extractText = async (file, onProgress, referenceList = null) => {
    const extension = file.name.toLowerCase().split(".").pop();

    if (extension === "pdf") {
      return await extractTextFromPDF(file, onProgress, referenceList);
    } else if (extension === "docx" || extension === "doc") {
      const text = await extractTextFromWord(file, onProgress);
      return {
        text,
        confidence: 100,
        usedOCR: false,
        quality: "good",
        warning: null,
      };
    } else if (extension === "txt") {
      onProgress(0.5);
      const text = await extractTextFromTxt(file);
      onProgress(1);
      return {
        text,
        confidence: 100,
        usedOCR: false,
        quality: "good",
        warning: null,
      };
    } else {
      throw new Error(`Format non supporté: .${extension}`);
    }
  };

  const getFileIcon = (filename) => {
    const ext = filename.toLowerCase().split(".").pop();
    switch (ext) {
      case "pdf":
        return "📕";
      case "doc":
      case "docx":
        return "📘";
      case "txt":
        return "📄";
      default:
        return "📁";
    }
  };

  const processOneFile = async (
    file,
    fileIndex,
    totalFiles,
    referenceList = null,
  ) => {
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
      const extension = file.name.toLowerCase().split(".").pop();

      const basePercent = (fileIndex / totalFiles) * 100;
      const filePercent = 100 / totalFiles;

      setProgress({
        step: `Extraction du texte (${extension.toUpperCase()})...`,
        percent: basePercent + filePercent * 0.2,
      });

      const extraction = await extractText(
        file,
        (extractProgress) => {
          setProgress({
            step:
              extension === "pdf" ? `OCR en cours...` : `Lecture du fichier...`,
            percent:
              basePercent +
              filePercent * 0.2 +
              extractProgress * filePercent * 0.3,
          });
        },
        referenceList,
      );

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

      const { title, characters, replicas } = parseScript(
        text,
        file.name,
        referenceList,
      );
      result.title = title;

      setProgress({
        step: "Upload du fichier...",
        percent: basePercent + filePercent * 0.6,
      });
      let filePath = null;
      try {
        filePath = await withTimeout(
          uploadFile(file, user.id),
          UPLOAD_TIMEOUT_MS,
          "Envoi du fichier trop long",
        );
      } catch (storageError) {
        console.warn("Échec d'upload storage ignoré :", storageError);
      }

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

  const handleProcess = async (
    filesToProcess = files,
    referenceList = null,
  ) => {
    if (filesToProcess.length === 0 || !user) return;

    setProcessing(true);
    setError(null);
    setResults([]);
    setCurrentFileIndex(0);

    const allResults = [];

    const refList =
      referenceList ||
      (userCharacters
        ? userCharacters
            .split(",")
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean)
        : null);

    for (let i = 0; i < filesToProcess.length; i++) {
      setCurrentFileIndex(i + 1);
      const result = await processOneFile(
        filesToProcess[i],
        i,
        filesToProcess.length,
        refList,
      );
      allResults.push(result);
    }

    setProgress({ step: "Terminé !", percent: 100 });
    setResults(allResults);
    setShowResults(true);
    setProcessing(false);
  };

  const handleProcessPremium = async (fileToProcess) => {
    if (!fileToProcess || !user) return;

    if (!isPremium) {
      setShowOcrPremiumModal(true);
      return;
    }

    setProcessing(true);
    setError(null);
    setResults([]);
    setCurrentFileIndex(1);
    setCurrentFileName(fileToProcess.name);

    const result = {
      filename: fileToProcess.name,
      success: false,
      error: null,
      title: "",
      warning: null,
      quality: "premium",
      usedOCR: true,
      confidence: null,
    };

    try {
      setProgress({
        step: "Envoi sécurisé du PDF au service OCR...",
        percent: 0,
        indeterminate: true,
      });

      const parsedData = await processWithGemini(fileToProcess, (stage) => {
        setProgress({
          step: "Analyse Premium en cours...",
          percent: 0,
          indeterminate: true,
        });
      });

      result.title = parsedData.title;

      const resolver = new CharacterResolver(
        parsedData.characters.map((c) => c.name),
      );
      const CHARACTER_COLORS = [
        "#8B1538",
        "#2563EB",
        "#059669",
        "#D97706",
        "#7C3AED",
        "#DC2626",
        "#0891B2",
        "#4F46E5",
        "#DB2777",
        "#65A30D",
      ];

      const resolvedCharacters = parsedData.characters.map((char, index) => {
        const resolvedName = resolver.resolve(char.name) || char.name;
        return {
          name: resolvedName,
          color: CHARACTER_COLORS[index % CHARACTER_COLORS.length],
          gender: detectGender(resolvedName, new Map()),
        };
      });

      const resolvedReplicas = parsedData.replicas.map((replica) => {
        const resolvedChar =
          resolver.resolve(replica.character) || replica.character;
        return {
          character: resolvedChar,
          text: replica.text.trim(),
        };
      });

      const enrichedReplicas = resolvedReplicas.map((replica, index) => ({
        ...replica,
        textGaps: generateGapsText(replica.text),
        cueWords: generateCueWords(resolvedReplicas, index),
      }));

      let filePath = null;
      try {
        filePath = await withTimeout(
          uploadFile(fileToProcess, user.id),
          UPLOAD_TIMEOUT_MS,
          "Envoi du fichier trop long",
        );
      } catch (storageError) {
        console.warn("Échec d'upload storage ignoré :", storageError);
      }

      const fullText = enrichedReplicas
        .map((r) => `${r.character} : ${r.text}`)
        .join("\n");

      const script = await createScript({
        user_id: user.id,
        title: parsedData.title,
        full_text: fullText,
        original_filename: fileToProcess.name,
        pdf_url: filePath,
      });

      const characterMap = {};

      for (const char of resolvedCharacters) {
        const created = await addCharacter(script.id, {
          name: char.name,
          color: char.color,
        });
        characterMap[char.name] = created.id;
      }

      const replicasToInsert = enrichedReplicas.map((rep, index) => ({
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
      result.charactersCount = resolvedCharacters.length;
      result.replicasCount = enrichedReplicas.length;

      setProgress({ step: "Terminé !", percent: 100 });
      setResults([result]);
      setShowResults(true);

      fetchScripts(user.id);
    } catch (err) {
      console.error(`Erreur Scan Premium ${fileToProcess.name}:`, err);
      result.error = err.message;
      setResults([result]);
      setShowResults(true);
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessPastedText = async () => {
    if (!pastedText.trim() || !pastedTitle.trim() || !user) return;

    setProcessing(true);
    setError(null);

    try {
      const { title, characters, replicas } = parseScript(
        pastedText,
        pastedTitle,
      );

      const script = await createScript({
        user_id: user.id,
        title: title || pastedTitle,
        full_text: pastedText,
        original_filename: `${pastedTitle}.txt`,
        pdf_url: null,
      });

      const characterMap = {};
      for (const char of characters) {
        const created = await addCharacter(script.id, {
          name: char.name,
          color: char.color,
        });
        characterMap[char.name] = created.id;
      }

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

      setResults([
        {
          filename: pastedTitle,
          title: title || pastedTitle,
          success: true,
          charactersCount: characters.length,
          replicasCount: replicas.length,
        },
      ]);
      setShowResults(true);
      fetchScripts(user.id);
    } catch (err) {
      setError("Erreur lors de l'analyse : " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setResults([]);
    setShowResults(false);
    setError(null);
    setPastedText("");
    setPastedTitle("");
    setActiveTab("file");
    setSelectedFile(null);
    setUserCharacters("");
  };

  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;
  const warningCount = results.filter((r) => r.success && r.warning).length;

  // Contrôle de quota pour les utilisateurs Standard (limite à 2 scripts)
  if (!isUnlimited && userScriptsCount >= 2) {
    return (
      <div className="p-4 max-w-2xl mx-auto text-center py-12">
        <p className="text-6xl mb-4">⚠️</p>
        <h1 className="text-2xl font-display text-gold-500 mb-4">
          Limite atteinte (Mode Standard)
        </h1>
        <p className="text-gray-300 mb-4">
          En mode gratuit, vous pouvez importer jusqu'à{" "}
          <strong>2 textes personnels</strong>.
        </p>
        <p className="text-gray-400 text-sm mb-6">
          Passez au mode <strong>Premium</strong> pour des imports illimités, ou
          rejoignez une <strong>troupe</strong> pour accéder aux textes partagés
          par votre metteur en scène !
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/shared" className="btn-gold">
            👥 Accéder aux Troupes
          </Link>
          <Link to="/" className="btn-secondary">
            🏠 Mes textes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Modale de saisie des personnages */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gold-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <h2 className="text-xl font-display text-gold-500 mb-4 flex items-center gap-2">
              🎭 Personnages de la pièce
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Saisissez la liste officielle des personnages pour nettoyer
              automatiquement les erreurs du scan.
            </p>
            <form onSubmit={handleCharSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  Noms des personnages *
                </label>
                <textarea
                  value={userCharacters}
                  onChange={(e) => setUserCharacters(e.target.value)}
                  placeholder="Ex: JACQUES, LUCIE, JEAN, CORINNE"
                  rows={4}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-gold-500 focus:outline-none transition-colors font-mono text-sm resize-none"
                  required
                  autoFocus
                />
                <p className="text-gray-500 text-xs mt-2 italic">
                  Séparez les noms par des virgules.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary flex-1 py-3 rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!userCharacters.trim()}
                  className="btn-gold flex-1 py-3 rounded-xl font-semibold disabled:opacity-50"
                >
                  Lancer le scan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-display text-gold-500 mb-6">
        📄 Importer des textes
      </h1>

      {/* Onglets */}
      {!processing && !showResults && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("file")}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
              activeTab === "file"
                ? "bg-gold-500 text-black"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            📁 Importer un fichier
          </button>
          <button
            onClick={() => setActiveTab("paste")}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
              activeTab === "paste"
                ? "bg-gold-500 text-black"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            📋 Coller un texte
          </button>
        </div>
      )}

      {/* Zone de drop (onglet fichier) */}
      {!processing && !showResults && activeTab === "file" && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6 p-1.5 bg-gray-800/80 rounded-2xl border border-gray-700/50">
            <button
              type="button"
              onClick={() => setScanMode("classic")}
              className={`flex flex-col items-center justify-center py-3.5 px-4 rounded-xl transition-all ${
                scanMode === "classic"
                  ? "bg-gray-900 border border-gold-500/30 text-white shadow-lg shadow-black/40"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">📕</span>
                <span className="font-semibold text-sm">Scan Classique</span>
              </div>
              <span className="text-[10px] text-gray-500 mt-1">
                Rapide et gratuit • Vous indiquez les personnages
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isPremium) {
                  setShowOcrPremiumModal(true);
                  return;
                }
                setScanMode("premium");
              }}
              className={`flex flex-col items-center justify-center py-3.5 px-4 rounded-xl transition-all ${
                scanMode === "premium"
                  ? "bg-gradient-to-br from-gold-500/10 via-amber-500/5 to-transparent border border-gold-500/50 text-gold-400 shadow-lg shadow-gold-500/5"
                  : "text-gray-400 hover:text-gold-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                <span className="font-semibold text-sm flex items-center gap-1.5">
                  Scan Premium{" "}
                  <span className="bg-gold-500 text-black text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                    Premium IA
                  </span>
                </span>
              </div>
              <span className="text-[10px] text-amber-500/80 mt-1">
                Personnages détectés automatiquement • PDF scannés acceptés
              </span>
            </button>
          </div>

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
                    <p
                      key={index}
                      className="text-gray-400 text-sm flex items-center justify-center gap-2"
                    >
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
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                    📕 PDF
                  </span>
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                    📘 Word
                  </span>
                  <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">
                    📄 TXT
                  </span>
                </div>
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

      {/* Zone de texte collé */}
      {!processing && !showResults && activeTab === "paste" && (
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm mb-2">
              Titre du texte *
            </label>
            <input
              type="text"
              value={pastedTitle}
              onChange={(e) => setPastedTitle(e.target.value)}
              placeholder="Ex: Scène du balcon - Roméo et Juliette"
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:border-gold-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-2">
              Collez votre texte ici *
            </label>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="ROMÉO: Chut ! Quelle lumière perce à cette fenêtre ?&#10;JULIETTE: Hélas !&#10;ROMÉO: Elle parle..."
              rows={8}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:border-gold-500 focus:outline-none transition-colors font-mono text-sm"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setPastedText("");
                setPastedTitle("");
                setError(null);
              }}
              className="btn-secondary flex-1"
              disabled={!pastedText && !pastedTitle}
            >
              ✕ Effacer
            </button>
            <button
              onClick={handleProcessPastedText}
              className="btn-gold flex-1"
              disabled={!pastedText.trim() || !pastedTitle.trim()}
            >
              🚀 Analyser le texte
            </button>
          </div>
        </div>
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
        </div>
      )}

      {/* Résultats */}
      {showResults && (
        <div>
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
                  ✅ Parfait{successCount - warningCount > 1 ? "s" : ""}
                </p>
              </div>
              {warningCount > 0 && (
                <div className="flex-1 text-center p-3 bg-yellow-500/10 rounded-lg">
                  <p className="text-3xl font-bold text-yellow-500">
                    {warningCount}
                  </p>
                  <p className="text-yellow-400 text-sm">⚠️ À vérifier</p>
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

      {showOcrPremiumModal && (
        <PremiumGateModal
          featureKey="OCR_AUTO"
          onClose={() => setShowOcrPremiumModal(false)}
        />
      )}
    </div>
  );
}

export default Upload;
