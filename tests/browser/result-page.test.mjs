import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

import { createFlightDataRecorder } from "../../scripts/automation/lib/flight-data-capture.mjs";
import {
  readFirstCardSignature,
  returnToOutboundResults,
  waitForCardsToSettle
} from "../../scripts/automation/lib/result-page.mjs";
import {
  parseStopoverFilterOptions,
  parseVisibleCards
} from "../../scripts/automation/lib/tripcom-browser.mjs";
import { startFakeTripcom } from "../support/fake-tripcom.mjs";

let browser;
let fake;
let blockedFake;

before(async () => {
  browser = await chromium.launch({ headless: true });
  fake = await startFakeTripcom();
  blockedFake = await startFakeTripcom({ mode: "results-blocked" });
});

after(async () => {
  await browser?.close();
  await fake?.close();
  await blockedFake?.close();
});

async function withPage(fn) {
  const page = await browser.newPage();
  try {
    return await fn(page);
  } finally {
    await page.close();
  }
}

test("parses outbound cards from a saved Trip.com results page", () =>
  withPage(async (page) => {
    await page.goto(`${fake.origin}/flights/showfarefirst`);
    const cards = await parseVisibleCards(page, "outbound_results", 80);

    // Trip.com renders the first cards and leaves the rest as empty
    // placeholders until scrolled; the worker scrolls to fill them.
    const rendered = cards.filter((card) => card.rawText);
    assert.equal(cards.length, 30);
    assert.equal(rendered.length, 8);
    assert.equal(cards[0].priceAmount, 1652);
    assert.equal(cards[0].priceText, "AU$ 1,652");
    assert.match(cards[0].airline, /Batik Air Malaysia/);
    assert.ok(rendered.every((card) => Number.isFinite(card.priceAmount)), "rendered cards have prices");
  }));

test("parses return cards and stopover filter options", () =>
  withPage(async (page) => {
    await page.goto(`${fake.origin}/flights/showfarefirst`);
    const stopovers = await parseStopoverFilterOptions(page);
    assert.deepEqual(
      stopovers.map((option) => option.cityCode).slice(0, 3),
      ["SHA", "HKG", "DPS"]
    );

    await page.goto(`${fake.origin}/flights/showfarenext`);
    const returns = await parseVisibleCards(page, "return_results", 60);
    assert.equal(returns.length, 25);
    assert.equal(returns[0].priceAmount, 1829);
  }));

test("settle wait returns early once the cards stop changing", () =>
  withPage(async (page) => {
    await page.goto(`${fake.origin}/flights/showfarefirst`);
    const started = Date.now();
    await waitForCardsToSettle(page, 3_000);
    const elapsed = Date.now() - started;

    assert.ok(elapsed < 2_000, `expected an early return, took ${elapsed}ms`);
  }));

test("settle wait keeps waiting, up to its limit, while cards change", () =>
  withPage(async (page) => {
    await page.goto(`${fake.origin}/flights/showfarefirst`);
    await page.evaluate(() => {
      let tick = 0;
      setInterval(() => {
        document.querySelector('[data-testid^="u-flight-card-"]')?.append(` ${tick++}`);
      }, 200);
    });
    const started = Date.now();
    await waitForCardsToSettle(page, 2_000);
    const elapsed = Date.now() - started;

    assert.ok(elapsed >= 1_900, `expected to wait for the limit, took ${elapsed}ms`);
  }));

test("going back from the return stage restores the outbound list", () =>
  withPage(async (page) => {
    await page.goto(`${fake.origin}/flights/showfarefirst?ddate=2026-12-18`);
    const outboundSignature = await readFirstCardSignature(page);
    await page.locator('[data-testid="u_select_btn"]').first().click();
    await page.waitForURL(/showfarenext/);

    assert.equal(await returnToOutboundResults(page), true);
    assert.match(page.url(), /showfarefirst/);
    assert.equal(await readFirstCardSignature(page), outboundSignature);
  }));

test("going back reports failure when there is no outbound page to return to", () =>
  withPage(async (page) => {
    await page.goto(`${fake.origin}/flights/showfarenext`);
    const started = Date.now();

    assert.equal(await returnToOutboundResults(page), false);
    assert.ok(Date.now() - started < 5_000, "falls back to a reload quickly");
  }));

test("going back to a blocked page still hands over to the normal results wait", () =>
  withPage(async (page) => {
    // The worker's results wait then detects the block (covered by the worker tests).
    await page.goto(`${blockedFake.origin}/flights/showfarefirst`);
    await page.goto(`${blockedFake.origin}/flights/showfarenext`);

    assert.equal(await returnToOutboundResults(page), true);
    assert.equal(await readFirstCardSignature(page), null, "no cards, and no 30s wait for them");
  }));

test("flight-data recorder saves decoded samples up to its limit", () =>
  withPage(async (page) => {
    const runDir = fs.mkdtempSync(path.join(os.tmpdir(), "flyeasy-recorder-"));
    const artifactRecords = [];
    const recorder = createFlightDataRecorder({ artifactRecords, maxSamples: 1, runDir });
    recorder.attach(page, "query-01");

    await page.goto(`${fake.origin}/flights/showfarefirst`);
    await page.reload();
    await page.waitForTimeout(500);
    await recorder.flush();

    const files = fs.readdirSync(runDir);
    assert.deepEqual(files, ["query-01-flight-list-1.json"]);
    const sample = JSON.parse(fs.readFileSync(path.join(runDir, files[0]), "utf8"));
    assert.equal(sample.events[0].data.itineraryList[0].price, 1215);
    assert.equal(artifactRecords[0].type, "json_export");
    fs.rmSync(runDir, { force: true, recursive: true });
  }));
