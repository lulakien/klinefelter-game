/**
 * 2048 — game logic and DOM rendering.
 *
 * Classic tile-sliding puzzle. Pure CSS/DOM — no Canvas needed.
 * Supports keyboard (arrow keys) and touch (swipe).
 */

import { playSfx } from "../../app/audio-manager.js";
import { getPersonalBest, saveScore } from "../../settings/scores-store.js";

// ---- Types ----

interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
  /** Previous position for animation */
  prevRow: number;
  prevCol: number;
  /** Whether this tile was just merged (for animation) */
  merged: boolean;
  /** Whether this tile is new (for animation) */
  isNew: boolean;
}

interface GameState {
  grid: (Tile | null)[][];
  tiles: Tile[];
  score: number;
  bestScore: number;
  gameOver: boolean;
  won: boolean;
  keepPlaying: boolean;
  scoreSubmitted: boolean;
}

// ---- Constants ----

const GRID_SIZE = 4;
const WIN_VALUE = 2048;

// ---- Game Logic ----

let nextTileId = 0;

export function createGame(): GameState {
  nextTileId = 0;
  const grid: (Tile | null)[][] = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => null),
  );

  const state: GameState = {
    grid,
    tiles: [],
    score: 0,
    bestScore: getPersonalBest("2048")?.score ?? 0,
    gameOver: false,
    won: false,
    keepPlaying: false,
    scoreSubmitted: false,
  };

  // Spawn two initial tiles
  spawnTile(state);
  spawnTile(state);

  return state;
}

/** Spawn a new tile (90% chance of 2, 10% chance of 4). */
function spawnTile(state: GameState): void {
  const empty: { row: number; col: number }[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!state.grid[r][c]) {
        empty.push({ row: r, col: c });
      }
    }
  }

  if (empty.length === 0) return;

  const { row, col } = empty[Math.floor(Math.random() * empty.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  const tile: Tile = {
    id: nextTileId++,
    value,
    row,
    col,
    prevRow: row,
    prevCol: col,
    merged: false,
    isNew: true,
  };

  state.grid[row][col] = tile;
  state.tiles.push(tile);
}

/** Slide tiles in one direction. Returns the score gained. */
export function move(state: GameState, direction: Direction): boolean {
  if (state.gameOver) return false;
  if (state.won && !state.keepPlaying) return false;

  // Reset animation flags
  for (const tile of state.tiles) {
    tile.prevRow = tile.row;
    tile.prevCol = tile.col;
    tile.merged = false;
    tile.isNew = false;
  }

  let moved = false;
  let scoreGained = 0;

  const vectors = DIRECTION_VECTORS[direction];
  const traversals = buildTraversals(direction);

  // Clear grid references (we rebuild from tiles)
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      state.grid[r][c] = null;
    }
  }

  // Process each cell in traversal order
  for (const { row, col } of traversals) {
    const tile = findTileAt(state, row, col);
    if (!tile) continue;

    // Find farthest position
    let farthest = { row: tile.row, col: tile.col };
    let next = {
      row: farthest.row + vectors.y,
      col: farthest.col + vectors.x,
    };

    while (withinBounds(next) && !getGridCell(state.grid, next)) {
      farthest = next;
      next = {
        row: farthest.row + vectors.y,
        col: farthest.col + vectors.x,
      };
    }

    // Check if we can merge with the next tile
    const nextCell = withinBounds(next) ? getGridCell(state.grid, next) : null;
    if (nextCell && nextCell.value === tile.value && !nextCell.merged) {
      // Merge
      tile.value *= 2;
      tile.row = nextCell.row;
      tile.col = nextCell.col;
      tile.merged = true;
      state.score += tile.value;
      scoreGained += tile.value;

      // Remove merged tile
      state.tiles = state.tiles.filter((t) => t.id !== nextCell.id);
      moved = true;
    } else {
      // Move to farthest
      if (farthest.row !== tile.row || farthest.col !== tile.col) {
        tile.row = farthest.row;
        tile.col = farthest.col;
        moved = true;
      }
    }

    state.grid[tile.row][tile.col] = tile;
  }

  if (moved) {
    spawnTile(state);
    updateBestScore(state);

    // Check win
    if (!state.won) {
      for (const tile of state.tiles) {
        if (tile.value >= WIN_VALUE) {
          state.won = true;
          break;
        }
      }
    }

    // Check game over
    if (!hasMovesLeft(state)) {
      state.gameOver = true;
    }
  }

  return moved;
}

