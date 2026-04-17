import type { SessionSummary } from "@/types/session";

interface SummaryCardProps {
  summary: SessionSummary;
}

export function SummaryCard({ summary }: SummaryCardProps) {
  const knowledgeEntries = Object.entries(summary.knowledgeProgress);

  return (
    <section className="rounded-2xl border border-white/30 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
      <h1 className="text-2xl font-semibold text-slate-900">学习总结</h1>
      <p className="mt-1 text-sm text-slate-600">会话编号：{summary.sessionId}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">已探索场景</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {summary.exploredScenes.map((sceneId) => (
              <li key={sceneId}>{sceneId}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">已完成任务</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {summary.completedTasks.length > 0 ? (
              summary.completedTasks.map((taskId) => <li key={taskId}>{taskId}</li>)
            ) : (
              <li>本次未标记任务完成。</li>
            )}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">提问记录摘要</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {summary.questionSummary.length > 0 ? (
              summary.questionSummary.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)
            ) : (
              <li>本次会话暂无提问记录。</li>
            )}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">知识点掌握情况</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {knowledgeEntries.map(([tag, passed]) => (
              <li key={tag}>
                {tag}：{passed ? "已触发" : "待加强"}
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-4">
        <h2 className="mb-2 text-sm font-semibold text-teal-900">建议继续学习的问题</h2>
        <ul className="space-y-1 text-sm text-teal-900">
          {summary.recommendations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}
