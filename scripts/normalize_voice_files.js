/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const VOICE_DIR = path.join(process.cwd(), "public", "audio", "taohuayuanji", "voice");

if (!fs.existsSync(VOICE_DIR)) {
  console.error("voice directory not found:", VOICE_DIR);
  process.exit(1);
}

const TARGET_PREFIX = /^(village_(l1|i1|i2|l4))\s*\.(mp3|wav)$/i;
const files = fs.readdirSync(VOICE_DIR);

const renamed = [];
for (const fileName of files) {
  const match = fileName.match(TARGET_PREFIX);
  if (!match) {
    continue;
  }
  const base = match[1].toLowerCase();
  const ext = match[3].toLowerCase();
  const normalizedName = `${base}.${ext}`;
  if (normalizedName === fileName) {
    continue;
  }

  const src = path.join(VOICE_DIR, fileName);
  const dst = path.join(VOICE_DIR, normalizedName);
  if (!fs.existsSync(src)) {
    continue;
  }

  const samePathIgnoringCase = src.toLowerCase() === dst.toLowerCase();
  if (fs.existsSync(dst) && !samePathIgnoringCase) {
    fs.unlinkSync(dst);
  }

  if (samePathIgnoringCase) {
    // Windows is case-insensitive: rename via temp file first.
    const temp = path.join(VOICE_DIR, `.__tmp__${Date.now()}_${Math.random().toString(16).slice(2)}.tmp`);
    fs.renameSync(src, temp);
    fs.renameSync(temp, dst);
  } else {
    fs.renameSync(src, dst);
  }
  renamed.push({ from: fileName, to: normalizedName });
}

if (!renamed.length) {
  console.log("No village voice files needed normalization.");
} else {
  console.log("Normalized village voice files:");
  for (const item of renamed) {
    console.log(`- ${item.from} -> ${item.to}`);
  }
}
