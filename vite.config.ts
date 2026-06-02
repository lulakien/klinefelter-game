import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // GitHub Pages project site: https://lulakien.github.io/klinefelter-game/
  // Change to "/" if using a custom domain
  base: "/klinefelter-game/",
  build: {
    target: "ES2022",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("games/car-arena/")) {
            return "game-car-arena";
          }
          if (id.includes("games/2048/")) {
            return "game-2048";
          }
          if (id.includes("games/minesweeper/")) {
            return "game-minesweeper";
          }
          if (id.includes("games/solitaire/")) {
            return "game-solitaire";
          }
          if (id.includes("games/water-sort/")) {
            return "game-water-sort";
          }
          if (id.includes("games/block-blast/")) {
            return "game-block-blast";
          }
        },
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      // Use generateSW for MVP; switch to injectManifest for per-game cache control later
      workbox: {
        globPatterns: [
          "**/*.{js,css,html,webmanifest,png,svg,ico}",
        ],
        // Don't precache game chunks — they're large and should be manually downloaded
        globIgnores: [
          "**/game-*.js",
        ],
        runtimeCaching: [
          {
            // Cache game modules on first load (network-first for freshness)
            urlPattern: /\/assets\/.*\.js$/,
            handler: "CacheFirst",
            options: {
              cacheName: "game-modules",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
        ],
      },
      manifest: {
        name: "Klinefelter Game",
        short_name: "KGame",
        description: "A low-data, offline-ready, friend-only mini game hub.",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        orientation: "any",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 3000,
  },
});
