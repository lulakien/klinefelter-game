/**
 * Minesweeper — game logic and DOM rendering.
 *
 * Classic mine-clearing puzzle. CSS Grid board with touch support.
 * Long-press or right-click to flag. First click is always safe.
 */

import { playSfx, vibrate } from "../../app/audio-manager.js";
import { saveScore } from "../../settings/scores-store.js";

// ---- Types ----

interface Cell {
  row: number;
  col: number;
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacentMines: number;
}

interface GameState {
  grid: Cell[][];
  rows: number;
  cols: number;
  mineCount: number;
  flagsPlaced: number;
  revealedCount: number;
  started: boolean;
  gameOver: boolean;
  won: boolean;
  startTime: number;
  elapsed: number;
  scoreSubmitted: boolean;
  difficulty: Difficulty;
}

// ---- Constants ----

export type Difficulty = "beginner" | "intermediate" | "expert";

const DIFFICULTIES: Record<Difficulty, { rows: number; cols: number; mineCount: number }> = {
  beginner: { rows: 9, cols: 9, mineCount: 10 },
  intermediate: { rows: 16, cols: 16, mineCount: 40 },
  expert: { rows: 16, cols: 30, mineCount: 99 },
};

// ---- Game Logic ----

export function createGame(difficulty: Difficulty = "beginner"): GameState {
  const { rows, cols, mineCount } = DIFFICULTIES[difficulty];
  const grid: Cell[][] = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      grid[r][c] = {
        row: r,
        col: c,
        mine: false,
        revealed: false,
        flagged: false,
        adjacentMines: 0,
      };
    }
  }

  return {
    grid,
    rows,
    cols,
    mineCount,
    flagsPlaced: 0,
    revealedCount: 0,
    started: false,
    gameOver: false,
    won: false,
    startTime: 0,
    elapsed: 0,
    scoreSubmitted: false,
    difficulty,
  };
}

/** Place mines randomly, avoiding the first-click cell. */
function placeMines(state: GameState, safeRow: number, safeCol: number): void {
  const safeCells = new Set<string>();
  // Safe zone: the clicked cell and its neighbors
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = safeRow + dr;
      const c = safeCol + dc;
      if (r >= 0 && r < state.rows && c >= 0 && c < state.cols) {
        safeCells.add(`${r},${c}`);
      }
    }
  }

  let placed = 0;
  while (placed < state.mineCount) {
    const r = Math.floor(Math.random() * state.rows);
    const c = Math.floor(Math.random() * state.cols);
    const key = `${r},${c}`;

    if (safeCells.has(key)) continue;
    if (state.grid[r][c].mine) continue;

    state.grid[r][c].mine = true;
    placed++;
  }

  // Calculate adjacent mine counts
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.grid[r][c].mine) continue;
      state.grid[r][c].adjacentMines = countAdjacentMines(state, r, c);
    }
  }
}

function countAdjacentMines(
  state: GameState,
  row: number,
  col: number,
): number {
  let count = 0;
  forEachNeighbor(state, row, col, (cell) => {
    if (cell.mine) count++;
  });
  return count;
}

function forEachNeighbor(
  state: GameState,
  row: number,
  col: number,
  fn: (cell: Cell) => void,
): void {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < state.rows && c >= 0 && c < state.cols) {
        fn(state.grid[r][c]);
      }
    }
  }
}

/** Reveal a cell. Returns true if the move resulted in a game state change. */
export function reveal(state: GameState, row: number, col: number): boolean {
  if (state.gameOver) return false;

  const cell = state.grid[row]?.[col];
  if (!cell) return false;
  if (cell.revealed) return false;
  if (cell.flagged) return false;

  // First click — place mines
  if (!state.started) {
    placeMines(state, row, col);
    state.started = true;
    state.startTime = Date.now();
  }

  if (cell.mine) {
    // Game over — reveal all mines
    cell.revealed = true;
    state.gameOver = true;
    state.elapsed = (Date.now() - state.startTime) / 1000;
    revealAllMines(state);
    return true;
  }

  // Flood fill for empty cells
  floodReveal(state, row, col);
  checkWin(state);
  return true;
}

