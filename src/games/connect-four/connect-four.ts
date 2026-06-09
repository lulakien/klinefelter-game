/**
 * Connect Four — drop discs to connect four in a row.
 *
 * Pass-and-play + AI opponent. Warm toy-arcade design.
 */

import { playSfx, vibrate } from "../../app/audio-manager.js";
import { saveScore } from "../../settings/scores-store.js";

type Player = 1 | 2;
type Cell = 0 | 1 | 2;
type Difficulty = "easy" | "medium" | "hard";

interface ConnectFourState {
  board: Cell[][];
  currentPlayer: Player;
  winner: Player | 0;
  draw: boolean;
  gameOver: boolean;
  mode: "pvp" | "ai";
  difficulty: Difficulty;
  scores: { p1: number; p2: number; draws: number };
  scoreSubmitted: boolean;
  winningLine: [number, number][];
}

const ROWS = 6;
const COLS = 7;

function createState(): ConnectFourState {
  return {
    board: Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0 as Cell)),
    currentPlayer: 1,
    winner: 0,
    draw: false,
    gameOver: false,
    mode: "pvp",
    difficulty: "medium",
    scores: { p1: 0, p2: 0, draws: 0 },
    scoreSubmitted: false,
    winningLine: [],
  };
}

function getLowestOpenRow(board: Cell[][], col: number): number {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === 0) return row;
  }
  return -1;
}

function checkWinner(board: Cell[][]): { winner: Player | 0; line: [number, number][] } {
  const directions: [number, number][] = [
    [0, 1], // horizontal
    [1, 0], // vertical
    [1, 1], // diagonal down-right
    [1, -1], // diagonal down-left
  ];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const player = board[r][c];
      if (player === 0) continue;

      for (const [dr, dc] of directions) {
        const line: [number, number][] = [[r, c]];
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
          if (board[nr][nc] !== player) break;
          line.push([nr, nc]);
        }
        if (line.length === 4) {
          return { winner: player as Player, line };
        }
      }
    }
  }
  return { winner: 0, line: [] };
}

function isDraw(board: Cell[][]): boolean {
  return board[0].every((cell) => cell !== 0);
}

function evaluateWindow(window: Cell[], player: Player): number {
  const opponent = player === 1 ? 2 : 1;
  const playerCount = window.filter((c) => c === player).length;
  const opponentCount = window.filter((c) => c === opponent).length;
  const emptyCount = window.filter((c) => c === 0).length;

  if (playerCount === 4) return 100;
  if (playerCount === 3 && emptyCount === 1) return 5;
  if (playerCount === 2 && emptyCount === 2) return 2;
  if (opponentCount === 3 && emptyCount === 1) return -4;
  return 0;
}

function scorePosition(board: Cell[][], player: Player): number {
  let score = 0;

  // Center column preference
  const centerCol = board.map((row) => row[3]).filter((c) => c === player).length;
  score += centerCol * 3;

  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      const window = [board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]];
      score += evaluateWindow(window, player);
    }
  }

  // Vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 3; r++) {
      const window = [board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]];
      score += evaluateWindow(window, player);
    }
  }

  // Diagonal down-right
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      const window = [board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]];
      score += evaluateWindow(window, player);
    }
  }

  // Diagonal down-left
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 3; c < COLS; c++) {
      const window = [board[r][c], board[r + 1][c - 1], board[r + 2][c - 2], board[r + 3][c - 3]];
      score += evaluateWindow(window, player);
    }
  }

  return score;
}

