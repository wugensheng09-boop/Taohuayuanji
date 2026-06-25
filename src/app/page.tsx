import { TaohuayuanHomeClient } from "@/components/TaohuayuanHomeClient";
import { loadInterrogationConfig, loadLessonBundle } from "@/lib/lesson-loader";

import "./home.css";

const HOME_LESSON_ID = "taohuayuanji";

export default async function TaohuayuanHome() {
  const [bundle, interrogation] = await Promise.all([
    loadLessonBundle(HOME_LESSON_ID),
    loadInterrogationConfig(HOME_LESSON_ID),
  ]);

  return (
    <TaohuayuanHomeClient
      lessonId={bundle.lesson.lessonId}
      sceneCount={bundle.scenes.length}
      taskCount={interrogation.turns.length}
    />
  );
}
