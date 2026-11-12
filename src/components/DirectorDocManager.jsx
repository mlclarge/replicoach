import { useState, useEffect, useMemo, useRef } from "react";
import { useAuthStore } from "../store/authStore";
import { useScriptStore, extractScenes } from "../store/scriptStore";
import { deleteDirectorNote, getDirectorNoteUrl, uploadPublicDocument } from "../lib/supabase";
import {
  MAX_DOC_BYTES,
  formatBytes,
  validateDocFile,
  fetchScriptDocs,
  addScriptFileDoc,
  addScriptLinkDoc,
  totalDocBytes,
  describeDocScope,
} from "../lib/directorDocs";
import VideoAnchorPicker from "./VideoAnchorPicker";

const LIBRARY_CATEGORIES = [
  { id: "guide", label: "📖 Guide" },
  { id: "exercice", label: "🎯 Exercice" },
  { id: "script", label: "📜 Script" },
];

const KIND_ICONS = { file: "📄", link: "🔗", video_link: "🎬" };

/**
 * Bloc « Gestion documentaire » du metteur en scène (Profil Director / Dev) :
 * - consignes rattachées à une pièce (fichier, lien, lien vidéo), par pièce / acte / scène / réplique
 * - dépôt d'un document généraliste dans la bibliothèque
 */
