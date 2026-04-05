import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { ensureFlyEasyPaths, resolveFlyEasyPaths } from "@/lib/runtime/app-paths";

import * as schema from "./schema";

type FlyEasyDb = BetterSQLite3Database<typeof schema>;

let cachedDb: FlyEasyDb | undefined;
let cachedConnection: Database.Database | undefined;
let migrationsApplied = false;

function resolveMigrationDir() {
  return path.join(path.resolve(process.cwd()), "drizzle");
}

function applyPendingMigrations(connection: Database.Database) {
  if (migrationsApplied) {
    return;
  }

  const migrationDir = resolveMigrationDir();
  fs.mkdirSync(migrationDir, { recursive: true });

  connection.exec(`
    CREATE TABLE IF NOT EXISTS __flyeasy_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const migrationFiles = fs
    .readdirSync(migrationDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const appliedNames = new Set(
    (
      connection.prepare("SELECT name FROM __flyeasy_migrations").all() as {
        name: string;
      }[]
    ).map((row) => row.name)
  );

  for (const migrationName of migrationFiles) {
    if (appliedNames.has(migrationName)) {
      continue;
    }

    const migrationSql = fs
      .readFileSync(path.join(migrationDir, migrationName), "utf8")
      .trim();

    if (migrationSql.length > 0) {
      connection.exec(migrationSql);
    }

    connection
      .prepare("INSERT INTO __flyeasy_migrations (name, applied_at) VALUES (?, ?)")
      .run(migrationName, new Date().toISOString());
  }

  migrationsApplied = true;
}

export function getSqliteConnection() {
  if (cachedConnection) {
    return cachedConnection;
  }

  const paths = ensureFlyEasyPaths(resolveFlyEasyPaths());
  const connection = new Database(paths.dbPath);

  connection.pragma("journal_mode = WAL");
  connection.pragma("foreign_keys = ON");

  applyPendingMigrations(connection);

  cachedConnection = connection;

  return connection;
}

export function getDb() {
  if (cachedDb) {
    return cachedDb;
  }

  cachedDb = drizzle(getSqliteConnection(), { schema });

  return cachedDb;
}

export type { FlyEasyDb };
