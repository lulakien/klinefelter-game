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
  anchorOffsetRow: number;
  anchorOffsetCol: number;
  liftY: number;
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

  getState(): any {
    return this.state;
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
    this.endDrag(); // Clean up any active drag before re-rendering
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
        <div class="block-blast__tray" id="bb-tray">${this.state.shapes.map((shape, index) => this.renderTraySlot(shape, index)).join("")}</div>
        <div class="puzzle-actions">
          <button class="btn btn--secondary" id="block-restart">New Game</button>
          <a class="btn btn--secondary" href="#/">Back to Home</a>
        </div>
        ${this.state.gameOver ? `<div class="puzzle-toast">No more placements. Final score: ${this.state.score}</div>` : ""}
      </div>
    `;

    this.container.querySelectorAll<HTMLElement>(".block-blast__tray-slot[data-shape]").forEach((slotEl) => {
      slotEl.addEventListener("pointerdown", (e) => this.onShapePointerDown(e, Number(slotEl.dataset.shape)));
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

  private renderTraySlot(shape: Shape, index: number): string {
    const used = shape.used ? " block-blast__tray-slot--used" : "";
    return `
      <div class="block-blast__tray-slot${used}"${shape.used ? "" : ` data-shape="${index}"`}>
        ${shape.used ? "" : this.renderShape(shape)}
      </div>
    `;
  }

  private renderShape(shape: Shape): string {
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
      <div class="block-blast__shape" style="grid-template-columns:repeat(${maxCol + 1},22px)">
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
    const miniSize = 22;
    const minRow = Math.min(...shape.cells.map(([r]) => r));
    const minCol = Math.min(...shape.cells.map(([, c]) => c));
    const maxRow = Math.max(...shape.cells.map(([r]) => r));
    const maxCol = Math.max(...shape.cells.map(([, c]) => c));
    const anchorOffsetCol = Math.min(maxCol, Math.max(minCol, Math.round(offsetX / miniSize - 0.5)));
    const anchorOffsetRow = Math.min(maxRow, Math.max(minRow, Math.round(offsetY / miniSize - 0.5)));
    const board = this.container?.querySelector("#bb-board") as HTMLElement | null;
    const boardCell = board?.querySelector<HTMLElement>(".block-blast__cell");
    const liftY = e.pointerType === "mouse"
      ? 0
      : Math.round((boardCell?.getBoundingClientRect().height ?? 34) * 3.5);

    // Create a shape-only ghost so the tray card remains intact.
    const ghost = document.createElement("div");
    ghost.className = "block-blast__drag-ghost";
    ghost.innerHTML = this.renderShape(shape);
    ghost.style.position = "fixed";
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top - liftY}px`;
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9999";
    ghost.style.opacity = "0.9";
    ghost.style.transform = "scale(1.15)";
    ghost.style.transition = "none";
    document.body.appendChild(ghost);

    this.drag = { shapeIndex, ghost, offsetX, offsetY, anchorOffsetRow, anchorOffsetCol, liftY };
    el.setPointerCapture(e.pointerId);

    window.addEventListener("pointermove", this.boundOnMove);
    window.addEventListener("pointerup", this.boundOnUp);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.drag) return;
    e.preventDefault();

    const { ghost, offsetX, offsetY, liftY } = this.drag;
    ghost.style.left = `${e.clientX - offsetX}px`;
    ghost.style.top = `${e.clientY - offsetY - liftY}px`;

    this.updateBoardPreview(e.clientX, e.clientY);
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.drag) return;
    e.preventDefault();

    const { shapeIndex } = this.drag;
    const board = this.container?.querySelector("#bb-board") as HTMLElement | null;
    let placed = false;

    if (board) {
      const anchor = this.getDropAnchor(board, e.clientX, e.clientY);
      if (anchor && placeShape(this.state, shapeIndex, anchor.row, anchor.col)) {
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

    const anchor = this.getDropAnchor(board, clientX, clientY);
    if (!anchor) return;

    const shape = this.state.shapes[this.drag.shapeIndex];
    const valid = canPlace(this.state, shape, anchor.row, anchor.col);

    for (const [r, c] of shape.cells) {
      const targetRow = anchor.row + r;
      const targetCol = anchor.col + c;
      const cell = board.querySelector(`[data-row="${targetRow}"][data-col="${targetCol}"]`) as HTMLElement | null;
      if (cell) {
        cell.classList.add(valid ? "block-blast__cell--preview" : "block-blast__cell--invalid");
        if (valid) {
          cell.style.setProperty("--preview-color", shape.color);
        }
      }
    }
  }

  private clearBoardPreview(): void {
    if (!this.container) return;
    this.container.querySelectorAll(".block-blast__cell--preview, .block-blast__cell--invalid").forEach((el) => {
      const cell = el as HTMLElement;
      cell.classList.remove("block-blast__cell--preview", "block-blast__cell--invalid");
      cell.style.removeProperty("--preview-color");
    });
  }

  private getDropAnchor(board: HTMLElement, _clientX: number, _clientY: number): { row: number; col: number } | null {
    if (!this.drag) return null;

    // Adjust the aim point to account for ghost scale and lift
    const ghostRect = this.drag.ghost.getBoundingClientRect();

    // Calculate the center of the dragged ghost
    const ghostCenterX = ghostRect.left + ghostRect.width / 2;
    const ghostCenterY = ghostRect.top + ghostRect.height / 2;

    const boardRect = board.getBoundingClientRect();
    if (
      ghostCenterX < boardRect.left ||
      ghostCenterX > boardRect.right ||
      ghostCenterY < boardRect.top ||
      ghostCenterY > boardRect.bottom
    ) {
      return null;
    }

    const firstCell = board.querySelector<HTMLElement>(".block-blast__cell");
    const secondCell = board.querySelector<HTMLElement>('[data-row="0"][data-col="1"]');
    const belowCell = board.querySelector<HTMLElement>('[data-row="1"][data-col="0"]');
    if (!firstCell) return null;

    const firstRect = firstCell.getBoundingClientRect();
    const secondRect = secondCell?.getBoundingClientRect();
    const belowRect = belowCell?.getBoundingClientRect();
    const cellWidth = firstRect.width;
    const cellHeight = firstRect.height;
    const gapX = secondRect ? Math.max(0, secondRect.left - firstRect.right) : 0;
    const gapY = belowRect ? Math.max(0, belowRect.top - firstRect.bottom) : gapX;

    // Calculate which cell the ghost center is over
    const pointerCol = Math.floor((ghostCenterX - firstRect.left + gapX / 2) / (cellWidth + gapX));
    const pointerRow = Math.floor((ghostCenterY - firstRect.top + gapY / 2) / (cellHeight + gapY));
    if (pointerRow < 0 || pointerRow >= SIZE || pointerCol < 0 || pointerCol >= SIZE) return null;

    return {
      row: pointerRow - this.drag.anchorOffsetRow,
      col: pointerCol - this.drag.anchorOffsetCol,
    };
  }
}
