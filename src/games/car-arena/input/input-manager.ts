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
  steerStartX: number;
  steerX: number;
  steerId: number | null;
  driftActive: boolean;
  driftId: number | null;
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
    steerStartX: 0,
    steerX: 0,
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

  poll(): CarInput & { pause: boolean; restart: boolean } {
    let steer = 0;
    if (this.rawKeys.left) steer -= 1;
    if (this.rawKeys.right) steer += 1;

    if (this.touch.steerActive && this.canvasRect) {
      const dx = this.touch.steerX - this.touch.steerStartX;
      steer = Math.max(-1, Math.min(1, dx / (this.canvasRect.width * 0.12)));
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
      const relX = (touch.clientX - this.canvasRect.left) / this.canvasRect.width;
      const relY = (touch.clientY - this.canvasRect.top) / this.canvasRect.height;
      const isSteer = relX < 0.48 && relY > 0.45;

      if (isSteer && this.touch.steerId === null) {
        this.touch.steerId = touch.identifier;
        this.touch.steerActive = true;
        this.touch.steerStartX = touch.clientX;
        this.touch.steerX = touch.clientX;
      } else if (!isSteer && relX > 0.52 && relY > 0.45 && this.touch.driftId === null) {
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
}
