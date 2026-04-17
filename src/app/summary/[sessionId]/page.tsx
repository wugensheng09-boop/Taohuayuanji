import Link from "next/link";

import { SummaryCard } from "@/components/SummaryCard";
import { loadLessonBundle } from "@/lib/lesson-loader";
import { generateSessionSummary, getSession } from "@/lib/session-store";

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = getSession(sessionId);

  if (!session) {
    return (
      <main className="min-h-screen bg-amber-50 p-6">
        <section className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-amber-900">未找到学习会话</h1>
          <p className="mt-2 text-sm text-amber-800">当前会话可能已过期，请重新进入课程开始新的探索。</p>
          <Link
            href="/learn/taohuayuanji"
            className="mt-4 inline-block rounded-xl bg-amber-700 px-4 py-2 text-sm text-white"
          >
            重新开始
          </Link>
        </section>
      </main>
    );
  }

  const bundle = await loadLessonBundle(session.lessonId);
  const summary = generateSessionSummary(sessionId, bundle);

  if (!summary) {
    return (
      <main className="min-h-screen bg-amber-50 p-6">
        <section className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-amber-900">暂时无法生成总结</h1>
          <Link
            href={`/learn/${session.lessonId}`}
            className="mt-4 inline-block rounded-xl bg-amber-700 px-4 py-2 text-sm text-white"
          >
            返回学习页
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-100 via-cyan-50 to-lime-100 p-6">
      <section className="mx-auto max-w-5xl">
        <SummaryCard summary={summary} />
        <div className="mt-4 flex gap-3">
          <Link
            href={`/learn/${summary.lessonId}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800"
          >
            返回继续学习
          </Link>
          <Link href="/" className="rounded-xl bg-teal-700 px-4 py-2 text-sm text-white">
            回到首页
          </Link>
        </div>
      </section>
    </main>
  );
}
