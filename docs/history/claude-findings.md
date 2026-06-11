COMPREHENSIVE SOLUTION PLAN

CRITICAL BUG DISCOVERED

15 Puzzle Offline Download Failure

Root Cause: vite.config.ts:manualChunks is missing the 15-puzzle case. All other games (2048, minesweeper, solitaire, water-sort, block-blast, snake, memory, tic-tac-toe, connect-four) have explicit chunk names, but 15-puzzle gets an auto-generated hash name. When package-manager.ts:isGameInCache() checks req.url.includes("15-puzzle"), it never matches because the chunk filename doesn't contain "15-puzzle".

Solution:
// vite.config.ts, line 24 (after block-blast case)
if (id.includes("games/15-puzzle/")) {
  return "game-15-puzzle";
}

File: vite.config.ts:24

---
SOLITAIRE ISSUES

1. Single-click auto-move does not work on desktop

Root Cause Analysis:
- solitaire.ts:273-278 — tapCard() method exists and calls autoMoveCard() on single tap
- solitaire.ts:617-620 — Cards bind click events that call tapCard()
- solitaire.ts:625-627 — BUT pointerdown events also bind, which start drag immediately
- On desktop with mouse, pointerdown fires → startDrag() → sets pointer capture → blocks the click event from ever firing
- Mobile works because the double-tap timeout (360ms) in tapCard() gives time before drag starts

Why drag interferes:
- solitaire.ts:430 — el.setPointerCapture(e.pointerId) captures all pointer events
- Once captured, the subsequent click event is suppressed
- This is standard pointer capture behavior

Solution:
Detect intent before starting drag. A drag should only start if the pointer moves significantly. Clicks (no movement) should be handled as taps.

Implementation:
// In startDrag() at line 400
private startDrag(e: PointerEvent, selection: Selection, el: HTMLElement): void {
  if (this.state.won) return;
  const cards = getSelectionCards(this.state, selection);
  if (!cards.length || !cards[0].faceUp) return;

  // NEW: Track initial position but don't start drag yet
  this.potentialDrag = {
    selection,
    el,
    startX: e.clientX,
    startY: e.clientY,
    pointerId: e.pointerId,
    moved: false
  };

  el.setPointerCapture(e.pointerId);
  window.addEventListener("pointermove", this.boundOnPotentialDragMove);
  window.addEventListener("pointerup", this.boundOnPotentialDragUp);
}

// NEW: Check for movement threshold
private onPotentialDragMove(e: PointerEvent): void {
  if (!this.potentialDrag || this.potentialDrag.pointerId !== e.pointerId) return;

  const dx = e.clientX - this.potentialDrag.startX;
  const dy = e.clientY - this.potentialDrag.startY;
  const distance = Math.hypot(dx, dy);

  if (distance > 8 && !this.drag) {
    // Movement detected — convert to real drag
    this.potentialDrag.moved = true;
    // Create ghost and transition to drag mode
    const rect = this.potentialDrag.el.getBoundingClientRect();
    // ... build ghost as before
  }

  if (this.drag) {
    // Continue existing drag logic
    this.onPointerMove(e);
  }
}

// NEW: Handle pointer up — either click or drag end
private onPotentialDragUp(e: PointerEvent): void {
  if (!this.potentialDrag || this.potentialDrag.pointerId !== e.pointerId) return;

  const wasDrag = this.potentialDrag.moved;
  const selection = this.potentialDrag.selection;

  this.cleanupPotentialDrag();

  if (!wasDrag) {
    // No movement = click
    e.preventDefault();
    this.tapCard(selection);
  } else if (this.drag) {
    // Was a drag
    this.onPointerUp(e);
  }
}

Files to modify:
- src/games/solitaire/solitaire.ts:161-169 (add potentialDrag state)
- src/games/solitaire/solitaire.ts:400-434 (refactor startDrag)
- Add new methods: onPotentialDragMove, onPotentialDragUp, cleanupPotentialDrag

---
2. Auto-complete does not recognize cards in the deck

Root Cause:
solitaire.ts:380-392 — maybeAutoComplete() only checks waste and tableau, never the stock:
const wasteIndex = this.state.waste.length - 1;
if (wasteIndex >= 0 && this.moveSingleCardToFoundation({ zone: "waste", pile: 0, index: wasteIndex })) {
  moved = true;
}
The stock is never checked because cards in the stock are face-down and should be drawn first.

Solution:
Working as intended — stock cards must be drawn to waste before auto-complete can process them. The bug report likely refers to waste cards not being auto-completed. I checked the code: waste IS checked. This might be a misunderstanding OR the check fails silently.

Investigation needed: Test if moveSingleCardToFoundation with waste cards actually works. The logic at solitaire.ts:359-367 looks correct.

Likely non-issue unless testing reveals otherwise.

---
3. Add animations where missing

Current animations:
- solitaire.ts:554-556 — Waste card draw animation (.card--drawn)
- CSS line 2425 — @keyframes solitaire-draw

Missing animations:
- Foundation placement
- Tableau moves
- Auto-complete sequence

Solution:
Add CSS transition classes for foundation/tableau moves:
.card--moving-to-foundation {
  animation: card-to-foundation 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes card-to-foundation {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  50% { transform: translateY(-20px) scale(0.92); opacity: 0.85; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}

Apply in tryMove() before state update, remove after transition.

---
4. Redesign Solitaire cards

Current design issues (from CSS lines 2180-2263):
- Cards look generic with plain gradients
- Suit symbols are small (line 2237: clamp(1.35rem, 4.6vw, 2.05rem))
- No visual personality

Solution:
Enhanced card design with better contrast, deeper shadows, and larger suit symbols:

.card {
  background:
    radial-gradient(circle at 24% 18%, rgba(255, 255, 255, 0.98) 0 22%, transparent 23%),
    linear-gradient(155deg, #fffefa 0%, #f5ebe0 100%);
  border: 3px solid rgba(54, 42, 66, 0.85);
  box-shadow:
    0 4px 0 rgba(54, 42, 66, 0.45),
    0 10px 20px rgba(36, 27, 44, 0.25);
}

.card__pip {
  font-size: clamp(1.75rem, 5.2vw, 2.6rem);
  opacity: 1;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.15));
}

.card--red {
  color: #d62839;
}

.card--black {
  color: #1a2332;
}

.card--back {
  background:
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.25) 0 14%, transparent 15%),
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0 8px, transparent 8px 16px),
    linear-gradient(160deg, #7d6a92, #4a3d5f);
  border-color: rgba(255, 255, 255, 0.35);
}