function minimax(
  board: Cell[][],
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): { col: number; score: number } {
  const validCols: number[] = [];
  for (let c = 0; c < COLS; c++) {
    if (getLowestOpenRow(board, c) !== -1) validCols.push(c);
  }

  const result = checkWinner(board);
  if (result.winner === 2) return { col: -1, score: 100000 + depth };
  if (result.winner === 1) return { col: -1, score: -100000 - depth };
  if (validCols.length === 0) return { col: -1, score: 0 };
  if (depth === 0) return { col: -1, score: scorePosition(board, 2) };

  if (maximizing) {
    let best = { col: validCols[0], score: -Infinity };
    for (const col of validCols) {
      const row = getLowestOpenRow(board, col);
      board[row][col] = 2;
      const { score } = minimax(board, depth - 1, alpha, beta, false);
      board[row][col] = 0;
      if (score > best.score) {
        best = { col, score };
      }
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = { col: validCols[0], score: Infinity };
    for (const col of validCols) {
      const row = getLowestOpenRow(board, col);
      board[row][col] = 1;
      const { score } = minimax(board, depth - 1, alpha, beta, true);
      board[row][col] = 0;
      if (score < best.score) {
        best = { col, score };
      }
      beta = Math.min(beta, score);
      if (alpha >= beta) break;
    }
    return best;
  }
}

function aiMove(state: ConnectFourState): number {
  const validCols: number[] = [];
  for (let c = 0; c < COLS; c++) {
    if (getLowestOpenRow(state.board, c) !== -1) validCols.push(c);
  }
  if (validCols.length === 0) return -1;

  if (state.difficulty === "easy") {
    return validCols[Math.floor(Math.random() * validCols.length)];
  }

  if (state.difficulty === "medium") {
    if (Math.random() < 0.4) {
      return validCols[Math.floor(Math.random() * validCols.length)];
    }
  }

  const depth = state.difficulty === "hard" ? 5 : 3;
  const { col } = minimax(state.board, depth, -Infinity, Infinity, true);
  return col;
}

export class ConnectFourRenderer {
  private state: ConnectFourState;
  private container: HTMLElement | null = null;
  private aiTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(state: ConnectFourState) {
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

  private handleColumnClick(col: number): void {
    if (this.state.gameOver) return;
    if (this.state.mode === "ai" && this.state.currentPlayer === 2) return;

    const row = getLowestOpenRow(this.state.board, col);
    if (row === -1) return;

    this.dropDisc(row, col);

    if (!this.state.gameOver && this.state.mode === "ai") {
      this.aiTimeout = setTimeout(() => {
        const aiCol = aiMove(this.state);
        if (aiCol !== -1) {
          const aiRow = getLowestOpenRow(this.state.board, aiCol);
          if (aiRow !== -1) this.dropDisc(aiRow, aiCol);
        }
        this.aiTimeout = null;
      }, 400);
    }
  }

  private dropDisc(row: number, col: number): void {
    const state = this.state;
    state.board[row][col] = state.currentPlayer;
    playSfx("hit");
    vibrate(12);

    const result = checkWinner(state.board);
    if (result.winner) {
      state.winner = result.winner;
      state.winningLine = result.line;
      state.gameOver = true;
      if (result.winner === 1) {
        state.scores.p1++;
      } else {
        state.scores.p2++;
      }
      playSfx("success");
      vibrate([25, 30, 25]);
      this.saveScore();
    } else if (isDraw(state.board)) {
      state.draw = true;
      state.gameOver = true;
      state.scores.draws++;
      playSfx("fail");
      vibrate(40);
      this.saveScore();
    } else {
      state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
    }

    this.render();
  }

  private saveScore(): void {
    if (this.state.scoreSubmitted) return;
    this.state.scoreSubmitted = true;
    const total = this.state.scores.p1 + this.state.scores.p2 + this.state.scores.draws;
    saveScore("connect-four", total, `${this.state.scores.p1} wins`);
  }

  private reset(): void {
    this.state.board = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0 as Cell));
    this.state.currentPlayer = 1;
    this.state.winner = 0;
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

    const { board, currentPlayer, winner, draw, gameOver, mode, difficulty, scores, winningLine } = this.state;

    let statusText = `Player ${currentPlayer}'s turn`;
    if (gameOver) {
      if (winner) statusText = `Player ${winner} wins!`;
      else if (draw) statusText = "It's a draw!";
    }

    const player1Color = "var(--color-accent)";
    const player2Color = "var(--color-cyan)";

    this.container.innerHTML = `
      <div class="connect-four">
        <div class="puzzle-header">
          <div>
            <h1>Connect Four</h1>
            <p>${mode === "pvp" ? "Pass and play" : " vs AI"}</p>
          </div>
          <div class="puzzle-stats">
            <span style="color:${player1Color}">P1 Wins <strong>${scores.p1}</strong></span>
            <span style="color:${player2Color}">P2 Wins <strong>${scores.p2}</strong></span>
            <span>Draws <strong>${scores.draws}</strong></span>
          </div>
        </div>

        <div class="game-controls">
          <div class="toggle-group" id="cf-mode-toggle">
            <button class="toggle-btn ${mode === "pvp" ? "toggle-btn--active" : ""}" data-value="pvp">2 Player</button>
            <button class="toggle-btn ${mode === "ai" ? "toggle-btn--active" : ""}" data-value="ai">vs AI</button>
          </div>
          ${mode === "ai" ? `
            <div class="toggle-group" id="cf-diff-toggle">
              <button class="toggle-btn ${difficulty === "easy" ? "toggle-btn--active" : ""}" data-value="easy">Easy</button>
              <button class="toggle-btn ${difficulty === "medium" ? "toggle-btn--active" : ""}" data-value="medium">Medium</button>
              <button class="toggle-btn ${difficulty === "hard" ? "toggle-btn--active" : ""}" data-value="hard">Hard</button>
            </div>
          ` : ""}
        </div>

        <div class="connect-four__status" style="color: ${currentPlayer === 1 ? player1Color : player2Color}">${statusText}</div>

        <div class="connect-four__board">
          ${board.map((row, r) => `
            <div class="connect-four__row">
              ${row.map((cell, c) => {
                const won = winningLine.some(([wr, wc]) => wr === r && wc === c);
                return `<div class="connect-four__slot ${won ? "connect-four__slot--win" : ""}">
                  ${cell !== 0 ? `<span class="connect-four__disc connect-four__disc--p${cell}"></span>` : ""}
                </div>`;
              }).join("")}
            </div>
          `).join("")}
        </div>

        <div class="connect-four__columns">
          ${Array.from({ length: COLS }, (_, c) => `
            <button class="connect-four__drop-btn" data-col="${c}" ${gameOver || getLowestOpenRow(board, c) === -1 ? "disabled" : ""}>
              Drop
            </button>
          `).join("")}
        </div>

        <div class="puzzle-actions">
          <button class="btn btn--secondary" id="cf-restart">New Game</button>
          <a class="btn btn--secondary" href="#/">Back to Home</a>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.container) return;

    this.container.querySelectorAll<HTMLElement>("[data-col]").forEach((el) => {
      el.addEventListener("click", () => this.handleColumnClick(Number(el.dataset.col)));
    });

    this.container.querySelector("#cf-restart")?.addEventListener("click", () => this.reset());

    const modeToggle = this.container.querySelector("#cf-mode-toggle");
    modeToggle?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(".toggle-btn");
      if (!btn) return;
      const value = btn.getAttribute("data-value") as "pvp" | "ai";
      if (value) this.setMode(value);
    });

    const diffToggle = this.container.querySelector("#cf-diff-toggle");
    diffToggle?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(".toggle-btn");
      if (!btn) return;
      const value = btn.getAttribute("data-value") as Difficulty;
      if (value) this.setDifficulty(value);
    });
  }
}

export function createConnectFourGame(): ConnectFourState {
  return createState();
}
