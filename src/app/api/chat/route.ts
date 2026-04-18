import { NextResponse } from "next/server";

import { generateNpcReply } from "@/lib/ai";
import { loadLessonBundle } from "@/lib/lesson-loader";
import {
  addKnowledgeTags,
  recordChat,
  upsertSession,
} from "@/lib/session-store";
import { synthesizeNpcTts } from "@/lib/tts";
import { parseChatPayload } from "@/lib/validators";
import type { PostStoryNpcConfig } from "@/types/epilogue";
import type { NpcConfig } from "@/types/npc";

function toRuntimeNpcConfig(epilogueNpc: PostStoryNpcConfig): NpcConfig {
  return {
    npcId: epilogueNpc.npcId,
    name: epilogueNpc.name,
    role: epilogueNpc.role,
    style: epilogueNpc.style,
    boundaries: epilogueNpc.boundaries,
    responsibilities: [
      "维持角色设定",
      "围绕《桃花源记》剧情回应",
      "以沉浸叙事方式推进对话",
    ],
    systemProfile: `${epilogueNpc.role}，请保持古风语境，并确保回应安全、克制、贴合课文。`,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const payload = parseChatPayload(body);
    const bundle = await loadLessonBundle(payload.lessonId);

    const scene = bundle.scenes.find((item) => item.sceneId === payload.sceneId);
    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    const npc =
      bundle.npcs.find((item) => item.npcId === payload.npcId) ??
      (() => {
        const epilogueNpc = bundle.epilogue.npcs.find((item) => item.npcId === payload.npcId);
        return epilogueNpc ? toRuntimeNpcConfig(epilogueNpc) : null;
      })();
    if (!npc) {
      return NextResponse.json({ error: "NPC not found" }, { status: 404 });
    }

    const session = upsertSession({
      sessionId: payload.sessionId,
      lessonId: payload.lessonId,
      sceneId: payload.sceneId,
    });
    const lineInScene = payload.lineId
      ? scene.timeline.find((line) => line.id === payload.lineId)
      : undefined;

    const aiResult = await generateNpcReply({
      message: payload.message,
      lesson: bundle.lesson,
      scene,
      npc,
      knowledge: bundle.knowledge,
      session,
      payload: {
        ...payload,
        lineId: payload.lineId ?? lineInScene?.id,
        question: payload.question ?? lineInScene?.text,
      },
    });

    const shouldSpeak =
      payload.mode === "roleplay_chat" ||
      payload.mode === "free_ask" ||
      payload.mode === "quiz_eval" ||
      payload.mode === "leak_eval";
    const tts = shouldSpeak ? await synthesizeNpcTts(payload.npcId, aiResult.reply) : null;

    recordChat({
      sessionId: payload.sessionId,
      userMessage: payload.message,
      assistantReply: aiResult.reply,
      npcId: payload.npcId,
    });
    addKnowledgeTags({ sessionId: payload.sessionId, tags: aiResult.knowledgeTags });

    return NextResponse.json({
      sessionId: payload.sessionId,
      reply: aiResult.reply,
      tts,
      suggestedActions: aiResult.suggestedActions,
      knowledgeTags: aiResult.knowledgeTags,
      source: aiResult.source,
      shouldAdvance: aiResult.shouldAdvance,
      nextPrompt: aiResult.nextPrompt,
      roleSafetyFlags: aiResult.roleSafetyFlags,
      leakRiskLevel: aiResult.leakRiskLevel,
      leakRiskScore: aiResult.leakRiskScore,
      quizRubricResult: aiResult.quizRubricResult,
      stageFeedback: aiResult.stageFeedback,
      dimensionNotes: aiResult.dimensionNotes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
