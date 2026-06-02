import { playSfx } from "../../app/audio-manager.js";
import { getPersonalBest, saveScore } from "../../settings/scores-store.js";

type ColorId = 0 | 1 | 2 | 3 | 4 | 5;
type Tube = ColorId[];

interface WaterSortState {
  tubes: Tube[];
  selectedTube: number | null;
  moves: number;
  bestMoves: number;
  won: boolean;
  scoreSubmitted: boolean;
}

const CAPACITY = 4;
const COLORS = ["#ff5b5b", "#23c7f4", "#ffd529", "#82de47", "#9b5cff", "#ff9f43"];

export function createWaterSortGame(): WaterSortState {
  const solved: ColorId[] = [0, 1, 2, 3, 4, 5];
  let tubes: Tube[] = [];

  do {
    const pieces = solved.flatMap((color) => Array.from({ length: CAPACITY }, () => color));
    shuffle(pieces);
    tubes = Array.from({ length: solved.length + 2 }, () => []);
    for (let i = 0; i < pieces.length; i++) {
      tubes[i % solved.length].push(pieces[i]);
    }
  } while (isWon(tubes) || !hasAnyMove(tubes));

  return {
    tubes,
    selectedTube: null,
    moves: 0,
    bestMoves: getPersonalBest("water-sort")?.score ?? 0,
    won: false,
    scoreSubmitted: false,
  };
}

function shuffle<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function topRun(tube: Tube): { color: ColorId; count: number } | null {
  const color = tube[tube.length - 1];
  if (color === undefined) return null;
  let count = 1;
  for (let i = tube.length - 2; i >= 0 && tube[i] === color; i--) count++;
  return { color, count };
}

function canPour(from: Tube, to: Tube): boolean {
  const run = topRun(from);
  if (!run) return false;
  if (to.length >= CAPACITY) return false;
  const target = to[to.length - 1];
  return target === undefined || target === run.color;
}

function pour(tubes: Tube[], fromIndex: number, toIndex: number): boolean {
  if (fromIndex === toIndex) return false;
  const from = tubes[fromIndex];
  const to = tubes[toIndex];
  if (!from || !to || !canPour(from, to)) return false;

  const run = topRun(from)!;
  const amount = Math.min(run.count, CAPACITY - to.length);
  for (let i = 0; i < amount; i++) {
    to.push(from.pop()!);
  }
  return amount > 0;
}

function isWon(tubes: Tube[]): boolean {
  return tubes.every((tube) => {
    if (tube.length === 0) return true;
    if (tube.length !== CAPACITY) return false;
    return tube.every((color) => color === tube[0]);
  });
}

function hasAnyMove(tubes: Tube[]): boolean {
  return tubes.some((from, fromIndex) =>
    tubes.some((to, toIndex) => fromIndex !== toIndex && canPour(from, to)),
  );
}

function submitScore(state: WaterSortState): void {
  if (!state.won || state.scoreSubmitted) return;
  saveScore("water-sort", state.moves, `${state.moves} moves`);
  state.scoreSubmitted = true;
}

export class WaterSortRenderer {
  private container: HTMLElement | null = null;
  private state: WaterSortState;

  constructor(state: WaterSortState) {
    this.state = state;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  destroy(): void {
    this.container = null;
  }

  private selectTube(index: number): void {
    if (this.state.won) return;

    if (this.state.selectedTube === null) {
      if (this.state.tubes[index]?.length) this.state.selectedTube = index;
      this.render();
      return;
    }

    const from = this.state.selectedTube;
    const moved = pour(this.state.tubes, from, index);
    this.state.selectedTube = null;

    if (moved) {
      this.state.moves++;
      this.state.won = isWon(this.state.tubes);
      if (this.state.won && (!this.state.bestMoves || this.state.moves < this.state.bestMoves)) {
        this.state.bestMoves = this.state.moves;
      }
      playSfx(this.state.won ? "success" : "hit");
    } else {
      playSfx("fail");
    }
    this.render();
  }

  private restart(): void {
    this.state = createWaterSortGame();
    this.render();
  }

  private render(): void {
    if (!this.container) return;
    submitScore(this.state);

    this.container.innerHTML = `
      <div class="water-sort">
        <div class="puzzle-header">
          <div>
            <h1>Water Sort</h1>
            <p>Pour matching colors until every tube is pure.</p>
          </div>
          <div class="puzzle-stats">
            <span>Moves <strong>${this.state.moves}</strong></span>
            <span>Best <strong>${this.state.bestMoves ? this.state.bestMoves : "-"}</strong></span>
          </div>
        </div>
        <div class="water-sort__rack">
          ${this.state.tubes.map((tube, index) => this.renderTube(tube, index)).join("")}
        </div>
        <div class="puzzle-actions">
          <button class="btn btn--secondary" id="water-restart">New Game</button>
          <a class="btn btn--secondary" href="#/">Back to Home</a>
        </div>
        ${this.state.won ? `<div class="puzzle-toast">Sorted in ${this.state.moves} moves.</div>` : ""}
      </div>
    `;

    this.container.querySelectorAll<HTMLElement>("[data-tube]").forEach((tube) => {
      tube.addEventListener("click", () => this.selectTube(Number(tube.dataset.tube)));
    });
    this.container.querySelector("#water-restart")?.addEventListener("click", () => this.restart());
  }

  private renderTube(tube: Tube, index: number): string {
    const selected = this.state.selectedTube === index ? " water-sort__tube--selected" : "";
    const cells = Array.from({ length: CAPACITY }, (_, slot) => {
      const color = tube[CAPACITY - 1 - slot];
      const style = color === undefined ? "" : ` style="background:${COLORS[color]}"`;
      return `<span class="water-sort__liquid"${style}></span>`;
    }).join("");
    return `<button class="water-sort__tube${selected}" data-tube="${index}" aria-label="Tube ${index + 1}">${cells}</button>`;
  }
}
