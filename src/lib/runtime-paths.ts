import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface DesktopRuntimeConfig {
  upstreamApiBaseUrl?: string;
  upstreamApiToken?: string;
  upstreamApiModel?: string;
  upstreamApiModelFreeAsk?: string;
  upstreamApiModelRoleplay?: string;
  upstreamApiModelQuiz?: string;
  upstreamApiModelLeak?: string;
}

let cachedDesktopConfig: DesktopRuntimeConfig | null | undefined;

export function readDesktopRuntimeConfig(): DesktopRuntimeConfig | null {
  if (cachedDesktopConfig !== undefined) {
    return cachedDesktopConfig;
  }

  const runtimeRoot = process.env.APP_RUNTIME_DIR?.trim() || process.cwd();
  const configPath = path.join(runtimeRoot, "desktop-config.json");
  if (!existsSync(configPath)) {
    cachedDesktopConfig = null;
    return cachedDesktopConfig;
  }

  try {
    const raw = readFileSync(configPath, "utf8");
    cachedDesktopConfig = JSON.parse(raw) as DesktopRuntimeConfig;
    return cachedDesktopConfig;
  } catch {
    cachedDesktopConfig = null;
    return cachedDesktopConfig;
  }
}