function floodReveal(state: GameState, row: number, col: number): void {
  const cell = state.grid[row]?.[col];
  if (!cell) return;
  if (cell.revealed) return;
  if (cell.flagged) return;
  if (cell.mine) return;

  cell.revealed = true;
  state.revealedCount++;

  if (cell.adjacentMines === 0) {
    forEachNeighbor(state, row, col, (neighbor) => {
      floodReveal(state, neighbor.row, neighbor.col);
    });
  }
}

/** Toggle flag on a cell. Returns true if state changed. */
export function toggleFlag(state: GameState, row: number, col: number): boolean {
  if (state.gameOver) return false;

  const cell = state.grid[row]?.[col];
  if (!cell) return false;
  if (cell.revealed) return false;

  cell.flagged = !cell.flagged;
  state.flagsPlaced += cell.flagged ? 1 : -1;
  return true;
}

/** Chord click (click on a revealed number to reveal neighbors). */
export function chord(
  state: GameState,
  row: number,
  col: number,
): boolean {
  if (state.gameOver) return false;

  const cell = state.grid[row]?.[col];
  if (!cell) return false;
  if (!cell.revealed) return false;
  if (cell.adjacentMines === 0) return false;

  // Count adjacent flags
  let flagCount = 0;
  forEachNeighbor(state, row, col, (n) => {
    if (n.flagged) flagCount++;
  });

  if (flagCount !== cell.adjacentMines) return false;

  // Reveal all non-flagged neighbors
  let changed = false;
  forEachNeighbor(state, row, col, (n) => {
    if (!n.revealed && !n.flagged) {
      if (n.mine) {
        // Flagged wrong — game over
        n.revealed = true;
        state.gameOver = true;
        revealAllMines(state);
        changed = true;
      } else {
        floodReveal(state, n.row, n.col);
        changed = true;
      }
    }
  });

  if (!state.gameOver) checkWin(state);
  return changed;
}

function revealAllMines(state: GameState): void {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = state.grid[r][c];
      if (cell.mine && !cell.flagged) {
        cell.revealed = true;
      }
    }
  }
}

function checkWin(state: GameState): void {
  const totalCells = state.rows * state.cols;
  if (state.revealedCount === totalCells - state.mineCount) {
    state.won = true;
    state.gameOver = true;
    state.elapsed = (Date.now() - state.startTime) / 1000;
  }
}

function submitWinningScore(state: GameState): void {
  if (!state.won || state.scoreSubmitted) return;

  const seconds = Math.max(1, Math.floor(state.elapsed));
  saveScore("minesweeper", seconds, `${seconds}s`);
  state.scoreSubmitted = true;
}

export function getElapsed(state: GameState): number {
  if (!state.started) return 0;
  if (state.gameOver) return state.elapsed;
  return (Date.now() - state.startTime) / 1000;
}

// ---- Number Colors ----

const NUMBER_COLORS: Record<number, string> = {
  1: "#4ecca3",
  2: "#44aaff",
  3: "#f0a500",
  4: "#e94560",
  5: "#ff4444",
  6: "#cc2222",
  7: "#aa0000",
  8: "#880000",
};

// ---- DOM Rendering ----

export class MinesweeperRenderer {
  private container: HTMLElement | null = null;
  private state: GameState;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  // Pointer handling for tap, scroll-cancel, and long-press flag.
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private pressGesture: {
    pointerId: number;
    row: number;
    col: number;
    x: number;
    y: number;
    longPressed: boolean;
  } | null = null;
  private suppressClickKey: string | null = null;
  private suppressClickUntil = 0;

  // Bound handlers
  private onContextMenu: (e: Event) => void;

  constructor(state: GameState) {
    this.state = state;
    this.onContextMenu = (e: Event) => e.preventDefault();
  }

