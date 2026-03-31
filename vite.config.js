import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // InjectManifest : on fournit notre propre SW (src/sw.js)
      // vite-plugin-pwa y injecte le précache manifest de tous les assets Vite
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",

      // Mise à jour automatique sans popup : le nouveau SW prend le relais dès qu'il est prêt
      registerType: "autoUpdate",

      // Injection automatique du script d'enregistrement dans index.html
      injectRegister: "auto",

      // On garde notre public/manifest.json, pas de génération automatique
      manifest: false,

      // Patterns des assets à pré-cacher (tous les fichiers du build)
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
      },

      // Activer le SW en développement pour pouvoir tester le mode hors-ligne
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
