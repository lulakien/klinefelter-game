/**
 * 15 Puzzle — classic 4x4 sliding image puzzle.
 */

import { playSfx, vibrate } from "../../app/audio-manager.js";
import { getPersonalBest, saveScore } from "../../settings/scores-store.js";
import { HistoryManager } from "../../core/history-manager.js";

const SIZE = 4;
const TILE_COUNT = SIZE * SIZE;
const EMPTY = 0;

interface Puzzle15State {
  tiles: number[];
  moves: number;
  bestMoves: number;
  won: boolean;
  scoreSubmitted: boolean;
  startedAt: number | null;
  elapsedSeconds: number;
  design: number;
}

const DESIGNS = [
  "radial-gradient(circle at 24% 22%, #fff7ad 0 12%, transparent 13%), linear-gradient(135deg, #ff5b5b, #ffd529)",
  "radial-gradient(circle at 76% 28%, #ffffff88 0 11%, transparent 12%), linear-gradient(135deg, #23c7f4, #2ed1a2)",
  "linear-gradient(45deg, #9b5cff 0 25%, #c56cf0 25% 50%, #ff6b9d 50% 75%, #ffd529 75%)",
  "radial-gradient(circle at 30% 72%, #82de47 0 14%, transparent 15%), linear-gradient(160deg, #3f8cff, #23c7f4 48%, #fff3e8)",
  "repeating-linear-gradient(135deg, #fff3e8 0 16px, #ffe2d0 16px 32px), radial-gradient(circle at 50% 50%, #ff9f43, #ff5b5b)",
];

export function createPuzzle15Game(): Puzzle15State {
  return {
    tiles: shuffleByLegalMoves(),
    moves: 0,
    bestMoves: getPersonalBest("15-puzzle")?.score ?? 0,
    won: false,
    scoreSubmitted: false,
    startedAt: null,
    elapsedSeconds: 0,
    design: Math.floor(Math.random() * DESIGNS.length),
  };
}

function shuffleByLegalMoves(): number[] {
  const tiles = Array.from({ length: TILE_COUNT }, (_, index) => (index + 1) % TILE_COUNT);
  let emptyIndex = TILE_COUNT - 1;
  let previousEmpty = -1;

  for (let step = 0; step < 180; step++) {
    const candidates = adjacentIndices(emptyIndex).filter((index) => index !== previousEmpty);
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    [tiles[emptyIndex], tiles[next]] = [tiles[next], tiles[emptyIndex]];
    previousEmpty = emptyIndex;
    emptyIndex = next;
  }

  return isSolved(tiles) ? shuffleByLegalMoves() : tiles;
}

function adjacentIndices(index: number): number[] {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const result: number[] = [];
  if (row > 0) result.push(index - SIZE);
  if (row < SIZE - 1) result.push(index + SIZE);
  if (col > 0) result.push(index - 1);
  if (col < SIZE - 1) result.push(index + 1);
  return result;
}

function isSolved(tiles: number[]): boolean {
  return tiles.every((tile, index) => tile === (index + 1) % TILE_COUNT);
}

function getElapsedSeconds(state: Puzzle15State): number {
  if (state.won) return state.elapsedSeconds;
  if (state.startedAt === null) return 0;
  return Math.floor((Date.now() - state.startedAt) / 1000);
}

function submitScore(state: Puzzle15State): void {
  if (!state.won || state.scoreSubmitted) return;
  saveScore("15-puzzle", state.moves, `${state.moves} moves · ${state.elapsedSeconds}s`);
  state.scoreSubmitted = true;
}

export class Puzzle15Renderer {
  private container: HTMLElement | null = null;
  private state: Puzzle15State;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private swipeStart: { index: number; x: number; y: number; pointerId: number } | null = null;
  private suppressClickIndex: number | null = null;
  private animating = false;
  private history = new HistoryManager<Puzzle15State>(50);
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

  constructor(state: Puzzle15State) {
    this.state = state;
  }

  getState(): any {
    return this.state;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
    this.timerInterval = setInterval(() => this.updateTimer(), 500);
    window.addEventListener("keydown", this.onKeyDown);
  }

  destroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.container) this.container.innerHTML = "";
    this.container = null;
    window.removeEventListener("keydown", this.onKeyDown);
  }

  private restart(): void {
    this.state = createPuzzle15Game();
    this.history.clear();
    this.render();
  }

  private handleArrowKey(key: string): void {
    if (this.state.won || this.animating) return;
    const emptyIndex = this.state.tiles.indexOf(EMPTY);
    const row = Math.floor(emptyIndex / SIZE);
    const col = emptyIndex % SIZE;

    let targetIndex = -1;

    // Arrow keys move the tile INTO the empty space
    // So ArrowUp moves the tile below the empty space up
    if (key === "ArrowUp" && row < SIZE - 1) {
      targetIndex = emptyIndex + SIZE; // tile below
    } else if (key === "ArrowDown" && row > 0) {
      targetIndex = emptyIndex - SIZE; // tile above
    } else if (key === "ArrowLeft" && col < SIZE - 1) {
      targetIndex = emptyIndex + 1; // tile to the right
    } else if (key === "ArrowRight" && col > 0) {
      targetIndex = emptyIndex - 1; // tile to the left
    }

    if (targetIndex >= 0 && targetIndex < TILE_COUNT) {
      this.moveTile(targetIndex);
    }
  }

  private moveTile(index: number): void {
    if (this.state.won) return;
    const emptyIndex = this.state.tiles.indexOf(EMPTY);
    if (!adjacentIndices(emptyIndex).includes(index)) {
      playSfx("fail");
      return;
    }

    if (this.state.startedAt === null) {
      this.state.startedAt = Date.now();
    }

    const before = structuredClone(this.state);

    // Swap tiles
    [this.state.tiles[emptyIndex], this.state.tiles[index]] = [this.state.tiles[index], this.state.tiles[emptyIndex]];
    this.state.moves++;
    this.history.push(before);
    this.state.won = isSolved(this.state.tiles);
    if (this.state.won) {
      this.state.elapsedSeconds = getElapsedSeconds(this.state);
      if (!this.state.bestMoves || this.state.moves < this.state.bestMoves) this.state.bestMoves = this.state.moves;
      vibrate([25, 25, 25]);
    }
    playSfx(this.state.won ? "success" : "hit");

    // Animate the tile movement
    this.animateTileMove(index, emptyIndex, () => {
      this.render();
    });
  }

  private render(): void {
    if (!this.container) return;
    submitScore(this.state);
    const elapsed = getElapsedSeconds(this.state);

    this.container.innerHTML = `
      <div class="puzzle-15">
        <div class="puzzle-header">
          <div>
            <h1>15 Puzzle</h1>
            <p>Slide tiles into order to restore the picture.</p>
          </div>
          <div class="puzzle-stats">
            <span>Moves <strong id="p15-moves">${this.state.moves}</strong></span>
            <span>Time <strong id="p15-time">${elapsed}s</strong></span>
            <span>Best <strong>${this.state.bestMoves || "-"}</strong></span>
          </div>
        </div>
        <div class="puzzle-15__board" style="--p15-art:${DESIGNS[this.state.design]}">
          ${this.state.tiles.map((tile, index) => this.renderTile(tile, index)).join("")}
        </div>
        <div class="puzzle-actions">
          <button class="btn btn--secondary" id="p15-undo" ${this.history.canUndo() ? "" : "disabled"}>Undo</button>
          <button class="btn btn--secondary btn--compact" id="p15-redo" ${this.history.canRedo() ? "" : "disabled"} title="Redo (Ctrl+Shift+Z or Ctrl+Y)">↻</button>
          <button class="btn btn--secondary" id="p15-restart">New Game</button>
          <a class="btn btn--secondary" href="#/">Back to Home</a>
        </div>
        ${this.state.won ? `<div class="puzzle-toast">Solved in ${this.state.moves} moves and ${this.state.elapsedSeconds}s.</div>` : ""}
      </div>
    `;

    this.container.querySelector("#p15-restart")?.addEventListener("click", () => this.restart());
    this.container.querySelector("#p15-undo")?.addEventListener("click", () => this.undo());
    this.container.querySelector("#p15-redo")?.addEventListener("click", () => this.redo());
    this.container.querySelectorAll<HTMLElement>(".puzzle-15__tile").forEach((tileEl) => {
      tileEl.addEventListener("click", () => {
        const index = Number(tileEl.dataset.index);
        if (this.suppressClickIndex === index) {
          this.suppressClickIndex = null;
          return;
        }
        this.moveTile(index);
      });
      tileEl.addEventListener("pointerdown", (e) => this.onTilePointerDown(e, tileEl));
      tileEl.addEventListener("pointerup", (e) => this.onTilePointerUp(e));
      tileEl.addEventListener("pointercancel", () => {
        this.swipeStart = null;
      });
    });
  }

  private onTilePointerDown(e: PointerEvent, tileEl: HTMLElement): void {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    this.swipeStart = {
      index: Number(tileEl.dataset.index),
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
    };
    tileEl.setPointerCapture(e.pointerId);
  }

  private onTilePointerUp(e: PointerEvent): void {
    if (!this.swipeStart || this.swipeStart.pointerId !== e.pointerId) return;
    const start = this.swipeStart;
    this.swipeStart = null;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 22) return;

    const emptyIndex = this.state.tiles.indexOf(EMPTY);
    if (!adjacentIndices(emptyIndex).includes(start.index)) return;

    const row = Math.floor(start.index / SIZE);
    const col = start.index % SIZE;
    const emptyRow = Math.floor(emptyIndex / SIZE);
    const emptyCol = emptyIndex % SIZE;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const swipedTowardEmpty =
      (horizontal && emptyCol < col && dx < -18) ||
      (horizontal && emptyCol > col && dx > 18) ||
      (!horizontal && emptyRow < row && dy < -18) ||
      (!horizontal && emptyRow > row && dy > 18);

    if (!swipedTowardEmpty) return;

    e.preventDefault();
    this.suppressClickIndex = start.index;
    this.moveTile(start.index);
  }

  private renderTile(tile: number, index: number): string {
    if (tile === EMPTY) return `<div class="puzzle-15__empty" aria-label="Empty space"></div>`;
    const solvedIndex = tile - 1;
    const row = Math.floor(solvedIndex / SIZE);
    const col = solvedIndex % SIZE;
    return `
      <button class="puzzle-15__tile" data-index="${index}" style="--tile-row:${row};--tile-col:${col};">
        <span>${tile}</span>
      </button>
    `;
  }

  private updateTimer(): void {
    if (this.state.won) return;
    const el = this.container?.querySelector("#p15-time");
    if (el) el.textContent = `${getElapsedSeconds(this.state)}s`;
  }

  private undo(): void {
    const previous = this.history.undo(this.state);
    if (!previous) return;
    this.state = previous;
    playSfx("click");
    this.render();
  }

  private redo(): void {
    const next = this.history.redo(this.state);
    if (!next) return;
    this.state = next;
    playSfx("click");
    this.render();
  }

  private animateTileMove(fromIndex: number, toIndex: number, onComplete: () => void): void {
    if (!this.container || this.animating) {
      onComplete();
      return;
    }

    this.animating = true;
    const board = this.container.querySelector(".puzzle-15__board") as HTMLElement | null;
    if (!board) {
      this.animating = false;
      onComplete();
      return;
    }

    const tiles = Array.from(board.querySelectorAll<HTMLElement>(".puzzle-15__tile, .puzzle-15__empty"));
    const movingTile = tiles[fromIndex];
    const emptySpace = tiles[toIndex];

    if (!movingTile || !emptySpace) {
      this.animating = false;
      onComplete();
      return;
    }

    const movingRect = movingTile.getBoundingClientRect();
    const emptyRect = emptySpace.getBoundingClientRect();
    const deltaX = emptyRect.left - movingRect.left;
    const deltaY = emptyRect.top - movingRect.top;

    // Apply animation
    movingTile.style.transition = "transform 0.18s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    movingTile.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    movingTile.style.zIndex = "10";

    setTimeout(() => {
      if (movingTile) {
        movingTile.style.transition = "";
        movingTile.style.transform = "";
        movingTile.style.zIndex = "";
      }
      this.animating = false;
      onComplete();
    }, 180);
  }
}
