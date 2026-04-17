import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface DesktopRuntimeConfig {
  upstreamApiBaseUrl?: string;
  upstreamApiToken?: string;
}

let cachedDesktopConfig: DesktopRuntimeConfig | null | undefined;

export function getRuntimeRoot(): string {
  const runtimeRoot = process.env.APP_RUNTIME_DIR?.trim();
  if (runtimeRoot) {
    return runtimeRoot;
  }
  return process.cwd();
}

export function resolveRuntimePath(...segments: string[]): string {
  return path.join(getRuntimeRoot(), ...segments);
}

export function readDesktopRuntimeConfig(): DesktopRuntimeConfig | null {
  if (cachedDesktopConfig !== undefined) {
    return cachedDesktopConfig;
  }

  const configPath = resolveRuntimePath("desktop-config.json");
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
