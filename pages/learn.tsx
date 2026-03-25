import Head from "next/head";
import { useState, useEffect } from "react";

interface ApiStatus {
  name: string;
  key: string;
  status: "active" | "invalid" | "unauthorized" | "error" | "unknown";
  message: string;
  quota?: { message?: string };
}

const crawlTiers = [
  {
    tier: "策略模式",
    name: "定制化爬取策略",
    color: "#2563eb",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
    sources: "各类网站（新闻列表、产品页面、博客等）",
    strategy: "URL Pattern → 策略匹配 → Playwright/Cheerio解析",
    strategyDesc: "每类网站有专属解析策略，自动提取标题/日期/摘要/链接",
    successRate: "95%+",
    dailyLimit: "无限制（自有Playwright）",
    flow: ["URL 输入", "策略匹配", "Playwright渲染", "Cheerio解析", "LLM智能分类", "存入数据库"]
  },
  {
    tier: "多页支持",
    name: "自动翻页爬取",
    color: "#059669",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    textColor: "text-emerald-700",
    sources: "分页新闻列表、博客归档、产品列表",
    strategy: "策略 + 分页配置 → 自动翻页",
    strategyDesc: "支持多种分页格式，自动爬取多页内容",
    successRate: "90%+",
    dailyLimit: "无限制",
    flow: ["首页URL", "检测分页", "翻页URL生成", "循环爬取", "合并结果"]
  },
  {
    tier: "LLM 分类",
    name: "智能内容分类",
    color: "#7c3aed",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    textColor: "text-violet-700",
    sources: "所有爬取的新闻/文章",
    strategy: "DeepSeek → 语义理解 → 五类分类",
    strategyDesc: "基于内容语义智能分类：产品技术/生态合作/战略动向/政策法规/人才动态",
    successRate: "90%+",
    dailyLimit: "API调用限制",
    flow: ["提取标题+摘要", "发送DeepSeek", "语义分析", "分类判断", "返回结果"]
  }
];

const fileStructure = [
  {
    category: "策略定义",
    files: [
      { path: "lib/crawl/strategies/types.ts", desc: "策略类型定义（URL模式、提取项结构）" },
      { path: "lib/crawl/strategies/index.ts", desc: "策略注册与匹配中心" },
      { path: "lib/crawl/strategies/gasgooFlashStrategy.ts", desc: "盖世快讯策略（分页爬取）" },
      { path: "lib/crawl/strategies/autosarNewsStrategy.ts", desc: "AUTOSAR新闻策略" },
      { path: "lib/crawl/strategies/thundersoftNewsStrategy.ts", desc: "中科创达新闻策略" },
      { path: "lib/crawl/strategies/huaweiAutoNewsStrategy.ts", desc: "华为乾崑新闻策略" },
      { path: "lib/crawl/strategies/hirainNewsStrategy.ts", desc: "经纬恒润新闻策略" }
    ]
  },
  {
    category: "LLM 分类",
    files: [
      { path: "lib/crawl/llmClassifier.ts", desc: "DeepSeek 智能分类（产品技术/生态合作/战略动向/政策法规/人才动态）" }
    ]
  },
  {
    category: "API 接口",
    files: [
      { path: "pages/api/strategy/crawl.ts", desc: "策略爬取接口（爬取+LLM分类）" },
      { path: "pages/api/all-items.ts", desc: "动态信息列表接口" }
    ]
  },
  {
    category: "数据层",
    files: [
      { path: "lib/db/repository.ts", desc: "数据库操作（SQLite）" },
      { path: "lib/db/sqlite.ts", desc: "数据库连接管理" }
    ]
  }
];

const optimizationSuggestions = [
  {
    priority: "已完成",
    title: "策略化爬取",
    desc: "每类网站有专属解析策略，URL Pattern匹配，自动提取标题/日期/摘要/链接",
    effort: "已完成"
  },
  {
    priority: "已完成",
    title: "LLM智能分类",
    desc: "基于DeepSeek语义分析，自动分类：产品技术/生态合作/战略动向/政策法规/人才动态",
    effort: "已完成"
  },
  {
    priority: "低",
    title: "低价值内容过滤",
    desc: "节日活动、妇女节等信息可选择是否过滤不入库",
    effort: "低"
  },
  {
    priority: "低",
    title: "失败重试机制",
    desc: "当前失败直接跳过，可增加 2-3 次指数退避重试，提升成功率",
    effort: "中"
  }
];

