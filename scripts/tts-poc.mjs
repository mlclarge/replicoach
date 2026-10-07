import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile, stat, copyFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

const APP_DATA = path.join(
  process.env.LOCALAPPDATA || os.homedir(),
  "Replicoach",
  "tts-poc",
);
const AUDIO_CACHE = path.join(APP_DATA, "audio-cache");
const DEFAULT_RESULTS = path.join(APP_DATA, "results.json");
const MAX_SAMPLES = 6;
const MAX_SAMPLE_CHARACTERS = 500;

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!["--ocr", "--run", "--output", "--help"].includes(argument)) {
      throw new Error(`Option inconnue : ${argument}`);
    }
    if (argument === "--help") {
      options.help = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Valeur manquante après ${argument}.`);
    }
    options[argument.slice(2)] = value;
    index += 1;
  }
  if (options.ocr && options.run) {
    throw new Error("Utilisez --ocr ou --run, pas les deux.");
  }
  if (!options.help && !options.ocr && !options.run) {
    throw new Error("Indiquez --ocr <pdf> ou --run <samples.json>.");
  }
  return options;
}

function printHelp() {
  console.log(
    [
      "OCR local du PDF :",
      '  node scripts/tts-poc.mjs --ocr "depit amoureux.pdf" --output "$env:TEMP\\replicoach-tts-poc-ocr.json"',
      "",
      "Génération comparative après sélection manuelle des extraits :",
      "  node scripts/tts-poc.mjs --run <samples.json>",
      "",
      "Les identifiants de clés pris en charge sont documentés dans scripts/README-tts-poc.md.",
    ].join("\n"),
  );
}

async function loadLocalEnvironment() {
  const envPath = path.resolve(".env.local");
  let contents;
  try {
    contents = await readFile(envPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] in process.env) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

async function extractPdfLocally(pdfPath, outputPath) {
  const [{ getDocument }, { createCanvas }, tesseract] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("@napi-rs/canvas"),
    import("tesseract.js"),
  ]);

  const document = await getDocument({
    data: new Uint8Array(await readFile(pdfPath)),
  }).promise;
  const worker = await tesseract.createWorker("fra", 1, {
    cachePath: path.join(os.tmpdir(), "replicoach-tesseract-cache"),
    logger: (message) => {
      if (message.status === "recognizing text") {
        process.stdout.write(
          `\rOCR local : page en cours (${Math.round(message.progress * 100)} %)`,
        );
      }
    },
  });
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      await page.render({
        canvasContext: canvas.getContext("2d"),
        viewport,
        canvas,
      }).promise;

      const { data } = await worker.recognize(canvas.toBuffer("image/png"));
      pages.push({
        page: pageNumber,
        confidence: Math.round(data.confidence),
        text: data.text.trim(),
      });
    }
  } finally {
    await worker.terminate();
    await document.destroy();
  }

  const result = {
    sourceFile: path.basename(pdfPath),
    createdAt: new Date().toISOString(),
    pages,
  };
  const destination = path.resolve(outputPath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`\nOCR local terminé : ${pages.length} pages. Fichier : ${destination}`);
  console.log("Aucun texte n'a été transmis à un fournisseur cloud.");
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variable locale requise : ${name}.`);
  return value;
}

async function requestJson(url, options, provider) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const detail = providerErrorMessage(await response.text());
    throw new Error(
      `${provider} a répondu HTTP ${response.status}.${detail ? ` ${detail}` : ""}`,
    );
  }
  return response.json();
}

async function getGoogleVoices() {
  const apiKey = requiredEnvironment("GOOGLE_TTS_API_KEY");
  const result = await requestJson(
    `https://texttospeech.googleapis.com/v1/voices?languageCode=fr-FR&key=${encodeURIComponent(apiKey)}`,
    {},
    "Google Cloud Text-to-Speech",
  );
  return (result.voices || [])
    .filter((voice) => voice.languageCodes?.includes("fr-FR"))
    .map((voice) => ({
      name: voice.name,
      gender: voice.ssmlGender,
    }))
    .sort((left, right) => {
      const priority = (name) =>
        name.includes("Chirp3-HD")
          ? 0
          : name.includes("Studio")
            ? 1
            : name.includes("Neural2")
              ? 2
              : name.includes("Wavenet")
                ? 3
                : 4;
      return priority(left.name) - priority(right.name);
    });
}

