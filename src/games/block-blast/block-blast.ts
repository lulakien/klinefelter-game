/**
 * Block Blast — place block shapes on an 8×8 board.
 *
 * Drag shapes from the tray onto the board.
 * Full rows or columns clear for bonus points.
 */

import { playSfx, vibrate } from "../../app/audio-manager.js";
import { getPersonalBest, saveScore } from "../../settings/scores-store.js";

interface Shape {
  id: number;
  cells: Array<[number, number]>;
  color: string;
  used: boolean;
}

interface BlockBlastState {
  grid: (string | null)[][];
  shapes: Shape[];
  score: number;
  bestScore: number;
  gameOver: boolean;
  scoreSubmitted: boolean;
}

const SIZE = 8;
const SHAPE_LIBRARY: Array<Array<[number, number]>> = [
  [[0, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 1], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 1], [1, 1], [2, 0], [2, 1]],
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [1, 1], [1, 2]],
  [[0, 1], [0, 2], [1, 0], [1, 1]],
];
const COLORS = ["#ff5b5b", "#23c7f4", "#ffd529", "#82de47", "#9b5cff", "#ff9f43"];

let nextShapeId = 0;

export function createBlockBlastGame(): BlockBlastState {
  nextShapeId = 0;
  const state: BlockBlastState = {
    grid: Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null)),
    shapes: drawShapes(),
    score: 0,
    bestScore: getPersonalBest("block-blast")?.score ?? 0,
    gameOver: false,
    scoreSubmitted: false,
  };
  state.gameOver = !hasMove(state);
  return state;
}

function drawShapes(): Shape[] {
  return Array.from({ length: 3 }, () => {
    const cells = SHAPE_LIBRARY[Math.floor(Math.random() * SHAPE_LIBRARY.length)];
    return {
      id: nextShapeId++,
      cells,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      used: false,
    };
  });
}

function canPlace(state: BlockBlastState, shape: Shape, row: number, col: number): boolean {
  return shape.cells.every(([r, c]) => {
    const targetRow = row + r;
    const targetCol = col + c;
    return (
      targetRow >= 0 &&
      targetRow < SIZE &&
      targetCol >= 0 &&
      targetCol < SIZE &&
      !state.grid[targetRow][targetCol]
    );
  });
}

function placeShape(state: BlockBlastState, shapeIndex: number, row: number, col: number): boolean {
  const shape = state.shapes[shapeIndex];
  if (!shape || shape.used || !canPlace(state, shape, row, col)) return false;

  for (const [r, c] of shape.cells) {
    state.grid[row + r][col + c] = shape.color;
  }
  shape.used = true;
  state.score += shape.cells.length * 10;
  const lines = clearLines(state);
  if (lines > 0) vibrate(lines * 15);
  state.score += lines * 100;

  if (state.shapes.every((item) => item.used)) {
    state.shapes = drawShapes();
  }

  state.bestScore = Math.max(state.bestScore, state.score);
  state.gameOver = !hasMove(state);
  return true;
}

function clearLines(state: BlockBlastState): number {
  const rows = new Set<number>();
  const cols = new Set<number>();

  for (let r = 0; r < SIZE; r++) {
    if (state.grid[r].every(Boolean)) rows.add(r);
  }
  for (let c = 0; c < SIZE; c++) {
    if (state.grid.every((row) => row[c])) cols.add(c);
  }

  rows.forEach((r) => {
    for (let c = 0; c < SIZE; c++) state.grid[r][c] = null;
  });
  cols.forEach((c) => {
    for (let r = 0; r < SIZE; r++) state.grid[r][c] = null;
  });

  return rows.size + cols.size;
}

function hasMove(state: BlockBlastState): boolean {
  return state.shapes.some((shape) => {
    if (shape.used) return false;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (canPlace(state, shape, r, c)) return true;
      }
    }
    return false;
  });
}

function submitScore(state: BlockBlastState): void {
  if (!state.gameOver || state.scoreSubmitted) return;
  saveScore("block-blast", state.score, state.score.toLocaleString());
  state.scoreSubmitted = true;
}

interface DragState {
  shapeIndex: number;
  ghost: HTMLElement;
  offsetX: number;
  offsetY: number;
}

export class BlockBlastRenderer {
  private container: HTMLElement | null = null;
  private state: BlockBlastState;
  private drag: DragState | null = null;
  private boundOnMove: (e: PointerEvent) => void;
  private boundOnUp: (e: PointerEvent) => void;

  constructor(state: BlockBlastState) {
    this.state = state;
    this.boundOnMove = this.onPointerMove.bind(this);
    this.boundOnUp = this.onPointerUp.bind(this);
  }

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  destroy(): void {
    this.endDrag();
    this.container = null;
  }

  private restart(): void {
    this.endDrag();
    this.state = createBlockBlastGame();
    this.render();
  }

