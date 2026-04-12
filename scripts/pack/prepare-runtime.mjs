import fs from "node:fs";
import path from "node:path";

const runtimeNodeDir = path.join(process.cwd(), ".desktop-runtime", "node");
const nodeExecutableName = path.basename(process.execPath);
const targetNodePath = path.join(runtimeNodeDir, nodeExecutableName);

fs.mkdirSync(runtimeNodeDir, { recursive: true });
fs.copyFileSync(process.execPath, targetNodePath);

console.log(`Bundled Node runtime prepared at ${targetNodePath}`);
