/**
 * Scoring system for Drift Arena.
 *
 *   +10   token collected
 *   +25   bumping a bot
 *   +1    per second survived
 *   drift chain multiplier
 *   bonus for near misses
 */

import type { CarState } from "./physics/car-physics.js";
import { getLateralSpeed } from "./physics/car-physics.js";

export interface ScoreState {
  score: number;
  tokensCollected: number;
  botsBumped: number;
  survivalTime: number;
  driftChainMultiplier: number;
  driftChainTimer: number;
  maxDriftChain: number;
  nearMisses: number;
  roundActive: boolean;
  roundDuration: number; // seconds
  roundTimeRemaining: number;
}

const TOKEN_SCORE = 10;
const BOT_BUMP_SCORE = 25;
const SURVIVAL_SCORE_RATE = 1; // per second
const NEAR_MISS_SCORE = 15;
const DRIFT_CHAIN_TIMEOUT = 1.5; // seconds before chain resets

/** Create a fresh score state for a new round. */
export function createScoreState(roundDuration = 90): ScoreState {
  return {
    score: 0,
    tokensCollected: 0,
    botsBumped: 0,
    survivalTime: 0,
    driftChainMultiplier: 1,
    driftChainTimer: 0,
    maxDriftChain: 1,
    nearMisses: 0,
    roundActive: true,
    roundDuration,
    roundTimeRemaining: roundDuration,
  };
}

/** Call every frame to update timers. */
export function updateScoring(state: ScoreState, dt: number): void {
  if (!state.roundActive) return;

  state.roundTimeRemaining -= dt;

  // Survival score (per second)
  state.survivalTime += dt;
  // Award survival points in discrete chunks internally
  // (we just accumulate time; score is computed on read)

  // Drift chain timeout
  if (state.driftChainTimer > 0) {
    state.driftChainTimer -= dt;
    if (state.driftChainTimer <= 0) {
      state.driftChainMultiplier = 1;
      state.driftChainTimer = 0;
    }
  }

  if (state.roundTimeRemaining <= 0) {
    state.roundTimeRemaining = 0;
    state.roundActive = false;
  }
}

/** Record token collection. */
export function collectToken(state: ScoreState): void {
  if (!state.roundActive) return;
  state.tokensCollected++;
  state.score += TOKEN_SCORE * state.driftChainMultiplier;
}

/** Record bot bump. */
export function bumpBot(state: ScoreState): void {
  if (!state.roundActive) return;
  state.botsBumped++;
  state.score += BOT_BUMP_SCORE * state.driftChainMultiplier;
}

/** Record near miss. */
export function nearMiss(state: ScoreState): void {
  if (!state.roundActive) return;
  state.nearMisses++;
  state.score += NEAR_MISS_SCORE;
}

/** Check and update drift chain based on car state. */
export function updateDriftChain(state: ScoreState, car: CarState): void {
  if (!state.roundActive) return;

  const lateralSpeed = getLateralSpeed(car);
  const isDrifting = lateralSpeed > 80;

  if (isDrifting) {
    state.driftChainTimer = DRIFT_CHAIN_TIMEOUT;
    // Increase multiplier gradually while drifting
    state.driftChainMultiplier = Math.min(
      5,
      state.driftChainMultiplier + 0.005,
    );
    if (state.driftChainMultiplier > state.maxDriftChain) {
      state.maxDriftChain = state.driftChainMultiplier;
    }
  }
}

/** Check for near misses between player car and obstacles/bots. */
export function checkNearMisses(
  _state: ScoreState,
  _playerCar: CarState,
  _botCars: CarState[],
): void {
  // Near miss detection is handled by the main game loop
  // since it needs frame-to-frame distance tracking
}

/** Get final score including survival bonus. */
export function getFinalScore(state: ScoreState): number {
  const survivalBonus = Math.floor(state.survivalTime) * SURVIVAL_SCORE_RATE;
  return state.score + survivalBonus;
}

/** Format score for display. */
export function formatScore(score: number): string {
  return score.toLocaleString();
}
