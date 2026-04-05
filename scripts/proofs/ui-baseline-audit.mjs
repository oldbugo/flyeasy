import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const BASE_URL = process.env.FLYEASY_BASE_URL ?? "http://127.0.0.1:3000";
const AUDIT_DATE = new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = path.resolve("artifacts", "ui-audit", AUDIT_DATE);

function normalizeText(value) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

async function collectPageSummary(page, route) {
  const title = await page.title();
  const h1 = normalizeText(await page.locator("h1").first().textContent().catch(() => ""));
  const h2s = await page
    .locator("h2")
    .evaluateAll((els) =>
      els
        .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 20)
    );
  const navLinks = await page
    .locator("a[href]")
    .evaluateAll((els) =>
      els
        .map((el) => ({
          href: el.getAttribute("href"),
          text: (el.textContent ?? "").replace(/\s+/g, " ").trim()
        }))
        .filter((item) => item.href)
        .slice(0, 60)
    );

  const bodyText = normalizeText(await page.locator("body").textContent());
  return {
    route,
    title,
    h1,
    h2s,
    navLinks,
    bodyPreview: bodyText.slice(0, 2000)
  };
}

async function discoverSessionContext(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  const sessionHref = await page
    .locator('a[href^="/sessions/session_"]')
    .first()
    .getAttribute("href");

  if (!sessionHref) {
    throw new Error("No session link found on home page.");
  }

  const sessionId = sessionHref.split("/").filter(Boolean).at(-1);
  await page.goto(`${BASE_URL}${sessionHref}`, { waitUntil: "networkidle" });

  const candidateHref = await page
    .locator('a[href*="/candidates/candidate_"]')
    .first()
    .getAttribute("href");

  await page.goto(`${BASE_URL}/sessions/${sessionId}/history`, { waitUntil: "networkidle" });
  const runHref = await page
    .locator('a[href*="/runs/run_"]')
    .first()
    .getAttribute("href");

  return { sessionId, candidateHref, runHref };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 2200 } });

  const { sessionId, candidateHref, runHref } = await discoverSessionContext(page);
  const routes = [
    { key: "home", route: "/" },
    { key: "new-session", route: "/sessions/new" },
    { key: "global-settings", route: "/settings" },
    { key: "overview", route: `/sessions/${sessionId}` },
    { key: "results", route: `/sessions/${sessionId}/results` },
    { key: "trip-settings", route: `/sessions/${sessionId}/settings` },
    { key: "strategy", route: `/sessions/${sessionId}/strategy` },
    { key: "history", route: `/sessions/${sessionId}/history` }
  ];

  if (candidateHref) {
    routes.push({ key: "candidate-detail", route: candidateHref });
  }

  if (runHref) {
    routes.push({ key: "run-detail", route: runHref });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    sessionId,
    routes: []
  };

  for (const target of routes) {
    const url = `${BASE_URL}${target.route}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.screenshot({
      fullPage: true,
      path: path.join(OUTPUT_DIR, `${target.key}.png`)
    });
    const pageSummary = await collectPageSummary(page, target.route);
    summary.routes.push({ key: target.key, ...pageSummary });
  }

  await writeFile(
    path.join(OUTPUT_DIR, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8"
  );

  await browser.close();
  console.log(
    JSON.stringify(
      {
        outputDir: OUTPUT_DIR,
        sessionId,
        routes: summary.routes.map((route) => ({
          key: route.key,
          route: route.route,
          h1: route.h1
        }))
      },
      null,
      2
    )
  );
}

await main();
