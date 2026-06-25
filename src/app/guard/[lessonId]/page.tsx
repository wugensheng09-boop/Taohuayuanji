import { notFound } from "next/navigation";

import { InterrogationWorkspace } from "@/components/InterrogationWorkspace";
import { loadInterrogationConfig, loadLessonBundle } from "@/lib/lesson-loader";

export default async function GuardPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const [bundle, config] = await Promise.all([
    loadLessonBundle(lessonId).catch(() => null),
    loadInterrogationConfig(lessonId).catch(() => null),
  ]);

  if (!bundle || !config) {
    notFound();
  }

  return <InterrogationWorkspace bundle={bundle} config={config} />;
}
