// Configuration partagée (front + endpoint /api/tts) des voix Premium Google Cloud.
export const TTS_MONTHLY_QUOTA_CHARS = 250000;
export const TTS_MAX_CHARS_PER_REQUEST = 1000;

export const TTS_VOICES = [
  // 👩 10 Voix Féminines Premium Google Cloud
  { id: "fr-FR-Neural2-A", label: "Neural A (Fluide & Naturelle)", gender: "female" },
  { id: "fr-FR-Neural2-C", label: "Neural C (Chaleureuse & Posée)", gender: "female" },
  { id: "fr-FR-Wavenet-A", label: "Wavenet A (Expressive)", gender: "female" },
  { id: "fr-FR-Wavenet-C", label: "Wavenet C (Douce)", gender: "female" },
  { id: "fr-FR-Wavenet-E", label: "Wavenet E (Jeune & Dynamique)", gender: "female" },
  { id: "fr-FR-Standard-A", label: "Standard A (Classique)", gender: "female" },
  { id: "fr-FR-Standard-C", label: "Standard C (Neutre)", gender: "female" },
  { id: "fr-FR-Standard-E", label: "Standard E (Institutionnelle)", gender: "female" },
  { id: "fr-FR-Chirp3-HD-Aoede", label: "Aoede HD (Studio High-Def)", gender: "female" },
  { id: "fr-FR-Chirp3-HD-Kore", label: "Kore HD (Studio Expressive)", gender: "female" },

  // 👨 5 Voix Masculines Premium Google Cloud
  { id: "fr-FR-Neural2-B", label: "Neural B (Grave & Prodonde)", gender: "male" },
  { id: "fr-FR-Neural2-D", label: "Neural D (Médium Chaleureux)", gender: "male" },
  { id: "fr-FR-Wavenet-B", label: "Wavenet B (Théâtre Classique)", gender: "male" },
  { id: "fr-FR-Wavenet-D", label: "Wavenet D (Rythmée)", gender: "male" },
  { id: "fr-FR-Chirp3-HD-Puck", label: "Puck HD (Studio High-Def)", gender: "male" },
];

export const TTS_SAMPLE_TEXT =
  "Bonjour, voici un aperçu de ma voix. Je suis prêt à donner la réplique.";

export function isAllowedVoice(voiceId) {
  return TTS_VOICES.some((v) => v.id === voiceId);
}

export function ttsSamplePath(voiceId) {
  return ;
}

export function cleanTextForTts(text) {
  return String(text || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
