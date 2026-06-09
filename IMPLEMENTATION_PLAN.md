# Implementation Plan — Approved Features

**Created:** 2026-06-09  
**Client Approval:** Phase 1 (except achievements), Phase 2 (items 10-13), Phase 3 (items 15-17), Performance & Offline improvements  
**Timeline:** 4-6 weeks  
**Backend Integration:** Week 3 (when backend ready)

---

## Approved Feature List

### **Phase 1: Core Features** (Week 1-2)
1. ✅ Dark Mode Support
2. ✅ FPS Throttling Implementation  
3. ✅ Auto-Save Game State
4. ✅ First-Time Onboarding
5. ✅ Error Tracking
6. ✅ Unit Tests Setup

### **Phase 2: Polish & Engagement** (Week 2-3)
10. ✅ Difficulty Selection UI
11. ✅ Tag Filtering
12. ✅ Undo/Redo for Puzzles
13. ✅ Statistics Dashboard

### **Phase 3: Advanced Features** (Week 3-4)
15. ✅ Accessibility Improvements
16. ✅ E2E Testing
17. ✅ Performance Monitoring

### **Additional: Performance & Offline** (Week 4-5)
- ✅ Offline Manager Improvements
- ✅ Low Quality Mode Optimization (more aggressive)
- ✅ High Quality Mode Enhancement (better visuals)
- ✅ Progressive Loading States
- ✅ Cache Strategy Optimization

### **Backend Integration** (Week 3, when ready)
- Achievement System (connect to backend)
- Global Leaderboards (optional)
- Score Sync

---

## Week 1: Core Foundation

### Day 1-2: Dark Mode + Settings Infrastructure

**Dark Mode Implementation**
- Add `darkMode: boolean` to `AppSettings` interface
- Create dark color palette in `main.css`:
  ```css
  :root.dark-mode {
    --color-bg: #1a1625;
    --color-surface: #2a2438;
    --color-text: #e5e0f0;
    --color-border: #4a3f5c;
    /* ... full palette */
  }
  ```
- Add toggle in Settings screen
- Apply `dark-mode` class to `<html>` on setting change
- Update all 10 games to respect dark mode colors
- Add smooth transition animation

**Files to Modify:**
- `src/shared/game-types.ts` - Add darkMode to AppSettings
- `src/settings/settings-store.ts` - Add darkMode handling
- `src/ui/screens/settings-screen.ts` - Add toggle UI
- `src/ui/styles/main.css` - Add dark palette (300+ lines)
- All game files - Replace hardcoded colors with CSS variables

**Acceptance Criteria:**
- [ ] Toggle in Settings works
- [ ] All 10 games render correctly in dark mode
- [ ] Preference persists across sessions
- [ ] Smooth transition between modes

---

### Day 3-4: Auto-Save Game State

**Implementation:**
- Create `game-save-manager.ts` utility
- Each game implements `serialize()` and `deserialize()` methods
- Auto-save every 5 seconds to `localStorage`
- On mount, check for save and show "Resume last game?" prompt
- Clear save on game completion or manual restart

**Example Save Structure:**
```typescript
interface GameSave {
  gameId: string;
  timestamp: number;
  state: any; // Game-specific serialized state
  version: string; // For migration compatibility
}
```

**Files to Create:**
- `src/core/game-save-manager.ts` - Save/load utilities

**Files to Modify:**
- All 10 game files - Add serialize/deserialize methods
- `src/ui/screens/game-screen.ts` - Add resume prompt

**Acceptance Criteria:**
- [ ] All games can be saved and restored
- [ ] Save prompt appears on mount if save exists
- [ ] Auto-save every 5s during gameplay
- [ ] Saves cleared on completion/restart
- [ ] Old saves expire after 7 days

---

### Day 5: FPS Throttling + Error Tracking

**FPS Throttling:**
- Read `targetFps` from settings (30/60/120)
- Implement frame-skip logic in game render loops
- Add optional FPS counter for debugging

