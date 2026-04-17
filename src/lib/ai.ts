import { buildChatSystemPrompt, buildChatUserPrompt } from "@/lib/prompts";
import { hasUpstreamApiConfig, postUpstreamJson } from "@/lib/upstream-api";
import type { ChatRequestPayload } from "@/lib/validators";
import type { KnowledgeBase, LessonMeta } from "@/types/lesson";
import type { NpcConfig } from "@/types/npc";
import type { SceneConfig } from "@/types/scene";
import type { ChatMessage, SessionState } from "@/types/session";

export interface QuizRubricResult {
  textualGrounding: number;
  understanding: number;
  expression: number;
  score: number;
  matchedPoints: string[];
  missedPoints: string[];
}

export interface ChatGenerationResult {
  reply: string;
  suggestedActions: string[];
  knowledgeTags: string[];
  source: "model" | "mock";
  shouldAdvance: boolean;
  nextPrompt?: string;
  roleSafetyFlags?: string[];
  leakRiskLevel?: "low" | "mid" | "high";
  leakRiskScore?: number;
  quizRubricResult?: QuizRubricResult;
  stageFeedback?: string[];
  dimensionNotes?: string[];
}

interface GenerateParams {
  message: string;
  lesson: LessonMeta;
  scene: SceneConfig;
  npc: NpcConfig;
  knowledge: KnowledgeBase;
  session: SessionState;
  payload: ChatRequestPayload;
}

