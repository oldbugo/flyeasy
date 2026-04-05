import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

import seeds from "../../src/lib/locations/data/tripcom-sync-seeds.json" with { type: "json" };
import { ensureFlyEasyPaths } from "../lib/flyeasy-paths.mjs";
import { collectLocationSuggestions } from "../automation/lib/tripcom-browser.mjs";

const headless = process.env.FLYEASY_LOCATION_SYNC_HEADFUL === "1" ? false : true;
const timeoutMs = Number(process.env.FLYEASY_LOCATION_SYNC_TIMEOUT_MS ?? 90_000);

function nowIso() {
  return new Date().toISOString();
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function uniqueByCode(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item.code || seen.has(item.code)) {
      return false;
    }
    seen.add(item.code);
    return true;
  });
}

function normalizeSuggestion(query, field, suggestion) {
  const text = suggestion.text.replace(/\s+/g, " ").trim();
  const codes = Array.from(new Set(text.match(/\b[A-Z]{3}\b/g) ?? []));
  const pieces = text.split(/,| - |\|/).map((piece) => piece.trim()).filter(Boolean);
  const firstPiece = pieces[0] ?? text;

  if (field === "airport" && codes.length > 0) {
    const code = codes[0];
    const displayName = firstPiece.replace(new RegExp(`\\b${code}\\b`, "g"), "").trim() || firstPiece;
    const cityName =
      pieces.find((piece) => piece !== firstPiece && !piece.includes(code) && !/airport/i.test(piece)) ??
      query;

    return {
      aliases: uniqueByCode([{ code, aliases: [query.toLowerCase(), displayName.toLowerCase()] }])[0]?.aliases ?? [
        query.toLowerCase(),
        displayName.toLowerCase()
      ],
      cityName,
      code,
      country: /australia/i.test(text) ? "Australia" : /china/i.test(text) ? "China" : "Unknown",
      displayName,
      rawText: text
    };
  }

  if (field === "city") {
    const displayName = firstPiece.replace(/\b[A-Z]{3}\b/g, "").trim() || query;
    const code = codes[0] ?? displayName.slice(0, 3).toUpperCase();

    return {
      aliases: [query.toLowerCase(), displayName.toLowerCase(), code.toLowerCase()],
      code,
      country: /australia/i.test(text) ? "Australia" : /china/i.test(text) ? "China" : "Unknown",
      displayName,
      rawText: text
    };
  }

  return null;
}

const paths = ensureFlyEasyPaths();
const artifactDir = path.join(paths.artifactsDir, "location-sync", nowIso().replace(/[:.]/g, "-"));

await fs.mkdir(artifactDir, { recursive: true });

const context = await chromium.launchPersistentContext(path.join(paths.browserStateDir, "location-sync"), {
  headless,
  viewport: { width: 1440, height: 960 }
});

const page = context.pages()[0] ?? (await context.newPage());

try {
  await page.goto("https://au.trip.com/flights/", {
    timeout: timeoutMs,
    waitUntil: "domcontentloaded"
  });

  const rawAirportSuggestions = [];
  for (const query of seeds.airportQueries) {
    const suggestions = await collectLocationSuggestions(page, "search_city_from0", query);
    rawAirportSuggestions.push({
      query,
      suggestions
    });
  }

  const rawCitySuggestions = [];
  for (const query of seeds.cityQueries) {
    const suggestions = await collectLocationSuggestions(page, "search_city_to0", query);
    rawCitySuggestions.push({
      query,
      suggestions
    });
  }

  const normalizedAirports = uniqueByCode(
    rawAirportSuggestions.flatMap((entry) =>
      entry.suggestions
        .map((suggestion) => normalizeSuggestion(entry.query, "airport", suggestion))
        .filter(Boolean)
    )
  );
  const normalizedCities = uniqueByCode(
    rawCitySuggestions.flatMap((entry) =>
      entry.suggestions
        .map((suggestion) => normalizeSuggestion(entry.query, "city", suggestion))
        .filter(Boolean)
    )
  );

  const output = {
    capturedAt: nowIso(),
    normalizedAirports,
    normalizedCities,
    rawAirportSuggestions,
    rawCitySuggestions,
    source: "https://au.trip.com/flights/"
  };

  const outputPath = path.join(artifactDir, "tripcom-location-sync.json");
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), "utf8");

  console.log(JSON.stringify({ artifactDir, outputPath, airportCount: normalizedAirports.length, cityCount: normalizedCities.length }, null, 2));
} finally {
  await context.close();
}