function findTileAt(state: GameState, row: number, col: number): Tile | null {
  for (const tile of state.tiles) {
    if (tile.row === row && tile.col === col) return tile;
  }
  return null;
}

function getGridCell(
  grid: (Tile | null)[][],
  pos: { row: number; col: number },
): Tile | null {
  return grid[pos.row]?.[pos.col] ?? null;
}

function withinBounds(pos: { row: number; col: number }): boolean {
  return (
    pos.row >= 0 && pos.row < GRID_SIZE && pos.col >= 0 && pos.col < GRID_SIZE
  );
}

function hasMovesLeft(state: GameState): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!state.grid[r][c]) return true;
      const val = state.grid[r][c]!.value;
      // Check right neighbor
      if (c + 1 < GRID_SIZE && state.grid[r][c + 1]?.value === val) return true;
      // Check bottom neighbor
      if (r + 1 < GRID_SIZE && state.grid[r + 1]?.[c]?.value === val) return true;
    }
  }
  return false;
}

function updateBestScore(state: GameState): void {
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
  }
}

function submitScoreIfComplete(state: GameState): void {
  if (state.scoreSubmitted) return;
  if (!state.gameOver && !(state.won && !state.keepPlaying)) return;

  saveScore("2048", state.score, state.score.toLocaleString());
  state.scoreSubmitted = true;
}

// ---- Direction helpers ----

type Direction = "up" | "down" | "left" | "right";

interface Vector {
  x: number;
  y: number;
}

const DIRECTION_VECTORS: Record<Direction, Vector> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function buildTraversals(dir: Direction): { row: number; col: number }[] {
  const positions: { row: number; col: number }[] = [];
  const rowOrder = dir === "down" ? [3, 2, 1, 0] : [0, 1, 2, 3];
  const colOrder = dir === "right" ? [3, 2, 1, 0] : [0, 1, 2, 3];

  for (const row of rowOrder) {
    for (const col of colOrder) {
      positions.push({ row, col });
    }
  }
  return positions;
}

// ---- Tile Colors ----

const TILE_COLORS: Record<number, { bg: string; text: string }> = {
  2: { bg: "#eee4da", text: "#776e65" },
  4: { bg: "#ede0c8", text: "#776e65" },
  8: { bg: "#f2b179", text: "#f9f6f2" },
  16: { bg: "#f59563", text: "#f9f6f2" },
  32: { bg: "#f67c5f", text: "#f9f6f2" },
  64: { bg: "#f65e3b", text: "#f9f6f2" },
  128: { bg: "#edcf72", text: "#f9f6f2" },
  256: { bg: "#edcc61", text: "#f9f6f2" },
  512: { bg: "#edc850", text: "#f9f6f2" },
  1024: { bg: "#edc53f", text: "#f9f6f2" },
  2048: { bg: "#edc22e", text: "#f9f6f2" },
  4096: { bg: "#3c3a32", text: "#f9f6f2" },
  8192: { bg: "#3c3a32", text: "#f9f6f2" },
};

function getTileColor(value: number): { bg: string; text: string } {
  return TILE_COLORS[value] ?? { bg: "#3c3a32", text: "#f9f6f2" };
}

function getTileFontSize(value: number): string {
  if (value < 100) return "28px";
  if (value < 1000) return "24px";
  if (value < 10000) return "20px";
  return "16px";
}

// ---- DOM Rendering ----

export class Game2048Renderer {
  private container: HTMLElement | null = null;
  private state: GameState;

  // Touch swipe tracking
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;

  // Bound handlers
  private onKeyDown: (e: KeyboardEvent) => void;
  private onTouchStart: (e: TouchEvent) => void;
  private onTouchEnd: (e: TouchEvent) => void;

  constructor(state: GameState) {
    this.state = state;
    this.onKeyDown = this.handleKeyDown.bind(this);
    this.onTouchStart = this.handleTouchStart.bind(this);
    this.onTouchEnd = this.handleTouchEnd.bind(this);
  }

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();

    window.addEventListener("keydown", this.onKeyDown);
    container.addEventListener("touchstart", this.onTouchStart, { passive: false });
    container.addEventListener("touchend", this.onTouchEnd, { passive: false });
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    if (this.container) {
      this.container.removeEventListener("touchstart", this.onTouchStart);
      this.container.removeEventListener("touchend", this.onTouchEnd);
    }
    this.container = null;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const keyMap: Record<string, Direction> = {
      arrowup: "up",
      arrowdown: "down",
      arrowleft: "left",
      arrowright: "right",
      w: "up",
      s: "down",
      a: "left",
      d: "right",
    };

