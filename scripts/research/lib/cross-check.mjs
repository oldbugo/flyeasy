// Cross-checks research screens against the app's own runs (monitoring and
// manual). The app prices a pair by full extraction; research prices it from
// one outbound-list load. Agreement validates the grid; disagreement over
// time measures drift.

function variantFor(appQuery) {
  return appQuery.restrictChinese ? "chinese_airlines" : "any";
}

function quantile(values, q) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : null;
}

function summarize(rows) {
  const diffs = rows.map((row) => Math.abs(row.diffPct));
  return {
    count: rows.length,
    exactShare: rows.length ? rows.filter((row) => row.diffPct === 0).length / rows.length : null,
    medianAbsDiffPct: quantile(diffs, 0.5),
    p90AbsDiffPct: quantile(diffs, 0.9),
    within2Share: rows.length ? rows.filter((row) => Math.abs(row.diffPct) <= 0.02).length / rows.length : null
  };
}

// researchRecords: collector JSONL records (rt_grid, sentinel, verify) with status "ok".
// appQueries: [{ departDate, returnDate, price, startedAt, runMode, sessionName, restrictChinese, requireBaggage }]
export function crossCheckAppRuns(researchRecords, appQueries, { maxHoursApart = 24 } = {}) {
  const byPair = new Map();
  for (const record of researchRecords) {
    if (record.status !== "ok" || !record.screen || !record.returnDate) continue;
    const key = `${record.departDate}_${record.returnDate}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key).push(record);
  }

  const rows = [];
  let skippedBaggage = 0;
  let unmatched = 0;

  for (const query of appQueries) {
    if (!Number.isFinite(query.price)) continue;
    // The grid stores no "Chinese airlines + baggage" variant; skip rather than guess.
    if (query.requireBaggage) {
      skippedBaggage += 1;
      continue;
    }
    const candidates = byPair.get(`${query.departDate}_${query.returnDate}`) ?? [];
    const queryMs = new Date(query.startedAt).getTime();
    const nearest = candidates
      .map((record) => ({ hoursApart: Math.abs(new Date(record.observedAt).getTime() - queryMs) / 3_600_000, record }))
      .sort((left, right) => left.hoursApart - right.hoursApart)[0];
    const gridPrice = nearest?.record.screen.cheapest?.[variantFor(query)] ?? null;

    if (!nearest || gridPrice === null || nearest.hoursApart > maxHoursApart) {
      unmatched += 1;
      continue;
    }

    rows.push({
      appPrice: query.price,
      departDate: query.departDate,
      diffPct: Number((gridPrice / query.price - 1).toFixed(4)),
      gridPrice,
      hoursApart: Number(nearest.hoursApart.toFixed(1)),
      returnDate: query.returnDate,
      runMode: query.runMode,
      sessionName: query.sessionName,
      variant: variantFor(query)
    });
  }

  return {
    byRunMode: Object.fromEntries(
      [...new Set(rows.map((row) => row.runMode))].map((mode) => [mode, summarize(rows.filter((row) => row.runMode === mode))])
    ),
    overall: summarize(rows),
    rows: rows.sort((left, right) => Math.abs(right.diffPct) - Math.abs(left.diffPct)).slice(0, 60),
    skippedBaggage,
    unmatched
  };
}

// Verification spike: outbound-list price vs the price after clicking the
// cheapest outbound through to its return options, in the same page visit.
export function summarizeVerifySpike(verifyRecords, variant = "chinese_airlines") {
  const rows = verifyRecords
    .filter((record) => record.status === "ok" && record.screen && record.verify)
    .map((record) => {
      const screen = record.screen.cheapest.any;
      const verified = record.verify.cheapest.any;
      return {
        departDate: record.departDate,
        diffPct: screen && verified ? Number((verified / screen - 1).toFixed(4)) : null,
        returnDate: record.returnDate,
        screenAny: screen,
        screenVariant: record.screen.cheapest[variant],
        sortedByPrice: record.screenSortedByPrice ?? null,
        verifiedAny: verified,
        verifyMs: record.verifyMs ?? null
      };
    });
  const valid = rows.filter((row) => row.diffPct !== null);
  return {
    attempted: verifyRecords.length,
    exactShare: valid.length ? valid.filter((row) => row.diffPct === 0).length / valid.length : null,
    rows,
    within1Share: valid.length ? valid.filter((row) => Math.abs(row.diffPct) <= 0.01).length / valid.length : null
  };
}
