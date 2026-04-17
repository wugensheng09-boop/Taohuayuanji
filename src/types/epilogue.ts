export type EpilogueQuestionType = "open" | "choice";
export type PeerChoiceId = "A" | "B" | "C";
export type QuizLevel = "甲" | "乙" | "丙" | "待提升";

export interface PostStoryNpcConfig {
  npcId: string;
  name: string;
  role: string;
  portraitImage: string;
  dialogSide?: "left" | "right";
  style: string;
  boundaries: string[];
  openingLine: string;
  promptHint: string;
  responseLengthHint?: string;
}

export interface PeerFlowOption {
  id: PeerChoiceId;
  text: string;
  leakScore: number;
}

export interface PeerRound1Config {
  openerLines: string[];
  options: PeerFlowOption[];
}

export interface PeerRound2Config {
  prompts: Record<PeerChoiceId, string>;
}

export interface PeerRound3Config {
  question: string;
}

export interface PeerRound4Config {
  question: string;
  options: PeerFlowOption[];
}

export interface PeerRound5Config {
  endings: Record<PeerChoiceId, string>;
  finalFeedbackByLevel?: Record<QuizLevel, string>;
}

export interface PeerReplyConstraintConfig {
  maxChars: number;
  forbidQuestions: boolean;
}

export interface PeerFisherFlowConfig {
  round1: PeerRound1Config;
  round2: PeerRound2Config;
  round3: PeerRound3Config;
  round4: PeerRound4Config;
  round5: PeerRound5Config;
  replyConstraints: PeerReplyConstraintConfig;
}

export interface QuizQuestionConfig {
  id: string;
  npcId: string;
  type: EpilogueQuestionType;
  question: string;
  options?: string[];
  correctOptions?: string[];
  referencePoints: string[];
  stageFeedbackHints: string[];
}

export interface LeakBranchConfig {
  sensitiveKeywords: string[];
  routeKeywords: string[];
  reproducibleClueKeywords: string[];
  highRiskThreshold: number;
  narratives: {
    high: string;
    low: string;
  };
}

export interface EpilogueConfig {
  lessonId: string;
  npcOrder: string[];
  npcs: PostStoryNpcConfig[];
  peerFisherFlow: PeerFisherFlowConfig;
  fisherGossipPrompt: string;
  quizIntro: string;
  quizQuestions: QuizQuestionConfig[];
  encouragementStages: string[];
  leakBranch: LeakBranchConfig;
}
