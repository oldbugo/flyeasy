import path from "node:path";

// Automated tests point this at a local fake Trip.com; it is never set in normal use.
export const TRIPCOM_ORIGIN = (process.env.FLYEASY_TRIPCOM_ORIGIN ?? "https://au.trip.com").replace(/\/$/, "");

export function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

const NO_RESULTS_PATTERNS = [
  {
    detail: "Trip.com reported that no flights were available for this search.",
    pattern: /\bno available flights\b/i
  },
  {
    detail: "Trip.com reported that no flights were available for this search.",
    pattern: /\bno flights available\b/i
  },
  {
    detail: "Trip.com reported that no flight results were available for this search.",
    pattern: /\bno suitable flights\b/i
  },
  {
    detail: "Trip.com reported that no flight results were available for this search.",
    pattern: /\bno matching flights\b/i
  },
  {
    detail: "Trip.com reported that no flight results were returned for this search.",
    pattern: /\bno results? found\b/i
  },
  {
    detail: "Trip.com reported that no flight results were returned for this search.",
    pattern: /\bsorry,?\s+there are no flights available\b/i
  },
  {
    detail: "Trip.com reported that no tickets were available for this search.",
    pattern: /\bno tickets available\b/i
  }
];

export function parseAmount(value) {
  const normalized = value.replace(/[^0-9.]/g, "");

  if (!normalized) {
    return null;
  }

  return Number(normalized);
}

export function buildSignals(url, title, bodyText, visibleActions) {
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
    botProtectionBlock: /whaleguard/.test(combinedText),
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
    ].filter(Boolean).length
  };
}

export function classifyConnectionState(signals, url) {
  if (signals.botProtectionBlock) {
    return {
      detail: "Trip.com's bot protection blocked the automated browser (\"whaleguard block\"). Open Trip.com in the automation browser to check access, then resume the run.",
      state: "blocked"
    };
  }

  if (signals.challengeIndicators > 0) {
    return {
      detail: "Trip.com rendered a challenge or verification block.",
      state: "blocked"
    };
  }

  if (signals.connectedIndicators > 0 && signals.authPromptIndicators === 0) {
    return {
      detail: "Trip.com account signals were detected in the current browser context.",
      state: "ready_authenticated"
    };
  }

  if (String(url).toLowerCase().includes("login") || String(url).toLowerCase().includes("signin")) {
    return {
      detail: "Trip.com is reachable but is asking for authentication.",
      state: "needs_login"
    };
  }

  return {
    detail: "Trip.com public search page loaded without a login requirement.",
    state: "ready_public"
  };
}

export function detectNoResultsState({ bodyText = "", title = "", url = "" } = {}) {
  const combinedText = normalizeText(`${title} ${bodyText} ${url}`);

  if (!combinedText) {
    return null;
  }

  for (const candidate of NO_RESULTS_PATTERNS) {
    const match = combinedText.match(candidate.pattern);

    if (match) {
      return {
        detail: candidate.detail,
        matchedText: match[0]
      };
    }
  }

  return null;
}

