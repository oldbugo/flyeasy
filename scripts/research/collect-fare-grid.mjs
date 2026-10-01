// Research collector for the date-search-strategy uplift
// (docs/uplifts/2026-10-date-search-strategy/03-test-and-analysis-plan.md).
//
// Loads public Trip.com results pages one at a time, with random gaps, and
// records the flight-list and calendar responses the page downloads. It stops
// at the first sign of a captcha or block and never tries to get around it.
//
// Usage:
//   node scripts/research/collect-fare-grid.mjs --period A --dataset rt_grid --limit 40
//   datasets: rt_grid | ow_out | ow_ret | sentinel | verify
//   options:  --limit N  --gap-min S  --gap-max S  --headful  --pairs 2026-12-10:2026-12-24,...

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

import { chromium } from "playwright";

import { resolveFlyEasyPaths } from "../lib/flyeasy-paths.mjs";
import { TRIPCOM_ORIGIN } from "../automation/lib/tripcom-browser.mjs";
import { mergeFlightLists, summarizeFlightList } from "./lib/parse-flight-list.mjs";
import { attachTripcomCapture } from "./lib/tripcom-capture.mjs";
import {
  PERIODS,
  ROUTE,
  datePairs,
  daysBetween,
  departureDates,
  returnDates,
  seededShuffle
} from "./lib/periods.mjs";

const PARSER_VERSION = 1;
const DATASETS = new Set(["rt_grid", "ow_out", "ow_ret", "sentinel", "verify"]);
const BLOCK_PATTERN = /whaleguard|captcha|verify you are|slide to|unusual traffic|access denied|robot/i;

function readArgs(argv) {
  const args = { gapMax: 15, gapMin: 5, headful: false, limit: 40 };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--period") args.period = value;
    if (flag === "--dataset") args.dataset = value;
    if (flag === "--limit") args.limit = Number(value);
    if (flag === "--gap-min") args.gapMin = Number(value);
    if (flag === "--gap-max") args.gapMax = Number(value);
    if (flag === "--pairs") args.pairs = value;
    if (flag === "--headful") args.headful = true;
  }
  return args;
}

const args = readArgs(process.argv.slice(2));
const period = PERIODS[args.period];

if (!period || !DATASETS.has(args.dataset)) {
  console.error("Usage: --period A|B --dataset rt_grid|ow_out|ow_ret|sentinel|verify [--limit N]");
  process.exit(2);
}

const researchRoot = path.resolve(process.env.FLYEASY_RESEARCH_DIR ?? "research/fare-grid");
const periodDir = path.join(researchRoot, args.period);
const rawDir = path.join(periodDir, "raw", args.dataset);
fs.mkdirSync(rawDir, { recursive: true });

const datasetFile = path.join(periodDir, `${args.dataset}.jsonl`);
const calendarFile = path.join(periodDir, "calendar.jsonl");

function today() {
  return new Date().toISOString().slice(0, 10);
}

function appendJsonl(filePath, record) {
  fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, "utf8");
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function buildUrl(target) {
  const params = new URLSearchParams({
    acity: target.to.toLowerCase(),
    class: "y",
    curr: "AUD",
    dcity: target.from.toLowerCase(),
    ddate: target.departDate,
    locale: "en-AU",
    lowpricesource: "searchform",
    nonstoponly: "off",
    quantity: "1",
    searchboxarg: "t",
    triptype: target.returnDate ? "rt" : "ow"
  });
  if (target.returnDate) params.set("rdate", target.returnDate);
  return `${TRIPCOM_ORIGIN}/flights/showfarefirst?${params.toString()}`;
}

function parsePairs(text) {
  return String(text)
    .split(",")
    .map((entry) => entry.split(":"))
    .map(([departDate, returnDate]) => ({ departDate, returnDate }));
}

function buildTargets() {
  const roundTrip = (pair) => ({
    departDate: pair.departDate,
    from: ROUTE.originAirport,
    key: `${pair.departDate}_${pair.returnDate}`,
    returnDate: pair.returnDate,
    to: ROUTE.destinationCity
  });

  if (args.dataset === "rt_grid") {
    return seededShuffle(datePairs(period), `rt_grid:${args.period}`).map(roundTrip);
  }
  if (args.dataset === "ow_out") {
    return seededShuffle(departureDates(period), `ow_out:${args.period}`).map((date) => ({
      departDate: date,
      from: ROUTE.originAirport,
      key: date,
      returnDate: null,
      to: ROUTE.destinationCity
    }));
  }
  if (args.dataset === "ow_ret") {
    return seededShuffle(returnDates(period), `ow_ret:${args.period}`).map((date) => ({
      departDate: date,
      from: ROUTE.destinationCity,
      key: date,
      returnDate: null,
      to: ROUTE.originAirport
    }));
  }
  const pairs = args.pairs
    ? parsePairs(args.pairs)
    : period.sentinels.map(([departDate, returnDate]) => ({ departDate, returnDate }));
  return pairs.map(roundTrip);
}

function pendingTargets(targets) {
  // Sentinels and verifications are repeated on purpose; grids are resumable.
  if (args.dataset === "sentinel" || args.dataset === "verify") return targets;

  const attempts = new Map();
  for (const record of readJsonl(datasetFile)) {
    const entry = attempts.get(record.key) ?? { done: false, tries: 0 };
    entry.tries += 1;
    if (record.status === "ok" || record.status === "empty") entry.done = true;
    attempts.set(record.key, entry);
  }
  return targets.filter((target) => {
    const entry = attempts.get(target.key);
    return !entry || (!entry.done && entry.tries < 2);
  });
}

async function readPageState(page) {
  const title = await page.title().catch(() => "");
  const bodyText = await page
    .evaluate(() => document.body?.innerText?.slice(0, 2_000) ?? "")
    .catch(() => "");
  return { bodyText, title, url: page.url() };
}

