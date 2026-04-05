import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { chromium } from "playwright";

import { appendProofLogEntry, getProofLogPath } from "./lib/proof-log.mjs";
import { createRunId, resolveProofPaths } from "./lib/proof-paths.mjs";

const proofKey = "recovery-resume";
const proofName = "recovery-resume";
const headless = process.env.FLYEASY_PROOF_HEADFUL === "1" ? false : true;
const manualWaitMs = Number(process.env.FLYEASY_PROOF_MANUAL_WAIT_MS ?? 240_000);
const timeoutMs = Number(process.env.FLYEASY_PROOF_TIMEOUT_MS ?? 120_000);
const originQuery = process.env.FLYEASY_PROOF_ORIGIN ?? "Melbourne";
const destinationQuery = process.env.FLYEASY_PROOF_DESTINATION ?? "Guangzhou";

const runId = createRunId();
const proofPaths = resolveProofPaths(proofName, runId);
const sharedBrowserStateDir = path.join(proofPaths.rootDir, "playwright-state", "session-probe");
const proofStatePath = path.join(sharedBrowserStateDir, "proof-state.json");

if (!fs.existsSync(proofStatePath)) {
  throw new Error("Authenticated Trip.com proof state is missing. Run the session probe with manual login first.");
}

const proofState = JSON.parse(fs.readFileSync(proofStatePath, "utf8"));
const hadAuthenticatedMarker = Boolean(proofState.lastAuthenticatedAt);

