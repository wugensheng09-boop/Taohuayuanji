"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Flame, Settings, Sparkles, Trophy } from "lucide-react";

type HomeProgress = {
  lessonId: string;
  sessionId: string;
  currentSceneId: string;
  visitedScenes: string[];
  updatedAt: string;
};

type MenuItem = {
  href: string;
  label: string;
  description: string;
  plaque: string;
  plaqueWidth: number;
  plaqueHeight: number;
  featured?: boolean;
  requiresProgress?: boolean;
};

type CursorMode = "idle" | "menu" | "tool" | "disabled";

type CursorState = {
  mode: CursorMode;
  label: string;
  pressed: boolean;
};

const MENU_ITEMS: MenuItem[] = [
  {
    href: "/learn/taohuayuanji",
    label: "开始入画",
    description: "进入桃源场景",
    plaque: "/assets/taohuayuanji/ui/menu-plaque-blank-start.png",
    plaqueWidth: 2920,
    plaqueHeight: 700,
    featured: true,
  },
  {
    href: "/learn/taohuayuanji?resume=1",
    label: "继续游历",
    description: "接续上次进度",
    plaque: "/assets/taohuayuanji/ui/menu-plaque-blank-continue.png",
    plaqueWidth: 2920,
    plaqueHeight: 680,
    requiresProgress: true,
  },
  {
    href: "/guard/taohuayuanji",
    label: "桃源守密局",
    description: "解锁推理挑战",
    plaque: "/assets/taohuayuanji/ui/menu-plaque-blank-guard.png",
    plaqueWidth: 2920,
    plaqueHeight: 680,
  },
  {
    href: "/lesson/taohuayuanji",
    label: "翻看原卷",
    description: "查看课文注释",
    plaque: "/assets/taohuayuanji/ui/menu-plaque-blank-scroll.png",
    plaqueWidth: 2920,
    plaqueHeight: 690,
  },
];

