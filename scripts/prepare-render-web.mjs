import { access, cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const standaloneDir = path.join(projectRoot, ".next", "standalone");
const staticDir = path.join(projectRoot, ".next", "static");
const publicDir = path.join(projectRoot, "public");
const dataDir = path.join(projectRoot, "data");

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(source, destination) {
  if (!(await pathExists(source))) {
    return;
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
}

async function removeIfExists(target) {
  await rm(target, { recursive: true, force: true });
}

async function removeRootMatches(patterns) {
  const entries = await readdir(standaloneDir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => patterns.some((pattern) => pattern.test(entry.name)))
      .map((entry) => removeIfExists(path.join(standaloneDir, entry.name))),
  );
}

async function main() {
  if (!(await pathExists(path.join(standaloneDir, "server.js")))) {
    throw new Error("Missing .next/standalone/server.js. Run next build before preparing Render output.");
  }

  await copyIfExists(staticDir, path.join(standaloneDir, ".next", "static"));
  await copyIfExists(publicDir, path.join(standaloneDir, "public"));
  await copyIfExists(dataDir, path.join(standaloneDir, "data"));

  await removeRootMatches([
    /^\.env(?:\..*)?$/,
    /^\.tmp/i,
    /^tmp-/i,
    /^desktop-release/i,
    /^dist-desktop$/i,
    /^release$/i,
    /^taohuayuan-mvp$/i,
    /^electron$/i,
    /^scripts$/i,
    /^test-results$/i,
    /^output$/i,
    /^\.superpowers$/i,
    /^\.vs$/i,
    /\.log$/i,
  ]);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
