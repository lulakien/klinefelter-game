import { chromium } from "playwright";

const BASE = process.env.APP_URL || "http://127.0.0.1:3002/klinefelter-game/";
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const GAMES = [
  "2048",
  "minesweeper",
  "solitaire",
  "water-sort",
  "block-blast",
  "snake",
  "memory",
  "15-puzzle",
  "tic-tac-toe",
  "connect-four",
];
const ROUTES = ["#/", "#/settings", "#/offline", "#/scores", "#/stats"];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile390", width: 390, height: 844 },
];

let pass = 0;
let fail = 0;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width < 600,
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  const httpErrors = [];

  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("404")) {
      runtimeErrors.push(message.text());
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().includes("favicon")) {
      httpErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.addInitScript(() => {
    localStorage.setItem("klinefelter-onboarding-seen", "true");
    window.confirm = () => false;
  });

  for (const route of ROUTES) {
    runtimeErrors.length = 0;
    httpErrors.length = 0;
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    const hasContent = await page.locator("#app").evaluate((el) => (el.textContent || "").trim().length > 20);
    report(`${viewport.name} ${route}`, hasContent && runtimeErrors.length === 0 && httpErrors.length === 0, { runtimeErrors, httpErrors });
  }

  for (const id of GAMES) {
    runtimeErrors.length = 0;
    httpErrors.length = 0;
    await page.goto(`${BASE}#/games/${id}`, { waitUntil: "networkidle" });
    const diff = page.locator("#difficulty-modal [data-difficulty]").first();
    if (await diff.count()) await diff.click();
    await page.waitForTimeout(500);
    const info = await page.evaluate((gameId) => {
      const app = document.getElementById("app");
      const snakeBoard = document.querySelector(".snake__board")?.getBoundingClientRect();
      return {
        hasContent: !!app && ((app.textContent || "").trim().length > 20 || !!app.querySelector("canvas,[class*=board],[class*=grid]")),
        bodyOverflow: document.documentElement.scrollWidth > window.innerWidth + 1 || document.body.scrollWidth > window.innerWidth + 1,
        snakeBoardWidth: gameId === "snake" ? (snakeBoard?.width ?? 0) : 0,
      };
    }, id);
    report(
      `${viewport.name} game ${id}`,
      info.hasContent &&
        !info.bodyOverflow &&
        (id !== "snake" || info.snakeBoardWidth <= viewport.width) &&
        runtimeErrors.length === 0 &&
        httpErrors.length === 0,
      { info, runtimeErrors, httpErrors },
    );
  }

  await context.close();
}

await browser.close();
console.log(`SUMMARY pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);

function report(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (ok) {
    pass++;
  } else {
    fail++;
    console.log(JSON.stringify(detail));
  }
}