type AiMode = "auto" | "mock" | "live";

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function clampRisk(score: number): number {
  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

function getAiMode(): AiMode {
  const raw = (process.env.AI_MODE ?? "auto").toLowerCase();
  if (raw === "mock" || raw === "live" || raw === "auto") {
    return raw;
  }
  return "auto";
}

function guessTags(message: string): string[] {
  const tags: string[] = [];
  if (/桃花|落英|景物|鲜美|中无杂树|芳草/.test(message)) {
    tags.push("imagery");
  }
  if (/主旨|理想|社会|避世|现实|主题/.test(message)) {
    tags.push("theme");
  }
  if (/结尾|再寻|不复得路|遂迷/.test(message)) {
    tags.push("endingMeaning");
  }
  if (/翻译|注释|词义|文言/.test(message)) {
    tags.push("vocabulary");
  }
  if (/结构|层次|叙事|开端|结尾/.test(message)) {
    tags.push("structure");
  }
  return [...new Set(tags)];
}

function evaluateLeakRisk(payload: ChatRequestPayload, message: string): {
  leakRiskScore: number;
  leakRiskLevel: "low" | "mid" | "high";
  stageFeedback: string[];
} {
  const text = message.trim();
  const sensitive = payload.sensitiveKeywords ?? [];
  const route = payload.routeKeywords ?? [];
  const reproducible = payload.reproducibleClueKeywords ?? [];
  const threshold = payload.highRiskThreshold ?? 0.62;

  const hitSensitive = sensitive.filter((item) => text.includes(item)).length;
  const hitRoute = route.filter((item) => text.includes(item)).length;
  const hitReproducible = reproducible.filter((item) => text.includes(item)).length;

  const lengthFactor = Math.min(1, text.length / 110);
  const weighted =
    hitSensitive * 0.12 +
    hitRoute * 0.2 +
    hitReproducible * 0.24 +
    (/(入口|洞口|沿溪|方位|标记|记号|路径|几步|数十步)/.test(text) ? 0.26 : 0) +
    lengthFactor * 0.18;
  const leakRiskScore = clampRisk(weighted);
  const leakRiskLevel: "low" | "mid" | "high" =
    leakRiskScore >= threshold ? "high" : leakRiskScore >= threshold * 0.7 ? "mid" : "low";

  const stageFeedback =
    leakRiskLevel === "high"
      ? ["你说得太具体了，旁人很容易据此复现路线。", "可以改成只谈感受，不交代可定位的细节。"]
      : leakRiskLevel === "mid"
        ? ["这段回答里带了一些线索，再收一收会更稳。", "保留体验和感受即可，尽量避开方位与路径信息。"]
        : ["分寸把握得不错，你守住了关键秘密。", "继续保持“说感受、不说路径”的表达方式。"];

  return { leakRiskScore, leakRiskLevel, stageFeedback };
}

function evaluateQuiz(payload: ChatRequestPayload, message: string): QuizRubricResult {
  const text = message.trim();
  const referencePoints = payload.referencePoints ?? [];
  const matchedPoints = referencePoints.filter((point) => text.includes(point));
  const missedPoints = referencePoints.filter((point) => !text.includes(point));

  if (payload.questionType === "choice") {
    const correct = payload.correctOptions ?? [];
    const isCorrect = correct.some((item) => item.trim() === text.trim());
    const textualGrounding = isCorrect ? 88 : 40;
    const understanding = isCorrect ? 90 : 35;
    const expression = isCorrect ? 84 : 65;
    const score = isCorrect ? 88 : 46;
    return {
      textualGrounding,
      understanding,
      expression,
      score,
      matchedPoints: isCorrect ? [...new Set([...matchedPoints, ...correct])] : matchedPoints,
      missedPoints,
    };
  }

  const referenceRatio = referencePoints.length > 0 ? matchedPoints.length / referencePoints.length : 0.45;
  const textualGrounding = clampScore(48 + referenceRatio * 45);
  const understanding = clampScore(44 + referenceRatio * 42 + (/(因为|所以|因此|说明|体现|反映)/.test(text) ? 8 : 0));
  const expression = clampScore(58 + Math.min(20, text.length / 5));
  const score = clampScore(textualGrounding * 0.35 + understanding * 0.4 + expression * 0.25);

  return {
    textualGrounding,
    understanding,
    expression,
    score,
    matchedPoints,
    missedPoints,
  };
}

function normalizeResult(input: Partial<ChatGenerationResult>): ChatGenerationResult {
  const rawRubric = input.quizRubricResult;
  const rubric = rawRubric
    ? {
        textualGrounding: clampScore(rawRubric.textualGrounding),
        understanding: clampScore(rawRubric.understanding),
        expression: clampScore(rawRubric.expression),
        score: clampScore(rawRubric.score),
        matchedPoints: (rawRubric.matchedPoints ?? []).slice(0, 6),
        missedPoints: (rawRubric.missedPoints ?? []).slice(0, 6),
      }
    : undefined;

  return {
    reply: (input.reply ?? "我记下你的话了，我们继续往前走。").slice(0, 220),
    suggestedActions: (input.suggestedActions ?? []).slice(0, 4),
    knowledgeTags: (input.knowledgeTags ?? []).slice(0, 6),
    source: input.source ?? "mock",
    shouldAdvance: input.shouldAdvance ?? true,
    nextPrompt: input.nextPrompt?.slice(0, 180),
    roleSafetyFlags: (input.roleSafetyFlags ?? []).slice(0, 4),
    leakRiskLevel: input.leakRiskLevel,
    leakRiskScore:
      typeof input.leakRiskScore === "number" && Number.isFinite(input.leakRiskScore)
        ? clampRisk(input.leakRiskScore)
        : undefined,
    quizRubricResult: rubric,
    stageFeedback: (input.stageFeedback ?? []).slice(0, 4),
    dimensionNotes: (input.dimensionNotes ?? []).slice(0, 4),
  };
}

function extractTextFromChatCompletionsPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const data = payload as Record<string, unknown>;
  const choices = data.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return "";
  }
  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object") {
    return "";
  }
  const message = (firstChoice as Record<string, unknown>).message;
  if (!message || typeof message !== "object") {
    return "";
  }
  const content = (message as Record<string, unknown>).content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const item of content) {
      if (typeof item === "string") {
        parts.push(item);
        continue;
      }
      if (!item || typeof item !== "object") {
        continue;
      }
      const text = (item as Record<string, unknown>).text;
      if (typeof text === "string" && text.trim()) {
        parts.push(text.trim());
      }
    }
    return parts.join("\n").trim();
  }
  return "";
}