**Error Tracking:**
- Create `error-logger.ts`
- Wrap game loops in try-catch
- Log to `localStorage` with: timestamp, message, stack, browser info
- Add "Report Bug" in Settings to export log
- Limit log to last 50 errors

**Files to Create:**
- `src/core/error-logger.ts`

**Files to Modify:**
- All game files - Implement FPS throttling
- `src/ui/screens/settings-screen.ts` - Add "Report Bug" button

**Acceptance Criteria:**
- [ ] FPS throttling works (30fps = ~33ms frame time)
- [ ] Errors logged to localStorage
- [ ] Export button creates JSON file
- [ ] No performance regression

---

## Week 2: UI/UX Polish

### Day 1-2: First-Time Onboarding

**Implementation:**
- Create welcome modal on first visit
- Explain: (1) Offline play, (2) Download games, (3) Track scores
- Add "?" help icon to header for tutorial replay
- Add `hasSeenWelcome` flag to localStorage

**Files to Create:**
- `src/ui/components/welcome-modal.ts`

**Files to Modify:**
- `src/ui/screens/home-screen.ts` - Show modal on first load
- `src/app/app-shell.ts` - Add help icon to header
- `src/ui/styles/main.css` - Modal styles

**Acceptance Criteria:**
- [ ] Modal shows on first visit
- [ ] Can be dismissed and won't show again
- [ ] Help icon in header replays tutorial
- [ ] Mobile-friendly design

---

### Day 3: Tag Filtering

**Implementation:**
- Add filter chips above game grid: All, Puzzle, Arcade, Multiplayer, Classic
- Filter `getAllGames()` by selected tag
- Animate grid re-layout on filter change
- Store last selected filter in localStorage

**Files to Modify:**
- `src/ui/screens/home-screen.ts` - Add filter UI and logic
- `src/ui/styles/main.css` - Filter chip styles

**Acceptance Criteria:**
- [ ] Filter chips render above game grid
- [ ] Clicking filter updates grid
- [ ] "All" shows all games
- [ ] Selected filter persists across sessions

---

### Day 4-5: Difficulty Selection UI

**Implementation:**
- Show modal before game mounts
- Options: Easy, Medium, Hard, Expert (game-dependent)
- Pass `difficulty` to game mount function
- Store last selected difficulty per game
- Show difficulty badge in game header

**Files to Create:**
- `src/ui/components/difficulty-modal.ts`

**Files to Modify:**
- `src/ui/screens/game-screen.ts` - Show modal before mount
- All applicable game files - Accept difficulty parameter
- `src/ui/styles/main.css` - Modal and badge styles

**Acceptance Criteria:**
- [ ] Modal shows before game starts
- [ ] Difficulty affects gameplay (AI strength, board size, etc.)
- [ ] Last difficulty remembered per game
- [ ] Can be changed in-game via settings button

---

## Week 3: Advanced Features Part 1

### Day 1-2: Statistics Dashboard

**Implementation:**
- Create new route `/stats`
- Show aggregate stats:
  - Total games played
  - Win rate %
  - Favorite game (most played)
  - Total playtime (hours)
  - Best win streak
- Simple CSS bar charts (no external libs)

**Enhanced Data Tracking:**
- Extend `scores-store.ts` to track:
  - `gamesPlayed: Record<gameId, number>`
  - `totalPlaytime: Record<gameId, number>` (in seconds)
  - `lastPlayed: Record<gameId, timestamp>`
  - `currentStreak: number`
  - `bestStreak: number`

**Files to Create:**
- `src/ui/screens/stats-screen.ts`
- `src/settings/stats-store.ts` (or extend scores-store.ts)

**Files to Modify:**
- `src/app/router.ts` - Add /stats route
- All game files - Track play/win events
- `src/ui/styles/main.css` - Stats screen styles

**Acceptance Criteria:**
- [ ] Stats screen accessible from home
- [ ] All metrics calculated correctly
- [ ] Visual charts for top 3 games
- [ ] Updates in real-time after games

---

### Day 3-4: Undo/Redo for Puzzles

