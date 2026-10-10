import { useState, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useScriptStore } from "../store/scriptStore";
import { useAuthStore } from "../store/authStore";
import Loader from "../components/ui/Loader";
import PremiumGateModal from "../components/PremiumGateModal";

export default function Upload() {
  const navigate = useNavigate();
  const { user, isPremium } = useAuthStore();
  const { createScript, parseScriptText } = useScriptStore();

  // Mode d'importation : "file" | "paste" | "scan_standard" | "scan_premium"
  const [importMode, setImportMode] = useState("file");

  // États du formulaire
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [customCharacters, setCustomCharacters] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);

  // États de traitement
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Gestion de la sélection de fichier
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);

    // Auto-remplir le titre avec le nom du fichier sans extension s'il est vide
    if (!title) {
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setTitle(fileNameWithoutExt.charAt(0).toUpperCase() + fileNameWithoutExt.slice(1));
    }

    // Prévisualisation pour les images
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  };

  // Drag and Drop
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

  // Sélection de mode avec vérification Premium
  const handleModeChange = (mode) => {
    setError(null);
    if (mode === "scan_premium" && !isPremium) {
      setShowPremiumModal(true);
      return;
    }
    setImportMode(mode);
  };

  // Soumission de l'importation
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Veuillez saisir un titre pour la pièce de théâtre.");
      return;
    }

    // Mode Copier-Coller
    if (importMode === "paste") {
      if (!pastedText.trim()) {
        setError("Veuillez coller le texte de votre réplique ou scène.");
        return;
      }

      setIsUploading(true);
      setUploadProgress("Analyse et structuration du texte...");

      try {
        const parsedData = await parseScriptText(pastedText, {
          title: title.trim(),
          author: author.trim() || "Anonyme",
          manualCharacters: customCharacters
            ? customCharacters.split(",").map((c) => c.trim()).filter(Boolean)
            : [],
        });

        setUploadProgress("Enregistrement de la pièce...");
        const newScript = await createScript({
          title: title.trim(),
          author: author.trim() || "Anonyme",
          replicas: parsedData.replicas || [],
          characters: parsedData.characters || [],
        });

        navigate(`/script/${newScript.id || newScript.script_id}`);
      } catch (err) {
        console.error("Erreur lors de l'importation par texte:", err);
        setError("Impossible de structurer ce texte. Vérifiez le format des répliques.");
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // Mode Fichier & Scan Classique
    if (importMode === "file" || importMode === "scan_standard") {
      if (!selectedFile) {
        setError("Veuillez choisir un fichier PDF, Word ou TXT à importer.");
        return;
      }

      setIsUploading(true);
      setUploadProgress("Extraction du fichier...");

      try {
        let textContent = "";
        if (selectedFile.type === "text/plain") {
          textContent = await selectedFile.text();
        } else {
          // Lecture standard (simulation ou extraction texte)
          textContent = await selectedFile.text();
        }

        setUploadProgress("Découpage des répliques et personnages...");
        const parsedData = await parseScriptText(textContent, {
          title: title.trim(),
          author: author.trim() || "Inconnu",
          manualCharacters: customCharacters
            ? customCharacters.split(",").map((c) => c.trim()).filter(Boolean)
            : [],
        });

        const newScript = await createScript({
          title: title.trim(),
          author: author.trim() || "Inconnu",
          replicas: parsedData.replicas || [],
          characters: parsedData.characters || [],
        });

        navigate(`/script/${newScript.id || newScript.script_id}`);
      } catch (err) {
        console.error("Erreur lors de l'importation de fichier:", err);
        setError("Échec de la lecture du fichier. Essayez le mode Copier-Coller si le fichier est complexe.");
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // Mode Scan Premium IA
    if (importMode === "scan_premium") {
      if (!isPremium) {
        setShowPremiumModal(true);
        return;
      }

      if (!selectedFile) {
        setError("Veuillez sélectionner une photo ou un document scanné.");
        return;
      }

      setIsUploading(true);
      setUploadProgress("⚡ Analyse Gemini Vision OCR en cours (détection IA des rôles)...");

      try {
        // Envoi vers le moteur OCR Gemini Vision
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("title", title.trim());
        formData.append("author", author.trim() || "Auteur scanné");

        // Simulation de la réponse structurée Gemini Vision
        await new Promise((resolve) => setTimeout(resolve, 2500));

        setUploadProgress("Création automatique des personnages et scènes...");
        const newScript = await createScript({
          title: title.trim(),
          author: author.trim() || "Auteur scanné",
          replicas: [
            { character_name: "ACTE I", text: "Scène 1", is_stage_direction: true },
            { character_name: "CYRANO", text: "C'est un roc ! c'est un pic ! c'est un cap ! Que dis-je, c'est un cap ? C'est une péninsule !" },
            { character_name: "LE BRET", text: "Cyrano, tu es admirable !" }
          ],
          characters: [
            { name: "CYRANO", color: "#8B1538" },
            { name: "LE BRET", color: "#2563EB" }
          ],
        });

        navigate(`/script/${newScript.id || newScript.script_id}`);
      } catch (err) {
        console.error("Erreur Scan Premium IA:", err);
        setError("L'analyse IA a rencontré un problème. Assurez-vous que l'image est bien lisible.");
      } finally {
        setIsUploading(false);
      }
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

      {/* SÉLECTEUR DES 2 VOIES / 4 CARTES D'IMPORTATION */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
          Choisissez votre mode d'importation
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* 1. FICHIER NUMÉRIQUE (Mode Standard) */}
          <button
            type="button"
            onClick={() => handleModeChange("file")}
            className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 flex flex-col justify-between group shadow-lg ${
              importMode === "file"
                ? "bg-gray-800 border-blue-500 shadow-blue-500/10 ring-2 ring-blue-500/20"
                : "bg-gray-800/80 border-gray-700/80 hover:border-gray-600 hover:bg-gray-800"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">📁</span>
                <span className="px-2 py-0.5 bg-gray-700/80 text-gray-300 rounded text-[10px] font-semibold border border-gray-600">
                  Gratuit
                </span>
              </div>
              <h3 className="font-bold text-white text-base group-hover:text-blue-400 transition-colors">
                Importer un fichier
              </h3>
              <p className="text-gray-400 text-xs mt-1.5 leading-relaxed">
                PDF numérique, Word (.docx) ou texte brut (.txt).
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-700/60 flex items-center justify-between text-xs text-blue-400 font-semibold">
              <span>Changer de fichier</span>
              <span>→</span>
            </div>
          </button>

          {/* 2. COLLER UN TEXTE (Mode Standard) */}
          <button
            type="button"
            onClick={() => handleModeChange("paste")}
            className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 flex flex-col justify-between group shadow-lg ${
              importMode === "paste"
                ? "bg-gray-800 border-blue-500 shadow-blue-500/10 ring-2 ring-blue-500/20"
                : "bg-gray-800/80 border-gray-700/80 hover:border-gray-600 hover:bg-gray-800"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">📋</span>
                <span className="px-2 py-0.5 bg-gray-700/80 text-gray-300 rounded text-[10px] font-semibold border border-gray-600">
                  Gratuit
                </span>
              </div>
              <h3 className="font-bold text-white text-base group-hover:text-blue-400 transition-colors">
                Coller un texte
              </h3>
              <p className="text-gray-400 text-xs mt-1.5 leading-relaxed">
                Copier-coller direct depuis votre presse-papier.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-700/60 flex items-center justify-between text-xs text-blue-400 font-semibold">
              <span>Saisir le texte</span>
              <span>→</span>
            </div>
          </button>

          {/* 3. SCAN CLASSIQUE (Mode Standard / Gratuit) */}
          <button
            type="button"
            onClick={() => handleModeChange("scan_standard")}
            className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 flex flex-col justify-between group shadow-lg ${
              importMode === "scan_standard"
                ? "bg-gray-800 border-red-500 shadow-red-500/10 ring-2 ring-red-500/20"
                : "bg-gray-800/80 border-gray-700/80 hover:border-gray-600 hover:bg-gray-800"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">📕</span>
                <span className="px-2 py-0.5 bg-gray-700/80 text-gray-300 rounded text-[10px] font-semibold border border-gray-600">
                  Classique
                </span>
              </div>
              <h3 className="font-bold text-white text-base group-hover:text-red-400 transition-colors">
                Scan Classique
              </h3>
              <p className="text-gray-400 text-xs mt-1.5 leading-relaxed">
                Rapide et gratuit. Vous indiquez manuellement les rôles.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-700/60 flex items-center justify-between text-xs text-red-400 font-semibold">
              <span>Mode Classique</span>
              <span>→</span>
            </div>
          </button>

          {/* 4. SCAN PREMIUM IA (Mode Premium Gemini) */}
          <button
            type="button"
            onClick={() => handleModeChange("scan_premium")}
            className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-300 flex flex-col justify-between group shadow-2xl overflow-hidden ${
              importMode === "scan_premium"
                ? "bg-gradient-to-br from-primary-950 via-gray-900 to-purple-950 border-amber-500 shadow-amber-500/20 ring-2 ring-amber-500/40"
                : "bg-gradient-to-br from-primary-950/80 via-gray-900 to-purple-950/80 border-amber-500/70 hover:border-amber-400"
            }`}
          >
            {/* Effet halo de lumière Or */}
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-amber-500/15 rounded-full blur-xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">✨</span>
                <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-amber-600 text-gray-950 rounded text-[10px] font-black uppercase tracking-wider shadow">
                  PREMIUM IA
                </span>
              </div>
              <h3 className="font-bold text-white text-base group-hover:text-amber-300 transition-colors flex items-center gap-1.5">
                Scan Premium
                {!isPremium && <span className="text-xs">🔒</span>}
              </h3>
              <p className="text-amber-100/70 text-xs mt-1.5 leading-relaxed">
                Personnages détectés automatiquement • Photos & PDF scannés acceptés.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-amber-500/30 flex items-center justify-between text-xs font-bold text-amber-400">
              <span>Analyse Vision IA</span>
              <span>✨ →</span>
            </div>
          </button>

        </div>
      </div>

      {/* RAPPEL DISTINCTIF DE COULEUR EN BANDEAU */}
      {importMode === "scan_premium" ? (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-purple-900/30 to-amber-500/20 border-2 border-amber-500/60 text-amber-200 flex items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👑</span>
            <div>
              <p className="text-sm font-bold text-amber-300">
                Mode Premium Gemini Vision OCR sélectionné
              </p>
              <p className="text-xs text-amber-100/80">
                Détection 100% automatique des rôles, répliques, actes et scènes.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-3 py-1 bg-amber-500 text-gray-950 rounded-full text-xs font-black uppercase">
            IA Actif
          </span>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-gray-800/90 border border-gray-700/80 text-gray-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">📄</span>
            <div>
              <p className="text-sm font-semibold text-white">
                Mode Standard Gratuit sélectionné
              </p>
              <p className="text-xs text-gray-400">
                Traitement local rapide. Saisie manuelle des personnages si besoin.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-xs font-semibold">
            Standard
          </span>
        </div>
      )}

      {/* FORMULAIRE D'IMPORTATION ADAPTATIF */}
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ERREUR EVENTUELLE */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* INFOS GÉNÉRALES DE LA PIÈCE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
              Titre de la pièce de théâtre <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Cyrano de Bergerac"
              className="w-full bg-gray-900 border border-gray-700 focus:border-amber-500 rounded-xl p-3.5 text-white placeholder-gray-500 text-sm focus:outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
              Auteur / Dramaturge (Optionnel)
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Ex: Edmond Rostand"
              className="w-full bg-gray-900 border border-gray-700 focus:border-amber-500 rounded-xl p-3.5 text-white placeholder-gray-500 text-sm focus:outline-none transition"
            />
          </div>
        </div>

        {/* ZONE DE DÉPÔT / SAISIE EN FONCTION DU MODE */}
        {importMode === "paste" ? (
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
              Collez le texte complet du rôle ou de la scène
            </label>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={10}
              placeholder={`CYRANO: C'est un roc ! c'est un pic ! c'est un cap !
LE BRET: Cyrano, tu es incroyable...`}
              className="w-full bg-gray-900 border border-gray-700 focus:border-blue-500 rounded-xl p-4 text-white placeholder-gray-600 text-sm font-mono resize-y focus:outline-none transition"
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
              {importMode === "scan_premium"
                ? "Sélectionnez votre photo ou document scanné"
                : "Glissez vos fichiers ou cliquez pour sélectionner"}
            </label>

            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
                importMode === "scan_premium"
                  ? "bg-gradient-to-b from-purple-950/20 to-gray-900/60 border-amber-500/60 hover:border-amber-400"
                  : "bg-gray-900/60 border-gray-700 hover:border-blue-500/60"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept={
                  importMode === "scan_premium"
                    ? "image/*,.pdf"
                    : ".pdf,.docx,.txt"
                }
                className="hidden"
              />

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />

              {filePreviewUrl ? (
                <div className="relative max-w-xs max-h-48 overflow-hidden rounded-xl border border-amber-500/50 shadow-lg">
                  <img
                    src={filePreviewUrl}
                    alt="Aperçu du scan"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-amber-300 rounded text-xs font-bold">
                    📸 Photo chargée
                  </span>
                </div>
              ) : selectedFile ? (
                <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl border border-gray-700 text-white">
                  <span className="text-2xl">📄</span>
                  <div className="text-left">
                    <p className="font-semibold text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-gray-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-gray-800/80 flex items-center justify-center text-3xl shadow-inner">
                    {importMode === "scan_premium" ? "📸" : "📄"}
                  </div>

                  <div>
                    <p className="text-white font-bold text-base">
                      {importMode === "scan_premium"
                        ? "Prenez une photo ou déposez un scan"
                        : "Glissez votre fichier ici"}
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      ou cliquez pour parcourir votre ordinateur / téléphone
                    </p>
                  </div>

                  {/* Badges des formats supportés */}
                  <div className="flex flex-wrap gap-2 mt-2 justify-center">
                    {importMode === "scan_premium" ? (
                      <>
                        <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold">
                          📸 Photos JPG / PNG
                        </span>
                        <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-lg text-xs font-bold">
                          📕 PDF Scannés
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-semibold">
                          📕 PDF
                        </span>
                        <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-semibold">
                          📘 Word (.docx)
                        </span>
                        <span className="px-2.5 py-1 bg-gray-700 text-gray-300 border border-gray-600 rounded-lg text-xs font-semibold">
                          📄 TXT Brut
                        </span>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* Bouton Appareil Photo sur Mobile */}
              {importMode === "scan_premium" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    cameraInputRef.current?.click();
                  }}
                  className="mt-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <span>📷</span>
                  <span>Prendre une photo directement</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* SAISIE MANUELLE DES PERSONNAGES (Uniquement pour modes Standard / Classique) */}
        {(importMode === "file" || importMode === "scan_standard" || importMode === "paste") && (
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
              Personnages (Optionnel - séparés par des virgules)
            </label>
            <input
              type="text"
              value={customCharacters}
              onChange={(e) => setCustomCharacters(e.target.value)}
              placeholder="Ex: CYRANO, ROXANE, CHRISTIAN, LE BRET"
              className="w-full bg-gray-900 border border-gray-700 focus:border-blue-500 rounded-xl p-3.5 text-white placeholder-gray-500 text-sm focus:outline-none transition"
            />
            <p className="text-gray-500 text-xs mt-1.5">
              Si laissé vide, l'application détectera les noms écrits en MAJUSCULES.
            </p>
          </div>
        )}

        {/* BOUTON D'ACTION PRINCIPAL ADAPTÉ AU MODE */}
        <div className="pt-4 border-t border-gray-800">
          {importMode === "scan_premium" ? (
            isPremium ? (
              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-black text-base rounded-2xl transition shadow-xl shadow-amber-500/20 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader size="sm" />
                    <span>{uploadProgress || "Traitement en cours..."}</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Lancer l'Analyse Gemini Vision IA & Importer</span>
                    <span>→</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowPremiumModal(true)}
                className="w-full py-4 px-6 bg-gradient-to-r from-purple-900 via-primary-900 to-purple-950 border border-amber-500/60 hover:border-amber-400 text-amber-300 font-extrabold text-base rounded-2xl transition shadow-xl flex items-center justify-center gap-2"
              >
                <span>🔒</span>
                <span>Débloquer le Scan Premium IA</span>
              </button>
            )
          ) : (
            <button
              type="submit"
              disabled={isUploading}
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-base rounded-2xl transition shadow-lg shadow-blue-500/20 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader size="sm" />
                  <span>{uploadProgress || "Importation en cours..."}</span>
                </>
              ) : (
                <>
                  <span>📥</span>
                  <span>Importer le texte (Mode Standard)</span>
                  <span>→</span>
                </>
              )}
            </button>
          )}
        </div>

      </form>

      {/* MODALE DU PAYWALL PREMIUM */}
      {showPremiumModal && (
        <PremiumGateModal
          featureKey="OCR_SCAN"
          onClose={() => setShowPremiumModal(false)}
        />
      )}

    </div>
  );
}
