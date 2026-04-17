import type { LessonBundle } from "@/types/lesson";
import type { ChatMessage, SessionState, SessionSummary } from "@/types/session";

interface SessionStoreData {
  sessions: Map<string, SessionState>;
}

declare global {
  var __taohuayuanSessionStore: SessionStoreData | undefined;
}

const initialProgress = (): Record<string, boolean> => ({
  imagery: false,
  theme: false,
  endingMeaning: false,
  vocabulary: false,
  structure: false,
});

function getStore(): SessionStoreData {
  if (!globalThis.__taohuayuanSessionStore) {
    globalThis.__taohuayuanSessionStore = { sessions: new Map() };
  }
  return globalThis.__taohuayuanSessionStore;
}

export function getSession(sessionId: string): SessionState | null {
  return getStore().sessions.get(sessionId) ?? null;
}

export function upsertSession(params: {
  sessionId: string;
  lessonId: string;
  sceneId: string;
}): SessionState {
  const { sessionId, lessonId, sceneId } = params;
  const store = getStore().sessions;
  const existing = store.get(sessionId);

  if (existing) {
    existing.currentSceneId = sceneId;
    if (!existing.visitedScenes.includes(sceneId)) {
      existing.visitedScenes.push(sceneId);
    }
    return existing;
  }

  const created: SessionState = {
    sessionId,
    lessonId,
    currentSceneId: sceneId,
    visitedScenes: [sceneId],
    completedTasks: [],
    chatHistory: [],
    askedQuestions: [],
    answeredHints: [],
    interactionAttempts: 0,
    guidedAdvances: 0,
    lineProgress: [],
    knowledgeProgress: initialProgress(),
  };
  store.set(sessionId, created);
  return created;
}

export function recordChat(params: {
  sessionId: string;
  userMessage: string;
  assistantReply: string;
  npcId: string;
}): SessionState | null {
  const session = getSession(params.sessionId);
  if (!session) {
    return null;
  }

  const now = new Date().toISOString();
  const userChat: ChatMessage = {
    id: `u_${Date.now().toString(36)}`,
    role: "user",
    npcId: params.npcId,
    content: params.userMessage,
    createdAt: now,
  };
  const assistantChat: ChatMessage = {
    id: `a_${(Date.now() + 1).toString(36)}`,
    role: "assistant",
    npcId: params.npcId,
    content: params.assistantReply,
    createdAt: now,
  };

  session.chatHistory.push(userChat, assistantChat);
  session.askedQuestions.push(params.userMessage);
  return session;
}

export function markTaskCompleted(params: {
  sessionId: string;
  taskId: string;
}): SessionState | null {
  const session = getSession(params.sessionId);
  if (!session) {
    return null;
  }

  if (!session.completedTasks.includes(params.taskId)) {
    session.completedTasks.push(params.taskId);
  }
  return session;
}

export function addKnowledgeTags(params: {
  sessionId: string;
  tags: string[];
}): SessionState | null {
  const session = getSession(params.sessionId);
  if (!session) {
    return null;
  }

  for (const tag of params.tags) {
    session.knowledgeProgress[tag] = true;
  }
  return session;
}

export function recordInteractionAttempt(params: {
  sessionId: string;
  lineId?: string;
  shouldAdvance: boolean;
  wasGuidedAdvance: boolean;
}): SessionState | null {
  const session = getSession(params.sessionId);
  if (!session) {
    return null;
  }

  session.interactionAttempts += 1;
  if (params.wasGuidedAdvance) {
    session.guidedAdvances += 1;
  }
  if (params.shouldAdvance && params.lineId && !session.lineProgress.includes(params.lineId)) {
    session.lineProgress.push(params.lineId);
  }
  return session;
}

function buildRecommendations(summary: SessionSummary, bundle: LessonBundle): string[] {
  const recommendations: string[] = [];
  const progress = summary.knowledgeProgress;

  if (!progress.imagery) {
    recommendations.push("回到“忽逢桃花林”场景，结合“中无杂树”分析景物描写作用。");
  }
  if (!progress.theme) {
    recommendations.push("继续思考桃源社会与现实社会的对照关系。");
  }
  if (!progress.endingMeaning) {
    recommendations.push("复盘结尾“再寻不得”，尝试解释其象征意义。");
  }
  if (recommendations.length === 0) {
    recommendations.push("尝试用 3 句话概括《桃花源记》的结构与主旨。");
    recommendations.push("挑选一处你最喜欢的句子，说明其表达效果。");
  }
  if (summary.completedTasks.length < 3) {
    recommendations.push("至少再完成 1 个任务，提升学习证据的完整性。");
  }

  if (bundle.lesson.suggestedQuestions.length > 0) {
    recommendations.push(`延伸问题：${bundle.lesson.suggestedQuestions[0]}`);
  }

  return recommendations.slice(0, 4);
}

export function generateSessionSummary(
  sessionId: string,
  bundle: LessonBundle,
): SessionSummary | null {
  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  const questionSummary = session.askedQuestions.slice(-6);
  const unlockedKnowledgeTags = Object.entries(session.knowledgeProgress)
    .filter(([, active]) => active)
    .map(([tag]) => tag);

  const summary: SessionSummary = {
    sessionId: session.sessionId,
    lessonId: session.lessonId,
    exploredScenes: session.visitedScenes,
    completedTasks: session.completedTasks,
    questionSummary,
    interactionAttempts: session.interactionAttempts,
    guidedAdvances: session.guidedAdvances,
    lineProgress: session.lineProgress,
    unlockedKnowledgeTags,
    knowledgeProgress: session.knowledgeProgress,
    recommendations: [],
  };
  summary.recommendations = buildRecommendations(summary, bundle);
  return summary;
}
