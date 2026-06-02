/**
 * Tiny Drift Karts - top-down lap racing game.
 *
 * This module stays inside the existing lazy-loaded car-arena route, but the
 * gameplay is a full checkpoint racer instead of the old score arena.
 */

import { playSfx } from "../../app/audio-manager.js";
import { saveScore } from "../../settings/scores-store.js";
import type { QualityMode } from "../../shared/game-types.js";
import { InputManager } from "./input/input-manager.js";

type Vec = { x: number; y: number };
type Phase = "menu" | "countdown" | "racing" | "paused" | "results";
type DifficultyId = "easy" | "medium" | "hard";
type KartId = "balanced" | "speedster" | "drifter" | "heavy";
type CourseId = "oval" | "drift" | "technical" | "snow";

interface Gate {
  left: Vec;
  right: Vec;
  mid: Vec;
  normal: Vec;
  label: string;
  finish: boolean;
}

interface Course {
  id: CourseId;
  name: string;
  theme: "grass" | "desert" | "snow";
  laps: number;
  roadWidth: number;
  points: Vec[];
  gates: Gate[];
  props: Vec[];
}

interface KartSpec {
  id: KartId;
  name: string;
  color: string;
  maxSpeed: number;
  acceleration: number;
  handling: number;
  steerResponse: number;
  grip: number;
  driftGrip: number;
  driftBoost: number;
  mass: number;
  grassResistance: number;
}

interface DifficultySpec {
  id: DifficultyId;
  name: string;
  botSpeed: number;
  botSkill: number;
  mistake: number;
}

interface Racer {
  id: string;
  name: string;
  bot: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  angle: number;
  steer: number;
  drift: boolean;
  driftCharge: number;
  boostTimer: number;
  slipstreamTimer: number;
  slipstreamPower: number;
  lap: number;
  nextGate: number;
  gateCooldown: number;
  finishTime: number | null;
  raceTime: number;
  color: string;
  kart: KartSpec;
  aiSkill: number;
  aiSpeed: number;
  aiOffset: number;
  stuckTimer: number;
  lastX: number;
  lastY: number;
}

interface Button {
  id: string;
  text: string;
  rect: { x: number; y: number; w: number; h: number };
}

const FIXED_DT = 1 / 60;
const MAX_ACCUMULATOR = 0.12;
const RACER_RADIUS = 18;
const WORLD_W = 1600;
const WORLD_H = 1050;

const DIFFICULTIES: DifficultySpec[] = [
  { id: "easy", name: "Easy", botSpeed: 0.9, botSkill: 0.78, mistake: 0.12 },
  { id: "medium", name: "Medium", botSpeed: 1.0, botSkill: 0.9, mistake: 0.06 },
  { id: "hard", name: "Hard", botSpeed: 1.07, botSkill: 0.98, mistake: 0.025 },
];

const KARTS: KartSpec[] = [
  {
    id: "balanced",
    name: "Balanced",
    color: "#1fb6ff",
    maxSpeed: 284,
    acceleration: 485,
    handling: 2.75,
    steerResponse: 5.6,
    grip: 0.9,
    driftGrip: 0.52,
    driftBoost: 120,
    mass: 1,
    grassResistance: 0.62,
  },
  {
    id: "speedster",
    name: "Speedster",
    color: "#ff4d6d",
    maxSpeed: 322,
    acceleration: 466,
    handling: 2.35,
    steerResponse: 5.2,
    grip: 0.84,
    driftGrip: 0.48,
    driftBoost: 105,
    mass: 0.92,
    grassResistance: 0.57,
  },
  {
    id: "drifter",
    name: "Drifter",
    color: "#b76cff",
    maxSpeed: 276,
    acceleration: 500,
    handling: 3.0,
    steerResponse: 6.2,
    grip: 0.87,
    driftGrip: 0.38,
    driftBoost: 155,
    mass: 0.95,
    grassResistance: 0.62,
  },
  {
    id: "heavy",
    name: "Heavy",
    color: "#ffc542",
    maxSpeed: 268,
    acceleration: 425,
    handling: 2.05,
    steerResponse: 4.8,
    grip: 0.94,
    driftGrip: 0.6,
    driftBoost: 110,
    mass: 1.35,
    grassResistance: 0.73,
  },
];

const BOT_KARTS = [KARTS[0], KARTS[1], KARTS[2]];
const BOT_NAMES = ["Mika", "Bolt", "Jun"];
const BOT_COLORS = ["#ff7a1a", "#30d158", "#ffcc00"];

export class CarGame {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private input = new InputManager();
  private quality: QualityMode;
  private dpr = 1;
  private rafId = 0;
  private running = false;
  private lastTime = 0;
  private accumulator = 0;
  private phase: Phase = "menu";
  private countdown = 3;
  private selectedCourse = 0;
  private selectedDifficulty = 1;
  private selectedKart = 0;
  private course = createCourse("oval");
  private racers: Racer[] = [];
  private raceTime = 0;
  private buttons: Button[] = [];
  private pointerDown = this.handlePointerDown.bind(this);
  private scoreSaved = false;
  private exitToMenu: (() => void) | null = null;

  constructor(qualityMode: QualityMode, exitToMenu?: () => void) {
    this.quality = qualityMode;
    this.exitToMenu = exitToMenu ?? null;
  }

  start(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.input.attach(canvas);
    canvas.addEventListener("pointerdown", this.pointerDown);
    canvas.style.touchAction = "none";
    this.resize();
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.input.detach();
    if (this.canvas) {
      this.canvas.removeEventListener("pointerdown", this.pointerDown);
      this.canvas.style.touchAction = "";
    }
    this.canvas = null;
    this.ctx = null;
  }

  handleResize(): void {
    this.resize();
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.2) dt = 0.016;
    this.resize();

    const input = this.input.poll();
    if (input.restart && this.phase !== "menu") this.startRace();
    if (input.pause && (this.phase === "racing" || this.phase === "paused")) {
      this.phase = this.phase === "paused" ? "racing" : "paused";
    }

