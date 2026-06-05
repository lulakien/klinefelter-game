/**
 * Snake — Canvas-based classic snake game.
 *
 * Grid-based movement, keyboard + touch swipe controls,
 * warm toy-arcade color palette, score tracking.
 */

import { playSfx } from "../../app/audio-manager.js";
import { getPersonalBest, saveScore } from "../../settings/scores-store.js";

// ---- Constants ----

const GRID = 20;
const CELL = 24; // px per cell
const GAP = 2;
const TICK_MS = 130; // ms between moves (speed)
const CANVAS_PADDING = 16;

// DESIGN.md warm palette
const BG = "#ffe2d0";
const BORDER = "#4b3035";
const SNAKE_HEAD = "#23c7f4";
const SNAKE_BODY = "#16a8d8";
const FOOD = "#ff5b5b";
const CREAM = "#fff3e8";

// ---- Types ----

interface Point {
  x: number;
  y: number;
}

type Direction = "up" | "down" | "left" | "right";

interface SnakeState {
  snake: Point[];
  food: Point;
  direction: Direction;
  nextDirection: Direction;
  score: number;
  bestScore: number;
  gameOver: boolean;
  scoreSubmitted: boolean;
  tickTimer: number;
  lastTimestamp: number;
  growPending: boolean;
}

// ---- Game Logic ----

export function createSnakeGame(): SnakeState {
  const mid = Math.floor(GRID / 2);
  return {
    snake: [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ],
    food: spawnFood([]),
    direction: "right",
    nextDirection: "right",
    score: 0,
    bestScore: getPersonalBest("snake")?.score ?? 0,
    gameOver: false,
    scoreSubmitted: false,
    tickTimer: 0,
    lastTimestamp: 0,
    growPending: false,
  };
}

function spawnFood(snake: Point[]): Point {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  let p: Point;
  do {
    p = {
      x: Math.floor(Math.random() * GRID),
      y: Math.floor(Math.random() * GRID),
    };
  } while (occupied.has(`${p.x},${p.y}`));
  return p;
}

function stepSnake(state: SnakeState): void {
  if (state.gameOver) return;

  state.direction = state.nextDirection;

  const head = state.snake[0];
  const newHead: Point = { ...head };

  switch (state.direction) {
    case "up": newHead.y--; break;
    case "down": newHead.y++; break;
    case "left": newHead.x--; break;
    case "right": newHead.x++; break;
  }

  // Wall collision
  if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID) {
    endGame(state);
    return;
  }

  // Self collision (skip tail since it's about to move)
  const checkBody = state.growPending ? state.snake : state.snake.slice(0, -1);
  for (const seg of checkBody) {
    if (seg.x === newHead.x && seg.y === newHead.y) {
      endGame(state);
      return;
    }
  }

  state.snake.unshift(newHead);

  if (state.growPending) {
    state.growPending = false;
  } else {
    state.snake.pop();
  }

  // Check food
  if (newHead.x === state.food.x && newHead.y === state.food.y) {
    state.score += 10;
    state.growPending = true;
    state.food = spawnFood(state.snake);
    if (state.score > state.bestScore) {
      state.bestScore = state.score;
    }
    playSfx("click");
  }
}

function endGame(state: SnakeState): void {
  state.gameOver = true;
  playSfx("fail");
  if (!state.scoreSubmitted) {
    state.scoreSubmitted = true;
    saveScore("snake", state.score, String(state.score));
  }
}

function changeDirection(state: SnakeState, dir: Direction): void {
  const opposites: Record<Direction, Direction> = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  };
  // Prevent reversing into self
  if (opposites[dir] !== state.direction) {
    state.nextDirection = dir;
  }
}

// ---- Canvas Renderer ----

export class SnakeRenderer {
  private state: SnakeState;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement | null = null;
  private animFrame = 0;
  private dpr: number;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onTouch: (e: TouchEvent) => void;
  private touchStart: Point | null = null;

