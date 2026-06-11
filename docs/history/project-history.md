# Klinefelter Game — Complete Project History

**Consolidated Documentation**  
Created: 2026-06-09  
Consolidates: DESIGN.md, HANDOFF.md, .wrongstack/AGENTS.md

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Design System](#design-system)
4. [File Structure](#file-structure)
5. [Development Timeline](#development-timeline)
6. [Bug Fixes & QA Sessions](#bug-fixes--qa-sessions)
7. [Games Catalog](#games-catalog)
8. [Known Issues & Future Work](#known-issues--future-work)
9. [Deployment & Running](#deployment--running)

---

## Project Overview

**Klinefelter Game** is a low-data, offline-ready, friend-only mini game hub built with Vite, TypeScript, and Vanilla DOM/Canvas. No React, no external CDNs, no backend (static hosting only).

**Live:** https://lulakien.github.io/klinefelter-game/  
**Repository:** https://github.com/lulakien/klinefelter-game

### Initial Build Date
- **Started:** 2026-06-02
- **Major Update:** 2026-06-05 (12 bugs fixed, visual design polish)
- **Latest Update:** 2026-06-09 (Tiny Drift Karts removed, critical bug fixes)

### Core Principles
- Warm toy-arcade visual design (coral/peach backgrounds, cocoa top bar)
- Fully offline-capable Progressive Web App
- Lazy-loaded game modules (each game in its own chunk)
- Mobile-first, touch-optimized controls
- System fonts only (no remote font dependencies)
- No analytics, no tracking, no external API calls

---

## Architecture & Technology Stack

### Technology Stack
- **Build Tool:** Vite 6.4.3
- **Language:** TypeScript (ES2022 target)
- **UI:** Vanilla DOM + CSS (no framework)
- **Graphics:** Canvas 2D for real-time games, CSS Grid for puzzle games
- **PWA:** vite-plugin-pwa with Workbox (generateSW mode)
- **Storage:** localStorage (settings, scores), IndexedDB + Cache API (offline packages)
- **Audio:** Web Audio API (procedural sound effects)

### Architecture Flow

```
User opens URL → index.html
  → app shell mounts (warm cocoa top bar + content area)
  → SW registers (Workbox, precaches app-shell files)
  → Router starts (hash-based: #/, #/games/:id, #/settings, #/offline)
  → Home screen renders game cards from registry with quick actions
  → Click a card → hash changes → router dispatches
    → game-screen.ts dynamically imports the game chunk
    → game mounts into the content area
    → on navigation away: game.destroy() → rAF stopped, listeners removed
```

### Key Architectural Decisions
- **Vanilla TypeScript** over React/Preact — smaller bundle, no framework overhead
- **Canvas** for real-time games, **CSS/DOM** for board/puzzle games
- **Hash routing** — no server-side routing needed for static hosting
- **Lazy loading** — each game in its own chunk, loaded only on navigation
- **Generation counter** in game-screen.ts — prevents memory leaks from stale async loads

---

## Design System

### Design Intent

Klinefelter Game is a compact collection of casual web games that should feel like bright, friendly mobile arcade toys. The design system emphasizes:

- **Casual mobile arcade aesthetic**
- **Warm peach and coral backgrounds**
- **Rounded, chunky shapes**
- **Thick dark outlines**
- **Bright team colors**
- **Simple readable game objects**
- **Centered playable areas**
- **Bouncy, fast interactions**

Avoid: dark cinematic themes, realistic textures, glassy dashboard UI, complex gradients, fragile thin outlines, long instructional copy.

### Color Tokens

Core CSS tokens in `src/ui/styles/main.css`:

**Backgrounds:**
- Page: `#F39478`, `#EF806C`, `#F7A082`
- Surface panels: `#FFF3E8`, `#FFE2D0`
- Panel/header dark: `#694046`, `#75474E`

**Text:**
- Primary: `#3F2A2E`
- Muted: `#7D5658`
- Border/outline: `#4B3035`

**Player Colors:**
- Blue: `#23C7F4`
- Red: `#FF5B5B`
- Green: `#82DE47`
- Yellow: `#FFD529`

**Semantic:**
- Success: `#36C66F`
- Warning: `#FFD529`
- Danger: `#FF5B5B`

### Shape and Depth

- **Buttons:** rounded 12-16px corners, bold labels, darker bottom edge, clear pressed state
- **Cards and panels:** rounded 16-20px corners, 2px dark borders, soft toy-like drop shadows
- **Game boards:** thick borders, inset warm surfaces, centered and oversized
- **Corner controls:** circular or pill-like, large tap targets (46px minimum)
- **Gameplay objects:** simple silhouettes, thick outlines, bright fills, small highlights

### Typography

System fonts only. Text treated as rounded and playful through weight, casing, spacing, and scale.

- **Important UI labels:** uppercase, 700-900 weight
- **Scores:** large and bold
- **Descriptions:** short, high contrast, not tiny
- **Gameplay copy:** minimal

Good label examples: `PLAY`, `RETRY`, `SCORE`, `YOU`, `BOT`, `VS`, `READY`, `WIN`

### Layout Guidelines

**Default Layout:**
1. Warm full-screen background
2. Compact dark top bar
3. Main content centered
4. Game cards or game board in central area
5. Settings/offline panels as stacked rounded sections
6. Controls near bottom or in corners

**Mobile-First Rules:**
- 46px or larger tap targets
- Avoid nested cards
- Stable aspect ratios for game boards
- First screen useful, not marketing-heavy

### Motion and Audio

**Motion:** Instant, short, satisfying
- Buttons depress slightly on tap
- Cards lift subtly on hover
- Tiles pop on spawn/merge
- Errors shake softly
- Positive moments pulse or sparkle

**Audio:** Short procedural Web Audio sounds only
- Respect `audioEnabled` and `soundEffectsEnabled` settings
- No external audio files

---

## File Structure

```
src/
  main.ts                        Entry: boot shell → router → PWA
  vite-env.d.ts

  app/
    router.ts                    Hash router
    app-shell.ts                 Top bar + content container + error fallback
    game-registry.ts             Game metadata and lazy loaders
    audio-manager.ts             Web Audio API sound effects + haptics

  shared/
    game-types.ts                GameMeta, AppSettings, RouteState, etc.

  settings/
    settings-store.ts            localStorage-backed, observer pattern
    scores-store.ts              Personal bests and history per game

  ui/
    screens/
      home-screen.ts             Game launcher with live cache-status cards
      settings-screen.ts         Quality mode, audio, performance toggles
      scores-screen.ts           Personal bests and history per game
      offline-screen.ts          SW status, storage estimate, download/remove
      game-screen.ts             Lazy-load boundary with generation counter
    styles/
      main.css                   All styles, mobile-first, system fonts

  pwa/
    register-sw.ts               SW registration + online/offline tracking

  offline/
    package-manager.ts           IndexedDB + Cache API, download/remove/status
    offline-manager-ui.ts        Shared UI helpers (formatBytes, statusBadge)

  games/
    15-puzzle/                   Slide numbered image tiles into order (~6 KB / 2.2 KB gzip)
    2048/                        🔢 CSS grid tile puzzle (~10.5 KB / 3.7 KB gzip)
    block-blast/                 🧊 Block placement puzzle (~7.9 KB / 2.9 KB gzip)
    connect-four/                🔴 Drop discs to connect four (~7.3 KB / 2.5 KB gzip)
    memory/                      🧠 Card matching (~5.4 KB / 2.0 KB gzip)
    minesweeper/                 💣 CSS grid puzzle (~9.2 KB / 3.1 KB gzip)
    snake/                       🐍 Classic snake (~8.2 KB / 2.8 KB gzip)
    solitaire/                   🃏 Klondike solitaire (~11.3 KB / 3.5 KB gzip)
    tic-tac-toe/                 ⭕ X and O with AI (~5.6 KB / 1.9 KB gzip)
    water-sort/                  🧪 Color sorting puzzle (~7.2 KB / 2.7 KB gzip)

  core/events/
    emitter.ts                   Typed event emitter (lightweight pub/sub)

tools/
  generate-icons.ts              Pure Node.js PNG icon generator (no deps)

public/
  manifest.webmanifest           PWA manifest
  icons/icon-192.png            Generated "K" icon
  icons/icon-512.png            Generated "K" icon

.github/workflows/
  deploy.yml                    Build + deploy to GitHub Pages on push to master
```

---

## Development Timeline

### 2026-06-02: Initial Build
- Created project structure with Vite + TypeScript
- Implemented hash-based router
- Built app shell with warm toy-arcade design
- Implemented first 3 games: 2048, Minesweeper, Tiny Drift Karts (car-arena)
- Set up PWA with service worker (vite-plugin-pwa)
- Deployed to GitHub Pages

### 2026-06-05: Major QA Pass & Visual Polish
**12 Bugs Fixed + Design System Overhaul**

**Critical Routing Fixes:**
1. Root route not matching — fixed filter(Boolean) in matchPattern
2. Route params passed as literal strings — rewrote to read window.location.hash
3. Memory leak from orphaned game instances — added generation counter in game-screen.ts

**Game-Specific Fixes:**
- Memory: added Back to Home button, fixed New Best on ties, cleared flipTimeout
- Snake: added Back to Home button, fixed touch swipe drift, reset lastTimestamp on restart
- Minesweeper: cleared touchStartTimer and timerInterval on restart, added difficulty levels
- 2048: fixed overflow and overlay blocking, added Keep Playing button
- Water Sort: added stuck detection (gameOver when no moves)
- Block Blast: added hasMove check on mount for instant game over
- Car Arena: fixed resize() being called every frame
- Tic-Tac-Toe: added win line highlight

**New Features:**
- Added Solitaire, Water Sort, Block Blast, Snake, Memory, Tic-Tac-Toe, Connect Four
- Minesweeper difficulty levels (Beginner/Intermediate/Expert)
- Reduced motion preference support
- Haptic feedback system
- Snake progressive speed curve
- scores-store.ts compareScores for lower-is-better games

**Visual Design Overhaul:**
- Consolidated dark cyber theme into warm toy-arcade design
- Updated all color tokens to coral/peach/cocoa palette
- Rounded all corners, thickened borders
- Updated theme colors in manifest and index.html

### 2026-06-09: Car Arena Removal + Critical Bug Fixes

**Removed:**
- Tiny Drift Karts (car-arena) game completely removed from codebase
- Removed from game registry, loaders, vite config
- Removed "drift" sound effect from audio manager
- Cleaned up car-arena references from scores-store

**Critical Memory Leak Fixes:**
1. **Solitaire** — added `this.endDrag()` in `render()` to clean up window event listeners
2. **Block Blast** — added `this.endDrag()` in `render()` to clean up window event listeners
3. **Snake** — added `destroyed` flag to prevent RAF loop from continuing after destroy
4. **Tic-Tac-Toe** — added `aiTimeout` tracking and clearTimeout in destroy
5. **Connect Four** — added `aiTimeout` tracking and clearTimeout in destroy

**Build Verification:**
- All games compile successfully
- Bundle sizes remain within targets
- No car-arena references in final build

---

## Bug Fixes & QA Sessions

### Session 1: Critical Routing Bugs (2026-06-05)

**Bug #1: Root route not matching**
- **Symptom:** Home page showed only header, no game cards
- **Cause:** `"/".split("/")` → `[""]` (length 1), but home route path was `[]` (length 0)
- **Fix:** Added `.filter(Boolean)` to strip empty segments in `matchPattern`
- **Commit:** 1b25e9f

**Bug #2: Route params as literal strings**
- **Symptom:** Clicking a game showed "Game not found: :gameId"
- **Cause:** `matchPattern` reconstructed path with hardcoded `":gameId"` instead of actual segments
- **Fix:** Rewrote `matchPattern` to read `window.location.hash` via `getUrlSegments()`
- **Commit:** a15cb04

**Bug #3: Memory leak from orphaned games**
- **Symptom:** 15GB memory usage after opening games
- **Cause:** Async game load completed after navigation, attached to wrong screen, rAF loop persisted
- **Fix:** Generation counter + destroyCurrentGame() called synchronously before route transitions
- **Commit:** 6d5c9a3

### Session 2: Game-Specific Fixes (2026-06-05)

- Memory missing Back to Home button → added to main actions and win overlay
- Snake missing Back to Home button → added below canvas
- Minesweeper timer leak → cleared touchStartTimer and timerInterval on restart
- Memory timeout leak → tracked and cleared flipTimeout on destroy
- 2048 overflow → fixed index entry overflow
- Snake reset timestamp → reset lastTimestamp on restart
- 2048 overlay blocking → fixed positioning
- Home screen async error → caught errors from getGameOfflineStatus
- Theme color drift → updated manifest and index.html
- Car Arena resize every frame → only resize when dimensions changed
- Document queries → scoped to container instead of document

### Session 3: Critical Memory Leaks (2026-06-09)

**Drag Event Listener Leaks:**
- Solitaire and Block Blast called `innerHTML = ""` without cleaning up window-level drag listeners
- **Fix:** Call `this.endDrag()` at start of `render()` method

**RAF Loop Leak:**
- Snake's `tick()` method continued scheduling frames after `destroy()` was called
- **Fix:** Added `destroyed` flag, check at start of `tick()`

**AI Timeout Race Conditions:**
- Tic-Tac-Toe and Connect Four used `setTimeout` for AI moves without cleanup
- **Fix:** Track timeout ID and clear in `destroy()`

---

## Games Catalog

### Current Games (10 total, after car-arena removal)

1. **2048** — Slide and merge tiles to reach 2048
   - Bundle: ~10.5 KB raw / 3.7 KB gzip
   - Controls: keyboard (arrows), touch (swipe)
   - Features: Keep Playing mode, win overlay

2. **Minesweeper** — Classic mine-clearing puzzle
   - Bundle: ~9.2 KB raw / 3.1 KB gzip
   - Controls: touch (tap reveal, long-press flag), mouse (left/right click, chord)
   - Features: 3 difficulty levels, first-click always safe, timer

3. **Solitaire** — Klondike with draw-one stock
   - Bundle: ~11.3 KB raw / 3.5 KB gzip
   - Controls: tap and drag, auto-complete detection
   - Features: move counter, timer, animated card draw

4. **Water Sort** — Tap tubes to pour and sort colors
   - Bundle: ~7.2 KB raw / 2.7 KB gzip
   - Controls: touch (tap to select/pour)
   - Features: procedural level generation, stuck detection, expert mode

5. **Block Blast** — Place 3 shapes on 8×8 board
   - Bundle: ~7.9 KB raw / 2.9 KB gzip
   - Controls: drag shapes from tray
   - Features: row/column clearing, instant game-over detection

6. **Snake** — Classic snake, eat food and grow
   - Bundle: ~8.2 KB raw / 2.8 KB gzip
   - Controls: keyboard (arrows/WASD), touch (swipe)
   - Features: progressive speed increase, direction queue

7. **Memory** — Flip cards to find matching pairs
   - Bundle: ~5.4 KB raw / 2.0 KB gzip
   - Controls: touch/click to flip
   - Features: 3 difficulty levels, move counter

8. **15 Puzzle** — Slide numbered tiles into order
   - Bundle: ~6.0 KB raw / 2.2 KB gzip
   - Controls: tap tiles or swipe
   - Features: smooth tile animations, solvability check

9. **Tic-Tac-Toe** — Classic X and O
   - Bundle: ~5.6 KB raw / 1.9 KB gzip
   - Controls: touch/click cells
   - Features: 2-player or vs AI (easy/medium/hard), minimax algorithm, win line highlight

10. **Connect Four** — Drop discs to connect 4 in a row
    - Bundle: ~7.3 KB raw / 2.5 KB gzip
    - Controls: touch/click columns
    - Features: 2-player or vs AI (easy/medium/hard), alpha-beta pruning, animated disc drop

### Removed Games

**Tiny Drift Karts (car-arena)** — Removed 2026-06-09
- Was a top-down go-kart lap racing game with bots, drift mechanics, and touch controls
- Bundle was ~27 KB raw / 8.3 KB gzip
- Reason for removal: Scope reduction, focus on puzzle/board games

---

## Known Issues & Future Work

### What Works ✅
- Home screen with 10 game cards and live cache status
- All 10 games playable and tested
- Warm toy-arcade visual design fully integrated
- Settings screen with quality mode, audio, nickname
- High Scores screen with personal bests and top-5 history
- Offline manager with real SW status, connection state, storage estimate
- PWA with service worker and manifest
- Lazy loading for all game modules
- Code splitting verified in production
- GitHub Actions auto-deploy on push to master
- Game cleanup on navigation (rAF stopped, listeners removed, canvas detached)
- Mobile touch controls refined across all games

### Known Issues

**iOS Install:**
- No "Add to Home Screen" banner for Safari
- iOS instructions modal exists but needs real device testing

**Minesweeper Expert Grid:**
- 30×16 grid may be cramped on small screens
- Consider scroll indicators or pinch-zoom hints

**Per-Game Asset Manifests:**
- Current offline system downloads game modules via SW cache
- Real per-game asset manifests with versioned packages, progress UI, and quality selection not built
- Deferred to Phase 2+ per original PROJECT.txt

**Touch Control Testing:**
- Controls refined in commits but not tested on real mobile devices
- Priority: test on iOS Safari and Android Chrome

**Unused Code:**
- `offline-manager-ui.ts` exports `createActionButton` that is unused
- Safe to remove or refactor

**Build Dependency:**
- `@rollup/rollup-linux-x64-gnu` missing on Node v22
- Run `npm i` to restore (known npm optional dependency bug)

### Not Built (Intentional)

**Online Multiplayer / Rooms:**
- No backend exists — intentional, deferred to Phase 4+
- Would require WebSocket server and room codes

**Same-Device Multiplayer:**
- Not built beyond Tic-Tac-Toe and Connect Four
- Phase 3 would add checkers, backgammon, pass-and-play modes

**E2E / Performance Tests:**
- No automated testing suite
- Manual QA sessions conducted instead

**Bundle Size CI Checks:**
- No automated bundle budget enforcement
- Manual verification in build logs

### Future Phases (from PROJECT.txt)

**Phase 3:** Same-device multiplayer
- Checkers, Backgammon, more pass-and-play games

**Phase 4:** Online room system
- Backend, WebSocket, room codes
- Online leaderboards

**Phase 5:** Werewolf/Vampire Village
- Social deduction game with roles and voting

**Phase 6:** Online car multiplayer
- Real-time racing with WebRTC or WebSocket sync

---

## Deployment & Running

### Live Deployment
- **URL:** https://lulakien.github.io/klinefelter-game/
- **Repository:** https://github.com/lulakien/klinefelter-game
- **Branch:** master
- **Deploy Method:** GitHub Actions (.github/workflows/deploy.yml)
- **Deploy Trigger:** Push to master
- **Deploy Time:** ~30 seconds

### Local Development

```bash
# Install dependencies
npm install

# Development server (accessible on LAN for mobile testing)
npm run dev
# → http://localhost:3000/klinefelter-game/

# Production build
npm run build
# TypeScript check + Vite production build → dist/

# Preview production build
npm run preview
```

### Build Configuration

**Base Path:** `/klinefelter-game/` in vite.config.ts  
Change to `/` for custom domain deployment.

**Build Targets:**
- ES2022
- Sourcemaps: disabled in production
- Manual chunks for each game module

**Bundle Budgets:**
- App shell CSS: 10.8 KB raw / 2.4 KB gzip (target: 20-80 KB)
- App shell JS: 32.2 KB raw / 9.4 KB gzip (target: 100-250 KB)
- Game modules: 5-11 KB raw / 2-4 KB gzip per game (target: <1 MB each)
- SW precache: 12 files, ~89 KB total

### PWA Configuration

**Service Worker:**
- Mode: generateSW (Workbox)
- Register type: prompt (user controls updates)
- Precache: app shell files (HTML, CSS, main JS, manifest, icons)
- Exclude: game chunks (loaded on-demand)
- Runtime caching: CacheFirst for game modules, 30-day TTL

**Manifest:**
- Name: "Klinefelter Game"
- Short name: "KGame"
- Theme color: `#694046` (cocoa)
- Background: `#f39478` (coral)
- Display: standalone
- Icons: 192×192 and 512×512 PNG

---

## Design Implementation Rules

### Code Organization
- Prefer CSS variables over repeated raw colors
- Keep all UI styling in `main.css`
- Keep Canvas palettes in renderer constants
- Do not add remote font or image dependencies for core UI
- Keep design changes accessible: contrast, tap target size, readable text first
- Any new game should follow this design system, then add game-specific flavor

### Accessibility
- Minimum 46px tap targets
- High contrast text (AA or better)
- Keyboard navigation support where applicable
- Reduced motion preference respected
- No animation-only UI feedback (always pair with visual state change)

### Performance
- Lazy-load game modules (each in own chunk)
- Cancel RAF loops in destroy()
- Remove event listeners in destroy()
- Clear timers and timeouts in destroy()
- Use event delegation where possible
- Avoid re-rendering entire DOM on every state change

### Mobile Optimization
- Touch events with passive: false where preventDefault needed
- Prevent default on touch to avoid scroll/zoom during gameplay
- Test on real devices (iOS Safari, Android Chrome)
- Use dvh units for viewport height (avoids address bar issues)
- Respect safe-area-inset for notches

---

## Summary

Klinefelter Game is a lightweight, offline-capable Progressive Web App featuring 10 casual puzzle and board games. Built with Vite and TypeScript, it prioritizes small bundle sizes, warm visual design, and mobile-first touch controls. The architecture uses hash-based routing, lazy-loaded game modules, and careful cleanup to prevent memory leaks. All games are playable offline after first load, with scores and settings persisted to localStorage.

**Total Bundle Size:** ~90 KB app shell + 5-11 KB per game (gzipped)  
**Games:** 10 (2048, Minesweeper, Solitaire, Water Sort, Block Blast, Snake, Memory, 15 Puzzle, Tic-Tac-Toe, Connect Four)  
**PWA:** Full offline support with service worker  
**Design:** Warm toy-arcade aesthetic with coral/peach/cocoa palette  
**Status:** Production-ready, deployed to GitHub Pages

---

*End of consolidated documentation.*