// settleMs lets a one-off check wait for the page to finish loading; polling
// loops already wait between checks and pass 0.
export async function collectConnectionObservation(page, context, { settleMs = 3_000 } = {}) {
  if (settleMs > 0) {
    await page.waitForTimeout(settleMs);
  }

  const [title, tripcomUrl, bodyText, visibleActions] = await Promise.all([
    page.title(),
    Promise.resolve(page.url()),
    page.locator("body").innerText().catch(() => ""),
    page
      .locator("a, button, [role='button']")
      .evaluateAll((nodes) =>
        nodes
          .map((node) => node.textContent ?? "")
          .map((text) => text.replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .slice(0, 20)
      )
      .catch(() => [])
  ]);

  const normalizedBodyText = normalizeText(bodyText);
  const signals = buildSignals(tripcomUrl, title, normalizedBodyText, visibleActions);
  const classification = classifyConnectionState(signals, tripcomUrl);

  return {
    bodyText: normalizedBodyText,
    classification,
    cookieCount: (await context.cookies()).length,
    title,
    tripcomUrl
  };
}

export async function captureStageArtifacts(page, runDir, stageName) {
  const screenshotPath = path.join(runDir, `${stageName}.png`);
  const htmlPath = path.join(runDir, `${stageName}.html`);

  await page.screenshot({
    fullPage: true,
    path: screenshotPath
  });

  const html = await page.content();
  await import("node:fs/promises").then(({ writeFile }) => writeFile(htmlPath, html, "utf8"));

  return {
    htmlPath,
    screenshotPath
  };
}

export async function chooseCity(page, fieldTestId, query) {
  const fieldWrapper = page.locator(`[data-testid="${fieldTestId}_wrapper"]`).first();
  const deleteButtons = fieldWrapper.locator('[data-testid^="cityLabel_delete_"]');

  while ((await deleteButtons.count().catch(() => 0)) > 0) {
    await deleteButtons.first().click().catch(() => {});
    await page.waitForTimeout(150);
  }

  const input = page.locator(`[data-testid="${fieldTestId}"]`).first();
  await input.click();
  await input.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
  await input.fill("");
  await input.fill(query);

  const wrapper = page.locator(`[data-testid="${fieldTestId}_poi_wrapper"]`).first();
  await wrapper.waitFor({ state: "visible", timeout: 15_000 });
  await wrapper.locator('[data-testid="0"]').click();
  await page.waitForTimeout(800);
}

export async function collectLocationSuggestions(page, fieldTestId, query) {
  const input = page.locator(`[data-testid="${fieldTestId}"]`).first();
  await input.evaluate((node) => node instanceof HTMLElement && node.focus());
  await input.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
  await input.fill("");
  await page.waitForTimeout(150);
  await input.fill(query);

  const wrapper = page.locator(`[data-testid="${fieldTestId}_poi_wrapper"]`).first();
  await wrapper.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(400);

  return wrapper.evaluate((node) => {
    const rows = Array.from(node.querySelectorAll('[data-testid]'));

    return rows
      .map((row, index) => ({
        index,
        text: row.textContent?.replace(/\s+/g, " ").trim() ?? ""
      }))
      .filter((row) => row.text.length > 0);
  });
}

export async function parseVisibleCards(page, stageName, limit = 6) {
  return page.locator('[data-testid^="u-flight-card-"]').evaluateAll((nodes, args) => {
    const { maxCards, stage } = args;
    const parsePriceAmount = (value) => {
      const normalized = value.replace(/[^0-9.]/g, "");

      if (!normalized) {
        return null;
      }

      return Number(normalized);
    };
    const normalizeNodeText = (value) => value?.replace(/\s+/g, " ").trim() ?? "";
    const textOf = (node, selector) => {
      const element = node.querySelector(selector);
      return element ? normalizeNodeText(element.textContent) : null;
    };
    const parseOperatingAirline = (value) => {
      const match = value.match(
        /operated by\s+([A-Za-z0-9.'&-]+(?:\s+[A-Za-z0-9.'&-]+){0,5})/i
      );
      return match ? normalizeNodeText(match[1]) : null;
    };
    const parseAirlineCode = (node) => {
      const logoSrc =
        node.querySelector('img[src]')?.getAttribute("src") ??
        node.querySelector('img[data-testid]')?.getAttribute("src") ??
        "";
      const codeMatch = logoSrc.match(/\/([a-z0-9]{2,3})\.(?:png|svg|webp)(?:[?#]|$)/i);
      return codeMatch ? codeMatch[1].toUpperCase() : null;
    };
    const readBaggageSummary = (node, rawText) => {
      const baggageLabels = Array.from(
        node.querySelectorAll('[data-testid="list_label_baggages"], [data-label*="BAGGAGE"]')
      )
        .map((element) =>
          normalizeNodeText(element.textContent || element.getAttribute("data-label") || "")
        )
        .filter(Boolean);
      const inlineMatch = rawText.match(
        /checked baggage(?:\s+\d+\s*x\s*\d+\s*kg|\s+\d+\s*kg|\s+\d+\s*(?:pc|pcs|piece|pieces))?/i
      );

      return baggageLabels[0] ?? (inlineMatch ? normalizeNodeText(inlineMatch[0]) : null);
    };

    return nodes.slice(0, maxCards).map((node, index) => {
      const flightGroup = node.querySelector('[role="group"][aria-label]');
      const accessibilitySummary = flightGroup?.getAttribute("aria-label")?.replace(/\s+/g, " ").trim() ?? "";
      const rawText = normalizeNodeText(node.textContent ?? "");
      const baggageSummary = readBaggageSummary(node, rawText);
      const hasIncludedCheckedBaggage =
        node.querySelector('[data-label="FREE_CHECKED_BAGGAGE"]') != null ||
        Boolean(
          baggageSummary &&
            /checked baggage/i.test(baggageSummary) &&
            !/\bno\b/i.test(baggageSummary)
        );

      return {
        accessibilitySummary,
        // Older cards mark the name with a test id; the redesigned cards
        // (seen from late Sept 2026) only use the "flight-name" class.
        airline:
          textOf(node, '[data-testid="flights-name"]') ?? textOf(node, ".airline-info .flight-name"),
        airlineCode: parseAirlineCode(node),
        baggageSummary,
        cardIndex: index + 1,
        duration: textOf(node, '[data-testid="flightInfoDuration"]'),
        hasIncludedCheckedBaggage,
        operatingAirline: parseOperatingAirline(rawText),
        priceAmount: parsePriceAmount(textOf(node, '[data-testid="u_price_info"]') ?? ""),
        priceText: textOf(node, '[data-testid="u_price_info"]'),
        rawText,
        selectText: textOf(node, '[data-testid="u_select_btn"]'),
        stage,
        stopText: textOf(node, '[data-testid="stopInfoText"]'),
        testId: node.getAttribute("data-testid"),
        timingMarkers: Array.from(node.querySelectorAll('[data-testid^="flight-time-"]'))
          .map((element) => element.textContent?.replace(/\s+/g, " ").trim())
          .filter(Boolean)
      };
    });
  }, { maxCards: limit, stage: stageName })
    // Cards that have not been scrolled into view yet are empty placeholders.
    .then((cards) => cards.filter((card) => card.rawText));
}

export function inferStopCount(stopText) {
  if (!stopText || /direct/i.test(stopText)) {
    return 0;
  }

  const explicitStopMatch = stopText.match(/(\d+)\s*stop/i);

  if (explicitStopMatch) {
    return Number(explicitStopMatch[1]);
  }

  if (/\bin\s+/i.test(stopText) || /\blayover\b/i.test(stopText) || /\bvia\b/i.test(stopText)) {
    return 1;
  }

  return 1;
}

export async function parseStopoverFilterOptions(page) {
  return page
    .locator('[data-testid="filter_stopoverport"] .filter-item')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const code = node.getAttribute("data-code") ?? "";
          const text = node.querySelector(".filter-text")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
          const priceText =
            node.querySelector(".filter-desc")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
          const priceAmount = Number((priceText.match(/[0-9,.]+/)?.[0] ?? "").replace(/,/g, ""));

          return {
            cityCode: code,
            cityName: text,
            displayedPriceAmount: Number.isFinite(priceAmount) ? priceAmount : null,
            displayedPriceText: priceText
          };
        })
        .filter((entry) => entry.cityCode && entry.cityName)
    )
    .catch(() => []);
}
