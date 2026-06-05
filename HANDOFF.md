# Klinefelter Game — Project Handoff

Built 2026-06-02. Updated 2026-06-05. Vite + TypeScript + Vanilla TS. No React. No external CDNs. No backend.

**Live:** https://lulakien.github.io/klinefelter-game/

---

## Architecture

```
  User opens URL → index.html
    → app shell mounts (warm cocoa top bar + content area)
    → SW registers (Workbox, precaches 12 app-shell files)
    → Router starts (hash-based: #/, #/games/:id, #/settings, #/offline)
    → Home screen renders 8 game cards from registry
    → Click a card → hash changes → router dispatches
      → game-screen.ts dynamically imports the game chunk
      → game mounts into the content area
      → on navigation away: game.destroy() → rAF stopped, listeners removed
```

## File Structure

```
src/
  main.ts                        Entry: boot shell → router → PWA
  vite-env.d.ts

  app/
    router.ts                    Hash router (see BUGFIXES below)
    app-shell.ts                 Top bar + content container + error fallback
    game-registry.ts             3 games: car-arena, 2048, minesweeper

  shared/
    game-types.ts                GameMeta, AppSettings, RouteState, etc.

  settings/
    settings-store.ts            localStorage-backed, observer pattern

  ui/
    screens/
      home-screen.ts             Game launcher with live cache-status cards
      settings-screen.ts         Quality mode, audio, performance toggles
      offline-screen.ts          SW status, storage estimate, download/remove
      game-screen.ts             Lazy-load boundary (see BUGFIXES)
    styles/
      main.css                   All styles, mobile-first, system fonts

  pwa/
    register-sw.ts               SW registration + online/offline tracking

  offline/
    package-manager.ts           IndexedDB + Cache API, download/remove/status
    offline-manager-ui.ts        Shared UI helpers (formatBytes, statusBadge)

  games/
    car-arena/                   🚗 Tiny Drift Karts — top-down go-kart racing (~27 KB / 8.3 KB gzip)
      index.ts                   Entry, cleanup lifecycle
      car-game.ts                Orchestrator: loop, phases, scoring, checkpoints
      physics/
        car-physics.ts           Arcade physics (accel, brake, steer, drift, grip)
        collision.ts             Circle/AABB collision detection & response
      rendering/
        renderer.ts              Canvas 2D: arena, cars, tokens, particles, HUD
        camera.ts                Follow camera with lerp smoothing
      input/
        input-manager.ts         Unified keyboard + touch → normalized actions
      bots/
        bot.ts                   Wander, chaser, coward, bumper AI with racing lines
      arena.ts                   2000×1400 arena with obstacles & token spawns
      scoring.ts                 Tokens, bot bumps, drift chain, lap racing

    2048/                        🔢 CSS grid tile puzzle (~6.7 KB / 2.5 KB gzip)
      index.ts                   Entry & cleanup
      game-2048.ts               Logic, DOM renderer, swipe detection

    minesweeper/                 💣 CSS grid puzzle (~6.1 KB / 2.2 KB gzip)
      index.ts                   Entry & cleanup
      game-minesweeper.ts        Logic, DOM renderer, long-press flag, chord

    solitaire/                   🃏 Klondike solitaire (~5 KB / 1.8 KB gzip)
      index.ts                   Entry & cleanup
      solitaire.ts               Draw-one stock, tableau stacks, foundations

    water-sort/                  🧪 Color sorting puzzle (~4 KB / 1.5 KB gzip)
      index.ts                   Entry & cleanup
      water-sort.ts              Tap-to-pour, procedural level generation

    block-blast/                 🧊 Block placement puzzle (~5 KB / 1.8 KB gzip)
    snake/                       🐍 Classic snake (~7.5 KB / 2.7 KB gzip)
    memory/                      🧠 Card matching (~4.5 KB / 1.7 KB gzip)
    tic-tac-toe/                 ⭕ X and O pass-and-play with AI (~5.8 KB / 2.0 KB gzip)
      index.ts                   Entry & cleanup
      block-blast.ts             8×8 grid, 3 shapes at a time, row/column clear

  core/events/
    emitter.ts                   Typed event emitter (lightweight pub/sub)

tools/
  generate-icons.ts              Pure Node.js PNG icon generator (no deps)

public/
  manifest.webmanifest            PWA manifest
  icons/icon-192.png             Generated "K" icon
  icons/icon-512.png             Generated "K" icon

.github/workflows/
  deploy.yml                     Build + deploy to GitHub Pages on push to master
```

## Bundle Budgets (all within PROJECT.txt targets)

