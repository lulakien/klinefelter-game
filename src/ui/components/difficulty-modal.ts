import type { GameMeta } from "../../shared/game-types.js";

export type DifficultyChoice = "easy" | "medium" | "hard" | "expert" | "beginner" | "intermediate";

const DIFFICULTY_KEY_PREFIX = "klinefelter-difficulty-";

const DIFFICULTY_OPTIONS: Record<string, DifficultyChoice[]> = {
  minesweeper: ["beginner", "intermediate", "expert"],
  "water-sort": ["easy", "medium", "hard", "expert"],
  memory: ["easy", "medium", "hard"],
  "tic-tac-toe": ["easy", "medium", "hard"],
  "connect-four": ["easy", "medium", "hard"],
};

export interface GameLaunchOptions {
  difficulty?: DifficultyChoice;
}

export function getDifficultyOptions(gameId: string): DifficultyChoice[] {
  return DIFFICULTY_OPTIONS[gameId] ?? [];
}

export function getSavedDifficulty(gameId: string): DifficultyChoice | undefined {
  const options = getDifficultyOptions(gameId);
  if (!options.length) return undefined;
  try {
    const raw = localStorage.getItem(DIFFICULTY_KEY_PREFIX + gameId) as DifficultyChoice | null;
    return raw && options.includes(raw) ? raw : options[Math.min(1, options.length - 1)];
  } catch {
    return options[Math.min(1, options.length - 1)];
  }
}

export function saveDifficulty(gameId: string, difficulty: DifficultyChoice): void {
  try {
    localStorage.setItem(DIFFICULTY_KEY_PREFIX + gameId, difficulty);
  } catch {
    // Non-critical preference.
  }
}

export function chooseDifficulty(game: GameMeta): Promise<GameLaunchOptions> {
  const options = getDifficultyOptions(game.id);
  if (!options.length) return Promise.resolve({});

  return new Promise((resolve) => {
    const selected = getSavedDifficulty(game.id) ?? options[0];
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "difficulty-modal";
    overlay.innerHTML = `
      <div class="welcome-modal difficulty-modal" role="dialog" aria-modal="true" aria-labelledby="difficulty-title">
        <div class="welcome-modal__header">
          <h2 id="difficulty-title">${escapeHtml(game.name)} Difficulty</h2>
        </div>
        <div class="difficulty-options">
          ${options.map((option) => `
            <button class="difficulty-option ${option === selected ? "difficulty-option--active" : ""}"
                    type="button"
                    data-difficulty="${option}">
              ${formatDifficulty(option)}
            </button>
          `).join("")}
        </div>
      </div>
    `;

    overlay.querySelectorAll<HTMLButtonElement>("[data-difficulty]").forEach((button) => {
      button.addEventListener("click", () => {
        const difficulty = button.dataset.difficulty as DifficultyChoice;
        saveDifficulty(game.id, difficulty);
        overlay.remove();
        resolve({ difficulty });
      });
    });

    document.body.appendChild(overlay);
    overlay.querySelector<HTMLButtonElement>(".difficulty-option--active")?.focus();
  });
}

function formatDifficulty(value: DifficultyChoice): string {
  if (value === "beginner") return "Easy";
  if (value === "intermediate") return "Medium";
  if (value === "expert") return "Hard";
  return value[0].toUpperCase() + value.slice(1);
}

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}