function readProgress(lessonId: string): HomeProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`tyy:progress:${lessonId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HomeProgress>;
    if (
      parsed.lessonId !== lessonId ||
      typeof parsed.sessionId !== "string" ||
      typeof parsed.currentSceneId !== "string" ||
      !Array.isArray(parsed.visitedScenes)
    ) {
      return null;
    }
    return {
      lessonId,
      sessionId: parsed.sessionId,
      currentSceneId: parsed.currentSceneId,
      visitedScenes: parsed.visitedScenes.filter((item): item is string => typeof item === "string"),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
}

function MenuPlaque({ item, disabled }: { item: MenuItem; disabled?: boolean }) {
  const content = (
    <>
      <Image
        src={item.plaque}
        alt=""
        width={item.plaqueWidth}
        height={item.plaqueHeight}
        className="menu-card-image"
        priority={item.featured}
      />
      <span className="menu-card-text">{item.label}</span>
    </>
  );
  const className = `menu-card${item.featured ? " menu-card--featured" : ""}${disabled ? " menu-card--disabled" : ""}`;

  if (disabled) {
    return (
      <button
        type="button"
        className={className}
        aria-disabled="true"
        title="暂无进度，先开始入画"
        data-cursor-target="disabled"
        data-cursor-label="暂无进度"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      className={className}
      aria-label={`${item.label}，${item.description}`}
      data-cursor-target="menu"
      data-cursor-label={item.label}
    >
      {content}
    </Link>
  );
}

export function TaohuayuanHomeClient({
  lessonId,
  sceneCount,
  taskCount,
}: {
  lessonId: string;
  sceneCount: number;
  taskCount: number;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [achievementOpen, setAchievementOpen] = useState(false);
  const [petalsOn, setPetalsOn] = useState(true);
  const [lightOn, setLightOn] = useState(true);
  const [progress] = useState<HomeProgress | null>(() => readProgress(lessonId));
  const [cursor, setCursor] = useState<CursorState>({ mode: "idle", label: "", pressed: false });
  const cursorResetRef = useRef<number | null>(null);

  const completedCount = Math.min(sceneCount, progress?.visitedScenes.length ?? 0);
  const hasProgress = Boolean(progress && completedCount > 0);
  const statusItems = useMemo(
    () => [
      { label: "场景", value: `${sceneCount}` },
      { label: "互动任务", value: `${taskCount}` },
      { label: "已完成", value: `${completedCount}/${sceneCount}` },
    ],
    [completedCount, sceneCount, taskCount],
  );

  useEffect(() => {
    return () => {
      if (cursorResetRef.current) {
        window.clearTimeout(cursorResetRef.current);
      }
    };
  }, []);

  const updateCursorFromTarget = (target: EventTarget | null) => {
    const element = target instanceof Element ? target.closest<HTMLElement>("[data-cursor-target]") : null;
    const targetMode = element?.dataset.cursorTarget;
    const nextMode: CursorMode =
      targetMode === "menu" || targetMode === "tool" || targetMode === "disabled" ? targetMode : "idle";
    const nextLabel = element?.dataset.cursorLabel ?? "";

    setCursor((current) =>
      current.mode === nextMode && current.label === nextLabel
        ? current
        : {
            ...current,
            mode: nextMode,
            label: nextLabel,
          },
    );
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty("--cursor-x", `${event.clientX}px`);
    event.currentTarget.style.setProperty("--cursor-y", `${event.clientY}px`);
    updateCursorFromTarget(event.target);
  };

  const handlePointerDown = () => {
    if (cursorResetRef.current) {
      window.clearTimeout(cursorResetRef.current);
    }
    setCursor((current) => ({ ...current, pressed: true }));
  };

  const handlePointerUp = () => {
    if (cursorResetRef.current) {
      window.clearTimeout(cursorResetRef.current);
    }
    cursorResetRef.current = window.setTimeout(() => {
      setCursor((current) => ({ ...current, pressed: false }));
    }, 120);
  };

  return (
    <main
      className="menu-shell"
      data-cursor-mode={cursor.mode}
      data-cursor-pressed={cursor.pressed ? "true" : "false"}
      data-petals={petalsOn ? "on" : "off"}
      data-light={lightOn ? "on" : "off"}
      aria-label="入画文游首页"
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={() => setCursor((current) => ({ ...current, mode: "idle", label: "", pressed: false }))}
    >
      <div className="spirit-cursor" aria-hidden="true">
        <span className="spirit-cursor__core" />
        <span className="spirit-cursor__ring" />
        <span className="spirit-cursor__spark spirit-cursor__spark--one" />
        <span className="spirit-cursor__spark spirit-cursor__spark--two" />
        {cursor.label ? <span className="spirit-cursor__label">{cursor.label}</span> : null}
      </div>
      <div className="menu-bg" aria-hidden="true" />
      <div className="menu-bg-light" aria-hidden="true" />
      <div className="menu-vignette" aria-hidden="true" />
      <div className="menu-mist menu-mist--far" aria-hidden="true" />
      <div className="menu-mist menu-mist--near" aria-hidden="true" />

      {lightOn ? (
        <div className="firefly-layer" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, index) => (
            <span
              key={index}
              style={
                {
                  "--x": `${8 + ((index * 37) % 84)}vw`,
                  "--y": `${12 + ((index * 29) % 72)}vh`,
                  "--delay": `${index * -0.37}s`,
                  "--size": `${2 + (index % 3)}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}

      {petalsOn ? (
        <div className="menu-petals" aria-hidden="true">
          {Array.from({ length: 30 }).map((_, index) => (
            <span
              key={index}
              style={
                {
                  "--left": `${(index * 17) % 100}%`,
                  "--top": `${-18 - ((index * 11) % 78)}vh`,
                  "--delay": `${index * -0.78}s`,
                  "--duration": `${11 + (index % 7)}s`,
                  "--drift": `${index % 2 === 0 ? "-" : ""}${26 + ((index * 13) % 72)}px`,
                  "--scale": `${0.72 + (index % 5) * 0.12}`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}

      <div className="status-bar" aria-label="课程状态">
        {statusItems.map((item) => (
          <span key={item.label}>
            {item.label} <em>{item.value}</em>
          </span>
        ))}
      </div>

      <section className="menu-stage" aria-labelledby="home-title">
        <div className="title-lockup">
          <Image
            src="/assets/taohuayuanji/ui/ruhua-wenyou-title-transparent.png"
            alt="入画文游"
            width={1544}
            height={393}
            className="brush-title"
            priority
          />
          <h1 id="home-title" className="lesson-title">
            <span />
            桃花源记
            <span />
          </h1>
        </div>

        <div className="main-menu" aria-label="首页入口">
          {MENU_ITEMS.map((item) => (
            <MenuPlaque key={item.label} item={item} disabled={item.requiresProgress && !hasProgress} />
          ))}
        </div>

        <p className="menu-quote">
          <span />
          循文而入，游于画中
          <span />
        </p>
      </section>

      <nav className="side-tools" aria-label="快捷工具">
        <button
          type="button"
          aria-label="查看成就"
          aria-expanded={achievementOpen}
          aria-controls="home-achievements"
          data-cursor-target="tool"
          data-cursor-label="成就"
          onClick={() => {
            setSettingsOpen(false);
            setAchievementOpen((value) => !value);
          }}
        >
          <Trophy size={23} />
          <span>成就</span>
        </button>
        <button
          type="button"
          aria-label="打开首页设置"
          aria-expanded={settingsOpen}
          aria-controls="home-settings"
          data-cursor-target="tool"
          data-cursor-label="设置"
          onClick={() => {
            setAchievementOpen(false);
            setSettingsOpen((value) => !value);
          }}
        >
          <Settings size={23} />
          <span>设置</span>
        </button>
      </nav>

      {achievementOpen ? (
        <aside className="menu-popover achievement-popover" id="home-achievements" aria-label="成就预览">
          <Trophy size={22} />
          <strong>{hasProgress ? "桃源初见" : "尚未入画"}</strong>
          <span>
            完成 {completedCount}/{sceneCount} 个场景
            {hasProgress ? "，继续游历可接续上次进度。" : "，进入任意场景后解锁第一枚成就。"}
          </span>
        </aside>
      ) : null}

      {settingsOpen ? (
        <aside className="menu-popover settings-popover" id="home-settings" aria-label="首页设置">
          <button
            type="button"
            className="setting-row"
            aria-pressed={petalsOn}
            data-cursor-target="tool"
            data-cursor-label="花瓣动效"
            onClick={() => setPetalsOn((v) => !v)}
          >
            <span>
              <Sparkles size={17} />
              花瓣动效
            </span>
            <strong>{petalsOn ? "开" : "关"}</strong>
          </button>
          <button
            type="button"
            className="setting-row"
            aria-pressed={lightOn}
            data-cursor-target="tool"
            data-cursor-label="光效动效"
            onClick={() => setLightOn((v) => !v)}
          >
            <span>
              <Flame size={17} />
              光效动效
            </span>
            <strong>{lightOn ? "开" : "关"}</strong>
          </button>
        </aside>
      ) : null}
    </main>
  );
}
