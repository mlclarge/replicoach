// /api/copy-public-to-private.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Jamais côté client !
);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Méthode non autorisée" });
    }

    const { sourcePath, fileName, userId } = req.body;
    if (!sourcePath || !fileName || !userId) {
      return res.status(400).json({ error: "Paramètres manquants" });
    }

    // 1. Télécharger le fichier source
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("public-documents")
      .download(sourcePath);

    if (downloadError || !fileData) {
      return res
        .status(500)
        .json({ error: "Erreur téléchargement source", details: downloadError });
    }

    // 2. Réuploader dans scripts-pdfs
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const newFileName = `${userId}/${timestamp}_${safeName}`;

    // fileData est un ReadableStream, il faut le convertir en Buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("scripts-pdfs")
      .upload(newFileName, buffer, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError || !uploadData?.path) {
      return res
        .status(500)
        .json({ error: "Erreur upload destination", details: uploadError });
    }

    // 3. Retourner le chemin du nouveau fichier
    return res.status(200).json({ newPath: uploadData.path });
  } catch (err) {
    // Attraper toute erreur inattendue et garantir une réponse JSON
    return res.status(500).json({ error: "Erreur serveur inattendue", details: err?.message || err?.toString() });
  }
}
