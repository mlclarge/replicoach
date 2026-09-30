import { supabase } from "./supabase";

function getEndpoint() {
  const configuredUrl =
    import.meta.env.VITE_BACKEND_OCR_URL || import.meta.env.VITE_API_URL;
  const backendUrl =
    configuredUrl || (import.meta.env.DEV ? "http://127.0.0.1:8000" : null);

  if (!backendUrl) {
    throw new Error(
      "Le service OCR Premium n'est pas configuré. Définissez VITE_BACKEND_OCR_URL.",
    );
  }

  const normalizedUrl = backendUrl.replace(/\/+$/, "");
  if (normalizedUrl.endsWith("/api/extract-premium")) return normalizedUrl;
  if (normalizedUrl.endsWith("/api/ocr")) {
    return normalizedUrl.replace(/\/api\/ocr$/, "/api/extract-premium");
  }
  return `${normalizedUrl}/api/extract-premium`;
}

async function readErrorMessage(response) {
  try {
    const payload = await response.json();
    return payload.detail || payload.error || response.statusText;
  } catch {
    return response.statusText || "Réponse invalide du serveur OCR.";
  }
}

export async function processWithGemini(file, onProgress) {
  if (!file) throw new Error("Aucun fichier fourni pour le scan Premium.");
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Le scan Premium prend uniquement en charge les PDF.");
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(`Impossible de vérifier la session : ${sessionError.message}`);
  }
  if (!session?.access_token) {
    throw new Error("Connectez-vous pour lancer le scan Premium.");
  }

  if (onProgress) onProgress(0.1, "Préparation du PDF...");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", file.name.replace(/\.pdf$/i, ""));

  if (onProgress) onProgress(0.2, "Envoi sécurisé du PDF...");
  const response = await fetch(getEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(`Erreur du service Gemini Vision : ${message}`);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Le service Gemini Vision a renvoyé une réponse invalide.");
  }

  if (
    typeof result.title !== "string" ||
    !Array.isArray(result.characters) ||
    !Array.isArray(result.replicas)
  ) {
    throw new Error("La réponse du service Gemini Vision est incomplète.");
  }

  if (onProgress) onProgress(1, "Analyse terminée !");
  return result;
}