  private render(): void {
    if (!this.container) return;
    submitScore(this.state);

    this.container.innerHTML = `
      <div class="block-blast">
        <div class="puzzle-header">
          <div>
            <h1>Block Blast</h1>
            <p>Drag blocks from the tray onto the board.</p>
          </div>
          <div class="puzzle-stats">
            <span>Score <strong>${this.state.score}</strong></span>
            <span>Best <strong>${this.state.bestScore}</strong></span>
          </div>
        </div>
        <div class="block-blast__board" id="bb-board">${this.renderGrid()}</div>
        <div class="block-blast__tray" id="bb-tray">${this.state.shapes.map((shape, index) => this.renderShape(shape, index)).join("")}</div>
        <div class="puzzle-actions">
          <button class="btn btn--secondary" id="block-restart">New Game</button>
          <a class="btn btn--secondary" href="#/">Back to Home</a>
        </div>
        ${this.state.gameOver ? `<div class="puzzle-toast">No more placements. Final score: ${this.state.score}</div>` : ""}
      </div>
    `;

    this.container.querySelectorAll<HTMLElement>("[data-shape]").forEach((shapeEl) => {
      shapeEl.addEventListener("pointerdown", (e) => this.onShapePointerDown(e, Number(shapeEl.dataset.shape)));
    });
    this.container.querySelector("#block-restart")?.addEventListener("click", () => this.restart());
  }

  private renderGrid(): string {
    let html = "";
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const color = this.state.grid[r][c];
        const style = color ? ` style="background:${color}"` : "";
        html += `<div class="block-blast__cell" data-row="${r}" data-col="${c}"${style}></div>`;
      }
    }
    return html;
  }

  private renderShape(shape: Shape, index: number): string {
    const used = shape.used ? " block-blast__shape--used" : "";
    const maxRow = Math.max(...shape.cells.map(([r]) => r));
    const maxCol = Math.max(...shape.cells.map(([, c]) => c));
    const cells = new Set(shape.cells.map(([r, c]) => `${r},${c}`));
    let grid = "";
    for (let r = 0; r <= maxRow; r++) {
      for (let c = 0; c <= maxCol; c++) {
        const style = cells.has(`${r},${c}`) ? ` style="background:${shape.color}"` : "";
        grid += `<span class="block-blast__mini"${style}></span>`;
      }
    }
    return `
      <div class="block-blast__shape${used}" data-shape="${index}" style="grid-template-columns:repeat(${maxCol + 1},18px)">
        ${grid}
      </div>
    `;
  }

  private onShapePointerDown(e: PointerEvent, shapeIndex: number): void {
    if (this.state.gameOver) return;
    const shape = this.state.shapes[shapeIndex];
    if (!shape || shape.used) return;

    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // Create ghost
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.style.position = "fixed";
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9999";
    ghost.style.opacity = "0.85";
    ghost.style.transform = "scale(1.1)";
    ghost.style.transition = "none";
    ghost.classList.remove("block-blast__shape--used");
    document.body.appendChild(ghost);

    this.drag = { shapeIndex, ghost, offsetX, offsetY };
    el.setPointerCapture(e.pointerId);

    window.addEventListener("pointermove", this.boundOnMove);
    window.addEventListener("pointerup", this.boundOnUp);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.drag) return;
    e.preventDefault();

    const { ghost, offsetX, offsetY } = this.drag;
    ghost.style.left = `${e.clientX - offsetX}px`;
    ghost.style.top = `${e.clientY - offsetY}px`;

    this.updateBoardPreview(e.clientX, e.clientY);
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.drag) return;
    e.preventDefault();

    const { shapeIndex } = this.drag;
    const board = this.container?.querySelector("#bb-board") as HTMLElement | null;
    let placed = false;

    if (board) {
      const boardRect = board.getBoundingClientRect();
      const cellSize = boardRect.width / SIZE;
      const col = Math.floor((e.clientX - boardRect.left) / cellSize);
      const row = Math.floor((e.clientY - boardRect.top) / cellSize);
      if (placeShape(this.state, shapeIndex, row, col)) {
        placed = true;
        playSfx(this.state.gameOver ? "fail" : "hit");
      }
    }

    if (!placed) {
      playSfx("fail");
    }

    this.endDrag();
    this.render();
  }

  private endDrag(): void {
    window.removeEventListener("pointermove", this.boundOnMove);
    window.removeEventListener("pointerup", this.boundOnUp);
    if (this.drag) {
      this.drag.ghost.remove();
      this.drag = null;
    }
    this.clearBoardPreview();
  }

  private updateBoardPreview(clientX: number, clientY: number): void {
    this.clearBoardPreview();
    if (!this.drag) return;

    const board = this.container?.querySelector("#bb-board") as HTMLElement | null;
    if (!board) return;

    const boardRect = board.getBoundingClientRect();
    const cellSize = boardRect.width / SIZE;
    const col = Math.floor((clientX - boardRect.left) / cellSize);
    const row = Math.floor((clientY - boardRect.top) / cellSize);

    const shape = this.state.shapes[this.drag.shapeIndex];
    const valid = canPlace(this.state, shape, row, col);

    for (const [r, c] of shape.cells) {
      const targetRow = row + r;
      const targetCol = col + c;
      const cell = board.querySelector(`[data-row="${targetRow}"][data-col="${targetCol}"]`) as HTMLElement | null;
      if (cell) {
        cell.classList.add(valid ? "block-blast__cell--preview" : "block-blast__cell--invalid");
        if (valid) {
          cell.style.background = shape.color;
        }
      }
    }
  }

  private clearBoardPreview(): void {
    if (!this.container) return;
    this.container.querySelectorAll(".block-blast__cell--preview, .block-blast__cell--invalid").forEach((el) => {
      const cell = el as HTMLElement;
      cell.classList.remove("block-blast__cell--preview", "block-blast__cell--invalid");
      if (!cell.dataset.hasColor) {
        cell.style.background = "";
      }
    });
  }
}
