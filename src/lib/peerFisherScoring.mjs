export function peerFinalBonus(choiceId) {
  if (choiceId === "A") return 10;
  if (choiceId === "B") return 2;
  return -14;
}

function countMatches(text, patterns) {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function clampLeakScore(score) {
  return Math.max(0.05, Math.min(0.9, Number(score.toFixed(2))));
}

const ROUND1_GUARDED = [/没有|没什么|只是|迷路|不提|不便|难以尽述|说不清|不好说|不愿|不敢/];
const ROUND1_INDIRECT = [/确实|见了|光景|蹊跷|不提也罢|难以尽述/];
const ROUND1_WONDER = [/桃花源|世外|仙境|奇境|神仙|异境|稀奇|奇遇|找到了|发现/];
const ROUND1_ROUTE = [/入口|洞口|小口|沿溪|顺流|水路|路径|记号|标记|处处志之|数十步|几百步|夹岸/];

const ROUND4_GUARDED = [/不该|不能|不可|不应|守口|失信|不足为外人道|不便细说|不说|不泄|不愿外人扰|守住/];
const ROUND4_MIXED = [/只说其奇|只谈|不泄其踪|可说|可以说|说见闻|说感受/];
const ROUND4_LEAKY = [/应该|该上报|该报|自当|上报|报官|太守|官府|带人|遣人|让.*知道|公之于众|不可埋没/];

export function classifyPeerFreeReply(message, round) {
  const text = String(message ?? "").trim();
  const compact = text.replace(/\s+/g, "");

  if (!compact) {
    return { choiceId: "B", leakScore: 0.45, rationale: "空回答按中风险处理。" };
  }

  if (round === "round4") {
    const guarded = countMatches(compact, ROUND4_GUARDED);
    const mixed = countMatches(compact, ROUND4_MIXED);
    const leaky = countMatches(compact, ROUND4_LEAKY);

    if (/上报|报官|太守|官府|不可埋没|自当/.test(compact)) {
      return { choiceId: "C", leakScore: 0.9, rationale: "明确倾向上报或扩散，等价高风险分支。" };
    }
    if (leaky > guarded + mixed) {
      return { choiceId: "C", leakScore: 0.9, rationale: "明确倾向上报或扩散，等价高风险分支。" };
    }
    if (mixed > 0) {
      return { choiceId: "B", leakScore: 0.45, rationale: "愿意说见闻但保留路径，等价中风险分支。" };
    }
    if (guarded > 0 && leaky === 0) {
      return { choiceId: "A", leakScore: 0.05, rationale: "强调守口与不泄路径，等价守密分支。" };
    }
    return { choiceId: "B", leakScore: 0.45, rationale: "态度未明确，按谨慎但不彻底的中风险分支。" };
  }

  const route = countMatches(compact, ROUND1_ROUTE);
  const wonder = countMatches(compact, ROUND1_WONDER);
  const guarded = countMatches(compact, ROUND1_GUARDED);
  const indirect = countMatches(compact, ROUND1_INDIRECT);
  const lengthRisk = compact.length > 46 ? 0.12 : compact.length > 26 ? 0.06 : 0;
  const score = clampLeakScore(route * 0.24 + wonder * 0.18 + lengthRisk - guarded * 0.12 + 0.2);

  if (route > 0 || wonder >= 2 || score >= 0.62) {
    return { choiceId: "B", leakScore: Math.max(score, 0.75), rationale: "透露奇境或可复现线索，等价泄密分支。" };
  }
  if (guarded > 0 && indirect === 0 && wonder <= 1 && route === 0) {
    return { choiceId: "A", leakScore: 0.05, rationale: "淡化奇遇且不泄线索，等价守密分支。" };
  }
  return { choiceId: "C", leakScore: Math.max(score, 0.35), rationale: "承认见闻但保留细节，等价含蓄分支。" };
}

export function calculatePeerFinalScore(leakScore, finalChoiceId) {
  return Math.max(0, Math.min(100, 82 - Math.round(leakScore * 32) + peerFinalBonus(finalChoiceId)));
}

export function levelFromPeerScore(score) {
  if (score >= 85) return "甲";
  if (score >= 70) return "乙";
  if (score >= 55) return "丙";
  return "待提升";
}
