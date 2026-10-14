import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useScriptStore } from "../store/scriptStore";
import { uploadFile } from "../lib/supabase";
import { extractTextFromPDF } from "../lib/pdfProcessor";
import {
  extractTextFromWord,
  extractTextFromTxt,
} from "../lib/docProcessor";
import { parseScript } from "../lib/scriptParser";
import { processWithGemini, warmUpOcrBackend } from "../lib/geminiOcrService";
import { withTimeout } from "../lib/withTimeout";
import Loader from "../components/ui/Loader";
import PremiumGateModal from "../components/PremiumGateModal";

const UPLOAD_TIMEOUT_MS = 30_000;

export default function Upload() {
  const navigate = useNavigate();
  const { user, isPremium } = useAuthStore();
  const { createScript, addCharacter, addReplicas, fetchScripts } = useScriptStore();

  // Mode d'importation par défaut : "scan_standard" (Scan classique OCR)
  const [importMode, setImportMode] = useState("scan_standard");

  // Champs de saisie
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [customCharacters, setCustomCharacters] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);

  // Modale de saisie des personnages pour Scan Classique
  const [showCharModal, setShowCharModal] = useState(false);

  // Traitement
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Préchauffage du backend OCR Gemini si Premium
  useEffect(() => {
    if (isPremium) warmUpOcrBackend();
  }, [isPremium]);

  // Sélection de fichier
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);

    if (!title) {
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setTitle(fileNameWithoutExt.charAt(0).toUpperCase() + fileNameWithoutExt.slice(1));
    }

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  };

  // Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setError(null);
      if (!title) {
        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setTitle(fileNameWithoutExt.charAt(0).toUpperCase() + fileNameWithoutExt.slice(1));
      }
      if (file.type.startsWith("image/")) {
        setFilePreviewUrl(URL.createObjectURL(file));
      } else {
        setFilePreviewUrl(null);
      }
    }
  };

  // Changement de mode
  const handleModeChange = (mode) => {
    setError(null);
    if (mode === "scan_premium" && !isPremium) {
      setShowPremiumModal(true);
      return;
    }
    setImportMode(mode);
  };

  // Extraction de texte selon fichier
  const extractTextFromFile = async (file, onProgress, refCharacters = null) => {
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext === "pdf") {
      const result = await extractTextFromPDF(file, onProgress, refCharacters);
      return result.text || "";
    } else if (ext === "docx" || ext === "doc") {
      return await extractTextFromWord(file, onProgress);
    } else if (ext === "txt") {
      return await extractTextFromTxt(file);
    } else {
      throw new Error(`Format de fichier non pris en charge : .${ext}`);
    }
  };

  // Sauvegarde globale Supabase
  const saveParsedScriptToDb = async ({
    scriptTitle,
    rawText,
    fileName,
    filePath,
    parsedCharacters,
    parsedReplicas,
  }) => {
    const script = await createScript({
      user_id: user?.id,
      title: scriptTitle || "Sans titre",
      full_text: rawText || "",
      original_filename: fileName || "document.pdf",
      pdf_url: filePath || null,
    });

    const scriptId = script.id || script.script_id;

    // Attribute a unique color to each character
    const CHARACTER_PALETTE = [
      "#8B1538", "#2563EB", "#D97706", "#059669", "#7C3AED",
      "#DC2626", "#0891B2", "#4F46E5", "#DB2777", "#65A30D"
    ];

    const characterMap = {};
    if (Array.isArray(parsedCharacters)) {
      parsedCharacters.forEach((char, idx) => {
        const charName = typeof char === "string" ? char : char.name;
        const assignedColor = (typeof char === "object" && char.color) 
          ? char.color 
          : CHARACTER_PALETTE[idx % CHARACTER_PALETTE.length];
        
        if (charName) {
          characterMap[charName.toUpperCase()] = assignedColor;
        }
      });

      for (const [cName, cColor] of Object.entries(characterMap)) {
        const createdChar = await addCharacter(scriptId, {
          name: cName,
          color: cColor,
        });
        characterMap[cName] = createdChar.id;
      }
    }

    if (Array.isArray(parsedReplicas) && parsedReplicas.length > 0) {
      const replicasToInsert = parsedReplicas.map((rep, idx) => {
        const charName = (rep.character || rep.character_name || "").toUpperCase();
        return {
          script_id: scriptId,
          character_id: characterMap[charName] || null,
          order_index: idx,
          text: rep.text || "",
          text_gaps: rep.textGaps || rep.text_gaps || "",
          cue_words: rep.cueWords || rep.cue_words || "",
        };
      });

      await addReplicas(replicasToInsert);
    }

    if (user?.id) {
      await fetchScripts(user.id);
    }

    return scriptId;
  };

  // Submit principal
  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError(null);

    // MODE 1 : SCAN CLASSIQUE (OCR)
    if (importMode === "scan_standard") {
      if (!title.trim()) {
        setError("Veuillez saisir un titre pour la pièce de théâtre.");
        return;
      }

      if (!selectedFile) {
        setError("Veuillez sélectionner un document PDF ou une photo scannée.");
        return;
      }

      if (!customCharacters.trim()) {
        setShowCharModal(true);
        return;
      }

      await executeScanStandard();
      return;
    }

    // MODE 2 : FICHIER NATIF NUMÉRIQUE
    if (importMode === "file") {
      if (!selectedFile) {
        setError("Veuillez choisir un fichier PDF, Word ou TXT à importer.");
        return;
      }

      setIsUploading(true);
      setUploadProgress("Extraction du texte du document...");

      try {
        const manualCharList = customCharacters
          ? customCharacters.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)
          : null;

        const rawText = await extractTextFromFile(selectedFile, (p) => {
          setUploadProgress(`Lecture du fichier (${Math.round(p * 100)}%)...`);
        }, manualCharList);

        if (!rawText || rawText.trim().length === 0) {
          throw new Error("Aucun texte exploitable n'a été trouvé dans le fichier.");
        }

        setUploadProgress("Analyse des répliques et des personnages...");
        const { title: parsedTitle, characters, replicas } = parseScript(
          rawText,
          selectedFile.name,
          manualCharList
        );

        setUploadProgress("Stockage du fichier source...");
        let filePath = null;
        try {
          filePath = await withTimeout(
            uploadFile(selectedFile, user.id),
            UPLOAD_TIMEOUT_MS,
            "Upload du fichier dépassé"
          );
        } catch (storageErr) {
          console.warn("Upload storage ignoré:", storageErr);
        }

        setUploadProgress("Enregistrement de la pièce de théâtre...");
        const scriptId = await saveParsedScriptToDb({
          scriptTitle: title.trim() || parsedTitle,
          rawText,
          fileName: selectedFile.name,
          filePath,
          parsedCharacters: characters,
          parsedReplicas: replicas,
        });

        navigate(`/script/${scriptId}`);
      } catch (err) {
        console.error("Erreur lors de l'importation de fichier:", err);
        setError(`Échec de la lecture du fichier : ${err.message || "Fichier complexe"}.`);
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // MODE 3 : SCAN PREMIUM IA
    if (importMode === "scan_premium") {
      if (!isPremium) {
        setShowPremiumModal(true);
        return;
      }

      if (!selectedFile) {
        setError("Veuillez sélectionner un fichier PDF ou une photo pour le Scan Premium.");
        return;
      }

      setIsUploading(true);
      setUploadProgress("✨ Traitement Gemini Vision OCR en cours (détection auto des personnages)...");

      try {
        const geminiResult = await processWithGemini(selectedFile, (msg) => {
          setUploadProgress(`Scan IA : ${msg}`);
        });

        setUploadProgress("Enregistrement de la pièce scannée...");
        const scriptId = await saveParsedScriptToDb({
          scriptTitle: title.trim() || geminiResult.title || selectedFile.name,
          rawText: geminiResult.fullText || geminiResult.rawText || "",
          fileName: selectedFile.name,
          filePath: null,
          parsedCharacters: geminiResult.characters || [],
          parsedReplicas: geminiResult.replicas || [],
        });

        navigate(`/script/${scriptId}`);
      } catch (err) {
        console.error("Erreur Scan Premium IA:", err);
        setError(`Le Scan Premium IA a échoué : ${err.message || "Assurez-vous que le fichier est un PDF lisible"}.`);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const executeScanStandard = async () => {
    setIsUploading(true);
    setUploadProgress("Lancement de la reconnaissance optique (OCR)...");

    try {
      const manualCharList = customCharacters
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);

      const rawText = await extractTextFromFile(selectedFile, (p) => {
        setUploadProgress(`OCR en cours (${Math.round(p * 100)}%)...`);
      }, manualCharList);

      setUploadProgress("Découpage selon vos personnages...");
      const { title: parsedTitle, characters, replicas } = parseScript(
        rawText,
        selectedFile.name,
        manualCharList
      );

      let filePath = null;
      try {
        filePath = await withTimeout(
          uploadFile(selectedFile, user.id),
          UPLOAD_TIMEOUT_MS,
          "Upload ignoré"
        );
      } catch (e) {
        console.warn(e);
      }

      const scriptId = await saveParsedScriptToDb({
        scriptTitle: title.trim() || parsedTitle,
        rawText,
        fileName: selectedFile.name,
        filePath,
        parsedCharacters: characters,
        parsedReplicas: replicas,
      });

      setShowCharModal(false);
      navigate(`/script/${scriptId}`);
    } catch (err) {
      console.error("Erreur Scan Classique:", err);
      setError("Le Scan Classique n'a pas pu extraire le texte de ce document.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      
      {/* EN-TÊTE PRINCIPAL */}
      <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
        <span className="text-3xl sm:text-4xl">📄</span>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Importer des textes
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Ajoutez vos pièces de théâtre, scénarios ou répliques dans votre espace de travail.
          </p>
        </div>
      </div>

      {/* SÉLECTEUR DES MÉTHODES D'IMPORTATION (3 BLOCS RESTRUCTURÉS) */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
          1. Choisissez la méthode d'importation
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* 1ÈRE POSITION : SCAN CLASSIQUE (OCR) */}
          <button
            type="button"
            onClick={() => handleModeChange("scan_standard")}
            className={`p-4 rounded-xl border-2 text-left transition-all duration-200 flex flex-col justify-between ${
              importMode === "scan_standard"
                ? "bg-gray-800 border-blue-500 shadow-lg shadow-blue-500/10"
                : "bg-gray-800/60 border-gray-700 hover:border-gray-600 hover:bg-gray-800/80"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">📸</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-700 text-gray-300 rounded-full border border-gray-600">
                  Standard
                </span>
              </div>
              <h3 className="font-bold text-white text-sm">Scan classique (OCR)</h3>
              <p className="text-gray-400 text-xs mt-1 leading-snug">
                Votre pdf est issu d'un scan, ou photocopie. Ici, vous précisez le nom de chaque personnage, laissez-vous guider !
              </p>
            </div>
            <span className="text-xs text-blue-400 font-semibold mt-3">Gratuit</span>
          </button>

          {/* 2ÈME POSITION : FICHIER NATIF NUMÉRIQUE */}
          <button
            type="button"
            onClick={() => handleModeChange("file")}
            className={`p-4 rounded-xl border-2 text-left transition-all duration-200 flex flex-col justify-between ${
              importMode === "file"
                ? "bg-gray-800 border-blue-500 shadow-lg shadow-blue-500/10"
                : "bg-gray-800/60 border-gray-700 hover:border-gray-600 hover:bg-gray-800/80"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">📄</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-700 text-gray-300 rounded-full border border-gray-600">
                  Standard
                </span>
              </div>
              <h3 className="font-bold text-white text-sm">Fichier natif numérique</h3>
              <p className="text-gray-400 text-xs mt-1 leading-snug">
                Votre document a été conçu entièrement sur pc ou mobile.
              </p>
            </div>
            <span className="text-xs text-blue-400 font-semibold mt-3">Gratuit</span>
          </button>

          {/* 3ÈME POSITION : SCAN PREMIUM IA (GEMINI VISION) */}
          <button
            type="button"
            onClick={() => handleModeChange("scan_premium")}
            className={`p-4 rounded-xl border-2 text-left transition-all duration-200 flex flex-col justify-between relative overflow-hidden ${
              importMode === "scan_premium"
                ? "bg-gradient-to-br from-primary-950 via-gray-900 to-purple-950 border-amber-400 shadow-xl shadow-amber-500/20"
                : "bg-gradient-to-br from-primary-950/60 via-gray-900/60 to-purple-950/60 border-amber-500/50 hover:border-amber-400"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">✨</span>
                <span className="text-[10px] font-black px-2 py-0.5 bg-amber-500 text-dark rounded-full shadow">
                  PREMIUM IA
                </span>
              </div>
              <h3 className="font-bold text-white text-sm group-hover:text-amber-300">
                ✨ Scan Premium IA
              </h3>
              <p className="text-amber-200/70 text-xs mt-1 leading-snug">
                Analyse intelligente Gemini Vision. Détection 100% auto des rôles & scènes.
              </p>
            </div>
            <span className="text-xs font-bold text-amber-400 mt-3 flex items-center gap-1">
              👑 OCR Gemini
            </span>
          </button>

        </div>
      </div>

      {/* FORMULAIRE DE CONFIGURATION */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* PAVÉ 2 : INFORMATIONS DE LA PIÈCE DE THÉÂTRE (Affiché uniquement pour le Scan classique OCR) */}
        {importMode === "scan_standard" && (
          <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xl">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
              2. Informations de la pièce de théâtre
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">
                  Titre de la pièce de théâtre *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Cyrano de Bergerac"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">
                  Auteur / Dramaturge (Optionnel)
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Ex: Edmond Rostand"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none transition"
                />
              </div>
            </div>
          </div>
        )}

        {/* ZONE DE DÉPÔT / UPLOAD FICHIER */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
          <label className="block text-xs font-bold text-gray-300 uppercase mb-2">
            {importMode === "scan_premium"
              ? "Sélectionnez votre photo ou document scanné *"
              : "Glissez vos fichiers ou cliquez pour sélectionner *"}
          </label>

          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
              selectedFile
                ? "border-amber-500 bg-amber-500/10"
                : "border-gray-700 hover:border-gray-500 bg-gray-800/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.txt,image/*"
              className="hidden"
            />

            <input
              ref={cameraInputRef}
              type="file"
              onChange={handleFileSelect}
              accept="image/*"
              capture="environment"
              className="hidden"
            />

            {selectedFile ? (
              <div className="space-y-2">
                <span className="text-4xl block">📄</span>
                <p className="font-bold text-white text-sm">{selectedFile.name}</p>
                <p className="text-gray-400 text-xs">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} Mo
                </p>
                {filePreviewUrl && (
                  <img
                    src={filePreviewUrl}
                    alt="Aperçu"
                    className="max-h-40 mx-auto rounded-lg border border-gray-700 mt-2"
                  />
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setFilePreviewUrl(null);
                  }}
                  className="text-xs text-red-400 hover:text-red-300 underline pt-1"
                >
                  Changer de fichier
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <span className="text-4xl block">📄</span>
                <p className="text-white font-bold text-sm sm:text-base">
                  Glissez vos fichiers ici
                </p>
                <p className="text-gray-400 text-xs">ou cliquez pour sélectionner</p>
                <div className="flex justify-center gap-2 pt-2">
                  <span className="px-2.5 py-1 bg-red-900/50 text-red-300 text-xs font-bold rounded">
                    📕 PDF
                  </span>
                  <span className="px-2.5 py-1 bg-blue-900/50 text-blue-300 text-xs font-bold rounded">
                    📘 Word
                  </span>
                  <span className="px-2.5 py-1 bg-gray-700 text-gray-300 text-xs font-bold rounded">
                    📄 TXT
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-semibold text-gray-300 flex items-center gap-1.5 transition"
            >
              📷 Prendre une photo directement
            </button>
          </div>
        </div>

        {/* LISTE DES PERSONNAGES OPTIONNELLE */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-5 sm:p-6 space-y-2 shadow-xl">
          <label className="block text-xs font-bold text-gray-300 uppercase mb-1">
            Personnages (Optionnel - Séparés par des virgules)
          </label>
          <input
            type="text"
            value={customCharacters}
            onChange={(e) => setCustomCharacters(e.target.value)}
            placeholder="Ex: Cyrano, Roxane, Christian, De Guiche"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none transition"
          />
          <p className="text-gray-500 text-[11px]">
            Si laissé vide, l'application détectera les noms écrits en MAJUSCULES.
          </p>
        </div>

        {/* ERREURS */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <p className="text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* PROGRESSION */}
        {isUploading && (
          <div className="p-6 bg-gray-900/90 border border-gray-800 rounded-2xl text-center space-y-3">
            <Loader />
            <p className="text-amber-400 font-bold text-sm animate-pulse">
              {uploadProgress}
            </p>
          </div>
        )}

        {/* SOUMISSION */}
        <button
          type="submit"
          disabled={isUploading}
          className={`w-full py-4 rounded-xl font-extrabold text-base transition-all duration-200 shadow-xl flex items-center justify-center gap-2 ${
            isUploading
              ? "bg-gray-800 text-gray-500 cursor-not-allowed"
              : importMode === "scan_premium"
              ? "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-gray-950 shadow-amber-500/20"
              : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
          }`}
        >
          {isUploading ? (
            "⏳ Importation en cours..."
          ) : importMode === "scan_premium" ? (
            "✨ Lancer l'analyse Premium IA →"
          ) : (
            "🚀 Valider et importer le texte →"
          )}
        </button>
      </form>

      {/* MODALE PERSONNAGES SCAN CLASSIQUE */}
      {showCharModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📕</span> Scan Classique — Personnages
              </h3>
              <button
                type="button"
                onClick={() => setShowCharModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-gray-300 text-xs leading-relaxed">
              Pour le Scan Classique gratuit, veuillez indiquer la liste des personnages séparés par des virgules pour optimiser la reconnaissance.
            </p>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                Personnages de la pièce *
              </label>
              <input
                type="text"
                value={customCharacters}
                onChange={(e) => setCustomCharacters(e.target.value)}
                placeholder="Ex: CYRANO, ROXANE, CHRISTIAN"
                className="w-full bg-gray-800 border border-gray-600 rounded-xl p-3 text-white text-sm focus:border-amber-500 focus:outline-none"
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCharModal(false)}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-bold text-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={executeScanStandard}
                disabled={!customCharacters.trim()}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs ${
                  customCharacters.trim()
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : "bg-gray-800 text-gray-500 cursor-not-allowed"
                }`}
              >
                Lancer le Scan Classique →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE PREMIUM */}
      {showPremiumModal && (
        <PremiumGateModal
          featureKey="OCR_AUTO"
          onClose={() => setShowPremiumModal(false)}
        />
      )}

    </div>
  );
}
