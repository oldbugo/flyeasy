import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

import { appendProofLogEntry, getProofLogPath } from "./lib/proof-log.mjs";
import { createRunId, resolveProofPaths } from "./lib/proof-paths.mjs";

const proofKey = "safe-deep-verification-boundary";
const proofName = "deep-verification-boundary";
const headless = process.env.FLYEASY_PROOF_HEADFUL === "1" ? false : true;
const timeoutMs = Number(process.env.FLYEASY_PROOF_TIMEOUT_MS ?? 120_000);
const originQuery = process.env.FLYEASY_PROOF_ORIGIN ?? "Melbourne";
const destinationQuery = process.env.FLYEASY_PROOF_DESTINATION ?? "Guangzhou";

const runId = createRunId();
const proofPaths = resolveProofPaths(proofName, runId);
const sharedBrowserStateDir = path.join(proofPaths.rootDir, "playwright-state", "session-probe");
const sharedProofStatePath = path.join(sharedBrowserStateDir, "proof-state.json");

if (!fs.existsSync(sharedProofStatePath)) {
  throw new Error("Authenticated Trip.com proof state is missing. Run the session probe with manual login first.");
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

async function parseVisibleCards(page, stageName, limit = 8) {
  return page.locator('[data-testid^="u-flight-card-"]').evaluateAll((nodes, args) => {
    const { maxCards, stage } = args;
    const parseAmount = (value) => {
      const normalized = value.replace(/[^0-9.]/g, "");

      if (!normalized) {
        return null;
      }

      return Number(normalized);
    };

    return nodes.slice(0, maxCards).map((node, index) => {
      const textOf = (selector) => {
        const element = node.querySelector(selector);
        return element ? element.textContent.replace(/\s+/g, " ").trim() : null;
      };

      const accessibilitySummary = node.querySelector('[role="group"][aria-label]')?.getAttribute("aria-label")?.replace(/\s+/g, " ").trim() ?? "";

      return {
        accessibilitySummary,
        airline: textOf('[data-testid="flights-name"]'),
        baggage: textOf('[data-testid="list_label_baggages"]'),
        cardIndex: index + 1,
        duration: textOf('[data-testid="flightInfoDuration"]'),
        priceAmount: parseAmount(textOf('[data-testid="u_price_info"]') ?? ""),
        priceText: textOf('[data-testid="u_price_info"]'),
        stage,
        stopText: textOf('[data-testid="stopInfoText"]'),
        testId: node.getAttribute("data-testid"),
        timingMarkers: Array.from(node.querySelectorAll('[data-testid^="flight-time-"]'))
          .map((element) => element.textContent?.replace(/\s+/g, " ").trim())
          .filter(Boolean)
      };
    });
  }, { maxCards: limit, stage: stageName });
}

function pickVerificationCandidate(cards) {
  return cards.find((card) => card.stopText && !/direct/i.test(card.stopText)) ?? cards[0];
}

async function extractFareSelectionState(page) {
  return page.evaluate(() => {
    const continueButton = Array.from(document.querySelectorAll("button"))
      .find((button) => /continue/i.test(button.textContent ?? ""));

    if (!continueButton) {
      return {
        continueVisible: false,
        modalText: "",
        selectedTotalText: null
      };
    }

    let container = continueButton.parentElement;

    while (container && (container.textContent ?? "").replace(/\s+/g, " ").trim().length < 80) {
      container = container.parentElement;
    }

    const modalText = container?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const totalMatch = modalText.match(/AU\$\s*[0-9,]+(?:\.[0-9]+)?/g);

    return {
      continueVisible: true,
      modalText: modalText.slice(0, 1200),
      selectedTotalText: totalMatch ? totalMatch[totalMatch.length - 1] : null
    };
  });
}

async function extractTravelerPageState(page) {
  return page.evaluate(() => ({
    nextButtonText: document.querySelector('[data-testid="u_next_btn"]')?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    priceBreakdownHeader: document.querySelector('[data-testid="m-price-break-down__header"]')?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    processBarText: document.querySelector('[data-testid="u_process_bar"]')?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    totalPriceText: document.querySelector('[data-testid="u_price_panel_total"]')?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    tripSummaryText: document.querySelector('[data-testid="metav2"]')?.textContent?.replace(/\s+/g, " ").trim().slice(0, 1200) ?? null
  }));
}

const context = await chromium.launchPersistentContext(sharedBrowserStateDir, {
  headless,
  viewport: { width: 1440, height: 960 }
});

const page = context.pages()[0] ?? await context.newPage();

let outboundSelection = null;
let returnSelection = null;
let fareSelectionState = null;
let travelerPageState = null;

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

  const outboundCards = await parseVisibleCards(page, "outbound_results");
  outboundSelection = pickVerificationCandidate(outboundCards);

  await page.locator(`[data-testid="${outboundSelection.testId}"] [data-testid="u_select_btn"]`).click();
  await page.waitForURL(/showfarenext/i, { timeout: timeoutMs });
  await page.locator('[data-testid="u-flight-card-1"]').waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForTimeout(8_000);

  const returnCards = await parseVisibleCards(page, "return_results");
  returnSelection = pickVerificationCandidate(returnCards);

  await page.locator(`[data-testid="${returnSelection.testId}"] [data-testid="u_select_btn"]`).click();
  await page.waitForTimeout(4_000);

  fareSelectionState = await extractFareSelectionState(page);
  const fareArtifacts = await captureStageArtifacts(page, "fare-selection");

  if (!fareSelectionState.continueVisible) {
    throw new Error("Fare selection modal did not expose a visible Continue action.");
  }

  await page.getByRole("button", { name: /continue/i }).last().click();
  await page.waitForURL(/\/passenger/i, { timeout: timeoutMs });
  await page.waitForTimeout(10_000);

  const travelerArtifacts = await captureStageArtifacts(page, "traveler-page");
  travelerPageState = {
    ...await extractTravelerPageState(page),
    ...travelerArtifacts,
    url: page.url()
  };

  fareSelectionState = {
    ...fareSelectionState,
    ...fareArtifacts
  };
} finally {
  await context.close();
}

