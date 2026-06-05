/**
 * Water Sort — pour colors between tubes until each is uniform.
 *
 * Tap a tube to select, tap another to pour.
 * Warm toy-arcade design with animations.
 */

import { playSfx, vibrate } from "../../app/audio-manager.js";
import { getPersonalBest, saveScore } from "../../settings/scores-store.js";

type ColorId = number;
type Tube = ColorId[];

interface WaterSortState {
  tubes: Tube[];
  selectedTube: number | null;
  moves: number;
  bestMoves: number;
  won: boolean;
  gameOver: boolean;
  scoreSubmitted: boolean;
  difficulty: WaterSortDifficulty;
}

export type WaterSortDifficulty = "easy" | "medium" | "hard";

const CAPACITY = 4;

const COLORS = [
  "#ff5b5b", "#23c7f4", "#ffd529", "#82de47",
  "#9b5cff", "#ff9f43", "#ff6b9d", "#2ed1a2",
];

const DIFFICULTIES: Record<WaterSortDifficulty, { colors: number; empty: number; steps: number }> = {
  easy: { colors: 4, empty: 2, steps: 18 },
  medium: { colors: 6, empty: 2, steps: 28 },
  hard: { colors: 8, empty: 2, steps: 38 },
};

const GENERATION_ATTEMPTS = 24;

function cloneTubes(tubes: Tube[]): Tube[] {
  return tubes.map((tube) => [...tube]);
}

function generatePuzzle(colors: number, empty: number, steps: number): Tube[] {
  const tubes: Tube[] = [];
  for (let c = 0; c < colors; c++) {
    tubes.push(Array.from({ length: CAPACITY }, () => c as ColorId));
  }
  for (let e = 0; e < empty; e++) {
    tubes.push([]);
  }

  for (let s = 0; s < steps; s++) {
    const moves: { from: number; to: number }[] = [];
    for (let i = 0; i < tubes.length; i++) {
      for (let j = 0; j < tubes.length; j++) {
        if (i !== j && canPour(tubes[i], tubes[j])) moves.push({ from: i, to: j });
      }
    }
    if (moves.length === 0) break;
    const move = moves[Math.floor(Math.random() * moves.length)];
    pour(tubes, move.from, move.to);
  }
  return tubes;
}

export function createWaterSortGame(difficulty: WaterSortDifficulty = "medium"): WaterSortState {
  const config = DIFFICULTIES[difficulty];
  let tubes: Tube[] | null = null;

  for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt++) {
    const candidate = generatePuzzle(config.colors, config.empty, config.steps + attempt);
    if (!isWon(candidate) && hasAnyMove(candidate)) {
      tubes = candidate;
      break;
    }
  }

  tubes ??= createFallbackPuzzle(config.colors, config.empty);

  return {
    tubes,
    selectedTube: null,
    moves: 0,
    bestMoves: getPersonalBest("water-sort")?.score ?? 0,
    won: false,
    gameOver: !hasAnyMove(tubes),
    scoreSubmitted: false,
    difficulty,
  };
}

function createFallbackPuzzle(colors: number, empty: number): Tube[] {
  const tubes: Tube[] = Array.from({ length: colors + empty }, () => []);
  const pool = Array.from({ length: colors * CAPACITY }, (_, index) => Math.floor(index / CAPACITY) as ColorId);

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  for (let i = 0; i < pool.length; i++) {
    tubes[Math.floor(i / CAPACITY)].push(pool[i]);
  }

  if (isWon(tubes) || !hasAnyMove(tubes)) {
    return createSeededFallback(colors, empty);
  }

  return cloneTubes(tubes);
}

