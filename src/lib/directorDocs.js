import { supabase } from "./supabase";

/**
 * Gestion documentaire du metteur en scène : consignes rattachées à une pièce
 * (fichier, lien hypertexte ou lien vidéo). Table `director_notes`, bucket `director-notes`.
 */

export const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 Mo par document (limite aussi appliquée par le bucket)

const ALLOWED_FILE_REGEX = /\.(pdf|txt|doc|docx|jpe?g|png|gif|webp)$/i;
const VIDEO_HOST_REGEX = /^(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com)$/i;

export const formatBytes = (bytes) => {
  if (!bytes) return "0 Ko";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

// Retourne un message d'erreur, ou null si le fichier est accepté
export const validateDocFile = (file) => {
  if (!file) return "Aucun fichier sélectionné.";
  if (file.type?.startsWith("video/") || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(file.name)) {
    return "Les fichiers vidéo ne sont pas acceptés : ajoutez plutôt un lien vidéo (YouTube, Vimeo).";
  }
  if (!ALLOWED_FILE_REGEX.test(file.name)) {
    return "Format non accepté. Formats possibles : PDF, texte, Word, image (JPG, PNG, GIF, WEBP).";
  }
  if (file.size > MAX_DOC_BYTES) {
    return `Fichier trop lourd (${formatBytes(file.size)}). Limite : ${formatBytes(MAX_DOC_BYTES)} par document.`;
  }
  return null;
};

// Retourne { url, kind } ou lève une erreur si le lien est invalide
export const parseDocLink = (rawUrl) => {
  let parsed;
  try {
    parsed = new URL((rawUrl || "").trim());
  } catch {
    throw new Error("Lien invalide. Exemple : https://www.youtube.com/watch?v=...");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Seuls les liens sécurisés (https://) sont acceptés.");
  }
  return {
    url: parsed.toString(),
    kind: VIDEO_HOST_REGEX.test(parsed.hostname) ? "video_link" : "link",
  };
};

export const fetchScriptDocs = async (scriptId) => {
  if (!scriptId) return [];
  const { data, error } = await supabase
    .from("director_notes")
    .select("*")
    .eq("script_id", scriptId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erreur fetchScriptDocs:", error);
    throw error;
  }
  return data || [];
};

export const addScriptFileDoc = async ({ file, userId, scriptId, scopeType, scopeKey, title }) => {
  const validationError = validateDocFile(file);
  if (validationError) throw new Error(validationError);

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `${userId}/${scriptId}/${Date.now()}_${safeName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("director-notes")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("director_notes")
    .insert([
      {
        user_id: userId,
        script_id: scriptId,
        scope_type: scopeType || "script",
        scope_key: scopeKey || null,
        kind: "file",
        title: title?.trim() || null,
        file_name: file.name,
        file_path: uploadData.path,
        file_size: file.size,
        file_type: file.type,
      },
    ])
    .select()
    .single();

  if (error) {
    await supabase.storage.from("director-notes").remove([uploadData.path]);
    throw error;
  }
  return data;
};

export const addScriptLinkDoc = async ({ rawUrl, userId, scriptId, scopeType, scopeKey, title }) => {
  const { url, kind } = parseDocLink(rawUrl);
  const label = title?.trim() || url;

  const { data, error } = await supabase
    .from("director_notes")
    .insert([
      {
        user_id: userId,
        script_id: scriptId,
        scope_type: scopeType || "script",
        scope_key: scopeKey || null,
        kind,
        url,
        title: title?.trim() || null,
        file_name: label,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const totalDocBytes = (docs) =>
  (docs || []).reduce((sum, d) => sum + (d.file_size || 0), 0);

// Libellé lisible de l'emplacement d'une consigne dans la pièce
export const describeDocScope = (doc, { scenes = [], replicas = [] } = {}) => {
  if (doc.scope_type === "act") return `Acte : ${(doc.scope_key || "").replace(/^act::/, "") || "—"}`;
  if (doc.scope_type === "scene") {
    const scene = scenes.find((s) => `scene::${s.actTitle}_${s.sceneTitle}` === doc.scope_key);
    return scene ? `Scène : ${scene.fullLabel}` : "Scène";
  }
  if (doc.scope_type === "replica") {
    const index = replicas.findIndex((r) => String(r.id) === String(doc.scope_key));
    return index >= 0 ? `Réplique #${index + 1}` : "Réplique";
  }
  return "Pièce entière";
};
