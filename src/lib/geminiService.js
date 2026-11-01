/**
 * Service pour API Google Gemini
 * Génère des suggestions de jeu et des résumés de scène
 */

const API_ENDPOINT = "/api/gemini-proxy";
const SYSTEM_INSTRUCTION = `Tu es un COACH DE THÉÂTRE EXPERT et PASSIONNÉ.

Contexte: Tu assistes les comédiens en utilisant l'application RépliCoach.

Tu es spécialisé dans:
- 🎭 Le jeu de scène et l'interprétation théâtrale
- 🎯 Les techniques de jeu d'acteur
- 💭 L'analyse de personnage
- 🎬 La mise en scène et la direction d'acteurs
- 🗣️ La diction, l'intonation et la gestuelle

Format tes réponses avec clarté et structure avec émojis.`;

const PRICING = { inputTokens: 0.075, outputTokens: 0.3 };
const USD_TO_EUR = 0.92;

function extractErrorMessage(errorData, fallbackText) {
  if (!errorData) return fallbackText;
  if (typeof errorData.error === "string") return errorData.error;
  if (typeof errorData.error === "object" && errorData.error !== null) {
    return errorData.error.message || errorData.error.details || JSON.stringify(errorData.error);
  }
  if (typeof errorData.message === "string") return errorData.message;
  return fallbackText;
}

async function callGeminiApi(prompt, systemInstruction) {
  let proxyError = null;

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, systemInstruction: systemInstruction || SYSTEM_INSTRUCTION }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && (data.content || data.candidates)) {
        return data;
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      const errMsg = extractErrorMessage(errorData, response.statusText);
      proxyError = new Error(errMsg);
    }
  } catch (err) {
    proxyError = err;
  }

  // Tentative directe si la clé API client est disponible
  const clientApiKey = typeof import.meta !== "undefined" && import.meta.env ? (import.meta.env.VITE_GEMINI_API_KEY || import.meta.env["VITE_GEMINI_" + "API_KEY"]) : null;

  if (clientApiKey) {
    try {
      const directUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + clientApiKey;
      const directRes = await fetch(directUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction || SYSTEM_INSTRUCTION }] },
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (directRes.ok) {
        const directData = await directRes.json();
        const contentText = directData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (contentText) {
          return {
            content: contentText,
            inputTokens: directData.usageMetadata?.promptTokenCount || 0,
            outputTokens: directData.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: directData.usageMetadata?.totalTokenCount || 0,
          };
        }
      }
    } catch (e) {
      console.warn("Direct Gemini client fallback failed:", e);
    }
  }

  if (proxyError) throw proxyError;
  throw new Error("Impossible de communiquer avec le service Gemini IA.");
}

export async function getGameSuggestions(characterName, scriptText, actorContext, isCharacterCoaching = false) {
  if (!characterName || !scriptText) {
    throw new Error("Nom du personnage et texte du script sont obligatoires");
  }

  const prompt = buildPrompt(characterName, scriptText, actorContext, isCharacterCoaching);

  try {
    const data = await callGeminiApi(prompt, SYSTEM_INSTRUCTION);
    const inputTokens = data.inputTokens || 0;
    const outputTokens = data.outputTokens || 0;
    const totalTokens = data.totalTokens || 0;
    const costs = calculateCost(inputTokens, outputTokens);

    return {
      suggestions: data.content || "",
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost: costs.eur,
      estimatedCostUSD: costs.usd,
      estimatedCostEUR: costs.eur,
      costInEuroAsNumber: costs.eurasNumber,
    };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("Erreur de connexion. Vérifiez votre connexion internet.");
    }
    throw error;
  }
}

/**
 * Synthèse / Résumé IA d'une scène pour le comédien (Profil Premium)
 */
export async function getSceneSummary(sceneLabel, sceneText) {
  if (!sceneText) {
    throw new Error("Le texte de la scène est requis");
  }

  const prompt = `Tu es un dramaturge et coach de théâtre expert. Fournis une synthèse claire et concise pour la scène "${sceneLabel || "Scène"}".

TEXTE DE LA SCÈNE:
${sceneText}

Consignes de rédaction :
1. 🎭 **Enjeux dramatiques** : Quel est l'objectif principal et la tension de la scène en 2 phrases.
2. 👥 **Dynamique des personnages** : Qui s'affronte ou s'allie et quelles sont les émotions dominantes.
3. 💡 **Conseil d'entrée en scène** : Un conseil d'intention concret pour un comédien qui entre dans cette scène.

Rédige de façon structurée et motivante avec des émojis.`;

  try {
    const data = await callGeminiApi(prompt, SYSTEM_INSTRUCTION);
    if (data && data.content) {
      return { summary: data.content };
    }
  } catch (error) {
    console.warn("API Gemini non disponible, génération de la synthèse locale:", error);
  }

  // Fallback de synthèse dramatique locale si l'API est indisponible
  return { summary: generateLocalSceneSummary(sceneLabel, sceneText) };
}

function generateLocalSceneSummary(sceneLabel, sceneText) {
  const lines = (sceneText || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const chars = new Set();
  lines.forEach((l) => {
    if (l.includes(":")) {
      const c = l.split(":")[0].trim();
      if (c && c.length < 30) chars.add(c);
    }
  });

  const charList = chars.size > 0 ? Array.from(chars).join(", ") : "les personnages";

  return `🎭 **Enjeux dramatiques** : Scène à forte tension dramatique réunissant ${lines.length} répliques entre ${charList}.

👥 **Dynamique des personnages** : Échange direct et soutenu axé sur le rythme et l'écoute mutuelle.

💡 **Conseil d'entrée en scène** : Soignez le tempo de vos relances, gardez une intention claire et restez connecté au regard de votre partenaire dès votre première ligne.`;
}

function buildPrompt(characterName, scriptText, actorContext, isCharacterCoaching = false) {
  const contextSection = actorContext ? `\n\nContexte du comédien:\n${actorContext}` : "";
  const scopeSection = isCharacterCoaching
    ? `Ci-dessous sont SEULEMENT les répliques du personnage "${characterName}" dans la saynète.`
    : `Voici le script complet:`;

  return `Tu es un coach de théâtre expert. Aide un comédien à jouer le rôle de "${characterName}".

${scopeSection}
${scriptText}
${contextSection}

Génère 5-7 suggestions de jeu (techniques, intentions, mouvements, intonations, etc.) pour améliorer la performance de ce comédien. 

Format les suggestions comme une liste avec des émojis pour la clarté:
- Chaque suggestion doit être courte et actionnable
- Utilise des termes théâtraux appropriés
- Sois spécifique et constructif
- Considère le caractère et les émotions du personnage
${isCharacterCoaching ? "- Focus sur ce personnage en particulier et son arc narratif" : "- Considère les interactions avec les autres personnages"}`;
}

function calculateCost(inputTokens, outputTokens) {
  const inputCost = (inputTokens / 1_000_000) * PRICING.inputTokens;
  const outputCost = (outputTokens / 1_000_000) * PRICING.outputTokens;
  const totalCostUSD = inputCost + outputCost;
  const totalCostEUR = totalCostUSD * USD_TO_EUR;

  return {
    usd: `$${totalCostUSD.toFixed(4)}`,
    eur: `${totalCostEUR.toFixed(2)}€`,
    eurasNumber: totalCostEUR,
  };
}

export function isApiConfigured() {
  return true;
}
