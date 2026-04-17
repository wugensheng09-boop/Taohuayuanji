import "dotenv/config";

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const nodeBin = process.execPath;
const builderCli = path.join(projectRoot, "node_modules", "electron-builder", "cli.js");
const mirror = process.env.ELECTRON_MIRROR ?? "https://npmmirror.com/mirrors/electron/";
const builderMirror =
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR ?? "https://npmmirror.com/mirrors/electron-builder-binaries/";

function runStep(label, scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(nodeBin, [scriptPath, ...args], {
      cwd: projectRoot,
      env: {
        ...process.env,
        ELECTRON_MIRROR: mirror,
        ELECTRON_BUILDER_BINARIES_MIRROR: builderMirror,
      },
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label}-failed:${code ?? "unknown"}`));
    });
  });
}

async function main() {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    throw new Error("missing-npm-execpath");
  }
  await runStep("build", npmCli, ["run", "build"]);
  await runStep("desktop-prepare", npmCli, ["run", "desktop:prepare"]);
  await runStep("electron-builder", builderCli, ["--win", "nsis"]);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
