/**
 * Service de traitement des PDF via Google Gemini (Scan Premium)
 */

/**
 * Convertit un fichier en chaîne Base64
 * @param {File} file - Le fichier à convertir
 * @returns {Promise<string>} La chaîne base64 sans le préfixe dataURL
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      try {
        const base64String = reader.result.split(",")[1];
        resolve(base64String);
      } catch (err) {
        reject(new Error("Erreur de décodage base64 du fichier"));
      }
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Envoie un PDF à l'API Gemini pour analyse complète du script théâtral
 * @param {File} file - Fichier PDF du script
 * @param {function} onProgress - Callback de progression
 * @returns {Promise<{title: string, characters: Array, replicas: Array}>} Le script analysé
 */
export async function processWithGemini(file, onProgress) {
  if (!file) {
    throw new Error("Aucun fichier fourni pour le scan premium");
  }

  try {
    if (onProgress) onProgress(0.1); // Début de conversion

    const pdfBase64 = await fileToBase64(file);

    if (onProgress) onProgress(0.3); // Fin de conversion, envoi au serveur

    const prompt = `Analyse ce script de théâtre (document PDF joint) et extrais-en toutes les répliques et tous les personnages de manière structurée.
Tu dois retourner OBLIGATOIREMENT un objet JSON respectant exactement le schéma suivant :
{
  "title": "Le titre de la pièce ou de la scène (extrait du début ou déduit du contexte)",
  "characters": [
    "Nom du Personnage 1 en MAJUSCULES (ex: QUERROCHOT)",
    "Nom du Personnage 2 en MAJUSCULES (ex: JEAN)"
  ],
  "replicas": [
    {
      "character": "Nom exact du personnage qui parle en MAJUSCULES (ex: QUERROCHOT)",
      "text": "Le texte complet et exact de la réplique (incluant les didascalies éventuelles entre parenthèses)"
    }
  ]
}

Règles de parsing strictes à respecter :
1. Identifie d'abord tous les personnages parlants. Leurs noms dans la liste "characters" doivent être uniques et en MAJUSCULES.
2. Extraits TOUTES les répliques dans l'ordre chronologique exact, du début à la fin. Ne résume pas, ne tronque pas, conserve l'intégralité du texte.
3. Résous les alias ou abréviations : si un personnage est parfois écrit sous forme courte (ex: "QQ", "QUER.", "QUERROCHOT"), associe toutes ses répliques à son nom principal unique (ex: "QUERROCHOT").
4. Pour chaque réplique, le champ "character" doit correspondre exactement à l'une des entrées de la liste "characters".
5. Si des bruits de fond ou des indications génériques non parlées comme "CQ", "VOIX" ou "TOUS" apparaissent, filtre-les ou attribue-les seulement s'ils parlent réellement dans une réplique d'ensemble.
6. Ne retourne RIEN d'autre que du JSON. Pas de markdown, pas de blocs de code (comme \`\`\`json), pas de commentaires d'explications. Juste l'objet JSON.
7. Tu dois IMPÉRATIVEMENT renvoyer un JSON valide. Veille à bien échapper tous les guillemets et caractères spéciaux à l'intérieur des chaînes de texte.
IMPORTANT : Tu dois impérativement échapper tous les guillemets doubles à l'intérieur des chaînes de caractères avec un antislash (\"). Préfère l'utilisation de guillemets simples (') à l'intérieur du texte.`;

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Clé API Gemini non configurée dans l'environnement");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    console.log("Appel Gemini sur :", url);

    const response = await fetch(url, {
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
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    });

    if (onProgress) onProgress(0.8); // Réponse reçue, traitement

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error?.message || response.statusText;
      throw new Error(`Erreur service Gemini: ${errorMessage}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!content) {
      throw new Error("L'API Gemini n'a retourné aucun contenu");
    }

    // Nettoyer d'éventuels résidus markdown de code blocks (```json) bien que demandés exclus
    let cleanText = content
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const firstBrace = cleanText.indexOf("{");
    const firstBracket = cleanText.indexOf("[");
    const firstIndex = Math.min(
      firstBrace !== -1 ? firstBrace : Infinity,
      firstBracket !== -1 ? firstBracket : Infinity,
    );
    const lastBrace = cleanText.lastIndexOf("}");
    const lastBracket = cleanText.lastIndexOf("]");
    const lastIndex = Math.max(lastBrace, lastBracket);
    if (firstIndex !== Infinity && lastIndex !== -1) {
      cleanText = cleanText.substring(firstIndex, lastIndex + 1);
    }

    let jsonResult;
    try {
      jsonResult = JSON.parse(cleanText);
    } catch (error) {
      console.error(
        "🚨 Erreur de parsing JSON. Voici le texte brut généré par Gemini qui a causé l'erreur :",
      );
      console.log(cleanText);
      throw new Error(
        "Erreur de syntaxe JSON renvoyée par l'IA. Vérifiez la console pour voir le texte brut.",
      );
    }
    const parsedData = jsonResult;

    if (!parsedData.title || !parsedData.characters || !parsedData.replicas) {
      throw new Error("Format JSON retourné incomplet ou invalide");
    }

    if (onProgress) onProgress(1.0); // Terminé

    return {
      title: parsedData.title,
      characters: parsedData.characters.map((name) => ({
        name: name.toUpperCase(),
      })),
      replicas: parsedData.replicas,
    };
  } catch (error) {
    console.error("Erreur dans processWithGemini:", error);
    throw new Error(`Échec du scan express : ${error.message}`);
  }
}
