// Génère une fois les échantillons audio statiques des voix Premium.
// Usage : node scripts/generate-tts-samples.mjs   (GOOGLE_TTS_API_KEY dans .env.local)
import fs from "node:fs";
import path from "node:path";
import { TTS_VOICES, TTS_SAMPLE_TEXT } from "../src/lib/ttsVoices.js";

const env = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
const key =
  process.env.GOOGLE_TTS_API_KEY || env.match(/^GOOGLE_TTS_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) {
  console.error("GOOGLE_TTS_API_KEY manquante");
  process.exit(1);
}

const outDir = path.join("public", "tts-samples");
fs.mkdirSync(outDir, { recursive: true });

for (const voice of TTS_VOICES) {
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: TTS_SAMPLE_TEXT },
        voice: { languageCode: "fr-FR", name: voice.id },
        audioConfig: { audioEncoding: "MP3" },
      }),
    }
  );
  if (!res.ok) {
    console.error(`${voice.id}: HTTP ${res.status}`);
    continue;
  }
  const { audioContent } = await res.json();
  fs.writeFileSync(path.join(outDir, `${voice.id}.mp3`), Buffer.from(audioContent, "base64"));
  console.log(`OK ${voice.id}`);
}
