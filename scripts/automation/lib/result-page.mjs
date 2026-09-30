// Small helpers for reading Trip.com result pages, shared by the search worker.

const FLIGHT_CARD_SELECTOR = '[data-testid^="u-flight-card-"]';

// Reads immediately rather than auto-waiting: locator.innerText() waits up to
// 30s for a card to exist, which stalled every check on card-less pages.
export async function readFirstCardSignature(page) {
  return page
    .locator(FLIGHT_CARD_SELECTOR)
    .evaluateAll((nodes) => nodes[0]?.innerText.replace(/\s+/g, " ").trim() || null)
    .catch(() => null);
}

export async function readVisibleCardSignatureList(page, limit = 3) {
  return page
    .locator(FLIGHT_CARD_SELECTOR)
    .evaluateAll((nodes, maxCards) =>
      nodes
        .slice(0, maxCards)
        .map((node) => node.textContent?.replace(/\s+/g, " ").trim())
        .filter(Boolean),
      limit
    )
    .catch(() => []);
}

export async function countRenderedCards(page) {
  return page
    .locator(FLIGHT_CARD_SELECTOR)
    .evaluateAll((nodes) => nodes.filter((node) => node.innerText.trim()).length)
    .catch(() => 0);
}

// Trip.com fills in only about 8 cards at a time; the rest are empty
// placeholders until scrolled into view, and more are appended near the end
// of the list. Scroll until `limit` cards have content or no more appear,
// then return to the top. Returns the number of cards with content.
export async function renderResultCards(page, limit, { progressWaitMs = 1_500, maxSteps = 25 } = {}) {
  let rendered = await countRenderedCards(page);

  for (let step = 0; step < maxSteps && rendered < limit; step += 1) {
    await page
      .locator(FLIGHT_CARD_SELECTOR)
      .evaluateAll((nodes) => {
        const filled = nodes.filter((node) => node.innerText.trim());
        filled[filled.length - 1]?.scrollIntoView({ block: "start" });
      })
      .catch(() => {});

    const deadline = Date.now() + progressWaitMs;
    let next = rendered;

    while (Date.now() < deadline && next <= rendered) {
      await page.waitForTimeout(150);
      next = await countRenderedCards(page);
    }

    if (next <= rendered) {
      break;
    }

    rendered = next;
  }

  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  return rendered;
}

// Wait until the result cards stop changing instead of sleeping a fixed time.
// maxMs is the old fixed delay, so this is never slower than before.
export async function waitForCardsToSettle(page, maxMs, stableMs = 750) {
  const deadline = Date.now() + maxMs;
  let previousSignature = null;
  let stableSince = Date.now();

  while (Date.now() < deadline) {
    const cardCount = await page
      .locator(FLIGHT_CARD_SELECTOR)
      .count()
      .catch(() => 0);
    const signature = `${cardCount}|${(await readVisibleCardSignatureList(page, 3)).join("|")}`;

    if (signature !== previousSignature) {
      previousSignature = signature;
      stableSince = Date.now();
    } else if (cardCount > 0 && Date.now() - stableSince >= stableMs) {
      return;
    }

    await page.waitForTimeout(250);
  }
}

// Going back from the return stage is cheaper than reloading the whole search
// for each outbound branch. Trip.com handles "back" inside the page, so the
// return-stage cards can linger after the address changes; wait until the
// cards on screen are no longer the return-stage ones. Returns false (the
// caller reloads) if that does not happen in time.
export async function returnToOutboundResults(page, { timeoutMs = 20_000 } = {}) {
  const returnStageSignature = await readFirstCardSignature(page);
  await page.goBack({ timeout: 15_000, waitUntil: "domcontentloaded" }).catch(() => null);

  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (/showfarefirst/i.test(page.url())) {
      const signature = await readFirstCardSignature(page);

      if (signature && signature !== returnStageSignature) {
        return true;
      }
    } else if (Date.now() - startedAt > 3_000) {
      // Back went somewhere else entirely; reloading is the only option.
      return false;
    }

    await page.waitForTimeout(250);
  }

  return false;
}
