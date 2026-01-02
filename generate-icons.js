import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const INPUT_SVG = path.join(__dirname, "public/favicon.svg");
const OUTPUT_DIR = path.join(__dirname, "public/icons");

async function generateIcons() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("🎨 Génération des icônes PWA...\n");

  for (const size of SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
    await sharp(INPUT_SVG).resize(size, size).png().toFile(outputPath);
    console.log(`✅ icon-${size}x${size}.png`);
  }

  console.log("\n🎉 Terminé !");
}

generateIcons().catch(console.error);
