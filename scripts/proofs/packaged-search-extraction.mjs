import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

import { appendProofLogEntry, getProofLogPath } from "./lib/proof-log.mjs";
import { createRunId, resolveProofPaths } from "./lib/proof-paths.mjs";

const proofKey = "packaged-search-extraction";
const proofName = "packaged-search-extraction";
const headless = process.env.FLYEASY_PROOF_HEADFUL === "1" ? false : true;
const timeoutMs = Number(process.env.FLYEASY_PROOF_TIMEOUT_MS ?? 120_000);
const cardLimit = Number(process.env.FLYEASY_PROOF_CARD_LIMIT ?? 8);
const originQuery = process.env.FLYEASY_PROOF_ORIGIN ?? "Melbourne";
const destinationQuery = process.env.FLYEASY_PROOF_DESTINATION ?? "Guangzhou";

const runId = createRunId();
const proofPaths = resolveProofPaths(proofName, runId);
const sharedBrowserStateDir = path.join(proofPaths.rootDir, "playwright-state", "session-probe");
const sharedProofStatePath = path.join(sharedBrowserStateDir, "proof-state.json");

if (!fs.existsSync(sharedProofStatePath)) {
  throw new Error("Authenticated Trip.com proof state is missing. Run the session probe with manual login first.");
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function getDefaultDates() {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 2);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 2);

  const format = (value) => value.toISOString().slice(0, 10);

  return {
    departDate: process.env.FLYEASY_PROOF_DEPART_DATE ?? format(start),
    returnDate: process.env.FLYEASY_PROOF_RETURN_DATE ?? format(end)
  };
}

async function writeTextFile(filePath, content) {
  await import("node:fs/promises").then(({ writeFile }) => writeFile(filePath, content, "utf8"));
}

async function captureStageArtifacts(page, stageName) {
  const screenshotPath = path.join(proofPaths.runDir, `${stageName}.png`);
  const htmlPath = path.join(proofPaths.runDir, `${stageName}.html`);

  await page.screenshot({
    fullPage: true,
    path: screenshotPath
  });

  await writeTextFile(htmlPath, await page.content());

  return {
    htmlPath,
    screenshotPath
  };
}

async function chooseCity(page, fieldTestId, query) {
  const input = page.locator(`[data-testid="${fieldTestId}"]`).first();
  await input.click();
  await input.fill(query);

  const wrapper = page.locator(`[data-testid="${fieldTestId}_poi_wrapper"]`).first();
  await wrapper.waitFor({ state: "visible", timeout: 15_000 });
  await wrapper.locator('[data-testid="0"]').click();
  await page.waitForTimeout(800);
}

async function parseVisibleCards(page, stageName) {
  return page.locator('[data-testid^="u-flight-card-"]').evaluateAll((nodes, limitAndStage) => {
    const { limit, stage } = limitAndStage;
    const parseAmount = (value) => {
      const normalized = value.replace(/[^0-9.]/g, "");

      if (!normalized) {
        return null;
      }

      return Number(normalized);
    };

    return nodes.slice(0, limit).map((node, index) => {
      const textOf = (selector) => {
        const element = node.querySelector(selector);
        return element ? element.textContent.replace(/\s+/g, " ").trim() : null;
      };

      const flightGroup = node.querySelector('[role="group"][aria-label]');
      const accessibilitySummary = flightGroup?.getAttribute("aria-label")?.replace(/\s+/g, " ").trim() ?? "";
      const departingFrom = accessibilitySummary.match(/departing from (.*?) at/i)?.[1] ?? null;
      const arrivingAt = accessibilitySummary.match(/arriving at (.*?) at/i)?.[1] ?? null;
      const timingMarkers = Array.from(node.querySelectorAll('[data-testid^="flight-time-"]'))
        .map((element) => element.textContent?.replace(/\s+/g, " ").trim())
        .filter(Boolean);

      const cardText = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const baggage = textOf('[data-testid="list_label_baggages"]');
      const airline = textOf('[data-testid="flights-name"]');
      const duration = textOf('[data-testid="flightInfoDuration"]');
      const priceText = textOf('[data-testid="u_price_info"]');
      const stopText = textOf('[data-testid="stopInfoText"]');
      const selectText = textOf('[data-testid="u_select_btn"]');
      const testId = node.getAttribute("data-testid");

      return {
        accessibilitySummary,
        airline,
        baggage,
        cardIndex: index + 1,
        cardText,
        departingFrom,
        arrivingAt,
        duration,
        priceAmount: priceText ? parseAmount(priceText) : null,
        priceText,
        selectText,
        stage,
        stopText,
        testId,
        timingMarkers
      };
    });
  }, { limit: cardLimit, stage: stageName });
}

