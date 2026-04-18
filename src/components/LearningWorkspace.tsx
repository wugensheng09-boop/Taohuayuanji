"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { QuizRubricResult } from "@/lib/ai";
import type { PeerChoiceId, PeerFisherFlowConfig, PostStoryNpcConfig } from "@/types/epilogue";
import type { LessonBundle } from "@/types/lesson";
import type { NpcConfig } from "@/types/npc";
import type { SceneConfig } from "@/types/scene";
import type { SessionSummary } from "@/types/session";

type IntroState = "playing" | "blocked" | "ready";
type LeakRisk = "low" | "mid" | "high";
type NpcPhase = "aqiao" | "chief" | "peer_round1" | "peer_round2" | "peer_round3" | "peer_round4" | "peer_done";
type TurnTone = "npc" | "user" | "narration";
type TurnSide = "left" | "right";
type VoiceGateStatus = "idle" | "pending" | "playing" | "done" | "missing";

type TtsPacket = {
  audioBase64: string;
  mimeType: string;
  syncWeights: number[];
  voiceProfile: string;
  playbackRate?: number;
};

type ChatRes = {
  reply?: string;
  error?: string;
  knowledgeTags?: string[];
  leakRiskLevel?: LeakRisk;
  leakRiskScore?: number;
  quizRubricResult?: QuizRubricResult;
  stageFeedback?: string[];
  tts?: TtsPacket | null;
};

type Turn = {
  id: string;
  speaker: string;
  text: string;
  tone: TurnTone;
  side: TurnSide;
  portraitImage?: string;
};

type Jump = {
  nextSceneId: string;
  choices: [string, string];
};

type NpcSpeechTask = {
  turnId: string;
  fullText: string;
  tts: TtsPacket;
};

