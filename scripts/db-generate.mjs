import fs from "node:fs";
import path from "node:path";

import { ensureFlyEasyPaths, resolveFlyEasyAppRoot } from "./lib/flyeasy-paths.mjs";

const root = resolveFlyEasyAppRoot();
const drizzleDir = path.join(root, "drizzle");
const migrationPath = path.join(drizzleDir, "0000_bootstrap.sql");
const initialMigrationPath = path.join(drizzleDir, "0001_initial.sql");

fs.mkdirSync(drizzleDir, { recursive: true });
ensureFlyEasyPaths();

if (!fs.existsSync(migrationPath)) {
  fs.writeFileSync(
    migrationPath,
    [
      "-- FlyEasy bootstrap migration",
      "-- Replace this file with generated SQL once the schema is implemented.",
      ""
    ].join("\n"),
    "utf8"
  );
}

if (!fs.existsSync(initialMigrationPath)) {
  throw new Error(
    `Expected the initial migration at ${initialMigrationPath}. Recreate it from the schema docs before continuing.`
  );
}

console.log(`Migration workspace ready at ${initialMigrationPath}`);
