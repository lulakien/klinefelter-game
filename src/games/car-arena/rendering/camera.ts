/**
 * Follow camera — keeps the player centered with smooth interpolation.
 * The camera does not rotate (top-down, fixed orientation).
 */

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface CameraConfig {
  /** How quickly the camera follows (0-1, higher = snappier) */
  smoothing: number;
  /** Base zoom level */
  zoom: number;
}

const DEFAULT_CONFIG: CameraConfig = {
  smoothing: 0.08,
  zoom: 1.0,
};

/** Create a camera initially centered at (x, y). */
export function createCamera(x = 0, y = 0): Camera {
  return { x, y, zoom: DEFAULT_CONFIG.zoom };
}

/** Smoothly follow a target. Call once per frame. */
export function updateCamera(
  cam: Camera,
  targetX: number,
  targetY: number,
  config: CameraConfig = DEFAULT_CONFIG,
): void {
  cam.x += (targetX - cam.x) * config.smoothing;
  cam.y += (targetY - cam.y) * config.smoothing;
}

/** Apply camera transform to a canvas context. */
export function applyCamera(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  canvasWidth: number,
  canvasHeight: number,
): void {
  ctx.save();
  ctx.translate(canvasWidth / 2, canvasHeight / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
}

/** Remove camera transform. */
export function removeCamera(ctx: CanvasRenderingContext2D): void {
  ctx.restore();
}

/** Convert screen coordinates to world coordinates. */
export function screenToWorld(
  cam: Camera,
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: cam.x + (screenX - canvasWidth / 2) / cam.zoom,
    y: cam.y + (screenY - canvasHeight / 2) / cam.zoom,
  };
}
