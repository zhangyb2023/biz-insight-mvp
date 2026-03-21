import Head from "next/head";
import type { GetServerSideProps } from "next";

import { WorkflowLiveMap } from "@/components/WorkflowLiveMap";
import { formatShanghaiDateTime } from "@/lib/format";
import { getInspectorData } from "@/lib/db/repository";

type Props = NonNullable<ReturnType<typeof getInspectorData>>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const stepId = Number(context.params?.stepId);
  const data = getInspectorData(stepId);
  if (!data) {
    return { notFound: true };
  }
  return { props: data };
};

function prettyJson(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

export default function InspectorPage(props: Props) {
  const { step, llmRun, version, sourceRegistry } = props;
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
        <title>I/O Inspector {step.id} | Biz Insight MVP</title>
      </Head>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-moss">I/O Inspector</p>
            <h1 className="mt-2 text-4xl font-semibold text-ink">{step.step_name}</h1>
            <p className="mt-3 text-sm text-slate-600">
              这里用于查看某一步的输入、输出、版本信息、LLM 原始响应和配置上下文。智能爬虫系统先理解这一步原理，工作模式在这里看细节。
            </p>
          </div>
          <div className="flex gap-3">
            <a href="/learn" className="inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink ring-1 ring-slate-200">
              智能爬虫系统
            </a>
            <a href={`/trace/${step.id}`} className="inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink ring-1 ring-slate-200">
              返回追踪页
            </a>
            <a href={`/jobs/${step.job_id}`} className="inline-flex rounded-full bg-moss px-5 py-3 text-sm font-semibold text-white">
              返回任务详情
            </a>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel">步骤状态：{step.status}</div>
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel">工具：{step.tool_name}</div>
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel">耗时：{step.duration_ms ?? "-"} ms</div>
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel">Fallback：{step.fallback_used ? "是" : "否"}</div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink">这一步在整条流程中的位置</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Inspector 也共用智能爬虫系统的活流程图。你可以先在图上定位节点，再往下看输入输出和原始数据。
                </p>
            </div>
          </div>
          <div className="mt-5">
            <WorkflowLiveMap currentStepKey={step.step_name} stepStates={stepStates} compact />
          </div>
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

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
            <h2 className="text-xl font-semibold text-ink">版本与正文检查</h2>
            {version ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <div>
                    <p className="text-slate-500">content_hash</p>
                    <p className="break-all text-ink">{version.content_hash}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">last_checked_at</p>
                    <p className="text-ink">{formatShanghaiDateTime(version.last_checked_at)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">last_fetched_at</p>
                    <p className="text-ink">{formatShanghaiDateTime(version.last_fetched_at)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">last_changed_at</p>
                    <p className="text-ink">{formatShanghaiDateTime(version.last_changed_at)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">clean_text 预览</p>
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-xs text-slate-700">
                    {version.clean_text.slice(0, 3000)}
                  </pre>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">extracted_items</p>
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-xs text-slate-700">
                    {prettyJson(version.extracted_items)}
                  </pre>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">原始 HTML 预览</p>
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                    {version.html_snapshot.slice(0, 3000)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">当前步骤没有关联版本数据。</p>
            )}
          </article>

          <article className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
            <h2 className="text-xl font-semibold text-ink">LLM 透明信息</h2>
            {llmRun ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <div><p className="text-slate-500">provider</p><p>{llmRun.provider}</p></div>
                  <div><p className="text-slate-500">model_name</p><p>{llmRun.model_name}</p></div>
                  <div><p className="text-slate-500">prompt_version</p><p>{llmRun.prompt_version}</p></div>
                  <div><p className="text-slate-500">status</p><p>{llmRun.status}</p></div>
                  <div><p className="text-slate-500">fallback_used</p><p>{llmRun.fallback_used ? "是" : "否"}</p></div>
                  <div><p className="text-slate-500">retry_count</p><p>{llmRun.retry_count}</p></div>
                  <div><p className="text-slate-500">created_at</p><p>{formatShanghaiDateTime(llmRun.created_at)}</p></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">input payload</p>
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-xs text-slate-700">
                    {llmRun.input_payload_json}
                  </pre>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">raw response</p>
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                    {llmRun.raw_response || "(empty)"}
                  </pre>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">parsed JSON</p>
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-xs text-slate-700">
                    {llmRun.parsed_json}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">当前步骤没有关联 LLM 运行记录。</p>
            )}

            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="text-lg font-semibold text-ink">来源配置上下文</h3>
              {sourceRegistry ? (
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-xs text-slate-700">
                  {prettyJson(sourceRegistry)}
                </pre>
              ) : (
                <p className="mt-2 text-sm text-slate-500">当前步骤没有来源配置记录。</p>
              )}
            </div>
          </article>
        </section>

        {step.error_message ? (
          <section className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-6">
            <h2 className="text-xl font-semibold text-red-700">错误详情</h2>
            <pre className="mt-4 whitespace-pre-wrap text-sm text-red-700">{step.error_message}</pre>
          </section>
        ) : null}
      </main>
    </>
  );
}
