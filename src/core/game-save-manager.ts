/**
 * Game Save Manager - Auto-save and restore game state.
 *
 * Provides utilities for serializing game state to localStorage
 * and restoring on mount with user confirmation.
 */

import { logError } from "./error-logger.js";

const SAVE_PREFIX = "klinefelter-save-";
const SAVE_EXPIRY_DAYS = 7;

export interface GameSave<T = any> {
  gameId: string;
  timestamp: number;
  state: T;
  version: string;
}

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isSafeJsonValue(value: unknown): boolean {
  if (!value || typeof value !== "object") return true;
  if (Array.isArray(value)) return value.every(isSafeJsonValue);
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;

  return Object.entries(value).every(([key, child]) => (
    !UNSAFE_KEYS.has(key) && isSafeJsonValue(child)
  ));
}

function isSaveRecord<T>(value: unknown, gameId: string): value is GameSave<T> {
  if (!value || typeof value !== "object") return false;
  if (!isSafeJsonValue(value)) return false;
  const record = value as Partial<GameSave<T>>;
  if (!(
    record.gameId === gameId &&
    typeof record.timestamp === "number" &&
    Number.isFinite(record.timestamp) &&
    typeof record.version === "string" &&
    "state" in record
  )) return false;

  return true;
}

/** Save game state to localStorage */
export function saveGameState<T>(gameId: string, state: T, version: string = "1.0.0"): void {
  try {
    const save: GameSave<T> = {
      gameId,
      timestamp: Date.now(),
      state,
      version,
    };

    localStorage.setItem(SAVE_PREFIX + gameId, JSON.stringify(save));
  } catch (error) {
    const isQuota = (error as any)?.name === "QuotaExceededError";
    logError(
      error instanceof Error ? error : new Error("Game save failed"),
      `game-save-manager.saveGameState gameId=${gameId}${isQuota ? " [QuotaExceededError]" : ""}`
    );
  }
}

/** Load game state from localStorage */
export function loadGameState<T>(gameId: string): GameSave<T> | null {
  try {
    const raw = localStorage.getItem(SAVE_PREFIX + gameId);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!isSaveRecord<T>(parsed, gameId)) {
      clearGameState(gameId);
      return null;
    }
    const save = JSON.parse(JSON.stringify(parsed));

    // Check if save is expired (7 days)
    const age = Date.now() - save.timestamp;
    const maxAge = SAVE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    if (age > maxAge) {
      clearGameState(gameId);
      return null;
    }

    return save;
  } catch (error) {
    console.warn("Failed to load game state:", error);
    return null;
  }
}

/** Clear saved game state */
export function clearGameState(gameId: string): void {
  try {
    localStorage.removeItem(SAVE_PREFIX + gameId);
  } catch {
    // Ignore
  }
}

/** Check if a save exists for a game */
export function hasSavedGame(gameId: string): boolean {
  return loadGameState(gameId) !== null;
}

/** Get formatted time since save */
export function getSaveAge(save: GameSave): string {
  const ageMs = Date.now() - save.timestamp;
  const ageMinutes = Math.floor(ageMs / 60000);

  if (ageMinutes < 1) return "just now";
  if (ageMinutes < 60) return `${ageMinutes} minute${ageMinutes > 1 ? "s" : ""} ago`;

  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours < 24) return `${ageHours} hour${ageHours > 1 ? "s" : ""} ago`;

  const ageDays = Math.floor(ageHours / 24);
  return `${ageDays} day${ageDays > 1 ? "s" : ""} ago`;
}

/** Auto-save manager for periodic saves */
export class AutoSaveManager<T> {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private gameId: string;
  private version: string;
  private errorCount = 0;
  private readonly MAX_ERRORS = 5;

  constructor(gameId: string, version: string = "1.0.0") {
    this.gameId = gameId;
    this.version = version;
  }

  /** Start auto-saving every N seconds. */
  start(
    getState: () => T,
    intervalSeconds: number = 5,
    shouldSave: (state: T) => boolean = Boolean,
  ): void {
    this.stop(); // Clear any existing interval

    this.intervalId = setInterval(() => {
      try {
        const state = getState();
        if (shouldSave(state)) {
          saveGameState(this.gameId, state, this.version);
        } else {
          clearGameState(this.gameId);
        }
        this.errorCount = 0;
      } catch (error) {
        this.errorCount++;
        logError(
          error instanceof Error ? error : new Error("AutoSave failed"),
          `AutoSaveManager gameId=${this.gameId} errorCount=${this.errorCount}`
        );
        if (this.errorCount >= this.MAX_ERRORS) {
          this.stop();
        }
      }
    }, intervalSeconds * 1000);
  }

  /** Stop auto-saving */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Clear the save and stop auto-saving */
  clearAndStop(): void {
    this.stop();
    clearGameState(this.gameId);
  }
}
