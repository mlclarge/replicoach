/**
 * Service pour l'API Google Gemini
 * Génère des suggestions de jeu et résumés de scène basés sur le contexte du comédien
 * Utilise une serverless function Vercel pour sécuriser la clé API
 */

const API_ENDPOINT = "/api/gemini-proxy";

// System instruction globale pour l'IA théâtre
const SYSTEM_INSTRUCTION = `Tu es un COACH DE THÉÂTRE EXPERT et PASSIONNÉ.

Contexte: Tu assistes les comédiens en utilisant l'application ReplicoACH, une plateforme d'apprentissage théâtral collaborative.

Tu es spécialisé dans:
- 🎭 Le jeu de scène et l'interprétation théâtrale
- 🎯 Les techniques de jeu d'acteur (Stanislavski, Meisner, Chekhov, etc.)
- 💭 L'analyse de personnage et la psychologie des rôles
- 🎬 La mise en scène et la direction d'acteurs
- 🗣️ La diction, l'intonation et la gestuelle scénique
- ⚡ L'engagement physique et émotionnel sur scène
- 🎪 Les saynètes, sketches et exercices de théâtre

Ton approche:
✅ Sois précis et actionnable - chaque conseil doit être applicable immédiatement
✅ Utilise la terminologie théâtrale appropriée
✅ Sois constructif et encourageant
✅ Considère le contexte artistique et émotionnel
✅ Donne des exemples concrets quand pertinent
✅ Focus sur l'écoute active, les émotions authentiques et la présence scénique

Format tes réponses avec clarté et structure.`;

const PRICING = {
  inputTokens: 0.075,
  outputTokens: 0.3,
};

const USD_TO_EUR = 0.92;

export async function getGameSuggestions(
  characterName,
  scriptText,
  actorContext,
  isCharacterCoaching = false,
) {
  if (!characterName || !scriptText) {
    throw new Error("Nom du personnage et texte du script sont obligatoires");
  }

  const prompt = buildPrompt(
    characterName,
    scriptText,
    actorContext,
    isCharacterCoaching,
  );

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        systemInstruction: SYSTEM_INSTRUCTION,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Erreur API Gemini: ${errorData.error || response.statusText}`,
      );
    }

    const data = await response.json();

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
      throw new Error(
        "Erreur de connexion. Vérifiez votre connexion internet.",
      );
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

  const prompt = `Tu es un dramaturge et coach de théâtre expert. Fournis une synthèse claire et concise pour la scène "${sceneLabel || 'Scène'}".

TEXTE DE LA SCÈNE:
${sceneText}

Consignes de rédaction :
1. 🎭 **Enjeux dramatiques** : Quel est l'objectif principal et la tension de la scène en 2 phrases.
2. 👥 **Dynamique des personnages** : Qui s'affronte ou s'allie et quelles sont les émotions dominantes.
3. 💡 **Conseil d'entrée en scène** : Un conseil d'intention concret pour un comédien qui entre dans cette scène.

Rédige de façon structurée et motivante avec des émojis.`;

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        systemInstruction: SYSTEM_INSTRUCTION,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Erreur API Gemini: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    return {
      summary: data.content || "",
    };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("Erreur de connexion. Vérifiez votre connexion internet.");
    }
    throw error;
  }
}

function buildPrompt(
  characterName,
  scriptText,
  actorContext,
  isCharacterCoaching = false,
) {
  const contextSection = actorContext
    ? `\n\nContexte du comédien:\n${actorContext}`
    : "";

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
