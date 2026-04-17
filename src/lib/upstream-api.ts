import { readDesktopRuntimeConfig } from "@/lib/runtime-paths";

interface UpstreamRequestOptions {
  path: string;
  body: unknown;
  timeoutMs?: number;
}

function getUpstreamBaseUrl(): string | null {
  const envValue = process.env.UPSTREAM_API_BASE_URL?.trim();
  if (envValue) {
    return envValue.replace(/\/$/, "");
  }

  const configValue = readDesktopRuntimeConfig()?.upstreamApiBaseUrl?.trim();
  if (configValue) {
    return configValue.replace(/\/$/, "");
  }

  return null;
}

function getUpstreamToken(): string | null {
  const envValue = process.env.UPSTREAM_API_TOKEN?.trim();
  if (envValue) {
    return envValue;
  }

  const configValue = readDesktopRuntimeConfig()?.upstreamApiToken?.trim();
  return configValue || null;
}

export function hasUpstreamApiConfig(): boolean {
  return Boolean(getUpstreamBaseUrl());
}

export async function postUpstreamJson<T>(options: UpstreamRequestOptions): Promise<T> {
  const baseUrl = getUpstreamBaseUrl();
  if (!baseUrl) {
    throw new Error("missing-upstream-base-url");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);
  const token = getUpstreamToken();

  try {
    const response = await fetch(`${baseUrl}${options.path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(options.body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`upstream-http-${response.status}: ${errorText}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}
