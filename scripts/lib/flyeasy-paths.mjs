import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function resolveFlyEasyPaths() {
  if (process.env.FLYEASY_DATA_DIR) {
    const rootDir = path.resolve(process.env.FLYEASY_DATA_DIR);

    return {
      rootDir,
      artifactsDir: path.join(rootDir, "artifacts"),
      browserStateDir: path.join(rootDir, "playwright-state"),
      dbPath: path.join(rootDir, "flyeasy.db")
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
    dbPath: path.join(rootDir, "flyeasy.db")
  };
}

export function ensureFlyEasyPaths(paths = resolveFlyEasyPaths()) {
  for (const dirPath of [paths.rootDir, paths.artifactsDir, paths.browserStateDir]) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  return paths;
}