  constructor(state: SnakeState) {
    this.state = state;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d")!;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.onKeyDown = this.handleKey.bind(this);
    this.onTouch = this.handleTouch.bind(this);
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "snake";

    // Header
    const header = document.createElement("div");
    header.className = "snake__header";
    const scoreEl = document.createElement("span");
    scoreEl.id = "snake-score";
    const bestEl = document.createElement("span");
    bestEl.id = "snake-best";
    header.appendChild(scoreEl);
    header.appendChild(bestEl);

    // Canvas
    const boardWrap = document.createElement("div");
    boardWrap.className = "snake__board";

    const canvasSize = GRID * CELL + CANVAS_PADDING * 2;
    this.canvas.width = canvasSize * this.dpr;
    this.canvas.height = canvasSize * this.dpr;
    this.canvas.style.width = `${canvasSize}px`;
    this.canvas.style.height = `${canvasSize}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    boardWrap.appendChild(this.canvas);

    // Hint
    const hint = document.createElement("p");
    hint.className = "snake__hint";
    hint.textContent = "Arrow keys or swipe to move";

    wrapper.appendChild(header);
    wrapper.appendChild(boardWrap);
    wrapper.appendChild(hint);
    container.appendChild(wrapper);

    // Input
    window.addEventListener("keydown", this.onKeyDown);
    this.canvas.addEventListener("touchstart", this.onTouch, { passive: false });
    this.canvas.addEventListener("touchmove", this.onTouch, { passive: false });
    this.canvas.addEventListener("touchend", this.onTouch, { passive: false });

    // Start loop
    this.state.lastTimestamp = performance.now();
    this.tick();
  }

  destroy(): void {
    cancelAnimationFrame(this.animFrame);
    window.removeEventListener("keydown", this.onKeyDown);
    this.canvas.removeEventListener("touchstart", this.onTouch);
    this.canvas.removeEventListener("touchmove", this.onTouch);
    this.canvas.removeEventListener("touchend", this.onTouch);
    if (this.container) {
      this.container.innerHTML = "";
    }
  }

  private tick(): void {
    const now = performance.now();
    const dt = now - this.state.lastTimestamp;
    this.state.lastTimestamp = now;

    this.state.tickTimer += dt;
    while (this.state.tickTimer >= TICK_MS) {
      this.state.tickTimer -= TICK_MS;
      stepSnake(this.state);
    }

    this.draw();
    this.updateUI();

    this.animFrame = requestAnimationFrame(() => this.tick());
  }

  private draw(): void {
    const ctx = this.ctx;
    const pad = CANVAS_PADDING;

    // Board background
    ctx.fillStyle = BG;
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 5;
    roundRect(ctx, pad - 2, pad - 2, GRID * CELL + 4, GRID * CELL + 4, 16);
    ctx.fill();
    ctx.stroke();

    // Grid cells
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const cx = pad + x * CELL + GAP;
        const cy = pad + y * CELL + GAP;
        const size = CELL - GAP * 2;

        ctx.fillStyle = CREAM;
        ctx.strokeStyle = "rgba(75, 48, 53, 0.1)";
        ctx.lineWidth = 1;
        roundRect(ctx, cx, cy, size, size, 6);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Draw food
    {
      const fx = pad + this.state.food.x * CELL + CELL / 2;
      const fy = pad + this.state.food.y * CELL + CELL / 2;
      const r = (CELL - GAP * 2) / 2 - 2;

      ctx.fillStyle = FOOD;
      ctx.beginPath();
      ctx.arc(fx, fy, r, 0, Math.PI * 2);
      ctx.fill();

      // Shine highlight
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.arc(fx - r * 0.3, fy - r * 0.3, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw snake
    for (let i = this.state.snake.length - 1; i >= 0; i--) {
      const seg = this.state.snake[i];
      const sx = pad + seg.x * CELL + GAP;
      const sy = pad + seg.y * CELL + GAP;
      const size = CELL - GAP * 2;

      ctx.fillStyle = i === 0 ? SNAKE_HEAD : SNAKE_BODY;
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 2;
      roundRect(ctx, sx, sy, size, size, i === 0 ? 8 : 6);
      ctx.fill();
      ctx.stroke();

      // Eyes on head
      if (i === 0) {
        ctx.fillStyle = "#fff";
        const eyeR = 3;
        const cx = sx + size / 2;
        const cy = sy + size / 2;
        let ex1 = cx - 4, ey1 = cy - 4;
        let ex2 = cx - 4, ey2 = cy + 4;
        if (this.state.direction === "right") { ex1 = cx + 3; ey1 = cy - 4; ex2 = cx + 3; ey2 = cy + 4; }
        if (this.state.direction === "down") { ex1 = cx - 3; ey1 = cy + 4; ex2 = cx + 3; ey2 = cy + 4; }
        if (this.state.direction === "up") { ex1 = cx - 3; ey1 = cy - 4; ex2 = cx + 3; ey2 = cy - 4; }

        ctx.beginPath();
        ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = BORDER;
        ctx.beginPath();
        ctx.arc(ex1, ey1, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex2, ey2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Game over overlay
    if (this.state.gameOver) {
      ctx.fillStyle = "rgba(105, 64, 70, 0.85)";
      roundRect(ctx, pad, pad, GRID * CELL, GRID * CELL, 14);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = "900 28px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", pad + (GRID * CELL) / 2, pad + (GRID * CELL) / 2 - 20);

      ctx.font = "700 16px system-ui, sans-serif";
      ctx.fillStyle = "#ffd529";
      ctx.fillText(`Score: ${this.state.score}`, pad + (GRID * CELL) / 2, pad + (GRID * CELL) / 2 + 20);

      ctx.font = "700 13px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText("Tap or press R to restart", pad + (GRID * CELL) / 2, pad + (GRID * CELL) / 2 + 48);
    }
  }

  private updateUI(): void {
    const scoreEl = document.getElementById("snake-score");
    const bestEl = document.getElementById("snake-best");
    if (scoreEl) scoreEl.textContent = `Score: ${this.state.score}`;
    if (bestEl) bestEl.textContent = `Best: ${this.state.bestScore}`;
  }

  private handleKey(e: KeyboardEvent): void {
    if (this.state.gameOver) {
      if (e.key === "r" || e.key === "R" || e.key === " ") {
        e.preventDefault();
        this.reset();
      }
      return;
    }

    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        e.preventDefault();
        changeDirection(this.state, "up");
        break;
      case "ArrowDown":
      case "s":
      case "S":
        e.preventDefault();
        changeDirection(this.state, "down");
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        e.preventDefault();
        changeDirection(this.state, "left");
        break;
      case "ArrowRight":
      case "d":
      case "D":
        e.preventDefault();
        changeDirection(this.state, "right");
        break;
    }
  }

  private handleTouch(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return;

    if (e.type === "touchstart") {
      if (this.state.gameOver) {
        this.reset();
        return;
      }
      this.touchStart = { x: touch.clientX, y: touch.clientY };
    }

    if ((e.type === "touchmove" || e.type === "touchend") && this.touchStart) {
      const dx = touch.clientX - this.touchStart.x;
      const dy = touch.clientY - this.touchStart.y;
      const threshold = 20;

      if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
        if (Math.abs(dx) > Math.abs(dy)) {
          changeDirection(this.state, dx > 0 ? "right" : "left");
        } else {
          changeDirection(this.state, dy > 0 ? "down" : "up");
        }
        this.touchStart = { x: touch.clientX, y: touch.clientY };
      }
    }
  }

  private reset(): void {
    const fresh = createSnakeGame();
    this.state.snake = fresh.snake;
    this.state.food = fresh.food;
    this.state.direction = fresh.direction;
    this.state.nextDirection = fresh.nextDirection;
    this.state.score = 0;
    this.state.gameOver = false;
    this.state.scoreSubmitted = false;
    this.state.tickTimer = 0;
    this.state.growPending = false;
    this.state.bestScore = Math.max(this.state.bestScore, fresh.bestScore);
  }
}

// ---- Helpers ----

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
