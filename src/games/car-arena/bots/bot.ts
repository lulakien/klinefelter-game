/**
 * Simple bot AI using steering behaviors.
 *
 * Bot types:
 *   wander   — drives toward random waypoints
 *   chaser   — slowly follows the player
 *   coward   — runs away from the player
 *   bumper   — attempts to collide with the player
 */

import type { CarState, CarInput, CarConfig } from "../physics/car-physics.js";
import { updateCar } from "../physics/car-physics.js";
import { resolveWallCollision, resolveObstacleCollisions } from "../physics/collision.js";
import type { Arena } from "../arena.js";

export type BotType = "wander" | "chaser" | "coward" | "bumper";

export interface BotState {
  car: CarState;
  type: BotType;
  waypointX: number;
  waypointY: number;
  waypointTimer: number;
  stuckTimer: number;
  lastX: number;
  lastY: number;
  config: CarConfig;
}

const BOT_CONFIG: CarConfig = {
  acceleration: 600,
  maxSpeed: 280,
  brakeForce: 400,
  reverseMaxSpeed: 100,
  turnRate: 3.0,
  grip: 0.9,
  driftGrip: 0.35,
  linearDamping: 0.94,
  angularDamping: 0.84,
  collisionRadius: 22,
  carWidth: 44,
  carHeight: 24,
};

/** Create a bot at a given position. */
export function createBot(
  x: number,
  y: number,
  type: BotType,
): BotState {
  return {
    car: {
      x,
      y,
      rotation: Math.random() * Math.PI * 2,
      velocityX: 0,
      velocityY: 0,
      angularVelocity: 0,
    },
    type,
    waypointX: x,
    waypointY: y,
    waypointTimer: 0,
    stuckTimer: 0,
    lastX: x,
    lastY: y,
    config: { ...BOT_CONFIG },
  };
}

/** Update a single bot. */
export function updateBot(
  bot: BotState,
  playerState: CarState,
  arena: Arena,
  dt: number,
): void {
  const input = computeBotInput(bot, playerState, arena, dt);
  updateCar(bot.car, input, bot.config, dt);

  // Collision with arena
  resolveWallCollision(bot.car, arena.bounds, bot.config.collisionRadius);
  resolveObstacleCollisions(bot.car, arena.obstacles, bot.config.collisionRadius);

  // Detect if stuck
  const moved = Math.hypot(
    bot.car.x - bot.lastX,
    bot.car.y - bot.lastY,
  );
  if (moved < 5) {
    bot.stuckTimer += dt;
  } else {
    bot.stuckTimer = 0;
  }
  bot.lastX = bot.car.x;
  bot.lastY = bot.car.y;
}

/** Compute input for a bot based on its type. */
function computeBotInput(
  bot: BotState,
  player: CarState,
  arena: Arena,
  dt: number,
): CarInput {
  const input: CarInput = {
    throttle: 0,
    brake: 0,
    steer: 0,
    drift: false,
  };

  // If stuck, try reversing
  if (bot.stuckTimer > 0.8) {
    input.throttle = 0;
    input.brake = 1; // reverse
    input.steer = Math.sin(bot.stuckTimer * 5) * 0.5;
    return input;
  }

  // Pick a target based on bot type
  let targetX: number;
  let targetY: number;
  const dx = player.x - bot.car.x;
  const dy = player.y - bot.car.y;
  const distToPlayer = Math.sqrt(dx * dx + dy * dy);

  switch (bot.type) {
    case "chaser":
      // Follow the player
      targetX = player.x;
      targetY = player.y;
      // Drift when close for style
      if (distToPlayer < 200) {
        input.drift = Math.random() < 0.01;
      }
      break;

    case "coward":
      // Run away from player
      if (distToPlayer < 400) {
        targetX = bot.car.x - dx;
        targetY = bot.car.y - dy;
      } else {
        // Wander when safe
        bot.waypointTimer -= dt;
        if (bot.waypointTimer <= 0) {
          pickRandomWaypoint(bot, arena);
        }
        targetX = bot.waypointX;
        targetY = bot.waypointY;
      }
      break;

    case "bumper":
      // Chase aggressively and drift
      targetX = player.x;
      targetY = player.y;
      if (distToPlayer < 150) {
        input.drift = true;
      }
      break;

    case "wander":
    default:
      // Wander toward random waypoints
      bot.waypointTimer -= dt;
      if (bot.waypointTimer <= 0) {
        pickRandomWaypoint(bot, arena);
      }
      targetX = bot.waypointX;
      targetY = bot.waypointY;
      break;
  }

  // Steer toward target
  steerToward(bot, targetX, targetY, input);

  // Default throttle
  if (input.throttle === 0 && input.brake === 0) {
    input.throttle = 0.8;
  }

  // Brake if going too fast toward a wall
  const margin = 80;
  const predictionX = bot.car.x + bot.car.velocityX * 0.5;
  const predictionY = bot.car.y + bot.car.velocityY * 0.5;
  if (
    predictionX < arena.bounds.minX + margin ||
    predictionX > arena.bounds.maxX - margin ||
    predictionY < arena.bounds.minY + margin ||
    predictionY > arena.bounds.maxY - margin
  ) {
    input.throttle = 0.3;
    if (Math.random() < 0.3) input.brake = 0.5;
  }

  return input;
}

/** Steer the bot toward a target point. */
function steerToward(
  bot: BotState,
  targetX: number,
  targetY: number,
  input: CarInput,
): void {
  const dx = targetX - bot.car.x;
  const dy = targetY - bot.car.y;
  const angleToTarget = Math.atan2(dy, dx);

  // Angle difference
  let angleDiff = angleToTarget - bot.car.rotation;
  // Normalize to [-π, π]
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  input.steer = Math.max(-1, Math.min(1, angleDiff / (Math.PI * 0.4)));
}

/** Pick a random waypoint within the arena. */
function pickRandomWaypoint(bot: BotState, arena: Arena): void {
  bot.waypointX =
    arena.bounds.minX + Math.random() * (arena.bounds.maxX - arena.bounds.minX);
  bot.waypointY =
    arena.bounds.minY + Math.random() * (arena.bounds.maxY - arena.bounds.minY);
  bot.waypointTimer = 1.5 + Math.random() * 2.5;
}
