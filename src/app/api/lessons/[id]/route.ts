import { NextResponse } from "next/server";

import { loadLessonBundle } from "@/lib/lesson-loader";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const bundle = await loadLessonBundle(id);
    return NextResponse.json(bundle);
  } catch {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }
}
