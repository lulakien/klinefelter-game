import type { AppSettings, QualityMode } from "../shared/game-types.js";
import { logError } from "../core/error-logger.js";

/**
 * Simple settings store backed by localStorage.
 *
 * Settings are read on startup and written immediately on change.
 * A thin reactive wrapper notifies listeners when values change.
 */

const STORAGE_KEY = "klinefelter-settings";

const DEFAULTS: AppSettings = {
  nickname: "Player",
  qualityMode: "high-quality",
  audioEnabled: true,
  soundEffectsEnabled: true,
  musicEnabled: false,
  reducedMotion: false,
  targetFps: 60,
  vibrationEnabled: false,
  manualUpdateChecksOnly: true,
  showEstimatedSizes: true,
  darkMode: false,
};

type SettingsListener = (settings: AppSettings) => void;

let settings: AppSettings;
const listeners = new Set<SettingsListener>();

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.getPrototypeOf(parsed) === Object.prototype) {
        const safe = Object.keys(DEFAULTS).reduce((acc, key) => {
          const typedKey = key as keyof AppSettings;
          if (key in parsed && typeof parsed[key] === typeof DEFAULTS[typedKey]) {
            acc[typedKey] = parsed[key];
          }
          return acc;
        }, {} as Partial<AppSettings>);
        return { ...DEFAULTS, ...safe };
      }
    }
  } catch {
    // Corrupt storage — fall through to defaults
  }
  return { ...DEFAULTS };
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    const isQuota = (error as any)?.name === "QuotaExceededError";
    logError(
      error instanceof Error ? error : new Error("Settings save failed"),
      `settings-store.save${isQuota ? " [QuotaExceededError]" : ""}`
    );
  }
}

function notify(): void {
  const snapshot = getSettings();
  document.documentElement.classList.toggle("reduced-motion", snapshot.reducedMotion);
  document.documentElement.classList.toggle("dark-mode", snapshot.darkMode);
  applyQualityClass(snapshot.qualityMode);
  for (const fn of listeners) {
    fn(snapshot);
  }
}

// Initialize
settings = load();
document.documentElement.classList.toggle("reduced-motion", settings.reducedMotion);
document.documentElement.classList.toggle("dark-mode", settings.darkMode);
applyQualityClass(settings.qualityMode);

/** Get a frozen snapshot of current settings. */
export function getSettings(): AppSettings {
  return { ...settings };
}

/** Update one or more settings fields. */
export function updateSettings(patch: Partial<AppSettings>): void {
  settings = { ...settings, ...patch };
  save();
  notify();
}

/** Get the current quality mode. */
export function getQualityMode(): QualityMode {
  return settings.qualityMode;
}

/** Set quality mode and persist. */
export function setQualityMode(mode: QualityMode): void {
  updateSettings({ qualityMode: mode });
}

/** Subscribe to setting changes. Returns unsubscribe function. */
export function onSettingsChange(fn: SettingsListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function applyQualityClass(mode: QualityMode): void {
  document.documentElement.classList.toggle("quality-ultra-low", mode === "ultra-low");
  document.documentElement.classList.toggle("quality-high", mode === "high-quality");
}