File: src/ui/styles/main.css:2180-2263

---
WATER SORT ISSUES

5. Replace unacceptable bottle visuals

Current implementation (CSS lines 1714-1835):
The test tube design is actually sophisticated with glass effects, gradients, highlights, and inset shadows. BUT the user finds it unacceptable.

Analysis of what might be "garbage":
- Tubes are too complex with pseudo-elements
- Glass effect might look muddy on some screens
- Border radius 50% on bottom creates weird pill shape

Solution:
Simplified, cleaner laboratory beaker design:

.water-sort__tube {
  height: clamp(150px, 24svh, 200px);
  border: none;
  background: transparent;
  border-radius: 12px 12px 40% 40%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  position: relative;
  transition: transform 0.16s ease;
  padding: 0;
  overflow: visible;
}

/* Cleaner glass beaker */
.water-sort__tube::before {
  content: "";
  position: absolute;
  inset: 0;
  border: 4px solid rgba(230, 240, 250, 0.95);
  border-top-width: 8px;
  border-top-color: rgba(200, 220, 240, 0.95);
  border-radius: 12px 12px 40% 40%;
  background: linear-gradient(
    95deg,
    rgba(255, 255, 255, 0.75) 0%,
    rgba(255, 255, 255, 0.15) 25%,
    rgba(255, 255, 255, 0.05) 50%,
    rgba(180, 210, 240, 0.1) 75%,
    rgba(35, 199, 244, 0.08) 100%
  );
  box-shadow:
    inset 6px 0 12px rgba(255, 255, 255, 0.5),
    inset -4px 0 10px rgba(75, 48, 53, 0.08),
    inset 0 -10px 14px rgba(75, 48, 53, 0.12),
    0 5px 0 rgba(75, 48, 53, 0.18),
    0 10px 20px rgba(75, 48, 53, 0.15);
  pointer-events: none;
  z-index: 2;
}

/* Simplified highlight */
.water-sort__tube::after {
  content: "";
  position: absolute;
  top: 15px;
  left: 20%;
  width: 20%;
  height: 40%;
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.85) 0%,
    rgba(255, 255, 255, 0.2) 70%,
    transparent
  );
  pointer-events: none;
  z-index: 3;
}

.water-sort__liquid {
  flex: 1 1 0;
  border: none;
  margin: 0;
  margin-top: 1px;
  box-shadow:
    inset 0 10px 12px rgba(255, 255, 255, 0.4),
    inset 0 -8px 10px rgba(75, 48, 53, 0.2),
    inset 4px 0 8px rgba(255, 255, 255, 0.25),
    inset -4px 0 8px rgba(75, 48, 53, 0.12);
  position: relative;
  z-index: 1;
}

.water-sort__liquid:first-child {
  border-radius: 8px 8px 3px 3px;
  margin-top: 12px;
}

.water-sort__liquid:last-child {
  border-radius: 3px 3px 38% 38%;
  margin-bottom: 8px;
}

File: src/ui/styles/main.css:1714-1835

---
6. Add pouring animation

Current animation (line 1797-1809):
- Pouring tube rotates slightly
- Receiving tube scales

Missing: Liquid visibly leaving one tube and entering another

Solution:
The animation is already implemented at water-sort.ts:307-331 with CSS classes .water-sort__tube--pouring and .water-sort__tube--receiving. The animation triggers during animatePour() with a 220ms delay.

Enhancement needed:
Add liquid color transition animation:

