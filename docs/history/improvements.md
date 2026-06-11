# Klinefelter Game — Improvement Roadmap

**Created:** 2026-06-09  
**Status:** Planning Phase

This document outlines a comprehensive improvement plan based on analysis of the current codebase, user experience, and technical architecture.

---

## Executive Summary

**Current State:**
- 10 games, ~90KB app shell, 5-11KB per game (gzipped)
- Warm toy-arcade design system
- Offline-capable PWA with lazy loading
- No analytics, no tracking, fully static

**Key Opportunities:**
1. **Engagement:** Add achievements, daily challenges, tutorials
2. **Accessibility:** Dark mode, keyboard navigation, screen reader support
3. **Polish:** Auto-save, undo/redo, better error handling
4. **Technical:** Testing infrastructure, performance monitoring

---

## Priority Roadmap

### **Phase 1: Critical Fixes & Core Features** (2-3 weeks)

#### 1. Dark Mode Support
- **Priority:** HIGH | **Effort:** MEDIUM | **Impact:** Most requested feature
- **Implementation:**
  - Add `darkMode: boolean` to AppSettings
  - Define dark palette in CSS: `--color-bg-dark: #1a1625`, `--color-surface-dark: #2a2438`
  - Toggle `<html class="dark-mode">` on setting change
  - Update all games to respect dark mode colors
- **Files:** `settings-store.ts`, `main.css`, `settings-screen.ts`

#### 2. FPS Throttling Implementation
- **Priority:** HIGH | **Effort:** MEDIUM | **Impact:** `targetFps` setting exists but unused
- **Implementation:**
  - Pass `targetFps` from settings to game modules
  - In each game's render loop: `if (elapsed < 1000 / targetFps) return;`
  - Add visual FPS counter in dev mode
- **Files:** All game files, `game-screen.ts`

#### 3. Auto-Save Game State
- **Priority:** HIGH | **Effort:** MEDIUM | **Impact:** Prevent progress loss on tab close
- **Implementation:**
  - Each game implements `serialize()` returning game state as JSON
  - Save to `localStorage.setItem('klinefelter-save-{gameId}', json)` every 5 seconds
  - On mount, check for saved state and prompt "Resume last game?"
  - Clear save on game completion or manual restart
- **Files:** All game files, add `game-save-manager.ts`

#### 4. Achievement System
- **Priority:** HIGH | **Effort:** LARGE | **Impact:** Major engagement driver
- **Implementation:**
  - Define achievements in `achievements-store.ts`:
    - "First Victory" - Win any game
    - "Perfect Score" - Snake 200+, 2048 reach 4096
    - "Marathon" - Play 10 games in one day
    - "Jack of All Trades" - Win each game at least once
    - "Speed Demon" - Complete Minesweeper Beginner in under 30s
  - Track progress: `{ id, name, description, progress, total, unlocked, date }`
  - Show toast notification when unlocked
  - Add `/achievements` route with badge grid
- **Files:** NEW `achievements-store.ts`, NEW `achievements-screen.ts`, all games emit events

#### 5. First-Time Onboarding
- **Priority:** HIGH | **Effort:** MEDIUM | **Impact:** New users need guidance
- **Implementation:**
  - Show welcome modal on first visit explaining:
    1. "Download games for offline play"
    2. "Track your progress in High Scores"
    3. "Customize in Settings"
  - Add `hasSeenWelcome` flag to localStorage
  - Add "?" help icon to top bar for tutorial replay
- **Files:** `home-screen.ts`, add `welcome-modal.ts`

#### 6. Error Tracking
- **Priority:** HIGH | **Effort:** SMALL | **Impact:** Essential for debugging
- **Implementation:**
  - Wrap game loops and async operations in try-catch
  - Log errors to `localStorage.getItem('klinefelter-errors')` as JSON array
  - Add "Report Bug" button in Settings to export error log
  - Include: timestamp, error message, stack trace, browser info
- **Files:** `error-logger.ts`, all game files, `settings-screen.ts`

#### 7. Unit Tests Setup
- **Priority:** HIGH | **Effort:** LARGE | **Impact:** Foundation for quality
- **Implementation:**
  - Install Vitest: `npm install -D vitest @vitest/ui`
  - Add `test` script to package.json: `"test": "vitest"`
  - Create test files for game logic:
    - `src/games/snake/__tests__/snake.test.ts` - test stepSnake, collision detection
    - `src/games/2048/__tests__/2048.test.ts` - test tile merging, move validation
    - `src/settings/__tests__/scores-store.test.ts` - test score comparison logic
  - Target 80%+ coverage for game state mutations
