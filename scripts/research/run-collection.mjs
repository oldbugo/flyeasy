// One "collection day" through the app worker's browser profile: sentinels,
// then the verification spike (once per period), then grid batches, then
// sentinels again. Pauses between batches let queued app runs (including
// monitoring) use the browser. Stops at the first block.
//
// Usage: node scripts/research/run-collection.mjs --period A [--batches 6] [--pause-min 15] [--batch-size 40] [--resnap]
//   --resnap  re-price the fixed 20% sample (rank-stability check) instead of the grids

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { PERIODS, datePairs, departureDates, returnDates } from "./lib/periods.mjs";

const collectorPath = fileURLToPath(new URL("./collect-fare-grid.mjs", import.meta.url));
const researchRoot = path.resolve(process.env.FLYEASY_RESEARCH_DIR ?? "research/fare-grid");

function readArgs(argv) {
  const args = { batchSize: 40, batches: 6, pauseMin: 15, resnap: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index + 1];
    if (argv[index] === "--period") args.period = value;
    if (argv[index] === "--batches") args.batches = Number(value);
    if (argv[index] === "--pause-min") args.pauseMin = Number(value);
    if (argv[index] === "--batch-size") args.batchSize = Number(value);
    if (argv[index] === "--resnap") args.resnap = true;
  }
  return args;
}

const args = readArgs(process.argv.slice(2));
const period = PERIODS[args.period];
if (!period) {
  console.error("Usage: --period A|B [--batches N] [--pause-min M] [--batch-size N]");
  process.exit(2);
}

function readAttempts(dataset) {
  const file = path.join(researchRoot, args.period, `${dataset}.jsonl`);
  const attempts = new Map();
  if (!fs.existsSync(file)) return attempts;
  for (const line of fs.readFileSync(file, "utf8").split("\n").filter(Boolean)) {
    const record = JSON.parse(line);
    const entry = attempts.get(record.key) ?? { done: false, tries: 0 };
    entry.tries += 1;
    if (record.status === "ok" || record.status === "empty") entry.done = true;
    attempts.set(record.key, entry);
  }
  return attempts;
}

function countDone(dataset) {
  return [...readAttempts(dataset).values()].filter((entry) => entry.done).length;
}

// The collector gives each key two attempts; a key that failed twice is settled.
function countSettled(dataset) {
  return [...readAttempts(dataset).values()].filter((entry) => entry.done || entry.tries >= 2).length;
}

const totals = {
  ow_out: departureDates(period).length,
  ow_ret: returnDates(period).length,
  rt_grid: datePairs(period).length,
  rt_resnap: Math.round(datePairs(period).length * 0.2)
};

function runCollector(dataset, limit) {
  console.log(`\n[day] ${new Date().toLocaleTimeString()} ${dataset} (${limit} loads)`);
  const result = spawnSync(
    process.execPath,
    [collectorPath, "--period", args.period, "--dataset", dataset, "--profile", "app", "--limit", String(limit)],
    { stdio: "inherit" }
  );
  return result.status ?? 1;
}

async function runWithBusyWait(dataset, limit) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = runCollector(dataset, limit);
    if (status !== 4) return status;
    console.log("[day] The app worker is busy with a run; waiting 2 minutes.");
    await new Promise((resolve) => setTimeout(resolve, 120_000));
  }
  return 4;
}

function stopOn(status) {
  if (status === 3) {
    console.error("\n[day] Trip.com blocked collection. Stopped. The app shows the block on its connection status.");
    process.exit(3);
  }
  if (status !== 0) {
    console.error(`\n[day] Collector exited with ${status}. Stopped.`);
    process.exit(status);
  }
}

stopOn(await runWithBusyWait("sentinel", 6));

if (!args.resnap && countDone("verify") === 0) {
  stopOn(await runWithBusyWait("verify", 20));
}

// Round-trip grid first; one-way grids after it.
const queue = args.resnap ? ["rt_resnap"] : ["rt_grid", "ow_out", "ow_ret"];
for (let batch = 0; batch < args.batches; batch += 1) {
  const dataset = queue.find((name) => countSettled(name) < totals[name]);
  if (!dataset) {
    console.log("[day] All grids for this period are complete.");
    break;
  }
  console.log(`[day] batch ${batch + 1}/${args.batches}: ${dataset} ${countDone(dataset)}/${totals[dataset]} done`);
  stopOn(await runWithBusyWait(dataset, args.batchSize));
  if (batch < args.batches - 1) {
    console.log(`[day] Pausing ${args.pauseMin} minutes so app runs can use the browser.`);
    await new Promise((resolve) => setTimeout(resolve, args.pauseMin * 60_000));
  }
}

stopOn(await runWithBusyWait("sentinel", 6));
console.log(
  `\n[day] Done. rt_grid ${countDone("rt_grid")}/${totals.rt_grid}, ow_out ${countDone("ow_out")}/${totals.ow_out}, ow_ret ${countDone("ow_ret")}/${totals.ow_ret}. Rebuild the report with: npm run research:report`
);
