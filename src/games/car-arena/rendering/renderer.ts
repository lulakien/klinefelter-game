/**
 * Canvas 2D renderer for Drift Arena.
 *
 * Draws the arena, cars, tokens, particles, and HUD.
 * Uses only Canvas shapes — no external image assets.
 */

import type { Camera } from "./camera.js";
import { applyCamera, removeCamera } from "./camera.js";
import type { Arena, TokenSpawn } from "../arena.js";
import type { CarState, CarConfig } from "../physics/car-physics.js";
import { getLateralSpeed, getSpeed } from "../physics/car-physics.js";
import type { BotState } from "../bots/bot.js";
import type { ScoreState } from "../scoring.js";
import { formatScore } from "../scoring.js";

// ---- Quality settings ----

export interface RenderQuality {
  /** Show tire marks / skid trails */
  tireMarks: boolean;
  /** Show collision sparks */
  sparks: boolean;
  /** Show smoke/dust particles */
  smoke: boolean;
  /** Target device pixel ratio cap */
  maxDpr: number;
  /** Show arena decorations */
  decorations: boolean;
}

export const ULTRA_LOW_QUALITY: RenderQuality = {
  tireMarks: false,
  sparks: false,
  smoke: false,
  maxDpr: 1.5,
  decorations: false,
};

export const HIGH_QUALITY: RenderQuality = {
  tireMarks: true,
  sparks: true,
  smoke: true,
  maxDpr: 2.0,
  decorations: true,
};

// ---- Particle types ----

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface TireMark {
  x: number;
  y: number;
  alpha: number;
}

// ---- Colors ----

const COLORS = {
  floor: "#1a1a2e",
  floorGrid: "#1f2544",
  wall: "#e94560",
  wallGlow: "rgba(233, 69, 96, 0.15)",
  obstacle: "#3a4f7a",
  obstacleStroke: "#5a6f9a",
  playerCar: "#4ecca3",
  playerCarStroke: "#2aac83",
  botCar: "#f0a500",
  botCarStroke: "#d09000",
  botChaser: "#ff4444",
  botCoward: "#44aaff",
  botBumper: "#ff8800",
  token: "#e94560",
  tokenGlow: "rgba(233, 69, 96, 0.4)",
  tireMark: "rgba(30, 30, 50, 0.6)",
  spark: "#ffcc00",
  smoke: "rgba(150, 150, 160, 0.4)",
  hudBg: "rgba(0, 0, 0, 0.6)",
  hudText: "#ffffff",
  hudAccent: "#e94560",
  driftBar: "#4ecca3",
  driftBarBg: "#333",
};

const BOT_COLORS: Record<string, { body: string; stroke: string }> = {
  wander: { body: COLORS.botCar, stroke: COLORS.botCarStroke },
  chaser: { body: COLORS.botChaser, stroke: "#cc2222" },
  coward: { body: COLORS.botCoward, stroke: "#2288cc" },
  bumper: { body: COLORS.botBumper, stroke: "#cc6600" },
};