const result = {
  baseUrl: "https://au.trip.com/flights/",
  browserStateDir: sharedBrowserStateDir,
  fareSelectionState,
  headless,
  logPath: getProofLogPath(),
  occurredAt: new Date().toISOString(),
  outboundSelection,
  proof: proofKey,
  returnSelection,
  runId,
  runPaths: {
    resultDir: proofPaths.runDir
  },
  travelerPageState,
  verificationStageReached: travelerPageState?.nextButtonText ? "traveler_form" : "fare_selection"
};

const resultPath = path.join(proofPaths.runDir, "result.json");
await writeTextFile(resultPath, JSON.stringify(result, null, 2));

appendProofLogEntry({
  bullets: [
    `Run id: ${runId}`,
    `Selected outbound candidate: ${outboundSelection.airline} / ${outboundSelection.stopText} / ${outboundSelection.priceText}`,
    `Selected return candidate: ${returnSelection.airline} / ${returnSelection.stopText} / ${returnSelection.priceText}`,
    `Fare-selection total: ${fareSelectionState.selectedTotalText ?? "not detected"}`,
    `Verification stage reached: ${result.verificationStageReached}`,
    `Traveler-page total: ${travelerPageState.totalPriceText ?? "not detected"}`,
    `Traveler-page URL: ${travelerPageState.url}`,
    `Artifact directory: ${proofPaths.runDir}`,
    "Notes: the proof stops on the traveler-details page before any passenger data submission or payment action."
  ],
  latestStatus: "completed",
  proofKey,
  title: `${new Date().toISOString().slice(0, 10)} - Proof 3 Deep Verification (${result.verificationStageReached})`
});

console.log(JSON.stringify({ ...result, resultPath }, null, 2));