async function getAzureVoices() {
  const key = requiredEnvironment("AZURE_SPEECH_KEY");
  const region = requiredEnvironment("AZURE_SPEECH_REGION");
  const result = await requestJson(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
    { headers: { "Ocp-Apim-Subscription-Key": key } },
    "Azure AI Speech",
  );
  return result
    .filter(
      (voice) =>
        voice.Locale === "fr-FR" &&
        (!voice.VoiceType || voice.VoiceType === "Neural"),
    )
    .map((voice) => ({
      name: voice.ShortName,
      gender: String(voice.Gender).toUpperCase(),
    }));
}

async function getElevenLabsVoices() {
  const key = requiredEnvironment("ELEVENLABS_API_KEY");
  const voices = [];
  let nextPageToken;
  for (let page = 0; page < 5; page += 1) {
    const query = new URLSearchParams({
      page_size: "100",
      language: "fr",
      include_total_count: "false",
    });
    if (nextPageToken) query.set("next_page_token", nextPageToken);
    const result = await requestJson(
      `https://api.elevenlabs.io/v2/voices?${query}`,
      { headers: { "xi-api-key": key } },
      "ElevenLabs",
    );
    voices.push(
      ...(result.voices || []).map((voice) => {
        const languageLabels = [
          ...(voice.verified_languages || []).map((language) => language.language),
          voice.labels?.language,
        ]
          .filter(Boolean)
          .map((language) => String(language).toLowerCase());
        const gender = String(voice.labels?.gender || "").toUpperCase();
        const isFrench =
          languageLabels.includes("fr") ||
          languageLabels.includes("french") ||
          languageLabels.includes("français") ||
          languageLabels.includes("francais");
        return isFrench && ["FEMALE", "MALE"].includes(gender)
          ? {
              name: voice.name,
              id: voice.voice_id,
              gender,
            }
          : null;
      }).filter(Boolean),
    );
    if (
      ["FEMALE", "MALE"].every((gender) =>
        voices.some((voice) => voice.gender === gender),
      )
    ) {
      break;
    }
    nextPageToken = result.next_page_token;
    if (!nextPageToken) break;
  }
  return voices;
}

function voiceForGender(voices, gender, provider) {
  const match = voices.find((voice) => voice.gender === gender);
  if (!match) {
    const availableGenders = [
      ...new Set(voices.map((voice) => voice.gender.toLowerCase())),
    ];
    throw new Error(
      `${provider} ne fournit aucune voix française ${gender.toLowerCase()} dans ce compte. Genres disponibles : ${availableGenders.join(", ") || "aucun"}.`,
    );
  }
  return match;
}

function providerErrorMessage(responseBody, text) {
  let message = "";
  try {
    const payload = JSON.parse(responseBody);
    const detail = payload.detail ?? payload.message ?? payload.error;
    if (typeof detail === "string") {
      message = detail;
    } else if (detail) {
      const firstDetail = Array.isArray(detail) ? detail[0] : detail;
      if (typeof firstDetail?.msg === "string") message = firstDetail.msg;
      else if (typeof firstDetail?.message === "string") {
        message = firstDetail.message;
      }
      if (!message && typeof firstDetail?.code === "string") {
        message = firstDetail.code;
      }
    }
  } catch {
    // Provider responses are not guaranteed to be JSON.
  }

  for (const secret of [
    process.env.GOOGLE_TTS_API_KEY,
    process.env.AZURE_SPEECH_KEY,
    process.env.ELEVENLABS_API_KEY,
    text,
  ]) {
    if (secret) message = message.split(secret).join("[redacted]");
  }
  return message.replace(/\s+/g, " ").trim().slice(0, 240);
}

