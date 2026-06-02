/**
 * Drift Arena — Main game orchestrator.
 *
 * Ties together physics, rendering, input, bots, arena, and scoring
 * into a complete game loop with pause/restart/exit.
 */

import type { CarConfig, CarInput } from "./physics/car-physics.js";
import {
  DEFAULT_CAR_CONFIG,
  createCarState,
  updateCar,
} from "./physics/car-physics.js";
import {
  resolveWallCollision,
  resolveObstacleCollisions,
  resolveCarCarCollision,
} from "./physics/collision.js";
import { InputManager } from "./input/input-manager.js";
import { Renderer, ULTRA_LOW_QUALITY, HIGH_QUALITY, type RenderQuality } from "./rendering/renderer.js";
import { createCamera, updateCamera } from "./rendering/camera.js";
import type { BotState, BotType } from "./bots/bot.js";
import { createBot, updateBot } from "./bots/bot.js";
import { createDefaultArena, type Arena, type TokenSpawn } from "./arena.js";
import {
  createScoreState,
  updateScoring,
  collectToken,
  bumpBot,
  updateDriftChain,
  getFinalScore,
} from "./scoring.js";

// ---- Game Config ----

const FIXED_DT = 1 / 60; // 60 Hz physics
const MAX_ACCUMULATOR = 0.1; // prevent spiral of death
const ROUND_DURATION = 90; // seconds
const TOKEN_COLLECT_RADIUS = 28; // how close car must be to token
const BOT_BUMP_SPEED = 200; // minimum relative speed for bot bump score
const TOKEN_COUNT = 6; // tokens active at any time

// ---- Game State ----

type GamePhase = "countdown" | "playing" | "round-over" | "paused";

export class CarGame {
  // Systems
  private input: InputManager;
  private renderer: Renderer | null = null;
  private canvas: HTMLCanvasElement | null = null;

  // Game world
  private arena!: Arena;
  private playerCar = createCarState(0, 0);
  private playerConfig: CarConfig = { ...DEFAULT_CAR_CONFIG };
  private bots: BotState[] = [];
  private tokens: TokenSpawn[] = [];
  private activeTokens = new Set<number>();
  private scoreState = createScoreState(ROUND_DURATION);

  // Loop
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;
  private phase: GamePhase = "countdown";
  private countdownTimer = 3;

  // Quality
  private renderQuality: RenderQuality;

  // Near miss tracking
  private lastBotDistances: number[] = [];
  private nearMissCooldown = 0;

  constructor(qualityMode: "ultra-low" | "high-quality") {
    this.input = new InputManager();
    this.renderQuality =
      qualityMode === "ultra-low" ? ULTRA_LOW_QUALITY : HIGH_QUALITY;
  }

  /** Initialize and start the game. */
  start(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;

    // Set up renderer
    this.renderer = new Renderer(canvas, this.renderQuality);
    this.renderer.resize();

    // Initialize game world
    this.arena = createDefaultArena();
    this.resetGameState();

    // Attach input
    this.input.attach(canvas);

    // Prevent page scroll on the canvas
    canvas.style.touchAction = "none";

    // Start game loop
    this.running = true;
    this.lastTime = performance.now();
    this.phase = "countdown";
    this.countdownTimer = 3;
    this.loop(this.lastTime);
  }

