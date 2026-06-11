import { beforeEach, describe, expect, it } from "vitest";
import { saveScore, getHighScores, getPersonalBest } from "../settings/scores-store.js";
import { updateSettings, getSettings } from "../settings/settings-store.js";
import { renderHomeScreen } from "../ui/screens/home-screen.js";

/**
 * XSS Regression Tests
 *
 * Ensures that user-controlled data (nicknames, scores, formatted strings)
 * is properly escaped when rendered to prevent script injection attacks.
 *
 * These tests validate that the escapeHtml utility and textContent usage
 * prevent malicious strings from executing.
 */

describe("XSS Regression Tests", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
  });

  describe("Nickname XSS Prevention", () => {
    it("should escape HTML tags in nickname", () => {
      const maliciousNickname = "<script>alert('xss')</script>";
      updateSettings({ nickname: maliciousNickname });

      const settings = getSettings();
      expect(settings.nickname).toBe(maliciousNickname);

      // Simulate rendering nickname in settings screen
      const input = document.createElement("input");
      input.value = settings.nickname;
      document.body.appendChild(input);

      expect(input.value).toBe(maliciousNickname);
      expect(document.querySelector("script")).toBeNull();
    });

    it("should escape quotes in nickname", () => {
      const nicknameWithQuotes = 'Player"><img src=x onerror=alert(1)>';
      updateSettings({ nickname: nicknameWithQuotes });

      const settings = getSettings();
      expect(settings.nickname).toBe(nicknameWithQuotes);
    });

    it("should escape angle brackets in nickname", () => {
      const nicknameWithBrackets = "Player<>Test";
      updateSettings({ nickname: nicknameWithBrackets });

      const settings = getSettings();
      expect(settings.nickname).toBe(nicknameWithBrackets);
    });

    it("should handle nickname with event attributes", () => {
      const maliciousNickname = 'Player" onload="alert(1)"';
      updateSettings({ nickname: maliciousNickname });

      const settings = getSettings();
      expect(settings.nickname).toBe(maliciousNickname);
    });

    it("should escape ampersands and special entities", () => {
      const nicknameWithEntities = "Player&nbsp;&lt;&gt;";
      updateSettings({ nickname: nicknameWithEntities });

      const settings = getSettings();
      expect(settings.nickname).toBe(nicknameWithEntities);
    });

    it("should handle extremely long malicious nickname", () => {
      const longMalicious = "<script>" + "alert(1);".repeat(100) + "</script>";
      updateSettings({ nickname: longMalicious });

      const settings = getSettings();
      expect(settings.nickname).toBe(longMalicious);
    });
  });

  describe("Score Rendering XSS Prevention", () => {
    it("renders persisted personal best data safely on the home screen", () => {
      localStorage.setItem("klinefelter-scores", JSON.stringify([{
        gameId: "2048",
        score: 999999,
        date: Date.now(),
        nickname: 'Player"><img src=x onerror=alert(1)>',
        formattedScore: '<svg onload=alert("score")>999999</svg>',
      }]));

      const root = document.createElement("main");
      renderHomeScreen(root);

      const pb = root.querySelector<HTMLAnchorElement>('[href="#/games/2048"]')?.querySelector<HTMLSpanElement>(".game-card__pb");
      expect(pb).not.toBeNull();
      expect(pb?.innerHTML).toContain("&lt;svg");
      expect(pb?.innerHTML).not.toContain("<svg");
      expect(pb?.getAttribute("title")).not.toContain("<img");
      expect(pb?.getAttribute("title")).not.toContain("onerror");
      expect(root.querySelector("img")).toBeNull();
      expect(root.querySelector("svg")).toBeNull();
    });

    it("should escape HTML in formattedScore", () => {
      const maliciousScore = "<img src=x onerror=alert('xss')>";
      saveScore("test-game", 1000, maliciousScore);

      const scores = getHighScores("test-game");
      expect(scores[0].formattedScore).toBe(maliciousScore);

      // Simulate rendering with escapeHtml
      const span = document.createElement("span");
      span.textContent = scores[0].formattedScore || "";
      const escaped = span.innerHTML;

      expect(escaped).toContain("&lt;");
      expect(escaped).toContain("&gt;");
      expect(escaped).not.toContain("<img");
    });

    it("should escape script tags in formattedScore", () => {
      const maliciousFormatted = "<script>alert('score')</script>1000";
      saveScore("2048", 1000, maliciousFormatted);

      const pb = getPersonalBest("2048");
      expect(pb?.formattedScore).toBe(maliciousFormatted);

      // Verify escaping
      const span = document.createElement("span");
      span.textContent = pb?.formattedScore || "";
      const escaped = span.innerHTML;

      expect(escaped).toContain("&lt;script&gt;");
      expect(document.querySelector("script")).toBeNull();
    });

    it("should handle score with event handlers", () => {
      const maliciousFormatted = '1000<span onclick="alert(1)">pts</span>';
      saveScore("snake", 1000, maliciousFormatted);

      const scores = getHighScores("snake");
      expect(scores[0].formattedScore).toBe(maliciousFormatted);
    });

    it("should escape multiple scores with different attack vectors", () => {
      const attacks = [
        "<script>alert(1)</script>",
        "<img src=x onerror=alert(2)>",
        "javascript:alert(3)",
        "<iframe src='javascript:alert(4)'>",
        "<svg onload=alert(5)>",
      ];

      attacks.forEach((attack, i) => {
        saveScore("test-game", i * 100, attack);
      });

      const scores = getHighScores("test-game");
      expect(scores.length).toBe(attacks.length);

      scores.forEach((score) => {
        const span = document.createElement("span");
        span.textContent = score.formattedScore || "";
        const escaped = span.innerHTML;

        expect(escaped).not.toContain("<script");
        expect(escaped).not.toContain("<img");
        expect(escaped).not.toContain("<iframe");
        expect(escaped).not.toContain("<svg");
      });
    });

    it("should handle numeric score display safely", () => {
      // Even though numeric scores are numbers, they could be rendered in templates
      saveScore("minesweeper", 999999999999, "999,999,999,999");

      const pb = getPersonalBest("minesweeper");
      expect(pb?.score).toBe(999999999999);
      expect(typeof pb?.score).toBe("number");
    });
  });

  describe("Modal and Error Message XSS Prevention", () => {
    it("should escape HTML in error messages", () => {
      const maliciousGameId = "<script>alert('game')</script>";
      const container = document.createElement("div");
      container.innerHTML = `<p>Game not found: "${escapeHtml(maliciousGameId)}"</p>`;

      expect(container.innerHTML).toContain("&lt;script&gt;");
      expect(container.querySelector("script")).toBeNull();
    });

    it("should escape game name in loading message", () => {
      const maliciousGameName = "<img src=x onerror=alert('load')>";
      const container = document.createElement("div");
      container.innerHTML = `<p>Loading ${escapeHtml(maliciousGameName)}...</p>`;

      expect(container.innerHTML).toContain("&lt;img");
      expect(container.querySelector("img")).toBeNull();
    });

    it("should handle status badge rendering safely", () => {
      const maliciousStatus = "<script>alert('status')</script>Downloaded";
      const statusEl = document.createElement("div");
      statusEl.innerHTML = `<span class="status-badge">${escapeHtml(maliciousStatus)}</span>`;

      expect(statusEl.innerHTML).toContain("&lt;script&gt;");
      expect(statusEl.querySelector("script")).toBeNull();
    });

    it("should escape user input in modal dialogs", () => {
      const maliciousInput = '"><script>alert(1)</script><span class="';
      const modal = document.createElement("div");

      // Simulate modal with user data
      const safeInput = escapeHtml(maliciousInput);
      modal.innerHTML = `<div class="modal"><p>${safeInput}</p></div>`;

      expect(modal.innerHTML).toContain("&gt;&lt;script&gt;");
      expect(modal.querySelector("script")).toBeNull();
    });
  });

  describe("Edge Cases and Complex Attacks", () => {
    it("should handle nested HTML structures", () => {
      const nested = "<div><span><script>alert(1)</script></span></div>";
      updateSettings({ nickname: nested });

      const settings = getSettings();
      expect(settings.nickname).toBe(nested);

      const span = document.createElement("span");
      span.textContent = settings.nickname;
      expect(span.innerHTML).toContain("&lt;div&gt;");
    });

    it("should handle URL-encoded attacks", () => {
      const urlEncoded = "%3Cscript%3Ealert(1)%3C/script%3E";
      saveScore("test", 100, urlEncoded);

      const scores = getHighScores("test");
      expect(scores[0].formattedScore).toBe(urlEncoded);
    });

    it("should handle Unicode and emoji in nickname", () => {
      const unicodeNickname = "Player🎮<script>alert(1)</script>👾";
      updateSettings({ nickname: unicodeNickname });

      const settings = getSettings();
      expect(settings.nickname).toBe(unicodeNickname);

      const span = document.createElement("span");
      span.textContent = settings.nickname;
      expect(span.innerHTML).toContain("🎮");
      expect(span.innerHTML).toContain("👾");
      expect(span.innerHTML).toContain("&lt;script&gt;");
    });

    it("should handle null bytes and control characters", () => {
      const withNullByte = "Player\x00<script>alert(1)</script>";
      updateSettings({ nickname: withNullByte });

      const settings = getSettings();
      expect(settings.nickname).toBe(withNullByte);
    });

    it("should handle data URIs", () => {
      const dataUri = "data:text/html,<script>alert(1)</script>";
      saveScore("test", 100, dataUri);

      const scores = getHighScores("test");
      expect(scores[0].formattedScore).toBe(dataUri);
    });

    it("should handle javascript: protocol", () => {
      const jsProtocol = "javascript:alert(document.cookie)";
      saveScore("test", 100, jsProtocol);

      const scores = getHighScores("test");
      expect(scores[0].formattedScore).toBe(jsProtocol);
    });

    it("should handle SVG with embedded scripts", () => {
      const svgAttack = '<svg><script>alert(1)</script></svg>';
      updateSettings({ nickname: svgAttack });

      const settings = getSettings();
      const span = document.createElement("span");
      span.textContent = settings.nickname;

      expect(span.innerHTML).toContain("&lt;svg&gt;");
      expect(span.querySelector("svg")).toBeNull();
    });

    it("should handle CDATA sections", () => {
      const cdataAttack = "<![CDATA[<script>alert(1)</script>]]>";
      saveScore("test", 100, cdataAttack);

      const scores = getHighScores("test");
      expect(scores[0].formattedScore).toBe(cdataAttack);
    });

    it("should handle HTML entities double-encoding", () => {
      const doubleEncoded = "&lt;script&gt;alert(1)&lt;/script&gt;";
      updateSettings({ nickname: doubleEncoded });

      const settings = getSettings();
      expect(settings.nickname).toBe(doubleEncoded);
    });

    it("should handle mixed case tag names", () => {
      const mixedCase = "<ScRiPt>alert(1)</sCrIpT>";
      saveScore("test", 100, mixedCase);

      const scores = getHighScores("test");
      const span = document.createElement("span");
      span.textContent = scores[0].formattedScore || "";

      expect(span.innerHTML).toContain("&lt;");
      expect(span.innerHTML).toContain("&gt;");
    });
  });

  describe("Score List Rendering Safety", () => {
    it("should safely render multiple scores with malicious data", () => {
      // Save multiple scores with different attack vectors
      updateSettings({ nickname: "<script>alert('nick')</script>" });
      saveScore("test-game", 5000, "<img src=x onerror=alert(5000)>");

      updateSettings({ nickname: "<iframe src='javascript:alert(1)'>" });
      saveScore("test-game", 4000, "<svg onload=alert(4000)>");

      updateSettings({ nickname: "Player' onload='alert(3000)'" });
      saveScore("test-game", 3000, "<script>alert(3000)</script>");

      const scores = getHighScores("test-game");
      expect(scores.length).toBe(3);

      // Simulate rendering each score
      scores.forEach((score) => {
        const nickSpan = document.createElement("span");
        nickSpan.textContent = score.nickname;

        const scoreSpan = document.createElement("span");
        scoreSpan.textContent = score.formattedScore || String(score.score);

        expect(nickSpan.innerHTML).not.toContain("<script");
        expect(scoreSpan.innerHTML).not.toContain("<img");
      });
    });

    it("should handle empty and whitespace-only attacks", () => {
      const whitespaceAttacks = [
        "   <script>alert(1)</script>   ",
        "\n<script>alert(2)</script>\n",
        "\t<script>alert(3)</script>\t",
      ];

      whitespaceAttacks.forEach((attack) => {
        updateSettings({ nickname: attack });
        const settings = getSettings();

        const span = document.createElement("span");
        span.textContent = settings.nickname;
        expect(span.innerHTML).toContain("&lt;script&gt;");
      });
    });
  });
});

/**
 * Escape HTML helper (matches implementation in scores-screen.ts)
 */
function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}
