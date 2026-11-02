import { defineConfig, loadEnv } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Sert /api/gemini-proxy en local (Vite ne sait pas exécuter le dossier api/ de Vercel)
function geminiDevProxy(env) {
  return {
    name: "gemini-dev-proxy",
    configureServer(server) {
      server.middlewares.use("/api/gemini-proxy", async (req, res) => {
        const send = (status, body) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };
        if (req.method !== "POST") return send(405, { error: "Method not allowed" });
        process.env.GEMINI_API_KEY = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || "";
        let raw = "";
        for await (const chunk of req) raw += chunk;
        try {
          req.body = JSON.parse(raw || "{}");
          const { pathToFileURL } = await import("node:url");
          const file = pathToFileURL(path.resolve(process.cwd(), "api/gemini-proxy.js"));
          const { default: handler } = await import(/* @vite-ignore */ `${file.href}?t=${Date.now()}`);
          const resShim = {
            status: (code) => ({ json: (body) => send(code, body) }),
          };
          await handler(req, resShim);
        } catch (err) {
          send(500, { error: err.message });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
  plugins: [
    geminiDevProxy(env),
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

      // Pré-cacher le shell et ses bundles d'entrée ; les routes chargent
      // leurs chunks à la demande et le service worker les met ensuite en cache.
      injectManifest: {
        globPatterns: [
          "**/*.{css,html,ico,png,svg,webp,woff,woff2}",
          "**/assets/index-*.js",
        ],
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
  };
});