- **Files:** NEW test files, `package.json`, `vitest.config.ts`

---

### **Phase 2: Polish & Engagement** (3-4 weeks)

#### 8. Daily Challenges
- **Priority:** HIGH | **Effort:** LARGE | **Impact:** Retention feature
- **Implementation:**
  - Generate daily seed from `Date.now()` at midnight UTC: `seed = hash(YYYYMMDD)`
  - Pass seed to game RNG for deterministic puzzles
  - Add "Daily Challenge" badge on home screen
  - Track completion: `dailyChallenges: { date, gameId, score, completed }`
  - Show streak counter: "7 Day Streak 🔥"
- **Files:** Add `daily-challenge.ts`, modify all game RNG functions

#### 9. Game Tutorials
- **Priority:** HIGH | **Effort:** MEDIUM | **Impact:** Help new players
- **Implementation:**
  - Add "How to Play" button in each game's header
  - Show modal overlay with:
    - Game objective
    - Control instructions (keyboard + touch)
    - Tips for beginners
  - Use illustrative icons (not text walls)
- **Files:** Add tutorial content to each game, create `tutorial-modal.ts`

#### 10. Difficulty Selection UI
- **Priority:** HIGH | **Effort:** MEDIUM | **Impact:** Already supported in code
- **Implementation:**
  - Before game mounts, show difficulty picker modal: Easy / Medium / Hard / Expert
  - Pass difficulty to game module
  - Store last selected difficulty per game in localStorage
  - Show difficulty badge in game header during play
- **Files:** `game-screen.ts`, modify game mount functions

#### 11. Tag Filtering
- **Priority:** MEDIUM | **Effort:** SMALL | **Impact:** Improve discovery
- **Implementation:**
  - Add filter chips above game grid: "All", "Puzzle", "Arcade", "Multiplayer", "Classic"
  - Filter `getAllGames()` by selected tags
  - Animate grid re-layout on filter change
- **Files:** `home-screen.ts`, `main.css` for chip styles

#### 12. Undo/Redo for Puzzles
- **Priority:** MEDIUM | **Effort:** LARGE | **Impact:** Major UX improvement
- **Implementation:**
  - Add undo button to game UI (keyboard shortcut: Ctrl+Z)
  - Store move history as stack (max 50 moves to prevent memory bloat)
  - Each game implements `undo()` method to revert last state change
  - Prioritize for: Solitaire, 15 Puzzle, Water Sort
- **Files:** All applicable game files, add history tracking to state

#### 13. Statistics Dashboard
- **Priority:** MEDIUM | **Effort:** MEDIUM | **Impact:** Showcase progress
- **Implementation:**
  - Add "Stats" button to home screen
  - Show:
    - Total games played
    - Win rate percentage
    - Favorite game (most played)
    - Total playtime (hours)
    - Best win streak
  - Visualize with simple bar charts (no external lib, use CSS)
- **Files:** NEW `stats-screen.ts`, enhance `scores-store.ts`

---

### **Phase 3: Advanced Features** (4+ weeks)

#### 14. Global Leaderboards
- **Priority:** HIGH | **Effort:** LARGE | **Impact:** Requires backend
- **Implementation:**
  - Build simple REST API (Cloudflare Workers or Express.js)
  - Endpoints: `POST /scores`, `GET /leaderboards/:gameId`
  - Store in SQLite or PostgreSQL
  - Add opt-in toggle in Settings (privacy-conscious)
  - Show rank: "You: #342 of 5,219 players"
- **Status:** Deferred until MVP validated
- **Files:** NEW backend repo, modify `scores-store.ts` to POST scores

#### 15. Accessibility Improvements
- **Priority:** HIGH | **Effort:** MEDIUM | **Impact:** Inclusive design
- **Implementation:**
  - **Keyboard Navigation:** Add `tabindex="0"` to all interactive elements, handle Enter/Space
  - **Screen Reader:** Add ARIA labels, live regions for score updates
  - **Focus Indicators:** Strengthen focus outline in `main.css`
  - **High Contrast Mode:** Detect `prefers-contrast: high` media query
- **Files:** All screen files, `main.css`

#### 16. E2E Testing
- **Priority:** MEDIUM | **Effort:** LARGE | **Impact:** Quality assurance
- **Implementation:**
  - Install Playwright: `npm install -D @playwright/test`
  - Write tests for critical flows:
    - Install PWA flow
    - Download game and play offline
    - Submit score and view on leaderboard
  - Run in CI/CD pipeline
