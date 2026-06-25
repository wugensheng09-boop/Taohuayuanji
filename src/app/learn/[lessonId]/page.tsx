import { notFound } from "next/navigation";

import { LearningWorkspace } from "@/components/LearningWorkspace";
import { loadLessonBundle } from "@/lib/lesson-loader";
import { getRokidRuntimeMode } from "@/lib/rokid-device";

export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ autostart?: string | string[]; device?: string | string[]; resume?: string | string[] }>;
}) {
  const { lessonId } = await params;
  const query = await searchParams;
  const bundle = await loadLessonBundle(lessonId).catch(() => notFound());
  const resume = Array.isArray(query.resume) ? query.resume[0] === "1" : query.resume === "1";
  const autostart = Array.isArray(query.autostart) ? query.autostart.includes("1") : query.autostart === "1";
  const deviceMode = getRokidRuntimeMode(query);

  return <LearningWorkspace bundle={bundle} resume={resume} deviceMode={deviceMode} autostart={autostart} />;
}
