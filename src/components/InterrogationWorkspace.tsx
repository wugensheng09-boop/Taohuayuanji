"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  Home,
  RotateCcw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SpeechInputButton } from "@/components/SpeechInputButton";
import { evaluateInterrogationAnswer } from "@/lib/interrogation-evaluator";
import type { RokidRuntimeMode } from "@/lib/rokid-device";
import type { InterrogationConfig, InterrogationEvalResult, InterrogationTurnConfig } from "@/types/interrogation";
import type { LessonBundle } from "@/types/lesson";

type InterrogationApiResult = Partial<InterrogationEvalResult> & {
  error?: string;
  source?: string;
  latencyMs?: number;
  fallbackReason?: string;
};

type TurnRecord = {
  turn: InterrogationTurnConfig;
  answer: string;
  result: InterrogationEvalResult;
};

const MAGISTRATE_ART = "/assets/taohuayuanji/redesign/guard-magistrate.png";

const LOCAL_FALLBACK_MS = 10000;

const QUICK_REPLY_GROUPS = [
  {
    label: "守口表达",
    items: ["不足为外人道", "不便细说", "只谈见闻", "不说路径"],
  },
  {
    label: "原文证据",
    items: ["芳草鲜美", "屋舍俨然", "鸡犬相闻", "怡然自乐"],
  },
  {
    label: "危险避让",
    items: ["不提水路", "不说洞口", "不留标记"],
  },
];

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2, 8)}_${Date.now().toString(36)}`;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

type MeterVisual = {
  border: string;
  fill: string;
  glow: string;
  status: string;
  text: string;
};

function meterVisual(kind: "credibility" | "risk", value: number): MeterVisual {
  if (kind === "risk") {
    if (value >= 72) {
      return {
        border: "border-[#e24d3f]/45",
        fill: "from-[#8f1f18] via-[#db4638] to-[#ff9d63]",
        glow: "shadow-[0_0_26px_rgba(219,70,56,0.34)]",
        status: "高危",
        text: "text-[#ff8d72]",
      };
    }
    if (value >= 46) {
      return {
        border: "border-[#e08636]/42",
        fill: "from-[#994417] via-[#d77528] to-[#f1b45f]",
        glow: "shadow-[0_0_24px_rgba(209,116,39,0.28)]",
        status: "警戒",
        text: "text-[#f2ad62]",
      };
    }
    if (value >= 21) {
      return {
        border: "border-[#d7aa52]/38",
        fill: "from-[#6f5d1d] via-[#b79a36] to-[#edd67a]",
        glow: "shadow-[0_0_22px_rgba(215,170,82,0.2)]",
        status: "波动",
        text: "text-[#e8cd72]",
      };
    }
    return {
      border: "border-[#25b68c]/38",
      fill: "from-[#0d5f54] via-[#22b08c] to-[#a7efd0]",
      glow: "shadow-[0_0_22px_rgba(34,176,140,0.24)]",
      status: "低风险",
      text: "text-[#8be8c4]",
    };
  }

  if (value >= 70) {
    return {
      border: "border-[#8edc9a]/42",
      fill: "from-[#0d6c5d] via-[#6fc483] to-[#d6f6c9]",
      glow: "shadow-[0_0_24px_rgba(111,196,131,0.28)]",
      status: "稳健",
      text: "text-[#b8f0b7]",
    };
  }
  if (value >= 50) {
    return {
      border: "border-[#43c19a]/38",
      fill: "from-[#0d5e55] via-[#2ab58e] to-[#b7efd2]",
      glow: "shadow-[0_0_22px_rgba(42,181,142,0.22)]",
      status: "待核验",
      text: "text-[#8be5c2]",
    };
  }
  if (value >= 35) {
    return {
      border: "border-[#d7a84f]/38",
      fill: "from-[#7a5418] via-[#d49a36] to-[#f1d275]",
      glow: "shadow-[0_0_22px_rgba(212,154,54,0.22)]",
      status: "摇摆",
      text: "text-[#e9c96d]",
    };
  }
  return {
    border: "border-[#d95042]/44",
    fill: "from-[#7b1e1a] via-[#c34334] to-[#f1a078]",
    glow: "shadow-[0_0_24px_rgba(195,67,52,0.28)]",
    status: "可疑",
    text: "text-[#f19a82]",
  };
}

function meterWidth(kind: "credibility" | "risk", value: number): string {
  if (kind === "risk" && value === 0) return "2%";
  return `${value}%`;
}

function fallbackResult(turn: InterrogationTurnConfig): InterrogationEvalResult {
  return {
    reply: `${turn.speakerName}没有继续追问，只把你的话先记了下来。`,
    credibilityDelta: -4,
    leakRiskDelta: 0,
    matchedEvidence: [],
    matchedLeakClues: [],
    stageFeedback: ["判定暂时走了本地兜底，流程仍可继续。"],
  };
}

function chooseEnding(config: InterrogationConfig, credibility: number, leakRisk: number) {
  return (
    config.endings.find((ending) => credibility >= ending.minCredibility && leakRisk <= ending.maxLeakRisk) ??
    config.endings[config.endings.length - 1]
  );
}

function StatPanel({
  label,
  value,
  kind,
  note,
}: {
  label: string;
  value: number;
  kind: "credibility" | "risk";
  note: string;
}) {
  const visual = meterVisual(kind, value);

  return (
    <section className={`rounded-lg border ${visual.border} bg-[#07100e]/76 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_14px_34px_rgba(0,0,0,0.26)] backdrop-blur-md`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block whitespace-nowrap text-sm font-semibold tracking-[0.08em] text-[#f0d6a8]">{label}</span>
          <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] ${visual.border} ${visual.text}`}>
            {visual.status}
          </span>
        </div>
        <span className={`inline-flex min-w-[4.6rem] justify-end font-mono text-[2rem] font-bold leading-none tabular-nums ${visual.text}`}>
          {value}
        </span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-black/68 ring-1 ring-white/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${visual.fill} ${visual.glow} transition-all duration-500`}
          style={{ width: meterWidth(kind, value) }}
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-[#8f836f]">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
      <p className="mt-3 text-xs leading-5 text-[#bca98d]">{note}</p>
    </section>
  );
}

