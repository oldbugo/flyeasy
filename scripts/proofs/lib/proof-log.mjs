import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const proofLogPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "docs",
  "planning",
  "foundation",
  "proof-run-log.md"
);

const statusLineMap = {
  "recovery-resume": "- Recovery and resume: ",
  "safe-deep-verification-boundary": "- Safe deep verification boundary: ",
  "session-persistence-and-login-recovery": "- Session persistence and login recovery: ",
  "packaged-search-extraction": "- Packaged search extraction: "
};

function escapeBackticks(value) {
  return String(value).replaceAll("`", "\\`");
}

export function appendProofLogEntry({
  proofKey,
  latestStatus,
  title,
  bullets
}) {
  const prefix = statusLineMap[proofKey];

  if (!prefix) {
    throw new Error(`Unknown proof log key: ${proofKey}`);
  }

  let content = fs.readFileSync(proofLogPath, "utf8");
  const statusPattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\\`[^\\\`]+\\\`$`, "m");
  content = content.replace(statusPattern, `${prefix}\`${latestStatus}\``);

  const entryLines = [
    `### ${escapeBackticks(title)}`,
    "",
    ...bullets.map((bullet) => `- ${escapeBackticks(bullet)}`),
    ""
  ];

  content = `${content.trimEnd()}\n\n${entryLines.join("\n")}`;
  fs.writeFileSync(proofLogPath, `${content}\n`);
}

export function getProofLogPath() {
  return proofLogPath;
}
