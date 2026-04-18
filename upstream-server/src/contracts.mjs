function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertString(value, fieldName, maxLength = 20000) {
  if (typeof value !== "string") {
    throw new Error(`Invalid field: ${fieldName}`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new Error(`Invalid field: ${fieldName}`);
  }
  return trimmed;
}

function optionalStringArray(value) {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item) => typeof item === "string" && item.trim().length > 0).slice(0, 20);
}

function optionalNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function validateChatRequest(body) {
  if (!isObject(body)) {
    throw new Error("Invalid request body");
  }

  return {
    mode: assertString(body.mode, "mode", 64),
    model: assertString(body.model ?? "qwen-plus", "model", 128),
    message: assertString(body.message, "message", 1200),
    systemPrompt: assertString(body.systemPrompt, "systemPrompt", 50000),
    userPrompt: assertString(body.userPrompt, "userPrompt", 20000),
    session: isObject(body.session) ? body.session : {},
    chatHistory: Array.isArray(body.chatHistory) ? body.chatHistory.slice(0, 12) : [],
    context: isObject(body.context) ? body.context : {},
  };
}

export function validateTtsRequest(body) {
  if (!isObject(body)) {
    throw new Error("Invalid request body");
  }

  const voiceProfile = isObject(body.voiceProfile) ? body.voiceProfile : {};
  return {
    npcId: assertString(body.npcId, "npcId", 64),
    text: assertString(body.text, "text", 1200),
    voiceProfile: {
      profileId: assertString(voiceProfile.profileId ?? "default", "voiceProfile.profileId", 64),
      voice: assertString(voiceProfile.voice ?? "alloy", "voiceProfile.voice", 64),
      speed: optionalNumber(voiceProfile.speed) ?? 1,
    },
  };
}

export function normalizeChatResult(input) {
  const quiz = isObject(input.quizRubricResult)
    ? {
        textualGrounding: optionalNumber(input.quizRubricResult.textualGrounding) ?? 0,
        understanding: optionalNumber(input.quizRubricResult.understanding) ?? 0,
        expression: optionalNumber(input.quizRubricResult.expression) ?? 0,
        score: optionalNumber(input.quizRubricResult.score) ?? 0,
        matchedPoints: optionalStringArray(input.quizRubricResult.matchedPoints) ?? [],
        missedPoints: optionalStringArray(input.quizRubricResult.missedPoints) ?? [],
      }
    : undefined;

  return {
    reply: assertString(input.reply ?? "我记下你的话了，我们继续往前走。", "reply", 500),
    suggestedActions: optionalStringArray(input.suggestedActions) ?? [],
    knowledgeTags: optionalStringArray(input.knowledgeTags) ?? [],
    shouldAdvance: typeof input.shouldAdvance === "boolean" ? input.shouldAdvance : true,
    roleSafetyFlags: optionalStringArray(input.roleSafetyFlags) ?? [],
    leakRiskLevel:
      input.leakRiskLevel === "low" || input.leakRiskLevel === "mid" || input.leakRiskLevel === "high"
        ? input.leakRiskLevel
        : undefined,
    leakRiskScore: optionalNumber(input.leakRiskScore),
    quizRubricResult: quiz,
    stageFeedback: optionalStringArray(input.stageFeedback) ?? [],
    dimensionNotes: optionalStringArray(input.dimensionNotes) ?? [],
  };
}

export function normalizeTtsResult(input) {
  if (!isObject(input)) {
    throw new Error("Invalid TTS response");
  }

  return {
    audioBase64: assertString(input.audioBase64, "audioBase64", 10_000_000),
    mimeType: assertString(input.mimeType, "mimeType", 128),
    syncWeights:
      Array.isArray(input.syncWeights) && input.syncWeights.every((item) => typeof item === "number")
        ? input.syncWeights.slice(0, 5000)
        : [],
    voiceProfile: assertString(input.voiceProfile ?? "default", "voiceProfile", 64),
    playbackRate: optionalNumber(input.playbackRate) ?? 1,
  };
}
