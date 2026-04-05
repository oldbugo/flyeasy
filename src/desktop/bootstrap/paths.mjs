import fs from "node:fs";
import path from "node:path";

export function resolveDesktopPaths(app) {
  const rootDir = process.env.FLYEASY_DATA_DIR
    ? path.resolve(process.env.FLYEASY_DATA_DIR)
    : path.join(app.getPath("appData"), "FlyEasy");

  return {
    rootDir,
    artifactsDir: path.join(rootDir, "artifacts"),
    browserStateDir: path.join(rootDir, "playwright-state"),
    dbPath: path.join(rootDir, "flyeasy.db")
  };
}

export function ensureDesktopPaths(app) {
  const paths = resolveDesktopPaths(app);

  for (const dirPath of [paths.rootDir, paths.artifactsDir, paths.browserStateDir]) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  return paths;
}
