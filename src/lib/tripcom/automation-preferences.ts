import fs from "node:fs";
import path from "node:path";

import { ensureFlyEasyPaths, resolveFlyEasyPaths } from "@/lib/runtime/app-paths";

export type AutomationPreferences = {
  showAutomationBrowser: boolean;
};

const DEFAULT_AUTOMATION_PREFERENCES: AutomationPreferences = {
  showAutomationBrowser: true
};

function getAutomationPreferencesPath() {
  const paths = ensureFlyEasyPaths(resolveFlyEasyPaths());
  const runtimeDir = path.join(paths.rootDir, "runtime");
  fs.mkdirSync(runtimeDir, { recursive: true });

  return path.join(runtimeDir, "automation-preferences.json");
}

export function readAutomationPreferences(): AutomationPreferences {
  const filePath = getAutomationPreferencesPath();

  if (!fs.existsSync(filePath)) {
    return DEFAULT_AUTOMATION_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<AutomationPreferences>;

    return {
      showAutomationBrowser:
        typeof parsed.showAutomationBrowser === "boolean"
          ? parsed.showAutomationBrowser
          : DEFAULT_AUTOMATION_PREFERENCES.showAutomationBrowser
    };
  } catch {
    return DEFAULT_AUTOMATION_PREFERENCES;
  }
}

export function writeAutomationPreferences(
  overrides: Partial<AutomationPreferences>
): AutomationPreferences {
  const next = {
    ...readAutomationPreferences(),
    ...overrides
  };

  fs.writeFileSync(getAutomationPreferencesPath(), JSON.stringify(next, null, 2), "utf8");

  return next;
}