    const dir = keyMap[e.key.toLowerCase()];
    if (dir) {
      e.preventDefault();
      const moved = move(this.state, dir);
      if (moved) {
        playSfx("hit");
        this.render();
      }
    }
  }

  private handleTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.touchStartTime = Date.now();
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    const dx =
      (e.changedTouches[0]?.clientX ?? this.touchStartX) - this.touchStartX;
    const dy =
      (e.changedTouches[0]?.clientY ?? this.touchStartY) - this.touchStartY;
    const dt = Date.now() - this.touchStartTime;

    // Require a fast enough swipe
    if (dt > 800) return;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const minSwipe = 30;

    if (Math.max(absDx, absDy) < minSwipe) return;

    let dir: Direction;
    if (absDx > absDy) {
      dir = dx > 0 ? "right" : "left";
    } else {
      dir = dy > 0 ? "down" : "up";
    }

    const moved = move(this.state, dir);
    if (moved) {
      playSfx("hit");
      this.render();
    }
  }

  /** Full re-render of the game. */
  render(): void {
    if (!this.container) return;
    submitScoreIfComplete(this.state);

    this.container.innerHTML = `
      <div class="game-2048">
        <div class="game-2048__header">
          <div class="game-2048__title-area">
            <h1 class="game-2048__title">2048</h1>
            <p class="game-2048__subtitle">Join tiles to reach 2048!</p>
          </div>
          <div class="game-2048__scores">
            <div class="game-2048__score-box">
              <span class="game-2048__score-label">Score</span>
              <span class="game-2048__score-value">${this.state.score}</span>
            </div>
            <div class="game-2048__score-box">
              <span class="game-2048__score-label">Best</span>
              <span class="game-2048__score-value">${this.state.bestScore}</span>
            </div>
          </div>
        </div>

        <div class="game-2048__board" id="board-2048">
          ${this.renderBoardHTML()}
        </div>

        <div class="game-2048__controls">
          <button class="btn btn--secondary" id="btn-2048-restart">New Game</button>
          <a class="btn btn--secondary" href="#/">Back to Home</a>
        </div>

        ${this.state.gameOver ? this.renderGameOver() : ""}
        ${this.state.won && !this.state.keepPlaying && !this.state.gameOver ? this.renderWin() : ""}
      </div>
    `;

    if (this.state.gameOver) {
      playSfx("fail");
    } else if (this.state.won && !this.state.keepPlaying) {
      playSfx("success");
    }

    // Bind restart button
    document
      .getElementById("btn-2048-restart")
      ?.addEventListener("click", () => this.restart());

    // Bind keep playing button
    document
      .getElementById("btn-2048-keep-playing")
      ?.addEventListener("click", () => {
        this.state.keepPlaying = true;
        this.render();
      });
  }

  private renderBoardHTML(): string {
    const { grid } = this.state;
    let html =
      '<div class="game-2048__grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">';

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const tile = grid[r]?.[c];
        html += '<div class="game-2048__cell">';
        if (tile) {
          const colors = getTileColor(tile.value);
          const fontSize = getTileFontSize(tile.value);
          let animClass = "";
          if (tile.isNew) animClass = " game-2048__tile--new";
          if (tile.merged) animClass = " game-2048__tile--merged";
          html +=
            `<div class="game-2048__tile${animClass}" style="background:${colors.bg}; color:${colors.text}; font-size:${fontSize};">${tile.value}</div>`;
        }
        html += "</div>";
      }
    }

    html += "</div>";
    return html;
  }

  private renderGameOver(): string {
    return `
      <div class="game-2048__overlay">
        <div class="game-2048__overlay-content">
          <h2>Game Over!</h2>
          <p>Score: ${this.state.score}</p>
        </div>
      </div>
    `;
  }

  private renderWin(): string {
    return `
      <div class="game-2048__overlay game-2048__overlay--win">
        <div class="game-2048__overlay-content">
          <h2>You Win!</h2>
          <p>Score: ${this.state.score}</p>
          <button class="btn btn--primary" id="btn-2048-keep-playing">Keep Playing</button>
        </div>
      </div>
    `;
  }

  restart(): void {
    this.state = createGame();
    this.render();
  }
}
