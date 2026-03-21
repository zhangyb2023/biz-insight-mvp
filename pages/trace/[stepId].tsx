import Head from "next/head";
import type { GetServerSideProps } from "next";

import { WorkflowLiveMap } from "@/components/WorkflowLiveMap";
import { formatShanghaiDateTime } from "@/lib/format";
import { getStepDetails } from "@/lib/db/repository";

type Props = {
  step: NonNullable<ReturnType<typeof getStepDetails>>;
};

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const stepId = Number(context.params?.stepId);
  const step = getStepDetails(stepId);
  if (!step) {
    return { notFound: true };
  }
  return { props: { step } };
};

export default function TracePage({ step }: Props) {
  const stepStates = {
    [step.step_name]:
      step.status === "success"
        ? "success"
        : step.status === "failed"
          ? "failed"
          : step.status === "fallback"
            ? "fallback"
            : step.status === "skipped"
              ? "skipped"
              : "running"
  } as Record<string, "running" | "success" | "failed" | "fallback" | "skipped">;

  return (
    <>
      <Head>
        <title>Trace {step.id} | Biz Insight MVP</title>
      </Head>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-moss">Workflow Trace</p>
            <h1 className="mt-2 text-4xl font-semibold text-ink">{step.step_name}</h1>
            <p className="mt-3 text-sm text-slate-600">
              这是工作模式里的单步骤定位页。智能爬虫系统先理解原理，这里再专注排查当前节点。
            </p>
          </div>
          <a href={`/jobs/${step.job_id}`} className="inline-flex rounded-full bg-moss px-5 py-3 text-sm font-semibold text-white">
            返回任务详情
          </a>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel">状态：{step.status}</div>
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel">工具：{step.tool_name}</div>
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel">耗时：{step.duration_ms ?? "-"} ms</div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink">当前节点在整条流程中的位置</h2>
                <p className="mt-2 text-sm text-slate-600">
                  智能爬虫系统和工作模式共用同一张活流程图。当前 Trace 页只高亮你正在查看的这个节点。
                </p>
            </div>
            <a href="/learn" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              去智能爬虫系统对照
            </a>
          </div>
          <div className="mt-5">
            <WorkflowLiveMap currentStepKey={step.step_name} stepStates={stepStates} compact />
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
            <h2 className="text-xl font-semibold text-ink">步骤元信息</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div><dt className="text-slate-500">step_order</dt><dd>{step.step_order}</dd></div>
              <div><dt className="text-slate-500">tool_type</dt><dd>{step.tool_type}</dd></div>
              <div><dt className="text-slate-500">tool_name</dt><dd>{step.tool_name}</dd></div>
              <div><dt className="text-slate-500">module/file</dt><dd>{step.module_name}</dd></div>
              <div><dt className="text-slate-500">runtime</dt><dd>{step.runtime}</dd></div>
              <div><dt className="text-slate-500">retry_count</dt><dd>{step.retry_count}</dd></div>
              <div><dt className="text-slate-500">fallback_used</dt><dd>{step.fallback_used ? "是" : "否"}</dd></div>
              <div><dt className="text-slate-500">next_step</dt><dd>{step.next_step || "-"}</dd></div>
              <div><dt className="text-slate-500">start_time</dt><dd>{formatShanghaiDateTime(step.start_time)}</dd></div>
              <div><dt className="text-slate-500">end_time</dt><dd>{formatShanghaiDateTime(step.end_time)}</dd></div>
            </dl>
          </article>
          <article className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
            <h2 className="text-xl font-semibold text-ink">步骤说明模式</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p>作用：定位当前步骤的输入、输出和落点，判断问题属于网页配置可调还是必须改代码。</p>
              <p>常见失败原因：网络超时、页面结构变化、HTML 噪音过高、LLM 非 JSON。</p>
              <p>可优化方向：优先改来源配置、URL 类型、关键词、TTL；如果仍不稳定，再改抓取器或抽取算法。</p>
            </div>
          </article>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
            <h2 className="text-xl font-semibold text-ink">输入 JSON</h2>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
              {step.input_json || "{}"}
            </pre>
          </article>
          <article className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
            <h2 className="text-xl font-semibold text-ink">输出 JSON</h2>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
              {step.output_json || "{}"}
            </pre>
          </article>
        </section>

        {step.error_message ? (
          <section className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-6">
            <h2 className="text-xl font-semibold text-red-700">错误信息</h2>
            <pre className="mt-4 whitespace-pre-wrap text-sm text-red-700">{step.error_message}</pre>
          </section>
        ) : null}
      </main>
    </>
  );
}
