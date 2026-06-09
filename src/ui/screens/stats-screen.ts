import { getAllGames, getGameById } from "../../app/game-registry.js";
import { getStatsSnapshot } from "../../settings/stats-store.js";
import { getHighScores } from "../../settings/scores-store.js";

export function renderStatsScreen(container: HTMLElement): void {
  const snapshot = getStatsSnapshot();
  const favorite = snapshot.favoriteGameId ? getGameById(snapshot.favoriteGameId) : null;
  const games = getAllGames();
  const maxPlayed = Math.max(1, ...snapshot.records.map((record) => record.gamesPlayed));

  container.innerHTML = `
    <div class="stats-screen">
      <h1 class="screen-title">Statistics</h1>
      <div class="stats-summary">
        <div class="stats-tile">
          <span>Total plays</span>
          <strong>${snapshot.totalGamesPlayed}</strong>
        </div>
        <div class="stats-tile">
          <span>Playtime</span>
          <strong>${formatPlaytime(snapshot.totalPlaytimeSeconds)}</strong>
        </div>
        <div class="stats-tile">
          <span>Favorite</span>
          <strong>${favorite ? escapeHtml(favorite.name) : "None"}</strong>
        </div>
        <div class="stats-tile">
          <span>Games with scores</span>
          <strong>${games.filter((game) => getHighScores(game.id).length > 0).length}</strong>
        </div>
      </div>

      <section class="stats-section">
        <h2>Most Played</h2>
        ${snapshot.records.length ? `
          <div class="stats-bars">
            ${snapshot.records.slice(0, 5).map((record) => {
              const game = getGameById(record.gameId);
              const width = Math.max(8, Math.round((record.gamesPlayed / maxPlayed) * 100));
              return `
                <div class="stats-bar-row">
                  <span>${escapeHtml(game?.name ?? record.gameId)}</span>
                  <div class="stats-bar" aria-label="${record.gamesPlayed} plays">
                    <span style="width:${width}%"></span>
                  </div>
                  <strong>${record.gamesPlayed}</strong>
                </div>
              `;
            }).join("")}
          </div>
        ` : `<div class="stats-empty">Play a game and stats will appear here.</div>`}
      </section>

      <div class="scores-actions">
        <a class="btn btn--secondary" href="#/">Back to Home</a>
      </div>
    </div>
  `;
}

function formatPlaytime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}
