export type SceneTaskType = "observation" | "dialogue" | "analysis" | "qa";

export type SceneSpeakerMode = "narrator" | "npc";
export type SceneLineType = "auto" | "checkpoint" | "interactive";
export type SceneInteractionMode = "none" | "npc2";
export type SceneVoiceTrack = "inner" | "scene" | "quote";
export type SceneCameraPreset = "none" | "push_in" | "focus" | "brighten" | "pull_back";
export type SceneCameraEffect = "none" | "speaker_emphasis";

export interface SceneLine {
  id: string;
  speakerMode: SceneSpeakerMode;
  npcId?: string;
  text: string;
  autoNextMs: number;
  lineType?: SceneLineType;
  voiceTrack?: SceneVoiceTrack;
  interactionMode?: SceneInteractionMode;
  interactionKey?: string;
  interactionId?: string;
  quickReplies?: string[];
  checkpointChoices?: string[];
  portraitImage?: string;
  portraitStyle?: "ink_center_blend" | "none";
  portraitAnchor?: "center-bottom" | "right-bottom";
  maxGuideTurns?: number;
  expectedIntents?: string[];
  fallbackAdvance?: boolean;
  cameraEffect?: SceneCameraEffect;
  taskCue?: string;
}

export interface SceneTask {
  id: string;
  type: SceneTaskType;
  content: string;
  hints?: string[];
}

export interface SceneHotspot {
  id: string;
  label: string;
  x: number;
  y: number;
  trigger: "show_text" | "unlock_task" | "hint";
  payload: string;
}

export interface SceneConfig {
  sceneId: string;
  title: string;
  backgroundImage: string;
  bgm?: {
    src: string;
    volume?: number;
  };
  backgroundVideo?: string;
  videoStartLineId?: string;
  videoMode?: "loop" | "play_once_then_image";
  videoFallbackImage?: string;
  ambientAudio?: string;
  ambientLayers?: {
    primary?: string;
    secondary?: string;
  };
  cameraPreset?: SceneCameraPreset;
  transitionActionLabel?: string;
  transitionChoices?: string[];
  description: string;
  npcs: string[];
  hotspots: SceneHotspot[];
  learningGoals: string[];
  tasks: SceneTask[];
  lineVoiceOverrides?: Record<string, string | null>;
  lineBackgroundOverrides?: Record<string, string>;
  timeline: SceneLine[];
  nextSceneId: string | null;
}
