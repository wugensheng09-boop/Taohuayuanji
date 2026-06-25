export type InterrogationSpeakerId = "peer_fisher" | "officer";

export interface InterrogationCharacterConfig {
  id: InterrogationSpeakerId;
  name: string;
  role: string;
  portraitImage: string;
  tone: string;
}

export interface InterrogationKeywordGroup {
  label: string;
  terms: string[];
  weight: number;
}

export interface InterrogationTurnConfig {
  id: string;
  act: number;
  speakerId: InterrogationSpeakerId;
  speakerName: string;
  prompt: string;
  pressure: string;
  evidenceLabels: string[];
  leakLabels: string[];
  followup?: string;
}

export interface InterrogationEndingConfig {
  id: "safe" | "thin_escape" | "leaked";
  title: string;
  minCredibility: number;
  maxLeakRisk: number;
  narrative: string;
  advice: string;
}

export interface InterrogationConfig {
  lessonId: string;
  title: string;
  subtitle: string;
  sceneId: string;
  backgroundImage: string;
  startingCredibility: number;
  startingLeakRisk: number;
  minAnswerChars: number;
  characters: InterrogationCharacterConfig[];
  guardedTerms: string[];
  evidencePool: InterrogationKeywordGroup[];
  leakClues: InterrogationKeywordGroup[];
  turns: InterrogationTurnConfig[];
  endings: InterrogationEndingConfig[];
}

export interface InterrogationEvalResult {
  reply: string;
  credibilityDelta: number;
  leakRiskDelta: number;
  matchedEvidence: string[];
  matchedLeakClues: string[];
  stageFeedback: string[];
}
