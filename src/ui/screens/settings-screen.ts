import { getSettings, updateSettings } from "../../settings/settings-store.js";
import { exportErrorLogs, getErrorCount, clearErrorLogs } from "../../core/error-logger.js";
import {
  clearPerformanceRecords,
  exportPerformanceReport,
  getPerformanceSummary,
} from "../../core/performance-monitor.js";
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
      <h2>Appearance</h2>
      <label class="setting-row">
        <span>Dark Mode</span>
        <input type="checkbox" id="setting-dark-mode" ${settings.darkMode ? "checked" : ""} />
      </label>
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
      <label class="setting-row setting-row--stacked">
        <span class="setting-label">Target FPS</span>
        <select id="setting-target-fps" class="nickname-input">
          <option value="30" ${settings.targetFps === 30 ? "selected" : ""}>30 FPS</option>
          <option value="60" ${settings.targetFps === 60 ? "selected" : ""}>60 FPS</option>
          <option value="120" ${settings.targetFps === 120 ? "selected" : ""}>120 FPS</option>
        </select>
      </label>
      <div class="settings-note" id="performance-summary">
        ${renderPerformanceSummary()}
      </div>
    </section>

    <div class="settings-actions">
      <button class="btn btn--secondary" id="btn-export-errors" style="margin-right: 8px;">Report Bug</button>
      <button class="btn btn--secondary" id="btn-export-performance" style="margin-right: 8px;">Performance Report</button>
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
  bindCheckbox("setting-dark-mode", "darkMode");
  bindCheckbox("setting-sfx", "soundEffectsEnabled");
  bindCheckbox("setting-music", "musicEnabled");
  bindCheckbox("setting-sizes", "showEstimatedSizes");
  bindCheckbox("setting-manual-updates", "manualUpdateChecksOnly");
  bindCheckbox("setting-reduced-motion", "reducedMotion");
  bindTargetFps();

  // Export errors button
  const exportBtn = document.getElementById("btn-export-errors") as HTMLButtonElement | null;
  if (exportBtn) {
    const errorCount = getErrorCount();
    if (errorCount > 0) {
      exportBtn.textContent = `Report Bug (${errorCount} errors)`;
    }

    exportBtn.addEventListener("click", () => {
      const logs = exportErrorLogs();
      const blob = new Blob([logs], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `klinefelter-errors-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // Ask if user wants to clear logs after export
      if (confirm("Error log exported. Clear the error log?")) {
        clearErrorLogs();
        exportBtn.textContent = "Report Bug";
      }
    });
  }

  const perfBtn = document.getElementById("btn-export-performance") as HTMLButtonElement | null;
  if (perfBtn) {
    perfBtn.addEventListener("click", () => {
      const report = exportPerformanceReport();
      const blob = new Blob([report], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `klinefelter-performance-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      if (confirm("Performance report exported. Clear performance records?")) {
        clearPerformanceRecords();
        const summary = document.getElementById("performance-summary");
        if (summary) summary.textContent = renderPerformanceSummary();
      }
    });
  }
}

function bindCheckbox(id: string, key: string): void {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el) return;
  el.addEventListener("change", () => {
    updateSettings({ [key]: el.checked });
  });
}

function bindTargetFps(): void {
  const el = document.getElementById("setting-target-fps") as HTMLSelectElement | null;
  if (!el) return;
  el.addEventListener("change", () => {
    const value = Number(el.value);
    if (value === 30 || value === 60 || value === 120) {
      updateSettings({ targetFps: value });
    }
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

function renderPerformanceSummary(): string {
  const summary = getPerformanceSummary();
  if (summary.count === 0) return "No performance records yet.";
  const load = summary.avgLoadMs ? `${summary.avgLoadMs}ms avg load` : "no load samples";
  const session = summary.avgSessionMs ? `${Math.round(summary.avgSessionMs / 1000)}s avg session` : "no session samples";
  return `${summary.count} records · ${load} · ${session}`;
}
