import { NextResponse } from "next/server";

import { getRuntimeRoot } from "@/lib/runtime-paths";

export async function GET() {
  return NextResponse.json({
    ok: true,
    runtime: process.env.APP_RUNTIME_DIR ? "desktop" : "web",
    root: getRuntimeRoot(),
  });
}
