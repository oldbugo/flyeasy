import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const BASE_URL = process.env.FLYEASY_BASE_URL ?? "http://127.0.0.1:3000";
const AUDIT_DATE = new Date().toISOString().slice(0, 10);
const RUN_LABEL = new Date().toISOString().replaceAll(":", "-");
const OUTPUT_DIR = path.resolve(
  "artifacts",
  "ui-audit",
  `${AUDIT_DATE}-workflow-sweep`,
  RUN_LABEL
);
const SESSION_LOADER_SELECTOR = "[data-testid='session-content-loading']";
const STRATEGY_TOGGLE_CASES = [
  {
    label: "Price return option expansion",
    selector: 'input[type="checkbox"][name="price_first_market_scan__enableReturnOptionExpansion"]'
  },
  {
    label: "Price anchored date follow-up",
    selector: 'input[type="checkbox"][name="price_first_market_scan__enableAnchoredDateFollowup"]'
  },
  {
    label: "Multi-city verification",
    selector: 'input[type="checkbox"][name="multi_city_verification__enabled"]'
  },
  {
    label: "Anchored multi-city search",
    selector: 'input[type="checkbox"][name="anchored_multi_city_search__enabled"]'
  },
  {
    label: "Alternate return city exploration",
    selector: 'input[type="checkbox"][name="alternate_return_city_exploration__enabled"]'
  },
  {
    label: "Recommendation date coverage",
    selector: 'input[type="checkbox"][name="recommendation_date_coverage__enabled"]'
  },
  {
    label: "Stitched value probe",
    selector: 'input[type="checkbox"][name="stitched_value_probe__enabled"]'
  },
  {
    label: "Baseline experiment mode",
    selector:
      'input[type="checkbox"][name="strategyExperimentMode"][value="baseline_parallel_random"]'
  }
];

function normalizeText(value) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function screenshot(page, fileName, options = {}) {
  const targetPath = path.join(OUTPUT_DIR, fileName);
  await page.screenshot({
    fullPage: true,
    path: targetPath,
    ...options
  });
  return targetPath;
}

async function writeJson(fileName, data) {
  const targetPath = path.join(OUTPUT_DIR, fileName);
  await writeFile(targetPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return targetPath;
}

async function settleSessionNavigation(page, timeoutMs = 12000) {
  const loader = page.locator(SESSION_LOADER_SELECTOR);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const visible = await loader.isVisible().catch(() => false);
    if (!visible) {
      await page.waitForTimeout(150);
      return;
    }

    await page.waitForTimeout(100);
  }

  throw new Error("Session loading UI did not settle before timeout.");
}

async function settleRecommendationPanel(page, timeoutMs = 12000) {
  const busyPanel = page.locator("[aria-busy='true']").first();
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const visible = await busyPanel.isVisible().catch(() => false);
    if (!visible) {
      await page.waitForTimeout(150);
      return;
    }

    await page.waitForTimeout(100);
  }

  throw new Error("Recommendation panel stayed busy before timeout.");
}

async function waitForPageStable(page, timeoutMs = 12000) {
  await page.waitForLoadState("domcontentloaded", { timeout: timeoutMs });
  await settleSessionNavigation(page, timeoutMs);
}

async function findSessionHref(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await waitForPageStable(page);
  return page.locator('a[href^="/sessions/session_"]').first().getAttribute("href");
}

