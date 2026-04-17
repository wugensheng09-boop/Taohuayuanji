import { NextResponse } from "next/server";

import { upsertSession } from "@/lib/session-store";

interface InitPayload {
  sessionId: string;
  lessonId: string;
  sceneId: string;
}

function parsePayload(body: unknown): InitPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }
  const payload = body as Record<string, unknown>;
  const sessionId = payload.sessionId;
  const lessonId = payload.lessonId;
  const sceneId = payload.sceneId;
  if (
    typeof sessionId !== "string" ||
    typeof lessonId !== "string" ||
    typeof sceneId !== "string" ||
    !sessionId ||
    !lessonId ||
    !sceneId
  ) {
    throw new Error("Missing required fields");
  }
  return { sessionId, lessonId, sceneId };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const payload = parsePayload(body);
    const session = upsertSession(payload);
    return NextResponse.json({
      ok: true,
      sessionId: session.sessionId,
      visitedScenes: session.visitedScenes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