if (!hadAuthenticatedMarker) {
  throw new Error("Trip.com proof state does not contain an authenticated marker.");
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function parseAmount(value) {
  const normalized = value.replace(/[^0-9.]/g, "");

  if (!normalized) {
    return null;
  }

  return Number(normalized);
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

function buildSignals(url, title, bodyText, visibleActions) {
  const combinedText = normalizeText(`${title} ${bodyText} ${visibleActions.join(" ")}`).toLowerCase();
  const currentUrl = url.toLowerCase();

  return {
    authPromptIndicators: [
      /sign in/.test(combinedText),
      /register/.test(combinedText),
      /log in/.test(combinedText),
      /login/.test(combinedText),
      currentUrl.includes("login"),
      currentUrl.includes("signin")
    ].filter(Boolean).length,
    challengeIndicators: [
      /captcha/.test(combinedText),
      /verify it's you/.test(combinedText),
      /verification code/.test(combinedText),
      /security check/.test(combinedText),
      currentUrl.includes("captcha"),
      currentUrl.includes("challenge")
    ].filter(Boolean).length,
    connectedIndicators: [
      /sign out/.test(combinedText),
      /log out/.test(combinedText),
      /account center/.test(combinedText),
      /profile/.test(combinedText),
      /trip coins/.test(combinedText),
      currentUrl.includes("/account")
    ].filter(Boolean).length,
    genericAccountNavIndicators: [
      /my bookings/.test(combinedText),
      /price alerts/.test(combinedText),
      /flight status/.test(combinedText),
      /private jet charters/.test(combinedText),
      /find bookings/.test(combinedText),
      /register now/.test(combinedText),
      /save & earn/.test(combinedText),
      /become a member/.test(combinedText)
    ].filter(Boolean).length
  };
}

function classifySessionState(signals) {
  if (signals.challengeIndicators > 0) {
    return {
      confidence: 0.9,
      reason: "Trip.com rendered challenge or verification signals.",
      state: "challenge_required"
    };
  }

  if (signals.connectedIndicators > 0 && signals.authPromptIndicators === 0) {
    return {
      confidence: 0.7,
      reason: "Page exposes strong authenticated-account signals without showing a sign-in prompt.",
      state: "connected"
    };
  }

  if (signals.authPromptIndicators > 0) {
    return {
      confidence: 0.7,
      reason: "The previously authenticated browser context now prompts for authentication.",
      state: "session_expired"
    };
  }

  return {
    confidence: 0.35,
    reason: signals.genericAccountNavIndicators > 0
      ? "Trip.com exposed generic account-navigation text on a public page, which is not strong enough to prove authentication."
      : "The current page does not provide a reliable authenticated or expired verdict.",
    state: "unknown"
  };
}

async function collectObservation(page, context) {
  await page.waitForTimeout(3_000);

  const [title, tripcomUrl, bodyText, visibleActions, cookies] = await Promise.all([
    page.title(),
    Promise.resolve(page.url()),
    page.locator("body").innerText().catch(() => ""),
    page.locator("a, button, [role='button']").evaluateAll((nodes) =>
      nodes
        .map((node) => node.textContent ?? "")
        .map((text) => text.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 20)
    ).catch(() => []),
    context.cookies()
  ]);

  const normalizedBody = normalizeText(bodyText);
  const signals = buildSignals(tripcomUrl, title, normalizedBody, visibleActions);
  const classification = classifySessionState(signals);

  return {
    bodyPreview: normalizedBody.slice(0, 900),
    classification,
    cookieNames: cookies.map((cookie) => cookie.name).slice(0, 20),
    title,
    tripcomUrl,
    visibleActions: visibleActions.slice(0, 12)
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

async function parseVisibleCards(page, stageName, limit = 6) {
  return page.locator('[data-testid^="u-flight-card-"]').evaluateAll((nodes, args) => {
    const { maxCards, stage } = args;
    const getText = (node, selector) => {
      const element = node.querySelector(selector);
      return element ? element.textContent.replace(/\s+/g, " ").trim() : null;
    };

    return nodes.slice(0, maxCards).map((node, index) => ({
      airline: getText(node, '[data-testid="flights-name"]'),
      cardIndex: index + 1,
      duration: getText(node, '[data-testid="flightInfoDuration"]'),
      priceText: getText(node, '[data-testid="u_price_info"]'),
      stage,
      stopText: getText(node, '[data-testid="stopInfoText"]'),
      testId: node.getAttribute("data-testid"),
      timingMarkers: Array.from(node.querySelectorAll('[data-testid^="flight-time-"]'))
        .map((element) => element.textContent?.replace(/\s+/g, " ").trim())
        .filter(Boolean)
    }));
  }, { maxCards: limit, stage: stageName });
}

function chooseCheckpointCandidate(cards) {
  const candidate = cards.find((card) => card.stopText && !/direct/i.test(card.stopText)) ?? cards[0];

  return {
    ...candidate,
    priceAmount: parseAmount(candidate.priceText ?? "")
  };
}

function findMatchingCandidate(cards, checkpoint) {
  return cards.find((card) =>
    card.airline === checkpoint.airline &&
    card.stopText === checkpoint.stopText &&
    parseAmount(card.priceText ?? "") === checkpoint.priceAmount &&
    JSON.stringify(card.timingMarkers) === JSON.stringify(checkpoint.timingMarkers)
  ) ?? null;
}

async function waitForManualRecovery() {
  if (headless) {
    return "not_available";
  }

  if (process.stdin.isTTY && process.stdout.isTTY) {
    const rl = readline.createInterface({ input, output });
    await rl.question("Complete the Trip.com login or recovery flow in the browser window, then press Enter to continue.");
    rl.close();
    return "prompt";
  }

  await new Promise((resolve) => setTimeout(resolve, manualWaitMs));
  return "timer";
}

async function invalidateSession(page, context) {
  await page.goto("https://au.trip.com/flights/", {
    timeout: timeoutMs,
    waitUntil: "domcontentloaded"
  });
  await page.waitForTimeout(2_000);

  await page.evaluate(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    if (indexedDB.databases) {
      const databases = await indexedDB.databases();

      await Promise.all(
        databases
          .map((database) => database.name)
          .filter(Boolean)
          .map((databaseName) => new Promise((resolve) => {
            const request = indexedDB.deleteDatabase(databaseName);
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
            request.onblocked = () => resolve(false);
          }))
      );
    }
  }).catch(() => {});

  await context.clearCookies();
  await page.goto("https://au.trip.com/flights/", {
    timeout: timeoutMs,
    waitUntil: "domcontentloaded"
  });
}

const context = await chromium.launchPersistentContext(sharedBrowserStateDir, {
  headless,
  viewport: { width: 1440, height: 960 }
});

const page = context.pages()[0] ?? await context.newPage();

let checkpoint = null;
let blockedObservation = null;
let resumedObservation = null;
let resumedCards = null;
let matchedCandidate = null;
let manualRecoveryWaitMode = "not_requested";

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

  const partialCards = await parseVisibleCards(page, "outbound_results");
  const checkpointCandidate = chooseCheckpointCandidate(partialCards);
  const preBlockArtifacts = await captureStageArtifacts(page, "pre-block-results");

  checkpoint = {
    blockedStage: "outbound_results",
    candidate: checkpointCandidate,
    partialResultsCount: partialCards.length,
    resumeMode: "partial_restart",
    searchRequest: {
      destinationQuery,
      originQuery,
      resolvedDepartDate: new URL(page.url()).searchParams.get("ddate"),
      resolvedReturnDate: new URL(page.url()).searchParams.get("rdate")
    },
    ...preBlockArtifacts
  };

  await invalidateSession(page, context);
  blockedObservation = await collectObservation(page, context);
  blockedObservation = {
    ...blockedObservation,
    ...await captureStageArtifacts(page, "blocked-state")
  };

  manualRecoveryWaitMode = await waitForManualRecovery();
  resumedObservation = await collectObservation(page, context);
  resumedObservation = {
    ...resumedObservation,
    ...await captureStageArtifacts(page, "post-recovery-home")
  };

  if (resumedObservation.classification.state === "connected") {
    fs.writeFileSync(
      proofStatePath,
      JSON.stringify(
        {
          lastAuthenticatedAt: new Date().toISOString(),
          lastConnectedRunId: runId
        },
        null,
        2
      ),
      "utf8"
    );

    await chooseCity(page, "search_city_from0", originQuery);
    await chooseCity(page, "search_city_to0", destinationQuery);
    await page.locator('[data-testid="search_btn"]').click();
    await page.waitForURL(/showfarefirst/i, { timeout: timeoutMs });
    await page.locator('[data-testid="u-flight-card-1"]').waitFor({ state: "visible", timeout: timeoutMs });
    await page.waitForTimeout(8_000);

    resumedCards = await parseVisibleCards(page, "outbound_results_resumed");
    matchedCandidate = findMatchingCandidate(resumedCards, checkpoint.candidate);
    const resumedArtifacts = await captureStageArtifacts(page, "resumed-results");

    resumedObservation = {
      ...resumedObservation,
      resumedResultsHtmlPath: resumedArtifacts.htmlPath,
      resumedResultsScreenshotPath: resumedArtifacts.screenshotPath
    };
  }
} finally {
  await context.close();
}

const result = {
  blockedObservation,
  browserStateDir: sharedBrowserStateDir,
  checkpoint,
  headless,
  logPath: getProofLogPath(),
  manualRecoveryWaitMode,
  occurredAt: new Date().toISOString(),
  proof: proofKey,
  resumedCandidateMatched: Boolean(matchedCandidate),
  resumedCards,
  resumedObservation,
  runId,
  runPaths: {
    resultDir: proofPaths.runDir
  }
};

const resultPath = path.join(proofPaths.runDir, "result.json");
await writeTextFile(resultPath, JSON.stringify(result, null, 2));

appendProofLogEntry({
  bullets: [
    `Run id: ${runId}`,
    `Checkpoint stage: ${checkpoint.blockedStage}`,
    `Checkpoint candidate: ${checkpoint.candidate.airline} / ${checkpoint.candidate.stopText} / ${checkpoint.candidate.priceText}`,
    `Blocked state observed: ${blockedObservation.classification.state} (${blockedObservation.classification.reason})`,
    `Resume mode: ${checkpoint.resumeMode}`,
    `Manual recovery wait mode: ${manualRecoveryWaitMode}`,
    `Post-recovery state: ${resumedObservation.classification.state} (${resumedObservation.classification.reason})`,
    `Matched checkpoint candidate after resume: ${matchedCandidate ? "yes" : "no"}`,
    `Artifact directory: ${proofPaths.runDir}`,
    "Notes: the proof preserves partial results, blocks on forced session invalidation, and resumes through an explicit partial restart in the same browser context."
  ],
  latestStatus: matchedCandidate ? "completed" : "in_progress",
  proofKey,
  title: `${new Date().toISOString().slice(0, 10)} - Proof 4 Recovery Resume (${blockedObservation.classification.state} -> ${resumedObservation.classification.state})`
});

console.log(JSON.stringify({ ...result, resultPath }, null, 2));
