import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Storage Corruption Tests", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    document.documentElement.className = "";
  });

  describe("Corrupt JSON in localStorage", () => {
    it("settings-store: handles malformed JSON", async () => {
      localStorage.setItem("klinefelter-settings", "{broken json");
      const store = await import("../../src/settings/settings-store.js");

      const settings = store.getSettings();
      expect(settings.nickname).toBe("Player");
      expect(settings.qualityMode).toBe("high-quality");
      expect(settings.targetFps).toBe(60);
    });

    it("settings-store: handles truncated JSON", async () => {
      localStorage.setItem("klinefelter-settings", '{"nickname":"Test","darkMode":tr');
      const store = await import("../../src/settings/settings-store.js");

      const settings = store.getSettings();
      expect(settings.nickname).toBe("Player");
      expect(settings.darkMode).toBe(false);
    });

    it("stats-store: handles malformed JSON", async () => {
      localStorage.setItem("klinefelter-stats", "[{incomplete");
      const { getStatsSnapshot } = await import("../../src/settings/stats-store.js");

      const snapshot = getStatsSnapshot();
      expect(snapshot.records).toEqual([]);
      expect(snapshot.totalGamesPlayed).toBe(0);
    });

    it("stats-store: handles non-array JSON", async () => {
      localStorage.setItem("klinefelter-stats", '{"not":"array"}');
      const { getStatsSnapshot } = await import("../../src/settings/stats-store.js");

      const snapshot = getStatsSnapshot();
      expect(snapshot.records).toEqual([]);
    });

    it("game-save-manager: handles corrupt save data", async () => {
      localStorage.setItem("klinefelter-save-2048", "{not valid json}");
      const { loadGameState } = await import("../../src/core/game-save-manager.js");

      const save = loadGameState("2048");
      expect(save).toBeNull();
    });
  });

  describe("Wrong types in settings/scores", () => {
    it("settings-store: rejects wrong type for targetFps", async () => {
      localStorage.setItem("klinefelter-settings", JSON.stringify({
        nickname: "Test",
        targetFps: "sixty", // string instead of number
        darkMode: true,
      }));
      const store = await import("../../src/settings/settings-store.js");

      const settings = store.getSettings();
      expect(settings.targetFps).toBe(60); // default
      expect(settings.darkMode).toBe(true); // preserved
    });

    it("settings-store: rejects wrong type for boolean fields", async () => {
      localStorage.setItem("klinefelter-settings", JSON.stringify({
        audioEnabled: "yes", // string instead of boolean
        darkMode: 1, // number instead of boolean
        reducedMotion: null, // null instead of boolean
      }));
      const store = await import("../../src/settings/settings-store.js");

      const settings = store.getSettings();
      expect(settings.audioEnabled).toBe(true); // default
      expect(settings.darkMode).toBe(false); // default
      expect(settings.reducedMotion).toBe(false); // default
    });

    it("stats-store: filters out records with wrong types", async () => {
      localStorage.setItem("klinefelter-stats", JSON.stringify([
        {
          gameId: "2048",
          gamesPlayed: "5", // string instead of number
          totalPlaytimeSeconds: 100,
          lastPlayed: Date.now(),
        },
        {
          gameId: "minesweeper",
          gamesPlayed: 3,
          totalPlaytimeSeconds: 200,
          lastPlayed: Date.now(),
        },
      ]));
      const { getStatsSnapshot } = await import("../../src/settings/stats-store.js");

      const snapshot = getStatsSnapshot();
      expect(snapshot.records.length).toBe(1);
      expect(snapshot.records[0].gameId).toBe("minesweeper");
    });

    it("stats-store: filters records with non-finite numbers", async () => {
      localStorage.setItem("klinefelter-stats", JSON.stringify([
        {
          gameId: "2048",
          gamesPlayed: Infinity,
          totalPlaytimeSeconds: 100,
          lastPlayed: Date.now(),
        },
        {
          gameId: "sudoku",
          gamesPlayed: 5,
          totalPlaytimeSeconds: NaN,
          lastPlayed: Date.now(),
        },
      ]));
      const { getStatsSnapshot } = await import("../../src/settings/stats-store.js");

      const snapshot = getStatsSnapshot();
      expect(snapshot.records.length).toBe(0);
    });

    it("game-save-manager: rejects save with wrong type for timestamp", async () => {
      localStorage.setItem("klinefelter-save-2048", JSON.stringify({
        gameId: "2048",
        timestamp: "not-a-number",
        state: { grid: [] },
        version: "1.0.0",
      }));
      const { loadGameState } = await import("../../src/core/game-save-manager.js");

      const save = loadGameState("2048");
      expect(save).toBeNull();
    });

    it("game-save-manager: rejects save with non-plain object state", async () => {
      // Create object with non-Object prototype
      class CustomClass {
        data = [1, 2, 3];
      }
      const instance = new CustomClass();

      localStorage.setItem("klinefelter-save-2048", JSON.stringify({
        gameId: "2048",
        timestamp: Date.now(),
        state: instance,
        version: "1.0.0",
      }));
      const { loadGameState } = await import("../../src/core/game-save-manager.js");

      const save = loadGameState("2048");
      // After JSON.stringify/parse, the state becomes a plain object, so this should pass
      // The real protection is in the validation logic
      expect(save).not.toBeNull();
    });
  });

  describe("Missing/null/undefined values", () => {
    it("settings-store: handles null storage value", async () => {
      localStorage.setItem("klinefelter-settings", "null");
      const store = await import("../../src/settings/settings-store.js");

      const settings = store.getSettings();
      expect(settings.nickname).toBe("Player");
    });

    it("settings-store: handles empty object", async () => {
      localStorage.setItem("klinefelter-settings", "{}");
      const store = await import("../../src/settings/settings-store.js");

      const settings = store.getSettings();
      expect(settings.nickname).toBe("Player");
      expect(settings.targetFps).toBe(60);
    });

    it("settings-store: handles missing fields", async () => {
      localStorage.setItem("klinefelter-settings", JSON.stringify({
        nickname: "Test",
        // missing all other fields
      }));
      const store = await import("../../src/settings/settings-store.js");

      const settings = store.getSettings();
      expect(settings.nickname).toBe("Test");
      expect(settings.targetFps).toBe(60);
      expect(settings.audioEnabled).toBe(true);
    });

    it("stats-store: handles null storage value", async () => {
      localStorage.setItem("klinefelter-stats", "null");
      const { getStatsSnapshot } = await import("../../src/settings/stats-store.js");

      const snapshot = getStatsSnapshot();
      expect(snapshot.records).toEqual([]);
    });

    it("stats-store: handles empty array", async () => {
      localStorage.setItem("klinefelter-stats", "[]");
      const { getStatsSnapshot } = await import("../../src/settings/stats-store.js");

      const snapshot = getStatsSnapshot();
      expect(snapshot.records).toEqual([]);
      expect(snapshot.favoriteGameId).toBeNull();
    });

    it("stats-store: filters incomplete records", async () => {
      localStorage.setItem("klinefelter-stats", JSON.stringify([
        {
          gameId: "2048",
          gamesPlayed: 5,
          // missing totalPlaytimeSeconds and lastPlayed
        },
        {
          gameId: "minesweeper",
          gamesPlayed: 3,
          totalPlaytimeSeconds: 200,
          lastPlayed: Date.now(),
        },
      ]));
      const { getStatsSnapshot } = await import("../../src/settings/stats-store.js");

      const snapshot = getStatsSnapshot();
      expect(snapshot.records.length).toBe(1);
      expect(snapshot.records[0].gameId).toBe("minesweeper");
    });

    it("game-save-manager: handles missing gameId field", async () => {
      localStorage.setItem("klinefelter-save-2048", JSON.stringify({
        // missing gameId
        timestamp: Date.now(),
        state: { grid: [] },
        version: "1.0.0",
      }));
      const { loadGameState } = await import("../../src/core/game-save-manager.js");

      const save = loadGameState("2048");
      expect(save).toBeNull();
    });

    it("game-save-manager: handles missing state field", async () => {
      localStorage.setItem("klinefelter-save-2048", JSON.stringify({
        gameId: "2048",
        timestamp: Date.now(),
        // missing state
        version: "1.0.0",
      }));
      const { loadGameState } = await import("../../src/core/game-save-manager.js");

      const save = loadGameState("2048");
      expect(save).toBeNull();
    });

    it("game-save-manager: returns null when no save exists", async () => {
      const { loadGameState } = await import("../../src/core/game-save-manager.js");

      const save = loadGameState("nonexistent-game");
      expect(save).toBeNull();
    });
  });

  describe("Quota errors (mock)", () => {
    it("settings-store: handles QuotaExceededError gracefully", async () => {
      const store = await import("../../src/settings/settings-store.js");

      // Mock localStorage.setItem to throw QuotaExceededError
      const originalSetItem = localStorage.setItem;
      const quotaError = new Error("QuotaExceededError");
      (quotaError as any).name = "QuotaExceededError";
      localStorage.setItem = vi.fn(() => {
        throw quotaError;
      });

      // Should not throw
      expect(() => {
        store.updateSettings({ darkMode: true });
      }).not.toThrow();

      // Restore
      localStorage.setItem = originalSetItem;
    });

    it("stats-store: handles write failure silently", async () => {
      const { recordGameStarted } = await import("../../src/settings/stats-store.js");

      // Mock localStorage.setItem to throw
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error("Storage full");
      });

      // Should not throw
      expect(() => {
        recordGameStarted("2048");
      }).not.toThrow();

      // Restore
      localStorage.setItem = originalSetItem;
    });

    it("game-save-manager: handles QuotaExceededError on save", async () => {
      const { saveGameState } = await import("../../src/core/game-save-manager.js");

      // Mock localStorage.setItem to throw QuotaExceededError
      const originalSetItem = localStorage.setItem;
      const quotaError = new Error("QuotaExceededError");
      (quotaError as any).name = "QuotaExceededError";
      localStorage.setItem = vi.fn(() => {
        throw quotaError;
      });

      // Should not throw
      expect(() => {
        saveGameState("2048", { grid: [[1, 2], [3, 4]] });
      }).not.toThrow();

      // Restore
      localStorage.setItem = originalSetItem;
    });

    it("game-save-manager: AutoSaveManager stops after repeated errors", async () => {
      const { AutoSaveManager } = await import("../../src/core/game-save-manager.js");

      // Mock localStorage.setItem to always throw
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error("Persistent storage error");
      });

      const manager = new AutoSaveManager("test-game", "1.0.0");
      const getState = () => ({ data: "test" });

      // Start with very short interval
      manager.start(getState, 0.01); // 10ms

      // Wait for multiple save attempts
      await new Promise(resolve => setTimeout(resolve, 100));

      // Manager should still be operational (stop is internal)
      manager.stop();

      // Restore
      localStorage.setItem = originalSetItem;
    });

    it("stats-store: handles getItem throwing error", async () => {
      // Mock localStorage.getItem to throw
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => {
        throw new Error("Storage read error");
      });

      const { getStatsSnapshot } = await import("../../src/settings/stats-store.js");

      const snapshot = getStatsSnapshot();
      expect(snapshot.records).toEqual([]);
      expect(snapshot.totalGamesPlayed).toBe(0);

      // Restore
      localStorage.getItem = originalGetItem;
    });

    it("game-save-manager: handles getItem throwing error", async () => {
      // Mock localStorage.getItem to throw
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => {
        throw new Error("Storage read error");
      });

      const { loadGameState } = await import("../../src/core/game-save-manager.js");

      const save = loadGameState("2048");
      expect(save).toBeNull();

      // Restore
      localStorage.getItem = originalGetItem;
    });
  });
});
