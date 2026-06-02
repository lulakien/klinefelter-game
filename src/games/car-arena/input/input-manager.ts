/**
 * Unified input manager for keyboard and touch controls.
 *
 * Emits normalized CarInput actions regardless of input device.
 *   steer:    -1 (left) to 1 (right)
 *   throttle:  0 to 1
 *   brake:     0 to 1
 *   drift:     boolean
 *   pause:     boolean (edge-triggered)
 *   restart:   boolean (edge-triggered)
 */

import type { CarInput } from "../physics/car-physics.js";

// ---- Keyboard mapping ----

const KEY_MAP: Record<string, keyof RawKeys> = {
  w: "up",
  arrowup: "up",
  s: "down",
  arrowdown: "down",
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
  " ": "drift",
  space: "drift",
  p: "pause",
  escape: "pause",
  r: "restart",
};

interface RawKeys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  drift: boolean;
  pause: boolean;
  restart: boolean;
}

// ---- Touch state ----

interface TouchState {
  // Left zone (steering)
  steerActive: boolean;
  steerX: number;
  steerY: number;
  steerId: number | null;
  // Right zone (buttons)
  throttleActive: boolean;
  throttleId: number | null;
  brakeActive: boolean;
  brakeId: number | null;
  driftActive: boolean;
  driftId: number | null;
}

// ---- Controller ----

export class InputManager {
  private rawKeys: RawKeys = {
    up: false,
    down: false,
    left: false,
    right: false,
    drift: false,
    pause: false,
    restart: false,
  };

  private touch: TouchState = {
    steerActive: false,
    steerX: 0,
    steerY: 0,
    steerId: null,
    throttleActive: false,
    throttleId: null,
    brakeActive: false,
    brakeId: null,
    driftActive: false,
    driftId: null,
  };

  // Edge-triggered events (consumed on read)
  private pauseTriggered = false;
  private restartTriggered = false;

  private canvas: HTMLCanvasElement | null = null;
  private canvasRect: DOMRect | null = null;

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onTouchStart: (e: TouchEvent) => void;
  private onTouchMove: (e: TouchEvent) => void;
  private onTouchEnd: (e: TouchEvent) => void;
  private onResize: () => void;

  // Touch zone definitions (relative to canvas)
  private leftZoneRight = 0.45; // left 45% = steering
  private throttleTop = 0.55; // right side, top 45% = throttle button
  private brakeTop = 0.75; // right side, middle = brake
  // rest is drift

  constructor() {
    this.onKeyDown = this.handleKeyDown.bind(this);
    this.onKeyUp = this.handleKeyUp.bind(this);
    this.onTouchStart = this.handleTouchStart.bind(this);
    this.onTouchMove = this.handleTouchMove.bind(this);
    this.onTouchEnd = this.handleTouchEnd.bind(this);
    this.onResize = this.handleResize.bind(this);
  }

  /** Attach event listeners to the canvas. */
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

  /** Remove event listeners. */
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

  /** Read current input state and consume edge-triggered events. */
  poll(): CarInput & { pause: boolean; restart: boolean } {
    const keys = this.rawKeys;

    // Keyboard input
    let steer = 0;
    let throttle = 0;
    let brake = 0;

    if (keys.left) steer -= 1;
    if (keys.right) steer += 1;
    if (keys.up) throttle = 1;
    if (keys.down) brake = 1;

    // Touch input (overrides / merges with keyboard)
    if (this.touch.steerActive) {
      // Virtual joystick: distance from initial touch gives steer amount
      // steerX is relative position within steering zone
      const relX = this.touch.steerX - 0.5; // -0.5 to 0.5
      steer = Math.max(-1, Math.min(1, relX * 3)); // amplify
    }
    if (this.touch.throttleActive) throttle = 1;
    if (this.touch.brakeActive) brake = 1;

    const drift = keys.drift || this.touch.driftActive;

    const pause = this.pauseTriggered || keys.pause;
    const restart = this.restartTriggered || keys.restart;

    // Consume edge triggers
    this.pauseTriggered = false;
    this.restartTriggered = false;
    this.rawKeys.pause = false;
    this.rawKeys.restart = false;

    return { steer, throttle, brake, drift, pause, restart };
  }

