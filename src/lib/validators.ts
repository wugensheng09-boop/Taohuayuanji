export interface ChatRequestPayload {
  sessionId: string;
  lessonId: string;
  sceneId: string;
  npcId: string;
  message: string;
  mode: "free_ask" | "roleplay_chat" | "quiz_eval" | "leak_eval";
  lineId?: string;
  attempt?: number;
  expectedIntents?: string[];
  maxGuideTurns?: number;
  fallbackAdvance?: boolean;
  questionId?: string;
  questionType?: "open" | "choice";
  question?: string;
  options?: string[];
  correctOptions?: string[];
  referencePoints?: string[];
  stageFeedbackHints?: string[];
  stageIndex?: number;
  totalStages?: number;
  sensitiveKeywords?: string[];
  routeKeywords?: string[];
  reproducibleClueKeywords?: string[];
  highRiskThreshold?: number;
}

export interface TaskCompletePayload {
  sessionId: string;
  lessonId: string;
  taskId: string;
  sceneId: string;
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid field: ${fieldName}`);
  }
  return value.trim();
}

export function parseChatPayload(body: unknown): ChatRequestPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }

  const payload = body as Record<string, unknown>;
  const message = assertString(payload.message, "message");
  if (message.length > 600) {
    throw new Error("Message is too long");
  }
  const modeRaw = payload.mode;
  const mode: ChatRequestPayload["mode"] =
    modeRaw === "roleplay_chat" ||
    modeRaw === "quiz_eval" ||
    modeRaw === "leak_eval"
      ? modeRaw
      : "free_ask";

  const lineIdRaw = payload.lineId;
  const lineId = typeof lineIdRaw === "string" && lineIdRaw.trim() ? lineIdRaw.trim() : undefined;

  const attemptRaw = payload.attempt;
  const attempt =
    typeof attemptRaw === "number" && Number.isFinite(attemptRaw) && attemptRaw >= 1
      ? Math.floor(attemptRaw)
      : undefined;

  const expectedIntentsRaw = payload.expectedIntents;
  const expectedIntents = Array.isArray(expectedIntentsRaw)
    ? expectedIntentsRaw.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;

  const maxGuideTurnsRaw = payload.maxGuideTurns;
  const maxGuideTurns =
    typeof maxGuideTurnsRaw === "number" && Number.isFinite(maxGuideTurnsRaw) && maxGuideTurnsRaw >= 1
      ? Math.floor(maxGuideTurnsRaw)
      : undefined;

  const fallbackAdvanceRaw = payload.fallbackAdvance;
  const fallbackAdvance = typeof fallbackAdvanceRaw === "boolean" ? fallbackAdvanceRaw : undefined;
  const questionIdRaw = payload.questionId;
  const questionId =
    typeof questionIdRaw === "string" && questionIdRaw.trim().length > 0 ? questionIdRaw.trim() : undefined;
  const questionTypeRaw = payload.questionType;
  const questionType =
    questionTypeRaw === "open" || questionTypeRaw === "choice" ? questionTypeRaw : undefined;
  const questionRaw = payload.question;
  const question = typeof questionRaw === "string" && questionRaw.trim().length > 0 ? questionRaw.trim() : undefined;
  const optionsRaw = payload.options;
  const options = Array.isArray(optionsRaw)
    ? optionsRaw.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;
  const correctOptionsRaw = payload.correctOptions;
  const correctOptions = Array.isArray(correctOptionsRaw)
    ? correctOptionsRaw.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;
  const referencePointsRaw = payload.referencePoints;
  const referencePoints = Array.isArray(referencePointsRaw)
    ? referencePointsRaw.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;
  const stageFeedbackHintsRaw = payload.stageFeedbackHints;
  const stageFeedbackHints = Array.isArray(stageFeedbackHintsRaw)
    ? stageFeedbackHintsRaw.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;
  const stageIndexRaw = payload.stageIndex;
  const stageIndex =
    typeof stageIndexRaw === "number" && Number.isFinite(stageIndexRaw) && stageIndexRaw >= 1
      ? Math.floor(stageIndexRaw)
      : undefined;
  const totalStagesRaw = payload.totalStages;
  const totalStages =
    typeof totalStagesRaw === "number" && Number.isFinite(totalStagesRaw) && totalStagesRaw >= 1
      ? Math.floor(totalStagesRaw)
      : undefined;
  const sensitiveKeywordsRaw = payload.sensitiveKeywords;
  const sensitiveKeywords = Array.isArray(sensitiveKeywordsRaw)
    ? sensitiveKeywordsRaw.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;
  const routeKeywordsRaw = payload.routeKeywords;
  const routeKeywords = Array.isArray(routeKeywordsRaw)
    ? routeKeywordsRaw.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;
  const reproducibleClueKeywordsRaw = payload.reproducibleClueKeywords;
  const reproducibleClueKeywords = Array.isArray(reproducibleClueKeywordsRaw)
    ? reproducibleClueKeywordsRaw.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;
  const highRiskThresholdRaw = payload.highRiskThreshold;
  const highRiskThreshold =
    typeof highRiskThresholdRaw === "number" &&
    Number.isFinite(highRiskThresholdRaw) &&
    highRiskThresholdRaw >= 0 &&
    highRiskThresholdRaw <= 1
      ? highRiskThresholdRaw
      : undefined;

  return {
    sessionId: assertString(payload.sessionId, "sessionId"),
    lessonId: assertString(payload.lessonId, "lessonId"),
    sceneId: assertString(payload.sceneId, "sceneId"),
    npcId: assertString(payload.npcId, "npcId"),
    message,
    mode,
    lineId,
    attempt,
    expectedIntents,
    maxGuideTurns,
    fallbackAdvance,
    questionId,
    questionType,
    question,
    options,
    correctOptions,
    referencePoints,
    stageFeedbackHints,
    stageIndex,
    totalStages,
    sensitiveKeywords,
    routeKeywords,
    reproducibleClueKeywords,
    highRiskThreshold,
  };
}

export function parseTaskCompletePayload(body: unknown): TaskCompletePayload {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }
  const payload = body as Record<string, unknown>;
  return {
    sessionId: assertString(payload.sessionId, "sessionId"),
    lessonId: assertString(payload.lessonId, "lessonId"),
    taskId: assertString(payload.taskId, "taskId"),
    sceneId: assertString(payload.sceneId, "sceneId"),
  };
}