  private setDifficulty(difficulty: Difficulty): void {
    this.state = createGame(difficulty);
    this.render();
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.addEventListener("contextmenu", this.onContextMenu);
    this.render();

    // Timer update
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => this.updateTimer(), 250);
  }

  destroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.clearPressTimer();
    if (this.container) {
      this.container.removeEventListener("contextmenu", this.onContextMenu);
    }
    this.container = null;
  }

  // ---- Event handlers ----

  private handleCellClick(row: number, col: number): void {
    const changed = reveal(this.state, row, col);
    if (changed) {
      this.playStateSfx();
      this.render();
    }
  }

  private handleCellRightClick(row: number, col: number): void {
    const changed = toggleFlag(this.state, row, col);
    if (changed) {
      playSfx("hit");
      this.render();
    }
  }

  private handleCellChord(row: number, col: number): void {
    const changed = chord(this.state, row, col);
    if (changed) {
      this.playStateSfx();
      this.render();
    }
  }

  // Touch/pen: tap = reveal, long-press = flag, move = let the board scroll.
  private handlePointerDown(e: PointerEvent, row: number, col: number): void {
    if (e.pointerType === "mouse") return;
    this.clearPressTimer();
    this.pressGesture = {
      pointerId: e.pointerId,
      row,
      col,
      x: e.clientX,
      y: e.clientY,
      longPressed: false,
    };
    this.pressTimer = setTimeout(() => {
      const gesture = this.pressGesture;
      if (!gesture || gesture.pointerId !== e.pointerId) return;
      gesture.longPressed = true;
      this.suppressSyntheticClick(row, col);
      const changed = toggleFlag(this.state, row, col);
      if (changed) {
        playSfx("hit");
        if ("vibrate" in navigator) navigator.vibrate(15);
        this.clearPressTimer();
        this.render();
      }
    }, 430);
  }

  private handlePointerMove(e: PointerEvent): void {
    const gesture = this.pressGesture;
    if (!gesture || gesture.pointerId !== e.pointerId || gesture.longPressed) return;
    if (Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 10) {
      this.clearPressTimer();
      this.pressGesture = null;
    }
  }

  private handlePointerUp(e: PointerEvent, row: number, col: number): void {
    const gesture = this.pressGesture;
    if (!gesture || gesture.pointerId !== e.pointerId) return;
    const wasLongPress = gesture.longPressed;
    this.clearPressTimer();
    this.pressGesture = null;

    if (wasLongPress) {
      e.preventDefault();
      this.suppressSyntheticClick(row, col);
      return;
    }

    e.preventDefault();
    this.suppressSyntheticClick(row, col);
    const cell = this.state.grid[row]?.[col];
    if (cell?.revealed && cell.adjacentMines > 0) {
      this.handleCellChord(row, col);
    } else {
      this.handleCellClick(row, col);
    }
  }

  private handlePointerCancel(e: PointerEvent): void {
    if (this.pressGesture?.pointerId === e.pointerId) {
      this.clearPressTimer();
      this.pressGesture = null;
    }
  }

  private clearPressTimer(): void {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  private suppressSyntheticClick(row: number, col: number): void {
    this.suppressClickKey = `${row},${col}`;
    this.suppressClickUntil = Date.now() + 700;
  }

  restart(): void {
    this.state = createGame(this.state.difficulty);
    this.render();
  }

  // ---- Rendering ----

  render(): void {
    if (!this.container) return;
    submitWinningScore(this.state);

    const { cols, mineCount, flagsPlaced, gameOver, won } = this.state;
    const elapsed = getElapsed(this.state);
    const remaining = mineCount - flagsPlaced;

    let smiley = "🙂";
    if (gameOver) smiley = won ? "😎" : "💀";

    const diff = this.state.difficulty;

    this.container.innerHTML = `
      <div class="minesweeper minesweeper--${diff}">
        <div class="minesweeper__difficulty">
          <div class="toggle-group" id="ms-diff-toggle">
            <button class="toggle-btn ${diff === "beginner" ? "toggle-btn--active" : ""}" data-value="beginner">Easy</button>
            <button class="toggle-btn ${diff === "intermediate" ? "toggle-btn--active" : ""}" data-value="intermediate">Medium</button>
            <button class="toggle-btn ${diff === "expert" ? "toggle-btn--active" : ""}" data-value="expert">Hard</button>
          </div>
        </div>

        <div class="minesweeper__header">
          <div class="minesweeper__counter">💣 ${remaining}</div>
          <button class="minesweeper__smiley" id="btn-smiley">${smiley}</button>
          <div class="minesweeper__timer">⏱ ${Math.floor(elapsed)}</div>
        </div>

        <div class="minesweeper__board-scroll" aria-label="Scrollable Minesweeper board">
          <div class="minesweeper__board" id="ms-board"
               style="display:grid;grid-template-columns:repeat(${cols},var(--ms-cell-size));grid-auto-rows:var(--ms-cell-size);gap:2px;">
            ${this.renderBoardHTML()}
          </div>
        </div>

        <div class="minesweeper__controls">
          <button class="btn btn--secondary" id="btn-ms-restart">New Game</button>
          <a class="btn btn--secondary" href="#/">Back to Home</a>
        </div>

        <p class="minesweeper__hint">Tap to reveal · Long-press to flag</p>
      </div>
    `;

    // Bind events
    this.bindEvents();
  }

  private renderBoardHTML(): string {
    const { grid, rows, cols, gameOver } = this.state;
    let html = "";

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        const cellId = `cell-${r}-${c}`;
        let classes = "ms-cell";
        let content = "";

        if (cell.revealed) {
          classes += " ms-cell--revealed";
          if (cell.mine) {
            classes += " ms-cell--mine";
            content = "💣";
          } else if (cell.adjacentMines > 0) {
            const color = NUMBER_COLORS[cell.adjacentMines] ?? "#000";
            content = `<span style="color:${color};font-weight:700;">${cell.adjacentMines}</span>`;
          }
        } else {
          classes += " ms-cell--hidden";
          if (cell.flagged && !gameOver) {
            content = "🚩";
            classes += " ms-cell--flagged";
          } else if (cell.flagged && gameOver && !cell.mine) {
            content = "❌";
            classes += " ms-cell--wrong";
          }
        }

        html +=
          `<div class="${classes}" id="${cellId}" data-row="${r}" data-col="${c}">${content}</div>`;
      }
    }

    return html;
  }

  private bindEvents(): void {
    if (!this.container) return;
    const { rows, cols } = this.state;

    // Smiley button
    this.container.querySelector("#btn-smiley")
      ?.addEventListener("click", () => this.restart());

    // Difficulty toggle
    this.container.querySelector("#ms-diff-toggle")?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(".toggle-btn");
      if (!btn) return;
      const value = btn.getAttribute("data-value") as Difficulty;
      if (value && value !== this.state.difficulty) {
        this.setDifficulty(value);
      }
    });

    // Restart button
    this.container.querySelector("#btn-ms-restart")
      ?.addEventListener("click", () => this.restart());

    // Cell events
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const el = this.container.querySelector<HTMLElement>(`#cell-${r}-${c}`);
        if (!el) continue;

        el.addEventListener("click", (e) => {
          e.preventDefault();
          if (this.suppressClickKey === `${r},${c}` && Date.now() < this.suppressClickUntil) {
            return;
          }
          const cell = this.state.grid[r][c];
          if (cell?.revealed && cell.adjacentMines > 0) {
            this.handleCellChord(r, c);
          } else {
            this.handleCellClick(r, c);
          }
        });

        el.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          this.handleCellRightClick(r, c);
        });

        el.addEventListener("pointerdown", (e) => this.handlePointerDown(e, r, c));
        el.addEventListener("pointermove", (e) => this.handlePointerMove(e));
        el.addEventListener("pointerup", (e) => this.handlePointerUp(e, r, c));
        el.addEventListener("pointercancel", (e) => this.handlePointerCancel(e));
      }
    }
  }

  private playStateSfx(): void {
    if (this.state.won) {
      playSfx("success");
      vibrate([25, 25, 25]);
    } else if (this.state.gameOver) {
      playSfx("fail");
      vibrate(60);
    } else {
      playSfx("hit");
    }
  }

  private updateTimer(): void {
    if (!this.state.started || this.state.gameOver) return;

    const el = this.container?.querySelector(".minesweeper__timer");
    if (el) {
      el.textContent = `⏱ ${Math.floor(getElapsed(this.state))}`;
    }
  }
}
