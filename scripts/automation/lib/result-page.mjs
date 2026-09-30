// Small helpers for reading Trip.com result pages, shared by the search worker.

const FLIGHT_CARD_SELECTOR = '[data-testid^="u-flight-card-"]';

export async function readFirstCardSignature(page) {
  return page
    .locator(FLIGHT_CARD_SELECTOR)
    .first()
    .innerText()
    .then((value) => value.replace(/\s+/g, " ").trim())
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
// for each outbound branch. Returns false (caller reloads) if the outbound
// list does not come back quickly.
export async function returnToOutboundResults(page) {
  const navigated = await page
    .goBack({ timeout: 15_000, waitUntil: "domcontentloaded" })
    .then(() => true)
    .catch(() => false);

  if (!navigated) {
    return false;
  }

  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if (/showfarefirst/i.test(page.url()) && (await readFirstCardSignature(page))) {
      return true;
    }

    await page.waitForTimeout(250);
  }

  return false;
}
