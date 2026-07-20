/**
 * Serverless function Vercel pour proxier les appels Gemini avec support PDF
 * Cela cache la clé API et la rend disponible au runtime
 */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const API_KEY = process.env.VITE_GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const { pdfBase64, prompt } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ error: "pdfBase64 is required" });
    }
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
        API_KEY,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: pdfBase64,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1, // Température basse pour une meilleure précision du JSON
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json(error);
    }

    const data = await response.json();

    // Extraire les tokens et le contenu
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const usageMetadata = data.usageMetadata || {};

    return res.status(200).json({
      content,
      inputTokens: usageMetadata.promptTokenCount || 0,
      outputTokens: usageMetadata.candidatesTokenCount || 0,
      totalTokens: usageMetadata.totalTokenCount || 0,
    });
  } catch (error) {
    console.error("Gemini PDF API error:", error);
    return res.status(500).json({ error: error.message });
  }
}
