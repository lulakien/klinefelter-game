import { beforeEach, describe, expect, it, vi } from "vitest";

describe("settings-store", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    document.documentElement.className = "";
  });

  it("loads defaults and persists updates", async () => {
    const store = await import("../../src/settings/settings-store.js");

    expect(store.getSettings().targetFps).toBe(60);
    store.updateSettings({ darkMode: true, targetFps: 30 });

    expect(store.getSettings().darkMode).toBe(true);
    expect(document.documentElement.classList.contains("dark-mode")).toBe(true);
    expect(JSON.parse(localStorage.getItem("klinefelter-settings") || "{}").targetFps).toBe(30);
  });

  it("falls back to defaults for corrupt settings storage", async () => {
    localStorage.setItem("klinefelter-settings", "{broken");

    const store = await import("../../src/settings/settings-store.js");

    expect(store.getSettings().nickname).toBe("Player");
    expect(store.getSettings().qualityMode).toBe("high-quality");
  });
});
