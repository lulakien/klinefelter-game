import { playSfx } from "../../app/audio-manager.js";
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
  selectedShape: number | null;
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
  return {
    grid: Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null)),
    shapes: drawShapes(),
    selectedShape: null,
    score: 0,
    bestScore: getPersonalBest("block-blast")?.score ?? 0,
    gameOver: false,
    scoreSubmitted: false,
  };
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
  state.score += clearLines(state) * 100;

  if (state.shapes.every((item) => item.used)) {
    state.shapes = drawShapes();
    state.selectedShape = null;
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

export class BlockBlastRenderer {
  private container: HTMLElement | null = null;
  private state: BlockBlastState;

  constructor(state: BlockBlastState) {
    this.state = state;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  destroy(): void {
    this.container = null;
  }

  private restart(): void {
    this.state = createBlockBlastGame();
    this.render();
  }

  private selectShape(index: number): void {
    if (this.state.shapes[index]?.used) return;
    this.state.selectedShape = index;
    this.render();
  }

  private clickCell(row: number, col: number): void {
    if (this.state.selectedShape === null || this.state.gameOver) return;
    const moved = placeShape(this.state, this.state.selectedShape, row, col);
    if (moved) {
      playSfx(this.state.gameOver ? "fail" : "hit");
    } else {
      playSfx("fail");
    }
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
            <p>Place all three blocks. Full rows or columns clear.</p>
          </div>
          <div class="puzzle-stats">
            <span>Score <strong>${this.state.score}</strong></span>
            <span>Best <strong>${this.state.bestScore}</strong></span>
          </div>
        </div>
        <div class="block-blast__board">${this.renderGrid()}</div>
        <div class="block-blast__tray">${this.state.shapes.map((shape, index) => this.renderShape(shape, index)).join("")}</div>
        <div class="puzzle-actions">
          <button class="btn btn--secondary" id="block-restart">New Game</button>
          <a class="btn btn--secondary" href="#/">Back to Home</a>
        </div>
        ${this.state.gameOver ? `<div class="puzzle-toast">No more placements. Final score: ${this.state.score}</div>` : ""}
      </div>
    `;

    this.container.querySelectorAll<HTMLElement>("[data-shape]").forEach((shape) => {
      shape.addEventListener("click", () => this.selectShape(Number(shape.dataset.shape)));
    });
    this.container.querySelectorAll<HTMLElement>("[data-cell]").forEach((cell) => {
      cell.addEventListener("click", () => this.clickCell(Number(cell.dataset.row), Number(cell.dataset.col)));
    });
    this.container.querySelector("#block-restart")?.addEventListener("click", () => this.restart());
  }

  private renderGrid(): string {
    let html = "";
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const color = this.state.grid[r][c];
        const style = color ? ` style="background:${color}"` : "";
        html += `<button class="block-blast__cell" data-cell="1" data-row="${r}" data-col="${c}"${style}></button>`;
      }
    }
    return html;
  }

  private renderShape(shape: Shape, index: number): string {
    const selected = this.state.selectedShape === index ? " block-blast__shape--selected" : "";
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
      <button class="block-blast__shape${selected}${used}" data-shape="${index}" style="grid-template-columns:repeat(${maxCol + 1},18px)">
        ${grid}
      </button>
    `;
  }
}