const coreModules = [
  {
    name: "jinaExtract()",
    file: "lib/crawl/intelligentCrawl.ts:31",
    desc: "Jina Reader 内容提取，支持 Markdown 格式返回，自动解析 Title/URL/PublishedTime/Content",
    params: "url: string",
    returns: "CrawlStrategyResult { success, page?, extractedItems?, error? }"
  },
  {
    name: "strategy.crawl()",
    file: "lib/crawl/strategies/*.ts",
    desc: "策略爬取主入口，Playwright渲染 + Cheerio解析，自动翻页",
    params: "url: string, options?: { pages?: number[] }",
    returns: "CrawlStrategyResult { page, extractedItems[], success, error? }"
  },
  {
    name: "findStrategyForUrl()",
    file: "lib/crawl/strategies/index.ts",
    desc: "根据URL Pattern匹配对应策略",
    params: "url: string",
    returns: "CrawlStrategy | null"
  },
  {
    name: "classifyItemsWithLLM()",
    file: "lib/crawl/llmClassifier.ts",
    desc: "DeepSeek LLM批量分类，5类分类（产品技术/生态合作/战略动向/政策法规/人才动态）",
    params: "items: { id, title, summary }[]",
    returns: "ClassifiedItem[] { id, title, category, reason? }[]"
  }
];

