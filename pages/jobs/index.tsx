import Head from "next/head";
import type { GetServerSideProps } from "next";

import { formatShanghaiDateTime } from "@/lib/format";
import { getJobs, loadCompanies, syncCompanies } from "@/lib/db/repository";

type Props = {
  jobs: ReturnType<typeof getJobs>;
};

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  syncCompanies(loadCompanies());
  return {
    props: {
      jobs: getJobs()
    }
  };
};

export default function JobsPage({ jobs }: Props) {
  return (
    <>
      <Head>
        <title>Job Center | Biz Insight MVP</title>
      </Head>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-moss">Job Center</p>
            <h1 className="mt-2 text-4xl font-semibold text-ink">任务中心</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              工作模式里用它看整批任务。智能爬虫系统先在 <a href="/learn" className="font-semibold text-moss">智能爬虫系统</a> 了解原理，再来这里看批次级统计和错误。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/learn" className="inline-flex rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
              智能爬虫系统
            </a>
            <a href="/" className="inline-flex rounded-full bg-moss px-5 py-3 text-sm font-semibold text-white">
              返回首页
            </a>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-lg font-semibold text-ink">这页怎么用</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4 text-sm leading-7 text-slate-700">
            <div className="rounded-2xl bg-white p-4">
              <p className="font-semibold text-ink">页面作用</p>
              <p className="mt-2">看任务批次、成功失败、缓存命中、变化数和导出入口。</p>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <p className="font-semibold text-ink">先看什么</p>
              <p className="mt-2">先看失败数和状态，再决定是去任务详情还是直接去错误中心。</p>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <p className="font-semibold text-ink">出了问题看哪里</p>
              <p className="mt-2">先看失败数，再点任务详情，继续进入 Trace 和 I/O Inspector。</p>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <p className="font-semibold text-ink">能否网页改</p>
              <p className="mt-2">这里主要是查看和导出，不负责改抓取规则。规则调整请去来源管理或找工程师。</p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <a href="/sources" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
            <p className="font-semibold text-ink">1. 先回来源管理</p>
            <p className="mt-2">如果任务整体不对，先确认来源网址、关键词和检查/爬取方式是否合理。</p>
          </a>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
            <p className="font-semibold text-ink">2. 再看任务状态</p>
            <p className="mt-2">重点看失败数、缓存命中、变化数，快速判断这批任务值不值得深挖。</p>
          </div>
          <a href="/errors" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
            <p className="font-semibold text-ink">3. 有问题去排障</p>
            <p className="mt-2">如果失败数不为 0 或大量 fallback，直接去错误中心，不用先翻完整表。</p>
          </a>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
            <p className="font-semibold text-ink">4. 最后导出</p>
            <p className="mt-2">确认任务正常后，再导出任务级 Excel 做复盘或交给其它人使用。</p>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink">任务列表</h2>
              <p className="mt-2 text-sm text-slate-600">先看失败，再看缓存命中和变化数，最后再决定是否导出或进入详情。</p>
            </div>
            <a href="/errors" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              先去错误中心
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-3 py-2">任务 ID</th>
                  <th className="px-3 py-2">触发方式</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">开始时间</th>
                  <th className="px-3 py-2">耗时</th>
                  <th className="px-3 py-2">公司数</th>
                  <th className="px-3 py-2">URL 数</th>
                  <th className="px-3 py-2">成功/失败</th>
                  <th className="px-3 py-2">缓存命中</th>
                  <th className="px-3 py-2">变化数</th>
                  <th className="px-3 py-2">洞察数</th>
                  <th className="px-3 py-2">详情</th>
                  <th className="px-3 py-2">导出</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-medium text-ink">{job.id}</td>
                    <td className="px-3 py-3">{job.trigger_type}</td>
                    <td className="px-3 py-3">{job.status}</td>
                    <td className="px-3 py-3">{formatShanghaiDateTime(job.started_at)}</td>
                    <td className="px-3 py-3">{job.duration_ms ?? "-"} ms</td>
                    <td className="px-3 py-3">{job.company_count}</td>
                    <td className="px-3 py-3">{job.url_count}</td>
                    <td className="px-3 py-3">
                      {job.success_count}/{job.failure_count}
                    </td>
                    <td className="px-3 py-3">{job.cache_hit_count}</td>
                    <td className="px-3 py-3">{job.changed_count}</td>
                    <td className="px-3 py-3">{job.insight_count}</td>
                    <td className="px-3 py-3">
                      <a href={`/jobs/${job.id}`}>查看</a>
                    </td>
                    <td className="px-3 py-3">
                      <a href={`/api/export/job/${job.id}`}>Excel</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