  // ---- Keyboard handlers ----

  private handleKeyDown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    const action = KEY_MAP[key];
    if (!action) return;

    e.preventDefault();

    if (action === "pause") {
      this.pauseTriggered = true;
    } else if (action === "restart") {
      this.restartTriggered = true;
    } else {
      this.rawKeys[action] = true;
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    const action = KEY_MAP[key];
    if (!action) return;

    e.preventDefault();

    if (action !== "pause" && action !== "restart") {
      this.rawKeys[action] = false;
    }
  }

  // ---- Touch handlers ----

  private getTouchZone(
    clientX: number,
    clientY: number,
  ): { zone: "steer" | "throttle" | "brake" | "drift"; relX: number; relY: number } {
    if (!this.canvasRect) {
      return { zone: "steer", relX: 0, relY: 0 };
    }
    const relX = (clientX - this.canvasRect.left) / this.canvasRect.width;
    const relY = (clientY - this.canvasRect.top) / this.canvasRect.height;

    if (relX < this.leftZoneRight) {
      return { zone: "steer", relX: relX / this.leftZoneRight, relY };
    }

    // Right side — vertical zones
    const rightRelY = relY;
    if (rightRelY < this.throttleTop) {
      return { zone: "throttle", relX, relY };
    }
    if (rightRelY < this.brakeTop) {
      return { zone: "brake", relX, relY };
    }
    return { zone: "drift", relX, relY };
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    this.canvasRect = this.canvas?.getBoundingClientRect() ?? null;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const { zone, relX, relY } = this.getTouchZone(touch.clientX, touch.clientY);

      switch (zone) {
        case "steer":
          if (this.touch.steerId === null) {
            this.touch.steerId = touch.identifier;
            this.touch.steerActive = true;
            this.touch.steerX = relX;
            this.touch.steerY = relY;
          }
          break;
        case "throttle":
          if (this.touch.throttleId === null) {
            this.touch.throttleId = touch.identifier;
            this.touch.throttleActive = true;
          }
          break;
        case "brake":
          if (this.touch.brakeId === null) {
            this.touch.brakeId = touch.identifier;
            this.touch.brakeActive = true;
          }
          break;
        case "drift":
          if (this.touch.driftId === null) {
            this.touch.driftId = touch.identifier;
            this.touch.driftActive = true;
          }
          break;
      }
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    this.canvasRect = this.canvas?.getBoundingClientRect() ?? null;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      if (touch.identifier === this.touch.steerId) {
        const { relX, relY } = this.getTouchZone(touch.clientX, touch.clientY);
        this.touch.steerX = relX;
        this.touch.steerY = relY;
        this.touch.steerActive = true;
      }
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    this.canvasRect = this.canvas?.getBoundingClientRect() ?? null;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      if (touch.identifier === this.touch.steerId) {
        this.touch.steerId = null;
        this.touch.steerActive = false;
        this.touch.steerX = 0.5;
      }
      if (touch.identifier === this.touch.throttleId) {
        this.touch.throttleId = null;
        this.touch.throttleActive = false;
      }
      if (touch.identifier === this.touch.brakeId) {
        this.touch.brakeId = null;
        this.touch.brakeActive = false;
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

  /** Check if any input is active (for preventing page scroll). */
  isActive(): boolean {
    return (
      this.rawKeys.up ||
      this.rawKeys.down ||
      this.rawKeys.left ||
      this.rawKeys.right ||
      this.touch.steerActive ||
      this.touch.throttleActive ||
      this.touch.brakeActive
    );
  }
}