**Implementation:**
- Add undo button to game UI (keyboard: Ctrl+Z, Cmd+Z)
- Store move history as stack (max 50 moves)
- Each game implements `undo()` method
- Prioritize: Solitaire, 15 Puzzle, Water Sort, 2048

**History Stack Structure:**
```typescript
interface MoveHistory<T> {
  states: T[]; // Game state snapshots
  currentIndex: number;
  maxSize: number;
}
```

**Files to Create:**
- `src/core/history-manager.ts` - Generic undo/redo utility

**Files to Modify:**
- Solitaire, 15 Puzzle, Water Sort, 2048 - Implement undo
- `src/ui/styles/main.css` - Undo button styles

**Acceptance Criteria:**
- [ ] Undo button in game header
- [ ] Keyboard shortcuts work
- [ ] Can undo up to 50 moves
- [ ] History cleared on restart
- [ ] No performance impact

---

### Day 5: Unit Tests Setup

**Implementation:**
- Install Vitest + @vitest/ui
- Create test structure:
  ```
  src/games/{game}/__tests__/{game}.test.ts
  src/settings/__tests__/stores.test.ts
  ```
- Write tests for:
  - Game state mutations (Snake move, 2048 merge)
  - Score comparison logic
  - Settings store get/set
- Target 60%+ coverage for game logic

**Files to Create:**
- `vitest.config.ts`
- Test files for each game (10+ files)

**Files to Modify:**
- `package.json` - Add test scripts

**Acceptance Criteria:**
- [ ] `npm test` runs all tests
- [ ] Can run tests in watch mode
- [ ] Tests cover critical game logic
- [ ] CI-ready (no flaky tests)

---

## Week 4: Advanced Features Part 2

### Day 1-2: Accessibility Improvements

**Keyboard Navigation:**
- All interactive elements have `tabindex`
- Home screen: Arrow keys navigate game cards, Enter/Space to select
- Games: Document keyboard shortcuts in tutorial

**Screen Reader Support:**
- ARIA labels on all buttons/links
- ARIA live regions for score updates
- Role attributes (navigation, main, complementary)

**High Contrast Mode:**
- Detect `prefers-contrast: high` media query
- Boost border thickness and text contrast

**Focus Indicators:**
- Visible focus outlines (3px solid)
- High contrast focus colors

**Files to Modify:**
- All screen files - Add ARIA attributes
- `src/ui/styles/main.css` - Focus styles, contrast mode
- All game files - Add keyboard event handlers

**Acceptance Criteria:**
- [ ] Can navigate entire app with keyboard
- [ ] Screen reader announces all actions
- [ ] Focus indicators visible
- [ ] High contrast mode works

---

### Day 3-4: E2E Testing

**Implementation:**
- Install Playwright
- Write critical flow tests:
  - Install PWA
  - Download game and play offline
  - Submit score and view on leaderboard
  - Navigate between screens
  - Dark mode toggle
- Run in CI pipeline

**Files to Create:**
- `tests/e2e/pwa-install.spec.ts`
- `tests/e2e/game-flow.spec.ts`
- `tests/e2e/offline-mode.spec.ts`

**Files to Modify:**
- `.github/workflows/deploy.yml` - Add test step

**Acceptance Criteria:**
- [ ] All critical flows covered
- [ ] Tests pass in CI
- [ ] Tests run on push to main
- [ ] Screenshots captured on failure

---

### Day 5: Performance Monitoring

**Implementation:**
- Use Performance API to track:
  - Game load time
  - Average FPS during gameplay
  - Memory usage (if available)
- Store metrics in localStorage
- Display in Settings screen
- Add "Performance Report" export

**Metrics to Track:**
```typescript
interface PerformanceMetrics {
  gameId: string;
  loadTime: number; // ms
  avgFps: number;
  minFps: number;
  memoryUsage?: number; // MB
  timestamp: number;
}
```

**Files to Create:**
- `src/core/performance-monitor.ts`

**Files to Modify:**
- All game files - Add performance marks
- `src/ui/screens/settings-screen.ts` - Show metrics
- `src/ui/styles/main.css` - Metrics display

