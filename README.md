# 课本世界穿越器

这是一个基于 `Next.js 16 + React 19` 的沉浸式课文互动项目，当前已支持打包为 Windows 桌面应用。

## 当前能力

- Web 版本地运行
- Electron 桌面壳
- 内置 Next standalone 服务
- NSIS Windows 安装包输出
- 本地素材、课文数据随应用一起打包
- AI / TTS 通过上游接口代理，不在安装包内嵌供应商密钥

## 开发环境

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env.local`，按需填写：

```bash
AI_MODE=auto
UPSTREAM_API_BASE_URL=
UPSTREAM_API_TOKEN=
UPSTREAM_API_MODEL=default
UPSTREAM_API_MODEL_FREE_ASK=default
UPSTREAM_API_MODEL_ROLEPLAY=default
UPSTREAM_API_MODEL_QUIZ=default
UPSTREAM_API_MODEL_LEAK=default
DESKTOP_PORT=
TTS_VOICE_DEFAULT=Brenda
TTS_VOICE_AQIAO=Noah
TTS_VOICE_CHIEF=Eric
TTS_VOICE_PEER=Ethan
NEXT_PUBLIC_SPACE_SKIP_NO_API=0
```

说明：

- `UPSTREAM_API_BASE_URL`：你的线上 AI 代理服务地址
- `UPSTREAM_API_TOKEN`：桌面端请求上游服务时附带的 Bearer Token
- `DESKTOP_PORT`：可选，桌面内置服务端口；不填时自动选择空闲端口
- `AI_MODE=mock`：强制本地降级回复
- `AI_MODE=auto`：有上游配置时走线上，无配置时自动降级
- `AI_MODE=live`：强制走线上，失败时返回明确错误提示

## Web 运行

```bash
npm run dev
```

访问：

```bash
http://localhost:3000
```

## 桌面开发调试

```bash
npm run desktop:dev
```

这个命令会：

- 启动 `Next dev server`
- 等待 `/api/health` 就绪
- 启动 Electron 桌面窗口并加载本地页面

## 上游代理服务

为了正式上线，桌面端的 AI 与 TTS 不应直连供应商接口，而应通过独立的上游代理服务转发。

代理服务目录：

```bash
upstream-server/
```

本地启动：

```bash
npm run upstream:dev
```

详细环境变量和接口契约见：

- [upstream-server/README.md](E:\课本世界穿越器\upstream-server\README.md)
- [upstream-server/.env.example](E:\课本世界穿越器\upstream-server\.env.example)

## 构建 Windows 安装包

```bash
npm run desktop:dist
```

构建完成后，安装包位于：

```bash
release/课本世界穿越器-Setup-0.1.0.exe
```

同时会生成：

- `release/win-unpacked`
- `release/课本世界穿越器-Setup-0.1.0.exe.blockmap`

## 桌面运行时结构

桌面版采用以下方式运行：

- Electron 主进程负责启动窗口
- Electron 在本地拉起 Next standalone 服务
- 桌面窗口加载本地 `http://127.0.0.1:<port>`
- `data/` 与 `public/` 会被复制到桌面运行时目录
- `/api/health` 用于启动探活

## 上游 API 约定

当前本地 `/api/chat` 会继续保持前端不变，但内部改为调用上游服务：

### `POST /chat`

请求体会带上：

- `mode`
- `model`
- `message`
- `systemPrompt`
- `userPrompt`
- `session`
- `chatHistory`
- `context.lesson`
- `context.scene`
- `context.npc`
- `context.payload`

上游至少应返回与当前前端兼容的字段：

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

请求体：

```json
{
  "npcId": "aqiao",
  "text": "示例文本",
  "voiceProfile": {
    "profileId": "young_male",
    "voice": "Noah",
    "speed": 0.92
  }
}
```

返回体：

```json
{
  "audioBase64": "base64-audio",
  "mimeType": "audio/mpeg",
  "syncWeights": [1, 1, 1],
  "voiceProfile": "young_male",
  "playbackRate": 0.92
}
```

## 校验命令

```bash
npm run lint
npm run build
npm run desktop:prepare
npm run desktop:dist
```
