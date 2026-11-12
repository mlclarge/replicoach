import { useState, useEffect } from "react";
import { fetchScriptDocs, describeDocScope, formatBytes } from "../lib/directorDocs";
import { getDirectorNoteUrl } from "../lib/supabase";
import DocumentViewer from "./DocumentViewer";

const KIND_ICONS = { file: "📄", link: "🔗", video_link: "🎬" };

/**
 * Consignes du metteur en scène rattachées à une pièce, vues par les comédiens.
 * La lecture est filtrée côté base : seuls les comédiens ayant accès à la pièce les reçoivent.
 */
export default function ScriptConsignes({ scriptId, scenes = [], replicas = [] }) {
  const [docs, setDocs] = useState([]);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    if (!scriptId) return;
    let cancelled = false;
    fetchScriptDocs(scriptId)
      .then((list) => {
        if (!cancelled) setDocs(list);
      })
      .catch(() => {
        if (!cancelled) setDocs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [scriptId]);

  if (docs.length === 0) return null;

  const openDoc = (doc) => {
    if (doc.kind !== "file") {
      if (doc.url) window.open(doc.url, "_blank", "noopener,noreferrer");
      return;
    }
    const url = getDirectorNoteUrl(doc.file_path);
    if (url) {
      setViewing({ file_name: doc.title || doc.file_name, file_url: url, file_type: doc.file_type });
    }
  };

  // Repère dans le texte : première réplique de l'acte / de la scène, ou la réplique visée
  const targetReplicaId = (doc) => {
    if (doc.scope_type === "replica") return doc.scope_key;
    if (doc.scope_type === "scene") {
      return scenes.find((s) => `scene::${s.actTitle}_${s.sceneTitle}` === doc.scope_key)?.firstReplicaId;
    }
    if (doc.scope_type === "act") {
      const act = (doc.scope_key || "").replace(/^act::/, "");
      return scenes.find((s) => s.actTitle === act)?.firstReplicaId;
    }
    return null;
  };

  const goTo = (doc) => {
    const id = targetReplicaId(doc);
    const el = id ? document.getElementById(`replica-anchor-${id}`) : null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="mb-4 rounded-2xl border-2 border-amber-400/70 bg-amber-950/40 p-3.5 shadow-lg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-sm font-extrabold text-amber-300 flex items-center gap-2">
          <span>📌</span> Consignes du metteur en scène ({docs.length})
        </span>
        <span className={`text-amber-300 transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {docs.map((doc) => {
            const canGoTo = !!targetReplicaId(doc);
            return (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-2 p-2.5 bg-gray-900/80 border border-amber-500/30 rounded-xl text-xs"
              >
                <button type="button" onClick={() => openDoc(doc)} className="min-w-0 flex-1 text-left">
                  <span className="block font-bold text-white truncate">
                    {KIND_ICONS[doc.kind] || "📄"} {doc.title || doc.file_name}
                  </span>
                  <span className="block text-[11px] text-amber-200/80 truncate">
                    {describeDocScope(doc, { scenes, replicas })}
                    {doc.file_size ? ` • ${formatBytes(doc.file_size)}` : ""}
                  </span>
                </button>
                {canGoTo && (
                  <button
                    type="button"
                    onClick={() => goTo(doc)}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold flex-shrink-0"
                    title="Aller à l'endroit concerné dans le texte"
                  >
                    ↓ Texte
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewing && <DocumentViewer document={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
