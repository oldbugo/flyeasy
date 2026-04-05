import path from "node:path";
import fs from "node:fs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { chromium } from "playwright";
import { appendProofLogEntry, getProofLogPath } from "./lib/proof-log.mjs";
import {
  createRunId,
  directoryHasFiles,
  resolveProofPaths
} from "./lib/proof-paths.mjs";

const proofKey = "session-persistence-and-login-recovery";
const proofName = "session-probe";
const baseUrl = process.env.FLYEASY_TRIPCOM_BASE_URL ?? "https://au.trip.com/flights/";
const headless = process.env.FLYEASY_PROOF_HEADFUL === "1" ? false : true;
const manualLogin = process.env.FLYEASY_PROOF_ALLOW_MANUAL_LOGIN === "1";
const manualWaitMs = Number(process.env.FLYEASY_PROOF_MANUAL_WAIT_MS ?? 180_000);
const timeoutMs = Number(process.env.FLYEASY_PROOF_TIMEOUT_MS ?? 60_000);
const runId = createRunId();
const proofPaths = resolveProofPaths(proofName, runId);
const proofStatePath = path.join(proofPaths.browserStateDir, "proof-state.json");
const hadPriorBrowserState = directoryHasFiles(proofPaths.browserStateDir);
const proofState = fs.existsSync(proofStatePath)
  ? JSON.parse(fs.readFileSync(proofStatePath, "utf8"))
  : {};