| Chunk | Raw | Gzip | Target |
|-------|-----|------|--------|
| App shell CSS | 10.8 KB | 2.4 KB | 20-80 KB |
| App shell JS | 20.4 KB | 6.3 KB | 100-250 KB |
| Tiny Drift Karts (lazy) | 27.0 KB | 8.3 KB | <2 MB |
| 2048 (lazy) | 6.7 KB | 2.5 KB | <1 MB |
| Minesweeper (lazy) | 6.1 KB | 2.2 KB | <1 MB |
| Solitaire (lazy) | ~5 KB | ~1.8 KB | <1 MB |
| Water Sort (lazy) | ~4 KB | ~1.5 KB | <1 MB |
| Block Blast (lazy) | ~5 KB | ~1.8 KB | <1 MB |
| Snake (lazy) | ~7 KB | ~2.6 KB | <1 MB |
| Memory (lazy) | ~4.5 KB | ~1.7 KB | <1 MB |
| Tic-Tac-Toe (lazy) | ~5.8 KB | ~2.0 KB | <1 MB |
| SW precache | 12 files, ~71 KB | — | — |

No external CDNs, fonts, analytics, or UI frameworks.

## BUGFIXES Applied

### Session 2026-06-05 (12 bugs fixed + Tic-Tac-Toe added)
- **Memory missing Back to Home:** Added to main actions and win overlay; fixed New Best showing on ties.
- **Snake missing Back to Home:** Added button below canvas; fixed touch swipe reference point drift on touchmove.
- **scores-store compareScores:** Added "memory" and "car-arena" to lower-is-better list.
- **Minesweeper timer leak:** `touchStartTimer` and `timerInterval` not cleared on restart/difficulty change.
- **Memory timeout leak:** `flipTimeout` not tracked or cleared on destroy; DOM queries now scoped to container.
- **2048 overflow:** Index entry set overflow to "auto" instead of "hidden"; added Keep Playing button on win.
- **Snake reset timestamp:** `lastTimestamp` not reset, causing a massive dt spike after restart.
- **2048 overlay blocking:** Overlay was `position: absolute` without a positioned parent, covering the viewport and blocking restart/home buttons.
- **Home screen async error:** `updateGameCardStatus` didn't catch errors from `getGameOfflineStatus`.
- **Missing manual chunks:** Snake and Memory not listed in vite.config.ts manualChunks.
- **Theme color drift:** index.html, manifest.webmanifest, and vite PWA manifest still used old dark theme colors.
- **Minesweeper no difficulty levels:** Added Beginner (9×9, 10), Intermediate (16×16, 40), Expert (16×30, 99).
- **Water Sort no stuck detection:** Added `gameOver` when no moves remain.
- **Block Blast initial dead end:** Added `hasMove` check on mount so game over shows immediately if initial shapes cannot be placed.
- **Car Arena resize every frame:** `resize()` called unconditionally in game loop; now only runs when canvas dimensions actually changed.
- **2048 / Minesweeper document queries:** Restart buttons queried via `document.getElementById` instead of scoped container query.
- **Tic-Tac-Toe win line:** Winning cells not highlighted; now pulses with gold border.
- **Reduced motion:** Added `html.reduced-motion` CSS class and JS toggle in settings-store; all animations respect user preference.
- **Haptic feedback:** Added `vibrate()` helper in audio-manager; all games trigger light vibration on key moments when `vibrationEnabled` is true.
- **Snake speed curve:** Speed now increases from 160ms to 70ms as snake grows.

### 1. Root route not matching (commit 1b25e9f)
- **Symptom:** Home page showed only header, no game cards
- **Cause:** `"/".split("/")` → `[""]` (length 1), but home route path was `[]` (length 0)
- **Fix:** Added `.filter(Boolean)` to strip empty segments in `matchPattern`

### 2. Route params passed as literal strings (commit a15cb04)
- **Symptom:** Clicking a game showed "Game not found: :gameId"
- **Cause:** `matchPattern` reconstructed the path from route type with hardcoded `":gameId"` string instead of reading actual URL segments
- **Fix:** Rewrote `matchPattern` to read `window.location.hash` directly via `getUrlSegments()`

### 3. Memory leak — orphaned game instances (commit 6d5c9a3)
- **Symptom:** 15GB memory usage after opening games
- **Cause:** When navigating during async game load, the old game's mount completed after navigation and attached to the wrong screen. The rAF loop, window event listeners, and GPU-backed Canvas persisted forever.
- **Fix:**
  - **Generation counter** in game-screen.ts — stale async loads bail out after `await`
  - **`destroyCurrentGame()`** called synchronously before every route transition
  - **`try/catch`** around game.destroy() ensures canvas removal even if destroy throws

## What Works

