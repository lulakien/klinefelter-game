# PWA and Offline Behavior

The app uses `vite-plugin-pwa` with Workbox `generateSW`.

## Cache Strategy

- App shell assets are precached.
- Game chunks matching `game-*.js` are not precached.
- Lazy-loaded game modules are cached at runtime in the `game-modules` cache.

## Offline Manager

`src/offline/package-manager.ts` coordinates:

- static game metadata from `src/app/game-registry.ts`;
- IndexedDB package records in database `klinefelter-offline`, store `packages`;
- Cache API entries in cache `game-modules`.

Game chunk detection uses the stable manual chunk names from `vite.config.ts`, for example `/game-15-puzzle-<hash>.js`.

## Status Meanings

- `not-downloaded`: no valid offline package is available.
- `offline-ready`: metadata and cached game chunk match the current game version.
- `update-available`: cached package exists but the game version changed.
- `storage-removed`: metadata or cache state is incomplete and the package should be repaired by downloading again.
- `online-only`: game metadata says offline play is unsupported.

## Service Worker Registration

`src/pwa/register-sw.ts` registers the generated service worker at `${BASE_URL}sw.js`, retries transient registration failures, and tracks install prompt state for the home screen.
