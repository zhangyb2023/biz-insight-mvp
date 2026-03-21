import Head from "next/head";

const systemNodes = [
  { id: "A", title: "来源配置", module: "pages/sources.tsx", x: 30, y: 42, color: "#d97706" },
  { id: "B", title: "抓取执行", module: "lib/crawl/runCrawlJob.ts", x: 265, y: 42, color: "#2563eb" },
  { id: "C", title: "正文清洗", module: "lib/clean/cleanText.ts", x: 500, y: 42, color: "#059669" },
  { id: "D", title: "LLM 分析", module: "lib/analyze/deepSeek.ts", x: 30, y: 170, color: "#7c3aed" },
  { id: "E", title: "入库与版本", module: "lib/db/repository.ts", x: 265, y: 170, color: "#dc2626" },
  { id: "F", title: "消费层", module: "pages/jobs/[id].tsx", x: 500, y: 170, color: "#0f766e" }
];

const systemEdges = [
  ["A", "B"],
  ["B", "C"],
  ["C", "D"],
  ["D", "E"],
  ["E", "F"]
];

const flowCards = [
  {
    title: "来源配置流程",
    input: "公司、网站、URL、关键词、类型、优先级",
    tools: "前端表单 / source_registry / keyword_sets",
    output: "标准来源配置",
    tables: "companies、source_registry、keyword_sets",
    modules: "pages/sources.tsx, pages/api/sources/*, lib/db/repository.ts"
  },
  {
    title: "抓取执行流程",
    input: "URL、useCache、forceRefresh、cacheMaxAgeHours",
    tools: "Jina Reader + Firecrawl + Tavily (智能三层策略)",
    output: "title、html_snapshot、http_status、fetched_at、from_cache、fetch_strategy",
    tables: "crawl_jobs、crawl_job_steps、sources、source_versions",
    modules: "lib/crawl/intelligentCrawl.ts, lib/crawl/runCrawlJob.ts"
  },
  {
    title: "正文清洗与提取流程",
    input: "html_snapshot",
    tools: "Cheerio + Readability + 自定义 extractor",
    output: "clean_text、extracted_items、matched_keywords",
    tables: "documents、crawl_job_steps、source_versions",
    modules: "lib/clean/cleanText.ts"
  },
  {
    title: "LLM 分析流程",
    input: "company、title、clean_text、matched_keywords、prompt_version",
    tools: "DeepSeek API / fallback",
    output: "summary、category、confidence、raw_response、parsed_json",
    tables: "insights、llm_runs、crawl_job_steps",
    modules: "lib/analyze/deepSeek.ts"
  },
  {
    title: "数据入库与版本管理流程",
    input: "source/document/insight payload",
    tools: "SQLite + repository/upsert logic",
    output: "record ids、upsert status、content hash、changed flag",
    tables: "sources、documents、insights、source_versions、llm_runs、crawl_jobs、crawl_job_steps",
    modules: "lib/db/repository.ts"
  },
  {
    title: "消费层与维护分析流程",
    input: "各表数据",
    tools: "后台前端 + 查询/展示层",
    output: "原始结果视图、消费视图、任务视图、错误视图、导出视图",
    tables: "all of the above",
    modules: "pages/index.tsx, pages/jobs/*, pages/errors.tsx, pages/data/*, pages/trace/*"
  }
];

const stepChain = [
  { key: "url_resolve", label: "1. URL 解析", tool: "source resolver + 日期预检", module: "lib/search/searchUrls.ts, lib/crawl/runCrawlJob.ts", output: "去重后的目标 URL 列表（URL日期<2026-01-01则过滤）" },
  { key: "page_fetch", label: "2. 页面抓取", tool: "Jina + Firecrawl + Tavily+Jina + Playwright日期", module: "lib/crawl/intelligentCrawl.ts, playwrightDateExtract.ts", output: "title/html/publishedTime/fetchStrategy" },
  { key: "html_capture", label: "3. HTML 获取", tool: "jina-reader / firecrawl / playwright (JS渲染)", module: "lib/crawl/intelligentCrawl.ts", output: "html_snapshot / title / fetched_at / publishedTime" },
  { key: "clean_text", label: "4. 正文清洗", tool: "Readability + Cheerio", module: "lib/clean/cleanText.ts", output: "clean_text" },
  { key: "list_extract", label: "5. 列表提取", tool: "custom extractor", module: "lib/clean/cleanText.ts", output: "extracted_items" },
  { key: "detail_discovery", label: "6. 详情发现", tool: "URL日期过滤 + 主机名校验", module: "lib/crawl/runCrawlJob.ts", output: "有效详情URL列表（日期>=2026-01-01）" },
  { key: "keyword_match", label: "7. 关键词匹配", tool: "rule matcher", module: "lib/clean/cleanText.ts", output: "matched_keywords" },
  { key: "date_filter", label: "8. 日期过滤门控", tool: "publishedAt >= 2026-01-01?", module: "lib/crawl/runCrawlJob.ts, lib/evaluate/sourceQuality.ts", output: "日期有效 → LLM分析；无效 → 跳过+评分衰减" },
  { key: "llm_analysis", label: "9. LLM 分析", tool: "DeepSeek (仅有效日期)", module: "lib/analyze/deepSeek.ts", output: "summary / category / raw_response" },
  { key: "database_upsert", label: "10. 数据入库", tool: "SQLite repository", module: "lib/db/repository.ts", output: "sources / documents / insights / versions" },
  { key: "aggregate_display", label: "11. 消费层", tool: "result access layer", module: "pages/jobs/[id].tsx", output: "raw results / briefing / jobs / trace / inspector / exports" }
];

