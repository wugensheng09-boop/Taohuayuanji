import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createConfig } from "./config.mjs";
import { validateChatRequest, validateTtsRequest } from "./contracts.mjs";
import { loadEnvFiles } from "./env.mjs";
import { generateChatResponse, generateTtsResponse } from "./providers.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

loadEnvFiles(rootDir);

const config = createConfig();
const rateLimitStore = new Map();

function json(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function getRateLimitKey(req) {
  const auth = req.headers.authorization?.trim();
  if (auth) {
    return `token:${auth}`;
  }
  return `ip:${req.socket.remoteAddress ?? "unknown"}`;
}

function checkRateLimit(req) {
  const key = getRateLimitKey(req);
  const now = Date.now();
  const existing = rateLimitStore.get(key);
  if (!existing || now > existing.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.rateLimitWindowMs,
    });
    return true;
  }

  existing.count += 1;
  if (existing.count > config.rateLimitMaxRequests) {
    return false;
  }
  return true;
}

function isAuthorized(req) {
  const auth = req.headers.authorization?.trim() || "";
  return auth === `Bearer ${config.upstreamApiToken}`;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > config.requestBodyLimitBytes) {
        reject(new Error("request-body-too-large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("invalid-json"));
      }
    });

    req.on("error", reject);
  });
}

async function handleChat(req, res) {
  const body = validateChatRequest(await readJsonBody(req));
  const result = await generateChatResponse(config, body);
  json(res, 200, result);
}

async function handleTts(req, res) {
  const body = validateTtsRequest(await readJsonBody(req));
  const result = await generateTtsResponse(config, body);
  json(res, 200, result);
}

const server = createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) {
      json(res, 400, { error: "bad-request" });
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, {
        ok: true,
        service: "upstream-server",
        chatProvider: config.chat.provider,
        ttsProvider: config.tts.provider,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!isAuthorized(req)) {
      json(res, 401, { error: "unauthorized" });
      return;
    }

    if (!checkRateLimit(req)) {
      json(res, 429, { error: "rate-limit-exceeded" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/chat") {
      await handleChat(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/tts") {
      await handleTts(req, res);
      return;
    }

    json(res, 404, { error: "not-found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal-error";
    const statusCode =
      message === "invalid-json" || message === "request-body-too-large" || message.startsWith("Invalid field")
        ? 400
        : message.startsWith("provider-http-400:")
          ? 400
          : message.startsWith("provider-http-401:") || message.startsWith("provider-http-403:")
            ? 502
            : message.startsWith("provider-http-404:")
              ? 502
              : message.startsWith("provider-http-429:")
                ? 429
        : message.startsWith("provider-http-")
          ? 502
          : 500;
    json(res, statusCode, { error: message });
  }
});

server.requestTimeout = config.requestTimeoutMs;
server.headersTimeout = config.requestTimeoutMs + 1000;

server.listen(config.port, config.host, () => {
  console.log(
    `[upstream-server] listening on http://${config.host}:${config.port} chat=${config.chat.provider} tts=${config.tts.provider}`,
  );
});