async function postAudio(url, options, provider, text) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const detail = providerErrorMessage(await response.text(), text);
    throw new Error(
      `${provider} a répondu HTTP ${response.status}.${detail ? ` ${detail}` : ""}`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

function escapeXml(text) {
  return text.replace(
    /[<>&'"]/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[character],
  );
}

async function synthesizeGoogle(voice, text) {
  const apiKey = requiredEnvironment("GOOGLE_TTS_API_KEY");
  const result = await requestJson(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "fr-FR", name: voice.name },
        audioConfig: { audioEncoding: "MP3", speakingRate: 1, pitch: 0 },
      }),
    },
    "Google Cloud Text-to-Speech",
  );
  if (!result.audioContent) {
    throw new Error("Google Cloud Text-to-Speech n'a renvoyé aucun audio.");
  }
  return Buffer.from(result.audioContent, "base64");
}

async function synthesizeAzure(voice, text) {
  const key = requiredEnvironment("AZURE_SPEECH_KEY");
  const region = requiredEnvironment("AZURE_SPEECH_REGION");
  const ssml = `<speak version="1.0" xml:lang="fr-FR"><voice xml:lang="fr-FR" name="${voice.name}"><prosody rate="0%" pitch="0%">${escapeXml(text)}</prosody></voice></speak>`;
  return postAudio(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "Replicoach-TTS-POC",
      },
      body: ssml,
    },
    "Azure AI Speech",
    text,
  );
}

async function synthesizeElevenLabs(voice, text) {
  const key = requiredEnvironment("ELEVENLABS_API_KEY");
  return postAudio(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.id)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
    "ElevenLabs",
    text,
  );
}

async function loadSamples(samplesPath) {
  const parsed = JSON.parse(await readFile(samplesPath, "utf8"));
  if (
    !Array.isArray(parsed.samples) ||
    parsed.samples.length === 0 ||
    parsed.samples.length > MAX_SAMPLES
  ) {
    throw new Error(`Le fichier doit contenir de 1 à ${MAX_SAMPLES} samples.`);
  }

  for (const [index, sample] of parsed.samples.entries()) {
    if (
      typeof sample.id !== "string" ||
      !/^[\w-]+$/.test(sample.id) ||
      typeof sample.text !== "string" ||
      !sample.text.trim() ||
      sample.text.length > MAX_SAMPLE_CHARACTERS ||
      !["FEMALE", "MALE"].includes(String(sample.gender).toUpperCase())
    ) {
      throw new Error(
        `Sample ${index + 1} invalide : fournissez un id, un texte de 1 à ${MAX_SAMPLE_CHARACTERS} caractères et gender FEMALE/MALE.`,
      );
    }
  }
  return parsed.samples.map((sample) => ({
    ...sample,
    text: sample.text.trim(),
    gender: String(sample.gender).toUpperCase(),
  }));
}