const INTRO_VIDEO = "/videos/taohuayuanji/封面视频.mp4";
const DEFAULT_BGM = 0.17;
const DEFAULT_AMBIENT_PRIMARY = 0.24;
const DEFAULT_AMBIENT_SECONDARY = 0.16;
const VOICE_MIN_GAP_MS = 320;
const VOICE_PENDING_TIMEOUT_MS = 4200;
const NPC_SPEECH_FALLBACK_MS = 2200;
const NPC_SPEECH_MAX_BLOCK_MS = 12000;
const CHAT_REQUEST_TIMEOUT_MS = 20000;
const TYPE_CHAR_BASE_MS = 62;
const TYPE_PUNCT_DELAY_MS = 200;
const NARRATION_MIN_MS = 2800;
const NARRATION_MAX_MS = 15000;
const NARRATION_CHAR_MS = 240;
const SCENE_JUMP_AUTO_MS = 6800;
const PEER_FISHER_BACKGROUND = "/assets/taohuayuanji/同业渔民询问.png";
const SPACE_SKIP_NO_API = process.env.NEXT_PUBLIC_SPACE_SKIP_NO_API === "1";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2, 8)}_${Date.now().toString(36)}`;
}

function levelFromScore(score: number): "甲" | "乙" | "丙" | "待提升" {
  if (score >= 85) return "甲";
  if (score >= 70) return "乙";
  if (score >= 55) return "丙";
  return "待提升";
}

function estimateNarrationMs(text: string): number {
  const cleanLength = text.replace(/\s+/g, "").length;
  return Math.max(NARRATION_MIN_MS, Math.min(NARRATION_MAX_MS, cleanLength * NARRATION_CHAR_MS));
}

function clampChars(input: string, maxChars: number): string {
  const chars = Array.from(input.trim());
  return chars.slice(0, Math.max(1, maxChars)).join("");
}

function normalizeShortReply(reply: string, maxChars: number, forbidQuestions: boolean): string {
  const noQuestion = forbidQuestions ? reply.replace(/[？?]/g, "").trim() : reply.trim();
  const normalized = clampChars(noQuestion || "记下了。", maxChars);
  return normalized.length > 0 ? normalized : "记下了。";
}

function buildCharTimingsMs(text: string, syncWeights: number[] | undefined, totalMs: number): number[] {
  const chars = Array.from(text);
  if (chars.length === 0) return [];

  const rawWeights =
    syncWeights && syncWeights.length === chars.length
      ? syncWeights
      : chars.map((ch) => {
          if (/\s/.test(ch)) return 0.08;
          if (/[，,]/.test(ch)) return 0.75;
          if (/[。！？!?；;：:]/.test(ch)) return 1.15;
          if (/[、“”"（）()《》【】…—]/.test(ch)) return 0.45;
          return 1;
        });

  const safeTotal = Math.max(360, totalMs);
  const sum = rawWeights.reduce((acc, n) => acc + Math.max(0.01, n), 0);
  let cum = 0;
  return rawWeights.map((weight) => {
    cum += (Math.max(0.01, weight) / sum) * safeTotal;
    return Math.round(cum);
  });
}

function lineSpeaker(line: SceneConfig["timeline"][number] | null, npcMap: Record<string, NpcConfig>): string {
  if (!line) return "旁白";
  if (line.voiceTrack === "inner") return "主角心声";
  if (line.voiceTrack === "scene") return "场景旁白";
  if (line.voiceTrack === "quote") return "课文原句";
  if (line.speakerMode === "npc" && line.npcId) {
    return npcMap[line.npcId]?.name ?? "角色";
  }
  return "旁白";
}

function interactionToNpc(interactionKey: string): { npcId: string; phase: NpcPhase } | null {
  switch (interactionKey) {
    case "aqiao_gate":
      return { npcId: "aqiao", phase: "aqiao" };
    case "chief_dialogue":
      return { npcId: "chief", phase: "chief" };
    case "peer_fisher_chain":
      return { npcId: "peer_fisher", phase: "peer_round1" };
    default:
      return null;
  }
}

function getPresetReplies(npcId: string | null, phase: NpcPhase | null): string[] {
  if (npcId === "aqiao" && phase === "aqiao") {
    return [
      "我误入此地，并无恶意。",
      "我循溪而来，也不知到了哪里。",
      "我只是个捕鱼人。",
    ];
  }
  if (npcId === "chief" && phase === "chief") {
    return [
      "今世早非秦汉，朝代已多更替。",
      "村中和乐安宁，确似世外之境。",
      "外界多有纷扰，此地难得清平。",
    ];
  }
  if (npcId === "peer_fisher" && phase === "peer_round2") {
    return [
      "屋舍整齐，田园阡陌相通。",
      "老少怡然，与外世久绝。",
      "所见恍若梦境，难以尽述。",
    ];
  }
  if (npcId === "peer_fisher" && phase === "peer_round3") {
    return [
      "临别叮嘱：不足为外人道。",
      "他们只愿安居，不愿外人扰。",
      "再三嘱咐我莫泄其踪。",
    ];
  }
  return [];
}

type ChoiceCardCopy = { title: string; detail: string };

function toPeerChoiceCard(round: "round1" | "round4", optionId: PeerChoiceId, fallbackText: string): ChoiceCardCopy {
  if (round === "round1") {
    if (optionId === "A") {
      return { title: "A 并无稀奇。", detail: "我只是顺溪迷路，捕鱼无获。" };
    }
    if (optionId === "B") {
      return { title: "B 真有奇遇。", detail: "我确实见到世外桃源，景象非凡。" };
    }
    return { title: "C 略见异景。", detail: "见到罕见光景，但不便尽言细节。" };
  }

  if (optionId === "A") {
    return { title: "A 不该。", detail: "他们既托我守口，我不能失信。" };
  }
  if (optionId === "B") {
    return { title: "B 只说其奇。", detail: "只提见闻，不泄路径所在。" };
  }
  if (optionId === "C") {
    return { title: "C 该。", detail: "如此异事，应当上报太守。" };
  }

  return { title: fallbackText, detail: "" };
}

export function LearningWorkspace({ bundle }: { bundle: LessonBundle }) {
  const lessonId = bundle.lesson.lessonId;
  const sceneMap = useMemo(() => Object.fromEntries(bundle.scenes.map((s) => [s.sceneId, s])), [bundle.scenes]);
  const npcMap = useMemo(() => Object.fromEntries(bundle.npcs.map((n) => [n.npcId, n])), [bundle.npcs]);
  const epilogueNpcMap = useMemo(
    () => Object.fromEntries(bundle.epilogue.npcs.map((n) => [n.npcId, n])),
    [bundle.epilogue.npcs],
  );

  const [sessionId, setSessionId] = useState(() => {
    if (typeof window === "undefined") return uid("s");
    const key = `tyy:session:${bundle.lesson.lessonId}`;
    const existing = window.localStorage.getItem(key);
    return existing && existing.trim().length > 0 ? existing : uid("s");
  });

  const [introVisible, setIntroVisible] = useState(true);
  const [introState, setIntroState] = useState<IntroState>("playing");
  const [paused, setPaused] = useState(false);
  const [sceneId, setSceneId] = useState(bundle.lesson.entrySceneId);
  const [lineIdx, setLineIdx] = useState(0);
  const [typed, setTyped] = useState(0);
  const [jump, setJump] = useState<Jump | null>(null);
  const [visited, setVisited] = useState<string[]>([bundle.lesson.entrySceneId]);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [npcSpeechQueue, setNpcSpeechQueue] = useState<NpcSpeechTask[]>([]);
  const [activeSpeechTurnId, setActiveSpeechTurnId] = useState<string | null>(null);
  const [npcInput, setNpcInput] = useState("");
  const [manualInputOpen, setManualInputOpen] = useState(false);
  const [selectedRound1Option, setSelectedRound1Option] = useState<PeerChoiceId | null>(null);
  const [selectedRound4Option, setSelectedRound4Option] = useState<PeerChoiceId | null>(null);
  const [selectedPresetReply, setSelectedPresetReply] = useState<string | null>(null);
  const [pendingUserMessage, setPendingUserMessage] = useState("");
  const [npcBusy, setNpcBusy] = useState(false);
  const [activeNpcId, setActiveNpcId] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState<NpcPhase | null>(null);
  const [canContinue, setCanContinue] = useState(false);
  const [leakScore, setLeakScore] = useState(0);
  const [finalLevel, setFinalLevel] = useState<"甲" | "乙" | "丙" | "待提升" | null>(null);
  const [finalNarrative, setFinalNarrative] = useState("");

  const [videoEndedByScene, setVideoEndedByScene] = useState<Record<string, boolean>>({});
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceGateStatus, setVoiceGateStatus] = useState<VoiceGateStatus>("idle");
  const [lineGateKey, setLineGateKey] = useState("");
  const [lineGateReadyAt, setLineGateReadyAt] = useState(0);
  const [lineFallbackReadyAt, setLineFallbackReadyAt] = useState(0);

  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const introVideoRef = useRef<HTMLVideoElement | null>(null);
  const sceneVideoRef = useRef<HTMLVideoElement | null>(null);
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedInteractionsRef = useRef<Set<string>>(new Set());

  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const ambientPrimaryRef = useRef<HTMLAudioElement | null>(null);
  const ambientSecondaryRef = useRef<HTMLAudioElement | null>(null);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const npcSpeechRef = useRef<HTMLAudioElement | null>(null);
  const fadeJobsRef = useRef<Record<string, number | undefined>>({});
  const voiceTicketRef = useRef(0);
  const baseMixRef = useRef({
    bgm: DEFAULT_BGM,
    ambientPrimary: DEFAULT_AMBIENT_PRIMARY,
    ambientSecondary: DEFAULT_AMBIENT_SECONDARY,
  });

  const scene = sceneMap[sceneId] ?? bundle.scenes[0];
  const line = scene.timeline[lineIdx] ?? null;
  const typing = Boolean(line && typed < line.text.length);
  const lineText = line ? line.text.slice(0, typed) : "";

  const lineBackground = line?.id ? scene.lineBackgroundOverrides?.[line.id] : undefined;
  const sceneVideoEnded = videoEndedByScene[sceneId] ?? false;
  const backdrop =
    sceneVideoEnded && scene.videoFallbackImage
      ? scene.videoFallbackImage
      : lineBackground ?? scene.backgroundImage;

  const videoStartIdx = scene.videoStartLineId
    ? Math.max(0, scene.timeline.findIndex((item) => item.id === scene.videoStartLineId))
    : 0;
  const showSceneVideo =
    !introVisible &&
    Boolean(scene.backgroundVideo) &&
    lineIdx >= videoStartIdx &&
    (scene.videoMode !== "play_once_then_image" || !sceneVideoEnded);
  const oneShotVideoPlaying = showSceneVideo && scene.videoMode === "play_once_then_image";

  const interactionActive = Boolean(activePhase && activeNpcId);
  const storyAuto = !introVisible && !paused && !jump && !interactionActive && !done;
  const currentSpeaker = lineSpeaker(line, npcMap);
  const currentLineKey = line ? `${sceneId}:${line.id}` : "";

  const peerFlow: PeerFisherFlowConfig = bundle.epilogue.peerFisherFlow;
  const activeNpc: PostStoryNpcConfig | null = activeNpcId ? epilogueNpcMap[activeNpcId] ?? null : null;
  const isPeerFisherInteraction = activeNpc?.npcId === "peer_fisher";
  const displayBackdrop = interactionActive && isPeerFisherInteraction ? PEER_FISHER_BACKGROUND : backdrop;

  const addTurn = useCallback(
    (speaker: string, text: string, tone: TurnTone, portraitImage?: string, side?: TurnSide, tts?: TtsPacket | null) => {
      const turnSide = side ?? (tone === "user" ? "right" : "left");
      const turnId = uid("t");
      if (tone === "npc" && tts?.audioBase64) {
        setTurns((prev) => [...prev, { id: turnId, speaker, text: "", tone, side: turnSide, portraitImage }]);
        setNpcSpeechQueue((prev) => [...prev, { turnId, fullText: text, tts }]);
        return;
      }
      setTurns((prev) => [...prev, { id: turnId, speaker, text, tone, side: turnSide, portraitImage }]);
    },
    [],
  );

  const getNpcSide = useCallback((npc: PostStoryNpcConfig | null): TurnSide => {
    return npc?.dialogSide ?? "left";
  }, []);

  const clearNpcState = useCallback(() => {
    setTurns([]);
    setNpcSpeechQueue([]);
    setActiveSpeechTurnId(null);
    const speech = npcSpeechRef.current;
    if (speech) {
      speech.pause();
      speech.currentTime = 0;
      speech.removeAttribute("src");
      speech.load();
    }
    setNpcInput("");
    setManualInputOpen(false);
    setSelectedRound1Option(null);
    setSelectedRound4Option(null);
    setSelectedPresetReply(null);
    setPendingUserMessage("");
    setNpcBusy(false);
    setActiveNpcId(null);
    setActivePhase(null);
    setCanContinue(false);
    setLeakScore(0);
    setFinalLevel(null);
    setFinalNarrative("");
  }, []);

  const fadeTo = useCallback((channel: string, audio: HTMLAudioElement | null, target: number, durationMs = 420) => {
    if (!audio) return;
    const goal = Math.max(0, Math.min(1, target));

    const currentJob = fadeJobsRef.current[channel];
    if (currentJob) {
      window.clearInterval(currentJob);
      fadeJobsRef.current[channel] = undefined;
    }

    if (durationMs <= 0) {
      audio.volume = goal;
      if (goal <= 0.001) {
        audio.pause();
      } else if (audio.paused) {
        void audio.play().catch(() => {});
      }
      return;
    }

    if (!audio.paused || goal > 0.001) {
      void audio.play().catch(() => {});
    }

    const start = audio.volume;
    const steps = 12;
    let step = 0;
    const id = window.setInterval(() => {
      step += 1;
      const next = start + (goal - start) * (step / steps);
      audio.volume = Math.max(0, Math.min(1, next));
      if (step >= steps) {
        window.clearInterval(id);
        fadeJobsRef.current[channel] = undefined;
        audio.volume = goal;
        if (goal <= 0.001) {
          audio.pause();
        }
      }
    }, Math.max(16, Math.floor(durationMs / steps)));

    fadeJobsRef.current[channel] = id;
  }, []);

  const configureLoopTrack = useCallback(
    (audio: HTMLAudioElement | null, channel: string, src: string | undefined, baseVolume: number) => {
      if (!audio) return;
      if (!src) {
        fadeTo(channel, audio, 0, 260);
        return;
      }

      if (audio.dataset.trackSrc !== src) {
        audio.dataset.trackSrc = src;
        audio.src = src;
        audio.load();
      }
      audio.loop = true;
      audio.volume = Math.min(audio.volume, Math.max(0, Math.min(1, baseVolume * 0.4)));
      void audio.play().catch(() => {});
    },
    [fadeTo],
  );

  const callChat = useCallback(async (payload: Record<string, unknown>) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CHAT_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const data = (await response.json()) as ChatRes;
      if (!response.ok || !data.reply) {
        throw new Error(data.error ?? "chat failed");
      }
      return data;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("chat-timeout");
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  const stopVoice = useCallback(() => {
    const voice = voiceRef.current;
    if (!voice) return;
    voice.pause();
    voice.currentTime = 0;
    setVoiceActive(false);
  }, []);

  const tryResolveVoiceSrc = useCallback(async (voiceId: string): Promise<string | null> => {
    const base = `/audio/taohuayuanji/voice/${voiceId}`;
    const candidates = [`${base}.wav`, `${base}.WAV`, `${base}.mp3`, `${base}.MP3`];
    for (const src of candidates) {
      try {
        const r = await fetch(src, { method: "HEAD", cache: "no-store" });
        if (r.ok) return src;
      } catch {
        // keep trying candidates
      }
    }
    return null;
  }, []);

  const evaluateLeakSilently = useCallback(
    async (message: string) => {
      try {
        const evalRes = await callChat({
          sessionId,
          lessonId,
          sceneId,
          npcId: "peer_fisher",
          mode: "leak_eval",
          message,
          sensitiveKeywords: bundle.epilogue.leakBranch.sensitiveKeywords,
          routeKeywords: bundle.epilogue.leakBranch.routeKeywords,
          reproducibleClueKeywords: bundle.epilogue.leakBranch.reproducibleClueKeywords,
          highRiskThreshold: bundle.epilogue.leakBranch.highRiskThreshold,
        });
        return evalRes.leakRiskScore ?? 0;
      } catch {
        const text = message.trim();
        const hitSensitive = bundle.epilogue.leakBranch.sensitiveKeywords.filter((k) => text.includes(k)).length;
        const hitRoute = bundle.epilogue.leakBranch.routeKeywords.filter((k) => text.includes(k)).length;
        const hitReproducible = bundle.epilogue.leakBranch.reproducibleClueKeywords.filter((k) => text.includes(k)).length;
        return Math.min(1, hitSensitive * 0.12 + hitRoute * 0.2 + hitReproducible * 0.24);
      }
    },
    [
      bundle.epilogue.leakBranch.highRiskThreshold,
      bundle.epilogue.leakBranch.reproducibleClueKeywords,
      bundle.epilogue.leakBranch.routeKeywords,
      bundle.epilogue.leakBranch.sensitiveKeywords,
      callChat,
      lessonId,
      sceneId,
      sessionId,
    ],
  );

  useEffect(() => {
    if (activeSpeechTurnId || npcSpeechQueue.length === 0) return;

    const audio = npcSpeechRef.current;
    const task = npcSpeechQueue[0];
    if (!task) return;

    if (!audio) {
      setTurns((prev) => prev.map((turn) => (turn.id === task.turnId ? { ...turn, text: task.fullText } : turn)));
      setNpcSpeechQueue((prev) => prev.slice(1));
      return;
    }

    setActiveSpeechTurnId(task.turnId);
    setVoiceActive(true);

    let cancelled = false;
    let lastCharCount = -1;
    let charTimings: number[] = [];
    let playbackStarted = false;
    const fallbackRevealTimer =
      window.setTimeout(() => {
        if (!playbackStarted) {
          finalize();
        }
      }, NPC_SPEECH_FALLBACK_MS);
    let watchdogTimer: number | undefined;

    const updateTurnText = (charCount: number) => {
      if (charCount === lastCharCount) return;
      lastCharCount = charCount;
      const nextText = Array.from(task.fullText).slice(0, charCount).join("");
      setTurns((prev) => prev.map((turn) => (turn.id === task.turnId ? { ...turn, text: nextText } : turn)));
    };

    const finalize = () => {
      if (cancelled) return;
      if (fallbackRevealTimer) {
        window.clearTimeout(fallbackRevealTimer);
      }
      if (watchdogTimer) {
        window.clearTimeout(watchdogTimer);
      }
      updateTurnText(Array.from(task.fullText).length);
      setNpcSpeechQueue((prev) => prev.slice(1));
      setActiveSpeechTurnId(null);
      setVoiceActive(false);
    };

    const onLoadedMetadata = () => {
      const rawDurationMs =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? Math.round(audio.duration * 1000)
          : estimateNarrationMs(task.fullText);
      const maxReasonableMs = Math.max(9000, estimateNarrationMs(task.fullText) * 2);
      const durationMs =
        rawDurationMs > maxReasonableMs || rawDurationMs < 280 ? estimateNarrationMs(task.fullText) : rawDurationMs;
      charTimings = buildCharTimingsMs(task.fullText, task.tts.syncWeights, durationMs);
      if (watchdogTimer) {
        window.clearTimeout(watchdogTimer);
      }
      watchdogTimer = window.setTimeout(finalize, Math.min(NPC_SPEECH_MAX_BLOCK_MS, durationMs + 1800));
    };

    const onTimeUpdate = () => {
      if (cancelled || charTimings.length === 0) return;
      playbackStarted = true;
      const nowMs = audio.currentTime * 1000;
      let charCount = charTimings.findIndex((ms) => ms > nowMs);
      if (charCount < 0) charCount = charTimings.length;
      updateTurnText(charCount);
    };

    const onEnded = () => finalize();
    const onError = () => finalize();
    const onStalled = () => finalize();

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("stalled", onStalled);
    audio.addEventListener("abort", onStalled);
    audio.addEventListener("suspend", onStalled);

    audio.src = `data:${task.tts.mimeType};base64,${task.tts.audioBase64}`;
    audio.currentTime = 0;
    audio.playbackRate = task.tts.playbackRate ?? 0.9;
    audio.load();
    watchdogTimer = window.setTimeout(finalize, NPC_SPEECH_MAX_BLOCK_MS);
    void audio.play().catch(() => finalize());

    return () => {
      cancelled = true;
      if (fallbackRevealTimer) {
        window.clearTimeout(fallbackRevealTimer);
      }
      if (watchdogTimer) {
        window.clearTimeout(watchdogTimer);
      }
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("stalled", onStalled);
      audio.removeEventListener("abort", onStalled);
      audio.removeEventListener("suspend", onStalled);
    };
  }, [activeSpeechTurnId, npcSpeechQueue]);

  const advance = useCallback(() => {
    if (!line) return;

    if (lineIdx + 1 < scene.timeline.length) {
      setLineIdx((prev) => prev + 1);
      setTyped(0);
      return;
    }

    if (scene.nextSceneId) {
      const choices = scene.transitionChoices ?? [scene.transitionActionLabel ?? "继续前行", "继续前行"];
      setJump({
        nextSceneId: scene.nextSceneId,
        choices: [choices[0] ?? "继续前行", choices[1] ?? "继续前行"],
      });
      return;
    }

    setSummaryLoading(true);
    fetch(`/api/session/${sessionId}/summary`)
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as SessionSummary;
      })
      .then((result) => {
        if (result) setSummary(result);
      })
      .catch(() => {})
      .finally(() => {
        setSummaryLoading(false);
        setDone(true);
      });
  }, [line, lineIdx, scene, sessionId]);

  const moveScene = useCallback((nextSceneId: string) => {
    setJump(null);
    setSceneId(nextSceneId);
    setLineIdx(0);
    setTyped(0);
    setVoiceGateStatus("idle");
    setLineGateKey("");
    setLineGateReadyAt(0);
    setLineFallbackReadyAt(0);
    setPaused(false);
    setVideoEndedByScene((prev) => ({ ...prev, [nextSceneId]: false }));
    setVisited((prev) => (prev.includes(nextSceneId) ? prev : [...prev, nextSceneId]));
  }, []);

  const resetAll = useCallback(() => {
    const newSessionId = uid("s");
    window.localStorage.setItem(`tyy:session:${lessonId}`, newSessionId);
    setSessionId(newSessionId);
    setIntroVisible(true);
    setIntroState("playing");
    setPaused(false);
    setSceneId(bundle.lesson.entrySceneId);
    setLineIdx(0);
    setTyped(0);
    setJump(null);
    setVisited([bundle.lesson.entrySceneId]);
    setVideoEndedByScene({});
    setVoiceGateStatus("idle");
    setLineGateKey("");
    setLineGateReadyAt(0);
    setLineFallbackReadyAt(0);
    setDone(false);
    setSummary(null);
    setSummaryLoading(false);
    openedInteractionsRef.current.clear();
    clearNpcState();
    stopVoice();
  }, [bundle.lesson.entrySceneId, clearNpcState, lessonId, stopVoice]);

  const goHome = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.assign("/");
    }
  }, []);

  const closeNpcAndContinue = useCallback(() => {
    clearNpcState();
    setTimeout(() => advance(), 80);
  }, [advance, clearNpcState]);

  const skipInteractionBySpace = useCallback(() => {
    clearNpcState();
    setTimeout(() => advance(), 40);
  }, [advance, clearNpcState]);

  const openNpcInteraction = useCallback(
    (interactionKey: string) => {
      const mapped = interactionToNpc(interactionKey);
      if (!mapped) return;

      const npc = epilogueNpcMap[mapped.npcId];
      if (!npc) return;

      setActiveNpcId(mapped.npcId);
      setActivePhase(mapped.phase);
      setCanContinue(false);
      setNpcInput("");
      setManualInputOpen(false);
      setSelectedRound1Option(null);
      setSelectedRound4Option(null);
      setSelectedPresetReply(null);

      setTurns(() => {
        const npcSide = getNpcSide(npc);
        if (mapped.phase === "peer_round1") {
          return peerFlow.round1.openerLines.map((text) => ({
            id: uid("t"),
            speaker: npc.name,
            text,
            tone: "npc",
            side: npcSide,
            portraitImage: npc.portraitImage,
          }));
        }
        return [
          {
            id: uid("t"),
            speaker: npc.name,
            text: npc.openingLine,
            tone: "npc",
            side: npcSide,
            portraitImage: npc.portraitImage,
          },
        ];
      });
    },
    [epilogueNpcMap, getNpcSide, peerFlow.round1.openerLines],
  );

  const submitRoleplay = useCallback(async (presetMessage?: string) => {
    if (!activeNpc || !activePhase || (activePhase !== "aqiao" && activePhase !== "chief")) return;
    const message = (presetMessage ?? npcInput).trim();
    if (!message || npcBusy) return;

    setNpcBusy(true);
    setCanContinue(false);
    setSelectedPresetReply(presetMessage ?? null);
    setPendingUserMessage(message);
    addTurn("我", message, "user");
    setNpcInput("");
    setManualInputOpen(false);

    try {
      const data = await callChat({
        sessionId,
        lessonId,
        sceneId,
        npcId: activeNpc.npcId,
        mode: "roleplay_chat",
        message,
        lineId: line?.id,
      });

      addTurn(activeNpc.name, data.reply ?? "我听见了。", "npc", activeNpc.portraitImage, getNpcSide(activeNpc), data.tts);
      if (!canContinue) {
        if (activePhase === "aqiao") {
          addTurn("旁白", "阿樵神色稍缓，似乎愿意再听你多说几句。", "narration");
        } else {
          addTurn("旁白", "族长含笑颔首，示意你不妨再细说。", "narration");
        }
      }
      setCanContinue(true);
    } catch {
      addTurn(activeNpc.name, "我一时没听清，你再慢慢说一遍。", "npc", activeNpc.portraitImage, getNpcSide(activeNpc));
    } finally {
      setPendingUserMessage("");
      setSelectedPresetReply(null);
      setNpcBusy(false);
    }
  }, [activeNpc, activePhase, addTurn, callChat, canContinue, getNpcSide, lessonId, line?.id, npcBusy, npcInput, sceneId, sessionId]);

  const submitPeerRound1Choice = useCallback(
    (choiceId: PeerChoiceId) => {
      const npc = epilogueNpcMap.peer_fisher;
      if (!npc || activePhase !== "peer_round1" || npcBusy) return;
      const option = peerFlow.round1.options.find((item) => item.id === choiceId);
      if (!option) return;

      addTurn("我", `${choiceId}. ${option.text}`, "user");
      const nextScore = leakScore + option.leakScore;
      setLeakScore(nextScore);
      setCanContinue(false);
      setManualInputOpen(false);
      setSelectedRound1Option(null);

      addTurn(npc.name, peerFlow.round2.prompts[choiceId], "npc", npc.portraitImage, getNpcSide(npc));
      setActivePhase("peer_round2");
    },
    [activePhase, addTurn, epilogueNpcMap.peer_fisher, getNpcSide, leakScore, npcBusy, peerFlow.round1.options, peerFlow.round2.prompts],
  );

  const submitPeerOpenRound = useCallback(async (presetMessage?: string) => {
    const npc = epilogueNpcMap.peer_fisher;
    if (!npc || (activePhase !== "peer_round2" && activePhase !== "peer_round3") || npcBusy) return;
    const message = (presetMessage ?? npcInput).trim();
    if (!message) return;
    const latestNpcPrompt = [...turns].reverse().find((item) => item.tone === "npc")?.text;

    setNpcBusy(true);
    setSelectedPresetReply(presetMessage ?? null);
    setPendingUserMessage(message);
    addTurn("我", message, "user");
    setNpcInput("");
    setManualInputOpen(false);

    try {
      const roleplay = await callChat({
        sessionId,
        lessonId,
        sceneId,
        npcId: npc.npcId,
        mode: "roleplay_chat",
        message,
        question: latestNpcPrompt,
        lineId: line?.id,
      });

      const shortReply = normalizeShortReply(
        roleplay.reply ?? "我记下了。",
        peerFlow.replyConstraints.maxChars,
        peerFlow.replyConstraints.forbidQuestions,
      );
      const ttsForShortReply = roleplay.reply?.trim() === shortReply.trim() ? roleplay.tts : null;
      addTurn(npc.name, shortReply, "npc", npc.portraitImage, getNpcSide(npc), ttsForShortReply);
    } catch {
      addTurn(npc.name, "我记下了。", "npc", npc.portraitImage, getNpcSide(npc));
    }

    const leakEvalScore = await evaluateLeakSilently(message);
    const nextScore = leakScore + leakEvalScore;
    setLeakScore(nextScore);

    if (activePhase === "peer_round2") {
      addTurn(npc.name, peerFlow.round3.question, "npc", npc.portraitImage, getNpcSide(npc));
      setActivePhase("peer_round3");
    } else {
      addTurn(npc.name, peerFlow.round4.question, "npc", npc.portraitImage, getNpcSide(npc));
      setActivePhase("peer_round4");
    }
    setPendingUserMessage("");
    setSelectedPresetReply(null);
    setNpcBusy(false);
  }, [
    activePhase,
    addTurn,
    callChat,
    epilogueNpcMap.peer_fisher,
    evaluateLeakSilently,
    getNpcSide,
    leakScore,
    lessonId,
    line?.id,
    npcBusy,
    npcInput,
    peerFlow.replyConstraints.forbidQuestions,
    peerFlow.replyConstraints.maxChars,
    peerFlow.round3.question,
    peerFlow.round4.question,
    sceneId,
    sessionId,
    turns,
  ]);

  const submitPeerRound4Choice = useCallback(
    (choiceId: PeerChoiceId) => {
      const npc = epilogueNpcMap.peer_fisher;
      if (!npc || activePhase !== "peer_round4" || npcBusy) return;
      const option = peerFlow.round4.options.find((item) => item.id === choiceId);
      if (!option) return;

      addTurn("我", `${choiceId}. ${option.text}`, "user");

      const nextScore = leakScore + option.leakScore;
      setLeakScore(nextScore);

      const endingText = peerFlow.round5.endings[choiceId];
      setFinalNarrative(endingText);

      const finalBonus = choiceId === "A" ? 10 : choiceId === "B" ? 2 : -14;
      const rawScore = Math.max(0, Math.min(100, 82 - Math.round(nextScore * 32) + finalBonus));
      const level = levelFromScore(rawScore);
      setFinalLevel(level);
      setCanContinue(true);
      setActivePhase("peer_done");
      setManualInputOpen(false);
      setSelectedRound4Option(null);

      addTurn(npc.name, `我听完了，给你个评等：${level}。`, "npc", npc.portraitImage, getNpcSide(npc));
      const extra = peerFlow.round5.finalFeedbackByLevel?.[level];
      if (extra) {
        addTurn(npc.name, extra, "npc", npc.portraitImage, getNpcSide(npc));
      }
      addTurn("旁白", endingText, "narration");
    },
    [activePhase, addTurn, epilogueNpcMap.peer_fisher, getNpcSide, leakScore, npcBusy, peerFlow.round4.options, peerFlow.round5.endings, peerFlow.round5.finalFeedbackByLevel],
  );

  const selectRound1Choice = useCallback(
    (choiceId: PeerChoiceId) => {
      if (npcBusy || selectedRound1Option) return;
      setSelectedRound1Option(choiceId);
      window.setTimeout(() => submitPeerRound1Choice(choiceId), 110);
      window.setTimeout(() => {
        setSelectedRound1Option((curr) => (curr === choiceId ? null : curr));
      }, 1400);
    },
    [npcBusy, selectedRound1Option, submitPeerRound1Choice],
  );

  const selectRound4Choice = useCallback(
    (choiceId: PeerChoiceId) => {
      if (npcBusy || selectedRound4Option) return;
      setSelectedRound4Option(choiceId);
      window.setTimeout(() => submitPeerRound4Choice(choiceId), 110);
      window.setTimeout(() => {
        setSelectedRound4Option((curr) => (curr === choiceId ? null : curr));
      }, 1400);
    },
    [npcBusy, selectedRound4Option, submitPeerRound4Choice],
  );

  const selectPresetReply = useCallback(
    (option: string) => {
      if (npcBusy || selectedPresetReply) return;
      setSelectedPresetReply(option);
      window.setTimeout(() => {
        if (activePhase === "aqiao" || activePhase === "chief") {
          void submitRoleplay(option);
        } else if (activePhase === "peer_round2" || activePhase === "peer_round3") {
          void submitPeerOpenRound(option);
        }
      }, 90);
      window.setTimeout(() => {
        setSelectedPresetReply((curr) => (curr === option ? null : curr));
      }, 1400);
    },
    [activePhase, npcBusy, selectedPresetReply, submitPeerOpenRound, submitRoleplay],
  );

  useEffect(() => {
    const storageKey = `tyy:session:${lessonId}`;
    if (!window.localStorage.getItem(storageKey)) {
      window.localStorage.setItem(storageKey, sessionId);
    }
  }, [lessonId, sessionId]);

  useEffect(() => {
    fetch("/api/session/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, lessonId, sceneId }),
    }).catch(() => {});
  }, [lessonId, sceneId, sessionId]);

  useEffect(() => {
    if (!introVisible) return;
    const node = introVideoRef.current;
    if (!node) return;

    node.currentTime = 0;
    node.muted = false;
    node.volume = 1;
    const p = node.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => setIntroState("blocked"));
    }
  }, [introVisible]);

  useEffect(() => {
    if (!line || !storyAuto || !typing) return;

    const nextChar = line.text[typed] ?? "";
    const punctuationDelay = /[，。！？；：,.!?;:]/.test(nextChar) ? TYPE_PUNCT_DELAY_MS : 0;
    const timer = setTimeout(() => setTyped((prev) => prev + 1), TYPE_CHAR_BASE_MS + punctuationDelay);
    return () => clearTimeout(timer);
  }, [line, storyAuto, typed, typing]);

  useEffect(() => {
    if (!line || !storyAuto || typing) return;
    if (line.interactionMode === "npc2") return;

    if (lineGateKey !== currentLineKey) return;

    const now = Date.now();
    let fireAt: number | null = null;

    if (voiceGateStatus === "done") {
      fireAt = lineGateReadyAt;
    } else if (voiceGateStatus === "missing" || voiceGateStatus === "idle") {
      fireAt = Math.max(lineGateReadyAt, lineFallbackReadyAt);
    }

    if (fireAt === null) return;
    const timer = setTimeout(() => advance(), Math.max(VOICE_MIN_GAP_MS, fireAt - now + VOICE_MIN_GAP_MS));
    return () => clearTimeout(timer);
  }, [
    advance,
    currentLineKey,
    line,
    lineFallbackReadyAt,
    lineGateKey,
    lineGateReadyAt,
    storyAuto,
    typing,
    voiceGateStatus,
  ]);

  useEffect(() => {
    if (!line || !storyAuto || typing) return;
    if (line.interactionMode !== "npc2") return;

    const key = `${scene.sceneId}:${line.id}`;
    if (openedInteractionsRef.current.has(key)) return;
    if (lineGateKey !== currentLineKey) return;

    const now = Date.now();
    let fireAt: number | null = null;
    if (voiceGateStatus === "done") {
      fireAt = lineGateReadyAt;
    } else if (voiceGateStatus === "missing" || voiceGateStatus === "idle") {
      fireAt = Math.max(lineGateReadyAt, lineFallbackReadyAt);
    }
    if (fireAt === null) return;

    const timer = setTimeout(() => {
      if (openedInteractionsRef.current.has(key)) return;
      openedInteractionsRef.current.add(key);
      openNpcInteraction(line.interactionKey ?? "");
    }, Math.max(VOICE_MIN_GAP_MS, fireAt - now + VOICE_MIN_GAP_MS));
    return () => clearTimeout(timer);
  }, [
    currentLineKey,
    line,
    lineFallbackReadyAt,
    lineGateKey,
    lineGateReadyAt,
    openNpcInteraction,
    scene.sceneId,
    storyAuto,
    typing,
    voiceGateStatus,
  ]);

  useEffect(() => {
    if (!jump || paused || done || interactionActive) return;
    if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);

    jumpTimerRef.current = setTimeout(() => moveScene(jump.nextSceneId), SCENE_JUMP_AUTO_MS);
    return () => {
      if (jumpTimerRef.current) {
        clearTimeout(jumpTimerRef.current);
      }
    };
  }, [done, interactionActive, jump, moveScene, paused]);

  useEffect(() => {
    const fadeJobs = fadeJobsRef.current;
    const bgm = new Audio();
    bgm.preload = "auto";
    bgm.loop = true;

    const ambientPrimary = new Audio();
    ambientPrimary.preload = "auto";
    ambientPrimary.loop = true;

    const ambientSecondary = new Audio();
    ambientSecondary.preload = "auto";
    ambientSecondary.loop = true;

    const voice = new Audio();
    voice.preload = "auto";
    const npcSpeech = new Audio();
    npcSpeech.preload = "auto";

    const handleVoiceEnded = () => setVoiceActive(false);
    voice.addEventListener("ended", handleVoiceEnded);
    voice.addEventListener("pause", handleVoiceEnded);

    bgmRef.current = bgm;
    ambientPrimaryRef.current = ambientPrimary;
    ambientSecondaryRef.current = ambientSecondary;
    voiceRef.current = voice;
    npcSpeechRef.current = npcSpeech;

    return () => {
      Object.values(fadeJobs).forEach((job) => {
        if (job) window.clearInterval(job);
      });

      [bgm, ambientPrimary, ambientSecondary, voice, npcSpeech].forEach((item) => {
        item.pause();
        item.removeAttribute("src");
        item.load();
      });
      voice.removeEventListener("ended", handleVoiceEnded);
      voice.removeEventListener("pause", handleVoiceEnded);
    };
  }, []);

  useEffect(() => {
    const bgm = bgmRef.current;
    const primary = ambientPrimaryRef.current;
    const secondary = ambientSecondaryRef.current;
    if (!bgm || !primary || !secondary) return;

    if (introVisible || done) {
      fadeTo("bgm", bgm, 0, 260);
      fadeTo("ambientPrimary", primary, 0, 260);
      fadeTo("ambientSecondary", secondary, 0, 260);
      return;
    }

    const bgmBase = scene.bgm?.volume ?? DEFAULT_BGM;
    const ambientPrimaryBase = scene.ambientLayers?.primary || scene.ambientAudio ? DEFAULT_AMBIENT_PRIMARY : 0;
    const ambientSecondaryBase = scene.ambientLayers?.secondary ? DEFAULT_AMBIENT_SECONDARY : 0;

    baseMixRef.current = {
      bgm: bgmBase,
      ambientPrimary: ambientPrimaryBase,
      ambientSecondary: ambientSecondaryBase,
    };

    configureLoopTrack(bgm, "bgm", scene.bgm?.src, bgmBase);
    configureLoopTrack(
      primary,
      "ambientPrimary",
      scene.ambientLayers?.primary ?? scene.ambientAudio,
      ambientPrimaryBase,
    );
    configureLoopTrack(secondary, "ambientSecondary", scene.ambientLayers?.secondary, ambientSecondaryBase);
    // After switching scene, do a graceful fade-in from current volume over 1.2s
    fadeTo("bgm", bgm, bgmBase, 1200);
    fadeTo("ambientPrimary", primary, ambientPrimaryBase, 900);
    fadeTo("ambientSecondary", secondary, ambientSecondaryBase, 700);
  }, [configureLoopTrack, done, fadeTo, introVisible, scene]);

  useEffect(() => {
    const bgm = bgmRef.current;
    const primary = ambientPrimaryRef.current;
    const secondary = ambientSecondaryRef.current;
    if (!bgm || !primary || !secondary) return;
    if (introVisible || done) return;

    const mix = baseMixRef.current;
    // During NPC interaction, duck BGM even lower for dialogue clarity
    const inInteraction = Boolean(activePhase && activeNpcId);
    const bgmTarget = mix.bgm * (voiceActive ? 0.42 : inInteraction ? 0.6 : 1);
    const ambientPrimaryTarget =
      mix.ambientPrimary *
      (oneShotVideoPlaying ? 0.18 : 1) *
      (voiceActive ? 0.5 : inInteraction ? 0.72 : 1);
    const ambientSecondaryTarget =
      mix.ambientSecondary *
      (oneShotVideoPlaying ? 0.05 : 1) *
      (voiceActive ? 0.4 : inInteraction ? 0.6 : 1);

    fadeTo("bgm", bgm, bgmTarget, voiceActive ? 480 : 600);
    fadeTo("ambientPrimary", primary, ambientPrimaryTarget, voiceActive ? 420 : 550);
    fadeTo("ambientSecondary", secondary, ambientSecondaryTarget, voiceActive ? 380 : 500);
  }, [activeNpcId, activePhase, done, fadeTo, introVisible, oneShotVideoPlaying, voiceActive]);

  useEffect(() => {
    if (introVisible || done || !line) {
      stopVoice();
      setVoiceGateStatus("idle");
      setLineGateKey("");
      setLineGateReadyAt(0);
      setLineFallbackReadyAt(0);
      return;
    }

    const voice = voiceRef.current;
    if (!voice) return;
    const gateKey = `${sceneId}:${line.id}`;
    const minReadyMs = Math.max(VOICE_MIN_GAP_MS, line.autoNextMs);
    const fallbackReadyMs = Math.max(minReadyMs, estimateNarrationMs(line.text));
    const startedAt = Date.now();
    setLineGateKey(gateKey);
    setLineGateReadyAt(startedAt + minReadyMs);
    setLineFallbackReadyAt(startedAt + fallbackReadyMs);
    setVoiceGateStatus("pending");

    const sceneOverrides = scene.lineVoiceOverrides;
    const hasExplicitVoice = Boolean(sceneOverrides && Object.prototype.hasOwnProperty.call(sceneOverrides, line.id));
    const voiceId = hasExplicitVoice ? sceneOverrides?.[line.id] ?? null : line.id.includes("_i") ? null : line.id;
    if (!voiceId) {
      stopVoice();
      setVoiceGateStatus("missing");
      return;
    }

    const ticket = ++voiceTicketRef.current;
    let cancelled = false;
    const pendingTimer = window.setTimeout(() => {
      if (cancelled || voiceTicketRef.current !== ticket) return;
      setVoiceGateStatus((prev) => (prev === "pending" ? "missing" : prev));
    }, VOICE_PENDING_TIMEOUT_MS);

    const onEnded = () => {
      if (cancelled || voiceTicketRef.current !== ticket) return;
      setVoiceActive(false);
      setVoiceGateStatus("done");
    };
    const onError = () => {
      if (cancelled || voiceTicketRef.current !== ticket) return;
      setVoiceActive(false);
      setVoiceGateStatus("missing");
    };
    voice.addEventListener("ended", onEnded);
    voice.addEventListener("error", onError);

    const run = async () => {
      stopVoice();
      const src = await tryResolveVoiceSrc(voiceId);
      if (!src || cancelled || voiceTicketRef.current !== ticket) {
        if (!cancelled && voiceTicketRef.current === ticket) {
          setVoiceGateStatus("missing");
        }
        return;
      }

      voice.src = src;
      voice.currentTime = 0;
      // Differentiate playback speed by voice track type
      const track = line?.voiceTrack;
      if (track === "scene") {
        voice.playbackRate = 0.88; // 旁白：沉稳缓慢
      } else if (track === "inner") {
        voice.playbackRate = 0.92; // 主角心声：略慢，内省
      } else if (track === "quote") {
        voice.playbackRate = 0.85; // 课文原句：庄重缓慢
      } else {
        voice.playbackRate = 0.9; // 默认稍慢
      }
      try {
        setVoiceGateStatus("playing");
        await voice.play();
        if (!cancelled && voiceTicketRef.current === ticket) {
          setVoiceActive(true);
        }
      } catch {
        if (!cancelled) {
          setVoiceActive(false);
          setVoiceGateStatus("missing");
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      window.clearTimeout(pendingTimer);
      voice.removeEventListener("ended", onEnded);
      voice.removeEventListener("error", onError);
      stopVoice();
    };
  }, [done, introVisible, line, scene.lineVoiceOverrides, sceneId, stopVoice, tryResolveVoiceSrc]);

  useEffect(() => {
    if (!showSceneVideo) return;
    const video = sceneVideoRef.current;
    if (!video) return;

    if (scene.videoMode === "play_once_then_image") {
      video.currentTime = 0;
    }

    const p = video.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {});
    }
  }, [scene.videoMode, showSceneVideo, sceneId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (introVisible || done || jump) return;

      if (interactionActive) {
        if (!SPACE_SKIP_NO_API) return;
        event.preventDefault();
        stopVoice();
        skipInteractionBySpace();
        return;
      }

      if (!line) return;

      event.preventDefault();
      stopVoice();
      setVoiceGateStatus("missing");
      const now = Date.now();
      setLineGateKey(`${sceneId}:${line.id}`);
      setLineGateReadyAt(now);
      setLineFallbackReadyAt(now);
      setTyped(line.text.length);

      if (line.interactionMode === "npc2") {
        const key = `${scene.sceneId}:${line.id}`;
        if (!openedInteractionsRef.current.has(key)) {
          openedInteractionsRef.current.add(key);
          if (SPACE_SKIP_NO_API) {
            advance();
          } else {
            openNpcInteraction(line.interactionKey ?? "");
          }
        }
        return;
      }
      advance();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    advance,
    done,
    interactionActive,
    introVisible,
    jump,
    line,
    openNpcInteraction,
    scene.sceneId,
    sceneId,
    skipInteractionBySpace,
    stopVoice,
  ]);

  const progressText = `${visited.length}/${bundle.scenes.length}`;
  const isRoleplayPhase = activePhase === "aqiao" || activePhase === "chief";
  const isPeerRound1 = activePhase === "peer_round1";
  const isPeerOpenRound = activePhase === "peer_round2" || activePhase === "peer_round3";
  const isPeerRound4 = activePhase === "peer_round4";
  const isPeerDone = activePhase === "peer_done";
  const isFollowUpDecision = isRoleplayPhase && canContinue;
  const canUseManualInput = (isRoleplayPhase || isPeerOpenRound) && !isFollowUpDecision;
  const showManualInput = canUseManualInput && manualInputOpen;
  const disableNpcInput = npcBusy || !showManualInput;
  const presetReplies = getPresetReplies(activeNpcId, activePhase);
  const latestNpcTurn = [...turns].reverse().find((turn) => turn.tone === "npc");

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <Image
        src={displayBackdrop}
        alt={scene.title}
        fill
        priority
        sizes="100vw"
        className={isPeerFisherInteraction ? "object-contain bg-[#1a120d]" : "object-cover"}
      />

      {showSceneVideo && scene.backgroundVideo ? (
        <video
          key={`${sceneId}_${scene.backgroundVideo}`}
          ref={sceneVideoRef}
          src={scene.backgroundVideo}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          playsInline
          muted
          preload="auto"
          loop={scene.videoMode !== "play_once_then_image"}
          onEnded={() => {
            if (scene.videoMode === "play_once_then_image") {
              setVideoEndedByScene((prev) => ({ ...prev, [sceneId]: true }));
            }
          }}
        />
      ) : null}

      <div className="absolute inset-0 bg-gradient-to-b from-black/28 via-black/10 to-black/74" />
      {interactionActive && isPeerFisherInteraction ? (
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(43,30,20,0.18),rgba(43,30,20,0.48))]" />
      ) : null}

      <section className="relative z-10 flex h-full flex-col">
        <header className="flex items-start justify-between px-5 pt-6 text-white md:px-10 pointer-events-auto">
          <div className="relative group">
            <h1 className="text-lg font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#f0d4a2] to-[#d6a86c] md:text-2xl drop-shadow-[0_2px_10px_rgba(214,168,108,0.4)]">
              {bundle.lesson.title}
            </h1>
            <div className="absolute -bottom-2 left-0 h-[2px] w-12 bg-gradient-to-r from-[#d6a86c] to-transparent group-hover:w-full transition-all duration-500" />
            <p className="mt-2 text-xs font-medium tracking-wide text-white/70 md:text-sm flex items-center gap-2">
              <span className="text-[#a98a63]">{scene.title}</span> 
              <span className="text-white/30">|</span> 
              <span>卷之 {progressText}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (introVisible || interactionActive || done) return;
                setPaused((prev) => !prev);
              }}
              className="relative overflow-hidden rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/90 backdrop-blur-md transition-all hover:bg-white/15 hover:border-white/20 active:scale-95 group shadow-[0_0_15px_rgba(0,0,0,0.5)]"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent group-hover:opacity-0 transition-opacity" />
              {introVisible ? "加载中" : paused ? "▶ 继 续" : "॥ 暂 停"}
            </button>
            <button
              type="button"
              onClick={goHome}
              className="relative overflow-hidden rounded-full border border-[#d6a86c]/30 bg-black/40 px-4 py-1.5 text-xs text-[#ebd8bf] backdrop-blur-md transition-all hover:border-[#d6a86c]/70 hover:bg-[#d6a86c]/10 active:scale-95 shadow-[0_0_20px_rgba(0,0,0,0.6)]"
            >
              返 回
            </button>
          </div>
        </header>

        <div className="relative flex flex-1 items-end px-4 pb-8 md:px-12 md:pb-12 pointer-events-none">
          <article className="w-full max-w-4xl mx-auto rounded-3xl border border-white/10 bg-[#080503]/50 px-6 py-5 text-white backdrop-blur-[24px] shadow-[0_20px_40px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.05)] text-center relative overflow-hidden transition-all duration-[800ms]">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d6a86c]/40 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(214,168,108,0.08),transparent_70%)] pointer-events-none" />
            
            <div className="mb-3 flex items-center justify-center gap-3 relative z-10">
              <span className="rounded-full bg-gradient-to-r from-[#ac8353] to-[#73512b] px-3 py-0.5 text-[10px] font-bold tracking-widest text-[#fcf1df] shadow-[0_2px_8px_rgba(172,131,83,0.4)]">
                {currentSpeaker}
              </span>
              {scene.description && (
                <p className="max-w-[70%] truncate text-xs font-medium tracking-wide text-white/50">{scene.description}</p>
              )}
            </div>
            <p
              className={`min-h-[2.5rem] md:min-h-[3rem] text-lg leading-loose tracking-[0.06em] md:text-[1.35rem] font-medium relative z-10 ${
                line?.voiceTrack === "quote" ? "text-transparent bg-clip-text bg-gradient-to-r from-[#fceabb] to-[#f8b500] drop-shadow-sm font-semibold" : "text-[#ebe1d5] drop-shadow-md"
              }`}
            >
              {lineText}
              {typing ? <span className="typing-caret">|</span> : null}
            </p>
          </article>
        </div>
      </section>

      {jump ? (
        <div className="absolute bottom-36 left-1/2 z-20 -translate-x-1/2">
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/30 bg-black/38 px-2 py-1 backdrop-blur">
            <button
              type="button"
              onClick={() => moveScene(jump.nextSceneId)}
              className="rounded-full border border-[#e2c48c] bg-[#6b3f19]/85 px-4 py-1.5 text-xs text-[#f9e8c7]"
            >
              {jump.choices[0]}
            </button>
            <button
              type="button"
              onClick={() => moveScene(jump.nextSceneId)}
              className="rounded-full border border-[#d8c5a2]/65 bg-[#2f3b46]/70 px-4 py-1.5 text-xs text-[#eff5fb]"
            >
              {jump.choices[1]}
            </button>
          </div>
        </div>
      ) : null}

      {introVisible ? (
        <div className="absolute inset-0 z-50 bg-black">
          <video
            ref={introVideoRef}
            src={INTRO_VIDEO}
            className="h-full w-full object-cover opacity-90 transition-opacity duration-1000"
            autoPlay
            playsInline
            preload="auto"
            onLoadedMetadata={(event) => {
              event.currentTarget.muted = false;
              event.currentTarget.volume = 1;
            }}
            onEnded={() => setIntroState("ready")}
            onError={() => setIntroState("ready")}
          />
          <div className="absolute inset-x-0 bottom-0 top-[60%] bg-gradient-to-t from-[#080503] via-[#080503]/80 to-transparent pointer-events-none" />
          
          <div className="absolute inset-x-0 bottom-[12%] flex flex-col items-center justify-end z-10">
            {introState === "playing" ? (
              <div className="flex flex-col items-center animate-pulse duration-1000">
                <span className="text-[11px] tracking-[0.3em] text-[#d6a86c]/70 font-medium">序幕</span>
                <span className="mt-2 text-sm text-white/60 tracking-wider">入卷中...</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIntroVisible(false)}
                className="group relative overflow-hidden rounded-full border border-[#d6a86c]/40 bg-gradient-to-br from-[#1a140f]/90 to-[#0a0705]/90 px-12 py-3.5 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(214,168,108,0.2)] transition-all hover:scale-105 hover:-translate-y-1 hover:border-[#d6a86c] active:scale-95 animate-in fade-in zoom-in duration-500"
              >
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" />
                <span className="text-[15px] font-bold tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-[#f9ebcf] to-[#c79c65]">
                  开 始 探 索
                </span>
                <div className="absolute left-1/2 bottom-0 h-px w-0 -translate-x-1/2 bg-[#d6a86c] transition-all duration-300 group-hover:w-2/3" />
              </button>
            )}
          </div>
        </div>
      ) : null}

      {interactionActive && activeNpc ? (
        <div className="absolute inset-x-0 bottom-0 z-40 px-2 pb-3 md:px-8 md:pb-6 pointer-events-none flex justify-center">
          <div className="relative w-full max-w-5xl pointer-events-auto flex items-end">
            {/* NPC Portrait Segment - Breakout & Enlarged Layout */}
            {!isPeerFisherInteraction ? (
              <aside className="relative z-20 hidden md:block w-[300px] lg:w-[350px] shrink-0 transform translate-y-2 translate-x-4">
                <div className="relative h-[480px] w-full">
                  <Image 
                    src={activeNpc.portraitImage} 
                    alt={activeNpc.name} 
                    fill 
                    sizes="(max-width: 1024px) 300px, 350px" 
                    className="object-contain object-bottom drop-shadow-2xl opacity-100 transition-opacity duration-500 will-change-transform animate-[fade-in-up_0.6s_ease-out_forwards]"
                    style={{ filter: "drop-shadow(0 20px 25px rgba(0,0,0,0.4))" }}
                  />
                  {/* Subtle ground shadow / fade out at the bottom */}
                  <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 via-black/30 to-transparent rounded-b-3xl pointer-events-none" />
                </div>
              </aside>
            ) : null}

            {/* Main Interactive Panel - Glassmorphism, Premium Dark Look */}
            <div className={`relative min-w-0 flex-1 z-10 w-full rounded-[2rem] border border-white/10 bg-[#120d09]/80 px-4 py-5 md:px-8 md:py-7 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0__1px_1px_rgba(255,255,255,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-[#1a1410]/60 ${!isPeerFisherInteraction ? '-ml-8' : ''}`}>
              
              {/* NPC Info Label (floating style) */}
              {!isPeerFisherInteraction && (
                <div className="absolute -top-3 left-12 px-4 py-1 bg-gradient-to-r from-[#8a6842] to-[#5c4021] rounded-full border border-[#d4af82]/30 shadow-lg hidden md:block">
                  <span className="text-sm font-semibold tracking-widest text-[#f9ebcf] drop-shadow-md">{activeNpc.name}</span>
                  <span className="ml-2 text-[10px] text-[#e0caa5]/90 border-l border-white/20 pl-2">{activeNpc.role}</span>
                </div>
              )}

              <div className="flex flex-col gap-4">
                {/* NPC Speech Box */}
                <section className="relative px-5 py-4 w-full">
                  <div className="absolute left-0 top-0 bottom-0 w-[4px] rounded-full bg-gradient-to-b from-[#d6a86c] to-transparent opacity-80" />
                  <p className="md:hidden mb-1 text-xs font-semibold text-[#d4af82] tracking-wider">{activeNpc.name} <span className="text-[10px] text-[#cca070]/70 font-normal">· {activeNpc.role}</span></p>
                  <p className="text-base leading-relaxed tracking-wide text-[#f2e6d5] md:text-xl drop-shadow-sm font-medium">
                    {latestNpcTurn?.text ?? activeNpc.openingLine}
                  </p>
                </section>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                {/* User Response Area */}
                <section className="relative min-h-[140px] flex flex-col justify-end">
                  <div className="mb-3 flex items-center justify-between px-2">
                    <p className="text-xs tracking-[0.2em] text-[#ab9475] font-medium flex items-center gap-2">
                      <span className="h-4 w-[2px] bg-[#ac8551] rounded-full inline-block" /> 
                      你的回应
                    </p>
                    {showManualInput ? (
                      <button
                        type="button"
                        onClick={() => setManualInputOpen(false)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-[#d6c5af] hover:bg-white/10 transition-colors"
                      >
                        收起输入
                      </button>
                    ) : null}
                  </div>

                  {npcBusy && pendingUserMessage ? (
                    <div className="mb-3 rounded-2xl border border-[#d6a86c]/20 bg-[#1a120d]/70 px-4 py-3 text-sm text-[#ead8bf]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate">已发送：{pendingUserMessage}</span>
                        <span className="shrink-0 text-xs text-[#d6a86c]">对方回应中...</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="w-full flex-1 flex flex-col justify-end">
                    {isPeerRound1 ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {peerFlow.round1.options.map((option) => {
                          const card = toPeerChoiceCard("round1", option.id, option.text);
                          const selected = selectedRound1Option === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => selectRound1Choice(option.id)}
                              disabled={npcBusy || Boolean(selectedRound1Option)}
                              className={`group relative overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b98f] active:scale-[0.98] disabled:opacity-60 ${
                                selected
                                  ? "border-[#dcb57e] bg-gradient-to-br from-[#5e432a] to-[#3a2818] shadow-[0_0_20px_rgba(220,181,126,0.3)]"
                                  : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 hover:-translate-y-1 hover:shadow-xl"
                              }`}
                            >
                              <div className="relative z-10">
                                <p className={`text-sm md:text-base font-medium tracking-wide ${selected ? 'text-[#fdf2e1]' : 'text-[#e6d5bc] group-hover:text-white'}`}>{card.title}</p>
                                <p className={`mt-1.5 text-xs leading-relaxed ${selected ? 'text-[#d6bda0]' : 'text-[#c2ab90] group-hover:text-[#eee0cc]'}`}>{card.detail}</p>
                              </div>
                              {selected && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(220,181,126,0.15),transparent_70%)] animate-pulse" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}

                    {isPeerRound4 ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {peerFlow.round4.options.map((option) => {
                          const card = toPeerChoiceCard("round4", option.id, option.text);
                          const selected = selectedRound4Option === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => selectRound4Choice(option.id)}
                              disabled={npcBusy || Boolean(selectedRound4Option)}
                              className={`group relative overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b98f] active:scale-[0.98] disabled:opacity-60 ${
                                selected
                                  ? "border-[#dcb57e] bg-gradient-to-br from-[#5e432a] to-[#3a2818] shadow-[0_0_20px_rgba(220,181,126,0.3)]"
                                  : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 hover:-translate-y-1 hover:shadow-xl"
                              }`}
                            >
                              <div className="relative z-10">
                                <p className={`text-sm md:text-base font-medium tracking-wide ${selected ? 'text-[#fdf2e1]' : 'text-[#e6d5bc] group-hover:text-white'}`}>{card.title}</p>
                                <p className={`mt-1.5 text-xs leading-relaxed ${selected ? 'text-[#d6bda0]' : 'text-[#c2ab90] group-hover:text-[#eee0cc]'}`}>{card.detail}</p>
                              </div>
                              {selected && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(220,181,126,0.15),transparent_70%)] animate-pulse" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}

                    {(isRoleplayPhase || isPeerOpenRound) && !isFollowUpDecision && !isPeerDone && !manualInputOpen ? (
                      <div className="flex flex-col gap-3">
                        {presetReplies.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {presetReplies.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => selectPresetReply(option)}
                                disabled={npcBusy || Boolean(selectedPresetReply)}
                                className={`rounded-xl border px-4 py-3 text-sm transition-all duration-300 ease-out focus-visible:outline-none active:scale-[0.98] disabled:opacity-60 overflow-hidden relative group ${
                                  selectedPresetReply === option
                                    ? "border-[#dcb57e]/70 bg-gradient-to-r from-[#5c4021]/80 to-[#4a3118]/80 text-[#fdf2e1]"
                                    : "border-white/5 bg-black/20 text-[#dec8ab] hover:bg-white/5 hover:border-white/15 hover:text-white"
                                }`}
                              >
                                <span className="relative z-10">{option}</span>
                                {selectedPresetReply === option && <div className="absolute top-0 bottom-0 left-0 w-1 bg-[#dcb57e] shadow-[0_0_10px_rgba(220,181,126,1)]" />}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        
                        <div className="flex items-center gap-4 mt-2 mb-1 justify-center sm:justify-start">
                          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent hidden sm:block" />
                          <button
                            type="button"
                            onClick={() => setManualInputOpen(true)}
                            disabled={npcBusy}
                            className="group flex items-center gap-2 rounded-full border border-[#d6a86c]/30 bg-transparent px-5 py-2 text-sm text-[#d6a86c] transition-all hover:bg-[#d6a86c]/10 disabled:opacity-60"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-square-plus group-hover:scale-110 transition-transform"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M9 10h6"/><path d="M12 7v6"/></svg>
                            自有言辞
                          </button>
                          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent hidden sm:block" />
                        </div>
                      </div>
                    ) : null}

                    {showManualInput ? (
                      <div className="flex flex-col sm:flex-row gap-3 items-end w-full animate-in slide-in-from-bottom-2 duration-300">
                        <div className="relative flex-1 w-full group">
                          <textarea
                            value={npcInput}
                            onChange={(event) => setNpcInput(event.target.value)}
                            placeholder="自己组织一句回应，按 Enter 回话..."
                            disabled={disableNpcInput}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" || event.shiftKey) return;
                              event.preventDefault();
                              if (isRoleplayPhase) {
                                void submitRoleplay();
                              } else if (isPeerOpenRound) {
                                void submitPeerOpenRound();
                              }
                            }}
                            className="h-16 w-full resize-none rounded-2xl border border-white/10 bg-[#0a0705]/60 px-5 py-4 text-base text-[#fcf1df] placeholder:text-white/20 outline-none backdrop-blur-md transition-all focus:border-[#d6a86c]/60 focus:bg-[#140e0a]/80 focus:ring-1 focus:ring-[#d6a86c]/50 disabled:opacity-50"
                          />
                          <div className="absolute right-3 bottom-3 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none text-white/20 text-[10px]">
                            Press Enter ↵
                          </div>
                        </div>
                        <div className="flex h-16 shrink-0 sm:self-stretch items-center gap-2">
                          {isRoleplayPhase ? (
                            <button
                              type="button"
                              onClick={() => void submitRoleplay()}
                              disabled={npcBusy}
                              className="h-14 rounded-2xl bg-gradient-to-br from-[#c49253] to-[#8f6330] px-6 text-sm font-medium text-[#fff] shadow-lg shadow-[#8f6330]/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#8f6330]/40 active:scale-95 disabled:opacity-60 flex items-center gap-2"
                            >
                              {npcBusy ? "回应中..." : "确 认"}
                            </button>
                          ) : null}
                          {isPeerOpenRound ? (
                            <button
                              type="button"
                              onClick={() => void submitPeerOpenRound()}
                              disabled={npcBusy}
                              className="h-14 rounded-2xl bg-gradient-to-br from-[#c49253] to-[#8f6330] px-6 text-sm font-medium text-[#fff] shadow-lg shadow-[#8f6330]/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#8f6330]/40 active:scale-95 disabled:opacity-60 flex items-center gap-2"
                            >
                              {npcBusy ? "作答中..." : "确 认"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap justify-end gap-3 w-full">
                      {isFollowUpDecision ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCanContinue(false);
                            setManualInputOpen(true);
                          }}
                          className="group rounded-full border border-white/10 bg-[#302316]/50 px-6 py-2 text-sm text-[#e6d4ba] transition-all hover:bg-[#403020]/60 hover:text-white hover:border-white/20 flex items-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 group-hover:opacity-100 transition-opacity"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          继续闲谈
                        </button>
                      ) : null}

                      {isFollowUpDecision || isPeerDone ? (
                        <button
                          type="button"
                          onClick={closeNpcAndContinue}
                          className="relative overflow-hidden rounded-full border border-[#d6a86c]/40 bg-gradient-to-r from-[#44301d]/90 to-[#2c1d10]/90 px-8 py-2.5 text-sm font-medium text-[#fcf3e3] shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all hover:border-[#d6a86c]/80 hover:shadow-[0_4px_24px_rgba(214,168,108,0.25)] active:scale-95 flex items-center gap-2 group"
                        >
                          继续前行
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right group-hover:translate-x-1 transition-transform"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {done ? (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-[#050302]/90 backdrop-blur-xl px-4 transition-all duration-700 animate-in fade-in">
          {/* Cinematic background atmosphere */}
          <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] bg-[#c49253]/8 rounded-full blur-[150px] pointer-events-none animate-pulse" style={{animationDuration: '4s'}} />
          <div className="absolute bottom-[10%] right-[15%] w-[400px] h-[400px] bg-[#4a3118]/15 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{animationDuration: '6s'}} />
          <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#d6a86c]/5 rounded-full blur-[200px] pointer-events-none" />

          <div className="relative w-full max-w-3xl rounded-[2.5rem] border border-[#ac8353]/30 bg-[#120a05]/80 p-[1px] shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_100px_rgba(214,168,108,0.08)] overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Glossy spinning border effect */}
            <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden">
              <div className="absolute -inset-[50%] animate-[spin_10s_linear_infinite] bg-gradient-to-br from-transparent via-[#d6a86c]/20 to-transparent opacity-50" />
            </div>
            
            <div className="relative bg-[#0d0906] rounded-[2.5rem] p-8 md:p-12 w-full h-full flex flex-col items-center border border-[#3e2c1c]">
              {/* Top decorative line */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-[#d6a86c] to-transparent shadow-[0_0_20px_#d6a86c]" />

              {/* Title with poetic subtitle */}
              <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-700 delay-100">
                <h2 className="text-sm tracking-[0.3em] font-medium text-[#c49253]">行旅告一段落</h2>
                <p className="mt-2 text-xs text-[#8c7457]/60 tracking-widest italic">山中日月长，归去思无穷</p>
              </div>
              
              {summaryLoading ? (
                <div className="mt-20 mb-16 flex flex-col items-center">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-[#3e2c1c] rounded-full" />
                    <div className="absolute inset-0 border-4 border-transparent border-t-[#d6a86c] rounded-full animate-spin" />
                    <div className="absolute inset-2 border-2 border-transparent border-b-[#c49253]/50 rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}} />
                  </div>
                  <p className="mt-6 text-sm text-[#8c7457] tracking-widest animate-pulse">水月流转，收束行踪...</p>
                </div>
              ) : (
                <div className="w-full mt-8 space-y-8">
                  
                  {/* === Premium Final Level Emblem with Ring Animation === */}
                  {finalLevel ? (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-1000 delay-300">
                      <div className="relative flex items-center justify-center w-44 h-44 md:w-48 md:h-48">
                        {/* Outer rotating ring */}
                        <svg className="absolute inset-0 w-full h-full animate-[spin_25s_linear_infinite]" viewBox="0 0 200 200">
                          <defs>
                            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#d6a86c" stopOpacity="0.6" />
                              <stop offset="50%" stopColor="#fceabb" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#8f6330" stopOpacity="0.6" />
                            </linearGradient>
                          </defs>
                          <circle cx="100" cy="100" r="95" fill="none" stroke="url(#ringGrad)" strokeWidth="1.5" strokeDasharray="8 4" />
                        </svg>
                        {/* Inner pulsing ring */}
                        <svg className="absolute inset-3 w-[calc(100%-24px)] h-[calc(100%-24px)] animate-[spin_18s_linear_infinite]" style={{animationDirection: 'reverse'}} viewBox="0 0 200 200">
                          <circle cx="100" cy="100" r="95" fill="none" stroke="#c49253" strokeWidth="0.5" strokeOpacity="0.3" />
                        </svg>
                        {/* Radial glow */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(214,168,108,0.2)_0%,transparent_60%)] animate-pulse" style={{animationDuration: '3s'}} />
                        
                        {/* Central emblem */}
                        <div className="z-10 flex flex-col items-center justify-center rounded-full border border-[#d6a86c]/30 bg-gradient-to-br from-[#2a1b0e] to-[#0a0704] w-32 h-32 md:w-36 md:h-36 shadow-[inset_0_2px_10px_rgba(214,168,108,0.2),0_10px_30px_rgba(0,0,0,0.5),0_0_40px_rgba(214,168,108,0.1)] relative overflow-hidden">
                          <div className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                          <span className="text-[10px] text-[#cca070] tracking-[0.25em] mb-1 font-medium">回顾总评</span>
                          <span className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-[#fceabb] to-[#d6a86c] home-title-font drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            {finalLevel}
                          </span>
                        </div>
                      </div>

                      {/* Emotional feedback tagline based on level */}
                      <p className="mt-4 text-base tracking-wider font-medium text-center" style={{color: finalLevel === '甲' ? '#fceabb' : finalLevel === '乙' ? '#d6c5af' : finalLevel === '丙' ? '#b0a08a' : '#8c7457'}}>
                        {finalLevel === '甲' ? '✦ 言辞如水，分寸天成 ✦' : finalLevel === '乙' ? '得其大意，火候将至' : finalLevel === '丙' ? '方向已明，精进可期' : '初窥门径，来日可追'}
                      </p>
                    </div>
                  ) : null}

                  {/* === Stats Grid - 4 Dimensions === */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-[500ms]">
                    {[
                      { label: '途经景象', value: `${summary?.exploredScenes.length ?? visited.length}`, icon: '🏞️', sub: `共 ${bundle.scenes.length} 景` },
                      { label: '言辞慎重', value: `${Math.max(0, 100 - leakScore * 10).toFixed(0)}`, icon: '🤫', sub: '越高越好' },
                      { label: '对话深度', value: `${turns.length > 0 ? turns.length : '—'}`, icon: '💬', sub: '轮次' },
                      { label: '守密指数', value: leakScore < 0.3 ? '高' : leakScore < 0.6 ? '中' : '低', icon: '🔒', sub: leakScore < 0.3 ? '滴水不漏' : leakScore < 0.6 ? '尚算谨慎' : '略有泄漏' },
                    ].map((stat, i) => (
                      <div key={stat.label} className="group flex flex-col items-center p-4 rounded-2xl border border-[#3e2c1c]/60 bg-[#17100b]/40 hover:bg-[#1f150e]/60 hover:border-[#5c4021]/50 transition-all duration-500" style={{animationDelay: `${600 + i * 120}ms`}}>
                        <span className="text-xl mb-1" role="img" aria-label={stat.label}>{stat.icon}</span>
                        <span className="text-[#8c7457] text-[10px] font-medium tracking-widest mb-1">{stat.label}</span>
                        <span className="text-2xl font-bold text-[#ebd8bf] group-hover:text-[#fceabb] transition-colors">{stat.value}</span>
                        <span className="text-[10px] text-[#6b5a45] mt-0.5">{stat.sub}</span>
                      </div>
                    ))}
                  </div>

                  {/* === Journey Progress Bar === */}
                  <div className="max-w-md mx-auto animate-in fade-in duration-700 delay-[700ms]">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[10px] tracking-widest text-[#8c7457] font-medium">旅途足迹</span>
                      <span className="text-[10px] text-[#6b5a45]">{visited.length}/{bundle.scenes.length} 景</span>
                    </div>
                    <div className="relative w-full h-2 bg-[#1a1310] rounded-full overflow-hidden border border-[#3e2c1c]/30">
                      <div 
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#8f6330] via-[#c49253] to-[#d6a86c] rounded-full transition-all duration-[2000ms] ease-out shadow-[0_0_10px_rgba(214,168,108,0.4)]"
                        style={{width: `${Math.round((visited.length / bundle.scenes.length) * 100)}%`}}
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]" />
                    </div>
                    {/* Scene names as dots */}
                    <div className="flex justify-between mt-2 px-1">
                      {bundle.scenes.map((s) => (
                        <div key={s.sceneId} className="flex flex-col items-center gap-1">
                          <div className={`w-2 h-2 rounded-full transition-all duration-500 ${visited.includes(s.sceneId) ? 'bg-[#d6a86c] shadow-[0_0_6px_rgba(214,168,108,0.6)]' : 'bg-[#3e2c1c]/50'}`} />
                          <span className={`text-[8px] tracking-wider ${visited.includes(s.sceneId) ? 'text-[#cca070]' : 'text-[#4a3a2a]'}`}>{s.title.slice(0, 2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* === Epilogue Narrative Banner === */}
                  {finalNarrative ? (
                    <div className="relative text-center px-8 py-6 mx-4 rounded-2xl border border-[#d6a86c]/15 bg-gradient-to-br from-[#1a140e]/50 via-[#d6a86c]/5 to-[#1a140e]/50 animate-in fade-in slide-in-from-bottom-2 duration-1000 delay-[800ms] overflow-hidden">
                      {/* Subtle shimmer */}
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-[#d6a86c]/40 to-transparent" />
                      <p className="relative text-[10px] tracking-[0.25em] text-[#8c7457] font-medium mb-3">命运卷轴</p>
                      <p className="relative text-base md:text-lg text-[#d1bd9e] leading-[2] tracking-wide font-medium">{finalNarrative}</p>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-[#d6a86c]/40 to-transparent" />
                    </div>
                  ) : null}

                  {/* === Poetic closing remark === */}
                  <div className="text-center animate-in fade-in duration-700 delay-[1000ms]">
                    <p className="text-xs text-[#6b5a45] tracking-widest italic leading-relaxed">
                      {finalLevel === '甲' ? '"后遂无问津者。" —— 而你已在心中留下了桃源的模样。' : finalLevel === '乙' ? '"寻向所志，遂迷。" —— 路虽迷，心已近。' : '"太守即遣人随其往。" —— 旅途未尽，故事还长。'}
                    </p>
                  </div>
                </div>
              )}

              {/* === Bottom Action Buttons === */}
              <div className="mt-12 w-full flex flex-col sm:flex-row gap-4 items-center justify-center animate-in fade-in slide-in-from-bottom-2 duration-700 delay-[1100ms]">
                <button
                  type="button"
                  onClick={resetAll}
                  className="group relative w-full sm:w-auto min-w-[160px] overflow-hidden rounded-full border border-[#d6a86c]/40 bg-gradient-to-r from-[#4d3419] to-[#2c1c0d] px-10 py-4 text-[13px] font-bold tracking-widest text-[#fcf3e3] shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(214,168,108,0.3)] active:scale-95"
                >
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <span className="relative flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    再走一程
                  </span>
                </button>
                <button
                  type="button"
                  onClick={goHome}
                  className="w-full sm:w-auto min-w-[160px] rounded-full border border-white/10 bg-white/5 px-10 py-4 text-[13px] font-bold tracking-widest text-[#d1bd9e] backdrop-blur-sm transition-all hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  返回书案
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