- ✅ Home screen loads, shows 9 game cards with live cache status
- ✅ All 9 games are playable (Tiny Drift Karts, 2048, Minesweeper, Solitaire, Water Sort, Block Blast, Snake, Memory, Tic-Tac-Toe)
- ✅ Warm toy-arcade visual design: coral/peach backgrounds, cocoa top bar, thick borders, rounded shapes
- ✅ Settings screen: quality mode toggle (persists), audio prefs, data display, nickname
- ✅ Offline manager: real SW status, connection state, storage estimate, download/remove buttons
- ✅ PWA: service worker, manifest, app shell precached for offline
- ✅ Lazy loading: each game in its own chunk, loaded only on navigation
- ✅ Code splitting verified in production build
- ✅ GitHub Actions auto-deploys on push to master
- ✅ Game cleanup: navigating away stops rAF, removes listeners, detaches canvas
- ✅ Personal bests: per-game scores persisted in localStorage with nickname and date
- ✅ Mobile touch controls: refined joystick, steering, and button layouts

## Known Issues / What's Not Built

- **Visual polish:** ✅ COMPLETED. The warm toy-arcade design system is fully integrated — coral/peach backgrounds, cocoa top bar, thick dark borders, rounded shapes, push-down buttons, system fonts. CSS consolidated from dark cyber theme + overrides into a single warm design.
- **iOS install instructions:** No "Add to Home Screen" banner for Safari. iOS instructions modal exists but needs testing on real devices.
- **Minesweeper difficulty:** Three levels added (Beginner/Intermediate/Expert) but expert grid (30×16) may be cramped on small screens.
- **Car physics tuning:** Constants are set to reasonable defaults. Real playtesting will reveal whether acceleration, grip, drift, and turn rate feel good.
- **Per-game asset manifests:** The package manager downloads by loading the game module (which the SW caches). Real per-game asset manifests with versioned packages, progress UI, and low/high quality asset selection are not built (deferred per PROJECT.txt Phase 2+).
- **Mobile touch tuning:** Touch controls refined across several commits but haven't been tested on real devices.
- **Car physics tuning:** Constants are set to reasonable defaults. Real playtesting will reveal whether acceleration, grip, drift, and turn rate feel good.
- **Per-game asset manifests:** The package manager downloads by loading the game module (which the SW caches). Real per-game asset manifests with versioned packages, progress UI, and low/high quality asset selection are not built (deferred per PROJECT.txt Phase 2+).
- **Online multiplayer / rooms:** No backend exists. This is intentional — PROJECT.txt defers this to Phase 4+.
- **Same-device multiplayer:** Not built (Phase 3).
- **More games:** Phase 2 complete — 8 games built (Tiny Drift Karts, 2048, Minesweeper, Solitaire, Water Sort, Block Blast, Snake, Memory, Tic-Tac-Toe).
- **E2E / performance tests:** Not built.
- **Bundle size CI checks:** Not built.
- **`offline-manager-ui.ts`:** Contains `createActionButton` which is exported but unused. The offline screen builds its own buttons inline. Safe to remove or refactor.
- **Build issue:** `@rollup/rollup-linux-x64-gnu` missing on Node v22. Run `npm i` to restore. Known npm optional dependency bug.

## Deployment

- **Repo:** https://github.com/lulakien/klinefelter-game
- **Live:** https://lulakien.github.io/klinefelter-game/
- **Deploy:** Push to `master` → GitHub Actions builds & deploys (~30s)
- **Base path:** `/klinefelter-game/` in vite.config.ts. Change to `/` for custom domain.

## Running Locally

```bash
npm install
npm run dev      # http://localhost:3000 (accessible on LAN for mobile testing)
npm run build    # TypeScript check + Vite production build → dist/
npm run preview  # Serve the production build locally
```

## Design Decisions (per PROJECT.txt)

- **Vanilla TypeScript** over React/Preact — smaller bundle, no framework overhead
- **Canvas** for real-time games (car arena), **CSS/DOM** for board/puzzle games (2048, minesweeper)
- **Hash routing** — no server-side routing needed for static hosting
- **`vite-plugin-pwa` with Workbox `generateSW`** — automatic app shell precaching. Game chunks excluded from precache (cached on first play via runtime `CacheFirst` strategy).
- **IndexedDB** for package metadata, **Cache API** for game assets
- **No backend** — fully static. Backend needed only for online rooms (Phase 4+)

## Next Steps (from PROJECT.txt)

1. ~~**Visual design pass** — the most impactful next step given user feedback~~ ✅ DONE
2. **Real device testing** — car game touch controls, PWA install flow on iOS/Android
3. ~~**Phase 2 complete:** Add Snake, Memory, and Tic-Tac-Toe games~~ ✅ DONE
4. **Phase 3:** Same-device multiplayer (checkers, backgammon, pass-and-play)
5. **Phase 4:** Online room system (backend, WebSocket, room codes)
6. **Phase 5:** Werewolf/Vampire Village social deduction game
7. **Phase 6:** Online car multiplayer

See `PROJECT.txt` for detailed specifications of each phase.