async function synthesizeWithCache(
  provider,
  voice,
  sample,
  synthesize,
  synthesisConfig,
) {
  const cacheKey = createHash("sha256")
    .update(
      JSON.stringify({
        provider,
        voice: voice.id || voice.name,
        model: provider === "ElevenLabs" ? "eleven_multilingual_v2" : "default",
        text: sample.text,
        synthesisConfig,
      }),
    )
    .digest("hex");
  const audioPath = path.join(AUDIO_CACHE, `${cacheKey}.mp3`);

  try {
    const cachedAudio = await readFile(audioPath);
    if (cachedAudio.length > 0) {
      let latencyMs = null;
      try {
        const metadata = JSON.parse(
          await readFile(`${audioPath}.json`, "utf8"),
        );
        if (Number.isFinite(metadata.latencyMs)) {
          latencyMs = metadata.latencyMs;
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      return {
        audioBytes: cachedAudio.length,
        audioPath,
        cacheHit: true,
        latencyMs,
      };
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const startedAt = performance.now();
  const audio = await synthesize(voice, sample.text);
  const latencyMs = Math.round(performance.now() - startedAt);
  if (audio.length === 0) throw new Error(`${provider} a renvoyé un audio vide.`);
  await mkdir(AUDIO_CACHE, { recursive: true });
  await writeFile(audioPath, audio, { flag: "wx" }).catch(async (error) => {
    if (error.code !== "EEXIST") throw error;
    await stat(audioPath);
  });
  await writeFile(
    `${audioPath}.json`,
    `${JSON.stringify({ latencyMs, audioBytes: audio.length })}\n`,
    "utf8",
  );
  return { audioBytes: audio.length, audioPath, cacheHit: false, latencyMs };
}

async function runComparison(samplesPath, outputPath) {
  await loadLocalEnvironment();
  const samples = await loadSamples(samplesPath);
  const missing = [
    ["GOOGLE_TTS_API_KEY"],
    ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"],
    ["ELEVENLABS_API_KEY"],
  ]
    .flat()
    .filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Configuration locale manquante : ${missing.join(", ")}. Ajoutez ces clés dans .env.local, sans les communiquer ici.`,
    );
  }

  const providers = [
    {
      name: "Google Cloud Text-to-Speech",
      loadVoices: getGoogleVoices,
      synthesize: synthesizeGoogle,
      synthesisConfig: { audioEncoding: "MP3", speakingRate: 1, pitch: 0 },
    },
    {
      name: "Azure AI Speech",
      loadVoices: getAzureVoices,
      synthesize: synthesizeAzure,
      synthesisConfig: {
        outputFormat: "audio-24khz-48kbitrate-mono-mp3",
        rate: "0%",
        pitch: "0%",
      },
    },
    {
      name: "ElevenLabs",
      loadVoices: getElevenLabsVoices,
      synthesize: synthesizeElevenLabs,
      synthesisConfig: {
        model: "eleven_multilingual_v2",
        stability: 0.5,
        similarityBoost: 0.75,
      },
    },
  ];
  const results = [];
  const failures = [];
  const destination = path.resolve(outputPath || DEFAULT_RESULTS);
  await mkdir(path.dirname(destination), { recursive: true });

  const saveResults = async () =>
    writeFile(
      destination,
      `${JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          results,
          failures,
          audioCacheDirectory: AUDIO_CACHE,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

  for (const provider of providers) {
    let voices;
    try {
      voices = await provider.loadVoices();
    } catch (error) {
      failures.push({ provider: provider.name, error: error.message });
      console.error(`Échec ${provider.name} : ${error.message}`);
      await saveResults();
      continue;
    }
    for (const sample of samples) {
      try {
        const voice = voiceForGender(voices, sample.gender, provider.name);
        const result = await synthesizeWithCache(
          provider.name,
          voice,
          sample,
          provider.synthesize,
          provider.synthesisConfig,
        );
        results.push({
          provider: provider.name,
          sampleId: sample.id,
          gender: sample.gender,
          voiceName: voice.name,
          textCharacters: sample.text.length,
          ...result,
        });
        const auditionDirectory = path.join(APP_DATA, "listen");
        await mkdir(auditionDirectory, { recursive: true });
        const providerSlug = {
          "Google Cloud Text-to-Speech": "google",
          "Azure AI Speech": "azure",
          ElevenLabs: "elevenlabs",
        }[provider.name];
        const auditionPath = path.join(
          auditionDirectory,
          `${providerSlug}-${sample.id}.mp3`,
        );
        await copyFile(result.audioPath, auditionPath);
        results[results.length - 1].auditionPath = auditionPath;
        console.log(
          `${provider.name} | ${sample.id} | ${voice.name} | ${result.cacheHit ? "cache" : `${result.latencyMs} ms`} | ${result.audioBytes} bytes`,
        );
      } catch (error) {
        failures.push({
          provider: provider.name,
          sampleId: sample.id,
          error: error.message,
        });
        console.error(
          `Échec ${provider.name} | ${sample.id} : ${error.message}`,
        );
      }
      await saveResults();
    }
  }

  console.log(`Résultats (métadonnées uniquement) : ${destination}`);
  console.log(`Audios générés en cache local : ${AUDIO_CACHE}`);
  console.log("Aucun extrait de texte n'est écrit dans les résultats.");
  if (failures.length > 0) {
    console.error(`Générations en échec : ${failures.length}.`);
    process.exitCode = 1;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (options.ocr) {
    await extractPdfLocally(
      options.ocr,
      options.output ||
        path.join(os.tmpdir(), "replicoach-tts-poc-ocr.json"),
    );
    return;
  }
  await runComparison(options.run, options.output);
}

main().catch((error) => {
  console.error(`Échec du POC TTS : ${error.message}`);
  process.exitCode = 1;
});
