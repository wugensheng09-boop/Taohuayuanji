import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadRokidDevice() {
  const sourcePath = path.resolve("src/lib/rokid-device.ts");
  assert.equal(existsSync(sourcePath), true, "rokid device module should exist");

  const source = readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      isolatedModules: true,
    },
    fileName: sourcePath,
  }).outputText;

  const tempPath = path.join(tmpdir(), `rokid-device-${Date.now()}-${Math.random()}.mjs`);
  await import("node:fs/promises").then(({ writeFile }) => writeFile(tempPath, compiled, "utf8"));
  return import(pathToFileURL(tempPath).href);
}

test("device=rokid enables the Rokid runtime mode", async () => {
  const { getRokidRuntimeMode } = await loadRokidDevice();

  assert.equal(getRokidRuntimeMode({ device: "rokid" }), "rokid");
  assert.equal(getRokidRuntimeMode({ device: ["web", "rokid"] }), "rokid");
});

test("unknown or missing device keeps the default web runtime", async () => {
  const { getRokidRuntimeMode } = await loadRokidDevice();

  assert.equal(getRokidRuntimeMode({}), "web");
  assert.equal(getRokidRuntimeMode({ device: "desktop" }), "web");
  assert.equal(getRokidRuntimeMode({ device: ["mobile"] }), "web");
});

test("buildRokidLaunchUrl normalizes the WebView launch URL", async () => {
  const { buildRokidLaunchUrl } = await loadRokidDevice();

  assert.equal(
    buildRokidLaunchUrl("https://example.com/learn/taohuayuanji?resume=1"),
    "https://example.com/learn/taohuayuanji?resume=1&device=rokid&autostart=1",
  );
  assert.equal(
    buildRokidLaunchUrl("https://example.com/learn/taohuayuanji?device=web&autostart=0"),
    "https://example.com/learn/taohuayuanji?device=rokid&autostart=1",
  );
});