function createSeededFallback(colors: number, empty: number): Tube[] {
  const tubes: Tube[] = Array.from({ length: colors }, (_, tube) =>
    Array.from({ length: CAPACITY }, (_, slot) => ((tube + slot) % colors) as ColorId),
  );
  for (let i = 0; i < empty; i++) tubes.push([]);
  return tubes;
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
  private pouringTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(state: WaterSortState) {
    this.state = state;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  destroy(): void {
    if (this.pouringTimer) {
      clearTimeout(this.pouringTimer);
      this.pouringTimer = null;
    }
    if (this.container) {
      this.container.innerHTML = "";
    }
  }

  private setDifficulty(difficulty: WaterSortDifficulty): void {
    this.state.difficulty = difficulty;
    this.restart();
  }

  private selectTube(index: number): void {
    if (this.state.won || this.state.gameOver) return;

    if (this.state.selectedTube === null) {
      if (this.state.tubes[index]?.length) {
        this.state.selectedTube = index;
        playSfx("click");
        this.render();
      }
      return;
    }

    const from = this.state.selectedTube;
    this.state.selectedTube = null;

    if (from === index) {
      this.render();
      return;
    }

    // Animate pour then apply state
    this.animatePour(from, index, () => {
      const moved = pour(this.state.tubes, from, index);
      if (moved) {
        this.state.moves++;
        this.state.won = isWon(this.state.tubes);
        if (!this.state.won) {
          this.state.gameOver = !hasAnyMove(this.state.tubes);
        }
        if (this.state.won && (!this.state.bestMoves || this.state.moves < this.state.bestMoves)) {
          this.state.bestMoves = this.state.moves;
        }
        playSfx(this.state.won ? "success" : "hit");
        if (this.state.won) vibrate([20, 30, 20]);
      } else {
        playSfx("fail");
      }
      this.render();
    });
  }

  private animatePour(fromIndex: number, toIndex: number, onComplete: () => void): void {
    if (!this.container) {
      onComplete();
      return;
    }
    const rack = this.container.querySelector(".water-sort__rack");
    if (!rack) {
      onComplete();
      return;
    }
    const fromTube = rack.children[fromIndex] as HTMLElement;
    const toTube = rack.children[toIndex] as HTMLElement;
    if (!fromTube || !toTube) {
      onComplete();
      return;
    }

    fromTube.classList.add("water-sort__tube--pouring");
    toTube.classList.add("water-sort__tube--receiving");

    this.pouringTimer = setTimeout(() => {
      this.pouringTimer = null;
      onComplete();
    }, 220);
  }

  private restart(): void {
    if (this.pouringTimer) {
      clearTimeout(this.pouringTimer);
      this.pouringTimer = null;
    }
    this.state = createWaterSortGame(this.state.difficulty);
    this.render();
  }

  private render(): void {
    if (!this.container) return;
    submitScore(this.state);

    const wrapper = document.createElement("div");
    wrapper.className = "water-sort";

    // Header
    const header = document.createElement("div");
    header.className = "puzzle-header";
    header.innerHTML = `
      <div>
        <h1>Water Sort</h1>
        <p>Pour matching colors until every tube is pure.</p>
      </div>
      <div class="puzzle-stats">
        <span>Moves <strong>${this.state.moves}</strong></span>
        <span>Best <strong>${this.state.bestMoves ? this.state.bestMoves : "-"}</strong></span>
      </div>
    `;
    wrapper.appendChild(header);

    // Difficulty
    const controls = document.createElement("div");
    controls.className = "game-controls";
    controls.innerHTML = `
      <div class="toggle-group" id="ws-diff-toggle">
        <button class="toggle-btn ${this.state.difficulty === "easy" ? "toggle-btn--active" : ""}" data-value="easy">Easy</button>
        <button class="toggle-btn ${this.state.difficulty === "medium" ? "toggle-btn--active" : ""}" data-value="medium">Medium</button>
        <button class="toggle-btn ${this.state.difficulty === "hard" ? "toggle-btn--active" : ""}" data-value="hard">Hard</button>
      </div>
    `;
    wrapper.appendChild(controls);

    // Rack
    const rack = document.createElement("div");
    rack.className = "water-sort__rack";
    const cols = this.state.tubes.length <= 6 ? 3 : 4;
    rack.style.gridTemplateColumns = `repeat(${cols}, minmax(60px, 1fr))`;

    this.state.tubes.forEach((tube, index) => {
      const selected = this.state.selectedTube === index ? " water-sort__tube--selected" : "";
      const complete = tube.length === CAPACITY && tube.every((c) => c === tube[0]) ? " water-sort__tube--complete" : "";
      const btn = document.createElement("button");
      btn.className = `water-sort__tube${selected}${complete}`;
      btn.dataset.tube = String(index);
      btn.setAttribute("aria-label", `Tube ${index + 1}`);
      btn.addEventListener("click", () => this.selectTube(index));

      for (let slot = 0; slot < CAPACITY; slot++) {
        const color = tube[CAPACITY - 1 - slot];
        const liquid = document.createElement("span");
        liquid.className = "water-sort__liquid";
        if (color !== undefined) {
          liquid.style.background = COLORS[color];
        } else {
          liquid.style.opacity = "0";
        }
        btn.appendChild(liquid);
      }
      rack.appendChild(btn);
    });

    wrapper.appendChild(rack);

    // Actions
    const actions = document.createElement("div");
    actions.className = "puzzle-actions";
    actions.innerHTML = '<button class="btn btn--secondary" id="water-restart">New Game</button><a class="btn btn--secondary" href="#/">Back to Home</a>';
    actions.querySelector("#water-restart")?.addEventListener("click", () => this.restart());
    wrapper.appendChild(actions);

    // Toasts
    if (this.state.won) {
      const toast = document.createElement("div");
      toast.className = "puzzle-toast";
      toast.textContent = `Sorted in ${this.state.moves} moves.`;
      wrapper.appendChild(toast);
    }
    if (this.state.gameOver) {
      const toast = document.createElement("div");
      toast.className = "puzzle-toast puzzle-toast--lose";
      toast.textContent = "No more moves.";
      wrapper.appendChild(toast);
    }

    this.container.innerHTML = "";
    this.container.appendChild(wrapper);

    // Bind difficulty
    const diffToggle = wrapper.querySelector("#ws-diff-toggle");
    diffToggle?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(".toggle-btn");
      if (!btn) return;
      const value = btn.getAttribute("data-value") as WaterSortDifficulty;
      if (value && value !== this.state.difficulty) {
        this.setDifficulty(value);
      }
    });
  }
}
