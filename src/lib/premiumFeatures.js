/**
 * Registre centralisé des fonctionnalités réservées à la version Premium.
 *
 * Toute nouvelle fonctionnalité payante (voix cloud, scan OCR automatique,
 * espace metteur en scène avancé, bruitages...) doit être déclarée ici avec
 * une clé stable, un titre et un message d'incitation. Cela évite de
 * dupliquer le texte du paywall dans chaque page et centralise le contrôle
 * d'accès Premium en un seul endroit.
 */
export const PREMIUM_FEATURES = {
  AI_COACHING: {
    key: "AI_COACHING",
    title: "Coaching IA",
    description:
      "Le Coaching IA personnalisé pour chaque personnage est réservé aux abonnés Premium. Passez au niveau supérieur pour améliorer votre jeu d'acteur !",
  },
  OCR_AUTO: {
    key: "OCR_AUTO",
    title: "Scan Express (OCR automatique)",
    description:
      "La détection automatique des personnages et des scènes, sans aucune saisie manuelle, est réservée aux abonnés Premium. Le Scan Classique reste disponible gratuitement.",
  },
  VOICES_CLOUD: {
    key: "VOICES_CLOUD",
    title: "Voix de synthèse premium",
    description:
      "Les voix de synthèse françaises haute qualité sont réservées aux abonnés Premium. La version Standard utilise les voix intégrées à votre appareil.",
  },
  DIRECTOR_ADVANCED: {
    key: "DIRECTOR_ADVANCED",
    title: "Espace metteur en scène avancé",
    description:
      "La revocalisation automatique et la synchronisation en temps réel avec votre troupe sont réservées aux abonnés Premium.",
  },
  SOUND_EFFECTS: {
    key: "SOUND_EFFECTS",
    title: "Bruitages et effets sonores",
    description:
      "L'ajout de bruitages et d'effets sonores dans vos répétitions audio est réservé aux abonnés Premium.",
  },
};

/**
 * Vérifie si une fonctionnalité Premium est accessible pour l'utilisateur courant.
 * @param {string} featureKey - Une des clés de PREMIUM_FEATURES
 * @param {boolean} isPremium - Statut Premium de l'utilisateur (depuis authStore)
 * @returns {boolean}
 */
export function canAccessPremiumFeature(featureKey, isPremium) {
  if (!PREMIUM_FEATURES[featureKey]) {
    console.warn(
      `[premiumFeatures] Clé de fonctionnalité inconnue : ${featureKey}`,
    );
  }
  return !!isPremium;
}
