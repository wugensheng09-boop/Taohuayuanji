import type {
  InterrogationConfig,
  InterrogationEvalResult,
  InterrogationKeywordGroup,
  InterrogationTurnConfig,
} from "@/types/interrogation";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, "").trim();
}

function groupsForLabels(groups: InterrogationKeywordGroup[], labels: string[]): InterrogationKeywordGroup[] {
  const allowed = new Set(labels);
  return groups.filter((group) => allowed.has(group.label));
}

function matchGroups(groups: InterrogationKeywordGroup[], text: string): InterrogationKeywordGroup[] {
  return groups.filter((group) => group.terms.some((term) => term && text.includes(normalizeText(term))));
}

function matchTerms(terms: string[], text: string): string[] {
  return unique(terms.filter((term) => term && text.includes(normalizeText(term))));
}

function buildReply(params: {
  turn: InterrogationTurnConfig;
  credibilityDelta: number;
  leakRiskDelta: number;
  matchedEvidence: string[];
  matchedLeakClues: string[];
  guardedMatches: string[];
  isTooShort: boolean;
}): string {
  const { turn, credibilityDelta, leakRiskDelta, matchedEvidence, matchedLeakClues, guardedMatches, isTooShort } =
    params;

  if (isTooShort) {
    return `${turn.speakerName}盯着你，没有立刻放过这个话头。`;
  }
  if (matchedLeakClues.length > 0 && leakRiskDelta >= 20) {
    return `${turn.speakerName}听见了可复寻的线索，神色明显一紧。`;
  }
  if (guardedMatches.length > 0 && matchedEvidence.length > 0 && credibilityDelta > 0) {
    return `${turn.speakerName}听出你话里有凭据，却暂时抓不到路引。`;
  }
  if (matchedEvidence.length > 0) {
    return `${turn.speakerName}把你的证词记下，仍在等你露出更多细节。`;
  }
  return `${turn.speakerName}皱了皱眉，觉得这话还不够站得住。`;
}

export function evaluateInterrogationAnswer(
  config: InterrogationConfig,
  turn: InterrogationTurnConfig,
  answer: string,
): InterrogationEvalResult {
  const text = normalizeText(answer);
  const isTooShort = Array.from(text).length < config.minAnswerChars;
  const evidenceGroups = matchGroups(groupsForLabels(config.evidencePool, turn.evidenceLabels), text);
  const leakGroups = matchGroups(groupsForLabels(config.leakClues, turn.leakLabels), text);
  const guardedMatches = matchTerms(config.guardedTerms, text);

  const evidenceScore = evidenceGroups.reduce((sum, group) => sum + group.weight, 0);
  const leakScore = leakGroups.reduce((sum, group) => sum + group.weight, 0);
  const guardedScore = guardedMatches.length * 6;
  const lengthPenalty = isTooShort ? 12 : 0;
  const unsupportedPenalty = evidenceGroups.length === 0 && guardedMatches.length === 0 ? 6 : 0;

  const credibilityDelta = clamp(
    evidenceScore + guardedScore - Math.round(leakScore * 0.7) - lengthPenalty - unsupportedPenalty,
    -26,
    28,
  );
  const leakRiskDelta = clamp(leakScore - guardedScore - (evidenceGroups.length > 0 ? 2 : 0), -12, 36);
  const matchedEvidence = evidenceGroups.map((group) => group.label);
  const matchedLeakClues = leakGroups.map((group) => group.label);

  const stageFeedback: string[] = [];
  if (isTooShort) {
    stageFeedback.push("回答太含糊，盘问者会继续追问。");
  }
  if (matchedEvidence.length > 0) {
    stageFeedback.push(`证词站住了：${matchedEvidence.join("、")}。`);
  }
  if (guardedMatches.length > 0) {
    stageFeedback.push("守密表达有效，风险被压低。");
  }
  if (matchedLeakClues.length > 0) {
    stageFeedback.push(`危险线索暴露：${matchedLeakClues.join("、")}。`);
  }
  if (stageFeedback.length === 0) {
    stageFeedback.push("这句话没有泄露路径，但也缺少足够的文本凭据。");
  }

  return {
    reply: buildReply({
      turn,
      credibilityDelta,
      leakRiskDelta,
      matchedEvidence,
      matchedLeakClues,
      guardedMatches,
      isTooShort,
    }),
    credibilityDelta,
    leakRiskDelta,
    matchedEvidence: unique(matchedEvidence),
    matchedLeakClues: unique(matchedLeakClues),
    stageFeedback,
  };
}