const hadAuthenticatedMarker = Boolean(proofState.lastAuthenticatedAt);

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value, limit = 500) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}...`;
}

function buildSignals(url, title, bodyText, visibleActions) {
  const combinedText = normalizeText(`${title} ${bodyText} ${visibleActions.join(" ")}`).toLowerCase();
  const currentUrl = url.toLowerCase();

  return {
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
    ].filter(Boolean).length,
    authPromptIndicators: [
      /sign in/.test(combinedText),
      /register/.test(combinedText),
      /log in/.test(combinedText),
      /login/.test(combinedText),
      currentUrl.includes("login"),
      currentUrl.includes("signin")
    ].filter(Boolean).length,
    authIndicators: [
      /sign out/.test(combinedText),
      /log out/.test(combinedText),
      /account center/.test(combinedText),
      /profile/.test(combinedText),
      /trip coins/.test(combinedText),
      currentUrl.includes("/account"),
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
    ].filter(Boolean).length
  };
}

function classifySessionState(signals) {
  const hasConnectedSignals = signals.connectedIndicators > 0;
  const hasAuthSignals = signals.authIndicators > 0;
  const hasAuthPromptSignals = signals.authPromptIndicators > 0;

  if (signals.challengeIndicators > 0) {
    return {
      confidence: 0.9,
      reason: "Trip.com rendered challenge or verification signals.",
      state: "challenge_required"
    };
  }

  if (hasConnectedSignals && !hasAuthPromptSignals) {
    return {
      confidence: 0.7,
      reason: "Page exposes strong authenticated-account signals without showing a sign-in prompt.",
      state: "connected"
    };
  }

  if (hadAuthenticatedMarker && hasAuthPromptSignals) {
    return {
      confidence: 0.65,
      reason: "A previously authenticated browser context exists, but the page now prompts for authentication.",
      state: "session_expired"
    };
  }

  return {
    confidence: 0.35,
    reason: hadAuthenticatedMarker
      ? "A previously authenticated browser context exists, but the current page does not provide a reliable authenticated or expired verdict."
      : hadPriorBrowserState
        ? "Persistent browser state exists, but it has not yet been proven authenticated, so this run stays unverified."
        : hasAuthSignals
        ? "Fresh or anonymous browser state reached a public Trip.com page with sign-in prompts, so the result is not a reliable authenticated verdict."
        : signals.genericAccountNavIndicators > 0
          ? "Trip.com exposed generic account-navigation text on a public page, which is not strong enough to prove authentication."
        : "Fresh or anonymous browser state produced no reliable authentication verdict.",
    state: "unknown"
  };
}

async function collectObservation(page, context) {
  await page.waitForTimeout(3_000);

  const [title, tripcomUrl, bodyText, cookies, visibleActions] = await Promise.all([
    page.title(),
    Promise.resolve(page.url()),
    page.locator("body").innerText().catch(() => ""),
    context.cookies(),
    page.locator("a, button, [role='button']").evaluateAll((nodes) =>
      nodes
        .map((node) => node.textContent ?? "")
        .map((text) => text.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 25)
    ).catch(() => [])
  ]);

  const normalizedBody = normalizeText(bodyText);
  const signals = buildSignals(tripcomUrl, title, normalizedBody, visibleActions);
  const classification = classifySessionState(signals);

  return {
    bodyPreview: truncate(normalizedBody, 900),
    classification,
    cookieNames: cookies.map((cookie) => cookie.name).slice(0, 20),
    title,
    tripcomUrl,
    visibleActions: visibleActions.slice(0, 12)
  };
}

async function captureArtifacts(page, observation, stage) {
  const screenshotPath = path.join(proofPaths.runDir, `${stage}.png`);
  const htmlPath = path.join(proofPaths.runDir, `${stage}.html`);

  await page.screenshot({
    fullPage: true,
    path: screenshotPath
  });

  const html = await page.content();
  await import("node:fs/promises").then(({ writeFile }) => writeFile(htmlPath, html, "utf8"));

  return {
    ...observation,
    htmlPath,
    screenshotPath,
    stage
  };
}

async function waitForManualRecovery() {
  if (!manualLogin || headless) {
    return "not_requested";
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

const context = await chromium.launchPersistentContext(proofPaths.browserStateDir, {
  headless,
  viewport: { width: 1440, height: 960 }
});

const page = context.pages()[0] ?? await context.newPage();
let initialObservation = null;
let finalObservation = null;
let manualRecoveryWaitMode = "not_requested";

try {
  await page.goto(baseUrl, {
    timeout: timeoutMs,
    waitUntil: "domcontentloaded"
  });

  initialObservation = await collectObservation(page, context);
  initialObservation = await captureArtifacts(page, initialObservation, "initial");

  if (manualLogin && !headless && !hadAuthenticatedMarker) {
    manualRecoveryWaitMode = await waitForManualRecovery();
  }

  finalObservation = manualLogin && !headless
    ? await collectObservation(page, context)
    : initialObservation;

  if (manualLogin && !headless) {
    finalObservation = await captureArtifacts(page, finalObservation, "post-manual");
  }
} finally {
  await context.close();
}

if (manualLogin && !headless && finalObservation.classification.state === "connected") {
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
}

const result = {
  artifactsDir: proofPaths.runDir,
  baseUrl,
  finalObservation,
  hadAuthenticatedMarker,
  hadPriorBrowserState,
  headless,
  initialObservation,
  logPath: getProofLogPath(),
  manualLogin,
  manualRecoveryWaitMode,
  occurredAt: new Date().toISOString(),
  proof: proofKey,
  proofPaths: {
    browserStateDir: proofPaths.browserStateDir,
    runDir: proofPaths.runDir
  },
  runId
};

const resultPath = path.join(proofPaths.runDir, "result.json");
await import("node:fs/promises").then(({ writeFile }) =>
  writeFile(resultPath, JSON.stringify(result, null, 2), "utf8")
);

appendProofLogEntry({
  bullets: [
    `Run id: ${runId}`,
    `Observed state: ${finalObservation.classification.state} (${finalObservation.classification.reason})`,
    `Prior persistent browser state: ${hadPriorBrowserState ? "yes" : "no"}`,
    `Prior authenticated marker: ${hadAuthenticatedMarker ? "yes" : "no"}`,
    `Visible Trip.com URL: ${finalObservation.tripcomUrl}`,
    `Artifact directory: ${proofPaths.runDir}`,
    `Manual login attempted: ${manualLogin && !headless ? "yes" : "no"}`,
    `Manual recovery wait mode: ${manualRecoveryWaitMode}`,
    `Notes: ${manualLogin ? "If the run remained unknown, repeat with a real authenticated session." : "This run establishes the baseline unauthenticated probe only."}`
  ],
  latestStatus: "in_progress",
  proofKey,
  title: `${new Date().toISOString().slice(0, 10)} - Proof 1 Session Probe (${finalObservation.classification.state})`
});

console.log(JSON.stringify({ ...result, resultPath }, null, 2));