function SidePanel({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: ReactNode;
  count?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#d6aa6d]/22 bg-[#090d0b]/72 p-3 shadow-[0_16px_42px_rgba(0,0,0,0.32)] backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-[#efd0a0]">
          {icon}
          {title}
        </h2>
        {count ? <span className="font-mono text-sm text-[#cfaa71]">{count}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function InterrogationWorkspace({
  bundle,
  config,
  deviceMode = "web",
}: {
  bundle: LessonBundle;
  config: InterrogationConfig;
  deviceMode?: RokidRuntimeMode;
}) {
  const [sessionId] = useState(() => uid("guard"));
  const [turnIndex, setTurnIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [credibility, setCredibility] = useState(config.startingCredibility);
  const [leakRisk, setLeakRisk] = useState(config.startingLeakRisk);
  const [records, setRecords] = useState<TurnRecord[]>([]);
  const [lastResult, setLastResult] = useState<InterrogationEvalResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [judgeStage, setJudgeStage] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [done, setDone] = useState(false);
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestTokenRef = useRef(0);

  const turn = config.turns[turnIndex] ?? config.turns[config.turns.length - 1];
  const ending = useMemo(() => chooseEnding(config, credibility, leakRisk), [config, credibility, leakRisk]);
  const allEvidence = useMemo(() => [...new Set(records.flatMap((record) => record.result.matchedEvidence))], [records]);
  const allLeaks = useMemo(() => [...new Set(records.flatMap((record) => record.result.matchedLeakClues))], [records]);
  const canSubmit = answer.trim().length > 0 && !busy && !done;
  const deviceQuery = deviceMode === "rokid" ? "?device=rokid" : "";

  const reset = useCallback(() => {
    requestTokenRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setTurnIndex(0);
    setAnswer("");
    setCredibility(config.startingCredibility);
    setLeakRisk(config.startingLeakRisk);
    setRecords([]);
    setLastResult(null);
    setBusy(false);
    setJudgeStage("");
    setRulesOpen(false);
    setDone(false);
  }, [config.startingCredibility, config.startingLeakRisk]);

  const handleQuickReply = (reply: string) => {
    if (busy || done) return;
    setAnswer((current) => (current.trim() ? `${current.trim()}，${reply}` : reply));
  };

  const commitResult = useCallback((trimmed: string, result: InterrogationEvalResult) => {
    setCredibility((value) => clampScore(value + result.credibilityDelta));
    setLeakRisk((value) => clampScore(value + result.leakRiskDelta));
    setRecords((items) => [...items, { turn, answer: trimmed, result }]);
    setLastResult(result);
    setAnswer("");

    if (turnIndex + 1 >= config.turns.length) {
      setDone(true);
    } else {
      setTurnIndex((value) => value + 1);
    }
  }, [config.turns.length, turn, turnIndex]);

  const submitAnswer = useCallback(async () => {
    const trimmed = answer.trim();
    if (!trimmed || !turn || busy || done) return;

    setBusy(true);
    setJudgeStage("正在判读证据");
    const controller = new AbortController();
    const token = requestTokenRef.current + 1;
    requestTokenRef.current = token;
    requestControllerRef.current = controller;
    const stageTimers = [
      window.setTimeout(() => setJudgeStage("正在比对原文线索"), 1800),
      window.setTimeout(() => setJudgeStage("远端判定较慢，准备本地兜底"), 6200),
      window.setTimeout(() => {
        setJudgeStage("已切换本地判定");
        controller.abort();
      }, LOCAL_FALLBACK_MS),
    ];
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          sessionId,
          lessonId: config.lessonId,
          sceneId: config.sceneId,
          npcId: turn.speakerId,
          mode: "interrogation_eval",
          turnId: turn.id,
          question: turn.prompt,
          message: trimmed,
        }),
      });
      const data = (await response.json()) as InterrogationApiResult;
      if (!response.ok) throw new Error(data.error ?? "interrogation failed");

      const result: InterrogationEvalResult = {
        reply: data.reply ?? fallbackResult(turn).reply,
        credibilityDelta: data.credibilityDelta ?? 0,
        leakRiskDelta: data.leakRiskDelta ?? 0,
        matchedEvidence: data.matchedEvidence ?? [],
        matchedLeakClues: data.matchedLeakClues ?? [],
        stageFeedback: data.stageFeedback?.length ? data.stageFeedback : fallbackResult(turn).stageFeedback,
      };

      if (requestTokenRef.current !== token) return;
      commitResult(trimmed, result);
    } catch (error) {
      if (requestTokenRef.current !== token) return;
      const localResult = evaluateInterrogationAnswer(config, turn, trimmed);
      const result: InterrogationEvalResult = {
        ...localResult,
        stageFeedback: [
          ...localResult.stageFeedback,
          error instanceof DOMException && error.name === "AbortError"
            ? "远端判定超时，已切换本地判定。"
            : "远端判定异常，已切换本地判定。",
        ],
      };
      commitResult(trimmed, result);
    } finally {
      stageTimers.forEach((timer) => window.clearTimeout(timer));
      if (requestTokenRef.current === token) {
        requestControllerRef.current = null;
        setJudgeStage("");
        setBusy(false);
      }
    }
  }, [answer, busy, commitResult, config, done, sessionId, turn]);

  const skipCurrentTurn = useCallback(() => {
    if (!turn || done) return;
    requestTokenRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    const safeAnswer = answer.trim() || "暂且避开这个问题，不交代路径。";
    const localResult = evaluateInterrogationAnswer(config, turn, safeAnswer);
    commitResult(safeAnswer, {
      ...localResult,
      stageFeedback: [...localResult.stageFeedback, "已跳过当前盘问，使用本地安全判定继续流程。"],
    });
    setJudgeStage("");
    setBusy(false);
  }, [answer, commitResult, config, done, turn]);

  useEffect(() => {
    if (deviceMode !== "rokid") return;

    const quickReplies = QUICK_REPLY_GROUPS.flatMap((group) => group.items);
    const choiceIndexFromAction = (value: string) => {
      const match = value.match(/^(?:choice|option|reply|select)[:=_-]?([abc1230])$/);
      if (!match) return null;
      const token = match[1];
      if (token === "a" || token === "1" || token === "0") return 0;
      if (token === "b" || token === "2") return 1;
      if (token === "c" || token === "3") return 2;
      return null;
    };

    const runCommand = (action: string | undefined) => {
      const normalized = action?.trim().toLowerCase().replace(/\s+/g, "");
      if (!normalized) return;

      const choiceIndex = choiceIndexFromAction(normalized);
      if (choiceIndex !== null) {
        const reply = quickReplies[choiceIndex];
        if (reply && !busy && !done) {
          setAnswer((current) => (current.trim() ? `${current.trim()}，${reply}` : reply));
        }
        return;
      }

      switch (normalized) {
        case "start":
        case "next":
          if (canSubmit) {
            void submitAnswer();
          } else {
            skipCurrentTurn();
          }
          break;
        case "skip":
        case "fallback":
          skipCurrentTurn();
          break;
        case "reset":
          reset();
          break;
        case "home":
          window.location.assign("/?device=rokid");
          break;
        case "reload":
          window.location.reload();
          break;
        default:
          break;
      }
    };

    const onRokidCommand = (event: Event) => {
      const customEvent = event as CustomEvent<{ action?: string }>;
      runCommand(customEvent.detail?.action);
    };

    window.__TAOHUAYUAN_ROKID_COMMAND__ = (action: string) => runCommand(action);
    window.addEventListener("rokid-command", onRokidCommand);
    return () => {
      window.removeEventListener("rokid-command", onRokidCommand);
      delete window.__TAOHUAYUAN_ROKID_COMMAND__;
    };
  }, [busy, canSubmit, deviceMode, done, reset, skipCurrentTurn, submitAnswer]);

  return (
    <main
      data-device-mode={deviceMode}
      className="guard-shell relative min-h-screen overflow-x-hidden bg-[#050403] bg-cover bg-left bg-no-repeat text-[#f8ecd8] lg:h-screen lg:overflow-hidden"
      style={{ backgroundImage: `url("${MAGISTRATE_ART}")`, backgroundPosition: "left center" }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_42%,rgba(234,192,126,0.06),transparent_28%),radial-gradient(circle_at_78%_22%,rgba(37,120,102,0.08),transparent_32%),linear-gradient(90deg,rgba(4,5,4,0.02)_0%,rgba(4,5,4,0.04)_34%,rgba(3,6,6,0.3)_62%,rgba(3,4,4,0.68)_100%),linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.06)_46%,rgba(0,0,0,0.56)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-[#050403]/92 via-[#050403]/38 to-transparent" />

      <div className="guard-frame relative z-10 flex min-h-screen flex-col px-4 py-4 md:px-6 lg:h-screen lg:min-h-0 lg:px-8 lg:py-6">
        <header className="guard-header pointer-events-auto mx-auto flex w-full max-w-[100rem] shrink-0 items-center justify-between gap-3 rounded-lg border border-[#d8b176]/18 bg-[#050504]/46 px-3 py-2 shadow-[0_16px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl md:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={`/${deviceQuery}`}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#d8b98f]/34 bg-black/34 text-[#f7e8cd] transition hover:border-[#d8b98f]/75 hover:bg-[#d8b98f]/10"
              aria-label="返回首页"
            >
              <Home size={20} />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-xl font-semibold tracking-[0.12em] text-[#f5d69e] md:text-2xl">
                {config.title}
              </h1>
              <p className="hidden truncate text-xs text-[#bca98d] md:block">
                你已离开桃花源，被官府盘问。谨言慎行，守住桃源秘密。
              </p>
            </div>
          </div>

          <nav className="flex shrink-0 items-center gap-1 md:gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-transparent px-2.5 text-sm text-[#d8c2a0] transition hover:border-[#d8b176]/30 hover:bg-white/5"
            >
              <RotateCcw size={17} />
              <span className="hidden sm:inline">重置本局</span>
            </button>
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-transparent px-2.5 text-sm text-[#d8c2a0] transition hover:border-[#d8b176]/30 hover:bg-white/5"
            >
              <BookOpen size={17} />
              <span className="hidden sm:inline">规则</span>
            </button>
            <Link
              href={`/lesson/${bundle.lesson.lessonId}${deviceQuery}`}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-transparent px-2.5 text-sm text-[#d8c2a0] transition hover:border-[#d8b176]/30 hover:bg-white/5"
            >
              <FileText size={17} />
              <span className="hidden sm:inline">原文</span>
            </Link>
          </nav>
        </header>

        <section className="guard-layout mx-auto grid w-full max-w-[100rem] flex-1 gap-4 py-4 lg:min-h-0 lg:grid-cols-[minmax(14rem,1fr)_minmax(27rem,32rem)_15rem] lg:items-end xl:grid-cols-[minmax(28rem,1fr)_minmax(30rem,31rem)_16rem] 2xl:grid-cols-[minmax(34rem,1fr)_minmax(32rem,36rem)_17rem]">
          <aside className="guard-left pointer-events-none relative hidden min-h-[calc(100vh-8.5rem)] self-stretch lg:block">
            <div className="absolute left-0 top-[14%] rounded-lg border border-[#d8b176]/32 bg-[#130e09]/62 px-3 py-4 text-center shadow-[0_18px_44px_rgba(0,0,0,0.34)] backdrop-blur-md">
              <p className="text-xs tracking-[0.22em] text-[#d6b27c]">武陵县令</p>
              <p className="mt-2 font-serif text-xl text-[#fff1d2] [writing-mode:vertical-rl]">崔判官</p>
              <p className="mt-3 text-xs tracking-[0.16em] text-[#bba487] [writing-mode:vertical-rl]">谨慎盘明</p>
            </div>
            <div className="absolute bottom-12 left-0 max-w-[19rem] rounded-lg border border-[#d8b176]/18 bg-[#080706]/50 p-4 shadow-[0_18px_44px_rgba(0,0,0,0.34)] backdrop-blur-md">
              <p className="text-xs font-semibold tracking-[0.2em] text-[#d8b176]">当前盘问</p>
              <p className="mt-1 text-2xl font-semibold text-[#fff2dc]">{done ? ending.title : turn.speakerName}</p>
              <p className="mt-1 text-sm leading-6 text-[#d8c2a0]">{done ? ending.advice : turn.pressure}</p>
            </div>
          </aside>

          <section className="guard-main-panel pointer-events-auto flex min-h-0 flex-col justify-end gap-3 lg:pb-7">
            {!done ? (
              <div className="guard-card overflow-hidden rounded-lg border border-[#d8b176]/26 bg-[#080806]/64 shadow-[0_22px_70px_rgba(0,0,0,0.46),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl">
                <div className="guard-card-prompt border-b border-[#d8b176]/16 bg-[radial-gradient(circle_at_12%_0%,rgba(216,177,118,0.16),transparent_34%)] p-4">
                  <p className="font-serif text-4xl leading-none text-[#d8b176]/78">“</p>
                  <p className="mt-[-0.6rem] text-xs leading-6 text-[#d9c8ad]">
                    {turn.speakerName}问：{turn.followup}
                  </p>
                  <p className="mt-2 font-serif text-2xl font-semibold leading-[1.45] text-[#f7d99d] md:text-3xl">
                    {turn.prompt}
                  </p>
                </div>

                <div className="guard-stat-grid grid gap-3 border-b border-[#d8b176]/14 p-3 md:grid-cols-2">
                  <StatPanel label="可信度" value={credibility} kind="credibility" note="开局 50；回答有据且守口会升高，含糊或自相矛盾会降低。" />
                  <StatPanel label="泄密风险" value={leakRisk} kind="risk" note="开局 0；说出入口、水路、步数、标记等可复寻线索会升高。" />
                </div>

                {lastResult ? (
                  <div className="guard-feedback grid gap-3 border-b border-[#d8b176]/14 bg-black/16 p-3 md:grid-cols-[minmax(0,1fr)_13rem]">
                    <div>
                      <p className="text-sm leading-7 text-[#f4e4ca]">{lastResult.reply}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-md bg-[#12352e] px-2.5 py-1 text-[#a8efd4]">
                          可信 {signed(lastResult.credibilityDelta)}
                        </span>
                        <span className="rounded-md bg-[#3b1813] px-2.5 py-1 text-[#ffb9a6]">
                          风险 {signed(lastResult.leakRiskDelta)}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs leading-6 text-[#d7c4a8]">
                      {lastResult.stageFeedback.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="guard-answer-panel">
                  <div className="flex items-center justify-between gap-3 border-b border-[#d8b176]/16 px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-semibold tracking-[0.16em] text-[#e7c68f]">
                      <Send size={16} />
                      你的回答
                    </p>
                    <p className="hidden text-xs text-[#aa9a82] sm:block">回答需符合逻辑，避开危险线索</p>
                  </div>
                  <textarea
                    data-testid="guard-answer"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    disabled={busy || done}
                    rows={4}
                    maxLength={360}
                    placeholder="在此输入你的回答……"
                    className="h-28 w-full resize-none border-0 bg-black/12 px-4 py-3 text-base leading-7 text-[#fff7e8] outline-none placeholder:text-[#8f806c] disabled:cursor-wait disabled:opacity-70"
                  />
                  <div className="guard-voice-row flex flex-wrap items-center justify-between gap-2 border-t border-[#d8b176]/14 px-4 py-3">
                    <SpeechInputButton
                      value={answer}
                      onChange={setAnswer}
                      disabled={busy || done}
                      maxLength={360}
                      data-testid="guard-speech"
                      variant="icon"
                      className="npc-mic-button"
                    />
                    <button
                      type="button"
                      data-testid="guard-skip"
                      onClick={skipCurrentTurn}
                      disabled={done}
                      className="npc-skip-link disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      跳过当前盘问
                    </button>
                  </div>
                  <div className="guard-quick-replies grid gap-2 border-t border-[#d8b176]/14 px-4 py-3">
                    {QUICK_REPLY_GROUPS.map((group) => (
                      <div key={group.label} className="flex flex-wrap items-center gap-2">
                        <span className="mr-1 min-w-[4.5rem] text-xs font-semibold text-[#d0b287]">{group.label}</span>
                        {group.items.map((reply) => (
                          <button
                            key={reply}
                            type="button"
                            onClick={() => handleQuickReply(reply)}
                            disabled={busy || done}
                            className="rounded-full border border-[#d8b176]/20 bg-black/24 px-3 py-1 text-xs text-[#c9b79a] transition hover:border-[#d8b176]/55 hover:bg-[#d8b176]/10 hover:text-[#fff0d5] disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {reply}
                          </button>
                        ))}
                      </div>
                    ))}
                    <span className="ml-auto font-mono text-xs text-[#9c8c75]">{answer.length}/360</span>
                  </div>
                  <div className="guard-submit-panel flex flex-col items-center gap-2 border-t border-[#d8b176]/12 px-4 py-3">
                    <button
                      type="button"
                      data-testid="guard-submit"
                      onClick={() => void submitAnswer()}
                      disabled={!canSubmit}
                      className="group relative min-h-12 w-full max-w-xs overflow-hidden rounded-lg border border-[#e0be83]/36 bg-gradient-to-r from-[#6c4a28] via-[#9a6a36] to-[#6f4a27] px-8 font-serif text-xl font-semibold tracking-[0.32em] text-[#fff0cf] shadow-[0_16px_38px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span className="relative z-10">{busy ? "判读中" : turnIndex + 1 >= config.turns.length ? "结案" : "判定"}</span>
                      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/14 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    </button>
                    <p className="text-xs text-[#a99778]">{judgeStage || "提交回答，观察官员反应"}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="guard-ending-card rounded-lg border border-[#d8b176]/24 bg-[#080806]/68 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
                <div className="mb-5 flex items-center gap-3 text-[#d8b98f]">
                  {ending.id === "safe" ? <ShieldCheck size={30} /> : <AlertTriangle size={30} />}
                  <span className="text-xs font-semibold tracking-[0.22em]">最终判定</span>
                </div>
                <h2 className="font-serif text-4xl font-semibold text-[#fff4df] md:text-5xl" data-testid="guard-ending-title">
                  {ending.title}
                </h2>
                <p className="mt-5 text-lg leading-9 text-[#e7d5b9]">{ending.narrative}</p>
                <p className="mt-4 text-base leading-8 text-[#bda98b]">{ending.advice}</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#0f766e] px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#12877f]"
                  >
                    <RotateCcw size={18} />
                    再盘一局
                  </button>
                  <Link
                    href={`/learn/taohuayuanji${deviceQuery}`}
                    className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-[#d8b98f]/35 bg-[#d8b98f]/10 px-5 text-sm font-semibold text-[#f4e2c4] transition hover:border-[#d8b98f]/70 hover:bg-[#d8b98f]/16"
                  >
                    <CheckCircle2 size={18} />
                    回到沉浸篇
                  </Link>
                </div>
              </div>
            )}
          </section>

          <aside className="guard-side pointer-events-auto grid content-start gap-3 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto lg:pr-1">
            <SidePanel title="已稳住的证词" icon={<ShieldCheck size={17} />} count={`${Math.min(4, allEvidence.length)}/4`}>
              <div className="space-y-2">
                {allEvidence.length > 0 ? (
                  allEvidence.slice(0, 4).map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-md border border-[#2ca47e]/30 bg-[#173329]/70 px-3 py-2 text-sm text-[#c8f1d3]">
                      <CheckCircle2 size={15} />
                      {item}
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-white/10 bg-black/24 px-3 py-3 text-sm leading-6 text-[#9f917b]">
                    尚未提交证词。回答后，能被原文支撑且没有泄露路径的内容会记录在这里。
                  </p>
                )}
              </div>
            </SidePanel>

            <SidePanel title="暴露过的危险线索" icon={<AlertTriangle size={17} />} count={`${allLeaks.length}`}>
              <div className="space-y-2">
                {allLeaks.length > 0 ? (
                  allLeaks.map((item) => (
                    <div key={item} className="flex items-center justify-between gap-2 rounded-md border border-[#cf4b3e]/30 bg-[#351411]/72 px-3 py-2 text-sm text-[#ffc4b6]">
                      <span>{item}</span>
                      <span className="rounded border border-[#cf4b3e]/35 px-2 py-0.5 text-xs text-[#ee9a85]">风险</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-[#a99b86]">路径仍未被抓住。</p>
                )}
              </div>
            </SidePanel>

            <SidePanel title="盘问记录" icon={<FileText size={17} />} count={`${records.length} 条`}>
              <div className="max-h-[25rem] space-y-3 overflow-auto pr-1">
                {records.length > 0 ? (
                  records
                    .slice()
                    .reverse()
                    .map((record) => (
                      <article key={record.turn.id} className="rounded-lg border border-[#d8b176]/16 bg-black/26 p-3">
                        <p className="text-xs text-[#d8b98f]">{record.turn.speakerName}</p>
                        <p className="mt-2 text-sm leading-6 text-[#f2e3c8]">{record.answer}</p>
                      </article>
                    ))
                ) : (
                  <div className="space-y-3">
                    <p className="rounded-lg border border-[#d8b176]/18 bg-black/24 p-3 text-sm leading-6 text-[#cfbea3]">
                      尚未开始盘问。每次提交后，这里会倒序保存你的回答与对应追问。
                    </p>
                    <p className="text-xs leading-5 text-[#8f806a]">{config.subtitle}</p>
                  </div>
                )}
              </div>
            </SidePanel>
          </aside>
        </section>

      </div>
      {rulesOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/62 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guard-rules-title"
          onClick={() => setRulesOpen(false)}
        >
          <section
            className="w-full max-w-xl rounded-lg border border-[#d8b176]/32 bg-[#0b0907]/92 p-5 text-[#f4e2c4] shadow-[0_28px_80px_rgba(0,0,0,0.58)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#d8b176]/16 pb-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] text-[#d8b176]">盘问规则</p>
                <h2 id="guard-rules-title" className="mt-2 font-serif text-3xl font-semibold text-[#fff0d0]">
                  守住桃源，证词要稳
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setRulesOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#ead8bd] transition hover:border-[#d8b176]/50 hover:bg-[#d8b176]/10"
                aria-label="关闭规则"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-[#d7c4a8]">
              <p>引用原文画面会提高可信度，例如桃花林、洞中转折、村中安宁和避世缘由。</p>
              <p>说出入口、水路、步数、标记、可带官府复寻等线索，会提高泄密风险。</p>
              <p>最佳策略是“说见闻，不说路线”：让证词足够可信，但不交出可复现的路引。</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/lesson/${bundle.lesson.lessonId}`}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d8b176]/28 bg-[#d8b176]/10 px-4 text-sm font-semibold text-[#fff0d0] transition hover:border-[#d8b176]/62"
              >
                <FileText size={17} />
                原文/课文档案
              </Link>
              <button
                type="button"
                onClick={() => setRulesOpen(false)}
                className="inline-flex min-h-10 items-center rounded-lg bg-[#0f766e] px-4 text-sm font-semibold text-white transition hover:bg-[#12877f]"
              >
                明白了
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