const { departDate, returnDate } = getDefaultDates();

const context = await chromium.launchPersistentContext(sharedBrowserStateDir, {
  headless,
  viewport: { width: 1440, height: 960 }
});

const page = context.pages()[0] ?? await context.newPage();

let outboundStage = null;
let returnStage = null;

try {
  await page.goto("https://au.trip.com/flights/", {
    timeout: timeoutMs,
    waitUntil: "domcontentloaded"
  });
  await page.waitForTimeout(4_000);

  await chooseCity(page, "search_city_from0", originQuery);
  await chooseCity(page, "search_city_to0", destinationQuery);
  await page.locator('[data-testid="search_btn"]').click();

  await page.waitForURL(/showfarefirst/i, { timeout: timeoutMs });
  await page.locator('[data-testid="u-flight-card-1"]').waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForTimeout(8_000);

  const outboundArtifacts = await captureStageArtifacts(page, "outbound-results");
  const outboundCards = await parseVisibleCards(page, "outbound_results");

  outboundStage = {
    ...outboundArtifacts,
    cards: outboundCards,
    url: page.url()
  };

  await page.locator('[data-testid="u-flight-card-1"] [data-testid="u_select_btn"]').click();
  await page.waitForURL(/showfarenext/i, { timeout: timeoutMs });
  await page.locator('[data-testid="u-flight-card-1"]').waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForTimeout(8_000);

  const returnArtifacts = await captureStageArtifacts(page, "return-results");
  const returnCards = await parseVisibleCards(page, "return_results");

  returnStage = {
    ...returnArtifacts,
    cards: returnCards,
    url: page.url()
  };
} finally {
  await context.close();
}

const result = {
  baseUrl: "https://au.trip.com/flights/",
  browserStateDir: sharedBrowserStateDir,
  headless,
  logPath: getProofLogPath(),
  occurredAt: new Date().toISOString(),
  outboundStage,
  proof: proofKey,
  returnStage,
  runId,
  runPaths: {
    resultDir: proofPaths.runDir
  },
  searchRequest: {
    destinationQuery,
    originQuery,
    requestedDepartDate: departDate,
    requestedReturnDate: returnDate,
    tripType: "round_trip"
  }
};

const outboundUrl = new URL(outboundStage.url);
result.searchRequest.resolvedDepartDate = outboundUrl.searchParams.get("ddate");
result.searchRequest.resolvedReturnDate = outboundUrl.searchParams.get("rdate");

const resultPath = path.join(proofPaths.runDir, "result.json");
await writeTextFile(resultPath, JSON.stringify(result, null, 2));

appendProofLogEntry({
  bullets: [
    `Run id: ${runId}`,
    `Baseline search: ${originQuery} -> ${destinationQuery} (${result.searchRequest.resolvedDepartDate} to ${result.searchRequest.resolvedReturnDate})`,
    `Outbound stage URL: ${outboundStage.url}`,
    `Outbound cards parsed: ${outboundStage.cards.length}`,
    `Return stage URL: ${returnStage.url}`,
    `Return cards parsed: ${returnStage.cards.length}`,
    `Artifact directory: ${proofPaths.runDir}`,
    "Observed Trip.com flow: round-trip packaged search is a two-step flow with outbound selection followed by return selection.",
    "Notes: candidate extraction is now grounded in live result-card DOM, but full candidate normalization still needs cross-stage combination logic."
  ],
  latestStatus: "in_progress",
  proofKey,
  title: `${new Date().toISOString().slice(0, 10)} - Proof 2 Packaged Search (${originQuery} to ${destinationQuery})`
});

console.log(JSON.stringify({ ...result, resultPath }, null, 2));
