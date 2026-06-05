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

export class SolitaireRenderer {
  private container: HTMLElement | null = null;
  private state: SolitaireState;

  constructor(state: SolitaireState) {
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

  private render(): void {
    if (!this.container) return;
    submitScore(this.state);

    this.container.innerHTML = `
      <div class="solitaire">
        <div class="puzzle-header">
          <div>
            <h1>Solitaire</h1>
            <p>Build foundations from ace to king.</p>
          </div>
          <div class="puzzle-stats">
            <span>Moves <strong>${this.state.moves}</strong></span>
            <span>Best <strong>${this.state.bestMoves ? this.state.bestMoves : "-"}</strong></span>
          </div>
        </div>
        <div class="solitaire__top">
          <button class="card card--back" id="solitaire-stock">${this.state.stock.length || "Reset"}</button>
          <button class="${this.getTopCardClass(this.state.waste[this.state.waste.length - 1])}" data-zone="waste">
            ${this.renderCardFace(this.state.waste[this.state.waste.length - 1])}
          </button>
          <div class="solitaire__gap"></div>
          ${this.state.foundations.map((pile, index) => {
            const card = pile[pile.length - 1];
            return `<button class="${this.getTopCardClass(card)}" data-zone="foundation" data-pile="${index}">${this.renderCardFace(card)}</button>`;
          }).join("")}
        </div>
        <div class="solitaire__tableau">
          ${this.state.tableau.map((pile, pileIndex) => this.renderPile(pile, pileIndex)).join("")}
        </div>
        <div class="puzzle-actions">
          <button class="btn btn--secondary" id="solitaire-restart">New Game</button>
          <a class="btn btn--secondary" href="#/">Back to Home</a>
        </div>
        ${this.state.won ? `<div class="puzzle-toast">Cleared in ${this.state.moves} moves.</div>` : ""}
      </div>
    `;

    this.bindEvents();
  }

  private renderPile(pile: Card[], pileIndex: number): string {
    const cards = pile.map((card, index) => this.renderCard(card, { zone: "tableau", pile: pileIndex, index })).join("");
    return `<div class="solitaire__pile" data-zone="tableau" data-pile="${pileIndex}">${cards || `<button class="card solitaire__slot" data-empty="1"></button>`}</div>`;
  }

  private getTopCardClass(card?: Card): string {
    if (!card) return "card solitaire__slot";
    return `card ${isRed(card) ? "card--red" : "card--black"}`;
  }

  private renderCardFace(card?: Card): string {
    if (!card) return "";
    return `<span>${RANKS[card.rank]}</span><span>${card.suit}</span>`;
  }

  private renderCard(card?: Card, selection?: Selection): string {
    if (!card) return "";
    const selected = this.isSelected(selection) ? " card--selected" : "";
    if (!card.faceUp) return `<button class="card card--back" data-zone="tableau" data-pile="${selection?.pile}" data-index="${selection?.index}"></button>`;
    const red = isRed(card) ? " card--red" : " card--black";
    const attrs = selection ? ` data-zone="${selection.zone}" data-pile="${selection.pile}" data-index="${selection.index}"` : "";
    return `<button class="card${red}${selected}"${attrs}><span>${RANKS[card.rank]}</span><span>${card.suit}</span></button>`;
  }

  private isSelected(selection?: Selection): boolean {
    const current = this.state.selected;
    if (!current || !selection) return false;
    return current.zone === selection.zone && current.pile === selection.pile && current.index === selection.index;
  }

  private bindEvents(): void {
    if (!this.container) return;
    this.container.querySelector("#solitaire-stock")?.addEventListener("click", () => this.drawStock());
    this.container.querySelector("#solitaire-restart")?.addEventListener("click", () => this.restart());

    const waste = this.container.querySelector<HTMLElement>("[data-zone='waste']");
    waste?.addEventListener("click", () => this.select({ zone: "waste", pile: 0, index: this.state.waste.length - 1 }));
    waste?.addEventListener("dblclick", () => this.autoFoundation({ zone: "waste", pile: 0, index: this.state.waste.length - 1 }));

    this.container.querySelectorAll<HTMLElement>("[data-zone='foundation']").forEach((el) => {
      el.addEventListener("click", () => this.tryTargetClick(el));
    });
    this.container.querySelectorAll<HTMLElement>(".solitaire__pile").forEach((el) => {
      el.addEventListener("click", (event) => {
        if (event.target === el) this.tryTargetClick(el);
      });
    });
    this.container.querySelectorAll<HTMLElement>(".solitaire__tableau .card[data-index]").forEach((el) => {
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        this.select({
          zone: "tableau",
          pile: Number(el.dataset.pile),
          index: Number(el.dataset.index),
        });
      });
      el.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        this.autoFoundation({
          zone: "tableau",
          pile: Number(el.dataset.pile),
          index: Number(el.dataset.index),
        });
      });
    });
  }

  private tryTargetClick(el: HTMLElement): void {
    const zone = el.dataset.zone as Zone;
    const pile = Number(el.dataset.pile);
    const selection = { zone, pile, index: 0 };
    if (this.state.selected && this.tryMove(selection)) {
      if (this.state.won) vibrate([20, 20, 20, 20]);
      playSfx(this.state.won ? "success" : "hit");
      this.render();
    }
  }
}
