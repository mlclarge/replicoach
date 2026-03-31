/**
 * Service pour l'API Google Gemini
 * Génère des suggestions de jeu basées sur le contexte du comédien
 */

const API_KEY = typeof __VITE_GEMINI_API_KEY__ !== 'undefined' ? __VITE_GEMINI_API_KEY__ : '';
const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

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

// Estimation des coûts (en dollars par 1M tokens)
const PRICING = {
  inputTokens: 0.075,    // $0.075 par 1M tokens input
  outputTokens: 0.30,    // $0.30 par 1M tokens output
};

// Taux de change USD/EUR
const USD_TO_EUR = 0.92;

/**
 * Génère des suggestions de jeu pour un comédien
 * @param {string} characterName - Nom du personnage
 * @param {string} scriptText - Texte complet du script avec répliques
 * @param {string} actorContext - Contexte/instructions du comédien
 * @param {boolean} isCharacterCoaching - Si true, suggestions ciblées pour ce personnage uniquement
 * @returns {Promise<{suggestions: string, inputTokens: number, outputTokens: number, totalTokens: number, estimatedCost: string}>}
 */
export async function getGameSuggestions(characterName, scriptText, actorContext, isCharacterCoaching = false) {
  if (!API_KEY) {
    throw new Error(
      "Clé API Gemini non configurée. Veuillez ajouter VITE_GEMINI_API_KEY au fichier .env"
    );
  }

  if (!characterName || !scriptText) {
    throw new Error(
      "Nom du personnage et texte du script sont obligatoires"
    );
  }

  const prompt = buildPrompt(characterName, scriptText, actorContext, isCharacterCoaching);

  try {
    const response = await fetch(`${API_ENDPOINT}?key=${API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: SYSTEM_INSTRUCTION,
            },
          ],
        },
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Erreur API Gemini: ${errorData.error?.message || response.statusText}`
      );
    }

    const data = await response.json();

    // Extraire les tokens et le texte
    const generatedText =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const usageMetadata = data.usageMetadata || {};

    const inputTokens = usageMetadata.promptTokenCount || 0;
    const outputTokens = usageMetadata.candidatesTokenCount || 0;
    const totalTokens = inputTokens + outputTokens;

    const costs = calculateCost(inputTokens, outputTokens);

    return {
      suggestions: generatedText,
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
        "Erreur de connexion. Vérifiez votre connexion internet."
      );
    }
    throw error;
  }
}

/**
 * Construit le prompt pour Gemini
 */
function buildPrompt(characterName, scriptText, actorContext, isCharacterCoaching = false) {
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

/**
 * Calcule le coût estimé en fonction des tokens utilisés
 * Retourne les coûts en USD et EUR
 */
function calculateCost(inputTokens, outputTokens) {
  // Calcul : (tokens * prix par token) avec prix pour 1M tokens
  const inputCost = (inputTokens / 1_000_000) * PRICING.inputTokens;
  const outputCost = (outputTokens / 1_000_000) * PRICING.outputTokens;
  const totalCostUSD = inputCost + outputCost;
  const totalCostEUR = totalCostUSD * USD_TO_EUR;

  // Retourne les deux formats avec une décimale pour l'affichage
  return {
    usd: `$${totalCostUSD.toFixed(4)}`,
    eur: `${totalCostEUR.toFixed(2)}€`,
    eurasNumber: totalCostEUR,
  };
}

/**
 * Vérifie si l'API est configurée
 */
export function isApiConfigured() {
  return !!API_KEY;
}