**Acceptance Criteria:**
- [ ] All metrics tracked accurately
- [ ] Metrics shown in Settings
- [ ] Export creates JSON report
- [ ] No performance overhead

---

## Week 5: Performance & Offline Improvements

### Day 1-2: Offline Manager Improvements

**Enhanced Features:**
- Show detailed download progress per game (0-100%)
- Add "Download while browsing" option (background downloads)
- Show storage breakdown per game
- Add "Clear cache" button per game
- Estimate download time based on connection speed

**Progressive Loading:**
- Show shimmer skeleton loaders during cache checks
- Add retry logic for failed downloads
- Show queue status when downloading multiple games

**Files to Modify:**
- `src/offline/package-manager.ts` - Add progress tracking
- `src/ui/screens/offline-screen.ts` - Enhanced UI
- `src/ui/styles/main.css` - Progress bars, skeleton loaders

**Acceptance Criteria:**
- [ ] Progress bars show download progress
- [ ] Can download in background
- [ ] Per-game storage shown
- [ ] Clear cache per game works
- [ ] Retry on failure

---

### Day 3-4: Quality Mode Optimization

**Low Quality Mode (More Aggressive):**
- Reduce Canvas resolution to 0.5x (instead of 0.75x)
- Disable shadows and glows
- Use simpler gradients (solid colors)
- Reduce animation complexity
- Lower audio quality (mono instead of stereo)
- Disable particle effects

**High Quality Mode (Enhanced):**
- Increase Canvas resolution to 2x (retina)
- Add subtle parallax effects
- Enhanced shadows and bloom effects
- Smooth gradient transitions
- Better particle systems
- Optional background music

**Quality Presets:**
```typescript
const QUALITY_PRESETS = {
  'ultra-low': {
    canvasScale: 0.5,
    shadows: false,
    particles: false,
    audioQuality: 'mono',
    animations: 'simple',
  },
  'low': {
    canvasScale: 0.75,
    shadows: false,
    particles: 'minimal',
    audioQuality: 'mono',
    animations: 'standard',
  },
  'high': {
    canvasScale: 1.5,
    shadows: true,
    particles: 'full',
    audioQuality: 'stereo',
    animations: 'enhanced',
  },
  'ultra': {
    canvasScale: 2.0,
    shadows: 'enhanced',
    particles: 'full',
    audioQuality: 'stereo',
    animations: 'premium',
    effects: ['bloom', 'parallax'],
  },
};
```

**Files to Modify:**
- `src/settings/settings-store.ts` - Add ultra quality mode
- All Canvas game files - Implement quality scaling
- `src/ui/screens/settings-screen.ts` - Add ultra mode option
- `src/ui/styles/main.css` - Conditional animations based on quality

**Acceptance Criteria:**
- [ ] Ultra-low mode runs smoothly on old devices
- [ ] High quality mode looks significantly better
- [ ] Quality setting applied immediately (no reload)
- [ ] Bundle size increase < 5KB

---

### Day 5: Cache Strategy Optimization

**Implementation:**
- Migrate from `generateSW` to `injectManifest` for fine-grained control
- Implement versioned caching per game
- Add background sync for score submission
- Implement stale-while-revalidate for app shell
- Add offline analytics queue

**Custom Service Worker Strategy:**
```typescript
// Cache game chunks with versioning
const GAME_CACHE_VERSION = 'v1.2.0';

// App shell: stale-while-revalidate (fast load, auto-update)
// Game modules: cache-first with version check
// API calls: network-first with fallback
```

**Files to Create:**
- `src/pwa/sw.ts` - Custom service worker

**Files to Modify:**
- `vite.config.ts` - Switch to injectManifest
- `src/pwa/register-sw.ts` - Handle SW updates

**Acceptance Criteria:**
- [ ] App shell loads instantly from cache
- [ ] Updates applied in background
- [ ] Offline score queue works
- [ ] Version conflicts handled gracefully

---

## Backend Integration (Week 3+)

**When Backend Ready:**

### Achievement System
- POST `/achievements/unlock` - Unlock achievement
- GET `/achievements/user/:id` - Get user achievements
- Frontend shows unlock toast + confetti animation

