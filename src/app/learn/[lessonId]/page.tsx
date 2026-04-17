import { notFound } from "next/navigation";

import { LearningWorkspace } from "@/components/LearningWorkspace";
import { loadLessonBundle } from "@/lib/lesson-loader";

export default async function LearnPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const bundle = await loadLessonBundle(lessonId).catch(() => notFound());

  return <LearningWorkspace bundle={bundle} />;
}
