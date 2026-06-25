import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpenText, Clock3, MapPinned, Play, ShieldCheck } from "lucide-react";

import { loadInterrogationConfig, loadLessonBundle } from "@/lib/lesson-loader";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [bundle, interrogation] = await Promise.all([
    loadLessonBundle(id),
    loadInterrogationConfig(id),
  ]).catch(() => notFound());

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090705] text-[#f7ead2]">
      <Image
        src={bundle.lesson.coverImage}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,6,4,0.95)_0%,rgba(8,6,4,0.74)_42%,rgba(8,6,4,0.18)_100%),linear-gradient(180deg,rgba(8,6,4,0.12)_0%,rgba(8,6,4,0.82)_100%)]" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,244,220,0.025)_0_1px,transparent_1px_5px)] mix-blend-screen" />

      <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-8 px-5 py-5 md:px-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:py-8">
        <aside className="flex flex-col justify-between gap-6 rounded-lg border border-[#d6a86c]/20 bg-[#0d0906]/60 p-4 backdrop-blur-xl lg:min-h-[calc(100vh-4rem)]">
          <div>
            <Link
              href="/"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#f7e7c8] transition hover:border-[#d6a86c]/60 hover:bg-[#d6a86c]/10"
              aria-label="返回首页"
            >
              <ArrowLeft size={19} />
            </Link>
            <div className="mt-8">
              <p className="text-xs font-semibold tracking-[0.22em] text-[#d6a86c]">入画文游</p>
              <h1 className="mt-3 font-serif text-4xl font-semibold tracking-normal text-[#fff1d6]">
                {bundle.lesson.title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#d7c4a8]">
                {bundle.lesson.author} · {bundle.lesson.era}
              </p>
            </div>
          </div>

          <div className="grid gap-2 text-sm">
            <Link
              href={`/learn/${bundle.lesson.lessonId}`}
              className="inline-flex min-h-12 items-center justify-between rounded-lg border border-[#d6a86c]/35 bg-[#9f6830]/70 px-4 font-semibold text-[#fff8ec] transition hover:-translate-y-0.5 hover:border-[#d6a86c]/70"
            >
              <span className="inline-flex items-center gap-2">
                <Play size={17} fill="currentColor" />
                开始穿越
              </span>
            </Link>
            <Link
              href={`/guard/${bundle.lesson.lessonId}`}
              className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-[#4da39a]/35 bg-[#123b36]/66 px-4 font-semibold text-[#dff7ef] transition hover:-translate-y-0.5 hover:border-[#4da39a]/70"
            >
              <ShieldCheck size={17} />
              桃源守密局
            </Link>
          </div>
        </aside>

        <div className="flex items-center">
          <article className="w-full max-w-4xl rounded-lg border border-[#d6a86c]/22 bg-[#150f0a]/72 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-xl md:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] text-[#d6a86c]">课文档案</p>
                <h2 className="mt-2 font-serif text-3xl font-semibold text-[#fff1d6] md:text-5xl">
                  入境之前
                </h2>
              </div>
              <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-white/10 text-center text-xs">
                {[
                  ["场景", bundle.scenes.length],
                  ["互动", interrogation.turns.length],
                  ["问题", bundle.lesson.suggestedQuestions.length],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-20 bg-white/5 px-3 py-2">
                    <strong className="block text-lg text-[#ffe4b4]">{value}</strong>
                    <span className="tracking-[0.16em] text-[#bda98b]">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="max-w-3xl text-base leading-8 text-[#ead8bd]">{bundle.lesson.intro}</p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                {
                  icon: <Clock3 size={18} />,
                  label: "预计时长",
                  value: "12-18 分钟",
                  note: "适合一次完整游历",
                },
                {
                  icon: <MapPinned size={18} />,
                  label: "路线结构",
                  value: "入境 · 桃源 · 归途",
                  note: `${bundle.scenes.length} 段场景串联原文脉络`,
                },
                {
                  icon: <ShieldCheck size={18} />,
                  label: "挑战衔接",
                  value: "桃源守密局",
                  note: `${interrogation.turns.length} 轮盘问检验文本理解`,
                },
              ].map((item) => (
                <section key={item.label} className="rounded-lg border border-[#d6a86c]/18 bg-black/18 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-[#d6a86c]">
                    {item.icon}
                    {item.label}
                  </div>
                  <p className="mt-2 font-serif text-xl font-semibold text-[#fff0d0]">{item.value}</p>
                  <p className="mt-1 text-xs leading-5 text-[#bca98d]">{item.note}</p>
                </section>
              ))}
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
              <section>
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-[0.18em] text-[#d6a86c]">
                  <BookOpenText size={18} />
                  学习目标
                </h3>
                <ul className="space-y-3 text-sm leading-7 text-[#ead8bd]">
                  {bundle.knowledge.teachingGoals.map((goal) => (
                    <li key={goal} className="border-l border-[#d6a86c]/34 pl-4">
                      {goal}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-lg border border-white/10 bg-black/20 p-4">
                <h3 className="text-sm font-semibold tracking-[0.18em] text-[#d6a86c]">推荐思考</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-[#d7c4a8]">
                  {bundle.lesson.suggestedQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/learn/${bundle.lesson.lessonId}`}
                className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#b57a38] px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#c88b44]"
              >
                <Play size={18} fill="currentColor" />
                进入课文世界
              </Link>
              <Link
                href="/"
                className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-[#d6a86c]/30 bg-white/5 px-5 text-sm font-semibold text-[#f3dfbd] transition hover:-translate-y-0.5 hover:border-[#d6a86c]/65"
              >
                返回课程启动器
              </Link>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
