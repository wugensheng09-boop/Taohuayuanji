#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const cwd = process.cwd();
const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run");

const manifestPath =
  process.env.VOICE_MANIFEST_PATH ??
  path.join(cwd, "data", "lessons", "taohuayuanji", "voice_batch_manifest.json");
const outputRoot =
  process.env.VOICE_OUTPUT_ROOT ?? path.join(cwd, "public", "audio", "taohuayuanji");
const endpoint =
  process.env.VOICE_API_ENDPOINT ??
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
const apiKey = process.env.VOICE_API_KEY ?? process.env.BAILIAN_API_KEY ?? "";
const model = process.env.VOICE_MODEL ?? "qwen3-tts-flash";

const roleVoiceMap = {
  narrator: process.env.VOICE_NARRATOR ?? "Ethan",
  protagonist_inner: process.env.VOICE_PROTAGONIST_INNER ?? "Ethan",
  protagonist_dialogue: process.env.VOICE_PROTAGONIST_DIALOGUE ?? "Ethan",
  aqiao: process.env.VOICE_AQIAO ?? "Ethan",
  chief: process.env.VOICE_CHIEF ?? "Ethan",
  peer_fisher: process.env.VOICE_PEER_FISHER ?? "Ethan",
};

function resolveVoice(roleKey) {
  if (roleKey && roleVoiceMap[roleKey]) return roleVoiceMap[roleKey];
  return process.env.VOICE_DEFAULT ?? "Ethan";
}

function resolveLanguage(text) {
  return /[\u4e00-\u9fff]/.test(text) ? "Chinese" : "English";
}

function ensureDirFor(targetFile) {
  const dir = path.dirname(targetFile);
  return fs.mkdir(dir, { recursive: true });
}

function guessOutputPath(item) {
  const folder = item.category === "mainline" ? "voice" : "npc";
  const name = item.audioId ? `${item.audioId}.wav` : item.fileName.replace(/\.[^.]+$/, ".wav");
  return path.join(outputRoot, folder, name);
}

async function synthOne(item) {
  const voice = resolveVoice(item.roleKey);
  const body = {
    model,
    input: {
      text: item.text,
      voice,
      language_type: resolveLanguage(item.text),
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${detail.slice(0, 240)}`);
  }

  const payload = await res.json();
  const audioUrl = payload?.output?.audio?.url;
  if (!audioUrl || typeof audioUrl !== "string") {
    throw new Error("No audio URL found in response");
  }

  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    const detail = await audioRes.text().catch(() => "");
    throw new Error(`Audio download failed: HTTP ${audioRes.status} ${detail.slice(0, 120)}`);
  }

  const buf = Buffer.from(await audioRes.arrayBuffer());
  if (!buf.byteLength) {
    throw new Error("Downloaded audio is empty");
  }
  return buf;
}

async function main() {
  const raw = await fs.readFile(manifestPath, "utf8");
  const items = JSON.parse(raw.replace(/^\uFEFF/, ""));
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Manifest is empty");
  }

  if (isDryRun) {
    const preview = items.map((it) => ({
      fileName: it.fileName,
      audioId: it.audioId,
      role: it.role,
      roleKey: it.roleKey,
      sceneId: it.sceneId,
      model,
      voice: resolveVoice(it.roleKey),
      prompt: it.ttsInstruction,
      text: it.text,
    }));
    const previewPath = path.join(path.dirname(manifestPath), "wen3_batch_requests.preview.json");
    await fs.writeFile(previewPath, JSON.stringify(preview, null, 2), "utf8");
    console.log(`Dry-run preview written: ${previewPath}`);
    console.log(`Total jobs: ${preview.length}`);
    return;
  }

  if (!apiKey) {
    throw new Error("Missing VOICE_API_KEY or BAILIAN_API_KEY");
  }

  let ok = 0;
  let fail = 0;
  for (const item of items) {
    const outputFile = guessOutputPath(item);
    try {
      await ensureDirFor(outputFile);
      const audio = await synthOne(item);
      await fs.writeFile(outputFile, audio);
      ok += 1;
      console.log(`OK   ${path.relative(cwd, outputFile)}`);
    } catch (error) {
      fail += 1;
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`FAIL ${item.audioId ?? item.fileName} -> ${msg}`);
    }
  }

  console.log(`Done. ok=${ok} fail=${fail}`);
}

main().catch((error) => {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(msg);
  process.exit(1);
});
