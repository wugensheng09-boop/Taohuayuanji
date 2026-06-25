import assert from "node:assert/strict";
import test from "node:test";

import { calculatePeerFinalScore, classifyPeerFreeReply, levelFromPeerScore } from "../src/lib/peerFisherScoring.mjs";

test("peer fisher scoring separates guarded and leaky choices", () => {
  const guarded = calculatePeerFinalScore(0.05 + 0.05, "A");
  const mixed = calculatePeerFinalScore(0.35 + 0.45, "B");
  const leaky = calculatePeerFinalScore(0.75 + 0.9, "C");

  assert.equal(guarded, 89);
  assert.equal(mixed, 58);
  assert.equal(leaky, 15);

  assert.equal(levelFromPeerScore(guarded), "甲");
  assert.equal(levelFromPeerScore(mixed), "丙");
  assert.equal(levelFromPeerScore(leaky), "待提升");
});

test("peer fisher score is clamped to a visible 0-100 range", () => {
  assert.equal(calculatePeerFinalScore(-10, "A"), 100);
  assert.equal(calculatePeerFinalScore(10, "C"), 0);
});

test("peer fisher free input maps guarded, indirect, and leaky first-round replies", () => {
  const guarded = classifyPeerFreeReply("没什么稀奇，只是顺着溪水走迷了路，不便多说。", "round1");
  const indirect = classifyPeerFreeReply("确实见了些从没见过的光景，只是说来蹊跷。", "round1");
  const leaky = classifyPeerFreeReply("我找到了世外桃源，入口就在溪水尽头的小口。", "round1");

  assert.equal(guarded.choiceId, "A");
  assert.equal(indirect.choiceId, "C");
  assert.equal(leaky.choiceId, "B");
  assert.ok(guarded.leakScore < indirect.leakScore);
  assert.ok(leaky.leakScore > indirect.leakScore);
});

test("peer fisher final free input maps to guarded, mixed, and report branches", () => {
  const guarded = classifyPeerFreeReply("不该。他们托我守口，我不能失信，也不说路径。", "round4");
  const mixed = classifyPeerFreeReply("只说其奇，不泄其踪，可以谈感受但不交出路。", "round4");
  const leaky = classifyPeerFreeReply("该上报太守，如此异事不可埋没。", "round4");

  assert.equal(guarded.choiceId, "A");
  assert.equal(mixed.choiceId, "B");
  assert.equal(leaky.choiceId, "C");
});
