import Head from "next/head";
import type { GetServerSideProps } from "next";

import { formatShanghaiDateTime } from "@/lib/format";
import { getJobs, getErrorCenterItems, loadCompanies, syncCompanies } from "@/lib/db/repository";

type Props = {
  jobs: ReturnType<typeof getJobs>;
  errors: ReturnType<typeof getErrorCenterItems>;
};

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  syncCompanies(loadCompanies());
  return {
    props: {
      jobs: getJobs(),
      errors: getErrorCenterItems(),
    }
  };
};

type ErrorGroup = {
  type: string;
  count: number;
  examples: string[];
  suggestion: string;
  action: string;
};

function groupErrors(errors: Props['errors']): ErrorGroup[] {
  const groups: Record<string, { count: number; examples: Set<string>; suggestion: string; action: string }> = {};
  
  for (const err of errors) {
    const msg = err.error_message || "未知错误";
    let type = "其他错误";
    let suggestion = "记录错误信息，联系开发人员排查";
    let action = "反馈给开发";

    if (msg.includes("firecrawl") || msg.includes("Firecrawl")) {
      type = "Firecrawl API 问题";
      suggestion = "可能是 API Key 过期、额度用完或服务暂时不可用";
      action = "检查 .env.local 里的 FIRECRAWL_API_KEY 是否有效";
    } else if (msg.includes("timeout") || msg.includes("Timeout") || msg.includes("超时")) {
      type = "抓取超时";
      suggestion = "目标网站响应慢或不稳定";
      action = "目标网站可能需要减慢抓取频率或调整超时设置";
    } else if (msg.includes("404") || msg.includes("Not Found")) {
      type = "页面不存在";
      suggestion = "该 URL 可能已被删除或更改地址";
      action = "检查来源管理里该 URL 是否还需要";
    } else if (msg.includes("403") || msg.includes("Forbidden") || msg.includes("拒绝访问")) {
      type = "访问被拒绝";
      suggestion = "目标网站禁止爬取或需要登录";
      action = "可能需要换备选 URL 或移除该来源";
    } else if (msg.includes("解析") || msg.includes("parse") || msg.includes("extract")) {
      type = "内容解析失败";
      suggestion = "网页结构变化，正则或选择器失效";
      action = "联系开发更新解析规则";
    } else if (msg.includes("LLM") || msg.includes("DeepSeek") || msg.includes("api")) {
      type = "LLM 接口问题";
      suggestion = "可能是 DeepSeek API 限流、Key 无效或网络问题";
      action = "检查 DEEPSEEK_API_KEY 是否有效或联系开发";
    } else if (msg.includes("数据库") || msg.includes("database") || msg.includes("SQL")) {
      type = "数据库问题";
      suggestion = "数据写入失败，可能是数据损坏或权限问题";
      action = "联系开发检查数据库状态";
    } else if (msg.includes("缓存") || msg.includes("cache")) {
      type = "缓存问题";
      suggestion = "缓存读取或写入失败";
      action = "检查缓存目录权限";
    } else if (msg.length < 20) {
      type = "简短错误";
      suggestion = "错误信息不完整，需要查看更多详情";
      action = "点进详情查看完整错误信息";
    }

    if (!groups[type]) {
      groups[type] = { count: 0, examples: new Set(), suggestion, action };
    }
    groups[type].count++;
    if (groups[type].examples.size < 2) {
      groups[type].examples.add(msg.slice(0, 80));
    }
  }

  return Object.entries(groups).map(([type, data]) => ({
    type,
    count: data.count,
    examples: Array.from(data.examples),
    suggestion: data.suggestion,
    action: data.action,
  })).sort((a, b) => b.count - a.count);
}

