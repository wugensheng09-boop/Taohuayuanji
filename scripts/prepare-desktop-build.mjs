import "dotenv/config";

import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

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

async function main() {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(runtimeDir, { recursive: true });

  await copyIfExists(standaloneDir, runtimeDir);
  await copyIfExists(staticDir, path.join(runtimeDir, ".next", "static"));
  await copyIfExists(publicDir, path.join(runtimeDir, "public"));
  await copyIfExists(dataDir, path.join(runtimeDir, "data"));

  const cleanupTargets = [
    "dist-desktop",
    "electron",
    "scripts",
    "src",
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
    "release"
  ];

  await Promise.all(
    cleanupTargets.map((target) =>
      rm(path.join(runtimeDir, target), { recursive: true, force: true })
    )
  );

  const config = {
    upstreamApiBaseUrl: process.env.UPSTREAM_API_BASE_URL?.trim() || undefined,
    upstreamApiToken: process.env.UPSTREAM_API_TOKEN?.trim() || undefined
  };

  if (config.upstreamApiBaseUrl || config.upstreamApiToken) {
    await writeFile(path.join(runtimeDir, "desktop-config.json"), JSON.stringify(config, null, 2), "utf8");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
