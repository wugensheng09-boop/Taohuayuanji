function toInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function requireString(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function firstDefined(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function createConfig() {
  return {
    host: process.env.HOST?.trim() || "0.0.0.0",
    port: toInt(process.env.PORT, 8787),
    requestTimeoutMs: toInt(process.env.REQUEST_TIMEOUT_MS, 20000),
    requestBodyLimitBytes: toInt(process.env.REQUEST_BODY_LIMIT_BYTES, 262144),
    rateLimitWindowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 60000),
    rateLimitMaxRequests: toInt(process.env.RATE_LIMIT_MAX_REQUESTS, 60),
    upstreamApiToken: requireString("UPSTREAM_API_TOKEN"),
    chat: {
      provider: firstDefined(process.env.CHAT_PROVIDER, process.env.AI_PROVIDER) || "mock",
      model:
        firstDefined(process.env.CHAT_MODEL, process.env.BAILIAN_MODEL, process.env.UPSTREAM_API_MODEL) ||
        "qwen-plus",
      baseUrl:
        firstDefined(process.env.CHAT_BASE_URL, process.env.BAILIAN_BASE_URL) ||
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: firstDefined(process.env.CHAT_API_KEY, process.env.BAILIAN_API_KEY),
    },
    tts: {
      provider: firstDefined(process.env.TTS_PROVIDER, process.env.AI_PROVIDER) || "mock",
      model:
        firstDefined(process.env.TTS_MODEL, process.env.BAILIAN_TTS_MODEL) || "qwen3-tts-instruct-flash",
      baseUrl: firstDefined(process.env.TTS_BASE_URL) || "https://api.openai.com/v1",
      endpoint:
        firstDefined(process.env.TTS_ENDPOINT, process.env.BAILIAN_TTS_ENDPOINT) ||
        "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      apiKey: firstDefined(process.env.TTS_API_KEY, process.env.BAILIAN_API_KEY),
      defaultFormat: process.env.TTS_DEFAULT_FORMAT?.trim() || "mp3",
      bailianFallbackVoice:
        firstDefined(process.env.BAILIAN_TTS_FALLBACK_VOICE, process.env.BAILIAN_TTS_VOICE_DEFAULT) || "Ethan",
      defaultInstructions:
        process.env.TTS_DEFAULT_INSTRUCTIONS?.trim() ||
        "Speak naturally in Mandarin Chinese with clear pacing.",
    },
  };
}
