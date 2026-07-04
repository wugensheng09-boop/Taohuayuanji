import { NextResponse } from "next/server";

import { generateNpcReply, type ChatGenerationResult } from "@/lib/ai";
import { evaluateInterrogationAnswer } from "@/lib/interrogation-evaluator";
import { loadInterrogationConfig, loadLessonBundle } from "@/lib/lesson-loader";
import { synthesizeNpcTts } from "@/lib/tts";
import {
  addKnowledgeTags,
  recordChat,
  upsertSession,
} from "@/lib/session-store";
import { parseChatPayload } from "@/lib/validators";
import type { InterrogationCharacterConfig } from "@/types/interrogation";
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

function toRuntimeInterrogationNpc(character: InterrogationCharacterConfig): NpcConfig {
  return {
    npcId: character.id,
    name: character.name,
    role: character.role,
    style: character.tone,
    boundaries: [
      "围绕返乡盘问场景回应",
      "不主动泄露桃花源可复现路径",
      "用短句制造压迫或试探感",
    ],
    responsibilities: ["推进盘问", "追问证词破绽", "反馈守密与泄密风险"],
    systemProfile: `${character.role}，正在盘问返乡渔人，请保持克制、紧张、古风的语气。`,
  };
}

async function generateInterrogationWithTimeout(
  params: Parameters<typeof generateNpcReply>[0],
  timeoutMs = 30000,
): Promise<ChatGenerationResult | null> {
  const aiPromise = generateNpcReply(params).catch(() => null);
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([aiPromise, timeoutPromise]);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const payload = parseChatPayload(body);
    const bundle = await loadLessonBundle(payload.lessonId);
    const interrogation =
      payload.mode === "interrogation_eval"
        ? await loadInterrogationConfig(payload.lessonId).catch(() => null)
        : null;

    const scene = bundle.scenes.find((item) => item.sceneId === payload.sceneId);
    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    const npc =
      bundle.npcs.find((item) => item.npcId === payload.npcId) ??
      (() => {
        const epilogueNpc = bundle.epilogue.npcs.find((item) => item.npcId === payload.npcId);
        return epilogueNpc ? toRuntimeNpcConfig(epilogueNpc) : null;
      })() ??
      (() => {
        const interrogationNpc = interrogation?.characters.find((item) => item.id === payload.npcId);
        return interrogationNpc ? toRuntimeInterrogationNpc(interrogationNpc) : null;
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

    const localInterrogation =
      interrogation && payload.mode === "interrogation_eval"
        ? (() => {
            const turn =
              interrogation.turns.find((item) => item.id === payload.turnId) ??
              interrogation.turns.find((item) => item.speakerId === payload.npcId) ??
              interrogation.turns[0];
            return turn ? evaluateInterrogationAnswer(interrogation, turn, payload.message) : null;
          })()
        : null;

    const generationParams = {
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
    };
    const generationStartedAt = Date.now();
    const aiResult =
      payload.mode === "interrogation_eval"
        ? await generateInterrogationWithTimeout(generationParams)
        : await generateNpcReply(generationParams);
    if (!aiResult && payload.mode !== "interrogation_eval") {
      throw new Error("chat generation failed");
    }

    const reply =
      payload.mode === "interrogation_eval"
        ? aiResult?.source === "model" && aiResult.reply
          ? aiResult.reply
          : localInterrogation?.reply ?? aiResult?.reply ?? "盘问暂缓，先记下你的话。"
        : aiResult?.reply ?? "我记下了。";
    const tts =
      payload.mode === "interrogation_eval" || !reply ? null : await synthesizeNpcTts(payload.npcId, reply);

    recordChat({
      sessionId: payload.sessionId,
      userMessage: payload.message,
      assistantReply: reply,
      npcId: payload.npcId,
    });
    addKnowledgeTags({ sessionId: payload.sessionId, tags: aiResult?.knowledgeTags ?? [] });

    const isInterrogationFallback = payload.mode === "interrogation_eval" && aiResult?.source !== "model";

    return NextResponse.json({
      sessionId: payload.sessionId,
      reply,
      tts,
      suggestedActions: aiResult?.suggestedActions ?? [],
      knowledgeTags: aiResult?.knowledgeTags ?? [],
      source: isInterrogationFallback ? "local_fallback" : (aiResult?.source ?? "mock"),
      latencyMs: Date.now() - generationStartedAt,
      fallbackReason: isInterrogationFallback ? "interrogation_local_guardrail" : undefined,
      shouldAdvance: aiResult?.shouldAdvance ?? true,
      nextPrompt: aiResult?.nextPrompt,
      roleSafetyFlags: aiResult?.roleSafetyFlags ?? [],
      leakRiskLevel: aiResult?.leakRiskLevel,
      leakRiskScore: aiResult?.leakRiskScore,
      credibilityDelta: localInterrogation?.credibilityDelta ?? aiResult?.credibilityDelta,
      leakRiskDelta: localInterrogation?.leakRiskDelta ?? aiResult?.leakRiskDelta,
      matchedEvidence: localInterrogation?.matchedEvidence ?? aiResult?.matchedEvidence,
      matchedLeakClues: localInterrogation?.matchedLeakClues ?? aiResult?.matchedLeakClues,
      quizRubricResult: aiResult?.quizRubricResult,
      stageFeedback:
        payload.mode === "interrogation_eval" && localInterrogation
          ? localInterrogation.stageFeedback
          : aiResult?.stageFeedback,
      dimensionNotes: aiResult?.dimensionNotes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