export default function DirectorDocManager() {
  const { user } = useAuthStore();
  const { scripts } = useScriptStore();

  const [scriptId, setScriptId] = useState("");
  const [docs, setDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [mode, setMode] = useState("file"); // file | link
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState(null);
  const [anchor, setAnchor] = useState({ key: null, scope: "script" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);

  // Bibliothèque générale
  const [libFile, setLibFile] = useState(null);
  const [libTitle, setLibTitle] = useState("");
  const [libCategory, setLibCategory] = useState("guide");
  const [libBusy, setLibBusy] = useState(false);
  const [libMessage, setLibMessage] = useState(null);
  const libInputRef = useRef(null);

  const activeScript = scripts.find((s) => s.id === scriptId) || null;
  const orderedReplicas = useMemo(
    () => [...(activeScript?.replicas || [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    [activeScript]
  );
  const { scenes } = useMemo(() => extractScenes(orderedReplicas), [orderedReplicas]);

  const flash = (setter, message) => {
    setter(message);
    setTimeout(() => setter(null), 3500);
  };

  const loadDocs = async (id) => {
    if (!id) {
      setDocs([]);
      return;
    }
    setLoadingDocs(true);
    try {
      setDocs(await fetchScriptDocs(id));
    } catch (err) {
      setError("Impossible de charger les documents de cette pièce.");
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadDocs(scriptId);
  }, [scriptId]);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    const problem = validateDocFile(selected);
    if (problem) {
      setError(problem);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFile(selected);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!user?.id || !scriptId) return;
    if (!anchor.key) {
      setError("Choisissez l'emplacement de la consigne dans la pièce.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const base = {
        userId: user.id,
        scriptId,
        scopeType: anchor.scope,
        scopeKey: anchor.scope === "script" ? null : anchor.key,
        title,
      };
      if (mode === "file") {
        if (!file) throw new Error("Sélectionnez un fichier.");
        await addScriptFileDoc({ ...base, file });
      } else {
        await addScriptLinkDoc({ ...base, rawUrl: linkUrl });
      }
      setTitle("");
      setLinkUrl("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      flash(setSuccess, "Consigne ajoutée : les comédiens de la pièce la verront.");
      await loadDocs(scriptId);
    } catch (err) {
      setError(err.message || "Erreur lors de l'ajout de la consigne.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (doc) => {
    if (!confirm("Supprimer cette consigne ?")) return;
    try {
      await deleteDirectorNote(doc.id, doc.file_path);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      flash(setSuccess, "Consigne supprimée.");
    } catch (err) {
      setError(err.message || "Suppression impossible.");
    }
  };

  const handleLibraryUpload = async (e) => {
    e.preventDefault();
    if (!libFile || !libTitle.trim() || !user?.id) return;
    setLibBusy(true);
    setLibMessage(null);
    try {
      await uploadPublicDocument(libFile, { title: libTitle.trim(), category: libCategory }, user.id);
      setLibFile(null);
      setLibTitle("");
      if (libInputRef.current) libInputRef.current.value = "";
      flash(setLibMessage, { type: "ok", text: "Document ajouté à la bibliothèque." });
    } catch (err) {
      setLibMessage({ type: "error", text: err.message || "Erreur lors de l'ajout." });
    } finally {
      setLibBusy(false);
    }
  };

  const handleLibraryFile = (e) => {
    const selected = e.target.files?.[0];
    setLibMessage(null);
    if (!selected) {
      setLibFile(null);
      return;
    }
    const problem = validateDocFile(selected);
    if (problem) {
      setLibMessage({ type: "error", text: problem });
      setLibFile(null);
      if (libInputRef.current) libInputRef.current.value = "";
      return;
    }
    setLibFile(selected);
    if (!libTitle) setLibTitle(selected.name.replace(/\.[^/.]+$/, ""));
  };

  const openDoc = (doc) => {
    const target = doc.kind === "file" ? getDirectorNoteUrl(doc.file_path) : doc.url;
    if (target) window.open(target, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="bg-gray-800 rounded-xl border border-gold-500/40 overflow-hidden shadow-xl my-4">
      <div className="p-4 bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 border-b border-gold-500/30">
        <h2 className="text-lg font-bold text-gold-400 flex items-center gap-2">
          <span>🗂️</span> Gestion documentaire
        </h2>
        <p className="text-xs text-amber-200/80">
          Consignes par pièce, scène ou réplique (fichiers, liens, vidéos en ligne) et documents généraux
        </p>
      </div>

      <div className="p-4 space-y-6">
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/40 text-red-300 text-xs rounded-lg">{error}</div>
        )}
        {success && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-lg">
            {success}
          </div>
        )}

        {/* SECTION 1 : consignes d'une pièce */}
        <div className="bg-gray-700/50 p-3.5 rounded-xl border border-gray-600/50 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>📌</span> Consignes pour les comédiens d'une pièce
          </h3>

          <select
            value={scriptId}
            onChange={(e) => {
              setScriptId(e.target.value);
              setAnchor({ key: null, scope: "script" });
              setError(null);
            }}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white focus:outline-none focus:border-gold-400"
          >
            <option value="">-- Choisir une pièce --</option>
            {scripts.map((s) => (
              <option key={s.id} value={s.id}>
                📜 {s.title}
              </option>
            ))}
          </select>

          {activeScript && (
            <>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="flex gap-2">
                  {[
                    { id: "file", label: "📄 Fichier (PDF, texte, image)" },
                    { id: "link", label: "🔗 Lien / vidéo en ligne" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setMode(m.id);
                        setError(null);
                      }}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${
                        mode === m.id
                          ? "bg-gold-500 text-black border-gold-400"
                          : "bg-gray-900 text-gray-300 border-gray-600"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <VideoAnchorPicker
                  key={scriptId}
                  replicas={orderedReplicas}
                  characters={activeScript.characters || []}
                  scenes={scenes}
                  label="📍 Emplacement de la consigne dans la pièce :"
                  onChange={(key, scope) => setAnchor({ key, scope })}
                />

                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titre de la consigne (facultatif)"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white placeholder-gray-400 focus:outline-none focus:border-gold-400"
                />

                {mode === "file" ? (
                  <div className="space-y-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                      onChange={handleFileChange}
                      className="w-full text-xs text-gray-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-gray-600 file:text-white"
                    />
                    <p className="text-[11px] text-amber-200/80">
                      Poids maximum : {formatBytes(MAX_DOC_BYTES)} par document. Les vidéos se partagent par lien.
                      {file && ` Fichier choisi : ${formatBytes(file.size)}.`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white placeholder-gray-400 focus:outline-none focus:border-gold-400"
                    />
                    <p className="text-[11px] text-amber-200/80">
                      Lien https uniquement. YouTube « non répertorié » ou Vimeo conseillés pour une vidéo : aucun
                      stockage n'est utilisé.
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy || !anchor.key || (mode === "file" ? !file : !linkUrl.trim())}
                  className="w-full py-2 bg-gradient-to-r from-amber-500 to-gold-500 hover:from-amber-400 hover:to-gold-400 text-black text-xs font-extrabold rounded-lg shadow transition disabled:opacity-50"
                >
                  {busy ? "Ajout en cours..." : "Ajouter la consigne"}
                </button>
              </form>

              <div className="pt-1 space-y-1.5">
                <p className="text-[11px] font-bold text-gold-400 uppercase tracking-wider">
                  Consignes de cette pièce ({docs.length}) • {formatBytes(totalDocBytes(docs))} stockés
                </p>
                {loadingDocs ? (
                  <p className="text-xs text-gray-400 italic">Chargement...</p>
                ) : docs.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Aucune consigne pour cette pièce.</p>
                ) : (
                  docs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-2 p-2 bg-gray-800 rounded-lg border border-gray-700 text-xs text-gray-200"
                    >
                      <button
                        type="button"
                        onClick={() => openDoc(doc)}
                        className="min-w-0 text-left flex-1"
                        title="Ouvrir"
                      >
                        <span className="block font-bold text-amber-300 truncate">
                          {KIND_ICONS[doc.kind] || "📄"} {doc.title || doc.file_name}
                        </span>
                        <span className="block text-[11px] text-gray-400 truncate">
                          {describeDocScope(doc, { scenes, replicas: orderedReplicas })}
                          {doc.file_size ? ` • ${formatBytes(doc.file_size)}` : ""}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc)}
                        className="text-red-400 hover:text-red-300 font-bold px-1 flex-shrink-0"
                        title="Supprimer la consigne"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* SECTION 2 : bibliothèque générale */}
        <div className="bg-gray-700/50 p-3.5 rounded-xl border border-gray-600/50">
          <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
            <span>📚</span> Document généraliste pour la bibliothèque
          </h3>
          <p className="text-[11px] text-gray-400 mb-3">
            Ressources générales sur le théâtre, visibles par tous les utilisateurs (distinct des consignes d'une
            pièce).
          </p>
          <form onSubmit={handleLibraryUpload} className="space-y-2">
            <input
              ref={libInputRef}
              type="file"
              accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
              onChange={handleLibraryFile}
              className="w-full text-xs text-gray-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-gray-600 file:text-white"
            />
            <input
              type="text"
              value={libTitle}
              onChange={(e) => setLibTitle(e.target.value)}
              placeholder="Titre du document"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-xs text-white placeholder-gray-400 focus:outline-none focus:border-gold-400"
            />
            <div className="flex gap-2">
              {LIBRARY_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setLibCategory(cat.id)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${
                    libCategory === cat.id
                      ? "bg-gold-500 text-black border-gold-400"
                      : "bg-gray-900 text-gray-300 border-gray-600"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-amber-200/80">Poids maximum : {formatBytes(MAX_DOC_BYTES)} par document.</p>
            {libMessage && (
              <p className={`text-xs ${libMessage.type === "ok" ? "text-emerald-300" : "text-red-300"}`}>
                {libMessage.text}
              </p>
            )}
            <button
              type="submit"
              disabled={libBusy || !libFile || !libTitle.trim()}
              className="w-full py-2 bg-gray-600 hover:bg-gray-500 text-white text-xs font-extrabold rounded-lg transition disabled:opacity-50"
            >
              {libBusy ? "Ajout en cours..." : "Ajouter à la bibliothèque"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
