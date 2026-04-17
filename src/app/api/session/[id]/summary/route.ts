import { NextResponse } from "next/server";

import { loadLessonBundle } from "@/lib/lesson-loader";
import { generateSessionSummary, getSession } from "@/lib/session-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const bundle = await loadLessonBundle(session.lessonId);
  const summary = generateSessionSummary(id, bundle);
  if (!summary) {
    return NextResponse.json({ error: "Summary not found" }, { status: 404 });
  }
  return NextResponse.json(summary);
}