function parseModelJson(text: string): Partial<ChatGenerationResult> | null {
  const cleaned = text.trim().replace(/^```json/, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as Partial<ChatGenerationResult>;
    if (typeof parsed.reply === "string") {
      return parsed;
    }
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Partial<ChatGenerationResult>;
        if (typeof parsed.reply === "string") {
          return parsed;
        }
      } catch {
        return null;
      }
    }
    return null;
  }
  return null;
}

function buildMockReply(params: GenerateParams, reason?: string): ChatGenerationResult {
  const tags = guessTags(params.message);
  const mode = params.payload.mode;
  const suffix = reason ? `（当前为本地降级回复：${reason}）` : "";

  if (mode === "leak_eval") {
    const leak = evaluateLeakRisk(params.payload, params.message);
    return normalizeResult({
      reply: `同乡听后若有所思。${leak.leakRiskLevel === "high" ? "你这话说得太细了。" : "你这话分寸尚可。"}${suffix}`,
      knowledgeTags: tags.length > 0 ? tags : ["theme"],
      source: "mock",
      leakRiskLevel: leak.leakRiskLevel,
      leakRiskScore: leak.leakRiskScore,
      stageFeedback: leak.stageFeedback,
      roleSafetyFlags: [],
    });
  }

  if (mode === "quiz_eval") {
    const rubric = evaluateQuiz(params.payload, params.message);
    const hints = params.payload.stageFeedbackHints ?? [];
    const stageFeedback =
      rubric.score >= 85
        ? ["回答很稳，文本依据也抓得准。", hints[0] ? `继续保持：${hints[0]}` : "继续保持这个节奏。"]
        : rubric.score >= 70
          ? ["思路不错，再补一处原文证据会更完整。", hints[1] ? `可以再优化：${hints[1]}` : "表达还能再凝练一点。"]
          : ["你已经有方向了，但证据还不够。", "试着引用一处关键词，再补一句作用说明。"];
    return normalizeResult({
      reply: `${params.npc.name}点点头：我听明白了。${suffix}`.trim(),
      knowledgeTags: tags.length > 0 ? tags : ["structure"],
      source: "mock",
      quizRubricResult: rubric,
      stageFeedback,
      dimensionNotes: [
        `文本依据：${rubric.textualGrounding}`,
        `理解深度：${rubric.understanding}`,
        `表达完整：${rubric.expression}`,
      ],
      roleSafetyFlags: [],
    });
  }

  return normalizeResult({
    reply: `${params.npc.name}回应道：你的话我记下了，我们继续沿着故事往前走。${suffix}`.trim(),
    suggestedActions: ["继续对话", "结合课文细节再说一层"],
    knowledgeTags: tags.length > 0 ? tags : ["imagery"],
    source: "mock",
    roleSafetyFlags: [],
  });
}

function resolveModelForMode(mode: ChatRequestPayload["mode"]): string {
  const common = process.env.UPSTREAM_API_MODEL ?? "default";
  if (mode === "roleplay_chat") {
    return process.env.UPSTREAM_API_MODEL_ROLEPLAY ?? common;
  }
  if (mode === "quiz_eval") {
    return process.env.UPSTREAM_API_MODEL_QUIZ ?? common;
  }
  if (mode === "leak_eval") {
    return process.env.UPSTREAM_API_MODEL_LEAK ?? common;
  }
  return process.env.UPSTREAM_API_MODEL_FREE_ASK ?? common;
}

async function requestUpstreamChat(params: {
  requestMode: ChatRequestPayload["mode"];
  systemPrompt: string;
  userPrompt: string;
  chatHistory: ChatMessage[];
  source: GenerateParams;
}): Promise<unknown> {
  const historyMessages = params.chatHistory.slice(-6).map((msg) => ({
    role: msg.role,
    npcId: msg.npcId,
    content: typeof msg.content === "string" && msg.content.trim() !== "" ? msg.content : "...",
    createdAt: msg.createdAt,
  }));

  return postUpstreamJson({
    path: "/chat",
    body: {
      mode: params.requestMode,
      model: resolveModelForMode(params.requestMode),
      message: params.source.message,
      systemPrompt: params.systemPrompt,
      userPrompt: params.userPrompt,
      session: {
        sessionId: params.source.session.sessionId,
        lessonId: params.source.session.lessonId,
        currentSceneId: params.source.session.currentSceneId,
        visitedScenes: params.source.session.visitedScenes,
        completedTasks: params.source.session.completedTasks,
        knowledgeProgress: params.source.session.knowledgeProgress,
      },
      chatHistory: historyMessages,
      context: {
        lesson: params.source.lesson,
        scene: params.source.scene,
        npc: params.source.npc,
        payload: params.source.payload,
      },
    },
    timeoutMs: 20000,
  });
}

export async function generateNpcReply(params: GenerateParams): Promise<ChatGenerationResult> {
  const mode = getAiMode();
  const localLeak = params.payload.mode === "leak_eval" ? evaluateLeakRisk(params.payload, params.message) : null;
  const localQuiz = params.payload.mode === "quiz_eval" ? evaluateQuiz(params.payload, params.message) : null;

  if (mode === "mock") {
    return buildMockReply(params, "mock-mode");
  }

  if (!hasUpstreamApiConfig()) {
    if (mode === "live") {
      return normalizeResult({
        reply: "线上 AI 服务未配置，已切回安全回复，请检查桌面端上游配置。",
        suggestedActions: ["检查 UPSTREAM_API_BASE_URL", "稍后重试"],
        knowledgeTags: guessTags(params.message),
        source: "mock",
        roleSafetyFlags: ["missing-upstream-config"],
        leakRiskLevel: localLeak?.leakRiskLevel,
        leakRiskScore: localLeak?.leakRiskScore,
        quizRubricResult: localQuiz ?? undefined,
        stageFeedback: localLeak?.stageFeedback,
      });
    }
    return buildMockReply(params, "missing-upstream-config");
  }

  const systemPrompt = buildChatSystemPrompt({
    npc: params.npc,
    scene: params.scene,
    session: params.session,
    knowledge: params.knowledge,
    mode: params.payload.mode,
    payload: params.payload,
  });
  const userPrompt = buildChatUserPrompt({
    message: params.message,
    mode: params.payload.mode,
    payload: params.payload,
  });

  try {
    const payload = await requestUpstreamChat({
      requestMode: params.payload.mode,
      systemPrompt,
      userPrompt,
      chatHistory: params.session.chatHistory,
      source: params,
    });

    const directPayload =
      payload && typeof payload === "object" && typeof (payload as Partial<ChatGenerationResult>).reply === "string"
        ? (payload as Partial<ChatGenerationResult>)
        : null;
    const text = extractTextFromChatCompletionsPayload(payload);
    const parsed = parseModelJson(text);
    const parsedOrPlain =
      directPayload ??
      parsed ??
      (text
        ? ({
            reply: text.slice(0, 220),
            suggestedActions: [],
            knowledgeTags: guessTags(params.message),
            roleSafetyFlags: ["non_json_response"],
          } as Partial<ChatGenerationResult>)
        : null);

    if (!parsedOrPlain) {
      throw new Error("upstream-empty-response");
    }

    const merged: Partial<ChatGenerationResult> = {
      ...parsedOrPlain,
      source: "model",
      knowledgeTags: parsedOrPlain.knowledgeTags ?? guessTags(params.message),
      roleSafetyFlags: parsedOrPlain.roleSafetyFlags ?? [],
    };

    if (params.payload.mode === "leak_eval" && localLeak) {
      merged.leakRiskLevel = localLeak.leakRiskLevel;
      merged.leakRiskScore = localLeak.leakRiskScore;
      merged.stageFeedback = parsedOrPlain.stageFeedback?.length ? parsedOrPlain.stageFeedback : localLeak.stageFeedback;
    }

    if (params.payload.mode === "quiz_eval" && localQuiz) {
      merged.quizRubricResult = {
        textualGrounding: localQuiz.textualGrounding,
        understanding: localQuiz.understanding,
        expression: localQuiz.expression,
        score: localQuiz.score,
        matchedPoints: localQuiz.matchedPoints,
        missedPoints: localQuiz.missedPoints,
      };
      merged.stageFeedback =
        parsedOrPlain.stageFeedback?.length
          ? parsedOrPlain.stageFeedback
          : localQuiz.score >= 80
            ? ["回答很扎实，继续保持。"]
            : ["方向对了，再补一句文本依据会更稳。"];
      merged.dimensionNotes = parsedOrPlain.dimensionNotes ?? [];
    }

    return normalizeResult(merged);
  } catch (error) {
    if (mode === "live") {
      const reason = error instanceof Error ? error.message : "request-failed";
      return normalizeResult({
        reply: `线上 AI 服务调用失败（${reason}），已切回安全回复，请稍后重试。`,
        suggestedActions: ["检查上游接口是否可用", "稍后重试"],
        knowledgeTags: guessTags(params.message),
        source: "mock",
        roleSafetyFlags: ["provider-fallback"],
        leakRiskLevel: localLeak?.leakRiskLevel,
        leakRiskScore: localLeak?.leakRiskScore,
        quizRubricResult: localQuiz ?? undefined,
        stageFeedback: localLeak?.stageFeedback,
      });
    }
    return buildMockReply(params, "provider-fallback");
  }
}
