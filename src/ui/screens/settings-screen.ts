import { getSettings, updateSettings } from "../../settings/settings-store.js";
import type { QualityMode } from "../../shared/game-types.js";

/**
 * Settings screen — profile nickname, quality mode, audio, FPS, controls.
 */

export function renderSettingsScreen(container: HTMLElement): void {
  const settings = getSettings();

  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "settings-screen";

  wrapper.innerHTML = `
    <h1 class="screen-title">Settings</h1>

    <section class="settings-section">
      <h2>Profile</h2>
      <label class="setting-row setting-row--stacked">
        <span class="setting-label">Nickname</span>
        <input type="text" id="setting-nickname" value="${escapeHtml(settings.nickname)}" placeholder="Player" class="nickname-input" maxlength="24" autocomplete="nickname" />
      </label>
    </section>

    <section class="settings-section">
      <h2>Quality Mode</h2>
      <div class="toggle-group" id="quality-toggle">
        <button class="toggle-btn ${settings.qualityMode === "ultra-low" ? "toggle-btn--active" : ""}"
                data-value="ultra-low">Ultra Low</button>
        <button class="toggle-btn ${settings.qualityMode === "high-quality" ? "toggle-btn--active" : ""}"
                data-value="high-quality">High Quality</button>
      </div>
    </section>

    <section class="settings-section">
      <h2>Audio</h2>
      <label class="setting-row">
        <span>Sound Effects</span>
        <input type="checkbox" id="setting-sfx" ${settings.soundEffectsEnabled ? "checked" : ""} />
      </label>
      <label class="setting-row">
        <span>Music</span>
        <input type="checkbox" id="setting-music" ${settings.musicEnabled ? "checked" : ""} />
      </label>
    </section>

    <section class="settings-section">
      <h2>Data & Offline</h2>
      <label class="setting-row">
        <span>Show estimated file sizes</span>
        <input type="checkbox" id="setting-sizes" ${settings.showEstimatedSizes ? "checked" : ""} />
      </label>
      <label class="setting-row">
        <span>Manual update checks only</span>
        <input type="checkbox" id="setting-manual-updates" ${settings.manualUpdateChecksOnly ? "checked" : ""} />
      </label>
    </section>

    <section class="settings-section">
      <h2>Performance</h2>
      <label class="setting-row">
        <span>Reduced Motion</span>
        <input type="checkbox" id="setting-reduced-motion" ${settings.reducedMotion ? "checked" : ""} />
      </label>
    </section>

    <div class="settings-actions">
      <a class="btn btn--secondary" href="#/">Back to Home</a>
    </div>
  `;

  container.appendChild(wrapper);

  // Wire up event listeners
  bindSettingsEvents();
}

function bindSettingsEvents(): void {
  // Nickname input
  const nicknameInput = document.getElementById("setting-nickname") as HTMLInputElement | null;
  if (nicknameInput) {
    // Save on input change (reactive)
    nicknameInput.addEventListener("input", () => {
      updateSettings({ nickname: normalizeNickname(nicknameInput.value) });
    });
  }

  // Quality mode toggle
  const toggleGroup = document.getElementById("quality-toggle");
  if (toggleGroup) {
    toggleGroup.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(".toggle-btn");
      if (!btn) return;
      const value = btn.getAttribute("data-value") as QualityMode;
      if (value) {
        updateSettings({ qualityMode: value });
        // Update active state visually
        toggleGroup.querySelectorAll(".toggle-btn").forEach((b) => {
          b.classList.toggle(
            "toggle-btn--active",
            b.getAttribute("data-value") === value,
          );
        });
      }
    });
  }

  // Checkbox bindings
  bindCheckbox("setting-sfx", "soundEffectsEnabled");
  bindCheckbox("setting-music", "musicEnabled");
  bindCheckbox("setting-sizes", "showEstimatedSizes");
  bindCheckbox("setting-manual-updates", "manualUpdateChecksOnly");
  bindCheckbox("setting-reduced-motion", "reducedMotion");
}

function bindCheckbox(id: string, key: string): void {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el) return;
  el.addEventListener("change", () => {
    updateSettings({ [key]: el.checked });
  });
}

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

function normalizeNickname(value: string): string {
  const nickname = value.trim().replace(/\s+/g, " ");
  return nickname || "Player";
}
