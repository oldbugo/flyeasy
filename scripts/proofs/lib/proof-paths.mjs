import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function createRunId(date = new Date()) {
  return date.toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

export function resolveProofPaths(proofName, runId = createRunId()) {
  const rootDir = resolveBaseDataDir();
  const artifactsRootDir = path.join(rootDir, "artifacts");
  const browserStateRootDir = path.join(rootDir, "playwright-state");
  const proofRootDir = path.join(artifactsRootDir, "proofs", proofName);
  const runDir = path.join(proofRootDir, runId);
  const browserStateDir = path.join(browserStateRootDir, proofName);

  for (const dirPath of [rootDir, artifactsRootDir, browserStateRootDir, proofRootDir, runDir, browserStateDir]) {
    ensureDir(dirPath);
  }

  return {
    artifactsRootDir,
    browserStateDir,
    proofRootDir,
    rootDir,
    runDir,
    runId
  };
}

export function directoryHasFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return false;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile()) {
      return true;
    }

    if (entry.isDirectory() && directoryHasFiles(path.join(dirPath, entry.name))) {
      return true;
    }
  }

  return false;
}
