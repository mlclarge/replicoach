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
      if (data && data.content) return data;
    } else {
      const errorData = await response.json().catch(() => ({}));
      const errMsg = extractErrorMessage(errorData, response.statusText);
      proxyError = new Error(errMsg);
    }
  } catch (err) {
    proxyError = err;
  }

  throw proxyError || new Error("Service Gemini IA indisponible.");
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
    console.warn("Génération de suggestions de jeu locales suite à indisponibilité API Gemini:", error);
    return {
      suggestions: `🎭 **Conseils d'interprétation pour ${characterName}** :

1. 🎯 **Intention principale** : Définissez clairement l'objectif de votre personnage dans chaque réplique.
2. 🗣️ **Intonation & Diction** : Variez le rythme et marquez les silences stratégiques pour installer la tension.
3. 👁️ **Écoute active** : Restez connecté au regard et aux réactions de vos partenaires avant de répondre.
4. ⚡ **Engagement physique** : Ancrez vos appuis et adaptez vos mouvements au sous-texte.
5. 💭 **Sous-texte** : Identifiez l'émotion profonde derrière les mots.`,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: "0.00€",
      estimatedCostUSD: "$0.0000",
      estimatedCostEUR: "0.00€",
      costInEuroAsNumber: 0,
    };
  }
}

export async function getSceneSummary(sceneLabel, sceneText) {
  if (!sceneText) {
    throw new Error("Le texte de la scène est requis");
  }

  const MAX_CHARS = 6000;
  let text = sceneText;
  if (text.length > MAX_CHARS) {
    const part = MAX_CHARS / 3;
    const mid = Math.floor(text.length / 2 - part / 2);
    text = `${text.slice(0, part)}\n[...]\n${text.slice(mid, mid + part)}\n[...]\n${text.slice(-part)}`;
  }
  const label = (sceneLabel || "Scène").slice(0, 80);

  const prompt = `Résume en français la scène de théâtre "${label}" pour un comédien. Reformule avec tes propres mots, ne recopie jamais le texte.

TEXTE DE LA SCÈNE:
${text}

Format strict, 3 lignes courtes (1 à 2 phrases chacune), sans introduction :
🎭 **Enjeu** : ce qui se joue dans la scène.
👥 **Personnages** : qui veut quoi, et les relations.
🎨 **Ton** : l'ambiance et l'émotion dominante.`;

  const data = await callGeminiApi(prompt, SYSTEM_INSTRUCTION);
  if (!data || !data.content) {
    throw new Error("Résumé IA indisponible. Réessayez dans un instant.");
  }
  return { summary: data.content.trim() };
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