.water-sort__liquid {
  transition: flex 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.water-sort__tube--pouring .water-sort__liquid:last-child {
  animation: liquid-drain 0.22s ease-out;
}

@keyframes liquid-drain {
  0% { opacity: 1; transform: scaleY(1); }
  100% { opacity: 0.6; transform: scaleY(0.7); transform-origin: bottom; }
}

.water-sort__tube--receiving .water-sort__liquid:first-child {
  animation: liquid-fill 0.22s ease-in;
}

@keyframes liquid-fill {
  0% { opacity: 0.4; transform: scaleY(0.3); }
  100% { opacity: 1; transform: scaleY(1); transform-origin: top; }
}

File: src/ui/styles/main.css (add after line 1809)

---
MINESWEEPER ISSUES

7. Board fitting problem (images 3, 4, 5)

Root Cause Analysis:

Current implementation (CSS lines 1416-1526):
.minesweeper {
  --ms-cell-size: clamp(32px, 9.2vw, 40px);
}
.minesweeper--intermediate {
  --ms-cell-size: 36px;
}
.minesweeper--expert {
  --ms-cell-size: 34px;
}

The problem:
- Cell size is FIXED in px for intermediate/expert
- Board width = cols × cell-size + gaps (line 509: grid-template-columns:repeat(${cols},var(--ms-cell-size)))
- Intermediate: 16×16 grid with 36px cells = 576px + ~32px gaps = ~608px
- Expert: 30×16 grid with 34px cells = 1020px + ~60px gaps = ~1080px
- On viewports < 1080px wide, expert board overflows
- The scroll container (.minesweeper__board-scroll) has padding: 8px which adds to the problem

Why it manifests as "no padding" or "excess right padding":
- Small viewport → board overflows → scroll container shows scrollbar on right → looks like excess padding
- Large viewport → board fits but inconsistent padding due to centering vs left-align

Solution:
Dynamic cell sizing that respects viewport while maintaining aspect ratio:

.minesweeper {
  --ms-cell-size: clamp(28px, 8.5vw, 40px);
}

.minesweeper--intermediate {
  /* 16 cols × 2px gap = 32px gaps, border+padding = ~26px, safe margins = 32px */
  --ms-cell-size: min(36px, calc((100vw - 90px) / 16));
}

.minesweeper--expert {
  /* 30 cols × 2px gap = 60px gaps, border+padding = ~26px, safe margins = 32px */
  --ms-cell-size: min(34px, calc((100vw - 118px) / 30));
}

.minesweeper__board-scroll {
  padding: clamp(6px, 1.5vw, 12px);
  align-items: center;
  justify-content: center;
}

.minesweeper--intermediate .minesweeper__board-scroll,
.minesweeper--expert .minesweeper__board-scroll {
  /* Always center on larger boards */
  justify-content: center;
  align-items: flex-start;
}

Mobile adjustments (add to @media query at line 2344):
@media (max-width: 680px) {
  .minesweeper--intermediate {
    --ms-cell-size: min(32px, calc((100vw - 70px) / 16));
  }

  .minesweeper--expert {
    --ms-cell-size: min(30px, calc((100vw - 90px) / 30));
  }

  .minesweeper__board-scroll {
    padding: 5px;
  }
}

Files to modify:
- src/ui/styles/main.css:1416-1526
- src/ui/styles/main.css:2344-2357

---
BLOCK BLAST ISSUES

8. Dragged block squares not same size as board squares

Root Cause:

Board cells (CSS line 1855):
.block-blast__cell {
  aspect-ratio: 1;  /* Size determined by grid */
}

Dragged piece cells (CSS line 1949):
.block-blast__mini {
  width: 22px;
  height: 22px;
}

The board cells are fluid (size from grid), but dragged pieces are FIXED at 22px. When viewport changes, board cells scale but dragged pieces don't.

Solution:

Calculate board cell size dynamically and apply to ghost:

// block-blast.ts, line 290 (in onShapePointerDown)
const boardCell = board?.querySelector<HTMLElement>(".block-blast__cell");
const cellSize = boardCell?.getBoundingClientRect().width ?? 34;

// line 260 (in renderShape)
private renderShape(shape: Shape, cellSize?: number): string {
  const size = cellSize ?? 22;
  const maxRow = Math.max(...shape.cells.map(([r]) => r));
  const maxCol = Math.max(...shape.cells.map(([, c]) => c));
  const cells = new Set(shape.cells.map(([r, c]) => `${r},${c}`));
  let grid = "";
  for (let r = 0; r <= maxRow; r++) {
    for (let c = 0; c <= maxCol; c++) {
      const filled = cells.has(`${r},${c}`);
      const style = filled ? ` style="background:${shape.color}"` : "";
      grid += `<span class="block-blast__mini${filled ? "" : " block-blast__mini--empty"}"${style}></span>`;
    }
  }
  return `
    <div class="block-blast__shape" style="grid-template-columns:repeat(${maxCol + 1},${size}px)">
      ${grid}
    </div>
  `;
}

In CSS, make mini cells match board:
.block-blast__mini {
  width: var(--bb-mini-size, 22px);
  height: var(--bb-mini-size, 22px);
  border-radius: 5px;
  border: 1px solid rgba(75, 48, 53, 0.28);
}

Files to modify:
- src/games/block-blast/block-blast.ts:260-263 (add cellSize param)
- src/games/block-blast/block-blast.ts:290-293 (calculate and pass cellSize)
- src/ui/styles/main.css:1949-1954

---
9. Lifted block too far from click point

Root Cause (block-blast.ts:286-287):
const liftY = e.pointerType === "mouse"
  ? 0
  : Math.round((boardCell?.getBoundingClientRect().height ?? 34) * 3.5);

On touch, lift is 3.5× cell height (~119px with 34px cells). That's way too much.

Solution:
Reduce lift to 1.8× cell height:

const liftY = e.pointerType === "mouse"
  ? 0
  : Math.round((boardCell?.getBoundingClientRect().height ?? 34) * 1.8);

File: src/games/block-blast/block-blast.ts:287

---
15 PUZZLE ISSUES

10. Keyboard play not working

Root Cause:
puzzle-15.ts has NO keyboard handler. The keyboard events at line 174-186 are ONLY for undo/redo (Ctrl+Z/Ctrl+Y), not for arrow keys to move tiles.

Solution:
Add arrow key handler:

// puzzle-15.ts, add to constructor at line 128
private onKeyDown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) {
      this.redo();
    } else {
      this.undo();
    }
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    this.redo();
  } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    this.handleArrowKey(event.key);
  }
};

// Add new method
private handleArrowKey(key: string): void {
  const emptyIndex = this.state.tiles.indexOf(EMPTY);
  const emptyRow = Math.floor(emptyIndex / SIZE);
  const emptyCol = emptyIndex % SIZE;

  let targetRow = emptyRow;
  let targetCol = emptyCol;

  // Arrow keys move the tile INTO the empty space
  switch (key) {
    case "ArrowUp":
      targetRow = emptyRow + 1; // Tile below moves up
      break;
    case "ArrowDown":
      targetRow = emptyRow - 1; // Tile above moves down
      break;
    case "ArrowLeft":
      targetCol = emptyCol + 1; // Tile to right moves left
      break;
    case "ArrowRight":
      targetCol = emptyCol - 1; // Tile to left moves right
      break;
  }

  if (targetRow < 0 || targetRow >= SIZE || targetCol < 0 || targetCol >= SIZE) {
    playSfx("fail");
    return;
  }

  const targetIndex = targetRow * SIZE + targetCol;
  this.moveTile(targetIndex);
}