- **Files:** NEW `tests/e2e/` directory, `.github/workflows/test.yml`

#### 17. Performance Monitoring
- **Priority:** MEDIUM | **Effort:** MEDIUM | **Impact:** Optimize bottlenecks
- **Implementation:**
  - Use Performance API to track:
    - Game load time: `performance.measure('game-load', 'load-start', 'load-end')`
    - Average FPS during gameplay
    - Memory usage via `performance.memory`
  - Store metrics in localStorage, display in Settings
  - Add "Performance Report" export feature
- **Files:** Add `performance-monitor.ts`, integrate in game lifecycle

---

### **Phase 4: Nice-to-Haves** (Backlog)

#### 18. Favorites/Bookmarks
- **Priority:** MEDIUM | **Effort:** SMALL
- Add star icon to game cards, sort favorites to top

#### 19. Share Score Feature
- **Priority:** MEDIUM | **Effort:** SMALL
- Use Web Share API: `navigator.share({ text: "I scored 1250 in Snake!" })`

#### 20. Color Blind Modes
- **Priority:** MEDIUM | **Effort:** MEDIUM
- Add patterns + high contrast for Deuteranopia/Protanopia/Tritanopia

#### 21. Animated Route Transitions
- **Priority:** LOW | **Effort:** MEDIUM
- Use View Transition API with fallback

#### 22. More Games
- **Priority:** LOW | **Effort:** LARGE
- Candidates: Tetris, Sudoku, Chess, Checkers, Breakout

---

## Quick Wins (Can Implement This Week)

### 1. Loading State Improvements
**Effort:** 30 minutes | **Impact:** Better perceived performance

```typescript
// In home-screen.ts
async function updateGameCardStatus(gameId: string): Promise<void> {
  const statusEl = document.getElementById(`card-status-${gameId}`);
  if (!statusEl) return;

  // Add timeout
  const timeoutId = setTimeout(() => {
    statusEl.innerHTML = `<span class="status-badge status-badge--error">Check Failed</span>`;
  }, 3000);

  try {
    const status = await getGameOfflineStatus(gameId);
    clearTimeout(timeoutId);
    // ... rest of logic
  } catch {
    clearTimeout(timeoutId);
    statusEl.innerHTML = `<span class="status-badge status-badge--error">Error</span>`;
  }
}
```

### 2. Add Empty State to Offline Manager
**Effort:** 15 minutes | **Impact:** Better UX

```typescript
// In offline-screen.ts
if (allGamesNotDownloaded) {
  container.innerHTML = `
    <div class="empty-state">
      <h3>No Games Downloaded</h3>
      <p>Download games from the home screen to play offline.</p>
      <a href="#/" class="btn btn--primary">Browse Games</a>
    </div>
  `;
}
```

### 3. Add More Sound Effects
**Effort:** 20 minutes | **Impact:** Better feedback

```typescript
// In audio-manager.ts
export type SfxType = "click" | "success" | "fail" | "hit" | "swap" | "error" | "levelup";

// Add cases for:
case "swap": // Tile swap sound
case "error": // Invalid move sound
case "levelup": // Achievement unlocked sound
```

### 4. Safe Area Audit
**Effort:** 1 hour | **Impact:** Fix iPhone notch issues

```css
/* Audit all fixed/sticky elements */
.app-header {
  padding-top: max(var(--space-md), env(safe-area-inset-top));
}

.game-actions {
  padding-bottom: max(var(--space-md), env(safe-area-inset-bottom));
}
```

### 5. Add Bundle Analyzer
**Effort:** 10 minutes | **Impact:** Identify optimization targets

```bash
npm install -D rollup-plugin-visualizer
```

```typescript
// In vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

plugins: [
  visualizer({ open: true, filename: 'dist/stats.html' })
]
```

---

## Design Enhancements

### Dark Mode Palette Proposal

```css
:root.dark-mode {
  --color-bg: #1a1625;
  --color-bg-gradient: linear-gradient(160deg, #2a2438 0%, #1f1a2e 55%, #1a1625 100%);
  --color-surface: #2a2438;
  --color-surface-hover: #352d45;
  --color-border: #4a3f5c;
  --color-text: #e5e0f0;
  --color-text-muted: #9d93b3;
  --color-cocoa: #8b7a9f;
}
```

### Achievement Badge Design

