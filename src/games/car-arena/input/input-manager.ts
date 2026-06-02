/**
 * Unified input manager for Tiny Drift Karts.
 *
 * The kart auto-accelerates. Keyboard and touch expose normalized steering
 * plus a drift action so the game can stay simple on mobile.
 */

import type { CarInput } from "../physics/car-physics.js";

const KEY_MAP: Record<string, keyof RawKeys> = {
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
  " ": "drift",
  space: "drift",
  shift: "drift",
  p: "pause",
  escape: "pause",
  r: "restart",
};

interface RawKeys {
  left: boolean;
  right: boolean;
  drift: boolean;
  pause: boolean;
  restart: boolean;
}

interface TouchState {
  steerActive: boolean;
  steerCenterX: number;
  steerCenterY: number;
  steerX: number;
  steerY: number;
  steerId: number | null;
  driftActive: boolean;
  driftId: number | null;
}

export interface TinyKartInput extends CarInput {
  pause: boolean;
  restart: boolean;
  aimAngle: number | null;
  aimStrength: number;
}

export class InputManager {
  private rawKeys: RawKeys = {
    left: false,
    right: false,
    drift: false,
    pause: false,
    restart: false,
  };

  private touch: TouchState = {
    steerActive: false,
    steerCenterX: 0,
    steerCenterY: 0,
    steerX: 0,
    steerY: 0,
    steerId: null,
    driftActive: false,
    driftId: null,
  };

  private pauseTriggered = false;
  private restartTriggered = false;
  private canvas: HTMLCanvasElement | null = null;
  private canvasRect: DOMRect | null = null;

  private onKeyDown = this.handleKeyDown.bind(this);
  private onKeyUp = this.handleKeyUp.bind(this);
  private onTouchStart = this.handleTouchStart.bind(this);
  private onTouchMove = this.handleTouchMove.bind(this);
  private onTouchEnd = this.handleTouchEnd.bind(this);
  private onResize = this.handleResize.bind(this);

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.canvasRect = canvas.getBoundingClientRect();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
    canvas.addEventListener("touchend", this.onTouchEnd);
    canvas.addEventListener("touchcancel", this.onTouchEnd);
    window.addEventListener("resize", this.onResize);
  }

  detach(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    if (this.canvas) {
      this.canvas.removeEventListener("touchstart", this.onTouchStart);
      this.canvas.removeEventListener("touchmove", this.onTouchMove);
      this.canvas.removeEventListener("touchend", this.onTouchEnd);
      this.canvas.removeEventListener("touchcancel", this.onTouchEnd);
    }
    window.removeEventListener("resize", this.onResize);
    this.canvas = null;
    this.canvasRect = null;
  }

  poll(): TinyKartInput {
    let steer = 0;
    let aimAngle: number | null = null;
    let aimStrength = 0;
    if (this.rawKeys.left) steer -= 1;
    if (this.rawKeys.right) steer += 1;

    if (this.touch.steerActive && this.canvasRect) {
      const radius = Math.max(42, Math.min(78, this.canvasRect.width * 0.16));
      const dx = this.touch.steerX - this.touch.steerCenterX;
      const dy = this.touch.steerY - this.touch.steerCenterY;
      const dist = Math.hypot(dx, dy);
      aimStrength = Math.max(0, Math.min(1, dist / (radius * 0.78)));
      if (aimStrength > 0.12) {
        aimAngle = Math.atan2(dy, dx);
      }
      steer = Math.max(-1, Math.min(1, dx / radius));
    }

    const pause = this.pauseTriggered || this.rawKeys.pause;
    const restart = this.restartTriggered || this.rawKeys.restart;
    this.pauseTriggered = false;
    this.restartTriggered = false;
    this.rawKeys.pause = false;
    this.rawKeys.restart = false;

    return {
      steer,
      throttle: 1,
      brake: 0,
      drift: this.rawKeys.drift || this.touch.driftActive,
      pause,
      restart,
      aimAngle,
      aimStrength,
    };
  }

  isActive(): boolean {
    return (
      this.rawKeys.left ||
      this.rawKeys.right ||
      this.rawKeys.drift ||
      this.touch.steerActive ||
      this.touch.driftActive
    );
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const action = KEY_MAP[e.key.toLowerCase()];
    if (!action) return;
    e.preventDefault();
    if (action === "pause") this.pauseTriggered = true;
    else if (action === "restart") this.restartTriggered = true;
    else this.rawKeys[action] = true;
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const action = KEY_MAP[e.key.toLowerCase()];
    if (!action) return;
    e.preventDefault();
    if (action !== "pause" && action !== "restart") {
      this.rawKeys[action] = false;
    }
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    this.canvasRect = this.canvas?.getBoundingClientRect() ?? null;
    if (!this.canvasRect) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const localX = touch.clientX - this.canvasRect.left;
      const localY = touch.clientY - this.canvasRect.top;
      const relX = localX / this.canvasRect.width;
      const relY = localY / this.canvasRect.height;
      const steerCenter = this.getSteerCenter();
      const driftCenter = this.getDriftCenter();
      const steerDist = Math.hypot(localX - steerCenter.x, localY - steerCenter.y);
      const driftDist = Math.hypot(localX - driftCenter.x, localY - driftCenter.y);
      const isSteer = (relX < 0.5 && relY > 0.42) || steerDist < steerCenter.radius * 1.75;
      const isDrift = (relX > 0.5 && relY > 0.42) || driftDist < driftCenter.radius * 1.65;

      if (isSteer && this.touch.steerId === null) {
        this.touch.steerId = touch.identifier;
        this.touch.steerActive = true;
        this.touch.steerCenterX = this.canvasRect.left + steerCenter.x;
        this.touch.steerCenterY = this.canvasRect.top + steerCenter.y;
        this.touch.steerX = touch.clientX;
        this.touch.steerY = touch.clientY;
      } else if (isDrift && this.touch.driftId === null) {
        this.touch.driftId = touch.identifier;
        this.touch.driftActive = true;
      }
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    this.canvasRect = this.canvas?.getBoundingClientRect() ?? null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.touch.steerId) {
        this.touch.steerX = touch.clientX;
        this.touch.steerY = touch.clientY;
      }
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.touch.steerId) {
        this.touch.steerId = null;
        this.touch.steerActive = false;
      }
      if (touch.identifier === this.touch.driftId) {
        this.touch.driftId = null;
        this.touch.driftActive = false;
      }
    }
  }

  private handleResize(): void {
    this.canvasRect = this.canvas?.getBoundingClientRect() ?? null;
  }

  private getSteerCenter(): { x: number; y: number; radius: number } {
    const rect = this.canvasRect;
    if (!rect) return { x: 84, y: 84, radius: 52 };
    const radius = Math.max(46, Math.min(64, rect.width * 0.13));
    return {
      x: Math.max(radius + 20, rect.width * 0.16),
      y: rect.height - radius - 24,
      radius,
    };
  }

  private getDriftCenter(): { x: number; y: number; radius: number } {
    const rect = this.canvasRect;
    if (!rect) return { x: 84, y: 84, radius: 52 };
    const radius = Math.max(48, Math.min(66, rect.width * 0.14));
    return {
      x: rect.width - Math.max(radius + 20, rect.width * 0.16),
      y: rect.height - radius - 24,
      radius,
    };
  }
}
