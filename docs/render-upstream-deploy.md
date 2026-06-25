# Render upstream deployment

Use this when building a desktop installer that should call the live AI API instead of falling back locally.

## 1. Deploy the upstream service

The repo already has a Render Blueprint at `render.yaml`.

Open this URL after the current branch is pushed:

```text
https://dashboard.render.com/blueprint/new?repo=https://github.com/wugensheng09-boop/Taohuayuanji
```

Render should create one web service:

```text
textbook-world-upstream
```

## 2. Fill Render secrets

In the Render Blueprint or service environment, set:

```text
UPSTREAM_API_TOKEN=<make a long random token>
CHAT_API_KEY=<Bailian/DashScope API key>
TTS_API_KEY=<Bailian/DashScope API key>
```

The non-secret defaults are already in `render.yaml`.

## 3. Verify health

After Render says the deploy is live, check:

```text
https://textbook-world-upstream.onrender.com/health
```

Expected JSON includes:

```json
{
  "ok": true,
  "service": "upstream-server",
  "chatProvider": "bailian",
  "ttsProvider": "bailian"
}
```

If Render gives the service a different URL, use that URL in the next step.

## 4. Point the desktop build at Render

Set local `.env.local` before packaging:

```text
UPSTREAM_API_BASE_URL=https://textbook-world-upstream.onrender.com
UPSTREAM_API_TOKEN=<same token as Render UPSTREAM_API_TOKEN>
```

Then build:

```bash
npm run desktop:dist
```

The desktop prepare step now blocks localhost upstream URLs by default, because `http://127.0.0.1:8787` only works when the local upstream server is running.

For a local smoke build only:

```powershell
$env:ALLOW_LOCAL_UPSTREAM_FOR_DESKTOP="1"; npm run desktop:dist
```
