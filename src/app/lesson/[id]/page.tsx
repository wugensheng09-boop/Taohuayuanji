import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { loadLessonBundle } from "@/lib/lesson-loader";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await loadLessonBundle(id).catch(() => notFound());

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-100 via-orange-50 to-sky-100 p-6">
      <section className="mx-auto max-w-4xl rounded-3xl border border-white/35 bg-white/75 p-8 shadow-sm backdrop-blur-sm">
        <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-slate-200">
          <Image
            src={bundle.lesson.coverImage}
            alt={bundle.lesson.title}
            fill
            sizes="(max-width: 1024px) 100vw, 896px"
            className="object-cover"
          />
        </div>

        <h1 className="mt-6 text-3xl font-semibold text-slate-900">{bundle.lesson.title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          作者：{bundle.lesson.author}（{bundle.lesson.era}）
        </p>
        <p className="mt-4 text-base leading-7 text-slate-700">{bundle.lesson.intro}</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">学习目标</h2>
            <ul className="space-y-1 text-sm text-slate-700">
              {bundle.knowledge.teachingGoals.map((goal) => (
                <li key={goal}>· {goal}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">推荐思考问题</h2>
            <ul className="space-y-1 text-sm text-slate-700">
              {bundle.lesson.suggestedQuestions.map((question) => (
                <li key={question}>· {question}</li>
              ))}
            </ul>
          </article>
        </div>

        <div className="mt-6 flex gap-3">
          <Link
            href={`/learn/${bundle.lesson.lessonId}`}
            className="rounded-xl bg-amber-700 px-5 py-3 text-sm font-medium text-white hover:bg-amber-800"
          >
            开始沉浸体验
          </Link>
          <Link href="/" className="rounded-xl border border-slate-300 px-5 py-3 text-sm text-slate-800">
            返回首页
          </Link>
        </div>
      </section>
    </main>
  );
}