async function clickCheapestSort(page) {
  const sortTab = page.locator('[data-testid="sort_type_item_2"]').first();
  if (!(await sortTab.isVisible().catch(() => false))) return false;
  if ((await sortTab.getAttribute("aria-selected").catch(() => null)) === "true") return true;
  await sortTab.click({ force: true }).catch(() => {});
  await page.waitForTimeout(2_500);
  return true;
}

async function clickCheapestOutbound(page) {
  await clickCheapestSort(page);
  const card = page.locator('[data-testid^="u-flight-card-"]').first();
  const cardText = (await card.innerText({ timeout: 10_000 }).catch(() => "")).replace(/\s+/g, " ").trim();
  await card.locator('[data-testid="u_select_btn"]').first().click({ timeout: 10_000 });
  return cardText.slice(0, 400);
}

async function loadTarget(context, target) {
  const page = await context.newPage();
  const capture = attachTripcomCapture(page);
  const startedAt = Date.now();
  const record = {
    dataset: args.dataset,
    departDate: target.departDate,
    from: target.from,
    key: target.key,
    leadDays: daysBetween(today(), target.departDate),
    observedAt: new Date().toISOString(),
    parserVersion: PARSER_VERSION,
    period: args.period,
    returnDate: target.returnDate,
    to: target.to
  };

  try {
    await page.goto(buildUrl(target), { timeout: 60_000, waitUntil: "domcontentloaded" });
    const gotList = await capture.waitForList("first");
    record.loadMs = Date.now() - startedAt;

    if (!gotList) {
      const state = await readPageState(page);
      const blocked = BLOCK_PATTERN.test(`${state.title} ${state.bodyText} ${state.url}`);
      record.status = blocked ? "blocked" : /no flights|no results|0 results/i.test(state.bodyText) ? "empty" : "failed";
      record.pageState = { title: state.title, url: state.url, text: state.bodyText.slice(0, 300) };
      await page
        .screenshot({ path: path.join(rawDir, `${target.key}-${Date.now()}-${record.status}.png`) })
        .catch(() => {});
    } else {
      // A non-price sort can leave out the cheapest fares, so switch the page
      // to its "Cheapest" sort when Trip.com opened with another order.
      if (capture.listsForStage("first", "Price").length === 0) {
        await clickCheapestSort(page);
        await capture.waitForList("first", { orderBy: "Price", timeoutMs: 20_000 });
      }

      const priceLists = capture.listsForStage("first", "Price");
      record.status = "ok";
      record.screenSortedByPrice = priceLists.length > 0;
      record.screen = summarizeFlightList(
        mergeFlightLists(priceLists.length > 0 ? priceLists : capture.listsForStage("first"))
      );

      if (args.dataset === "verify") {
        const verifyStartedAt = Date.now();
        try {
          record.clickedCardText = await clickCheapestOutbound(page);
          const gotReturn = await capture.waitForList("return");
          record.verify = gotReturn
            ? summarizeFlightList(mergeFlightLists(capture.listsForStage("return")), { keepItineraries: 10 })
            : null;
          record.verifyMs = Date.now() - verifyStartedAt;
        } catch (error) {
          record.verifyError = error instanceof Error ? error.message.split("\n")[0] : String(error);
        }
      }
    }
  } catch (error) {
    record.status = "failed";
    record.error = error instanceof Error ? error.message.split("\n")[0] : String(error);
    record.loadMs = Date.now() - startedAt;
  } finally {
    await capture.flush();
    record.calendarCount = capture.calendars.length;

    for (const calendar of capture.calendars) {
      appendJsonl(calendarFile, {
        ...calendar.parsed,
        observedAt: record.observedAt,
        sourceDataset: args.dataset,
        sourceKey: target.key
      });
    }

    const rawFile = path.join(rawDir, `${target.key}-${Date.now()}.json.gz`);
    fs.writeFileSync(rawFile, zlib.gzipSync(JSON.stringify(capture.raw)));
    record.rawFile = path.relative(researchRoot, rawFile);
    await page.close().catch(() => {});
  }

  return record;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const paths = resolveFlyEasyPaths();
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(paths.playwrightBrowsersDir)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = paths.playwrightBrowsersDir;
}

const targets = pendingTargets(buildTargets()).slice(0, Math.max(1, args.limit));
console.log(`[collect] period ${args.period} dataset ${args.dataset}: ${targets.length} load(s) this batch`);

// A separate browser profile so research never touches the app's session.
const context = await chromium.launchPersistentContext(path.join(researchRoot, "browser-profile"), {
  headless: !args.headful,
  viewport: { width: 1440, height: 960 }
});

let exitCode = 0;
try {
  for (const [index, target] of targets.entries()) {
    const record = await loadTarget(context, target);
    appendJsonl(datasetFile, record);
    const cheapest = record.screen?.cheapest;
    console.log(
      `[collect] ${index + 1}/${targets.length} ${target.key} ${record.status} ${record.loadMs ?? "-"}ms` +
        (cheapest ? ` any=${cheapest.any} cn=${cheapest.chinese_airlines}` : "") +
        (record.verify ? ` verify any=${record.verify.cheapest.any}` : "") +
        ` calendars=${record.calendarCount}`
    );

    if (record.status === "blocked") {
      console.error("[collect] Trip.com showed a block or captcha. Stopping; resume later.");
      exitCode = 3;
      break;
    }

    if (index < targets.length - 1) {
      const gapSeconds = args.gapMin + Math.random() * Math.max(0, args.gapMax - args.gapMin);
      await sleep(gapSeconds * 1_000);
    }
  }
} finally {
  await context.close().catch(() => {});
}

process.exit(exitCode);
