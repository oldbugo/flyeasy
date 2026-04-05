import os from "node:os";
import path from "node:path";
import fs from "node:fs";

export type FlyEasyPaths = {
  appDataDir: string;
  artifactsDir: string;
  browserStateDir: string;
  dbPath: string;
  rootDir: string;
};

function resolveBaseDataDir() {
  if (process.env.FLYEASY_DATA_DIR) {
    return path.resolve(process.env.FLYEASY_DATA_DIR);
  }

  const home = os.homedir();

  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), "FlyEasy");
  }

  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "FlyEasy");
  }

  return path.join(process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share"), "flyeasy");
}

export function resolveFlyEasyPaths(): FlyEasyPaths {
  const rootDir = resolveBaseDataDir();

  return {
    appDataDir: rootDir,
    artifactsDir: path.join(rootDir, "artifacts"),
    browserStateDir: path.join(rootDir, "playwright-state"),
    dbPath: path.join(rootDir, "flyeasy.db"),
    rootDir
  };
}

export function ensureFlyEasyPaths(paths = resolveFlyEasyPaths()) {
  for (const dirPath of [paths.rootDir, paths.artifactsDir, paths.browserStateDir]) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  return paths;
}
