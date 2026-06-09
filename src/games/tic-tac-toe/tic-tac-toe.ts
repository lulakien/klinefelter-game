/**
 * Tic-Tac-Toe — pass-and-play + AI opponent.
 *
 * CSS grid board, warm toy-arcade design, minimax AI.
 */

import { playSfx, vibrate } from "../../app/audio-manager.js";
import { saveScore } from "../../settings/scores-store.js";

type Cell = "X" | "O" | "";
type Difficulty = "easy" | "medium" | "hard";

interface TicTacToeState {
  board: Cell[];
  currentPlayer: "X" | "O";
  winner: Cell;
  draw: boolean;
  gameOver: boolean;
  winningLine: number[];
  mode: "pvp" | "ai";
  difficulty: Difficulty;
  scores: { x: number; o: number; draws: number };
  scoreSubmitted: boolean;
}

function createState(): TicTacToeState {
  return {
    board: Array.from({ length: 9 }, () => ""),
    currentPlayer: "X",
    winner: "",
    draw: false,
    gameOver: false,
    winningLine: [],
    mode: "pvp",
    difficulty: "medium",
    scores: { x: 0, o: 0, draws: 0 },
    scoreSubmitted: false,
  };
}

function checkWinner(board: Cell[]): { winner: Cell; line: number[] } {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6], // diagonals
  ];
  for (const line of lines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return { winner: "", line: [] };
}

function isDraw(board: Cell[]): boolean {
  return board.every((c) => c !== "");
}

function availableMoves(board: Cell[]): number[] {
  return board.map((c, i) => (c === "" ? i : -1)).filter((i) => i !== -1);
}

function minimax(board: Cell[], depth: number, isMaximizing: boolean): number {
  const result = checkWinner(board);
  if (result.winner === "O") return 10 - depth;
  if (result.winner === "X") return depth - 10;
  if (isDraw(board)) return 0;

  const moves = availableMoves(board);
  if (isMaximizing) {
    let best = -Infinity;
    for (const move of moves) {
      board[move] = "O";
      best = Math.max(best, minimax(board, depth + 1, false));
      board[move] = "";
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      board[move] = "X";
      best = Math.min(best, minimax(board, depth + 1, true));
      board[move] = "";
    }
    return best;
  }
}

