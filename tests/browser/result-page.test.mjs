import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import { chromium } from "playwright";

import { createFlightDataRecorder } from "../../scripts/automation/lib/flight-data-capture.mjs";
import {
  countRenderedCards,
  readFirstCardSignature,
  renderResultCards,
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

    // Trip.com fills in the first 8 cards; the other 22 are empty placeholders
    // until scrolled into view, and the parser skips them.
    assert.equal(cards.length, 8);
    assert.equal(cards[0].priceAmount, 1652);
    assert.equal(cards[0].priceText, "AU$ 1,652");
    assert.match(cards[0].airline, /Batik Air Malaysia/);
    assert.ok(cards.every((card) => Number.isFinite(card.priceAmount)), "every card has a price");
  }));

test("scrolling fills in placeholder cards up to the scan limit, then returns to the top", () =>
  withPage(async (page) => {
    await page.goto(`${fake.origin}/flights/showfarefirst`);
    assert.equal(await countRenderedCards(page), 8);

    assert.equal(await renderResultCards(page, 80), 30, "all 30 cards on the page");
    assert.equal((await parseVisibleCards(page, "outbound_results", 80)).length, 30);
    assert.equal(await page.evaluate(() => window.scrollY), 0);

    await page.reload();
    assert.equal(await renderResultCards(page, 16), 16, "stops once the limit is reached");
  }));

test("parses airline names from Trip.com's redesigned cards", () =>
  withPage(async (page) => {
    await page.goto(`${fake.origin}/fixtures/redesigned-card`);
    const [card] = await parseVisibleCards(page, "outbound_results", 5);

    assert.equal(card.airline, "TransNusa, China Southern Airlines");
    assert.equal(card.airlineCode, "8B");
    assert.equal(card.priceAmount, 1199);
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
    assert.equal(returns.length, 8, "8 filled cards; the rest are placeholders");
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

test("going back waits out lingering return-stage cards (in-page navigation, like Trip.com)", async () => {
  const spaFake = await startFakeTripcom({ mode: "spa-navigation" });

  try {
    await withPage(async (page) => {
      await page.goto(`${spaFake.origin}/flights/showfarefirst?ddate=2026-12-18`);
      const outboundSignature = await readFirstCardSignature(page);
      await page.locator('[data-testid="u_select_btn"]').first().click();
      await page.waitForURL(/showfarenext/);
      await page.waitForFunction(
        (outbound) => document.querySelector('[data-testid^="u-flight-card-"]')?.innerText.replace(/\s+/g, " ").trim() !== outbound,
        outboundSignature
      );

      assert.equal(await returnToOutboundResults(page), true);
      assert.equal(await readFirstCardSignature(page), outboundSignature, "outbound cards, not the lingering return cards");
    });
  } finally {
    await spaFake.close();
  }
});

test("going back reports failure when there is no outbound page to return to", () =>
  withPage(async (page) => {
    await page.goto(`${fake.origin}/flights/showfarenext`);
    const started = Date.now();

    assert.equal(await returnToOutboundResults(page, { timeoutMs: 3_000 }), false);
    assert.ok(Date.now() - started < 6_000, "gives up after its time limit");
  }));

test("going back to a blocked page gives up so the worker reloads and detects the block", () =>
  withPage(async (page) => {
    await page.goto(`${blockedFake.origin}/flights/showfarefirst`);
    await page.goto(`${blockedFake.origin}/flights/showfarenext`);

    assert.equal(await returnToOutboundResults(page, { timeoutMs: 3_000 }), false);
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
