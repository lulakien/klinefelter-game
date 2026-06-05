/**
 * Memory — card-matching game.
 *
 * CSS grid with flip animation, emoji faces, move counter,
 * warm toy-arcade design, touch + click support.
 */

import { playSfx, vibrate } from "../../app/audio-manager.js";
import { getPersonalBest, saveScore } from "../../settings/scores-store.js";

// ---- Constants ----

const SYMBOL_POOL = ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔"];

export type MemoryDifficulty = "easy" | "medium" | "hard";

const DIFFICULTIES: Record<MemoryDifficulty, { pairs: number; cols: number }> = {
  easy: { pairs: 4, cols: 4 },
  medium: { pairs: 8, cols: 4 },
  hard: { pairs: 12, cols: 4 },
};

// ---- Types ----

interface Card {
  symbol: string;
  flipped: boolean;
  matched: boolean;
}

interface MemoryState {
  cards: Card[];
  firstPick: number | null;
  secondPick: number | null;
  moves: number;
  bestMoves: number;
  locked: boolean;
  won: boolean;
  scoreSubmitted: boolean;
  difficulty: MemoryDifficulty;
}

// ---- Game Logic ----

export function createMemoryGame(difficulty: MemoryDifficulty = "medium"): MemoryState {
  const config = DIFFICULTIES[difficulty];
  const symbols = SYMBOL_POOL.slice(0, config.pairs);
  const deck = [...symbols, ...symbols];
  shuffle(deck);

  return {
    cards: deck.map((s) => ({ symbol: s, flipped: false, matched: false })),
    firstPick: null,
    secondPick: null,
    moves: 0,
    bestMoves: getPersonalBest("memory")?.score ?? 0,
    locked: false,
    won: false,
    scoreSubmitted: false,
    difficulty,
  };
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ---- DOM Renderer ----

export class MemoryRenderer {
  private state: MemoryState;
  private container: HTMLElement | null = null;
  private flipTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(state: MemoryState) {
    this.state = state;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  destroy(): void {
    if (this.flipTimeout) {
      clearTimeout(this.flipTimeout);
      this.flipTimeout = null;
    }
    if (this.container) {
      this.container.innerHTML = "";
    }
  }

  private setDifficulty(difficulty: MemoryDifficulty): void {
    this.state.difficulty = difficulty;
    this.reset();
  }

  private handlePick(index: number): void {
    const before = this.state.moves;
    this.pickCard(index);
    this.updateAllCards(this.state);

    const movesEl = this.container?.querySelector("#mem-moves");
    if (movesEl && this.state.moves !== before) {
      movesEl.textContent = String(this.state.moves);
    }

    if (this.state.won) {
      const bestEl = this.container?.querySelector("#mem-best");
      if (bestEl) {
        bestEl.textContent = String(this.state.bestMoves || "—");
      }
      this.showWin();
    }
  }

  private showWin(): void {
    if (!this.container) return;
    const overlay = document.createElement("div");
    overlay.className = "memory__win";
    overlay.innerHTML = `
      <div>
        <h2>You Win!</h2>
        <p>${this.state.moves} moves</p>
        ${this.state.moves <= this.state.bestMoves ? "<p class='memory__new-best'>New Best!</p>" : ""}
        <button class="btn btn--primary" id="mem-play-again">Play Again</button>
        <a class="btn btn--secondary" href="#/">Back to Home</a>
      </div>
    `;
    const btn = overlay.querySelector("#mem-play-again")!;
    btn.addEventListener("click", () => {
      overlay.remove();
      this.reset();
    });
    this.container.appendChild(overlay);
  }

  private reset(): void {
    if (this.flipTimeout) {
      clearTimeout(this.flipTimeout);
      this.flipTimeout = null;
    }
    this.state = createMemoryGame(this.state.difficulty);
    this.render();
  }

  private pickCard(index: number): void {
    const state = this.state;
    if (state.locked || state.won) return;
    const card = state.cards[index];
    if (card.flipped || card.matched) return;

    card.flipped = true;
    playSfx("click");

    if (state.firstPick === null) {
      state.firstPick = index;
      return;
    }

    state.secondPick = index;
    state.moves++;
    state.locked = true;

    const first = state.cards[state.firstPick];
    const second = state.cards[state.secondPick];

    if (first.symbol === second.symbol) {
      first.matched = true;
      second.matched = true;
      playSfx("success");
      vibrate(20);
      state.firstPick = null;
      state.secondPick = null;
      state.locked = false;

      if (state.cards.every((c) => c.matched)) {
        state.won = true;
        this.endGame();
      }
    } else {
      const a = state.firstPick;
      const b = state.secondPick;
      this.flipTimeout = setTimeout(() => {
        this.flipTimeout = null;
        state.cards[a].flipped = false;
        state.cards[b].flipped = false;
        state.firstPick = null;
        state.secondPick = null;
        state.locked = false;
        this.updateAllCards(state);
      }, 700);
    }
  }

  private endGame(): void {
    const state = this.state;
    if (!state.scoreSubmitted) {
      state.scoreSubmitted = true;
      const newBest = state.bestMoves === 0 || state.moves < state.bestMoves;
      if (newBest) state.bestMoves = state.moves;
      saveScore("memory", state.moves, `${state.moves} moves`);
    }
  }

  private updateAllCards(state: MemoryState): void {
    if (!this.container) return;
    const cells = this.container.querySelectorAll(".memory__card");
    cells.forEach((cell, i) => {
      const card = state.cards[i];
      cell.classList.toggle("memory__card--flipped", card.flipped || card.matched);
      cell.classList.toggle("memory__card--matched", card.matched);
    });
  }

  private render(): void {
    if (!this.container) return;
    this.container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = `memory memory--${this.state.difficulty}`;

    const config = DIFFICULTIES[this.state.difficulty];

    // Header
    const header = document.createElement("div");
    header.className = "puzzle-header";
    header.innerHTML = `
      <div>
        <h1>Memory</h1>
        <p>Match all the pairs</p>
      </div>
      <div class="puzzle-stats">
        <span>MOVES <strong id="mem-moves">0</strong></span>
        <span>BEST <strong id="mem-best">${this.state.bestMoves || "—"}</strong></span>
      </div>
    `;
    wrapper.appendChild(header);

    // Difficulty selector
    const controls = document.createElement("div");
    controls.className = "game-controls";
    controls.innerHTML = `
      <div class="toggle-group" id="mem-diff-toggle">
        <button class="toggle-btn ${this.state.difficulty === "easy" ? "toggle-btn--active" : ""}" data-value="easy">Easy</button>
        <button class="toggle-btn ${this.state.difficulty === "medium" ? "toggle-btn--active" : ""}" data-value="medium">Medium</button>
        <button class="toggle-btn ${this.state.difficulty === "hard" ? "toggle-btn--active" : ""}" data-value="hard">Hard</button>
      </div>
    `;
    wrapper.appendChild(controls);

    // Grid
    const grid = document.createElement("div");
    grid.className = "memory__grid";
    grid.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;

    for (let i = 0; i < this.state.cards.length; i++) {
      const card = this.state.cards[i];
      const cell = document.createElement("button");
      cell.className = "memory__card";
      if (card.flipped || card.matched) cell.classList.add("memory__card--flipped");
      if (card.matched) cell.classList.add("memory__card--matched");
      cell.innerHTML = `<span class="memory__face">${card.symbol}</span>`;
      cell.addEventListener("click", () => this.handlePick(i));
      grid.appendChild(cell);
    }

    wrapper.appendChild(grid);

    // Actions
    const actions = document.createElement("div");
    actions.className = "puzzle-actions";
    actions.innerHTML = '<button class="btn btn--secondary" id="mem-restart">Restart</button><a class="btn btn--secondary" href="#/">Back to Home</a>';
    const restartBtn = actions.querySelector("#mem-restart")!;
    restartBtn.addEventListener("click", () => this.reset());

    wrapper.appendChild(actions);
    this.container.appendChild(wrapper);

    // Bind difficulty toggle
    const diffToggle = wrapper.querySelector("#mem-diff-toggle");
    diffToggle?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(".toggle-btn");
      if (!btn) return;
      const value = btn.getAttribute("data-value") as MemoryDifficulty;
      if (value && value !== this.state.difficulty) {
        this.setDifficulty(value);
      }
    });
  }
}
