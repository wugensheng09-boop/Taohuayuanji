import type { KnowledgeBase } from "@/types/lesson";
import type { NpcConfig } from "@/types/npc";
import type { SceneConfig } from "@/types/scene";
import type { SessionState } from "@/types/session";
import type { ChatRequestPayload } from "@/lib/validators";

function compactKnowledge(knowledge: KnowledgeBase): string {
  const annotations = knowledge.annotations
    .slice(0, 8)
    .map((item) => `${item.word}：${item.explanation}`)
    .join("；");
  const themes = knowledge.themes.join("；");
  const examPoints = knowledge.examPoints.join("；");

  return [
    `原文片段：${knowledge.originalText.slice(0, 320)}...`,
    `注释：${annotations}`,
    `主题：${themes}`,
    `考点：${examPoints}`,
  ].join("\n");
}

function baseRolePrompt(params: {
  npc: NpcConfig;
  scene: SceneConfig;
  session: SessionState;
  knowledge: KnowledgeBase;
}): string {
  const { npc, scene, session, knowledge } = params;
  const latestQuestion =
    session.askedQuestions.length > 0 ? session.askedQuestions[session.askedQuestions.length - 1] : "无";

  return `
你正在扮演《桃花源记》中的“${npc.name}”。
角色信息：
- 角色定位：${npc.role}
- 语言风格：${npc.style}
- 知识边界：${npc.boundaries.join("；")}
- 核心职责：${npc.responsibilities.join("；")}

当前场景：
- 场景名：${scene.title}
- 场景描述：${scene.description}
- 学习目标：${scene.learningGoals.join("；")}

会话状态：
- 已访问场景：${session.visitedScenes.join("、")}
- 最近一次用户问题：${latestQuestion}

知识依据（必须以此为准）：
${compactKnowledge(knowledge)}
`.trim();
}

export function buildChatSystemPrompt(params: {
  npc: NpcConfig;
  scene: SceneConfig;
  session: SessionState;
  knowledge: KnowledgeBase;
  mode: ChatRequestPayload["mode"];
  payload: ChatRequestPayload;
}): string {
  const { mode, payload } = params;
  const basePrompt = baseRolePrompt(params);

  if (mode === "roleplay_chat" || mode === "free_ask") {
    return `
${basePrompt}

任务模式：剧情角色对话
规则：
1) 保持古风语境，不说现代网络梗。
2) 回答简洁，20字左右优先。
3) 只回答，不反问（除非用户明确要求你追问）。
4) 仅输出 JSON：
{
  "reply": "角色回复",
  "suggestedActions": ["建议1", "建议2"],
  "knowledgeTags": ["imagery|theme|endingMeaning|vocabulary|structure"],
  "roleSafetyFlags": []
}
`.trim();
  }

  if (mode === "leak_eval") {
    return `
${basePrompt}

任务模式：泄密风险评估 + 角色回复
判定依据：
- 敏感词：${(payload.sensitiveKeywords ?? []).join("、") || "无"}
- 路径线索词：${(payload.routeKeywords ?? []).join("、") || "无"}
- 可复现线索词：${(payload.reproducibleClueKeywords ?? []).join("、") || "无"}

规则：
1) 先给角色回复，再给风险评估。
2) leakRiskLevel 只能是 low/mid/high。
3) leakRiskScore 范围 0~1。
4) stageFeedback 语气要鼓励、克制。
5) 仅输出 JSON：
{
  "reply": "角色回复",
  "leakRiskLevel": "low|mid|high",
  "leakRiskScore": 0.0,
  "stageFeedback": ["反馈1", "反馈2"],
  "roleSafetyFlags": []
}
`.trim();
  }

  return `
${basePrompt}

任务模式：课后测评（主观/选择）
题目：${payload.question ?? "未提供题目"}
题型：${payload.questionType ?? "open"}
参考要点：${(payload.referencePoints ?? []).join("、") || "无"}
阶段提示：${(payload.stageFeedbackHints ?? []).join("、") || "无"}
选择题标准答案：${(payload.correctOptions ?? []).join("、") || "未提供"}

规则：
1) reply 先给一句角色口吻反馈（不超过120字）。
2) rubric 四个分数都用 0~100 整数。
3) 仅输出 JSON：
{
  "reply": "角色反馈",
  "quizRubricResult": {
    "textualGrounding": 0,
    "understanding": 0,
    "expression": 0,
    "score": 0,
    "matchedPoints": ["命中点"],
    "missedPoints": ["缺失点"]
  },
  "stageFeedback": ["阶段反馈1", "阶段反馈2"],
  "dimensionNotes": ["维度说明"]
}
`.trim();
}

export function buildChatUserPrompt(params: {
  message: string;
  mode: ChatRequestPayload["mode"];
  payload: ChatRequestPayload;
}): string {
  const { message, mode, payload } = params;
  if (mode === "quiz_eval") {
    return `用户作答：${message}\n题目：${payload.question ?? "无"}`;
  }
  if (mode === "leak_eval") {
    return `同业渔人打听时，用户回答：${message}`;
  }
  if (mode === "roleplay_chat") {
    return `剧情对话里，用户发言：${message}`;
  }
  return `用户提问：${message}`;
}