File: src/games/15-puzzle/puzzle-15.ts:174-186 (modify), add handleArrowKey method

---
TIC-TAC-TOE ISSUES

11. Improve visual design of X and O

Current implementation (tic-tac-toe.ts:290-295):
X and O are rendered as plain text in cells:
<button class="tic-tac-toe__cell ...">X</button>

CSS (lines 2560-2598):
.tic-tac-toe__cell {
  font-size: 2.4rem;
  font-weight: 900;
  color: var(--color-cocoa);
}
.tic-tac-toe__cell--x {
  color: var(--color-accent);
}
.tic-tac-toe__cell--o {
  color: var(--color-cyan);
}

Plain text looks boring and lacks visual impact.

Solution:
SVG-based X and O with modern design:

// tic-tac-toe.ts, modify renderCell (around line 290)
${board.map((cell, i) => {
  const won = this.state.winningLine.includes(i);
  let content = "";
  if (cell === "X") {
    content = `<svg viewBox="0 0 100 100" class="ttt-mark">
      <line x1="20" y1="20" x2="80" y2="80" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>
      <line x1="80" y1="20" x2="20" y2="80" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>
    </svg>`;
  } else if (cell === "O") {
    content = `<svg viewBox="0 0 100 100" class="ttt-mark">
      <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" stroke-width="12"/>
    </svg>`;
  }
  return `<button class="tic-tac-toe__cell ${cell ? `tic-tac-toe__cell--${cell.toLowerCase()}` : ""} ${gameOver ? "tic-tac-toe__cell--disabled" : ""} ${won ? "tic-tac-toe__cell--win" : ""}"
          data-index="${i}" ${cell || gameOver ? "disabled" : ""}>
    ${content}
  </button>`;
}).join("")}

CSS additions:
.ttt-mark {
  width: 64%;
  height: 64%;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));
  animation: mark-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes mark-pop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}

Files to modify:
- src/games/tic-tac-toe/tic-tac-toe.ts:290-295
- src/ui/styles/main.css:2560-2598 (add ttt-mark styles)

---
GENERAL ISSUES

12. Dark Mode text readability (images 7 and 8)

Root Cause Analysis:

Dark mode palette (CSS lines 94-145):
:root.dark-mode {
  --color-text: #e5e0f0;
  --color-text-muted: #9d93b3;
  --color-cocoa: #8b7a9f;
}

Likely affected elements:
- Game card meta (line 572-590): uses --color-text on dark backgrounds
- Puzzle stats (line 1650-1661): uses --color-text-muted labels
- Setting labels (line 758-761): uses --color-text-muted

