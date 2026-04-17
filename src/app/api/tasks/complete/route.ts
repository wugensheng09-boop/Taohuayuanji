import { NextResponse } from "next/server";

import { markTaskCompleted, upsertSession } from "@/lib/session-store";
import { parseTaskCompletePayload } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const payload = parseTaskCompletePayload(body);

    upsertSession({
      sessionId: payload.sessionId,
      lessonId: payload.lessonId,
      sceneId: payload.sceneId,
    });
    const session = markTaskCompleted({
      sessionId: payload.sessionId,
      taskId: payload.taskId,
    });

    return NextResponse.json({
      ok: true,
      completedTasks: session?.completedTasks ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
