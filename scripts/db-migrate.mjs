import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { ensureFlyEasyPaths } from "./lib/flyeasy-paths.mjs";

const root = path.resolve("D:/flyeasy");
const drizzleDir = path.join(root, "drizzle");
const dbPath = ensureFlyEasyPaths().dbPath;

fs.mkdirSync(drizzleDir, { recursive: true });

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS __flyeasy_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL
  );
`);

const migrationFiles = fs
  .readdirSync(drizzleDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

const appliedNames = new Set(
  db
    .prepare("SELECT name FROM __flyeasy_migrations")
    .all()
    .map((row) => row.name)
);

let appliedCount = 0;

for (const fileName of migrationFiles) {
  if (appliedNames.has(fileName)) {
    continue;
  }

  const sql = fs.readFileSync(path.join(drizzleDir, fileName), "utf8").trim();

  if (sql.length > 0) {
    db.exec(sql);
  }

  db.prepare(
    "INSERT INTO __flyeasy_migrations (name, applied_at) VALUES (?, ?)"
  ).run(fileName, new Date().toISOString());
  appliedCount += 1;
}

db.close();

console.log(`Applied ${appliedCount} new migration file(s) against ${dbPath}`);
