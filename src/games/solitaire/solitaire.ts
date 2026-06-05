/**
 * Solitaire — Klondike with draw-one stock, tap and drag interactions,
 * responsive card sizing, and warm toy-arcade design.
 */

import { playSfx, vibrate } from "../../app/audio-manager.js";
import { getPersonalBest, saveScore } from "../../settings/scores-store.js";

type Suit = "H" | "D" | "C" | "S";
type Zone = "stock" | "waste" | "foundation" | "tableau";

interface Card {
  id: string;
  suit: Suit;
  rank: number;
  faceUp: boolean;
}

interface Selection {
  zone: Zone;
  pile: number;
  index: number;
}

interface SolitaireState {
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  tableau: Card[][];
  selected: Selection | null;
  moves: number;
  bestMoves: number;
  won: boolean;
  scoreSubmitted: boolean;
}

const SUITS: Suit[] = ["H", "D", "C", "S"];
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUIT_SYMBOLS: Record<Suit, string> = { H: "♥", D: "♦", C: "♣", S: "♠" };

export function createSolitaireGame(): SolitaireState {
  const deck = SUITS.flatMap((suit) =>
    Array.from({ length: 13 }, (_, index) => ({
      id: `${suit}${index + 1}`,
      suit,
      rank: index + 1,
      faceUp: false,
    })),
  );
  shuffle(deck);

  const tableau: Card[][] = Array.from({ length: 7 }, () => []);
  for (let pile = 0; pile < 7; pile++) {
    for (let i = 0; i <= pile; i++) {
      const card = deck.pop()!;
      card.faceUp = i === pile;
      tableau[pile].push(card);
    }
  }

  return {
    stock: deck,
    waste: [],
    foundations: Array.from({ length: 4 }, () => []),
    tableau,
    selected: null,
    moves: 0,
    bestMoves: getPersonalBest("solitaire")?.score ?? 0,
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

function isRed(card: Card): boolean {
  return card.suit === "H" || card.suit === "D";
}

function canStackOnTableau(card: Card, target: Card | undefined): boolean {
  if (!target) return card.rank === 13;
  return target.faceUp && isRed(card) !== isRed(target) && card.rank === target.rank - 1;
}

function canMoveToFoundation(card: Card, foundation: Card[]): boolean {
  const target = foundation[foundation.length - 1];
  if (!target) return card.rank === 1;
  return target.suit === card.suit && card.rank === target.rank + 1;
}

function getSelectionCards(state: SolitaireState, selection: Selection): Card[] {
  if (selection.zone === "waste") {
    const card = state.waste[state.waste.length - 1];
    return card ? [card] : [];
  }
  if (selection.zone === "foundation") {
    const pile = state.foundations[selection.pile];
    const card = pile[pile.length - 1];
    return card ? [card] : [];
  }
  if (selection.zone === "tableau") {
    return state.tableau[selection.pile].slice(selection.index);
  }
  return [];
}

function removeSelectionCards(state: SolitaireState, selection: Selection): Card[] {
  if (selection.zone === "waste") return [state.waste.pop()!];
  if (selection.zone === "foundation") return [state.foundations[selection.pile].pop()!];
  return state.tableau[selection.pile].splice(selection.index);
}

function revealTableauTop(state: SolitaireState, pile: number): boolean {
  const top = state.tableau[pile]?.[state.tableau[pile].length - 1];
  if (top && !top.faceUp) {
    top.faceUp = true;
    return true;
  }
  return false;
}

function afterMove(state: SolitaireState, source?: Selection): void {
  if (source?.zone === "tableau") revealTableauTop(state, source.pile);
  state.moves++;
  state.won = state.foundations.every((pile) => pile.length === 13);
  if (state.won && (!state.bestMoves || state.moves < state.bestMoves)) state.bestMoves = state.moves;
}

function submitScore(state: SolitaireState): void {
  if (!state.won || state.scoreSubmitted) return;
  saveScore("solitaire", state.moves, `${state.moves} moves`);
  state.scoreSubmitted = true;
}

// ---- Renderer ----

export class SolitaireRenderer {
  private container: HTMLElement | null = null;
  private state: SolitaireState;
  private drag: {
    selection: Selection;
    ghost: HTMLElement;
    offsetX: number;
    offsetY: number;
  } | null = null;
  private boundOnMove: (e: PointerEvent) => void;
  private boundOnUp: (e: PointerEvent) => void;

  constructor(state: SolitaireState) {
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
    this.state = createSolitaireGame();
    this.render();
  }

  private drawStock(): void {
    if (this.state.stock.length > 0) {
      const card = this.state.stock.pop()!;
      card.faceUp = true;
      this.state.waste.push(card);
      this.state.moves++;
      playSfx("hit");
    } else if (this.state.waste.length > 0) {
      this.state.stock = this.state.waste.reverse().map((card) => ({ ...card, faceUp: false }));
      this.state.waste = [];
      this.state.moves++;
      playSfx("hit");
    }
    this.state.selected = null;
    this.render();
  }

  private select(selection: Selection): void {
    const cards = getSelectionCards(this.state, selection);
    if (!cards.length || !cards[0].faceUp) return;

    if (!this.state.selected) {
      this.state.selected = selection;
      playSfx("click");
      this.render();
      return;
    }

    if (this.tryMove(selection)) {
      playSfx(this.state.won ? "success" : "hit");
    } else {
      this.state.selected = selection;
      playSfx("fail");
    }
    this.render();
  }

  private tryMove(target: Selection): boolean {
    const source = this.state.selected;
    if (!source) return false;
    const cards = getSelectionCards(this.state, source);
    if (!cards.length) return false;
    const first = cards[0];

    if (target.zone === "tableau") {
      const pile = this.state.tableau[target.pile];
      if (source.zone === "tableau" && source.pile === target.pile) return false;
      if (!canStackOnTableau(first, pile[pile.length - 1])) return false;
      const moving = removeSelectionCards(this.state, source);
      pile.push(...moving);
      this.state.selected = null;
      afterMove(this.state, source);
      return true;
    }

    if (target.zone === "foundation" && cards.length === 1) {
      const foundation = this.state.foundations[target.pile];
      if (!canMoveToFoundation(first, foundation)) return false;
      const moving = removeSelectionCards(this.state, source);
      foundation.push(...moving);
      this.state.selected = null;
      afterMove(this.state, source);
      return true;
    }

    return false;
  }

  private autoFoundation(selection: Selection): void {
    const sourceCards = getSelectionCards(this.state, selection);
    if (sourceCards.length !== 1) return;
    const card = sourceCards[0];
    const pile = this.state.foundations.findIndex((foundation) => canMoveToFoundation(card, foundation));
    if (pile === -1) return;
    this.state.selected = selection;
    if (this.tryMove({ zone: "foundation", pile, index: this.state.foundations[pile].length })) {
      if (this.state.won) vibrate([20, 20, 20, 20]);
      playSfx(this.state.won ? "success" : "hit");
      this.render();
    }
  }

  // ---- Drag support ----

  private startDrag(e: PointerEvent, selection: Selection, el: HTMLElement): void {
    if (this.state.won) return;
    const cards = getSelectionCards(this.state, selection);
    if (!cards.length || !cards[0].faceUp) return;

    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // Build ghost with selected cards stacked
    const ghost = document.createElement("div");
    ghost.style.position = "fixed";
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9999";
    ghost.style.opacity = "0.92";

    cards.forEach((card, i) => {
      const cardEl = this.buildCardElement(card, false);
      if (i > 0) {
        cardEl.style.marginTop = "var(--card-overlap)";
      }
      ghost.appendChild(cardEl);
    });

    document.body.appendChild(ghost);
    this.drag = { selection, ghost, offsetX, offsetY };
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
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.drag) return;
    e.preventDefault();

    const { selection } = this.drag;
    const cards = getSelectionCards(this.state, selection);
    const first = cards[0];

    // Find drop target using elementFromPoint, ignoring ghost
    this.drag.ghost.style.display = "none";
    const targetEl = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    this.drag.ghost.style.display = "";

    let moved = false;
    if (targetEl) {
      const tableauPile = targetEl.closest<HTMLElement>(".solitaire__pile");
      const foundation = targetEl.closest<HTMLElement>(".solitaire__foundation");

      if (tableauPile) {
        const pileIndex = Number(tableauPile.dataset.pile);
        const pile = this.state.tableau[pileIndex];
        if (canStackOnTableau(first, pile[pile.length - 1])) {
          const moving = removeSelectionCards(this.state, selection);
          pile.push(...moving);
          this.state.selected = null;
          afterMove(this.state, selection);
          moved = true;
        }
      } else if (foundation && cards.length === 1) {
        const pileIndex = Number(foundation.dataset.pile);
        const pile = this.state.foundations[pileIndex];
        if (canMoveToFoundation(first, pile)) {
          const moving = removeSelectionCards(this.state, selection);
          pile.push(...moving);
          this.state.selected = null;
          afterMove(this.state, selection);
          moved = true;
        }
      }
    }

    if (!moved) {
      // Deselect if dropped nowhere valid
      this.state.selected = null;
    } else {
      playSfx(this.state.won ? "success" : "hit");
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
  }

  // ---- Rendering ----

  private render(): void {
    if (!this.container) return;
    submitScore(this.state);

    const wrapper = document.createElement("div");
    wrapper.className = "solitaire";

    // Header
    const header = document.createElement("div");
    header.className = "puzzle-header";
    header.innerHTML = `
      <div>
        <h1>Solitaire</h1>
        <p>Build foundations ace to king.</p>
      </div>
      <div class="puzzle-stats">
        <span>Moves <strong>${this.state.moves}</strong></span>
        <span>Best <strong>${this.state.bestMoves ? this.state.bestMoves : "-"}</strong></span>
      </div>
    `;
    wrapper.appendChild(header);

    // Top row
    const top = document.createElement("div");
    top.className = "solitaire__top";

    // Stock
    const stockBtn = document.createElement("button");
    stockBtn.className = "card card--back solitaire__stock";
    stockBtn.textContent = this.state.stock.length ? String(this.state.stock.length) : "↺";
    stockBtn.addEventListener("click", () => this.drawStock());
    top.appendChild(stockBtn);

    // Waste
    const wastePile = document.createElement("div");
    wastePile.className = "solitaire__waste";
    const wasteCard = this.state.waste[this.state.waste.length - 1];
    if (wasteCard) {
      const wEl = this.buildCardElement(wasteCard, this.isSelected({ zone: "waste", pile: 0, index: this.state.waste.length - 1 }));
      wEl.addEventListener("click", () => this.select({ zone: "waste", pile: 0, index: this.state.waste.length - 1 }));
      wEl.addEventListener("dblclick", () => this.autoFoundation({ zone: "waste", pile: 0, index: this.state.waste.length - 1 }));
      wEl.addEventListener("pointerdown", (e) => this.startDrag(e, { zone: "waste", pile: 0, index: this.state.waste.length - 1 }, wEl));
      wastePile.appendChild(wEl);
    } else {
      const empty = document.createElement("div");
      empty.className = "card solitaire__slot";
      wastePile.appendChild(empty);
    }
    top.appendChild(wastePile);

    // Gap
    const gap = document.createElement("div");
    gap.className = "solitaire__gap";
    top.appendChild(gap);

    // Foundations
    this.state.foundations.forEach((pile, index) => {
      const fEl = document.createElement("div");
      fEl.className = "solitaire__foundation";
      fEl.dataset.pile = String(index);
      const card = pile[pile.length - 1];
      if (card) {
        const cEl = this.buildCardElement(card, this.isSelected({ zone: "foundation", pile: index, index: pile.length - 1 }));
        cEl.addEventListener("click", () => this.select({ zone: "foundation", pile: index, index: pile.length - 1 }));
        cEl.addEventListener("pointerdown", (e) => this.startDrag(e, { zone: "foundation", pile: index, index: pile.length - 1 }, cEl));
        fEl.appendChild(cEl);
      } else {
        const empty = document.createElement("div");
        empty.className = "card solitaire__slot";
        empty.innerHTML = `<span style="font-size:1.2rem;opacity:0.25">${SUIT_SYMBOLS[SUITS[index]]}</span>`;
        fEl.appendChild(empty);
      }
      fEl.addEventListener("click", (e) => {
        if (e.target === fEl) this.tryMove({ zone: "foundation", pile: index, index: pile.length });
      });
      top.appendChild(fEl);
    });

    wrapper.appendChild(top);

    // Tableau
    const tableau = document.createElement("div");
    tableau.className = "solitaire__tableau";

    this.state.tableau.forEach((pile, pileIndex) => {
      const pileEl = document.createElement("div");
      pileEl.className = "solitaire__pile";
      pileEl.dataset.pile = String(pileIndex);

      if (pile.length === 0) {
        const empty = document.createElement("div");
        empty.className = "card solitaire__slot";
        pileEl.appendChild(empty);
      } else {
        pile.forEach((card, cardIndex) => {
          const selected = this.isSelected({ zone: "tableau", pile: pileIndex, index: cardIndex });
          const cEl = this.buildCardElement(card, selected);

          cEl.addEventListener("click", (e) => {
            e.stopPropagation();
            this.select({ zone: "tableau", pile: pileIndex, index: cardIndex });
          });
          cEl.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            this.autoFoundation({ zone: "tableau", pile: pileIndex, index: cardIndex });
          });
          cEl.addEventListener("pointerdown", (e) => {
            this.startDrag(e, { zone: "tableau", pile: pileIndex, index: cardIndex }, cEl);
          });

          pileEl.appendChild(cEl);
        });
      }

      pileEl.addEventListener("click", (e) => {
        if (e.target === pileEl) this.tryMove({ zone: "tableau", pile: pileIndex, index: pile.length });
      });

      tableau.appendChild(pileEl);
    });

    wrapper.appendChild(tableau);

    // Actions
    const actions = document.createElement("div");
    actions.className = "puzzle-actions";
    actions.innerHTML = '<button class="btn btn--secondary" id="solitaire-restart">New Game</button><a class="btn btn--secondary" href="#/">Back to Home</a>';
    actions.querySelector("#solitaire-restart")?.addEventListener("click", () => this.restart());
    wrapper.appendChild(actions);

    // Win toast
    if (this.state.won) {
      const toast = document.createElement("div");
      toast.className = "puzzle-toast";
      toast.textContent = `Cleared in ${this.state.moves} moves.`;
      wrapper.appendChild(toast);
    }

    this.container.innerHTML = "";
    this.container.appendChild(wrapper);
  }

  private buildCardElement(card: Card, selected: boolean): HTMLElement {
    const el = document.createElement("button");
    const red = isRed(card) ? " card--red" : " card--black";
    el.className = `card${red}${selected ? " card--selected" : ""}${card.faceUp ? "" : " card--back"}`;
    if (card.faceUp) {
      el.innerHTML = `<span>${RANKS[card.rank]}</span><span>${SUIT_SYMBOLS[card.suit]}</span>`;
    }
    return el;
  }

  private isSelected(selection: Selection): boolean {
    const current = this.state.selected;
    if (!current) return false;
    return current.zone === selection.zone && current.pile === selection.pile && current.index === selection.index;
  }
}