function nodeCenter(nodeId: string) {
  const node = systemNodes.find((item) => item.id === nodeId)!;
  return { x: node.x + 95, y: node.y + 34 };
}

export default function WorkflowMapPage() {
  return (
    <>
      <Head>
        <title>Workflow Map | Biz Insight MVP</title>
      </Head>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-moss">Workflow Map</p>
            <h1 className="mt-2 text-4xl font-semibold text-ink">流程总览</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              这里是维护控制台的流程视图。上半部分是系统总流程图，下半部分是六大流程说明卡和真实 10 步执行链。
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
          <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm leading-7 text-slate-700">
            <div className="rounded-2xl bg-white p-4">
              <p className="font-semibold text-ink">智能爬虫系统怎么用</p>
              <p className="mt-2">先看总图，再去智能爬虫系统页了解三层策略和原理。</p>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <p className="font-semibold text-ink">工作模式怎么用</p>
              <p className="mt-2">先看当前问题在哪个节点，再去任务中心或 Trace 精确排查。</p>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <p className="font-semibold text-ink">图里看什么</p>
              <p className="mt-2">看流程名、工具名，工程文件名，六大流程卡里的输入输出和数据落点。重点关注新增的日期过滤门控（第8步）。</p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-ink">系统总流程图</h2>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <svg viewBox="0 0 760 300" className="min-w-[760px]">
              <defs>
                <marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
                </marker>
              </defs>
              {systemEdges.map(([from, to]) => {
                const start = nodeCenter(from);
                const end = nodeCenter(to);
                return (
                  <line
                    key={`${from}-${to}`}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="#64748b"
                    strokeWidth="2.5"
                    markerEnd="url(#arrow)"
                  />
                );
              })}
              {systemNodes.map((node) => (
                <g key={node.id}>
                  <rect x={node.x} y={node.y} width="190" height="68" rx="16" fill={node.color} opacity="0.12" />
                  <rect x={node.x} y={node.y} width="190" height="68" rx="16" fill="white" stroke={node.color} strokeWidth="2" />
                  <text x={node.x + 95} y={node.y + 28} textAnchor="middle" fontSize="15" fontWeight="700" fill="#0f172a">
                    {node.title}
                  </text>
                  <text x={node.x + 95} y={node.y + 48} textAnchor="middle" fontSize="10.5" fontWeight="500" fill="#475569">
                    {node.module}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-slate-100 bg-slate-950 p-5 text-sm text-slate-100">
              <p className="font-semibold text-slate-200">Mermaid 对应源码</p>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-sm leading-7">{`flowchart TD
  来源配置 --> 抓取执行
  抓取执行 --> 正文清洗
  正文清洗 --> LLM分析
  LLM分析 --> 入库与版本管理
  入库与版本管理 --> 消费层`}</pre>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-5 text-sm leading-7 text-slate-700">
              <p className="font-semibold text-ink">图中源码标注怎么看</p>
              <p className="mt-2">每个流程块下面都标了当前真实工程里的核心文件。</p>
              <p>例如：</p>
              <p><code>pages/sources.tsx</code> 负责来源配置页面。</p>
              <p><code>lib/crawl/runCrawlJob.ts</code> 负责任务编排。</p>
              <p><code>lib/clean/cleanText.ts</code> 负责正文清洗和列表提取。</p>
              <p><code>lib/analyze/deepSeek.ts</code> 负责 LLM 分析。</p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-ink">真实 10 步工作流</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {stepChain.map((step) => (
              <div key={step.key} id={step.key} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <p className="font-semibold text-ink">{step.label}</p>
                <p className="mt-2 text-xs text-slate-500">{step.tool}</p>
                <p className="text-xs text-slate-500">{step.module}</p>
                <p className="mt-2 leading-6">{step.output}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-600">
            这 11 步对应任务步骤表 <code>crawl_job_steps</code> 里的真实记录。第 8 步为新增的日期过滤门控，确保只处理 2026-01-01 后有明确日期的有效内容。第 11 步表示基于已入库结果进行查询、展示、导出与消费。
          </p>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {flowCards.map((card) => (
            <article key={card.title} className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
              <h2 className="text-lg font-semibold text-ink">{card.title}</h2>
              <div className="mt-4 space-y-3 text-sm">
                <p><span className="font-medium text-slate-500">输入：</span>{card.input}</p>
                <p><span className="font-medium text-slate-500">工具：</span>{card.tools}</p>
                <p><span className="font-medium text-slate-500">输出：</span>{card.output}</p>
                <p><span className="font-medium text-slate-500">数据落点：</span>{card.tables}</p>
                <p><span className="font-medium text-slate-500">真实模块：</span>{card.modules}</p>
              </div>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