function aiMove(state: TicTacToeState): number {
  const moves = availableMoves(state.board);
  if (moves.length === 0) return -1;

  if (state.difficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  if (state.difficulty === "medium") {
    if (Math.random() < 0.5) {
      return moves[Math.floor(Math.random() * moves.length)];
    }
  }

  // Hard (or medium falling through): minimax
  let bestMove = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    state.board[move] = "O";
    const score = minimax(state.board, 0, false);
    state.board[move] = "";
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

export class TicTacToeRenderer {
  private state: TicTacToeState;
  private container: HTMLElement | null = null;
  private aiTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(state: TicTacToeState) {
    this.state = state;
  }

  getState(): any {
    return this.state;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  destroy(): void {
    if (this.aiTimeout) {
      clearTimeout(this.aiTimeout);
      this.aiTimeout = null;
    }
    if (this.container) {
      this.container.innerHTML = "";
    }
    this.container = null;
  }

  private handleCellClick(index: number): void {
    if (this.state.gameOver || this.state.board[index] !== "") return;
    if (this.state.mode === "ai" && this.state.currentPlayer === "O") return;

    this.makeMove(index);

    if (!this.state.gameOver && this.state.mode === "ai") {
      this.aiTimeout = setTimeout(() => {
        const move = aiMove(this.state);
        if (move !== -1) this.makeMove(move);
        this.aiTimeout = null;
      }, 350);
    }
  }

  private makeMove(index: number): void {
    const state = this.state;
    state.board[index] = state.currentPlayer;
    playSfx("hit");

    const result = checkWinner(state.board);
    if (result.winner) {
      state.winner = result.winner;
      state.winningLine = result.line;
      state.gameOver = true;
      if (state.winner === "X") {
        state.scores.x++;
      } else {
        state.scores.o++;
      }
      playSfx("success");
      vibrate([30, 50, 30]);
      this.saveScore();
    } else if (isDraw(state.board)) {
      state.draw = true;
      state.gameOver = true;
      state.scores.draws++;
      playSfx("fail");
      vibrate(40);
      this.saveScore();
    } else {
      state.currentPlayer = state.currentPlayer === "X" ? "O" : "X";
    }

    this.render();
  }

  private saveScore(): void {
    if (this.state.scoreSubmitted) return;
    this.state.scoreSubmitted = true;
    const total = this.state.scores.x + this.state.scores.o + this.state.scores.draws;
    saveScore("tic-tac-toe", total, `${this.state.scores.x} wins`);
  }

  private reset(): void {
    this.state.board = Array.from({ length: 9 }, () => "");
    this.state.currentPlayer = "X";
    this.state.winner = "";
    this.state.draw = false;
    this.state.gameOver = false;
    this.state.winningLine = [];
    this.state.scoreSubmitted = false;
    this.render();
  }

  private setMode(mode: "pvp" | "ai"): void {
    this.state.mode = mode;
    this.reset();
  }

  private setDifficulty(difficulty: Difficulty): void {
    this.state.difficulty = difficulty;
    this.reset();
  }

  private render(): void {
    if (!this.container) return;

    const { board, currentPlayer, winner, draw, gameOver, mode, difficulty, scores } = this.state;

    let statusText = `${currentPlayer}'s turn`;
    if (gameOver) {
      if (winner) statusText = `${winner} wins!`;
      else if (draw) statusText = "It's a draw!";
    }

    this.container.innerHTML = `
      <div class="tic-tac-toe">
        <div class="puzzle-header">
          <div>
            <h1>Tic-Tac-Toe</h1>
            <p>${mode === "pvp" ? "Pass and play" : " vs AI"}</p>
          </div>
          <div class="puzzle-stats">
            <span>X Wins <strong>${scores.x}</strong></span>
            <span>O Wins <strong>${scores.o}</strong></span>
            <span>Draws <strong>${scores.draws}</strong></span>
          </div>
        </div>

        <div class="game-controls">
          <div class="toggle-group" id="ttt-mode-toggle">
            <button class="toggle-btn ${mode === "pvp" ? "toggle-btn--active" : ""}" data-value="pvp">2 Player</button>
            <button class="toggle-btn ${mode === "ai" ? "toggle-btn--active" : ""}" data-value="ai">vs AI</button>
          </div>
          ${mode === "ai" ? `
            <div class="toggle-group" id="ttt-diff-toggle">
              <button class="toggle-btn ${difficulty === "easy" ? "toggle-btn--active" : ""}" data-value="easy">Easy</button>
              <button class="toggle-btn ${difficulty === "medium" ? "toggle-btn--active" : ""}" data-value="medium">Medium</button>
              <button class="toggle-btn ${difficulty === "hard" ? "toggle-btn--active" : ""}" data-value="hard">Hard</button>
            </div>
          ` : ""}
        </div>

        <div class="tic-tac-toe__status">${statusText}</div>

        <div class="tic-tac-toe__board">
          ${board.map((cell, i) => {
            const won = this.state.winningLine.includes(i);
            return `<button class="tic-tac-toe__cell ${cell ? `tic-tac-toe__cell--${cell.toLowerCase()}` : ""} ${gameOver ? "tic-tac-toe__cell--disabled" : ""} ${won ? "tic-tac-toe__cell--win" : ""}"
                    data-index="${i}" ${cell || gameOver ? "disabled" : ""}>
              ${cell}
            </button>`;
          }).join("")}
        </div>

        <div class="puzzle-actions">
          <button class="btn btn--secondary" id="ttt-restart">New Game</button>
          <a class="btn btn--secondary" href="#/">Back to Home</a>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.container) return;

    this.container.querySelectorAll<HTMLElement>("[data-index]").forEach((el) => {
      el.addEventListener("click", () => this.handleCellClick(Number(el.dataset.index)));
    });

    this.container.querySelector("#ttt-restart")?.addEventListener("click", () => this.reset());

    const modeToggle = this.container.querySelector("#ttt-mode-toggle");
    modeToggle?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(".toggle-btn");
      if (!btn) return;
      const value = btn.getAttribute("data-value") as "pvp" | "ai";
      if (value) this.setMode(value);
    });

    const diffToggle = this.container.querySelector("#ttt-diff-toggle");
    diffToggle?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(".toggle-btn");
      if (!btn) return;
      const value = btn.getAttribute("data-value") as Difficulty;
      if (value) this.setDifficulty(value);
    });
  }
}

export function createTicTacToeGame(): TicTacToeState {
  return createState();
}
