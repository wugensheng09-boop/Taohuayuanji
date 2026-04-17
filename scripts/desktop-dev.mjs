import "dotenv/config";

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const nextPort = process.env.NEXT_DEV_PORT?.trim() || "3000";
const nextUrl = `http://127.0.0.1:${nextPort}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${url}/api/health`, { cache: "no-store" });
      if (response.ok) {
        return;
      }
    } catch {
      // keep waiting for Next dev server
    }
    await wait(400);
  }
  throw new Error("next-dev-timeout");
}

function spawnNodeScript(scriptPath, args = [], env = process.env) {
  return spawn(process.execPath, [scriptPath, ...args], {
    cwd: projectRoot,
    env,
    stdio: "inherit"
  });
}

const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const electronCli = path.join(projectRoot, "node_modules", "electron", "cli.js");
const electronMain = path.join(projectRoot, "electron", "main.cjs");

const nextProcess = spawnNodeScript(nextCli, ["dev", "--hostname", "127.0.0.1", "--port", nextPort]);
let electronProcess = null;

function shutdown(code = 0) {
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill();
  }
  if (!nextProcess.killed) {
    nextProcess.kill();
  }
  process.exit(code);
}

nextProcess.on("exit", (code) => {
  if (code !== 0) {
    shutdown(code ?? 1);
  }
});

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

try {
  await waitForHealth(nextUrl);
  electronProcess = spawnNodeScript(electronCli, [electronMain], {
    ...process.env,
    NEXT_DESKTOP_DEV_URL: nextUrl
  });

  electronProcess.on("exit", (code) => {
    shutdown(code ?? 0);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
}