export default function IntelligentCrawlDocPage() {
  const [apiStatus, setApiStatus] = useState<ApiStatus[]>([
    { name: "DeepSeek", key: "检查中...", status: "unknown", message: "加载中..." }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const fetchApiStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/status/apis");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setApiStatus(data.apis);
      setLastChecked(new Date(data.checkedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApiStatus();
  }, []);

  return (
    <>
      <Head>
        <title>智能爬虫系统 | Biz Insight MVP</title>
      </Head>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-moss">Intelligent Crawl System</p>
            <h1 className="mt-2 text-4xl font-semibold text-ink">智能爬虫系统</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              基于 Jina Reader + Firecrawl + Tavily 的三层智能爬取策略，94%+ 成功率，
              支持官方、媒体、专业机构三种来源类型全自动降级切换。
              <span className="mt-1 block font-medium text-rose-600">新增：2026-01-01日期过滤门控，只处理有明确发布日期的有效内容。</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
              返回首页
            </a>
            <a href="/workflow-map" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
              流程总览
            </a>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-sky-200 bg-sky-50 p-6">
          <h2 className="text-xl font-semibold text-slate-900">核心设计原则</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl bg-white p-4 text-sm">
              <p className="text-2xl font-bold text-sky-600">94%+</p>
              <p className="mt-1 font-semibold text-ink">成功率</p>
              <p className="mt-1 text-slate-600">Jina Reader 为主力，Firecrawl 备选，确保最高成功率</p>
            </div>
            <div className="rounded-2xl bg-white p-4 text-sm">
              <p className="text-2xl font-bold text-emerald-600">三层策略</p>
              <p className="mt-1 font-semibold text-ink">智能降级</p>
              <p className="mt-1 text-slate-600">根据来源类型自动选择最优爬取策略</p>
            </div>
            <div className="rounded-2xl bg-white p-4 text-sm">
              <p className="text-2xl font-bold text-violet-600">零依赖</p>
              <p className="mt-1 font-semibold text-ink">无需浏览器</p>
              <p className="mt-1 text-slate-600">纯 HTTP API 调用，无需 Playwright/Chromium</p>
            </div>
            <div className="rounded-2xl bg-white p-4 text-sm">
              <p className="text-2xl font-bold text-rose-600">2026+</p>
              <p className="mt-1 font-semibold text-ink">日期过滤</p>
              <p className="mt-1 text-slate-600">只处理2026-01-01后有明确日期的有效内容</p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-ink">智能爬取工作流程图</h2>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <svg viewBox="0 0 900 520" className="min-w-[900px]">
              <defs>
                <marker id="arrow-blue" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L9,3 z" fill="#2563eb" />
                </marker>
                <marker id="arrow-green" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L9,3 z" fill="#059669" />
                </marker>
                <marker id="arrow-violet" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L9,3 z" fill="#7c3aed" />
                </marker>
                <marker id="arrow-gray" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
                </marker>
                <marker id="arrow-red" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L9,3 z" fill="#dc2626" />
                </marker>
              </defs>

              <rect x="20" y="20" width="140" height="50" rx="12" fill="#f8fafc" stroke="#64748b" strokeWidth="2" />
              <text x="90" y="38" textAnchor="middle" fontSize="12" fontWeight="600" fill="#1e293b">URL 输入</text>
              <text x="90" y="56" textAnchor="middle" fontSize="10" fill="#64748b">intelligentCrawl()</text>

              <rect x="200" y="20" width="160" height="50" rx="12" fill="#eff6ff" stroke="#2563eb" strokeWidth="2" />
              <text x="280" y="38" textAnchor="middle" fontSize="12" fontWeight="600" fill="#1e40af">Jina Reader</text>
              <text x="280" y="56" textAnchor="middle" fontSize="10" fill="#64748b">r.jina.ai</text>

              <rect x="200" y="130" width="160" height="50" rx="12" fill="#fef2f2" stroke="#dc2626" strokeWidth="2" />
              <text x="280" y="148" textAnchor="middle" fontSize="12" fontWeight="600" fill="#b91c1c">Firecrawl</text>
              <text x="280" y="166" textAnchor="middle" fontSize="10" fill="#64748b">api.firecrawl.dev</text>

              <rect x="200" y="240" width="160" height="50" rx="12" fill="#f5f3ff" stroke="#7c3aed" strokeWidth="2" />
              <text x="280" y="258" textAnchor="middle" fontSize="12" fontWeight="600" fill="#6d28d9">Tavily 搜索</text>
              <text x="280" y="276" textAnchor="middle" fontSize="10" fill="#64748b">api.tavily.com</text>

              <rect x="200" y="350" width="160" height="50" rx="12" fill="#f5f3ff" stroke="#7c3aed" strokeWidth="2" />
              <text x="280" y="368" textAnchor="middle" fontSize="12" fontWeight="600" fill="#6d28d9">Jina 提取</text>
              <text x="280" y="386" textAnchor="middle" fontSize="10" fill="#64748b">从 Tavily 结果</text>

              <rect x="420" y="85" width="120" height="40" rx="10" fill="#dcfce7" stroke="#059669" strokeWidth="2" />
              <text x="480" y="110" textAnchor="middle" fontSize="12" fontWeight="600" fill="#166534">成功 ✓</text>

              <rect x="420" y="175" width="120" height="40" rx="10" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
              <text x="480" y="200" textAnchor="middle" fontSize="12" fontWeight="600" fill="#b45309">重试 ↓</text>

              <rect x="420" y="285" width="120" height="40" rx="10" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
              <text x="480" y="310" textAnchor="middle" fontSize="12" fontWeight="600" fill="#b45309">重试 ↓</text>

              <rect x="420" y="365" width="120" height="40" rx="10" fill="#dcfce7" stroke="#059669" strokeWidth="2" />
              <text x="480" y="390" textAnchor="middle" fontSize="12" fontWeight="600" fill="#166534">成功 ✓</text>

              <rect x="590" y="85" width="120" height="40" rx="10" fill="#dcfce7" stroke="#059669" strokeWidth="2" />
              <text x="650" y="110" textAnchor="middle" fontSize="12" fontWeight="600" fill="#166534">返回结果</text>

              <rect x="590" y="175" width="120" height="40" rx="10" fill="#dcfce7" stroke="#059669" strokeWidth="2" />
              <text x="650" y="200" textAnchor="middle" fontSize="12" fontWeight="600" fill="#166534">返回结果</text>

              <rect x="590" y="365" width="120" height="40" rx="10" fill="#dcfce7" stroke="#059669" strokeWidth="2" />
              <text x="650" y="390" textAnchor="middle" fontSize="12" fontWeight="600" fill="#166534">返回结果</text>

              <rect x="760" y="175" width="120" height="40" rx="10" fill="#fef2f2" stroke="#dc2626" strokeWidth="2" />
              <text x="820" y="200" textAnchor="middle" fontSize="12" fontWeight="600" fill="#b91c1c">失败 ✗</text>

              <rect x="760" y="285" width="120" height="40" rx="10" fill="#fef2f2" stroke="#dc2626" strokeWidth="2" />
              <text x="820" y="310" textAnchor="middle" fontSize="12" fontWeight="600" fill="#b91c1c">失败 ✗</text>

              <line x1="160" y1="45" x2="195" y2="45" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow-gray)" />
              <line x1="360" y1="45" x2="415" y2="105" stroke="#059669" strokeWidth="2" markerEnd="url(#arrow-green)" />
              <line x1="360" y1="155" x2="415" y2="195" stroke="#dc2626" strokeWidth="2" markerEnd="url(#arrow-red)" />
              <line x1="360" y1="265" x2="415" y2="305" stroke="#dc2626" strokeWidth="2" markerEnd="url(#arrow-red)" />
              <line x1="540" y1="105" x2="585" y2="105" stroke="#059669" strokeWidth="2" markerEnd="url(#arrow-green)" />
              <line x1="540" y1="195" x2="585" y2="195" stroke="#059669" strokeWidth="2" markerEnd="url(#arrow-green)" />
              <line x1="540" y1="385" x2="585" y2="385" stroke="#059669" strokeWidth="2" markerEnd="url(#arrow-green)" />
              <line x1="710" y1="195" x2="755" y2="195" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow-gray)" />
              <line x1="710" y1="305" x2="755" y2="305" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow-gray)" />
              <line x1="360" y1="195" x2="360" y2="265" stroke="#64748b" strokeWidth="2" strokeDasharray="5,5" />
              <line x1="280" y1="70" x2="280" y2="125" stroke="#64748b" strokeWidth="2" strokeDasharray="5,5" markerEnd="url(#arrow-gray)" />
              <line x1="280" y1="180" x2="280" y2="235" stroke="#64748b" strokeWidth="2" strokeDasharray="5,5" markerEnd="url(#arrow-gray)" />
              <line x1="480" y1="125" x2="480" y2="170" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow-gray)" />
              <line x1="480" y1="215" x2="480" y2="280" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow-gray)" />
              <line x1="480" y1="310" x2="480" y2="360" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow-gray)" />
              <line x1="650" y1="215" x2="650" y2="360" stroke="#64748b" strokeWidth="2" strokeDasharray="5,5" />

              <text x="400" y="75" fontSize="9" fill="#64748b">内容&gt;200字</text>
              <text x="395" y="175" fontSize="9" fill="#64748b">重试</text>
              <text x="395" y="305" fontSize="9" fill="#64748b">重试</text>
              <text x="605" y="145" fontSize="9" fill="#64748b">内容&gt;200字</text>
              <text x="605" y="335" fontSize="9" fill="#64748b">内容&gt;200字</text>
            </svg>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-slate-950 p-5 text-sm text-slate-100">
              <p className="font-semibold text-slate-200">Mermaid 流程图</p>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6">{`flowchart TD
  A[URL 输入] --> B[Jina Reader]
  B -->|成功且有日期| C[返回结果]
  B -->|成功但无日期| D{Playwright补提日期?}
  D -->|有日期| C
  D -->|无日期| C
  B -->|失败| E[Firecrawl]
  E -->|成功 content>200| F[返回结果]
  E -->|失败| G{Tier 3?}
  G -->|否| H[返回失败]
  G -->|是| I[Tavily 搜索]
  I --> J[Jina 提取发现的URL]
  J -->|有内容| K{Playwright补提日期?}
  K -->|有日期| L[返回结果]
  K -->|无日期| L
  J -->|失败| H

  subgraph 日期过滤决策
    M[检查 publishedAt] --> N{>= 2026-01-01?}
    N -->|是| O[允许LLM分析]
    N -->|否| P[跳过LLM分析]
    P --> Q[评分日期衰减]
  end

  C --> M
  F --> M
  L --> M`}</pre>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-5 text-sm leading-7 text-slate-700">
              <p className="font-semibold text-ink">流程说明</p>
              <p className="mt-2">1. URL 输入智能爬取函数</p>
              <p className="mt-1">2. 优先使用 Jina Reader 提取（94%+ 成功率）</p>
              <p className="mt-1">3. Jina 成功但无日期 → Playwright 补提日期（JS渲染站）</p>
              <p className="mt-1">4. Jina 失败则降级到 Firecrawl</p>
              <p className="mt-1">5. Tier 3 专业来源额外使用 Tavily 发现相关URL</p>
              <p className="mt-1">6. 每个步骤都校验内容长度 &gt;200 字</p>
              <p className="mt-1">7. 最终返回 CrawlPage 或失败原因</p>
              <p className="mt-2 font-semibold text-rose-700">8. 日期过滤：publishedAt &lt; 2026-01-01 → 跳过LLM + 评分衰减</p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-ink">四层策略详解</h2>
          <div className="mt-4 grid gap-6">
            {crawlTiers.map((tier) => (
              <div key={tier.tier} className={`rounded-2xl border ${tier.borderColor} ${tier.bgColor} p-5`}>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${tier.textColor} bg-white`}>{tier.tier}</span>
                  <h3 className={`text-lg font-semibold ${tier.textColor}`}>{tier.name}</h3>
                  <span className="ml-auto text-sm text-slate-600">成功率: <span className="font-bold">{tier.successRate}</span></span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="bg-white rounded-xl p-4 text-sm">
                    <p className="font-semibold text-ink">适用来源</p>
                    <p className="mt-1 text-slate-600">{tier.sources}</p>
                    <p className="mt-3 font-semibold text-ink">API 配额</p>
                    <p className="mt-1 text-slate-600">{tier.dailyLimit}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-sm">
                    <p className="font-semibold text-ink">爬取策略</p>
                    <p className="mt-1 text-slate-600">{tier.strategyDesc}</p>
                    <p className="mt-2 font-mono text-xs bg-slate-100 rounded px-2 py-1">{tier.strategy}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-ink">执行流程</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {tier.flow.map((step, idx) => (
                      <span key={idx} className="text-xs">
                        <span className="rounded-full bg-white px-2 py-1 font-medium text-slate-700">{step}</span>
                        {idx < tier.flow.length - 1 && <span className="mx-1 text-slate-400">→</span>}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-ink">核心模块 API</h2>
          <div className="mt-4 grid gap-4">
            {coreModules.map((mod) => (
              <div key={mod.name} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <code className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-slate-100">{mod.name}</code>
                  <span className="text-xs text-slate-500 pt-1">{mod.file}</span>
                </div>
                <p className="mt-3 text-sm text-slate-700">{mod.desc}</p>
                <div className="mt-2 grid gap-2 text-xs">
                  <p><span className="font-semibold text-slate-500">参数:</span> <code className="text-slate-700">{mod.params}</code></p>
                  <p><span className="font-semibold text-slate-500">返回:</span> <code className="text-slate-700">{mod.returns}</code></p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-ink">文件结构</h2>
          <div className="mt-4 grid gap-4">
            {fileStructure.map((group) => (
              <div key={group.category} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <h3 className="font-semibold text-ink">{group.category}</h3>
                <div className="mt-3 space-y-2">
                  {group.files.map((file) => (
                    <div key={file.path} className="flex items-start gap-3 text-sm">
                      <code className="rounded bg-white px-2 py-0.5 text-xs font-mono text-violet-600">{file.path}</code>
                      <span className="text-slate-600">{file.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-xl font-semibold text-slate-900">优化建议</h2>
          <div className="mt-4 grid gap-4">
            {optimizationSuggestions.map((opt, idx) => (
              <div key={idx} className="rounded-2xl bg-white p-4">
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    opt.priority === "高" ? "bg-red-100 text-red-700" :
                    opt.priority === "中" ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-slate-700"
                  }`}>{opt.priority}优先级</span>
                  <h3 className="font-semibold text-ink">{opt.title}</h3>
                  <span className="ml-auto text-xs text-slate-500">工作量: {opt.effort}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{opt.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-xl font-semibold text-slate-900">快速测试</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-4 text-sm">
              <p className="font-semibold text-ink">命令行测试</p>
              <pre className="mt-2 rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{`cd /home/openclaw-ubuntu-zyb/biz-insight-mvp
npx tsx scripts/test-intelligent-crawl.ts`}</pre>
            </div>
            <div className="rounded-2xl bg-white p-4 text-sm">
              <p className="font-semibold text-ink">运行完整爬取任务</p>
              <pre className="mt-2 rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{`npx tsx scripts/runCrawl.ts --company=vector`}</pre>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-ink">API 状态监控</h2>
            <button
              onClick={() => fetchApiStatus()}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "检查中..." : "刷新状态"}
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {apiStatus.map((api) => (
              <div key={api.name} className={`rounded-2xl border p-4 ${
                api.status === "active" ? "border-emerald-200 bg-emerald-50" :
                api.status === "unauthorized" ? "border-red-200 bg-red-50" :
                api.status === "error" ? "border-amber-200 bg-amber-50" :
                "border-slate-200 bg-white"
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${
                    api.status === "active" ? "bg-emerald-500" :
                    api.status === "unauthorized" ? "bg-red-500" :
                    api.status === "error" ? "bg-amber-500" :
                    "bg-slate-400"
                  }`} />
                  <span className="font-semibold text-ink">{api.name}</span>
                </div>
                <p className="mt-2 text-xs text-slate-600 font-mono">{api.key}</p>
                <p className="mt-1 text-xs">
                  <span className={
                    api.status === "active" ? "text-emerald-700" :
                    api.status === "unauthorized" ? "text-red-700" :
                    api.status === "error" ? "text-amber-700" :
                    "text-slate-600"
                  }>{api.message}</span>
                </p>
                {api.quota?.message && (
                  <p className="mt-1 text-xs text-slate-500">{api.quota.message}</p>
                )}
              </div>
            ))}
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600">加载失败: {error}</p>
          )}
          {lastChecked && (
            <p className="mt-3 text-xs text-slate-500">最后检查: {lastChecked}</p>
          )}
        </section>
      </main>
    </>
  );
}