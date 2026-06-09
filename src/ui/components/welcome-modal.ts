const ONBOARDING_KEY = "klinefelter-onboarding-seen";

export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "true";
  } catch {
    return false;
  }
}

export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, "true");
  } catch {
    // Onboarding is non-critical.
  }
}

export function showWelcomeModal(force = false): void {
  if (!force && hasSeenWelcome()) return;
  if (document.getElementById("welcome-modal")) return;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "welcome-modal";
  overlay.innerHTML = `
    <div class="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div class="welcome-modal__header">
        <h2 id="welcome-title">Welcome to Klinefelter Game</h2>
        <button class="modal-close" type="button" aria-label="Close welcome">×</button>
      </div>
      <div class="welcome-modal__body">
        <div class="welcome-step">
          <strong>Play offline</strong>
          <span>Download games once and keep playing when the connection gets spotty.</span>
        </div>
        <div class="welcome-step">
          <strong>Track progress</strong>
          <span>Your high scores stay local on this device.</span>
        </div>
        <div class="welcome-step">
          <strong>Customize feel</strong>
          <span>Adjust dark mode, audio, quality, and FPS in Settings.</span>
        </div>
      </div>
      <div class="welcome-modal__actions">
        <button class="btn btn--primary" type="button" id="welcome-start">Start Playing</button>
      </div>
    </div>
  `;

  const close = () => {
    markWelcomeSeen();
    overlay.remove();
  };

  overlay.querySelector(".modal-close")?.addEventListener("click", close);
  overlay.querySelector("#welcome-start")?.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  window.addEventListener("keydown", function onKeyDown(event) {
    if (event.key === "Escape" && document.getElementById("welcome-modal")) {
      window.removeEventListener("keydown", onKeyDown);
      close();
    }
  });

  document.body.appendChild(overlay);
  (overlay.querySelector("#welcome-start") as HTMLButtonElement | null)?.focus();
}
