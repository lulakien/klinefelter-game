/**
 * Memory — card-matching game.
 *
 * CSS grid with flip animation, emoji faces, move counter,
 * warm toy-arcade design, touch + click support.
 */

import { playSfx, vibrate } from "../../app/audio-manager.js";
import { getPersonalBest, saveScore } from "../../settings/scores-store.js";

// ---- Constants ----

const PAIRS = 8;
const CARDS = PAIRS * 2;
const SYMBOLS = ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼"];

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
  locked: boolean; // prevent clicks during mismatch reveal
  won: boolean;
  scoreSubmitted: boolean;
}

// ---- Game Logic ----

export function createMemoryGame(): MemoryState {
  const symbols = [...SYMBOLS, ...SYMBOLS];
  shuffle(symbols);

  return {
    cards: symbols.map((s) => ({ symbol: s, flipped: false, matched: false })),
    firstPick: null,
    secondPick: null,
    moves: 0,
    bestMoves: getPersonalBest("memory")?.score ?? 0,
    locked: false,
    won: false,
    scoreSubmitted: false,
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
  private movesEl: HTMLElement | null = null;
  private bestEl: HTMLElement | null = null;
  private flipTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(state: MemoryState) {
    this.state = state;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "memory";

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

    // Grid
    const grid = document.createElement("div");
    grid.className = "memory__grid";

    for (let i = 0; i < CARDS; i++) {
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
    container.appendChild(wrapper);

    // Cache refs
    this.movesEl = document.getElementById("mem-moves");
    this.bestEl = document.getElementById("mem-best");
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

  private handlePick(index: number): void {
    const before = this.state.moves;
    this.pickCard(index);
    this.updateAllCards(this.state);

    if (this.state.moves !== before && this.movesEl) {
      this.movesEl.textContent = String(this.state.moves);
    }

    if (this.state.won) {
      if (this.bestEl) {
        this.bestEl.textContent = String(this.state.bestMoves);
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
        ${this.state.moves < this.state.bestMoves ? "<p class='memory__new-best'>New Best!</p>" : ""}
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
    const fresh = createMemoryGame();
    this.state.cards = fresh.cards;
    this.state.firstPick = null;
    this.state.secondPick = null;
    this.state.moves = 0;
    this.state.bestMoves = Math.max(this.state.bestMoves, fresh.bestMoves);
    this.state.locked = false;
    this.state.won = false;
    this.state.scoreSubmitted = false;

    if (this.movesEl) this.movesEl.textContent = "0";
    if (this.bestEl) this.bestEl.textContent = String(this.state.bestMoves || "—");

    // Remove win overlay
    const overlay = this.container?.querySelector(".memory__win");
    if (overlay) overlay.remove();

    this.updateAllCards(this.state);
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
      // Match!
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
      // Mismatch — flip back after delay
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
  /** Sync DOM cards with state — call after delayed flip-back. */
  private updateAllCards(state: MemoryState): void {
    if (!this.container) return;
    const cells = this.container.querySelectorAll(".memory__card");
    cells.forEach((cell, i) => {
      const card = state.cards[i];
      cell.classList.toggle("memory__card--flipped", card.flipped || card.matched);
      cell.classList.toggle("memory__card--matched", card.matched);
    });
  }
}