function expectSessionUrl(url) {
  return /\/sessions\/session_[^/?#]+(?:[/?#].*)?$/;
}

function uniqueSessionName() {
  return `UI Sweep ${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

async function fillSessionForm(page, values) {
  await page.locator('input[name="name"]').fill(values.name);
  await page.locator('select[name="searchIntensity"]').selectOption(values.searchIntensity);
  await page.locator('input[name="refreshIntervalHours"]').fill(String(values.refreshIntervalHours));

  await page.locator('input[name="originAirport"]').fill(values.originAirport);
  await page.locator('input[name="originAirport"]').blur();
  await page.locator('input[name="outboundDestinationCity"]').fill(values.outboundDestinationCity);
  await page.locator('input[name="outboundDestinationCity"]').blur();
  await page.locator('input[name="returnDestinationAirport"]').fill(values.returnDestinationAirport);
  await page.locator('input[name="returnDestinationAirport"]').blur();

  await page.locator('input[name="departureStartDate"]').fill(values.departureStartDate);
  await page.locator('input[name="latestReturnDate"]').fill(values.latestReturnDate);
  await page.locator('input[name="durationMinDays"]').fill(String(values.durationMinDays));
  await page.locator('input[name="durationMaxDays"]').fill(String(values.durationMaxDays));
  await page.locator('select[name="returnOriginMode"]').selectOption(values.returnOriginMode);

  if (values.returnOriginCity) {
    await page.locator('input[name="returnOriginCity"]').fill(values.returnOriginCity);
    await page.locator('input[name="returnOriginCity"]').blur();
  }

  await page.locator('input[name="maxStops"]').fill(String(values.maxStops));
  await page.locator('select[name="bookingMode"]').selectOption(values.bookingMode);

  if (values.requireIncludedCheckedBaggage) {
    await page.locator('input[name="requireIncludedCheckedBaggage"]').check();
  }

  if (values.restrictToChineseAirlines) {
    await page.locator('input[name="restrictToChineseAirlines"]').check();
  }

  await page.locator('input[name="stopDurationMinDays"]').fill(String(values.stopDurationMinDays));
  await page.locator('input[name="stopDurationMaxDays"]').fill(String(values.stopDurationMaxDays));
  await page.locator('textarea[name="notes"]').fill(values.notes);
}

async function saveStickyForm(page) {
  await page.locator('[data-testid="sticky-save-action"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('[data-testid="sticky-save-action"]').click();
  await expectStickySaveState(page, "saving", 2500);
  await page.waitForLoadState("domcontentloaded");
  await waitForPageStable(page);
  await expectStickySaveState(page, "saved", 4000);
  await expectStickySaveVisibility(page, false, 7000);
}

function createRuntimeCollector(page) {
  const entries = [];

  const onPageError = (error) => {
    entries.push({
      message: error.message,
      source: "pageerror",
      stack: error.stack ?? null,
      timestamp: new Date().toISOString()
    });
  };

  const onConsole = (msg) => {
    if (msg.type() !== "error") {
      return;
    }

    entries.push({
      message: msg.text(),
      source: "console",
      timestamp: new Date().toISOString()
    });
  };

  page.on("pageerror", onPageError);
  page.on("console", onConsole);

  return {
    dispose() {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
    },
    flushSince(index) {
      return entries.slice(index);
    },
    mark() {
      return entries.length;
    }
  };
}

async function expectSessionTabState(page, expectedTabId, expectedPathSuffix, expectedHeading) {
  await page.waitForURL(`${BASE_URL}${expectedPathSuffix}`, { timeout: 15000 });
  await waitForPageStable(page);

  const activeTab = page.locator(`[data-session-tab-id="${expectedTabId}"][aria-current="page"]`);
  if (!(await activeTab.isVisible().catch(() => false))) {
    throw new Error(`Expected active tab "${expectedTabId}" on ${expectedPathSuffix}.`);
  }

  if (expectedHeading) {
    const heading = page.getByRole("heading", { name: expectedHeading });
    if (!(await heading.isVisible().catch(() => false))) {
      throw new Error(
        `Expected heading "${expectedHeading}" to be visible on ${expectedPathSuffix}.`
      );
    }
  }
}

async function assertStrategyPageHealthy(page, toggleLabel, runtimeErrors) {
  await waitForPageStable(page);

  const runtimeOverlayVisible = await page
    .getByText("Runtime TypeError", { exact: true })
    .first()
    .isVisible()
    .catch(() => false);
  if (runtimeOverlayVisible) {
    throw new Error(`Runtime overlay appeared after toggling ${toggleLabel}.`);
  }

  if (runtimeErrors.length > 0) {
    throw new Error(
      `Runtime error after toggling ${toggleLabel}: ${runtimeErrors
        .map((entry) => `[${entry.source}] ${entry.message}`)
        .join(" | ")}`
    );
  }

  const requiredLocators = [
    page.getByRole("heading", { name: "Search strategy" }).first(),
    page.locator('[data-session-tab-id="strategy"][aria-current="page"]'),
    page.locator('form[id^="session-strategy-form-"]').first()
  ];

  for (const locator of requiredLocators) {
    if (!(await locator.isVisible().catch(() => false))) {
      throw new Error(`Strategy page lost required structure after toggling ${toggleLabel}.`);
    }
  }

  const bodyText = normalizeText(await page.locator("body").textContent().catch(() => ""));
  if (bodyText.length < 200) {
    throw new Error(`Strategy page content collapsed unexpectedly after toggling ${toggleLabel}.`);
  }
}

async function expectStickySaveVisibility(page, isVisible, timeoutMs = 5000) {
  const action = page.locator('[data-testid="sticky-save-action"]');
  if (isVisible) {
    await action.waitFor({ state: "visible", timeout: timeoutMs });
    return;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const visible = await action.isVisible().catch(() => false);
    if (!visible) {
      return;
    }

    await page.waitForTimeout(100);
  }

  throw new Error("Sticky save action stayed visible when it should be hidden.");
}

async function expectStickySaveState(page, expectedState, timeoutMs = 5000) {
  const action = page.locator('[data-testid="sticky-save-action"]');
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const visible = await action.isVisible().catch(() => false);
    const state = await action.getAttribute("data-save-state").catch(() => null);
    if (visible && state === expectedState) {
      return;
    }

    await page.waitForTimeout(100);
  }

  throw new Error(`Sticky save action did not reach the "${expectedState}" state.`);
}

async function readSessionViewportScrollTop(page) {
  return page
    .locator("[data-session-scroll-viewport]")
    .evaluate((node) => node.scrollTop);
}

async function alignToggleInViewport(page, selector) {
  const checkbox = page.locator(selector).first();
  await checkbox.waitFor({ state: "attached", timeout: 5000 });
  await checkbox.evaluate((node) => {
    const label = node.closest("label");
    if (!(label instanceof HTMLElement)) {
      throw new Error("No toggle label found.");
    }

    const viewport = document.querySelector("[data-session-scroll-viewport]");
    if (!(viewport instanceof HTMLElement)) {
      throw new Error("No session scroll viewport found.");
    }

    const viewportRect = viewport.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const desiredTop = viewport.scrollTop + (labelRect.top - viewportRect.top) - 140;
    viewport.scrollTo({ top: Math.max(0, desiredTop) });
  });
  await page.waitForTimeout(150);
}

async function clickVisibleToggle(page, selector) {
  const checkbox = page.locator(selector).first();
  const label = checkbox.locator("xpath=ancestor::label[1]");
  await label.click();
}

function assertViewportDidNotJump(toggleLabel, beforeScrollTop, afterScrollTop) {
  const delta = Math.abs(afterScrollTop - beforeScrollTop);
  if (delta > 180) {
    throw new Error(
      `${toggleLabel} caused an unexpected viewport jump (${beforeScrollTop} -> ${afterScrollTop}).`
    );
  }
  return delta;
}

async function captureToggleLabelLocation(page, selector) {
  const checkbox = page.locator(selector).first();
  return checkbox.evaluate((node) => {
    const label = node.closest("label");
    if (!(label instanceof HTMLElement)) {
      throw new Error("No toggle label found.");
    }

    const rect = label.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      top: rect.top
    };
  });
}

async function setCheckboxValue(page, selector, checked) {
  const checkbox = page.locator(selector);
  await checkbox.waitFor({ state: "attached", timeout: 5000 });
  await checkbox.evaluate((input, nextChecked) => {
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected an input element.");
    }

    input.checked = Boolean(nextChecked);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, checked);
}

async function runStep(page, report, name, fn) {
  const stepRecord = {
    finishedAt: null,
    name,
    startedAt: new Date().toISOString(),
    status: "running"
  };

  report.steps.push(stepRecord);

  try {
    await fn();
    stepRecord.status = "passed";
  } catch (error) {
    stepRecord.status = "failed";
    stepRecord.error = error instanceof Error ? error.message : String(error);
    stepRecord.screenshot = path.relative(
      OUTPUT_DIR,
      await screenshot(page, `${slugify(name)}-failure.png`)
    );
  } finally {
    stepRecord.finishedAt = new Date().toISOString();
  }
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function ensureNoFailures(report) {
  const failedSteps = report.steps.filter((step) => step.status === "failed");
  if (failedSteps.length > 0) {
    throw new Error(
      `Workflow sweep failed in ${failedSteps.length} step(s): ${failedSteps
        .map((step) => step.name)
        .join(", ")}`
    );
  }
}

async function main() {
  await ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 }
  });
  const page = await context.newPage();
  const runtimeCollector = createRuntimeCollector(page);
  const report = {
    baseUrl: BASE_URL,
    createdSessionId: null,
    duplicateSessionId: null,
    generatedAt: new Date().toISOString(),
    observations: [],
    seededSessionId: null,
    steps: []
  };

  const sessionTemplate = {
    bookingMode: "both",
    departureStartDate: "2026-05-01",
    durationMaxDays: 27,
    durationMinDays: 18,
    latestReturnDate: "2026-06-08",
    maxStops: 2,
    name: uniqueSessionName(),
    notes: "Automated workflow sweep session. Safe to archive.",
    originAirport: "MEL",
    outboundDestinationCity: "Guangzhou",
    refreshIntervalHours: 8,
    requireIncludedCheckedBaggage: true,
    restrictToChineseAirlines: true,
    returnDestinationAirport: "MEL",
    returnOriginMode: "any_mainland_city",
    returnOriginCity: "",
    searchIntensity: "balanced",
    stopDurationMaxDays: 5,
    stopDurationMinDays: 0
  };

  await runStep(page, report, "Discover seeded session", async () => {
    const sessionHref = await findSessionHref(page);
    if (!sessionHref) {
      throw new Error("No seeded session link found on the home page.");
    }

    report.seededSessionId = sessionHref.split("/").filter(Boolean).at(-1);
  });

  await runStep(page, report, "Exercise seeded overview recommendation filters", async () => {
    if (!report.seededSessionId) {
      throw new Error("Seeded session is unavailable.");
    }

    await page.goto(`${BASE_URL}/sessions/${report.seededSessionId}`, {
      waitUntil: "domcontentloaded"
    });
    await waitForPageStable(page);

    for (const label of ["No multi-city", "Only multi-city", "All trips"]) {
      await page.getByRole("button", { name: label }).click();
      await settleRecommendationPanel(page);
    }

    const endpointButton = page.locator('button[aria-label^="Change "]').first();
    if ((await endpointButton.count()) > 0) {
      await endpointButton.click();
      await page.getByRole("button", { name: "Done" }).waitFor({ state: "visible", timeout: 5000 });
      await page.getByRole("button", { name: "Done" }).click();
    }
  });

  await runStep(page, report, "Exercise seeded session tab navigation and detail routes", async () => {
    if (!report.seededSessionId) {
      throw new Error("Seeded session is unavailable.");
    }

    await page.goto(`${BASE_URL}/sessions/${report.seededSessionId}`, {
      waitUntil: "domcontentloaded"
    });
    await waitForPageStable(page);

    for (const tab of ["Results", "History", "Session setting", "Search strategy", "Overview"]) {
      await page.getByRole("link", { name: tab }).click();
      await waitForPageStable(page);
    }

    const candidateLink = page.getByRole("link", { name: "Candidate detail" }).first();
    if ((await candidateLink.count()) > 0) {
      await candidateLink.click();
      await waitForPageStable(page);
      await page.goBack({ waitUntil: "domcontentloaded" });
      await waitForPageStable(page);
    }

    await page.goto(`${BASE_URL}/sessions/${report.seededSessionId}/history`, {
      waitUntil: "domcontentloaded"
    });
    await waitForPageStable(page);
    const runLink = page.locator('a[href*="/runs/run_"]').first();
    if ((await runLink.count()) > 0) {
      await runLink.click();
      await waitForPageStable(page);
    }
  });

  await runStep(page, report, "Create throwaway session", async () => {
    await page.goto(`${BASE_URL}/sessions/new`, { waitUntil: "domcontentloaded" });
    await waitForPageStable(page);
    await fillSessionForm(page, sessionTemplate);
    await page.getByRole("button", { name: "Create session" }).click();
    await page.waitForURL(expectSessionUrl(), { timeout: 15000 });
    await waitForPageStable(page);

    const sessionId = page.url().split("/").filter(Boolean).at(-1);
    if (!sessionId?.startsWith("session_")) {
      throw new Error(`Unexpected session URL after create: ${page.url()}`);
    }

    report.createdSessionId = sessionId;
    await screenshot(page, "created-session-overview.png");
  });

  await runStep(page, report, "Save trip settings and verify redirect", async () => {
    if (!report.createdSessionId) {
      throw new Error("Created session is unavailable.");
    }

    await page.goto(`${BASE_URL}/sessions/${report.createdSessionId}/settings`, {
      waitUntil: "domcontentloaded"
    });
    await waitForPageStable(page);

    const updatedName = `${sessionTemplate.name} Updated`;
    await expectStickySaveVisibility(page, false);
    await page.locator('input[name="name"]').fill(updatedName);
    await page.locator('input[name="refreshIntervalHours"]').fill("6");
    await page.locator('textarea[name="notes"]').fill(
      "Updated by the automated workflow sweep."
    );

    await expectStickySaveVisibility(page, true);
    await saveStickyForm(page);
    await expectSessionTabState(
      page,
      "settings",
      `/sessions/${report.createdSessionId}/settings`,
      "Session setting"
    );

    sessionTemplate.name = updatedName;
    sessionTemplate.notes = "Updated by the automated workflow sweep.";
    sessionTemplate.refreshIntervalHours = 6;
  });

  await runStep(page, report, "Tabs remain clickable on settings and strategy pages", async () => {
    if (!report.createdSessionId) {
      throw new Error("Created session is unavailable.");
    }

    await page.goto(`${BASE_URL}/sessions/${report.createdSessionId}/settings`, {
      waitUntil: "domcontentloaded"
    });
    await expectSessionTabState(
      page,
      "settings",
      `/sessions/${report.createdSessionId}/settings`,
      "Session setting"
    );

    await page.getByRole("link", { name: "Results" }).click();
    await expectSessionTabState(
      page,
      "results",
      `/sessions/${report.createdSessionId}/results`,
      "Results"
    );

    await page.getByRole("link", { name: "Search strategy" }).click();
    await expectSessionTabState(
      page,
      "strategy",
      `/sessions/${report.createdSessionId}/strategy`,
      "Search strategy"
    );

    await page.getByRole("link", { name: "Session setting" }).click();
    await expectSessionTabState(
      page,
      "settings",
      `/sessions/${report.createdSessionId}/settings`,
      "Session setting"
    );
  });

  await runStep(page, report, "Reopen settings and verify persisted values", async () => {
    if (!report.createdSessionId) {
      throw new Error("Created session is unavailable.");
    }

    await page.goto(`${BASE_URL}/sessions/${report.createdSessionId}/settings`, {
      waitUntil: "domcontentloaded"
    });
    await waitForPageStable(page);

    const nameValue = await page.locator('input[name="name"]').inputValue();
    const refreshValue = await page.locator('input[name="refreshIntervalHours"]').inputValue();
    const notesValue = await page.locator('textarea[name="notes"]').inputValue();

    if (nameValue !== sessionTemplate.name) {
      throw new Error(`Settings name mismatch. Expected "${sessionTemplate.name}", got "${nameValue}".`);
    }

    if (refreshValue !== String(sessionTemplate.refreshIntervalHours)) {
      throw new Error(
        `Refresh interval mismatch. Expected "${sessionTemplate.refreshIntervalHours}", got "${refreshValue}".`
      );
    }

    if (notesValue !== sessionTemplate.notes) {
      throw new Error("Notes did not persist after saving session settings.");
    }
  });

  await runStep(page, report, "Save strategy configuration with broad option coverage", async () => {
    if (!report.createdSessionId) {
      throw new Error("Created session is unavailable.");
    }

    await page.goto(`${BASE_URL}/sessions/${report.createdSessionId}/strategy`, {
      waitUntil: "domcontentloaded"
    });
    await waitForPageStable(page);
    await expectStickySaveVisibility(page, false);

    await page
      .locator('input[type="radio"][name="baselineStrategyKey"][value="price_first_market_scan"]')
      .check();
    await setCheckboxValue(
      page,
      'input[type="checkbox"][name="price_first_market_scan__enableReturnOptionExpansion"]',
      true
    );
    await setCheckboxValue(
      page,
      'input[type="checkbox"][name="price_first_market_scan__enableAnchoredDateFollowup"]',
      false
    );
    await setCheckboxValue(page, 'input[type="checkbox"][name="multi_city_verification__enabled"]', true);
    await setCheckboxValue(
      page,
      'input[type="checkbox"][name="anchored_multi_city_search__enabled"]',
      true
    );
    await setCheckboxValue(
      page,
      'input[type="checkbox"][name="alternate_return_city_exploration__enabled"]',
      true
    );
    await setCheckboxValue(
      page,
      'input[type="checkbox"][name="recommendation_date_coverage__enabled"]',
      true
    );
    await setCheckboxValue(page, 'input[type="checkbox"][name="stitched_value_probe__enabled"]', true);
    await setCheckboxValue(
      page,
      'input[type="checkbox"][name="strategyExperimentMode"][value="baseline_parallel_random"]',
      true
    );
    await page.locator('input[name="strategyExperimentSampleSize"]').fill("2");
    await expectStickySaveVisibility(page, true);
    await saveStickyForm(page);
    await expectSessionTabState(
      page,
      "strategy",
      `/sessions/${report.createdSessionId}/strategy`,
      "Search strategy"
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForPageStable(page);

    const checks = [
      page.locator('input[type="radio"][name="baselineStrategyKey"][value="price_first_market_scan"]'),
      page.locator('input[type="checkbox"][name="price_first_market_scan__enableReturnOptionExpansion"]'),
      page.locator('input[type="checkbox"][name="multi_city_verification__enabled"]'),
      page.locator('input[type="checkbox"][name="anchored_multi_city_search__enabled"]'),
      page.locator('input[type="checkbox"][name="alternate_return_city_exploration__enabled"]'),
      page.locator('input[type="checkbox"][name="recommendation_date_coverage__enabled"]'),
      page.locator('input[type="checkbox"][name="stitched_value_probe__enabled"]'),
      page.locator('input[type="checkbox"][name="strategyExperimentMode"][value="baseline_parallel_random"]')
    ];

    for (const check of checks) {
      if (!(await check.isChecked())) {
        throw new Error(`Strategy toggle ${await check.getAttribute("name")} did not persist after save.`);
      }
    }

    await setCheckboxValue(
      page,
      'input[type="checkbox"][name="price_first_market_scan__enableAnchoredDateFollowup"]',
      true
    );
    await setCheckboxValue(
      page,
      'input[type="checkbox"][name="strategyExperimentMode"][value="baseline_parallel_random"]',
      false
    );
    await expectStickySaveVisibility(page, true);
    await saveStickyForm(page);
    await expectSessionTabState(
      page,
      "strategy",
      `/sessions/${report.createdSessionId}/strategy`,
      "Search strategy"
    );
  });

  await runStep(page, report, "Exercise live strategy toggles without save", async () => {
    if (!report.createdSessionId) {
      throw new Error("Created session is unavailable.");
    }

    await page.goto(`${BASE_URL}/sessions/${report.createdSessionId}/strategy`, {
      waitUntil: "domcontentloaded"
    });
    await expectSessionTabState(
      page,
      "strategy",
      `/sessions/${report.createdSessionId}/strategy`,
      "Search strategy"
    );
    await expectStickySaveVisibility(page, false);

    for (const toggleCase of STRATEGY_TOGGLE_CASES) {
      const checkbox = page.locator(toggleCase.selector).first();
      const before = await checkbox.isChecked();
      await alignToggleInViewport(page, toggleCase.selector);
      const beforeScrollTop = await readSessionViewportScrollTop(page);
      const beforeLocation = await captureToggleLabelLocation(page, toggleCase.selector);
      const mark = runtimeCollector.mark();

      await clickVisibleToggle(page, toggleCase.selector);
      await page.waitForTimeout(300);
      const runtimeErrorsAfterFirstClick = runtimeCollector.flushSince(mark);
      await assertStrategyPageHealthy(page, `${toggleCase.label} off/on`, runtimeErrorsAfterFirstClick);
      const afterFirstScrollTop = await readSessionViewportScrollTop(page);
      const firstClickScrollDelta = assertViewportDidNotJump(
        `${toggleCase.label} first click`,
        beforeScrollTop,
        afterFirstScrollTop
      );

      const afterFirstClick = await checkbox.isChecked();
      if (afterFirstClick === before) {
        throw new Error(`${toggleCase.label} did not change state on the first click.`);
      }
      await expectStickySaveVisibility(page, true);

      await alignToggleInViewport(page, toggleCase.selector);
      const beforeSecondScrollTop = await readSessionViewportScrollTop(page);
      const secondMark = runtimeCollector.mark();
      await clickVisibleToggle(page, toggleCase.selector);
      await page.waitForTimeout(300);
      const runtimeErrorsAfterSecondClick = runtimeCollector.flushSince(secondMark);
      await assertStrategyPageHealthy(
        page,
        `${toggleCase.label} restore`,
        runtimeErrorsAfterSecondClick
      );
      const afterSecondScrollTop = await readSessionViewportScrollTop(page);
      const secondClickScrollDelta = assertViewportDidNotJump(
        `${toggleCase.label} second click`,
        beforeSecondScrollTop,
        afterSecondScrollTop
      );

      const afterSecondClick = await checkbox.isChecked();
      if (afterSecondClick !== before) {
        throw new Error(`${toggleCase.label} did not restore to its original state.`);
      }
      await expectStickySaveVisibility(page, false);

      report.observations.push({
        afterFirstClick,
        afterSecondClick,
        before,
        firstClickScrollDelta,
        initialLabelTop: beforeLocation.top,
        secondClickScrollDelta,
        toggle: toggleCase.label
      });
    }
  });

  await runStep(page, report, "Toggle monitoring on and off from session setting", async () => {
    if (!report.createdSessionId) {
      throw new Error("Created session is unavailable.");
    }

    await page.goto(`${BASE_URL}/sessions/${report.createdSessionId}/settings`, {
      waitUntil: "domcontentloaded"
    });
    await waitForPageStable(page);
    await page.getByRole("button", { name: "Turn on live monitor" }).click();
    await page.waitForLoadState("domcontentloaded");
    await waitForPageStable(page);
    await page.getByRole("button", { name: "Turn off live monitor" }).waitFor({
      state: "visible",
      timeout: 12000
    });
    await page.getByRole("button", { name: "Turn off live monitor" }).click();
    await page.waitForLoadState("domcontentloaded");
    await waitForPageStable(page);
    await page.getByRole("button", { name: "Turn on live monitor" }).waitFor({
      state: "visible",
      timeout: 12000
    });
  });

  await runStep(page, report, "Duplicate session and verify new session opens", async () => {
    if (!report.createdSessionId) {
      throw new Error("Created session is unavailable.");
    }

    await page.goto(`${BASE_URL}/sessions/${report.createdSessionId}/settings`, {
      waitUntil: "domcontentloaded"
    });
    await waitForPageStable(page);

    const originalUrl = page.url();

    await page.getByRole("button", { name: "Duplicate session" }).click();
    await page.waitForURL(
      (url) => expectSessionUrl(url.toString()) && url.toString() !== originalUrl,
      { timeout: 15000 }
    );
    await waitForPageStable(page);

    const duplicateId = page.url().split("/").filter(Boolean).at(-1);
    if (!duplicateId?.startsWith("session_")) {
      throw new Error(`Unexpected duplicate session URL: ${page.url()}`);
    }

    if (duplicateId === report.createdSessionId) {
      throw new Error("Duplicate session action stayed on the original session.");
    }

    report.duplicateSessionId = duplicateId;
    if (!(await page.getByRole("heading", { name: `${sessionTemplate.name} Copy` }).isVisible())) {
      throw new Error("Duplicated session name did not render with the Copy suffix.");
    }
  });

  await runStep(page, report, "Switch sessions from the sidebar without triggering stuck loaders", async () => {
    if (!report.createdSessionId || !report.duplicateSessionId) {
      throw new Error("Created or duplicate session is unavailable.");
    }

    await page.goto(`${BASE_URL}/sessions/${report.createdSessionId}`, {
      waitUntil: "domcontentloaded"
    });
    await waitForPageStable(page);

    await page.locator(`a[href="/sessions/${report.duplicateSessionId}"]`).first().click();
    await waitForPageStable(page);

    await page.locator(`a[href="/sessions/${report.createdSessionId}"]`).first().click();
    await waitForPageStable(page);

    await page.locator(`a[href="/sessions/${report.duplicateSessionId}"]`).first().click();
    await waitForPageStable(page);
  });

  await runStep(page, report, "Capture final workflow screenshots", async () => {
    if (!report.createdSessionId || !report.duplicateSessionId) {
      throw new Error("Created or duplicate session is unavailable.");
    }

    await page.goto(`${BASE_URL}/sessions/${report.createdSessionId}`, {
      waitUntil: "domcontentloaded"
    });
    await waitForPageStable(page);
    await screenshot(page, "created-session-final.png");

    await page.goto(`${BASE_URL}/sessions/${report.duplicateSessionId}`, {
      waitUntil: "domcontentloaded"
    });
    await waitForPageStable(page);
    await screenshot(page, "duplicate-session-final.png");
  });

  await writeJson("result.json", report);
  runtimeCollector.dispose();
  await browser.close();
  ensureNoFailures(report);

  console.log(
    JSON.stringify(
      {
        duplicateSessionId: report.duplicateSessionId,
        outputDir: OUTPUT_DIR,
        seededSessionId: report.seededSessionId,
        steps: report.steps.map((step) => ({
          error: step.error ?? null,
          name: step.name,
          status: step.status
        })),
        throwawaySessionId: report.createdSessionId
      },
      null,
      2
    )
  );
}

await main();
