/**
 * Simple collision detection and response for the car arena.
 *
 * - Cars are circles
 * - Obstacles can be circles or axis-aligned rectangles
 * - Walls are axis-aligned boundaries
 * - Response: push apart + velocity reflection with damping
 */

import type { CarState } from "./car-physics.js";

// ---- Shape types ----

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

export interface Rect {
  x: number; // center x
  y: number; // center y
  width: number;
  height: number;
}

export type Obstacle =
  | { type: "circle"; circle: Circle }
  | { type: "rect"; rect: Rect };

export interface ArenaBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ---- Detection ----

/** Circle vs circle overlap test. Returns overlap amount (> 0 = overlapping). */
export function circleOverlap(a: Circle, b: Circle): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return a.radius + b.radius - dist;
}

/** Circle vs AABB overlap. Returns minimum push vector (x, y, amount > 0). */
export function circleRectOverlap(
  circle: Circle,
  rect: Rect,
): { pushX: number; pushY: number; amount: number } | null {
  // Find closest point on rect to circle center
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  const closestX = Math.max(rect.x - halfW, Math.min(circle.x, rect.x + halfW));
  const closestY = Math.max(
    rect.y - halfH,
    Math.min(circle.y, rect.y + halfH),
  );

  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= circle.radius * circle.radius) return null;

  const dist = Math.sqrt(distSq);
  if (dist < 0.0001) {
    // Circle center is inside the rect — push out along nearest edge
    const distLeft = circle.x - (rect.x - halfW);
    const distRight = rect.x + halfW - circle.x;
    const distTop = circle.y - (rect.y - halfH);
    const distBottom = rect.y + halfH - circle.y;
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);
    if (minDist === distLeft) return { pushX: -(circle.radius + distLeft), pushY: 0, amount: circle.radius };
    if (minDist === distRight) return { pushX: circle.radius + distRight, pushY: 0, amount: circle.radius };
    if (minDist === distTop) return { pushX: 0, pushY: -(circle.radius + distTop), amount: circle.radius };
    return { pushX: 0, pushY: circle.radius + distBottom, amount: circle.radius };
  }

  const overlap = circle.radius - dist;
  const nx = dx / dist;
  const ny = dy / dist;
  return { pushX: nx * overlap, pushY: ny * overlap, amount: overlap };
}

// ---- Response ----

const BOUNCE_DAMP = 0.3; // how much velocity is preserved on wall bounce
const OBSTACLE_BOUNCE_DAMP = 0.5;

/** Resolve car vs arena wall collision. */
export function resolveWallCollision(
  state: CarState,
  bounds: ArenaBounds,
  radius: number,
): void {
  // Left wall
  if (state.x - radius < bounds.minX) {
    state.x = bounds.minX + radius;
    if (state.velocityX < 0) state.velocityX *= -BOUNCE_DAMP;
  }
  // Right wall
  if (state.x + radius > bounds.maxX) {
    state.x = bounds.maxX - radius;
    if (state.velocityX > 0) state.velocityX *= -BOUNCE_DAMP;
  }
  // Top wall
  if (state.y - radius < bounds.minY) {
    state.y = bounds.minY + radius;
    if (state.velocityY < 0) state.velocityY *= -BOUNCE_DAMP;
  }
  // Bottom wall
  if (state.y + radius > bounds.maxY) {
    state.y = bounds.maxY - radius;
    if (state.velocityY > 0) state.velocityY *= -BOUNCE_DAMP;
  }
}

/** Resolve car vs obstacles. Returns collision strength for effects. */
export function resolveObstacleCollisions(
  state: CarState,
  obstacles: Obstacle[],
  radius: number,
): number {
  let totalImpact = 0;

  for (const obs of obstacles) {
    if (obs.type === "circle") {
      const overlap = circleOverlap(
        { x: state.x, y: state.y, radius },
        obs.circle,
      );
      if (overlap > 0) {
        // Push car out
        const dx = state.x - obs.circle.x;
        const dy = state.y - obs.circle.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;
        state.x += nx * overlap;
        state.y += ny * overlap;

        // Reflect & damp velocity
        const velDotNormal =
          state.velocityX * nx + state.velocityY * ny;
        if (velDotNormal < 0) {
          state.velocityX -= 2 * velDotNormal * nx;
          state.velocityY -= 2 * velDotNormal * ny;
          state.velocityX *= OBSTACLE_BOUNCE_DAMP;
          state.velocityY *= OBSTACLE_BOUNCE_DAMP;
        }
        totalImpact += Math.abs(velDotNormal);
      }
    } else if (obs.type === "rect") {
      const result = circleRectOverlap(
        { x: state.x, y: state.y, radius },
        obs.rect,
      );
      if (result) {
        state.x += result.pushX;
        state.y += result.pushY;

        // Reflect velocity if pushing against it
        const pushMag = Math.sqrt(
          result.pushX * result.pushX + result.pushY * result.pushY,
        ) || 1;
        const nx = result.pushX / pushMag;
        const ny = result.pushY / pushMag;
        const velDotNormal =
          state.velocityX * nx + state.velocityY * ny;
        if (velDotNormal < 0) {
          state.velocityX -= 2 * velDotNormal * nx;
          state.velocityY -= 2 * velDotNormal * ny;
          state.velocityX *= OBSTACLE_BOUNCE_DAMP;
          state.velocityY *= OBSTACLE_BOUNCE_DAMP;
        }
        totalImpact += Math.abs(velDotNormal);
      }
    }
  }

  return totalImpact;
}

/** Check car vs car collision and separate both. */
export function resolveCarCarCollision(
  a: CarState,
  b: CarState,
  radius: number,
): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = radius * 2;

  if (dist >= minDist || dist < 0.0001) return false;

  const overlap = minDist - dist;
  const nx = dx / dist;
  const ny = dy / dist;

  // Separate equally
  a.x += nx * overlap * 0.5;
  a.y += ny * overlap * 0.5;
  b.x -= nx * overlap * 0.5;
  b.y -= ny * overlap * 0.5;

  // Exchange velocity along collision normal (simplified)
  const relVelX = a.velocityX - b.velocityX;
  const relVelY = a.velocityY - b.velocityY;
  const relVelNormal = relVelX * nx + relVelY * ny;

  if (relVelNormal > 0) {
    a.velocityX -= relVelNormal * nx * 0.5;
    a.velocityY -= relVelNormal * ny * 0.5;
    b.velocityX += relVelNormal * nx * 0.5;
    b.velocityY += relVelNormal * ny * 0.5;
  }

  return true;
}
