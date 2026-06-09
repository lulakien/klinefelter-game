/** Core shared types for the Klinefelter game portal. */

// ---- Quality Mode ----

export type QualityMode = "ultra-low" | "high-quality";

// ---- Game Metadata ----

export type OfflineSupport = "none" | "partial" | "full";

export type MultiplayerSupport =
  | "none"
  | "same-device"
  | "online-turn-based"
  | "online-realtime";

export type ControlType = "keyboard" | "touch" | "same-device" | "gamepad";

export interface GameMeta {
  /** Stable internal identifier, e.g. "car-arena" */
  id: string;
  /** Display name, e.g. "Drift Arena" */
  name: string;
  /** Short user-facing description */
  description: string;
  /** Game package version */
  version: string;
  /** Offline capability */
  offlineSupport: OfflineSupport;
  /** Multiplayer capability */
  multiplayerSupport: MultiplayerSupport;
  /** Estimated low-quality package size in bytes */
  estimatedSizeLow: number;
  /** Estimated high-quality package size in bytes */
  estimatedSizeHigh: number;
  /** Whether Ultra Low Mode is supported */
  supportsUltraLow: boolean;
  /** Whether High Quality Mode is supported */
  supportsHighQuality: boolean;
  /** Supported control methods */
  controls: ControlType[];
  /** Whether a backend is required */
  requiresBackend: boolean;
  /** Lazy-loaded module path (relative to src/) */
  entryModule: string;
  /** Tags for filtering */
  tags: string[];
}

// ---- Game Offline Status ----

export type GameOfflineStatus =
  | "not-downloaded"
  | "offline-ready"
  | "partial-download"
  | "update-available"
  | "needs-update"
  | "online-only"
  | "storage-removed";

// ---- App Routes ----

export type Route = "home" | "game" | "settings" | "offline" | "scores" | "stats";

export interface RouteState {
  route: Route;
  params: Record<string, string>;
}

// ---- Settings ----

export interface AppSettings {
  nickname: string;
  qualityMode: QualityMode;
  audioEnabled: boolean;
  soundEffectsEnabled: boolean;
  musicEnabled: boolean;
  reducedMotion: boolean;
  targetFps: number;
  vibrationEnabled: boolean;
  manualUpdateChecksOnly: boolean;
  showEstimatedSizes: boolean;
  darkMode: boolean;
}
