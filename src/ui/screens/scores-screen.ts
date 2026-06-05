/**
 * High Scores screen — view all personal bests across games.
 */

import { getAllGames } from "../../app/game-registry.js";
import { getHighScores, getPersonalBest } from "../../settings/scores-store.js";

export function renderScoresScreen(container: HTMLElement): void {
  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "scores-screen";

  wrapper.innerHTML = `
    <h1 class="screen-title">High Scores</h1>
    <p class="scores-subtitle">Your personal bests across all games.</p>
    <div id="scores-list"></div>
    <div class="scores-actions">
      <a class="btn btn--secondary" href="#/">Back to Home</a>
    </div>
  `;

  container.appendChild(wrapper);

  const list = wrapper.querySelector("#scores-list");
  if (list) {
    renderScoresList(list as HTMLElement);
  }
}

function renderScoresList(container: HTMLElement): void {
  const games = getAllGames();
  let hasAnyScore = false;

  for (const game of games) {
    const pb = getPersonalBest(game.id);
    if (!pb) continue;
    hasAnyScore = true;

    const card = document.createElement("div");
    card.className = "scores-card";

    const scores = getHighScores(game.id);

    card.innerHTML = `
      <div class="scores-card__header">
        <h2>${escapeHtml(game.name)}</h2>
        <span class="scores-card__best">Best: <strong>${escapeHtml(pb.formattedScore || String(pb.score))}</strong></span>
      </div>
      <div class="scores-card__history">
        ${scores.slice(0, 5).map((s, i) => `
          <div class="scores-card__row">
            <span class="scores-card__rank">${i + 1}</span>
            <span class="scores-card__value">${escapeHtml(s.formattedScore || String(s.score))}</span>
            <span class="scores-card__date">${formatDate(s.date)}</span>
          </div>
        `).join("")}
      </div>
    `;

    container.appendChild(card);
  }

  if (!hasAnyScore) {
    container.innerHTML = `
      <div class="scores-empty">
        <p>No scores yet.</p>
        <p>Play some games and your bests will appear here!</p>
      </div>
    `;
  }
}

function formatDate(timestamp: number): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}
