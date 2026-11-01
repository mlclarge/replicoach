/**
 * Service pour API Google Gemini
 */

const API_ENDPOINT = "/api/gemini-proxy";
const SYSTEM_INSTRUCTION = `Tu es un COACH DE THEATRE EXPERT et PASSIONNE.`;
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
      return await response.json();
    } else {
      const errorData = await response.json().catch(() => ({}));
      const errMsg = extractErrorMessage(errorData, response.statusText);
      proxyError = new Error(errMsg);
    }
  } catch (err) {
    proxyError = err;
  }

  const clientApiKey = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env["VITE_GEMINI_" + "API_KEY"] : null;

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
        return {
          content: contentText,
          inputTokens: directData.usageMetadata?.promptTokenCount || 0,
          outputTokens: directData.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: directData.usageMetadata?.totalTokenCount || 0,
        };
      }
    } catch (e) {
      console.warn("Direct Gemini client fallback failed:", e);
    }
  }

  throw proxyError || new Error("Impossible de communiquer avec le service Gemini IA.");
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
      throw new Error("Erreur de connexion. Verifiez votre connexion internet.");
    }
    throw error;
  }
}

export async function getSceneSummary(sceneLabel, sceneText) {
  if (!sceneText) {
    throw new Error("Le texte de la scene est requis");
  }

  const prompt = `Tu es un dramaturge et coach de theatre expert. Fournis une synthese claire et concise pour la scene "${sceneLabel || "Scene"}".

TEXTE DE LA SCENE:
${sceneText}

Consignes de redaction :
1. 🎭 **Enjeux dramatiques** : Quel est l objectif principal et la tension de la scene en 2 phrases.
2. 👥 **Dynamique des personnages** : Qui s affronte ou s allie et quelles sont les emotions dominantes.
3. 💡 **Conseil d entree en scene** : Un conseil d intention concret pour un comedien qui entre dans cette scene.

Redige de facon structuree et motivante avec des emojies.`;

  try {
    const data = await callGeminiApi(prompt, SYSTEM_INSTRUCTION);
    return { summary: data.content || "" };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("Erreur de connexion. Verifiez votre connexion internet.");
    }
    throw error;
  }
}

function buildPrompt(characterName, scriptText, actorContext, isCharacterCoaching = false) {
  const contextSection = actorContext ? `\n\nContexte du comedien:\n${actorContext}` : "";
  const scopeSection = isCharacterCoaching
    ? `Ci-dessous sont SEULEMENT les repliques du personnage "${characterName}" dans la saynete.`
    : `Voici le script complet:`;

  return `Tu es un coach de theatre expert. Aide un comedien a jouer le role de "${characterName}".

${scopeSection}
${scriptText}
${contextSection}

Genere 5-7 suggestions de jeu (techniques, intentions, mouvements, intonations, etc.) pour ameliorer la performance de ce comedien. 

Format les suggestions comme une liste avec des emojies pour la clarte:
- Chaque suggestion doit etre courte et actionnable
- Utilise des termes theatraux appropries
- Sois specifique et constructif
- Considere le caractere et les emotions du personnage
${isCharacterCoaching ? "- Focus sur ce personnage en particulier et son arc narratif" : "- Considere les interactions avec les autres personnages"}`;
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