### Global Leaderboards
- POST `/scores` - Submit score
- GET `/leaderboards/:gameId` - Get top 100
- Show rank: "You: #342 of 5,219 players"
- Add opt-in toggle in Settings (privacy)

**Files to Modify (when backend ready):**
- `src/settings/achievements-store.ts` - Connect to API
- `src/settings/scores-store.ts` - Add sync logic
- `src/ui/screens/achievements-screen.ts` - Fetch from API
- `src/ui/screens/scores-screen.ts` - Show global ranks

---

## Testing Strategy

### Unit Tests (Vitest)
- Game state mutations
- Score calculations
- Settings store logic
- Target: 60%+ coverage

### E2E Tests (Playwright)
- Critical user flows
- PWA installation
- Offline functionality
- Cross-browser (Chrome, Firefox, Safari)

### Manual Testing Checklist
- [ ] Test on real iOS device (Safari)
- [ ] Test on real Android device (Chrome)
- [ ] Test on slow 3G network
- [ ] Test with screen reader (NVDA/VoiceOver)
- [ ] Test keyboard-only navigation
- [ ] Test dark mode on OLED screen
- [ ] Test auto-save recovery
- [ ] Test offline mode extensively

---

## Bundle Budget Monitoring

**Current Sizes:**
- App shell: 78 KB (12 KB gzipped)
- Average game: 8 KB (2.7 KB gzipped)

**Budget Targets After Changes:**
- App shell: < 100 KB (15 KB gzipped)
- Average game: < 12 KB (4 KB gzipped)
- Total new code: < 50 KB (15 KB gzipped)

**Monitor with:**
```bash
npm run build
open dist/stats.html  # Bundle analyzer
```

---

## Risk Mitigation

### High Risk Items
1. **Undo/Redo Memory Usage** - Limit to 50 moves, test with large game states
2. **Service Worker Migration** - Thoroughly test cache invalidation
3. **Canvas Resolution Scaling** - May affect performance on low-end devices

### Mitigation Strategies
- Feature flags for risky features
- Gradual rollout (test with 10% of users first)
- Rollback plan for SW changes
- Performance regression tests

---

## Success Metrics

**Week 2 Checkpoint:**
- [ ] Dark mode implemented and tested
- [ ] Auto-save working in all games
- [ ] Unit tests achieving 40%+ coverage
- [ ] No performance regressions

**Week 4 Checkpoint:**
- [ ] All Phase 1 & 2 features complete
- [ ] E2E tests passing
- [ ] Accessibility audit score > 90
- [ ] Unit test coverage > 60%

**Week 6 Final:**
- [ ] All approved features implemented
- [ ] Performance improved (FPS stable, load time < 2s)
- [ ] Offline experience excellent
- [ ] Ready for backend integration

---

## Deliverables

### Code
- 30+ modified files
- 15+ new files
- 200+ new tests
- All features documented

### Documentation
- Updated README with new features
- API integration guide (for backend team)
- Testing documentation
- Performance optimization guide

### Assets
- Dark mode color swatches
- Achievement badge designs
- Tutorial screenshots
- Performance benchmarks

---

## Timeline Summary

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1 | Core Foundation | Dark mode, Auto-save, FPS throttling, Error tracking |
| 2 | UI/UX Polish | Onboarding, Filtering, Difficulty selection |
| 3 | Advanced Part 1 | Stats, Undo/Redo, Unit tests |
| 4 | Advanced Part 2 | Accessibility, E2E tests, Performance monitoring |
| 5 | Performance | Offline improvements, Quality modes, Cache optimization |
| 6 | Polish & Testing | Bug fixes, Documentation, Final QA |

---

## Next Steps

1. **Review this plan** - Confirm priorities and timeline
2. **Set up project board** - Create GitHub issues for each task
3. **Start Week 1** - Begin with dark mode implementation
4. **Daily standups** - 15-min sync on progress/blockers
5. **Weekly demos** - Show completed features each Friday

---

**Ready to proceed?** Reply with:
```
/.goal approve
```

And I'll begin implementation immediately! 🚀
