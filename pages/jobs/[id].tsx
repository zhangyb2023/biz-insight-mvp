import Head from "next/head";
import type { GetServerSideProps } from "next";
import { useMemo } from "react";

import { WorkflowLiveMap } from "@/components/WorkflowLiveMap";
import { formatShanghaiDateTime } from "@/lib/format";
import { getJobDetails } from "@/lib/db/repository";

type Props = NonNullable<ReturnType<typeof getJobDetails>>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const jobId = Number(context.params?.id);
  const data = getJobDetails(jobId);
  if (!data) {
    return { notFound: true };
  }
  return { props: data };
};

export default function JobDetailPage({ job, steps }: Props) {
  const stepStates = Object.fromEntries(
    steps.map((step) => [
      step.step_name,
      step.status === "success" ? "success" : step.status === "failed" ? "failed" : step.status === "fallback" ? "fallback" : step.status === "skipped" ? "skipped" : "idle"
    ])
  ) as Record<string, "idle" | "success" | "failed" | "fallback" | "skipped">;
  const grouped = useMemo(() => {
    const companies = new Map<
      string,
      {
        companyId: string;
        failureCount: number;
        urls: Array<{
          url: string;
          steps: typeof steps;
          failureCount: number;
          hasFailure: boolean;
        }>;
      }
    >();

    for (const step of steps) {
      const companyId = step.company_id || "unknown";
      const url = step.source_url || "unknown";
      if (!companies.has(companyId)) {
        companies.set(companyId, { companyId, failureCount: 0, urls: [] });
      }
      const company = companies.get(companyId)!;
      let urlGroup = company.urls.find((item) => item.url === url);
      if (!urlGroup) {
        urlGroup = { url, steps: [], failureCount: 0, hasFailure: false };
        company.urls.push(urlGroup);
      }
      urlGroup.steps.push(step);
      if (step.status === "failed") {
        urlGroup.failureCount += 1;
        urlGroup.hasFailure = true;
        company.failureCount += 1;
      }
    }

    return [...companies.values()]
      .map((company) => ({
        ...company,
        urls: company.urls.sort((left, right) => right.failureCount - left.failureCount || left.url.localeCompare(right.url))
      }))
      .sort((left, right) => right.failureCount - left.failureCount || left.companyId.localeCompare(right.companyId));
  }, [steps]);

  return (
    <>
      <Head>
        <title>Job {job.id} | Biz Insight MVP</title>
      </Head>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-moss">Job Detail</p>
            <h1 className="mt-2 text-4xl font-semibold text-ink">任务 #{job.id}</h1>
            <p className="mt-3 text-sm text-slate-600">
              {job.trigger_type} / {job.status} / {formatShanghaiDateTime(job.started_at)}
            </p>
          </div>
          <div className="flex gap-3">
            <a href={`/api/export/job/${job.id}`} className="inline-flex rounded-full bg-ember px-5 py-3 text-sm font-semibold text-white">
              导出任务 Excel
            </a>
            <a href="/jobs" className="inline-flex rounded-full bg-moss px-5 py-3 text-sm font-semibold text-white">
              返回任务中心
            </a>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-5">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel">成功 {job.success_count}</div>
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel">失败 {job.failure_count}</div>
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel">缓存 {job.cache_hit_count}</div>
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel">变化 {job.changed_count}</div>
          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel">洞察 {job.insight_count}</div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink">工作模式活流程图</h2>
                <p className="mt-2 text-sm text-slate-600">
                  这里和智能爬虫系统共用同一套 10 步流程图。绿色表示本任务已经成功执行，红色表示这里出过错。
                </p>
            </div>
            <a href="/learn" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              去智能爬虫系统对照
            </a>
          </div>
          <div className="mt-5">
            <WorkflowLiveMap stepStates={stepStates} />
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel backdrop-blur">
          <h2 className="text-xl font-semibold text-ink">步骤轨迹</h2>
          <p className="mt-2 text-sm text-slate-600">这里按公司、URL、步骤分组，先看哪家公司、哪个网址出了问题，再点进 Trace 和 Inspector。</p>
          <div className="mt-5 space-y-6">
            {grouped.map((company) => (
              <details key={company.companyId} open={company.failureCount > 0} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-ink">公司：{company.companyId}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${company.failureCount > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {company.failureCount > 0 ? `${company.failureCount} 个失败步骤` : "无失败"}
                    </span>
                  </div>
                </summary>
                <div className="mt-4 space-y-4">
                  {company.urls.map((urlGroup) => (
                    <details
                      key={urlGroup.url}
                      open={urlGroup.hasFailure}
                      className={`rounded-2xl border p-4 ${urlGroup.hasFailure ? "border-red-200 bg-red-50/40" : "border-slate-100 bg-white"}`}
                    >
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-start justify-between gap-4">
                          <p className="break-all text-sm font-semibold text-ink">{urlGroup.url}</p>
                          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${urlGroup.hasFailure ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                            {urlGroup.hasFailure ? "优先排查" : "正常"}
                          </span>
                        </div>
                      </summary>
                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="text-slate-500">
                            <tr>
                              <th className="px-3 py-2">步骤</th>
                              <th className="px-3 py-2">顺序</th>
                              <th className="px-3 py-2">状态</th>
                              <th className="px-3 py-2">工具</th>
                              <th className="px-3 py-2">耗时</th>
                              <th className="px-3 py-2">查看</th>
                            </tr>
                          </thead>
                          <tbody>
                            {urlGroup.steps.map((step) => (
                              <tr key={step.id} className="border-t border-slate-100">
                                <td className="px-3 py-3">{step.step_name}</td>
                                <td className="px-3 py-3">{step.step_order}</td>
                                <td className={`px-3 py-3 ${step.status === "failed" ? "font-semibold text-red-700" : ""}`}>{step.status}</td>
                                <td className="px-3 py-3">{step.tool_name}</td>
                                <td className="px-3 py-3">{step.duration_ms ?? "-"} ms</td>
                                <td className="px-3 py-3">
                                  <div className="flex gap-3">
                                    <a href={`/trace/${step.id}`}>追踪</a>
                                    <a href={`/inspector/${step.id}`}>检查</a>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