```
🏆 First Victory - Win any game
🎯 Sharpshooter - Complete Minesweeper Expert without flags
🐍 Snake Master - Reach 200+ in Snake
🧩 Puzzle Solver - Win 2048, reach 4096 tile
⚡ Speed Demon - Minesweeper Beginner < 30s
🔥 On Fire - 7 day streak
🎓 Completionist - Win every game at least once
```

---

## Technical Debt to Address

### 1. Enable TypeScript Strict Mode
- **Priority:** MEDIUM | **Effort:** LARGE
- Enable `strict: true` in `tsconfig.json`
- Fix ~200+ type errors across codebase
- Prevents runtime null reference bugs

### 2. Implement Base Game Class
- **Priority:** MEDIUM | **Effort:** LARGE
- Create `src/core/base-game.ts` with shared logic
- All games extend `BaseGame`
- Reduces 500+ lines of duplicated code

### 3. Split CSS into Critical + Deferred
- **Priority:** MEDIUM | **Effort:** SMALL
- Extract above-fold CSS (hero, header, cards)
- Inline critical CSS in `index.html`
- Lazy-load game-specific styles

### 4. Migrate to `injectManifest` Workbox Mode
- **Priority:** LOW | **Effort:** MEDIUM
- Replace `generateSW` with custom `sw.ts`
- Fine-grained cache control per game
- Better offline update strategy

---

## Metrics to Track

Once analytics are added, track:

1. **Engagement:**
   - Games played per session
   - Average session duration
   - Return rate (7-day, 30-day)
   - Most played games

2. **Performance:**
   - Average FPS per game
   - Load time (app shell, game chunks)
   - Memory usage on low-end devices

3. **Conversion:**
   - PWA install rate
   - Offline download completion rate
   - Tutorial completion rate

4. **Retention:**
   - Daily active users
   - Achievement unlock rate
   - Daily challenge participation

---

## Implementation Priority Matrix

| Feature | Priority | Effort | Impact | Dependencies |
|---------|----------|--------|--------|--------------|
| Dark Mode | HIGH | Medium | High | None |
| Auto-Save | HIGH | Medium | High | None |
| Achievements | HIGH | Large | Very High | Error tracking |
| FPS Throttling | HIGH | Medium | Medium | None |
| Onboarding | HIGH | Medium | High | None |
| Error Tracking | HIGH | Small | High | None |
| Unit Tests | HIGH | Large | High | None |
| Daily Challenges | HIGH | Large | Very High | RNG seeding |
| Game Tutorials | HIGH | Medium | High | Modal component |
| Difficulty UI | HIGH | Medium | Medium | None |
| Tag Filtering | MEDIUM | Small | Low | None |
| Undo/Redo | MEDIUM | Large | High | State history |
| Stats Dashboard | MEDIUM | Medium | Medium | Enhanced scores-store |
| Leaderboards | HIGH | Large | Very High | **Backend required** |
| Accessibility | HIGH | Medium | High | ARIA, keyboard nav |
| E2E Tests | MEDIUM | Large | High | Playwright |
| Perf Monitoring | MEDIUM | Medium | Medium | Performance API |

---

## Cost-Benefit Analysis

### Highest ROI Features (Do First)
1. **Dark Mode** - Requested feature, medium effort, broad appeal
2. **Auto-Save** - Prevents frustration, medium effort
3. **Achievements** - Major retention driver, worth the large effort
4. **Onboarding** - Improves new user conversion

### Medium ROI (Do Second)
5. **Daily Challenges** - Retention, but requires careful design
6. **Game Tutorials** - Helps new players, medium effort
7. **Undo/Redo** - Great UX, but large effort

### Low ROI (Defer)
- Animated transitions (low impact, medium effort)
- More games (low priority until existing games polished)
- Control remapping (rarely requested)

---

## Next Steps

1. **Review this document with team/stakeholders**
2. **Prioritize Phase 1 items based on resources**
3. **Create GitHub Issues for each feature**
4. **Set up project board (Backlog → In Progress → Review → Done)**
5. **Implement quick wins this week**
6. **Start Phase 1 development next week**

---

## Questions to Resolve

1. **Backend Decision:** Self-host vs. serverless (Cloudflare Workers) for leaderboards?
2. **Analytics:** Self-hosted (Plausible) vs. localStorage-only?
3. **Monetization:** Keep ad-free? Optional donation link?
4. **Community:** Add Discord link for feedback?

---

*Last Updated: 2026-06-09*
