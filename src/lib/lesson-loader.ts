import { promises as fs } from "node:fs";
import path from "node:path";

import { resolveRuntimePath } from "@/lib/runtime-paths";
import type { EpilogueConfig } from "@/types/epilogue";
import type { LessonBundle, LessonMeta, KnowledgeBase } from "@/types/lesson";
import type { NpcConfig } from "@/types/npc";
import type { SceneConfig } from "@/types/scene";

const DATA_ROOT = resolveRuntimePath("data", "lessons");
const bundleCache = new Map<string, LessonBundle>();

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  const sanitized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(sanitized) as T;
}

export async function listLessonIds(): Promise<string[]> {
  const entries = await fs.readdir(DATA_ROOT, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

export async function loadLessonBundle(lessonId: string): Promise<LessonBundle> {
  if (bundleCache.has(lessonId)) {
    return bundleCache.get(lessonId)!;
  }

  const lessonDir = path.join(DATA_ROOT, lessonId);
  const [lesson, scenes, npcs, knowledge, epilogue] = await Promise.all([
    readJson<LessonMeta>(path.join(lessonDir, "lesson.json")),
    readJson<SceneConfig[]>(path.join(lessonDir, "scenes.json")),
    readJson<NpcConfig[]>(path.join(lessonDir, "npcs.json")),
    readJson<KnowledgeBase>(path.join(lessonDir, "knowledge.json")),
    readJson<EpilogueConfig>(path.join(lessonDir, "epilogue.json")),
  ]);

  const bundle: LessonBundle = { lesson, scenes, npcs, knowledge, epilogue };
  bundleCache.set(lessonId, bundle);
  return bundle;
}

export async function loadLessonMetaList(): Promise<LessonMeta[]> {
  const lessonIds = await listLessonIds();
  const bundles = await Promise.all(lessonIds.map((lessonId) => loadLessonBundle(lessonId)));
  return bundles.map((bundle) => bundle.lesson);
}

export async function findSceneById(
  sceneId: string,
): Promise<{ lessonId: string; scene: SceneConfig } | null> {
  const lessonIds = await listLessonIds();
  for (const lessonId of lessonIds) {
    const bundle = await loadLessonBundle(lessonId);
    const scene = bundle.scenes.find((item) => item.sceneId === sceneId);
    if (scene) {
      return { lessonId, scene };
    }
  }
  return null;
}
