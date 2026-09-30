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
// for each outbound branch. Returns true once the page is back on the
// outbound results address; the caller then waits for results as usual (which
// handles loading, blocks and no-results). Returns false if it should reload.
export async function returnToOutboundResults(page) {
  await page.goBack({ timeout: 15_000, waitUntil: "domcontentloaded" }).catch(() => null);

  const deadline = Date.now() + 3_000;

  while (Date.now() < deadline) {
    if (/showfarefirst/i.test(page.url())) {
      return true;
    }

    await page.waitForTimeout(100);
  }

  return false;
}