export default function SystemHealthPage({ jobs, errors }: Props) {
  const errorGroups = groupErrors(errors);
  const recentJobs = jobs.slice(0, 5);
  const totalErrors = errors.length;
  const healthyJobs = jobs.filter(j => j.failure_count === 0).length;

  return (
    <>
      <Head>
        <title>系统健康度 | Biz Insight</title>
      </Head>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">系统健康度</h1>
          <p className="text-sm text-slate-500 mt-1">快速了解抓取系统是否有问题，以及下一步该怎么做</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className={`rounded-2xl p-5 ${totalErrors === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
            <p className="text-sm font-medium text-slate-600">错误状态</p>
            <p className={`mt-2 text-3xl font-bold ${totalErrors === 0 ? "text-emerald-600" : "text-amber-600"}`}>
              {totalErrors === 0 ? "✅ 无错误" : `⚠️ ${totalErrors} 个错误`}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {totalErrors === 0 ? "系统运行正常" : "需要处理"}
            </p>
          </div>

          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-5">
            <p className="text-sm font-medium text-slate-600">最近任务</p>
            <p className="mt-2 text-3xl font-bold text-blue-600">{jobs.length} 个批次</p>
            <p className="text-xs text-slate-500 mt-1">
              最近 {recentJobs[0] ? formatShanghaiDateTime(recentJobs[0].started_at) : "-"}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
            <p className="text-sm font-medium text-slate-600">健康任务</p>
            <p className="mt-2 text-3xl font-bold text-slate-600">{healthyJobs} / {jobs.length}</p>
            <p className="text-xs text-slate-500 mt-1">
              无失败任务的批次数
            </p>
          </div>
        </div>

        {totalErrors > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-ink mb-3">❌ 错误分组</h2>
            <p className="text-sm text-slate-500 mb-4">同类错误归在一起，附上处理建议</p>
            
            <div className="space-y-3">
              {errorGroups.map((group) => (
                <div key={group.type} className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-ink">{group.type}</span>
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">{group.count} 次</span>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{group.suggestion}</p>
                      <details className="text-xs text-slate-500">
                        <summary className="cursor-pointer hover:text-slate-700">查看错误示例</summary>
                        <ul className="mt-1 space-y-0.5">
                          {group.examples.map((ex, i) => (
                            <li key={i} className="break-all">{ex}</li>
                          ))}
                        </ul>
                      </details>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700">
                        💡 {group.action}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {totalErrors === 0 && (
          <section className="mb-6">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center">
              <p className="text-2xl mb-2">🎉</p>
              <p className="font-semibold text-emerald-800">系统运行正常</p>
              <p className="text-sm text-emerald-600 mt-1">最近没有检测到错误，可以去 <a href="/insights" className="underline font-medium">商业洞察</a> 查看最新情报</p>
            </div>
          </section>
        )}

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-ink mb-3">📋 最近任务</h2>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">时间</th>
                  <th className="px-4 py-3 text-left font-medium">触发</th>
                  <th className="px-4 py-3 text-left font-medium">耗时</th>
                  <th className="px-4 py-3 text-left font-medium">结果</th>
                  <th className="px-4 py-3 text-left font-medium">缓存</th>
                  <th className="px-4 py-3 text-left font-medium">洞察</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{formatShanghaiDateTime(job.started_at)}</td>
                    <td className="px-4 py-3 text-slate-600">{job.trigger_type}</td>
                    <td className="px-4 py-3 text-slate-600">{job.duration_ms ? (job.duration_ms / 1000).toFixed(1) : "-"}s</td>
                    <td className="px-4 py-3">
                      {job.failure_count === 0 ? (
                        <span className="text-emerald-600">✅ 成功</span>
                      ) : (
                        <span className="text-red-600">⚠️ {job.failure_count} 失败</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{job.cache_hit_count}</td>
                    <td className="px-4 py-3 text-slate-500">{job.insight_count}</td>
                  </tr>
                ))}
                {recentJobs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">暂无任务记录</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-wrap gap-3 justify-between items-center">
          <div className="flex flex-wrap gap-3">
            <a href="/workbench" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              🔍 工作台
            </a>
            <a href="/insights" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              💡 商业洞察
            </a>
            <a href="/" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              🏠 首页
            </a>
          </div>
          {totalErrors > 0 && (
            <div className="text-sm text-slate-500">
              错误持续存在？<a href="/learn" className="text-moss underline">了解系统原理</a> 或联系开发
            </div>
          )}
        </section>
      </main>
    </>
  );
}
