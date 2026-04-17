export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  npcId: string;
  content: string;
  createdAt: string;
}

export interface SessionState {
  sessionId: string;
  lessonId: string;
  currentSceneId: string;
  visitedScenes: string[];
  completedTasks: string[];
  chatHistory: ChatMessage[];
  askedQuestions: string[];
  answeredHints: string[];
  interactionAttempts: number;
  guidedAdvances: number;
  lineProgress: string[];
  knowledgeProgress: Record<string, boolean>;
}

export interface SessionSummary {
  sessionId: string;
  lessonId: string;
  exploredScenes: string[];
  completedTasks: string[];
  questionSummary: string[];
  interactionAttempts: number;
  guidedAdvances: number;
  lineProgress: string[];
  unlockedKnowledgeTags: string[];
  knowledgeProgress: Record<string, boolean>;
  recommendations: string[];
}