  /** Clean up all resources. */
  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.input.detach();
    if (this.canvas) {
      this.canvas.style.touchAction = "";
    }
    this.renderer = null;
    this.canvas = null;
  }

  // ---- Game Loop ----

  private loop = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Clamp dt to avoid huge jumps (e.g. tab was backgrounded)
    if (dt > 0.2) dt = 0.016;

    // Handle resize
    if (this.renderer) {
      this.renderer.resize();
    }

    // Countdown
    if (this.phase === "countdown") {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0) {
        this.phase = "playing";
      }
      // Still render during countdown
      if (this.renderer && this.canvas) {
        this.renderer.updateParticles(dt);
        this.renderer.render(
          this.arena,
          this.playerCar,
          this.playerConfig,
          this.bots,
          this.tokens,
          this.activeTokens,
          this.scoreState,
          createCamera(this.playerCar.x, this.playerCar.y),
          false,
        );
        this.drawCountdown(this.renderer);
      }
      return;
    }

    if (this.phase === "paused" || this.phase === "round-over") {
      // Still render (frozen state) but don't update physics
      if (this.renderer) {
        const cam = createCamera(this.playerCar.x, this.playerCar.y);
        this.renderer.render(
          this.arena,
          this.playerCar,
          this.playerConfig,
          this.bots,
          this.tokens,
          this.activeTokens,
          this.scoreState,
          cam,
          this.phase === "paused",
        );
        if (this.phase === "round-over") {
          this.drawRoundOver(this.renderer);
        }
      }
      return;
    }

    // ---- Playing ----

    // Poll input
    const rawInput = this.input.poll();

    // Handle pause
    if (rawInput.pause) {
      this.phase = "paused";
      return;
    }

    // Handle restart
    if (rawInput.restart) {
      this.resetGameState();
      return;
    }

    const carInput: CarInput = {
      throttle: rawInput.throttle,
      brake: rawInput.brake,
      steer: rawInput.steer,
      drift: rawInput.drift,
    };

    // Fixed timestep physics
    this.accumulator += dt;
    if (this.accumulator > MAX_ACCUMULATOR) {
      this.accumulator = MAX_ACCUMULATOR;
    }

    while (this.accumulator >= FIXED_DT) {
      this.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }

    // Apply input (we do this once per frame, not per physics step,
    // to keep controls responsive)
    updateCar(this.playerCar, carInput, this.playerConfig, FIXED_DT);

    // Render
    if (this.renderer) {
      this.renderer.updateParticles(dt);

      // Frame rate limiting for target FPS
      // We always render when rAF fires, but for 30 FPS we skip
      // every other visual frame. The renderer still gets called
      // because rAF might fire at 60 Hz. Simple approach: always render.
      // For ultra-low, the quality settings reduce GPU load instead.

      const cam = createCamera(this.playerCar.x, this.playerCar.y);
      updateCamera(cam, this.playerCar.x, this.playerCar.y);
      this.renderer.render(
        this.arena,
        this.playerCar,
        this.playerConfig,
        this.bots,
        this.tokens,
        this.activeTokens,
        this.scoreState,
        cam,
        false,
      );
    }
  };

  // ---- Update ----

  private update(dt: number): void {
    // Update scoring timers
    updateScoring(this.scoreState, dt);

    // Check round end
    if (!this.scoreState.roundActive) {
      this.phase = "round-over";
      return;
    }

    // Update drift chain
    updateDriftChain(this.scoreState, this.playerCar);

    // Update near miss cooldown
    if (this.nearMissCooldown > 0) {
      this.nearMissCooldown -= dt;
    }

    // Player collision with arena
    resolveWallCollision(
      this.playerCar,
      this.arena.bounds,
      this.playerConfig.collisionRadius,
    );
    const playerImpact = resolveObstacleCollisions(
      this.playerCar,
      this.arena.obstacles,
      this.playerConfig.collisionRadius,
    );
    if (playerImpact > 100 && this.renderer) {
      this.renderer.spawnSparks(this.playerCar.x, this.playerCar.y, 5);
    }

    // Update bots
    for (const bot of this.bots) {
      updateBot(bot, this.playerCar, this.arena, dt);
    }

    // Bot-bot collision
    for (let i = 0; i < this.bots.length; i++) {
      for (let j = i + 1; j < this.bots.length; j++) {
        resolveCarCarCollision(
          this.bots[i].car,
          this.bots[j].car,
          this.bots[i].config.collisionRadius,
        );
      }
    }

    // Player-bot collision
    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i];
      const collided = resolveCarCarCollision(
        this.playerCar,
        bot.car,
        this.playerConfig.collisionRadius,
      );

      if (collided) {
        const relSpeed = Math.hypot(
          this.playerCar.velocityX - bot.car.velocityX,
          this.playerCar.velocityY - bot.car.velocityY,
        );

        if (relSpeed > BOT_BUMP_SPEED) {
          bumpBot(this.scoreState);
          if (this.renderer) {
            const midX = (this.playerCar.x + bot.car.x) / 2;
            const midY = (this.playerCar.y + bot.car.y) / 2;
            this.renderer.spawnSparks(midX, midY, 10);
          }
        }
      }

      // Near miss detection
      if (this.nearMissCooldown <= 0) {
        const dist = Math.hypot(
          this.playerCar.x - bot.car.x,
          this.playerCar.y - bot.car.y,
        );
        const prevDist = this.lastBotDistances[i] ?? Infinity;
        // Near miss: was close but moving apart, within a threshold
        if (
          prevDist < 55 &&
          dist > prevDist &&
          dist < 70 &&
          prevDist > 30
        ) {
          this.scoreState.nearMisses++;
          this.nearMissCooldown = 1.0; // don't spam near misses
        }
        this.lastBotDistances[i] = dist;
      }
    }

    // Token collection
    this.checkTokenCollection();

    // Respawn tokens if below target
    this.respawnTokens();
  }

  // ---- Token Logic ----

  private checkTokenCollection(): void {
    for (const idx of this.activeTokens) {
      const token = this.tokens[idx];
      if (!token) continue;

      const dx = this.playerCar.x - token.x;
      const dy = this.playerCar.y - token.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < TOKEN_COLLECT_RADIUS) {
        this.activeTokens.delete(idx);
        collectToken(this.scoreState);

        // Spawn a small particle burst
        if (this.renderer) {
          this.renderer.spawnSparks(token.x, token.y, 8);
        }
      }
    }
  }

  private respawnTokens(): void {
    while (this.activeTokens.size < TOKEN_COUNT) {
      // Pick a random spawn point not already active
      const available: number[] = [];
      for (let i = 0; i < this.tokens.length; i++) {
        if (!this.activeTokens.has(i)) {
          available.push(i);
        }
      }
      if (available.length === 0) break;

      const idx = available[Math.floor(Math.random() * available.length)];
      this.activeTokens.add(idx);
    }
  }

  // ---- State Reset ----

  private resetGameState(): void {
    // Player
    this.playerCar = createCarState(
      this.arena.playerSpawn.x,
      this.arena.playerSpawn.y,
    );

    // Bots
    const botTypes: BotType[] = ["wander", "chaser", "bumper"];
    this.bots = this.arena.botSpawns.map((spawn, i) =>
      createBot(spawn.x, spawn.y, botTypes[i] ?? "wander"),
    );

    // Tokens
    this.tokens = [...this.arena.tokenSpawns];
    this.activeTokens.clear();
    // Activate initial set
    while (this.activeTokens.size < TOKEN_COUNT) {
      const idx = Math.floor(Math.random() * this.tokens.length);
      this.activeTokens.add(idx);
    }

    // Scoring
    this.scoreState = createScoreState(ROUND_DURATION);

    // Loop
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.phase = "countdown";
    this.countdownTimer = 3;

    // Tracking
    this.lastBotDistances = this.bots.map(() => Infinity);
    this.nearMissCooldown = 0;
  }

  // ---- Countdown & Round Over rendering ----

  private drawCountdown(renderer: Renderer): void {
    const ctx = (renderer as any).ctx as CanvasRenderingContext2D;
    if (!ctx) return;

    const w = renderer.getWidth();
    const h = renderer.getHeight();

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, w, h);

    const sec = Math.ceil(this.countdownTimer);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(sec > 0 ? `${sec}` : "GO!", w / 2, h / 2);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  private drawRoundOver(renderer: Renderer): void {
    const ctx = (renderer as any).ctx as CanvasRenderingContext2D;
    if (!ctx) return;

    const w = renderer.getWidth();
    const h = renderer.getHeight();
    const finalScore = getFinalScore(this.scoreState);

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Time's Up!", w / 2, h / 2 - 60);

    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.fillStyle = "#4ecca3";
    ctx.fillText(`Score: ${finalScore}`, w / 2, h / 2);

    ctx.font = "16px system-ui, sans-serif";
    ctx.fillStyle = "#aaa";
    const details = [
      `Tokens: ${this.scoreState.tokensCollected}`,
      `Bot Bumps: ${this.scoreState.botsBumped}`,
      `Max Drift Chain: x${this.scoreState.maxDriftChain.toFixed(1)}`,
      `Near Misses: ${this.scoreState.nearMisses}`,
    ];
    for (let i = 0; i < details.length; i++) {
      ctx.fillText(details[i], w / 2, h / 2 + 40 + i * 24);
    }

    ctx.fillStyle = "#e94560";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.fillText("Press R to restart", w / 2, h / 2 + 150);
    ctx.fillText("Press Esc for menu", w / 2, h / 2 + 176);

    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  /** Handle window resize. Call from outside. */
  handleResize(): void {
    this.renderer?.resize();
  }
}
