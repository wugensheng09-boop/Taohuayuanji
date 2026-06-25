import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadEvaluator() {
  const sourcePath = path.resolve("src/lib/interrogation-evaluator.ts");
  assert.equal(existsSync(sourcePath), true, "interrogation evaluator module should exist");

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

  const tempPath = path.join(tmpdir(), `interrogation-evaluator-${Date.now()}-${Math.random()}.mjs`);
  await import("node:fs/promises").then(({ writeFile }) => writeFile(tempPath, compiled, "utf8"));
  return import(pathToFileURL(tempPath).href);
}

const config = {
  lessonId: "taohuayuanji",
  startingCredibility: 50,
  startingLeakRisk: 0,
  minAnswerChars: 8,
  guardedTerms: ["不足为外人道", "不便细说", "不可泄露", "只谈感受", "不说路径", "守口"],
  evidencePool: [
    { label: "桃花林奇景", terms: ["中无杂树", "芳草鲜美", "落英缤纷"], weight: 7 },
    { label: "村中安宁", terms: ["阡陌交通", "鸡犬相闻", "黄发垂髫", "怡然自乐"], weight: 7 },
    { label: "守密嘱托", terms: ["不足为外人道", "不愿外人扰", "守口"], weight: 9 },
  ],
  leakClues: [
    { label: "入口", terms: ["洞口", "小口", "仿佛若有光", "入口"], weight: 16 },
    { label: "水路", terms: ["沿溪", "顺流", "溪水", "水路"], weight: 14 },
    { label: "标记", terms: ["处处志之", "标记", "记号"], weight: 18 },
  ],
  turns: [
    {
      id: "peer_probe",
      speakerId: "peer_fisher",
      prompt: "你到底见了什么？",
      evidenceLabels: ["桃花林奇景", "村中安宁", "守密嘱托"],
      leakLabels: ["入口", "水路", "标记"],
    },
  ],
  endings: [],
};

test("guarded textual answer raises credibility while lowering leak risk", async () => {
  const { evaluateInterrogationAnswer } = await loadEvaluator();
  const result = evaluateInterrogationAnswer(
    config,
    config.turns[0],
    "我只记得那里中无杂树、芳草鲜美，村中人怡然自乐，但临别叮嘱不足为外人道，不便细说路径。",
  );

  assert.ok(result.credibilityDelta > 0);
  assert.ok(result.leakRiskDelta < 0);
  assert.deepEqual(result.matchedEvidence.sort(), ["守密嘱托", "村中安宁", "桃花林奇景"].sort());
  assert.deepEqual(result.matchedLeakClues, []);
});

test("route details sharply increase leak risk and are called out", async () => {
  const { evaluateInterrogationAnswer } = await loadEvaluator();
  const result = evaluateInterrogationAnswer(
    config,
    config.turns[0],
    "我沿溪顺流走到尽头，看见山边小口，仿佛若有光，还在路上处处志之做了标记。",
  );

  assert.ok(result.leakRiskDelta >= 30);
  assert.ok(result.credibilityDelta < 0);
  assert.deepEqual(result.matchedLeakClues.sort(), ["入口", "标记", "水路"].sort());
});

test("vague short answer still advances with a credibility penalty", async () => {
  const { evaluateInterrogationAnswer } = await loadEvaluator();
  const result = evaluateInterrogationAnswer(config, config.turns[0], "不知道，别问。");

  assert.ok(result.credibilityDelta < 0);
  assert.ok(result.leakRiskDelta <= 2);
  assert.ok(result.stageFeedback.some((line) => line.includes("太含糊")));
});
