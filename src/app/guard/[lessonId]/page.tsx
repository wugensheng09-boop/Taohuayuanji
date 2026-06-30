import { notFound } from "next/navigation";

import { InterrogationWorkspace } from "@/components/InterrogationWorkspace";
import { loadInterrogationConfig, loadLessonBundle } from "@/lib/lesson-loader";
import { getRokidRuntimeMode } from "@/lib/rokid-device";

export default async function GuardPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ device?: string | string[] }>;
}) {
  const { lessonId } = await params;
  const query = await searchParams;
  const [bundle, config] = await Promise.all([
    loadLessonBundle(lessonId).catch(() => null),
    loadInterrogationConfig(lessonId).catch(() => null),
  ]);

  if (!bundle || !config) {
    notFound();
  }

  return <InterrogationWorkspace bundle={bundle} config={config} deviceMode={getRokidRuntimeMode(query)} />;
}
