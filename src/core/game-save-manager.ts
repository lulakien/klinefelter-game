/**
 * Game Save Manager - Auto-save and restore game state.
 *
 * Provides utilities for serializing game state to localStorage
 * and restoring on mount with user confirmation.
 */

const SAVE_PREFIX = "klinefelter-save-";
const SAVE_EXPIRY_DAYS = 7;

export interface GameSave<T = any> {
  gameId: string;
  timestamp: number;
  state: T;
  version: string;
}

function isSaveRecord<T>(value: unknown, gameId: string): value is GameSave<T> {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<GameSave<T>>;
  return (
    record.gameId === gameId &&
    typeof record.timestamp === "number" &&
    Number.isFinite(record.timestamp) &&
    typeof record.version === "string" &&
    "state" in record
  );
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
    console.warn("Failed to save game state:", error);
  }
}

/** Load game state from localStorage */
export function loadGameState<T>(gameId: string): GameSave<T> | null {
  try {
    const raw = localStorage.getItem(SAVE_PREFIX + gameId);
    if (!raw) return null;

    const save = JSON.parse(raw);
    if (!isSaveRecord<T>(save, gameId)) {
      clearGameState(gameId);
      return null;
    }

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
      const state = getState();
      if (shouldSave(state)) {
        saveGameState(this.gameId, state, this.version);
      } else {
        clearGameState(this.gameId);
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
