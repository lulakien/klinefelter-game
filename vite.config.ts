import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // GitHub Pages project site: https://lulakien.github.io/klinefelter-game/
  // Change to "/" if using a custom domain
  base: "/klinefelter-game/",
  build: {
    target: "ES2022",
    sourcemap: false,
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      // Use generateSW for MVP; switch to injectManifest for per-game cache control later
      workbox: {
        globPatterns: [
          "**/*.{js,css,html,webmanifest,png,svg,ico}",
        ],
        // Don't precache game chunks — they're large and should be manually downloaded
        globIgnores: [
          "**/index-CWOiNG01.js", // car arena game
          "**/index-dPc33ami.js", // 2048 game
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
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512.png",
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
