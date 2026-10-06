import { supabase } from "./supabase";
import { withTimeout } from "./withTimeout";

const SESSION_TIMEOUT_MS = 15_000;
// Gemini met ~1 à 2 min sur un long script, plus un éventuel démarrage à froid de Render.
const REQUEST_TIMEOUT_MS = 6 * 60_000;

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
  } = await withTimeout(
    supabase.auth.getSession(),
    SESSION_TIMEOUT_MS,
    "La vérification de votre session a expiré. Rechargez la page et réessayez.",
  );
  if (sessionError) {
    throw new Error(`Impossible de vérifier la session : ${sessionError.message}`);
  }
  if (!session?.access_token) {
    throw new Error("Connectez-vous pour lancer le scan Premium.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", file.name.replace(/\.pdf$/i, ""));

  if (onProgress) onProgress("uploading_to_backend");
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(getEndpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(`Erreur du service Gemini Vision : ${message}`);
    }

    let result;
    if (response.headers.get("content-type")?.includes("text/event-stream")) {
      result = await readProgressStream(response, onProgress);
    } else {
      // Compatibilité pendant un déploiement progressif du backend.
      try {
        result = await response.json();
      } catch {
        throw new Error(
          "Le service Gemini Vision a renvoyé une réponse invalide.",
        );
      }
      if (onProgress) onProgress("result_received");
    }

    if (
      typeof result.title !== "string" ||
      !Array.isArray(result.characters) ||
      !Array.isArray(result.replicas)
    ) {
      throw new Error("La réponse du service Gemini Vision est incomplète.");
    }

    return result;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "Le service OCR Premium n'a pas répondu à temps. Réessayez dans un instant.",
      );
    }
    throw error;
  } finally {
    clearTimeout(abortTimer);
  }
}

async function readProgressStream(response, onProgress) {
  if (!response.body) {
    throw new Error("Le service OCR Premium n'a pas fourni de flux de progression.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;

  const dispatch = (block) => {
    let event = "message";
    const data = [];
    for (const line of block.split("\n")) {
      const normalizedLine = line.endsWith("\r") ? line.slice(0, -1) : line;
      if (normalizedLine.startsWith("event:")) {
        event = normalizedLine.slice(6).trim();
      } else if (normalizedLine.startsWith("data:")) {
        data.push(normalizedLine.slice(5).trimStart());
      }
    }
    if (data.length === 0) return;

    let payload;
    try {
      payload = JSON.parse(data.join("\n"));
    } catch {
      throw new Error("Le service OCR Premium a transmis un événement invalide.");
    }

    if (event === "progress") {
      if (typeof payload.stage !== "string") {
        throw new Error("Le service OCR Premium a transmis une étape invalide.");
      }
      if (onProgress) onProgress(payload.stage);
    } else if (event === "result") {
      result = payload;
      if (onProgress) onProgress("result_received");
    } else if (event === "error") {
      throw new Error(
        `Erreur du service Gemini Vision : ${
          payload.detail || "Le traitement OCR Premium a échoué."
        }`,
      );
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder
        .decode(value, { stream: !done })
        .replace(/\r\n/g, "\n");

      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        dispatch(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
      }

      if (done) break;
    }

    if (buffer.trim()) dispatch(buffer);
  } finally {
    reader.releaseLock();
  }

  if (!result) {
    throw new Error("Le service Gemini Vision n'a pas transmis de résultat final.");
  }
  return result;
}
