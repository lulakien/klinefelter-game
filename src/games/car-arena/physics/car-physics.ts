/**
 * Arcade car physics model.
 *
 * Models a top-down car with:
 *   - Forward acceleration (throttle)
 *   - Braking / reverse
 *   - Steering (torque proportional to speed)
 *   - Velocity decomposition into forward/lateral components
 *   - Grip reduces lateral velocity (drifting reduces grip)
 *   - Linear and angular damping
 *
 * All values are in virtual units. 1 unit ≈ 1 pixel at 1x scale.
 */

// ---- Types ----

export interface CarState {
  x: number;
  y: number;
  rotation: number; // radians, 0 = right, π/2 = down
  velocityX: number;
  velocityY: number;
  angularVelocity: number;
}

export interface CarConfig {
  acceleration: number;
  maxSpeed: number;
  brakeForce: number;
  reverseMaxSpeed: number;
  turnRate: number; // radians/sec at max speed
  grip: number; // lateral friction (0-1, higher = more grip)
  driftGrip: number; // lateral friction while drifting
  linearDamping: number;
  angularDamping: number;
  collisionRadius: number; // for circle collision
  carWidth: number; // for rendering
  carHeight: number; // for rendering
}

export const DEFAULT_CAR_CONFIG: CarConfig = {
  acceleration: 800,
  maxSpeed: 400,
  brakeForce: 600,
  reverseMaxSpeed: 150,
  turnRate: 3.5,
  grip: 0.92,
  driftGrip: 0.3,
  linearDamping: 0.95,
  angularDamping: 0.85,
  collisionRadius: 22,
  carWidth: 44,
  carHeight: 24,
};

// ---- Input (normalized, device-agnostic) ----

export interface CarInput {
  throttle: number; // 0 to 1
  brake: number; // 0 to 1
  steer: number; // -1 (left) to 1 (right)
  drift: boolean;
}

export const EMPTY_INPUT: CarInput = {
  throttle: 0,
  brake: 0,
  steer: 0,
  drift: false,
};

// ---- Physics ----

/** Create a fresh car state at the given position. */
export function createCarState(x: number, y: number, rotation = 0): CarState {
  return {
    x,
    y,
    rotation,
    velocityX: 0,
    velocityY: 0,
    angularVelocity: 0,
  };
}

/** Advance the car state by `dt` seconds using `input` and `config`. */
export function updateCar(
  state: CarState,
  input: CarInput,
  config: CarConfig,
  dt: number,
): void {
  const { throttle, brake, steer, drift } = input;

  // Current speed in the car's forward direction
  const forwardX = Math.cos(state.rotation);
  const forwardY = Math.sin(state.rotation);
  const forwardSpeed =
    state.velocityX * forwardX + state.velocityY * forwardY;

  // ---- Steering ----
  // Turn rate is proportional to speed (no turning when stationary)
  const speedRatio = Math.abs(forwardSpeed) / config.maxSpeed;
  const steerInput = steer * speedRatio;
  state.angularVelocity += steerInput * config.turnRate * dt;
  state.angularVelocity *= config.angularDamping;

  // ---- Apply forces ----

  // Throttle: accelerate forward
  if (throttle > 0) {
    const force = config.acceleration * throttle;
    state.velocityX += forwardX * force * dt;
    state.velocityY += forwardY * force * dt;
  }

  // Brake: decelerate (opposite to velocity), or reverse if nearly stopped
  if (brake > 0) {
    const speed = Math.sqrt(
      state.velocityX * state.velocityX + state.velocityY * state.velocityY,
    );
    if (speed < 5) {
      // Reverse — small reverse force
      const reverseForce = config.brakeForce * 0.3 * brake;
      state.velocityX -= forwardX * reverseForce * dt;
      state.velocityY -= forwardY * reverseForce * dt;
    } else {
      // Brake — oppose velocity direction
      if (speed > 0.001) {
        const brakeForce = config.brakeForce * brake;
        const nx = state.velocityX / speed;
        const ny = state.velocityY / speed;
        state.velocityX -= nx * brakeForce * dt;
        state.velocityY -= ny * brakeForce * dt;
        // Prevent braking from reversing velocity
        const newForward =
          state.velocityX * forwardX + state.velocityY * forwardY;
        if (forwardSpeed > 0 && newForward < 0) {
          // Zero out velocity if brake would reverse direction
          state.velocityX = 0;
          state.velocityY = 0;
        }
      }
    }
  }

  // ---- Grip / drift ----
  // Decompose velocity into forward and lateral components
  if (forwardSpeed !== 0) {
    const lateralX = state.velocityX - forwardX * forwardSpeed;
    const lateralY = state.velocityY - forwardY * forwardSpeed;
    const gripFactor = drift ? config.driftGrip : config.grip;

    // Apply grip to lateral component (friction)
    state.velocityX = forwardX * forwardSpeed + lateralX * (1 - gripFactor);
    state.velocityY = forwardY * forwardSpeed + lateralY * (1 - gripFactor);
  }

  // ---- Damping ----
  state.velocityX *= config.linearDamping;
  state.velocityY *= config.linearDamping;

  // ---- Speed cap ----
  const speed = Math.sqrt(
    state.velocityX * state.velocityX + state.velocityY * state.velocityY,
  );
  const maxAllowed = Math.abs(forwardSpeed) < 1 && brake > 0
    ? config.reverseMaxSpeed
    : config.maxSpeed;
  if (speed > maxAllowed) {
    const scale = maxAllowed / speed;
    state.velocityX *= scale;
    state.velocityY *= scale;
  }

  // ---- Integrate ----
  state.rotation += state.angularVelocity * dt;
  state.x += state.velocityX * dt;
  state.y += state.velocityY * dt;
}

/** Get forward direction vector. */
export function getForward(state: CarState): { x: number; y: number } {
  return { x: Math.cos(state.rotation), y: Math.sin(state.rotation) };
}

/** Get speed magnitude. */
export function getSpeed(state: CarState): number {
  return Math.sqrt(
    state.velocityX * state.velocityX + state.velocityY * state.velocityY,
  );
}

/** Get lateral (sideways) speed — used to trigger drift visual effects. */
export function getLateralSpeed(state: CarState): number {
  const forwardX = Math.cos(state.rotation);
  const forwardY = Math.sin(state.rotation);
  const forwardSpeed =
    state.velocityX * forwardX + state.velocityY * forwardY;
  const lateralX = state.velocityX - forwardX * forwardSpeed;
  const lateralY = state.velocityY - forwardY * forwardSpeed;
  return Math.sqrt(lateralX * lateralX + lateralY * lateralY);
}