The purple-tinted text (#9d93b3) on dark purple backgrounds (#2a2438) has low contrast.

WCAG AA requires 4.5:1 contrast for normal text.

Solution:
Increase dark mode text contrast:

:root.dark-mode {
  --color-text: #f0ecf8;           /* was #e5e0f0 — brighter */
  --color-text-muted: #b8aed0;     /* was #9d93b3 — much lighter */
  --color-cocoa: #a090b8;          /* was #8b7a9f — lighter for headers */
}

File: src/ui/styles/main.css:94-145

---
13. Singleplayer/Multiplayer bubble misalignment (image 8)

Root Cause (CSS lines 544-562):
.game-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.game-card__tag {
  background: var(--color-warning);
  border: 2px solid var(--color-border);
  padding: 3px 10px;
  border-radius: 20px;
}

When the game name wraps to multiple lines, align-items: center centers the tag vertically relative to the entire header block, not the first line.

Solution:
.game-card__header {
  display: flex;
  align-items: flex-start;  /* Changed from center */
  justify-content: space-between;
  gap: var(--space-sm);
}

.game-card__tag {
  margin-top: 2px;  /* Optical alignment with first line of text */
  flex-shrink: 0;
}

File: src/ui/styles/main.css:537-562

---
14. Move Settings "Back to Home" button to top

Current layout (settings-screen.ts:118-122):
Buttons are at the bottom in .settings-actions div.

Solution:
Restructure to put "Back to Home" at top:

// settings-screen.ts, line ~28
wrapper.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
    <h1 class="screen-title" style="margin:0;">Settings</h1>
    <a class="btn btn--secondary" href="#/" style="height:38px;padding:0 var(--space-md);">Back to Home</a>
  </div>

  <section class="settings-section">
    ...
  </section>
  ...
  <div class="settings-actions">
    <button class="btn btn--secondary" id="btn-export-errors">Report Bug</button>
    <button class="btn btn--secondary" id="btn-export-performance">Performance Report</button>
  </div>
`;

File: src/ui/screens/settings-screen.ts:28-122

---
15. Visual bug in difficulty menu (image 2)

Without seeing image 2, likely issues:

Difficulty modal (difficulty-modal.ts:44-71 + CSS 1103-1126):

Possible problems:
1. Buttons not filling width on narrow screens
2. Font size too large causing overflow
3. Border rendering artifact

Preventive fix:
.difficulty-options {
  display: grid;
  gap: var(--space-sm);
  padding: var(--space-md);
  width: 100%;
}

.difficulty-option {
  min-height: var(--touch-target);
  width: 100%;  /* ADD */
  border: 3px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
  font-weight: 900;


---

# Codex Research Addendum - Verified Solution Plan

Date: 2026-06-10

Scope: research only. No implementation was performed. This addendum preserves the existing Claude findings above and adds a verified, repo-grounded plan based on direct inspection of the current source tree and an advisory WrongStack review.

Files inspected:
- `NEXT_SESSION_FINDINGS.md`
- `vite.config.ts`
- `src/app/game-registry.ts`
- `src/offline/package-manager.ts`
- `src/ui/styles/main.css`
- `src/ui/screens/home-screen.ts`
- `src/ui/screens/settings-screen.ts`
- `src/ui/screens/offline-screen.ts`
- `src/ui/components/difficulty-modal.ts`
- `src/core/history-manager.ts`
- `src/games/solitaire/solitaire.ts`
- `src/games/water-sort/water-sort.ts`
- `src/games/minesweeper/game-minesweeper.ts`
- `src/games/block-blast/block-blast.ts`
- `src/games/15-puzzle/puzzle-15.ts`
- `src/games/tic-tac-toe/tic-tac-toe.ts`

WrongStack advisory used:
- Asked: review candidate root causes and missed edge cases for the reported findings only, read-only, no broad redesigns.
- Suggested: findings for 15 Puzzle offline, Solitaire pointerdown/click conflict, Minesweeper fitting, Block Blast ghost mismatch, 15 Puzzle keyboard gap, and CSS/dark-mode bugs are credible. Solitaire stock auto-complete is a product choice unless explicitly expected.
- Accepted: the implementation cautions about not silently changing Klondike rules, not forcing Block Blast tray cells to board size, accounting for viewport/safe-area math in Minesweeper, and hardening CSS variables.
- Rejected/deferred: no implementation changes from WrongStack were applied.
- Verification after advisory: rechecked the relevant source files and line evidence manually.

## Executive Priority Order

1. Fix global CSS variables and dark-mode hard-coded surface colors first.
   Reason: undefined variables and hard-coded light backgrounds affect multiple reported issues: unreadable dark mode, difficulty menu visuals, home-card bubble alignment/contrast, and general polish.

2. Fix Offline Manager 15 Puzzle download.
   Reason: small, high-confidence root cause in `vite.config.ts` and offline cache verification.

3. Fix shared undo/redo presentation.
   Reason: multiple games expose separate redo buttons. This should be handled as a reusable UI pattern before each game is individually polished.

4. Fix Solitaire interaction logic and card visuals.
   Reason: click-to-auto-move requires event-model changes that must preserve drag/carry and undo. Card redesign and animations can be layered after interaction correctness.

5. Fix Minesweeper board fitting with a real responsive sizing model.
   Reason: the current expert/intermediate board uses fixed cell sizes and scroll. The requested fix is explicitly not a one-viewport patch.

6. Fix Block Blast drag ghost sizing and lift offset.
   Reason: clear localized issue with render/drop math coupling.

7. Add 15 Puzzle arrow-key play.
   Reason: confirmed feature gap and relatively contained.

8. Redesign Water Sort bottle visuals and pour animation.
   Reason: visual redesign work should happen after global CSS tokens are stable.

9. Improve Tic-Tac-Toe X/O visuals.
   Reason: contained visual polish.

10. Run full verification ladder.
   Required by user report: `npm test`, `npm run build`, and browser smoke checks on desktop and mobile.

## General / Cross-Cutting Bugs

### A. Undefined CSS Variables

Evidence:
- `src/ui/styles/main.css` uses `var(--shadow-soft)` at several selectors, including topbar help, tag filters, difficulty options, stats tiles, and stats sections.
- `src/ui/styles/main.css` uses `var(--color-primary)` for hover/active states.
- `src/ui/styles/main.css` uses `var(--color-border-soft)` in welcome steps.
- These variables are not defined in `:root` or `:root.dark-mode`.

Likely symptoms:
- Box shadows silently disappear.
- Active/hover backgrounds become invalid and may fall back unpredictably.
- Difficulty menu active state can look broken.
- Some controls may lose intended contrast.

Plan:
1. Add explicit tokens to `:root`:
   - `--color-primary`, likely mapped to the cyan/accent family already used by primary UI.
   - `--color-border-soft`, a translucent border that works on light surfaces.
   - `--shadow-soft`, a lighter shadow than `--shadow-premium`.
2. Add dark-mode overrides for all three tokens.
3. Review selectors that currently rely on these variables:
   - `.app-topbar__help`
   - `.tag-filter`
   - `.welcome-step`
   - `.difficulty-option`
   - `.stats-tile`
   - `.stats-section`
   - `.stats-bar span`
4. Verify hover/active/focus states in light and dark mode.

Acceptance:
- No CSS declaration depends on an undefined custom property.
- Difficulty modal selected option has visible active styling in both modes.
- Tag filters and topbar help keep readable text/background contrast.

### B. Hard-Coded Light Backgrounds Break Dark Mode

Evidence examples:
- `.home-hero` uses `background: #ffe2d0`.
- `.toggle-group` uses `background: #ffe2d0`.
- `.nickname-input` uses `background: #ffe2d0`.
- `.storage-bar` uses `background: #ffe2d0`.
- `.minesweeper__board-scroll` uses `background: #ffe2d0`.
- `.water-sort__rack`, `.block-blast__board`, `.solitaire__tableau`, `.puzzle-15__board`, and several cell styles use hard-coded peach/cream backgrounds.
- `.game-card__meta span` uses `rgba(255, 226, 208, 0.75)`.

Likely symptoms:
- Images 7 and 8 unreadable text in dark mode.
- Some components use dark-mode text variables on light-mode backgrounds or vice versa.

Plan:
1. Create semantic tokens instead of replacing every value ad hoc:
   - `--color-board-bg`
   - `--color-cell-bg`
   - `--color-control-bg`
   - `--color-chip-bg`
   - optionally `--color-panel-alt`
2. Define light and dark versions.
3. Replace hard-coded peach/cream backgrounds in shared surfaces first:
   - home hero
   - toggle group
   - form inputs
   - status/meta chips
   - difficulty modal options
4. Then replace game-board backgrounds in a second pass:
   - Minesweeper board scroll/cells
   - Water Sort rack
   - Block Blast board/cells/tray-used
   - Solitaire tableau/slots
   - 15 Puzzle board
5. Avoid changing layout while doing this; keep it a color/token repair pass.

Acceptance:
- Dark mode cards, chips, toggles, difficulty modal, settings, offline manager, and game boards are readable.
- Light mode keeps the existing warm arcade feel.

### C. Settings "Back to Home" Button Placement

Evidence:
- `src/ui/screens/settings-screen.ts` renders `Back to Home` inside `.settings-actions` at the bottom.

Plan:
1. Move the `Back to Home` anchor to the top of the settings wrapper, before or beside the `Settings` title.
2. Keep Report Bug and Performance Report at the bottom.
3. Add a small `.screen-back` or reuse existing button classes with top alignment.
4. Ensure the top button is reachable immediately on mobile.

Acceptance:
- Settings screen has `Back to Home` near the top.
- Bottom actions still contain bug/performance report controls.

### D. Difficulty Menu Visual Bug

Evidence:
- `src/ui/components/difficulty-modal.ts` renders `.difficulty-options` and `.difficulty-option`.
- CSS active/hover state uses undefined `--color-primary`.
- Option shadow uses undefined `--shadow-soft`.

Plan:
1. Fix undefined CSS variables first.
2. Make `.difficulty-option` explicitly `width: 100%`.
3. Use stable line-height and text alignment.
4. Confirm modal max-height and padding fit small screens.
5. Add focus-visible styling that does not rely only on background.

Acceptance:
- Difficulty options are full-width, aligned, readable, and have a visible selected state.
- No broken active/hover style in light or dark mode.

### E. Home Game Card Bubble Misalignment

Evidence:
- `src/ui/screens/home-screen.ts` puts the first tag inside `.game-card__tag`.
- `.game-card__header` uses `display:flex; align-items:center; justify-content:space-between`.
- Long titles or narrow cards can crowd the tag.
- The user mentions Singleplayer/Multiplayer bubble, but current card tag is `game.tags[0]`; some games show `multiplayer`, others `singleplayer`.

Plan:
1. Keep the tag in the header but make the header resilient:
   - `align-items: flex-start`
   - add gap
   - allow title to wrap
   - keep tag `flex-shrink: 0`
2. For very narrow widths, allow tag to wrap to the next line via `flex-wrap: wrap`.
3. Consider deriving the bubble from `multiplayerSupport` only if the current first-tag behavior is semantically wrong. This is optional and should not be changed without confirming desired labels.

Acceptance:
- Tags do not overlap or float oddly beside titles on narrow cards.
- Dark mode tag contrast is readable.

## Offline Manager / 15 Puzzle

### Root Cause

Evidence:
- `src/app/game-registry.ts` has `GAME_LOADERS["15-puzzle"]` with a Webpack-style `viteChunkName` comment.
- `vite.config.ts` has manual chunks for every game except `games/15-puzzle/`.
- `src/offline/package-manager.ts` verifies cache presence using `req.url.includes(gameId)`.
- If Rollup emits an auto-generated chunk name without `15-puzzle`, the loader can succeed but cache verification fails with "Download completed but not found in cache".

Plan:
1. Add a `manualChunks` case:
   - `if (id.includes("games/15-puzzle/")) return "game-15-puzzle";`
2. Build and inspect `dist/assets` to confirm a chunk name containing `game-15-puzzle`.
3. Browser verification:
   - open Offline Manager
   - download 15 Puzzle
   - confirm status becomes offline-ready
   - reload offline if service worker is available
4. Optional hardening:
   - replace `req.url.includes(gameId)` with a registry-driven expected chunk label or normalized package ID.
   - Caution: this is a broader offline-manager change; not required for the reported 15 Puzzle bug.

Acceptance:
- 15 Puzzle download no longer fails verification.
- `Download All Games` does not fail on 15 Puzzle.

## Undo / Redo Redesign

Current state:
- Solitaire, Water Sort, and 15 Puzzle show separate Undo and Redo buttons.
- `HistoryManager.push()` clears future state on new move, so redo already remains available only until the next move is played.

Plan:
1. Create a reusable undo/redo control helper or shared CSS/DOM pattern:
   - one primary `Undo` button always visible.
   - a compact secondary control, menu, or disclosure for `Redo`.
2. Keep game-specific IDs or callback binding simple to avoid broad refactors.
3. Preserve keyboard shortcuts:
   - Ctrl/Cmd+Z undo
   - Ctrl/Cmd+Shift+Z redo
   - Ctrl/Cmd+Y redo
4. Apply to:
   - `src/games/solitaire/solitaire.ts`
   - `src/games/water-sort/water-sort.ts`
   - `src/games/15-puzzle/puzzle-15.ts`
5. Do not change `HistoryManager` unless tests reveal redo behavior is wrong.

Acceptance:
- Redo is hidden behind an additional popup/control.
- Redo is disabled/unavailable after a new move.
- Undo remains one obvious primary control.

## Solitaire

### A. Desktop Single-Click Auto Move

Root cause:
- Cards bind `click` to `tapCard()`.
- Cards also bind `pointerdown` to `startDrag()`.
- `startDrag()` immediately calls `e.preventDefault()`, creates a ghost, captures the pointer, and registers drag listeners.
- This can suppress or interfere with click generation on desktop.

Plan:
1. Replace immediate drag start with "pending drag" state:
   - store selection, element, pointerId, startX/startY, and initial card rect.
   - capture pointer only as needed or capture while pending but do not create ghost yet.
2. Add a movement threshold:
   - around 6-8px for mouse.
   - around 10-12px for touch.
3. If pointerup occurs before threshold:
   - treat it as `tapCard(selection)`.
   - do not create a ghost.
4. If movement exceeds threshold:
   - create the drag ghost.
   - continue existing drag behavior.
5. Preserve:
   - current carry/drag behavior.
   - double-click to foundation.
   - undo snapshots for actual moves only.
6. Ensure `destroy()` and `render()` clean up pending drag state as well as active drag.

Acceptance:
- Desktop single-click attempts auto-foundation/tableau move.
- Drag still works for waste, tableau stacks, and foundation cards.
- No extra undo entry is created by click without move.

### B. Auto-Complete Recognizing Deck Cards

Current behavior:
- `maybeAutoComplete()` only runs when all tableau cards are revealed.
- It moves top waste and top tableau cards to foundations.
- It does not draw from stock.

Interpretation:
- This is conservative Klondike behavior because stock cards are hidden information.
- If the user expects "deck" to mean waste, waste is already checked.
- If the user expects auto-complete to exhaust stock, that is a product behavior change.

Plan:
1. During implementation, reproduce first:
   - create or use a near-complete state with a movable waste card.
   - verify whether waste moves to foundation.
2. If waste does not move, fix the specific waste path.
3. If stock draw-through is required, implement explicitly:
   - only after all tableau cards are revealed.
   - draw stock to waste in a bounded loop.
   - attempt foundation moves after each draw.
   - stop when a full stock/waste cycle makes no progress.
   - decide whether auto-draw increments moves; likely yes for consistency, but this should be visible in plan before code.
4. Add guard to prevent infinite stock/waste recycling.

Acceptance:
- Waste top card auto-completes when legal.
- If stock auto-complete is implemented, it is bounded and does not loop forever.

### C. Animations

Current animations:
- Waste draw has `.card--drawn`.

Missing:
- Foundation placement animation.
- Tableau move animation.
- Auto-complete sequence animation.

Plan:
1. Start with low-risk CSS animations:
   - `.card--to-foundation`
   - `.card--placed`
   - `.card--auto-complete`
2. Prefer FLIP-style animation only if simple class animations cannot show movement accurately.
3. Respect reduced motion:
   - existing reduced-motion CSS already collapses animations globally.
4. Avoid delaying state correctness too much; if animation is async, prevent overlapping moves.

Acceptance:
- Draw, click-auto, drag-drop placement, and auto-complete have visible but short animations.
- Reduced motion setting disables meaningful motion.

### D. Preserve/Add Undo

Current state:
- Solitaire already uses `HistoryManager`.
- Draw stock, recycle stock, tableau/foundation moves all push undo snapshots.

Plan:
1. Ensure click-to-auto uses existing `tryMove()` paths so undo snapshots are preserved.
2. Ensure any new auto-complete stock draw behavior pushes snapshots consistently.
3. Ensure failed clicks/drags do not push undo snapshots.
4. Keep keyboard shortcuts working.

Acceptance:
- Undo reverts single-click auto moves.
- Redo remains available until a new move is made.

### E. Card Redesign

Current CSS:
- `.card`, `.card__corner`, `.card__pip`, `.card--back`, `.card--selected`.

Plan:
1. Keep DOM structure; redesign only CSS unless DOM is needed for accessibility.
2. Improve:
   - larger central pip.
   - clearer rank/suit corners.
   - better red/black contrast in dark and light modes.
   - more intentional card back pattern.
   - selected/hover states.
3. Test responsive card widths on mobile because Solitaire uses CSS variables for card size.

Acceptance:
- Cards look intentional and readable at desktop and mobile sizes.
- Tableau still fits seven columns on small screens.

## Water Sort

### Bottle Visual Redesign

Current state:
- Tube visuals are pure CSS with pseudo-elements and stacked spans.
- User explicitly rejects current look.

Plan:
1. Keep the existing TypeScript game logic.
2. Replace bottle CSS with a cleaner, more legible vessel:
   - flatter outer glass silhouette.
   - consistent inner liquid clipping.
   - clear rim and base.
   - less muddy pseudo-element layering.
3. Add dark-mode-aware glass/border tokens.
4. Ensure liquid layers are visibly separated but not over-stylized.
5. Keep buttons accessible and touch-sized.

Acceptance:
- Bottles look clearly like containers, not distorted pills.
- Liquid layers remain readable.
- Layout works for easy through expert tube counts.

### Pour Animation

Current state:
- `animatePour()` adds pouring/receiving classes for 220ms, but it only tilts the source and pulses the receiver. There is no visible stream or liquid transfer.

Plan:
1. Add transient CSS variables to source/target tube positions.
2. Render a temporary `.water-sort__pour-stream` overlay during `animatePour()`.
3. Angle/position the stream from source toward target.
4. Keep state mutation after animation completion as current code does.
5. Add reduced-motion fallback: skip stream and shorten transition.

Acceptance:
- Pour action shows a visible stream or transfer arc.
- Invalid pour still gives fail feedback without misleading stream.

## Minesweeper

### Board Fitting Root Cause

Current state:
- Beginner uses `--ms-cell-size: clamp(32px, 9.2vw, 40px)`.
- Intermediate fixed at `36px`.
- Expert fixed at `34px`.
- Expert has 30 columns, so the board cannot fit most mobile widths.
- `.minesweeper__board-scroll` uses `overflow: auto`; this explains inconsistent padding and fit.

Plan:
1. Decide behavior per difficulty:
   - Beginner: fit without scroll.
   - Intermediate: fit width on most phones if cell size remains usable.
   - Expert: choose between fit-to-width with small cells or a controlled pan/zoom model.
2. Implement a CSS/TS sizing model:
   - compute available inline size from container.
   - subtract board border, padding, and gaps.
   - `cellSize = floor((availableWidth - totalGaps) / cols)`.
   - cap max cell size.
   - enforce a minimum usable cell size.
3. For expert on very narrow screens:
   - either reduce padding/gaps and fit if cell size stays above minimum.
   - or introduce a deliberate scale/zoom mode, not accidental scroll.
4. Consider setting CSS variables from renderer:
   - `--ms-cols`
   - `--ms-rows`
   - `--ms-cell-size`
5. Recalculate on:
   - initial render.
   - difficulty change.
   - viewport resize/orientation change.
6. Keep long-press flagging and pointer scroll-cancel logic intact.

Acceptance:
- No no-padding/excess-right-padding/squares-do-not-fit bug on tested mobile sizes.
- Board alignment is centered when it fits.
- If expert cannot remain touch-usable at a viewport, the UI presents controlled pan/scale rather than broken overflow.

Suggested viewport checks:
- 320x568
- 360x640
- 375x667
- 390x844
- 414x896
- 430x932
- desktop 1280x720

## Block Blast

### Dragged Block Size Mismatch

Root cause:
- Tray and ghost cells use hard-coded 22px mini cells.
- Board cells are responsive.
- Ghost is scaled to 1.15.
- Preview squares represent board cell size, so dragged squares visually differ.

Plan:
1. Keep tray pieces compact when not dragging.
2. On drag start:
   - read board cell size and gap from `.block-blast__cell` rects.
   - render ghost with CSS vars:
     - `--bb-drag-cell-size`
     - `--bb-drag-gap`
   - make ghost mini cells match board cell size.
3. Remove `transform: scale(1.15)` from ghost or account for it in drop math. Prefer no scale.
4. Recompute anchor offsets using board-sized ghost cells, not tray mini size.
5. Make drop targeting use pointer plus intentional lift offset, or ghost rect consistently, but not a mixed model.

Acceptance:
- Dragged cells visually match board highlight cells.
- The preview appears under the intended placement.

### Drag Lift Too Large

Current state:
- Touch `liftY` is `3.5 * boardCellHeight`.

Plan:
1. Reduce to around `1.2-1.75 * boardCellHeight`.
2. Consider horizontal/vertical shape height:
   - larger shapes may need slightly more lift.
3. Keep enough lift so the finger does not cover the preview.
4. Validate on phone viewport.

Acceptance:
- Dragged piece is close enough to the touch point to feel connected.
- Placement preview remains visible.

## 15 Puzzle

### Keyboard Play Missing

Root cause:
- `onKeyDown` only handles undo/redo shortcuts.
- Registry advertises keyboard support.

Plan:
1. Add arrow-key handling to `onKeyDown`.
2. Choose clear semantics:
   - Recommended: arrow key moves the tile in that direction into the empty space, matching common sliding-puzzle controls.
   - Example: if empty is left of a tile, ArrowLeft moves that tile left.
3. Convert arrow key to a tile index adjacent to empty.
4. Call existing `moveTile(index)` to preserve:
   - move counting
   - undo snapshots
   - win detection
   - animation
5. Prevent default page scroll for handled arrow keys.
6. Ignore arrows when modifier keys are pressed.

Acceptance:
- Arrow keys move tiles.
- Ctrl/Cmd undo/redo still works.
- No page scroll while playing with arrows.

## Tic-Tac-Toe

### Improve X and O Visual Design

Current state:
- Cells render plain text `X` and `O`.
- CSS only changes color.

Plan:
1. Keep the button DOM and accessible text.
2. Add inner mark spans or CSS pseudo-elements:
   - X: two crossing strokes with rounded ends.
   - O: ring/circle with border and subtle inset.
3. Add win-state animation that works with the new marks.
4. Ensure dark mode contrast.

Acceptance:
- X and O look designed rather than plain text.
- Board remains readable and accessible.

## Additional Minor Problems Found During Research

1. `viteChunkName` comments in dynamic imports are Webpack-style and should not be relied on in Vite/Rollup.
   - Current manual chunks mostly hide this issue.
   - 15 Puzzle exposes it because it lacks a manual chunk.

2. Dark mode is partial, not token-complete.
   - Many components use dark-mode text tokens but light hard-coded backgrounds.

3. Difficulty-modal active/hover styling depends on undefined variables.
   - This likely explains the reported image 2 issue better than width alone.

4. Minesweeper has duplicate/contradictory touch-action intent.
   - General mobile safeguards set many boards to `touch-action: none`.
   - Minesweeper later overrides board to `pan-x pan-y`.
   - This is probably intentional from the previous mobile pass, but any fitting change must preserve long-press and scroll behavior.

5. Block Blast drop math couples ghost center, ghost scale, anchor offsets, and lift offset.
   - This makes visual tweaks risky unless the drop math is updated at the same time.

6. Solitaire foundation card click uses `select()` rather than `tapCard()`.
   - That may be fine, but after click/drag refactor, foundation click behavior should be explicitly tested.

7. Offline cache verification is string-match based.
   - Works only when chunk URLs contain game IDs.
   - A more robust package manifest would be better, but that would broaden scope beyond the immediate 15 Puzzle fix.

## Browser Reproduction Plan Before Implementation

1. Start dev server:
   - `npm run dev -- --host 127.0.0.1`
2. Desktop checks:
   - Solitaire: click waste/tableau legal card; verify auto move fails before fix.
   - 15 Puzzle: try arrow keys; verify no movement before fix.
   - Dark mode: inspect home cards, settings, difficulty modal.
3. Mobile viewport checks:
   - Minesweeper beginner/intermediate/expert at listed viewport sizes.
   - Block Blast drag on touch emulation if available.
   - Water Sort tube layout for all difficulties.
4. Offline check:
   - Use built app or preview with service worker where possible.
   - Confirm 15 Puzzle offline download failure before fix if reproducible.

## Verification Plan After Implementation

Required commands:
- `npm test`
- `npm run build`
- `npm run dev` or `npm run preview` plus browser smoke checks

Suggested additional checks:
- `npm run test:e2e` if route smoke is stable in the current environment.
- Manual dark-mode pass on home, settings, offline manager, difficulty modal, and each touched game.
- Mobile viewport screenshots/checks for:
  - Minesweeper all difficulties
  - Block Blast drag preview
  - Solitaire layout and card click/drag
  - Water Sort bottle layout

Known environment caveat from prior memory:
- Local Playwright Chromium support may be unavailable on this machine/OS combination. If browser automation fails for that reason, still run build/unit tests and perform manual dev-server checks, then report the automation blocker explicitly.
