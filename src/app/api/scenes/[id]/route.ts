import { NextResponse } from "next/server";

import { findSceneById } from "@/lib/lesson-loader";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const found = await findSceneById(id);

  if (!found) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  return NextResponse.json(found);
}
