# Architecture

Klinefelter Game is a static PWA built with Vite, TypeScript, vanilla DOM, CSS, and a small amount of browser storage infrastructure. There is no backend and no framework runtime.

## App Flow

1. `index.html` loads `src/main.ts`.
2. The app shell mounts shared layout and starts the hash router.
3. Routes render home, settings, offline manager, scores, stats, or a game screen.
4. Game routes dynamically import one game module from `src/games/`.
5. On navigation away, mounted games are destroyed so timers, animation frames, listeners, and drag state can be cleaned up.

## Main Areas

- `src/app/`: router, shell, registry, and audio helpers.
- `src/games/`: individual game implementations.
- `src/settings/`: local settings, scores, and stats stores.
- `src/core/`: shared utilities such as autosave, history, performance monitoring, and error logging.
- `src/offline/`: IndexedDB and Cache API package management.
- `src/pwa/`: service-worker registration and install prompt state.
- `src/ui/`: screens, components, and styles.
- `tests/` and `src/tests/`: Vitest unit/regression tests and Playwright route smoke.

## Build Shape

`vite.config.ts` keeps the app under the `/klinefelter-game/` base path for GitHub Pages. Each game has a stable manual chunk name such as `game-2048` or `game-15-puzzle`, which lets the offline package manager detect game chunks without substring matching.

## Storage

- `localStorage`: settings, scores, stats, autosaves, performance records, and error logs.
- IndexedDB `klinefelter-offline`: offline package metadata.
- Cache API cache `game-modules`: lazy-loaded game chunks for offline use.