// ---- Renderer ----

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private tireMarks: TireMark[] = [];
  private maxTireMarks = 200;
  private maxParticles = 80;
  private quality: RenderQuality;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement, quality: RenderQuality) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.quality = quality;
  }

  /** Resize the canvas to fill its container, respecting DPR. */
  resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const width = parent.clientWidth;
    const height = parent.clientHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.quality.maxDpr);

    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  getWidth(): number {
    return this.canvas.width / this.dpr;
  }

  getHeight(): number {
    return this.canvas.height / this.dpr;
  }

  /** Clear and draw everything for the current frame. */
  render(
    arena: Arena,
    playerCar: CarState,
    playerConfig: CarConfig,
    bots: BotState[],
    tokens: TokenSpawn[],
    activeTokens: Set<number>,
    score: ScoreState,
    camera: Camera,
    paused: boolean,
  ): void {
    const ctx = this.ctx;
    const w = this.getWidth();
    const h = this.getHeight();

    // Clear
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Background
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(0, 0, w, h);

    // World-space rendering
    applyCamera(ctx, camera, w, h);

    this.drawArenaFloor(arena);
    this.drawObstacles(arena);
    this.drawTireMarks();
    this.drawTokens(tokens, activeTokens);
    this.drawParticles();

    // Draw bots
    for (const bot of bots) {
      this.drawCar(bot.car, bot.config, bot.type);
    }

    // Draw player car (on top)
    this.drawCar(playerCar, playerConfig, "player");

    removeCamera(ctx);

    // Screen-space HUD
    this.drawHUD(score, w);

    // Pause overlay
    if (paused) {
      this.drawPauseOverlay(w, h);
    }
  }

  // ---- Arena ----

  private drawArenaFloor(arena: Arena): void {
    const ctx = this.ctx;
    const { minX, minY, maxX, maxY } = arena.bounds;

    // Floor fill
    ctx.fillStyle = "#141428";
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

    // Grid lines (subtle)
    if (this.quality.decorations) {
      ctx.strokeStyle = COLORS.floorGrid;
      ctx.lineWidth = 1;
      const gridSize = 100;
      for (let x = minX; x <= maxX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, minY);
        ctx.lineTo(x, maxY);
        ctx.stroke();
      }
      for (let y = minY; y <= maxY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(minX, y);
        ctx.lineTo(maxX, y);
        ctx.stroke();
      }
    }

    // Wall glow
    ctx.strokeStyle = COLORS.wallGlow;
    ctx.lineWidth = 8;
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

    // Walls
    ctx.strokeStyle = COLORS.wall;
    ctx.lineWidth = 3;
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

    // Corner accents
    const cornerSize = 30;
    ctx.fillStyle = COLORS.wall;
    this.fillRect(minX - 2, minY - 2, cornerSize, 4);
    this.fillRect(minX - 2, minY - 2, 4, cornerSize);
    this.fillRect(maxX + 2 - cornerSize, minY - 2, cornerSize, 4);
    this.fillRect(maxX - 2, minY - 2, 4, cornerSize);
    this.fillRect(minX - 2, maxY - 2, cornerSize, 4);
    this.fillRect(minX - 2, maxY + 2 - cornerSize, 4, cornerSize);
    this.fillRect(maxX + 2 - cornerSize, maxY - 2, cornerSize, 4);
    this.fillRect(maxX - 2, maxY + 2 - cornerSize, 4, cornerSize);
  }

  private drawObstacles(arena: Arena): void {
    const ctx = this.ctx;

    for (const obs of arena.obstacles) {
      ctx.fillStyle = COLORS.obstacle;
      ctx.strokeStyle = COLORS.obstacleStroke;
      ctx.lineWidth = 2;

      if (obs.type === "circle") {
        ctx.beginPath();
        ctx.arc(obs.circle.x, obs.circle.y, obs.circle.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (obs.type === "rect") {
        const { x, y, width, height } = obs.rect;
        ctx.beginPath();
        ctx.roundRect(
          x - width / 2,
          y - height / 2,
          width,
          height,
          6,
        );
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  // ---- Cars ----

  private drawCar(
    state: CarState,
    config: CarConfig,
    variant: string,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(state.x, state.y);
    ctx.rotate(state.rotation);

    const w = config.carWidth;
    const h = config.carHeight;

    if (variant === "player") {
      // Body
      ctx.fillStyle = COLORS.playerCar;
      ctx.strokeStyle = COLORS.playerCarStroke;
      ctx.lineWidth = 2;
      this.fillRoundRect(-w / 2, -h / 2, w, h, 6);
      ctx.fill();
      ctx.stroke();

      // Windshield
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      this.fillRoundRect(w / 2 - 10, -h / 2 + 4, 7, h - 8, 3);
      ctx.fill();

      // Rear lights
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(-w / 2 + 2, -h / 2 + 3, 4, 6);
      ctx.fillRect(-w / 2 + 2, h / 2 - 9, 4, 6);

      // Headlights
      ctx.fillStyle = "#ffffaa";
      ctx.fillRect(w / 2 - 6, -h / 2 + 3, 4, 6);
      ctx.fillRect(w / 2 - 6, h / 2 - 9, 4, 6);
    } else {
      // Bot car
      const colors = BOT_COLORS[variant] ?? BOT_COLORS.wander;
      ctx.fillStyle = colors.body;
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 2;
      this.fillRoundRect(-w / 2, -h / 2, w, h, 6);
      ctx.fill();
      ctx.stroke();

      // Simple stripe
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(-w / 4, -h / 2 + 4, w / 2, h - 8);
    }

    ctx.restore();

    // Drift indicator (tire smoke) — rendered at car position
    if (variant === "player" || variant === "chaser" || variant === "bumper") {
      const lateralSpeed = getLateralSpeed(state);
      const speed = getSpeed(state);
      if (lateralSpeed > 60 && speed > 50) {
        this.spawnTireMark(state.x, state.y);
        if (this.quality.smoke) {
          this.spawnSmoke(state.x, state.y, lateralSpeed);
        }
      }
    }
  }

  private fillRoundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  private fillRect(x: number, y: number, w: number, h: number): void {
    this.ctx.fillRect(x, y, w, h);
  }

  // ---- Tokens ----

  private drawTokens(
    tokens: TokenSpawn[],
    activeTokens: Set<number>,
  ): void {
    const ctx = this.ctx;
    const time = performance.now() / 1000;

    for (let i = 0; i < tokens.length; i++) {
      if (!activeTokens.has(i)) continue;

      const t = tokens[i];
      const pulse = 1 + Math.sin(time * 3 + i) * 0.2;
      const r = 10 * pulse;

      // Glow
      ctx.fillStyle = COLORS.tokenGlow;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r + 6, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = COLORS.token;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      ctx.arc(t.x - 2, t.y - 2, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- Particles ----

  spawnSparks(x: number, y: number, count: number): void {
    if (!this.quality.sparks) return;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 150;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.2 + Math.random() * 0.4,
        maxLife: 0.2 + Math.random() * 0.4,
        color: Math.random() < 0.5 ? COLORS.spark : "#ffffff",
        size: 1.5 + Math.random() * 2.5,
      });
    }
    this.clampParticles();
  }

  spawnSmoke(x: number, y: number, intensity: number): void {
    const count = Math.floor(intensity / 30);
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        life: 0.3 + Math.random() * 0.5,
        maxLife: 0.3 + Math.random() * 0.5,
        color: COLORS.smoke,
        size: 4 + Math.random() * 6,
      });
    }
    this.clampParticles();
  }

  private spawnTireMark(x: number, y: number): void {
    if (!this.quality.tireMarks) return;

    this.tireMarks.push({ x, y, alpha: 0.8 });
    if (this.tireMarks.length > this.maxTireMarks) {
      this.tireMarks.shift();
    }
  }

  private clampParticles(): void {
    while (this.particles.length > this.maxParticles) {
      this.particles.shift();
    }
  }

  updateParticles(dt: number): void {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }

    // Fade tire marks
    for (let i = this.tireMarks.length - 1; i >= 0; i--) {
      this.tireMarks[i].alpha -= dt * 0.3;
      if (this.tireMarks[i].alpha <= 0) {
        this.tireMarks.splice(i, 1);
      }
    }
  }

  private drawParticles(): void {
    const ctx = this.ctx;

    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawTireMarks(): void {
    if (!this.quality.tireMarks) return;

    const ctx = this.ctx;
    for (const mark of this.tireMarks) {
      if (mark.alpha <= 0.01) continue;
      ctx.fillStyle = COLORS.tireMark;
      ctx.globalAlpha = mark.alpha;
      ctx.beginPath();
      ctx.arc(mark.x, mark.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- HUD ----

  private drawHUD(score: ScoreState, canvasWidth: number): void {
    const ctx = this.ctx;

    // Top bar
    const barHeight = 48;
    ctx.fillStyle = COLORS.hudBg;
    ctx.fillRect(0, 0, canvasWidth, barHeight);

    const pad = 16;
    const fontSize = 16;

    ctx.fillStyle = COLORS.hudText;
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.textBaseline = "middle";

    // Score
    ctx.fillText(`Score: ${formatScore(score.score)}`, pad, barHeight / 2);

    // Time
    const timeText = score.roundActive
      ? `${Math.ceil(score.roundTimeRemaining)}s`
      : "Time's up!";
    ctx.textAlign = "center";
    ctx.fillText(timeText, canvasWidth / 2, barHeight / 2);
    ctx.textAlign = "start";

    // Drift chain
    if (score.driftChainMultiplier > 1.1) {
      const chainText = `DRIFT x${score.driftChainMultiplier.toFixed(1)}`;
      ctx.fillStyle = COLORS.driftBar;
      ctx.textAlign = "right";
      ctx.fillText(chainText, canvasWidth - pad, barHeight / 2);
      ctx.textAlign = "start";
    }

    ctx.textBaseline = "alphabetic";

    // Drift chain bar (subtle, below HUD)
    if (score.driftChainMultiplier > 1.0) {
      const barWidth = 120;
      const barX = canvasWidth - pad - barWidth;
      const barY = barHeight + 4;
      const fillWidth = ((score.driftChainMultiplier - 1) / 4) * barWidth;

      ctx.fillStyle = COLORS.driftBarBg;
      ctx.fillRect(barX, barY, barWidth, 4);
      ctx.fillStyle = COLORS.driftBar;
      ctx.fillRect(barX, barY, Math.min(fillWidth, barWidth), 4);
    }
  }

  // ---- Pause ----

  private drawPauseOverlay(w: number, h: number): void {
    const ctx = this.ctx;

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSED", w / 2, h / 2 - 30);

    ctx.font = "16px system-ui, sans-serif";
    ctx.fillStyle = "#aaa";
    ctx.fillText("Press P or Esc to resume", w / 2, h / 2 + 20);
    ctx.fillText("Press R to restart", w / 2, h / 2 + 46);

    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }
}
