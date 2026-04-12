import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function resolveFlyEasyAppRoot() {
  return path.resolve(process.env.FLYEASY_APP_ROOT ?? process.cwd());
}

export function resolveBetterSqliteBindingPath() {
  return path.join(
    resolveFlyEasyAppRoot(),
    "node_modules",
    "better-sqlite3",
    "build",
    "Release",
    "better_sqlite3.node"
  );
}

export function resolveFlyEasyPaths() {
  if (process.env.FLYEASY_DATA_DIR) {
    const rootDir = path.resolve(process.env.FLYEASY_DATA_DIR);

    return {
      rootDir,
      artifactsDir: path.join(rootDir, "artifacts"),
      browserStateDir: path.join(rootDir, "playwright-state"),
      dbPath: path.join(rootDir, "flyeasy.db"),
      playwrightBrowsersDir: path.join(rootDir, "playwright-browsers")
    };
  }

  const home = os.homedir();
  let rootDir;

  if (process.platform === "win32") {
    rootDir = path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), "FlyEasy");
  } else if (process.platform === "darwin") {
    rootDir = path.join(home, "Library", "Application Support", "FlyEasy");
  } else {
    rootDir = path.join(
      process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share"),
      "flyeasy"
    );
  }

  return {
    rootDir,
    artifactsDir: path.join(rootDir, "artifacts"),
    browserStateDir: path.join(rootDir, "playwright-state"),
    dbPath: path.join(rootDir, "flyeasy.db"),
    playwrightBrowsersDir: path.join(rootDir, "playwright-browsers")
  };
}

export function ensureFlyEasyPaths(paths = resolveFlyEasyPaths()) {
  for (const dirPath of [
    paths.rootDir,
    paths.artifactsDir,
    paths.browserStateDir,
    paths.playwrightBrowsersDir
  ]) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  return paths;
}