    if (this.phase === "countdown") {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.phase = "racing";
        playSfx("success");
      }
    } else if (this.phase === "racing") {
      this.accumulator = Math.min(MAX_ACCUMULATOR, this.accumulator + dt);
      while (this.accumulator >= FIXED_DT) {
        this.updateRace(FIXED_DT, input.steer, input.drift);
        this.accumulator -= FIXED_DT;
      }
    }

    this.render();
  };

  private startRace(): void {
    this.course = createCourse(COURSES[this.selectedCourse].id);
    const difficulty = DIFFICULTIES[this.selectedDifficulty];
    const playerKart = KARTS[this.selectedKart];
    this.racers = [];
    this.raceTime = 0;
    this.scoreSaved = false;

    const start = this.course.gates[0];
    const firstSegment = normalize({
      x: this.course.points[1].x - this.course.points[0].x,
      y: this.course.points[1].y - this.course.points[0].y,
    });
    const grid = [-60, -20, 20, 60];
    const forward = 64;
    const makeRacer = (
      id: string,
      name: string,
      bot: boolean,
      color: string,
      kart: KartSpec,
      gridOffset: number,
      row: number,
    ): Racer => ({
      id,
      name,
      bot,
      x: start.mid.x + firstSegment.x * (forward + row * 38) + start.normal.x * gridOffset,
      y: start.mid.y + firstSegment.y * (forward + row * 38) + start.normal.y * gridOffset,
      prevX: start.mid.x + firstSegment.x * (forward + row * 38) + start.normal.x * gridOffset,
      prevY: start.mid.y + firstSegment.y * (forward + row * 38) + start.normal.y * gridOffset,
      vx: 0,
      vy: 0,
      angle: Math.atan2(firstSegment.y, firstSegment.x),
      steer: 0,
      drift: false,
      driftCharge: 0,
      boostTimer: 0,
      slipstreamTimer: 0,
      slipstreamPower: 0,
      lap: 1,
      nextGate: 1,
      gateCooldown: 0,
      finishTime: null,
      raceTime: 0,
      color,
      kart,
      aiSkill: difficulty.botSkill,
      aiSpeed: difficulty.botSpeed,
      aiOffset: bot ? (Math.random() - 0.5) * this.course.roadWidth * 0.34 : 0,
      stuckTimer: 0,
      lastX: start.mid.x + firstSegment.x * (forward + row * 38) + start.normal.x * gridOffset,
      lastY: start.mid.y + firstSegment.y * (forward + row * 38) + start.normal.y * gridOffset,
    });

    this.racers.push(makeRacer("player", "You", false, playerKart.color, playerKart, grid[0], 0));
    for (let i = 0; i < 3; i++) {
      const bot = makeRacer(`bot-${i}`, BOT_NAMES[i], true, BOT_COLORS[i], BOT_KARTS[i], grid[i + 1], 0);
      bot.aiSkill = Math.max(0.65, difficulty.botSkill - i * 0.04);
      bot.aiSpeed = difficulty.botSpeed + (i - 1) * 0.018;
      this.racers.push(bot);
    }

    this.phase = "countdown";
    this.countdown = 3.2;
    this.accumulator = 0;
    this.lastTime = performance.now();
  }

  private updateRace(dt: number, playerSteer: number, playerDrift: boolean): void {
    this.raceTime += dt;
    for (const racer of this.racers) {
      if (racer.finishTime !== null) continue;
      racer.prevX = racer.x;
      racer.prevY = racer.y;
      racer.raceTime += dt;
      racer.gateCooldown = Math.max(0, racer.gateCooldown - dt);

      if (racer.bot) this.updateBotInput(racer, dt);
      else {
        const response = 1 - Math.exp(-racer.kart.steerResponse * dt);
        racer.steer += (playerSteer - racer.steer) * response;
        racer.drift = playerDrift && Math.abs(playerSteer) > 0.18;
      }

      this.updateRacerPhysics(racer, dt);
      if (racer.bot) this.updateBotRecovery(racer, dt);
      this.checkGateProgress(racer);
    }

    this.applySlipstream(dt);
    this.resolveKartCollisions();
    if (this.racers.every((r) => r.finishTime !== null)) {
      this.finishRace();
    }
  }

  private updateBotInput(racer: Racer, dt: number): void {
    const speed = Math.hypot(racer.vx, racer.vy);
    const target = lookAheadOnCourse(this.course, racer.x, racer.y, 120 + speed * 0.28, racer.aiOffset);
    const desired = Math.atan2(target.y - racer.y, target.x - racer.x);
    let diff = angleDiff(desired, racer.angle);
    diff += Math.sin(this.raceTime * 0.8 + racer.aiOffset) * (1 - racer.aiSkill) * 0.14;
    racer.steer = clamp(diff / 1.02, -0.78, 0.78);
    racer.drift = Math.abs(diff) > 0.72 && speed > 165 && racer.aiSkill > 0.72 && racer.stuckTimer < 0.8;
    if (racer.drift && Math.random() < (1 - racer.aiSkill) * dt * 1.8) {
      racer.drift = false;
    }
  }

  private updateBotRecovery(racer: Racer, dt: number): void {
    const moved = Math.hypot(racer.x - racer.lastX, racer.y - racer.lastY);
    const speed = Math.hypot(racer.vx, racer.vy);
    const offroad = !isOnRoad(this.course, racer.x, racer.y, 8);
    if (moved < 2.2 || (offroad && speed < 80)) {
      racer.stuckTimer += dt;
    } else {
      racer.stuckTimer = Math.max(0, racer.stuckTimer - dt * 1.7);
    }
    racer.lastX = racer.x;
    racer.lastY = racer.y;

    if (racer.stuckTimer > 0.75) {
      const gate = this.course.gates[racer.nextGate];
      const desired = Math.atan2(gate.mid.y - racer.y, gate.mid.x - racer.x);
      racer.angle += clamp(angleDiff(desired, racer.angle), -1, 1) * dt * 2.4;
      racer.vx *= 0.88;
      racer.vy *= 0.88;
    }

    if (racer.stuckTimer > 2.4) {
      const recovered = nearestPointOnCourse(this.course, racer.x, racer.y);
      racer.x = recovered.point.x + recovered.normal.x * racer.aiOffset * 0.45;
      racer.y = recovered.point.y + recovered.normal.y * racer.aiOffset * 0.45;
      racer.angle = Math.atan2(recovered.tangent.y, recovered.tangent.x);
      racer.vx = recovered.tangent.x * 90;
      racer.vy = recovered.tangent.y * 90;
      racer.stuckTimer = 0;
    }
  }

  private updateRacerPhysics(racer: Racer, dt: number): void {
    const kart = racer.kart;
    const speed = Math.hypot(racer.vx, racer.vy);
    const forward = { x: Math.cos(racer.angle), y: Math.sin(racer.angle) };
    const forwardSpeed = racer.vx * forward.x + racer.vy * forward.y;
    const speedRatio = clamp(speed / kart.maxSpeed, 0.25, 1.15);
    const offroad = !isOnRoad(this.course, racer.x, racer.y);
    const botScale = racer.bot ? racer.aiSpeed : 1;

    const offroadAccelScale = offroad ? 0.72 + (kart.grassResistance - 0.5) * 0.35 : 1;
    const turnScale = racer.drift ? 1.08 : 0.78;
    racer.angle += racer.steer * kart.handling * speedRatio * dt * turnScale;
    racer.vx += forward.x * kart.acceleration * botScale * offroadAccelScale * dt;
    racer.vy += forward.y * kart.acceleration * botScale * offroadAccelScale * dt;

    const lateral = {
      x: racer.vx - forward.x * forwardSpeed,
      y: racer.vy - forward.y * forwardSpeed,
    };
    const grip = racer.drift ? kart.driftGrip : kart.grip;
    racer.vx = forward.x * forwardSpeed + lateral.x * (1 - grip * dt * 6.8);
    racer.vy = forward.y * forwardSpeed + lateral.y * (1 - grip * dt * 6.8);

    if (racer.drift && Math.abs(racer.steer) > 0.22 && speed > 135) {
      racer.driftCharge = Math.min(1.2, racer.driftCharge + dt);
    } else if (racer.driftCharge > 0) {
      if (racer.driftCharge > 0.45 && speed > 135) {
        racer.boostTimer = Math.min(0.65, 0.24 + racer.driftCharge * 0.22);
        const boost = kart.driftBoost * clamp(racer.driftCharge, 0, 1);
        racer.vx += forward.x * boost;
        racer.vy += forward.y * boost;
        if (!racer.bot) playSfx("drift");
      }
      racer.driftCharge = 0;
    }

    if (racer.boostTimer > 0) racer.boostTimer -= dt;
    const boostCap = racer.boostTimer > 0 ? 1.13 : 1;
    if (racer.slipstreamPower > 0.05 && !offroad) {
      const draftPush = 18 * racer.slipstreamPower;
      racer.vx += forward.x * draftPush * dt;
      racer.vy += forward.y * draftPush * dt;
    }
    const draftCap = 1 + racer.slipstreamPower * 0.035;
    const roadCap = offroad ? kart.grassResistance : 1;
    const cap = kart.maxSpeed * botScale * boostCap * draftCap * roadCap;
    const afterSpeed = Math.hypot(racer.vx, racer.vy);
    if (afterSpeed > cap) {
      const scale = cap / afterSpeed;
      racer.vx *= scale;
      racer.vy *= scale;
    }

    const damping = offroad ? 0.938 : 0.988;
    racer.vx *= damping;
    racer.vy *= damping;
    racer.x += racer.vx * dt;
    racer.y += racer.vy * dt;
    racer.x = clamp(racer.x, 20, WORLD_W - 20);
    racer.y = clamp(racer.y, 20, WORLD_H - 20);
  }

  private checkGateProgress(racer: Racer): void {
    if (racer.gateCooldown > 0) return;
    const gate = this.course.gates[racer.nextGate];
    const crossed = segmentsIntersect(
      { x: racer.prevX, y: racer.prevY },
      { x: racer.x, y: racer.y },
      gate.left,
      gate.right,
    ) || distanceToSegment({ x: racer.x, y: racer.y }, gate.left, gate.right) < RACER_RADIUS;
    if (!crossed) return;

    racer.gateCooldown = 0.35;
    if (gate.finish) {
      if (racer.lap >= this.course.laps) {
        racer.finishTime = racer.raceTime;
        if (!racer.bot) playSfx("success");
      } else {
        racer.lap += 1;
        racer.nextGate = 1;
      }
    } else {
      racer.nextGate = racer.nextGate >= this.course.gates.length - 1 ? 0 : racer.nextGate + 1;
    }
  }

  private applySlipstream(dt: number): void {
    for (const follower of this.racers) {
      let bestDraft = 0;
      if (follower.finishTime !== null) continue;
      for (const leader of this.racers) {
        if (leader === follower || leader.finishTime !== null) continue;
        if (!isOnRoad(this.course, follower.x, follower.y) || !isOnRoad(this.course, leader.x, leader.y)) continue;
        const leaderForward = { x: Math.cos(leader.angle), y: Math.sin(leader.angle) };
        const dx = leader.x - follower.x;
        const dy = leader.y - follower.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 220 && dist > 42) {
          const behindLeader = (dx * leaderForward.x + dy * leaderForward.y) / dist;
          const side = Math.abs(dx * -leaderForward.y + dy * leaderForward.x);
          const sameDirection = Math.cos(angleDiff(leader.angle, follower.angle));
          if (behindLeader > 0.65 && side < 52 && sameDirection > 0.55) {
            const distanceFactor = 1 - clamp((dist - 55) / 165, 0, 1);
            const sideFactor = 1 - clamp(side / 52, 0, 1);
            bestDraft = Math.max(bestDraft, distanceFactor * sideFactor * sameDirection);
          }
        }
      }
      const response = bestDraft > follower.slipstreamPower ? 2.4 : 1.3;
      follower.slipstreamPower += (bestDraft - follower.slipstreamPower) * (1 - Math.exp(-response * dt));
      follower.slipstreamTimer = follower.slipstreamPower;
    }
  }

  private resolveKartCollisions(): void {
    for (let i = 0; i < this.racers.length; i++) {
      for (let j = i + 1; j < this.racers.length; j++) {
        const a = this.racers[i];
        const b = this.racers[j];
        if (a.finishTime !== null || b.finishTime !== null) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const min = RACER_RADIUS * 2;
        if (dist >= min) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        const push = (min - dist) * 0.5;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          const impulse = (-rel * 0.42) / ((1 / a.kart.mass) + (1 / b.kart.mass));
          a.vx -= (impulse / a.kart.mass) * nx;
          a.vy -= (impulse / a.kart.mass) * ny;
          b.vx += (impulse / b.kart.mass) * nx;
          b.vy += (impulse / b.kart.mass) * ny;
        }
      }
    }
  }

  private finishRace(): void {
    this.phase = "results";
    if (!this.scoreSaved) {
      const player = this.racers[0];
      const placement = this.getStandings().findIndex((r) => r.id === "player") + 1;
      const score = Math.max(100, Math.round(120000 - (player.finishTime ?? player.raceTime) * 1000 - placement * 5000));
      saveScore("car-arena", score, `${placementText(placement)} - ${formatTime(player.finishTime ?? player.raceTime)}`);
      this.scoreSaved = true;
    }
  }

  private getStandings(): Racer[] {
    return [...this.racers].sort((a, b) => {
      if (a.finishTime !== null && b.finishTime !== null) return a.finishTime - b.finishTime;
      if (a.finishTime !== null) return -1;
      if (b.finishTime !== null) return 1;
      if (a.lap !== b.lap) return b.lap - a.lap;
      if (a.nextGate !== b.nextGate) return b.nextGate - a.nextGate;
      const ag = this.course.gates[a.nextGate];
      const bg = this.course.gates[b.nextGate];
      return distanceToSegment({ x: a.x, y: a.y }, ag.left, ag.right) - distanceToSegment({ x: b.x, y: b.y }, bg.left, bg.right);
    });
  }

  private resize(): void {
    if (!this.canvas?.parentElement || !this.ctx) return;
    const width = this.canvas.parentElement.clientWidth;
    const height = this.canvas.parentElement.clientHeight;
    const maxDpr = this.quality === "ultra-low" ? 1.4 : 2;
    this.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const nextW = Math.max(1, Math.floor(width * this.dpr));
    const nextH = Math.max(1, Math.floor(height * this.dpr));
    if (this.canvas.width !== nextW || this.canvas.height !== nextH) {
      this.canvas.width = nextW;
      this.canvas.height = nextH;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  }

  private render(): void {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    ctx.clearRect(0, 0, w, h);
    if (this.phase === "menu") this.drawMenu(ctx, w, h);
    else {
      this.drawRace(ctx, w, h);
      if (this.phase === "countdown") this.drawCountdown(ctx, w, h);
      if (this.phase === "paused") this.drawPauseMenu(ctx, w, h);
      if (this.phase === "results") this.drawResults(ctx, w, h);
    }
  }

  private drawMenu(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.buttons = [];
    drawBackground(ctx, w, h, "grass");
    drawMenuTrackPreview(ctx, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    roundRect(ctx, Math.max(24, w / 2 - 470), 28, Math.min(940, w - 48), h - 56, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(33,53,71,0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#213547";
    ctx.textAlign = "center";
    ctx.font = "900 46px system-ui, sans-serif";
    ctx.fillText("Tiny Drift Karts", w / 2, 72);
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillStyle = "rgba(33,53,71,0.78)";
    ctx.fillText("Auto-accelerate racing. Steer, drift, and outsmart three bots.", w / 2, 102);

    const colW = Math.min(280, (w - 80) / 3);
    const startX = w / 2 - colW * 1.5 - 16;
    this.drawChoiceColumn(ctx, "Course", COURSES.map((c) => c.name), this.selectedCourse, startX, 140, colW, "course");
    this.drawChoiceColumn(ctx, "Difficulty", DIFFICULTIES.map((d) => d.name), this.selectedDifficulty, startX + colW + 16, 140, colW, "difficulty");
    this.drawChoiceColumn(ctx, "Kart", KARTS.map((k) => k.name), this.selectedKart, startX + (colW + 16) * 2, 140, colW, "kart");
    this.addButton(ctx, "back", "Back to Games", w / 2 - 250, h - 92, 190, 54, false);
    this.addButton(ctx, "start", "Start Race", w / 2 - 35, h - 92, 250, 54, true);

    ctx.fillStyle = "rgba(33,53,71,0.78)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText("Keyboard: A/Left and D/Right steer, Space/Shift drift. Touch: bottom-left joystick, bottom-right drift.", w / 2, h - 22);
  }

  private drawChoiceColumn(ctx: CanvasRenderingContext2D, title: string, options: string[], selected: number, x: number, y: number, width: number, id: string): void {
    ctx.textAlign = "left";
    ctx.font = "800 18px system-ui, sans-serif";
    ctx.fillStyle = "#213547";
    ctx.fillText(title, x, y);
    for (let i = 0; i < options.length; i++) {
      this.addButton(ctx, `${id}:${i}`, options[i], x, y + 22 + i * 48, width, 38, i === selected);
    }
  }

  private addButton(ctx: CanvasRenderingContext2D, id: string, text: string, x: number, y: number, w: number, h: number, selected: boolean): void {
    this.buttons.push({ id, text, rect: { x, y, w, h } });
    ctx.shadowColor = "rgba(15,23,42,0.14)";
    ctx.shadowBlur = selected ? 14 : 6;
    ctx.shadowOffsetY = selected ? 5 : 2;
    ctx.fillStyle = selected ? "#ffd447" : "rgba(255,255,255,0.92)";
    ctx.strokeStyle = selected ? "#213547" : "rgba(33,53,71,0.18)";
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.stroke();
    if (selected) {
      ctx.fillStyle = "rgba(255,255,255,0.36)";
      roundRect(ctx, x + 4, y + 4, w - 8, h * 0.34, 5);
      ctx.fill();
    }
    ctx.fillStyle = "#213547";
    ctx.font = "700 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + w / 2, y + h / 2);
    ctx.textBaseline = "alphabetic";
  }

  private drawRace(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.buttons = [];
    const scale = Math.min(w / WORLD_W, (h - 88) / WORLD_H);
    const ox = (w - WORLD_W * scale) / 2;
    const oy = 64 + (h - 88 - WORLD_H * scale) / 2;
    drawBackground(ctx, w, h, this.course.theme);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    this.drawWorldFrame(ctx);
    this.drawTrack(ctx);
    this.drawProps(ctx);
    this.drawGates(ctx);
    for (const racer of this.getStandings().reverse()) this.drawKart(ctx, racer);
    ctx.restore();
    this.drawHud(ctx, w, h);
    this.drawTouchControls(ctx, w, h);
  }

  private drawTrack(ctx: CanvasRenderingContext2D): void {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "rgba(15,23,42,0.18)";
    ctx.lineWidth = this.course.roadWidth + 42;
    ctx.save();
    ctx.translate(8, 12);
    drawClosedPath(ctx, this.course.points);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = getCurbDark(this.course.theme);
    ctx.lineWidth = this.course.roadWidth + 34;
    drawClosedPath(ctx, this.course.points);
    ctx.stroke();

    ctx.strokeStyle = getCurbLight(this.course.theme);
    ctx.lineWidth = this.course.roadWidth + 24;
    ctx.setLineDash([32, 28]);
    drawClosedPath(ctx, this.course.points);
    ctx.stroke();
    ctx.setLineDash([]);

    const roadGradient = ctx.createLinearGradient(0, 170, 0, 900);
    roadGradient.addColorStop(0, this.course.theme === "snow" ? "#718091" : "#626b76");
    roadGradient.addColorStop(1, this.course.theme === "snow" ? "#4d6477" : "#3f4650");
    ctx.strokeStyle = roadGradient;
    ctx.lineWidth = this.course.roadWidth;
    drawClosedPath(ctx, this.course.points);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = this.course.roadWidth - 28;
    drawClosedPath(ctx, this.course.points);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 3;
    ctx.setLineDash([24, 36]);
    drawClosedPath(ctx, this.course.points);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawWorldFrame(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    roundRect(ctx, 34, 34, WORLD_W - 68, WORLD_H - 68, 34);
    ctx.fill();
    ctx.strokeStyle = "rgba(33,53,71,0.16)";
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  private drawGates(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.course.gates.length; i++) {
      const gate = this.course.gates[i];
      if (!gate.finish) {
        ctx.fillStyle = "rgba(14,165,233,0.18)";
        drawGatePanel(ctx, gate, 16);
        ctx.fill();
      }
      ctx.lineWidth = gate.finish ? 14 : 8;
      ctx.strokeStyle = gate.finish ? "#111827" : "rgba(14,165,233,0.85)";
      ctx.beginPath();
      ctx.moveTo(gate.left.x, gate.left.y);
      ctx.lineTo(gate.right.x, gate.right.y);
      ctx.stroke();
      drawGatePost(ctx, gate.left, gate.finish);
      drawGatePost(ctx, gate.right, gate.finish);
      if (gate.finish) {
        const steps = 12;
        for (let row = -1; row <= 1; row++) {
          for (let s = 0; s < steps; s++) {
            ctx.strokeStyle = (s + row + 4) % 2 === 0 ? "#ffffff" : "#111827";
            ctx.lineWidth = 5;
            const t0 = s / steps;
            const t1 = (s + 1) / steps;
            ctx.beginPath();
            ctx.moveTo(lerp(gate.left.x, gate.right.x, t0) + gate.normal.x * row * 7, lerp(gate.left.y, gate.right.y, t0) + gate.normal.y * row * 7);
            ctx.lineTo(lerp(gate.left.x, gate.right.x, t1) + gate.normal.x * row * 7, lerp(gate.left.y, gate.right.y, t1) + gate.normal.y * row * 7);
            ctx.stroke();
          }
        }
      } else if (this.quality !== "ultra-low") {
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 22px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(gate.label, gate.mid.x, gate.mid.y);
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "start";
      }
    }
  }

  private drawProps(ctx: CanvasRenderingContext2D): void {
    if (this.quality === "ultra-low") return;
    for (const prop of this.course.props) {
      drawProp(ctx, prop, this.course.theme);
    }
  }

  private drawKart(ctx: CanvasRenderingContext2D, racer: Racer): void {
    ctx.save();
    ctx.globalAlpha = racer.finishTime === null ? 1 : 0.45;
    ctx.translate(racer.x + 7, racer.y + 10);
    ctx.rotate(racer.angle);
    ctx.fillStyle = "rgba(15,23,42,0.22)";
    roundRect(ctx, -24, -15, 48, 30, 9);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = racer.finishTime === null ? 1 : 0.45;
    ctx.translate(racer.x, racer.y);
    ctx.rotate(racer.angle);
    if (racer.slipstreamPower > 0.12) {
      ctx.strokeStyle = `rgba(255,255,255,${0.22 + racer.slipstreamPower * 0.36})`;
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-36 - i * 13, -11 + i * 11);
        ctx.lineTo(-58 - i * 13 - racer.slipstreamPower * 18, -11 + i * 11);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-17, -15);
    ctx.lineTo(17, -15);
    ctx.moveTo(-17, 15);
    ctx.lineTo(17, 15);
    ctx.stroke();
    ctx.fillStyle = "#151922";
    roundRect(ctx, -23, -20, 13, 10, 4);
    ctx.fill();
    roundRect(ctx, 10, -20, 13, 10, 4);
    ctx.fill();
    roundRect(ctx, -23, 10, 13, 10, 4);
    ctx.fill();
    roundRect(ctx, 10, 10, 13, 10, 4);
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-23, -18, 13, 6);
    ctx.strokeRect(10, -18, 13, 6);
    ctx.strokeRect(-23, 12, 13, 6);
    ctx.strokeRect(10, 12, 13, 6);

    ctx.fillStyle = "#2b3442";
    roundRect(ctx, -26, -9, 16, 18, 4);
    ctx.fill();
    ctx.fillStyle = "#111827";
    roundRect(ctx, -30, -7, 7, 14, 3);
    ctx.fill();
    ctx.fillStyle = racer.color;
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 3;
    roundRect(ctx, -19, -14, 40, 28, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = racer.color;
    ctx.beginPath();
    ctx.moveTo(20, -11);
    ctx.lineTo(32, -5);
    ctx.lineTo(32, 5);
    ctx.lineTo(20, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1f2937";
    roundRect(ctx, -18, -4, 8, 8, 3);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.26)";
    roundRect(ctx, -12, -10, 28, 7, 4);
    ctx.fill();
    ctx.fillStyle = "#f8fafc";
    roundRect(ctx, 2, -9, 14, 18, 5);
    ctx.fill();
    ctx.fillStyle = racer.bot ? "#334155" : "#0f172a";
    ctx.beginPath();
    ctx.arc(-5, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(4, 0, 5, -0.7, 0.7);
    ctx.stroke();
    ctx.fillStyle = "#fff7ad";
    ctx.fillRect(28, -7, 5, 5);
    ctx.fillRect(28, 2, 5, 5);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(-21, -8, 4, 5);
    ctx.fillRect(-21, 3, 4, 5);
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
    const player = this.racers[0];
    const place = this.getStandings().findIndex((r) => r.id === "player") + 1;
    const grad = ctx.createLinearGradient(0, 0, 0, 58);
    grad.addColorStop(0, "rgba(15,23,42,0.94)");
    grad.addColorStop(1, "rgba(30,41,59,0.82)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, 58);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(0, 56, w, 2);
    ctx.fillStyle = "#fff";
    ctx.font = "800 15px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(`Lap ${Math.min(player.lap, this.course.laps)}/${this.course.laps}`, 16, 29);
    ctx.fillText(`Gate ${player.nextGate === 0 ? "Finish" : `${player.nextGate}/${this.course.gates.length - 1}`}`, 118, 29);
    ctx.fillStyle = "#ffd447";
    ctx.fillText(`${placementText(place)}`, 250, 29);
    ctx.fillStyle = "#fff";
    ctx.fillText(`${this.course.name} | ${DIFFICULTIES[this.selectedDifficulty].name} | ${player.kart.name}`, 330, 29);
    ctx.textAlign = "right";
    ctx.fillText(formatTime(this.raceTime), w - 16, 27);
    ctx.textAlign = "start";

    if (player.driftCharge > 0 || player.boostTimer > 0) {
      ctx.fillStyle = "rgba(15,23,42,0.34)";
      roundRect(ctx, w - 184, 64, 158, 14, 7);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      roundRect(ctx, w - 180, 67, 150, 8, 4);
      ctx.fill();
      ctx.fillStyle = player.boostTimer > 0 ? "#30d158" : "#b76cff";
      roundRect(ctx, w - 180, 67, 150 * clamp(player.driftCharge, 0, 1), 8, 4);
      ctx.fill();
    }
  }

  private drawTouchControls(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = "rgba(15,23,42,0.28)";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(84, h - 86, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w - 86, h - 86, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DRIFT", w - 86, h - 82);
    ctx.textAlign = "start";
    ctx.globalAlpha = 1;
  }

  private drawCountdown(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const label = this.countdown <= 1 ? "GO!" : `${Math.ceil(this.countdown - 1)}`;
    this.drawOverlay(ctx, w, h, label, "Race clean. Drift through corners.");
  }

  private drawPauseMenu(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.buttons = [];
    ctx.fillStyle = "rgba(15,23,42,0.68)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    roundRect(ctx, w / 2 - 180, h / 2 - 150, 360, 260, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(33,53,71,0.16)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#213547";
    ctx.textAlign = "center";
    ctx.font = "900 34px system-ui, sans-serif";
    ctx.fillText("Paused", w / 2, h / 2 - 96);
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "rgba(33,53,71,0.72)";
    ctx.fillText("Take a breath, then send it into the next corner.", w / 2, h / 2 - 66);
    this.addButton(ctx, "resume", "Resume", w / 2 - 125, h / 2 - 34, 250, 42, true);
    this.addButton(ctx, "restart", "Restart Race", w / 2 - 125, h / 2 + 18, 250, 42, false);
    this.addButton(ctx, "menu", "Main Menu", w / 2 - 125, h / 2 + 70, 250, 42, false);
  }

  private drawResults(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.buttons = [];
    ctx.fillStyle = "rgba(15,23,42,0.76)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "800 34px system-ui, sans-serif";
    ctx.fillText("Race Results", w / 2, 105);
    const standings = this.getStandings();
    ctx.font = "700 18px system-ui, sans-serif";
    for (let i = 0; i < standings.length; i++) {
      const r = standings[i];
      ctx.fillStyle = r.id === "player" ? "#ffcc00" : "#ffffff";
      ctx.fillText(`${i + 1}. ${r.name} - ${formatTime(r.finishTime ?? r.raceTime)}`, w / 2, 160 + i * 34);
    }
    this.addButton(ctx, "restart", "Restart", w / 2 - 180, h - 110, 150, 48, true);
    this.addButton(ctx, "menu", "Menu", w / 2 + 30, h - 110, 150, 48, false);
  }

  private drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, title: string, subtitle: string): void {
    ctx.fillStyle = "rgba(15,23,42,0.58)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 58px system-ui, sans-serif";
    ctx.fillText(title, w / 2, h / 2 - 18);
    ctx.font = "700 17px system-ui, sans-serif";
    ctx.fillText(subtitle, w / 2, h / 2 + 42);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "start";
  }

  private handlePointerDown(e: PointerEvent): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = this.buttons.find((b) => x >= b.rect.x && x <= b.rect.x + b.rect.w && y >= b.rect.y && y <= b.rect.y + b.rect.h);
    if (!hit) return;
    if (hit.id === "resume") this.phase = "racing";
    else if (hit.id === "start" || hit.id === "restart") this.startRace();
    else if (hit.id === "back") this.exitToMenu?.();
    else if (hit.id === "menu") this.phase = "menu";
    else if (hit.id.startsWith("course:")) this.selectedCourse = Number(hit.id.split(":")[1]);
    else if (hit.id.startsWith("difficulty:")) this.selectedDifficulty = Number(hit.id.split(":")[1]);
    else if (hit.id.startsWith("kart:")) this.selectedKart = Number(hit.id.split(":")[1]);
  }
}

const COURSES: Array<{ id: CourseId; name: string }> = [
  { id: "oval", name: "Beginner Oval" },
  { id: "drift", name: "Twisty Drift" },
  { id: "technical", name: "Technical Circuit" },
  { id: "snow", name: "Snow Sprint" },
];

function createCourse(id: CourseId): Course {
  const defs: Record<CourseId, Omit<Course, "gates" | "props">> = {
    oval: {
      id,
      name: "Beginner Oval",
      theme: "grass",
      laps: 3,
      roadWidth: 176,
      points: [
        { x: 370, y: 270 }, { x: 1230, y: 270 }, { x: 1380, y: 520 },
        { x: 1230, y: 790 }, { x: 370, y: 790 }, { x: 220, y: 520 },
      ],
    },
    drift: {
      id,
      name: "Twisty Drift",
      theme: "grass",
      laps: 3,
      roadWidth: 164,
      points: [
        { x: 350, y: 270 }, { x: 760, y: 220 }, { x: 1180, y: 300 },
        { x: 1320, y: 540 }, { x: 1030, y: 700 }, { x: 1180, y: 850 },
        { x: 720, y: 825 }, { x: 420, y: 690 }, { x: 250, y: 470 },
      ],
    },
    technical: {
      id,
      name: "Technical Circuit",
      theme: "desert",
      laps: 3,
      roadWidth: 158,
      points: [
        { x: 330, y: 250 }, { x: 820, y: 210 }, { x: 1280, y: 250 },
        { x: 1400, y: 470 }, { x: 1130, y: 550 }, { x: 1320, y: 770 },
        { x: 930, y: 860 }, { x: 670, y: 710 }, { x: 410, y: 850 },
        { x: 220, y: 610 }, { x: 360, y: 430 },
      ],
    },
    snow: {
      id,
      name: "Snow Sprint",
      theme: "snow",
      laps: 2,
      roadWidth: 170,
      points: [
        { x: 320, y: 300 }, { x: 650, y: 190 }, { x: 1120, y: 240 },
        { x: 1380, y: 430 }, { x: 1320, y: 700 }, { x: 920, y: 850 },
        { x: 470, y: 760 }, { x: 230, y: 560 },
      ],
    },
  };
  const base = defs[id];
  const gates = base.points.map((p, i, points) => {
    const next = points[(i + 1) % points.length];
    const t = i === 0 ? 0.1 : 0.5;
    const mid = {
      x: lerp(p.x, next.x, t),
      y: lerp(p.y, next.y, t),
    };
    const tangent = normalize({ x: next.x - p.x, y: next.y - p.y });
    const normal = { x: -tangent.y, y: tangent.x };
    const half = base.roadWidth / 2 + (i === 0 ? 8 : -18);
    return {
      left: { x: mid.x + normal.x * half, y: mid.y + normal.y * half },
      right: { x: mid.x - normal.x * half, y: mid.y - normal.y * half },
      mid,
      normal,
      label: i === 0 ? "Finish" : `${i}`,
      finish: i === 0,
    };
  });
  const props: Vec[] = [];
  for (let i = 0; i < 36; i++) {
    const p = { x: 80 + ((i * 181) % 1440), y: 90 + ((i * 113) % 850) };
    if (!isOnRoad(base, p.x, p.y, 92)) props.push(p);
  }
  return { ...base, gates, props };
}

function isOnRoad(course: Pick<Course, "points" | "roadWidth">, x: number, y: number, extra = 0): boolean {
  let best = Infinity;
  for (let i = 0; i < course.points.length; i++) {
    const a = course.points[i];
    const b = course.points[(i + 1) % course.points.length];
    best = Math.min(best, distanceToSegment({ x, y }, a, b));
  }
  return best <= course.roadWidth / 2 + extra;
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, theme: Course["theme"]): void {
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  if (theme === "snow") {
    gradient.addColorStop(0, "#f4fbff");
    gradient.addColorStop(1, "#cfeefa");
  } else if (theme === "desert") {
    gradient.addColorStop(0, "#ffd08a");
    gradient.addColorStop(1, "#eaa15f");
  } else {
    gradient.addColorStop(0, "#a4e875");
    gradient.addColorStop(1, "#5fc96b");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = theme === "snow" ? 0.22 : 0.16;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 44; i++) {
    const x = (i * 137) % Math.max(w, 1);
    const y = (i * 83) % Math.max(h, 1);
    if (theme === "desert") {
      ctx.fillRect(x, y, 34, 3);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, theme === "snow" ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawMenuTrackPreview(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.translate(w / 2, h / 2 + 24);
  ctx.rotate(-0.08);
  ctx.strokeStyle = "#213547";
  ctx.lineWidth = Math.min(w, h) * 0.14;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.min(w * 0.32, 260), Math.min(h * 0.22, 150), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.min(w, h) * 0.025;
  ctx.setLineDash([26, 24]);
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.min(w * 0.32, 260), Math.min(h * 0.22, 150), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.setLineDash([]);
}

function getCurbDark(theme: Course["theme"]): string {
  if (theme === "snow") return "#90bdd0";
  if (theme === "desert") return "#a45f32";
  return "#d7263d";
}

function getCurbLight(theme: Course["theme"]): string {
  if (theme === "snow") return "#f8fdff";
  if (theme === "desert") return "#f7d08a";
  return "#ffffff";
}

function drawGatePanel(ctx: CanvasRenderingContext2D, gate: Gate, thickness: number): void {
  const tx = gate.normal.x * thickness;
  const ty = gate.normal.y * thickness;
  ctx.beginPath();
  ctx.moveTo(gate.left.x + tx, gate.left.y + ty);
  ctx.lineTo(gate.right.x + tx, gate.right.y + ty);
  ctx.lineTo(gate.right.x - tx, gate.right.y - ty);
  ctx.lineTo(gate.left.x - tx, gate.left.y - ty);
  ctx.closePath();
}

function drawGatePost(ctx: CanvasRenderingContext2D, point: Vec, finish: boolean): void {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.fillStyle = "rgba(15,23,42,0.22)";
  ctx.beginPath();
  ctx.ellipse(5, 7, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = finish ? "#111827" : "#0284c7";
  roundRect(ctx, -5, -18, 10, 30, 4);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = finish ? "#ffffff" : "#e0f2fe";
  ctx.beginPath();
  ctx.arc(0, -21, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawProp(ctx: CanvasRenderingContext2D, prop: Vec, theme: Course["theme"]): void {
  ctx.save();
  ctx.translate(prop.x, prop.y);
  ctx.fillStyle = "rgba(15,23,42,0.16)";
  ctx.beginPath();
  ctx.ellipse(5, 9, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  if (theme === "desert") {
    ctx.fillStyle = "#2f9e44";
    roundRect(ctx, -5, -18, 10, 34, 5);
    ctx.fill();
    roundRect(ctx, -17, -4, 11, 8, 4);
    ctx.fill();
    roundRect(ctx, 6, -9, 13, 8, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.24)";
    ctx.fillRect(-2, -15, 2, 25);
  } else if (theme === "snow") {
    ctx.fillStyle = "#7cc7dc";
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f8fdff";
    ctx.beginPath();
    ctx.arc(-5, -6, 8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#7b4f2a";
    roundRect(ctx, -4, -2, 8, 24, 3);
    ctx.fill();
    ctx.fillStyle = "#238636";
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 9, Math.sin(a) * 7 - 10, 13, 8, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#3fb950";
    ctx.beginPath();
    ctx.arc(0, -10, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawClosedPath(ctx: CanvasRenderingContext2D, points: Vec[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function normalize(v: Vec): Vec {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function angleDiff(a: number, b: number): number {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function distanceToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy || 1;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq, 0, 1);
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

function nearestPointOnCourse(course: Pick<Course, "points">, x: number, y: number): { point: Vec; tangent: Vec; normal: Vec } {
  let bestPoint = course.points[0];
  let bestTangent = normalize({
    x: course.points[1].x - course.points[0].x,
    y: course.points[1].y - course.points[0].y,
  });
  let bestDist = Infinity;
  for (let i = 0; i < course.points.length; i++) {
    const a = course.points[i];
    const b = course.points[(i + 1) % course.points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy || 1;
    const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / lenSq, 0, 1);
    const point = { x: a.x + dx * t, y: a.y + dy * t };
    const dist = Math.hypot(x - point.x, y - point.y);
    if (dist < bestDist) {
      bestDist = dist;
      bestPoint = point;
      bestTangent = normalize({ x: dx, y: dy });
    }
  }
  return {
    point: bestPoint,
    tangent: bestTangent,
    normal: { x: -bestTangent.y, y: bestTangent.x },
  };
}

function lookAheadOnCourse(course: Pick<Course, "points">, x: number, y: number, lookAhead: number, lateralOffset: number): Vec {
  let bestIndex = 0;
  let bestT = 0;
  let bestDist = Infinity;
  for (let i = 0; i < course.points.length; i++) {
    const a = course.points[i];
    const b = course.points[(i + 1) % course.points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy || 1;
    const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / lenSq, 0, 1);
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const dist = Math.hypot(x - px, y - py);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
      bestT = t;
    }
  }

  let index = bestIndex;
  let a = course.points[index];
  let b = course.points[(index + 1) % course.points.length];
  let segment = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  let t = bestT;
  let remaining = lookAhead;
  let available = (1 - t) * segment;

  while (remaining > available) {
    remaining -= available;
    index = (index + 1) % course.points.length;
    a = course.points[index];
    b = course.points[(index + 1) % course.points.length];
    segment = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    t = 0;
    available = segment;
  }

  t = clamp(t + remaining / segment, 0, 1);
  const tangent = normalize({ x: b.x - a.x, y: b.y - a.y });
  const normal = { x: -tangent.y, y: tangent.x };
  return {
    x: lerp(a.x, b.x, t) + normal.x * lateralOffset,
    y: lerp(a.y, b.y, t) + normal.y * lateralOffset,
  };
}

function segmentsIntersect(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
  const ccw = (p1: Vec, p2: Vec, p3: Vec) =>
    (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

function formatTime(value: number): string {
  const minutes = Math.floor(value / 60);
  const seconds = value - minutes * 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
}

function placementText(place: number): string {
  return place === 1 ? "1st" : place === 2 ? "2nd" : place === 3 ? "3rd" : "4th";
}
