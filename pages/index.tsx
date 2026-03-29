import Head from "next/head";
import type { GetServerSideProps } from "next";

import { getDashboardData } from "@/lib/db/repository";
import { formatShanghaiDateTime } from "@/lib/format";

type Props = ReturnType<typeof getDashboardData>;

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  return {
    props: getDashboardData()
  };
};

function formatCount(value?: number | null) {
  return Intl.NumberFormat("zh-CN").format(value ?? 0);
}

const modules = [
  {
    id: "overview",
    name: "系统总览",
    description: "了解整个商业洞察系统的工作原理和数据流程",
    href: "/overview",
    icon: "🗺️",
    color: "bg-slate-600"
  },
  {
    id: "insights",
    name: "商业洞察",
    description: "精选2026年后有明确发布时间的信息，结构化呈现洞察总结",
    href: "/insights",
    icon: "💡",
    color: "bg-emerald-600"
  },
  {
    id: "api-status",
    name: "API 状态监控",
    description: "实时监控 AI 模型和 API 服务状态，包括 DeepSeek、SiliconFlow 等",
    href: "/api-status",
    icon: "📊",
    color: "bg-cyan-600"
  },
  {
    id: "workbench",
    name: "工作台",
    description: "选择公司执行智能爬取，支持单选和多选，实时显示进度和关键指标",
    href: "/workbench",
    icon: "🔍",
    color: "bg-moss"
  },
  {
    id: "learn",
    name: "智能爬虫系统",
    description: "基于 Jina Reader + Firecrawl + Tavily 的三层智能爬取策略，94%+ 成功率",
    href: "/learn",
    icon: "🕷️",
    color: "bg-sky-600"
  },
  {
    id: "list-all",
    name: "动态信息列表",
    description: "查看所有已采集的新闻、动态和资讯，支持筛选和搜索",
    href: "/list-all",
    icon: "📰",
    color: "bg-amber-600"
  },
  {
    id: "health",
    name: "系统健康度",
    description: "查看错误分组和系统状态，快速定位问题和优化方向",
    href: "/health",
    icon: "📋",
    color: "bg-violet-600"
  },
  {
    id: "console",
    name: "公司管理",
    description: "查看、分组和维护公司对象及其来源网址",
    href: "/console",
    icon: "🏢",
    color: "bg-rose-600"
  }
];

export default function HomePage(props: Props) {
  const latestUpdateLabel = props.stats.latestFetchDate ? formatShanghaiDateTime(props.stats.latestFetchDate) : "暂无";

  return (
    <>
      <Head>
        <title>商业洞察系统 | Biz Insight</title>
      </Head>
      <main className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="mx-auto max-w-7xl flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-ink">商业洞察系统</h1>
              <p className="text-sm text-slate-500">
                覆盖 {formatCount(props.stats.companyCount)} 家公司 | 沉淀 {formatCount(props.stats.documentCount)} 份文档 | 最近更新 {latestUpdateLabel}
              </p>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-6">功能模块</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod) => (
              <a
                key={mod.id}
                href={mod.href}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-slate-300 hover:shadow-lg"
              >
                <div className={`absolute top-0 right-0 w-24 h-24 -translate-y-8 translate-x-8 rounded-full ${mod.color} opacity-10`} />
                <div className="text-4xl mb-4">{mod.icon}</div>
                <h3 className="text-lg font-semibold text-ink group-hover:text-moss transition-colors">{mod.name}</h3>
                <p className="mt-2 text-sm text-slate-600">{mod.description}</p>
                <div className="mt-4 flex items-center text-sm font-semibold text-moss">
                  进入
                  <svg className="ml-1 w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </a>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}