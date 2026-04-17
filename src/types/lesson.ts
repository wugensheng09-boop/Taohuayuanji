import type { NpcConfig } from "@/types/npc";
import type { SceneConfig } from "@/types/scene";
import type { EpilogueConfig } from "@/types/epilogue";

export interface LessonMeta {
  lessonId: string;
  title: string;
  author: string;
  era: string;
  intro: string;
  coverImage: string;
  entrySceneId: string;
  sceneOrder: string[];
  targetUsers: string[];
  suggestedQuestions: string[];
}

export interface TranslationPair {
  source: string;
  target: string;
}

export interface Annotation {
  word: string;
  explanation: string;
}

export interface TypicalQA {
  question: string;
  answer: string;
}

export interface KnowledgeBase {
  lessonId: string;
  title: string;
  author: string;
  originalText: string;
  translation: TranslationPair[];
  annotations: Annotation[];
  writingBackground: string;
  structure: string[];
  themes: string[];
  examPoints: string[];
  teachingGoals: string[];
  typicalQA: TypicalQA[];
}

export interface LessonBundle {
  lesson: LessonMeta;
  scenes: SceneConfig[];
  npcs: NpcConfig[];
  knowledge: KnowledgeBase;
  epilogue: EpilogueConfig;
}
