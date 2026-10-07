// Configuration partagée (front + endpoint /api/tts) des voix Premium.
export const TTS_MONTHLY_QUOTA_CHARS = 250000;
export const TTS_MAX_CHARS_PER_REQUEST = 1000;

export const TTS_VOICES = [
  { id: "fr-FR-Chirp3-HD-Achernar", label: "Achernar", gender: "female" },
  { id: "fr-FR-Chirp3-HD-Aoede", label: "Aoede", gender: "female" },
  { id: "fr-FR-Chirp3-HD-Kore", label: "Kore", gender: "female" },
  { id: "fr-FR-Chirp3-HD-Achird", label: "Achird", gender: "male" },
  { id: "fr-FR-Chirp3-HD-Charon", label: "Charon", gender: "male" },
  { id: "fr-FR-Chirp3-HD-Puck", label: "Puck", gender: "male" },
];

export const TTS_SAMPLE_TEXT =
  "Bonjour, voici un aperçu de ma voix. Je suis prêt à donner la réplique.";

export function isAllowedVoice(voiceId) {
  return TTS_VOICES.some((v) => v.id === voiceId);
}

export function ttsSamplePath(voiceId) {
  return `/tts-samples/${voiceId}.mp3`;
}

// Nettoyage du texte envoyé à Google (aligné sur le lecteur navigateur).
export function cleanTextForTts(text) {
  return String(text || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
