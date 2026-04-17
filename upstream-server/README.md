# Upstream Server

This service is the production-facing upstream proxy for the desktop app.

It keeps model credentials on the server side and exposes only:

- `GET /health`
- `POST /chat`
- `POST /tts`

## Why this is the stable path

- Desktop clients never receive your provider API keys
- Every request is protected by a Bearer token
- Input size and shape are validated
- Basic in-memory rate limiting is enabled
- Chat and TTS providers are abstracted behind one server boundary

## Start

1. Copy `.env.example` to `.env.local`
2. Fill in the token and provider credentials
3. Run:

```bash
node src/server.mjs
```

Default port:

```bash
8787
```

## Render deployment

This repo now includes a root-level [render.yaml](E:\课本世界穿越器\render.yaml) configured for this service.

It deploys:

- service name: `textbook-world-upstream`
- root directory: `upstream-server`
- health check: `/health`
- provider defaults: Bailian chat + Bailian TTS

Sensitive values that must be filled in on Render:

- `UPSTREAM_API_TOKEN`
- `CHAT_API_KEY`
- `TTS_API_KEY`

If you prefer container-based deployment on another platform, the service also includes:

- [Dockerfile](E:\课本世界穿越器\upstream-server\Dockerfile)
- [.dockerignore](E:\课本世界穿越器\upstream-server\.dockerignore)

## Desktop client config

Point the desktop app to this service:

```bash
UPSTREAM_API_BASE_URL=https://your-domain-or-host:8787
UPSTREAM_API_TOKEN=change-me
```

## Provider modes

### `CHAT_PROVIDER`

- `mock`: deterministic local fallback, useful for smoke tests
- `openai-compatible`: calls `{CHAT_BASE_URL}/chat/completions`
- `bailian`: calls DashScope compatible chat completions

### `TTS_PROVIDER`

- `mock`: returns no audio, useful for smoke tests
- `openai-compatible`: calls `{TTS_BASE_URL}/audio/speech`
- `bailian`: calls DashScope multimodal generation and then downloads the returned audio URL

## Recommended setup for your current product

Use the existing Bailian path:

```bash
CHAT_PROVIDER=bailian
TTS_PROVIDER=bailian
BAILIAN_API_KEY=your-key
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
BAILIAN_MODEL=qwen-plus
BAILIAN_TTS_ENDPOINT=https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
BAILIAN_TTS_MODEL=qwen3-tts-instruct-flash
BAILIAN_TTS_FALLBACK_VOICE=Ethan
UPSTREAM_API_TOKEN=change-me
```

## Required request contracts

### `POST /chat`

The desktop app sends:

- `mode`
- `model`
- `message`
- `systemPrompt`
- `userPrompt`
- `session`
- `chatHistory`
- `context`

The service returns fields compatible with the desktop runtime:

```json
{
  "reply": "string",
  "suggestedActions": ["string"],
  "knowledgeTags": ["imagery"],
  "shouldAdvance": true,
  "roleSafetyFlags": [],
  "leakRiskLevel": "low",
  "leakRiskScore": 0.12,
  "quizRubricResult": {
    "textualGrounding": 80,
    "understanding": 82,
    "expression": 78,
    "score": 80,
    "matchedPoints": [],
    "missedPoints": []
  },
  "stageFeedback": ["string"],
  "dimensionNotes": ["string"]
}
```

### `POST /tts`

Request:

```json
{
  "npcId": "aqiao",
  "text": "Example text",
  "voiceProfile": {
    "profileId": "young_male",
    "voice": "Noah",
    "speed": 0.92
  }
}
```

Response:

```json
{
  "audioBase64": "base64-audio",
  "mimeType": "audio/mpeg",
  "syncWeights": [1, 1, 1],
  "voiceProfile": "young_male",
  "playbackRate": 0.92
}
```
