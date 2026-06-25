import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    runtime: process.env.APP_RUNTIME_DIR ? "desktop" : "web",
    root: process.env.APP_RUNTIME_DIR?.trim() || process.cwd(),
  });
}
