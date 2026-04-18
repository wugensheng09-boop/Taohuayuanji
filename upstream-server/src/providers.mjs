import { normalizeChatResult, normalizeTtsResult } from "./contracts.mjs";

function buildMockChat(payload) {
  return normalizeChatResult({
    reply: `已收到你的问题：${payload.message.slice(0, 60)}`,
    suggestedActions: ["继续对话"],
    knowledgeTags: ["theme"],
    shouldAdvance: true,
    roleSafetyFlags: [],
    stageFeedback: ["当前为 mock 上游回复。"],
  });
}

function buildMockTts(payload) {
  const syncWeights = Array.from(payload.text).map(() => 1);
  return {
    audioBase64: "",
    mimeType: "audio/mpeg",
    syncWeights,
    voiceProfile: payload.voiceProfile.profileId,
    playbackRate: payload.voiceProfile.speed,
  };
}

function buildSyncWeights(text) {
  const chars = Array.from(text);
  if (chars.length === 0) {
    return [];
  }
  return chars.map((ch) => {
    if (/\s/.test(ch)) return 0.08;
    if (/[，；：,;:]/.test(ch)) return 0.75;
    if (/[。！？!?]/.test(ch)) return 1.15;
    if (/["“”()（）《》【】…]/.test(ch)) return 0.45;
    if (/[a-zA-Z0-9]/.test(ch)) return 0.75;
    return 1;
  });
}

function extractChatContent(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : undefined;
  const message = choice && typeof choice === "object" ? choice.message : undefined;
  const content = message && typeof message === "object" ? message.content : undefined;
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => (item && typeof item === "object" && typeof item.text === "string" ? item.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return "";
}

function ensureJsonInstruction(text) {
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) {
    return "Return valid JSON only.";
  }

  if (/json/i.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}\n\nReturn valid JSON only. The final answer must be a single JSON object.`;
}

async function postJson(url, headers, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`provider-http-${response.status}: ${message}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadBinary(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(`provider-http-${response.status}: ${message}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      audioBase64: bytes.toString("base64"),
      mimeType: response.headers.get("content-type")?.split(";")[0]?.trim() || "audio/mpeg",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function postBinary(url, headers, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`provider-http-${response.status}: ${message}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      audioBase64: bytes.toString("base64"),
      mimeType: response.headers.get("content-type")?.split(";")[0]?.trim() || "audio/mpeg",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function generateOpenAiCompatibleChat(config, payload) {
  if (!config.chat.apiKey) {
    throw new Error("CHAT_API_KEY is required for openai-compatible chat");
  }

  const result = await postJson(
    `${config.chat.baseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.chat.apiKey}`,
    },
    {
      model: payload.model || config.chat.model,
      temperature: 0.5,
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ensureJsonInstruction(payload.systemPrompt) },
        { role: "user", content: ensureJsonInstruction(payload.userPrompt) },
      ],
    },
    config.requestTimeoutMs,
  );

  const rawContent = extractChatContent(result);
  const parsed = rawContent ? JSON.parse(rawContent) : result;
  return normalizeChatResult(parsed);
}

async function generateBailianChat(config, payload) {
  if (!config.chat.apiKey) {
    throw new Error("BAILIAN_API_KEY is required for bailian chat");
  }

  const result = await postJson(
    `${config.chat.baseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.chat.apiKey}`,
    },
    {
      model: payload.model || config.chat.model,
      temperature: 0.5,
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ensureJsonInstruction(payload.systemPrompt) },
        { role: "user", content: ensureJsonInstruction(payload.userPrompt) },
      ],
    },
    config.requestTimeoutMs,
  );

  const rawContent = extractChatContent(result);
  let parsed = result;
  if (rawContent) {
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      parsed = {
        reply: rawContent,
        suggestedActions: [],
        knowledgeTags: [],
        shouldAdvance: false,
        roleSafetyFlags: [],
      };
    }
  }
  return normalizeChatResult(parsed);
}

async function generateOpenAiCompatibleTts(config, payload) {
  if (!config.tts.apiKey) {
    throw new Error("TTS_API_KEY is required for openai-compatible tts");
  }

  const result = await postBinary(
    `${config.tts.baseUrl.replace(/\/$/, "")}/audio/speech`,
    {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.tts.apiKey}`,
    },
    {
      model: config.tts.model,
      voice: payload.voiceProfile.voice,
      input: payload.text,
      format: config.tts.defaultFormat,
      instructions: config.tts.defaultInstructions,
      speed: payload.voiceProfile.speed,
    },
    config.requestTimeoutMs,
  );

  return normalizeTtsResult({
    ...result,
    syncWeights: buildSyncWeights(payload.text),
    voiceProfile: payload.voiceProfile.profileId,
    playbackRate: payload.voiceProfile.speed,
  });
}

async function generateBailianTts(config, payload) {
  if (!config.tts.apiKey) {
    throw new Error("BAILIAN_API_KEY is required for bailian tts");
  }

  async function requestWithVoice(voice) {
    return postJson(
      config.tts.endpoint,
      {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.tts.apiKey}`,
        "X-DashScope-Async": "disable",
      },
      {
        model: config.tts.model,
        input: {
          text: payload.text,
          voice,
          language_type: /[\u4e00-\u9fff]/.test(payload.text) ? "Chinese" : "English",
          speed: payload.voiceProfile.speed,
        },
      },
      config.requestTimeoutMs,
    );
  }

  let result;
  let actualVoice = payload.voiceProfile.voice;
  try {
    result = await requestWithVoice(actualVoice);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fallbackVoice = config.tts.bailianFallbackVoice;
    const shouldRetry =
      fallbackVoice &&
      fallbackVoice !== actualVoice &&
      /Voice .* is not supported/i.test(message);

    if (!shouldRetry) {
      throw error;
    }

    actualVoice = fallbackVoice;
    result = await requestWithVoice(actualVoice);
  }

  const audioUrl = result?.output?.audio?.url;
  if (typeof audioUrl !== "string" || !audioUrl.trim()) {
    throw new Error("provider-http-502: missing-audio-url");
  }

  const downloaded = await downloadBinary(audioUrl, config.requestTimeoutMs);
  return normalizeTtsResult({
    ...downloaded,
    syncWeights: buildSyncWeights(payload.text),
    voiceProfile: actualVoice || payload.voiceProfile.profileId,
    playbackRate: payload.voiceProfile.speed,
  });
}

export async function generateChatResponse(config, payload) {
  if (config.chat.provider === "mock") {
    return buildMockChat(payload);
  }
  if (config.chat.provider === "openai-compatible") {
    return generateOpenAiCompatibleChat(config, payload);
  }
  if (config.chat.provider === "bailian") {
    return generateBailianChat(config, payload);
  }

  throw new Error(`Unsupported CHAT_PROVIDER: ${config.chat.provider}`);
}

export async function generateTtsResponse(config, payload) {
  if (config.tts.provider === "mock") {
    return buildMockTts(payload);
  }
  if (config.tts.provider === "openai-compatible") {
    return generateOpenAiCompatibleTts(config, payload);
  }
  if (config.tts.provider === "bailian") {
    return generateBailianTts(config, payload);
  }

  throw new Error(`Unsupported TTS_PROVIDER: ${config.tts.provider}`);
}
