import dotenv from "dotenv";

import { cp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

dotenv.config({ path: path.join(process.cwd(), ".env.local"), override: false });
dotenv.config();

const projectRoot = process.cwd();
const standaloneDir = path.join(projectRoot, ".next", "standalone");
const staticDir = path.join(projectRoot, ".next", "static");
const publicDir = path.join(projectRoot, "public");
const dataDir = path.join(projectRoot, "data");
const outputRoot = path.join(projectRoot, "dist-desktop");
const runtimeDir = path.join(outputRoot, "app-runtime");

async function copyIfExists(source, destination) {
  await cp(source, destination, { recursive: true, force: true });
}

function isLocalUpstreamUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function assertReleaseUpstreamConfig(config) {
  if (!config.upstreamApiBaseUrl) {
    throw new Error(
      "UPSTREAM_API_BASE_URL is required for desktop release builds. Set it to the deployed upstream-server URL.",
    );
  }

  if (isLocalUpstreamUrl(config.upstreamApiBaseUrl) && process.env.ALLOW_LOCAL_UPSTREAM_FOR_DESKTOP !== "1") {
    throw new Error(
      [
        "UPSTREAM_API_BASE_URL points to localhost, so installed desktop apps will fall back when port 8787 is not running.",
        "Deploy upstream-server first and set UPSTREAM_API_BASE_URL to its https://... URL.",
        "For a local smoke build only, set ALLOW_LOCAL_UPSTREAM_FOR_DESKTOP=1.",
      ].join("\n"),
    );
  }
}

async function main() {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(runtimeDir, { recursive: true });

  await copyIfExists(standaloneDir, runtimeDir);
  await rename(path.join(runtimeDir, "node_modules"), path.join(runtimeDir, "runtime-deps"));
  await copyIfExists(staticDir, path.join(runtimeDir, ".next", "static"));
  await copyIfExists(publicDir, path.join(runtimeDir, "public"));
  await copyIfExists(dataDir, path.join(runtimeDir, "data"));

  const cleanupTargets = [
    "dist-desktop",
    "electron",
    "scripts",
    "src",
    "taohuayuan-mvp",
    "progress.md",
    "README.md",
    "eslint.config.mjs",
    "next.config.ts",
    "postcss.config.mjs",
    "tsconfig.json",
    "tsconfig.tsbuildinfo",
    "package-lock.json",
    "cloudflared-temp.err.log",
    "cloudflared-temp.out.log",
    "cloudflared.log",
    "out.log",
    "release",
    "desktop-release",
    "desktop-release-v2",
    "desktop-release-v3",
    "desktop-release-v4",
    "desktop-release-v5",
    "desktop-release-v6",
    "desktop-release-v7",
    "desktop-release-v8",
    "upstream-server",
    "render.yaml",
    ".env",
    ".env.local",
    ".env.example",
    "tmp-aqiao-err.log",
    "tmp-aqiao-out.log",
    "tmp-aqiao-response.json",
    "tmp-fail-err.log",
    "tmp-fail-out.log",
    "tmp-local-err.log",
    "tmp-local-out.log",
    "tmp-runtime-err.log",
    "tmp-runtime-out.log",
  ];

  await Promise.all(
    cleanupTargets.map((target) =>
      rm(path.join(runtimeDir, target), { recursive: true, force: true }),
    ),
  );

  const config = {
    upstreamApiBaseUrl: process.env.UPSTREAM_API_BASE_URL?.trim() || undefined,
    upstreamApiToken: process.env.UPSTREAM_API_TOKEN?.trim() || undefined,
    upstreamApiModel: process.env.UPSTREAM_API_MODEL?.trim() || undefined,
    upstreamApiModelFreeAsk: process.env.UPSTREAM_API_MODEL_FREE_ASK?.trim() || undefined,
    upstreamApiModelRoleplay: process.env.UPSTREAM_API_MODEL_ROLEPLAY?.trim() || undefined,
    upstreamApiModelQuiz: process.env.UPSTREAM_API_MODEL_QUIZ?.trim() || undefined,
    upstreamApiModelLeak: process.env.UPSTREAM_API_MODEL_LEAK?.trim() || undefined,
  };

  assertReleaseUpstreamConfig(config);

  if (config.upstreamApiBaseUrl || config.upstreamApiToken) {
    await writeFile(path.join(runtimeDir, "desktop-config.json"), JSON.stringify(config, null, 2), "utf8");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
