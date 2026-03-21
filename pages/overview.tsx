import Head from "next/head";

const STEPS = [
  {
    step: 1,
    name: "配置目标",
    icon: "🎯",
    description: "确定要跟踪哪些公司和网站",
    details: [
      "在\"公司管理\"中添加目标公司",
      "配置要监控的网页URL",
      "设置关键词（产品/合作/招聘等）"
    ],
    module: "公司管理",
    moduleHref: "/console"
  },
  {
    step: 2,
    name: "智能爬取",
    icon: "🕷️",
    description: "自动抓取目标网页内容",
    details: [
      "Jina Reader → 读取网页正文",
      "Firecrawl → 深度抓取结构化内容",
      "Tavily → 补充搜索发现更多相关页面",
      "自动识别并跳过已缓存的页面"
    ],
    module: "工作台 / 智能爬虫系统",
    moduleHref: "/workbench"
  },
  {
    step: 3,
    name: "正文清洗",
    icon: "🧹",
    description: "去除广告、导航栏等干扰内容",
    details: [
      "提取网页主体内容",
      "过滤广告和无关元素",
      "识别并提取发布日期",
      "保留关键信息结构"
    ],
    module: "自动进行"
  },
  {
    step: 4,
    name: "AI 分析",
    icon: "🤖",
    description: "用大模型理解内容并分类",
    details: [
      "DeepSeek 分析内容主题",
      "判断是产品/合作/招聘还是其他",
      "提取关键信息（公司/产品/时间）",
      "评估内容质量和可信度"
    ],
    module: "自动进行"
  },
  {
    step: 5,
    name: "结构化入库",
    icon: "💾",
    description: "存储到数据库形成洞察",
    details: [
      "保存标题、摘要、原文",
      "记录来源URL和发布时间",
      "标记主题分类和置信度",
      "追踪首次发现和更新时间"
    ],
    module: "自动进行"
  },
  {
    step: 6,
    name: "商业洞察",
    icon: "💡",
    description: "生成可行动的洞察结论",
    details: [
      "聚合多来源信息形成判断",
      "识别趋势、风险、机会",
      "生成下一步行动建议",
      "按主题分类展示"
    ],
    module: "商业洞察",
    moduleHref: "/insights"
  }
];

const ARCHITECTURE = {
  title: "系统架构",
  layers: [
    {
      name: "数据来源层",
      color: "bg-sky-100 border-sky-300",
      items: ["目标公司官网", "新闻媒体", "专业论坛", "招聘平台"]
    },
    {
      name: "采集引擎层",
      color: "bg-emerald-100 border-emerald-300",
      items: ["Jina Reader", "Firecrawl", "Tavily", "Playwright"]
    },
    {
      name: "处理分析层",
      color: "bg-amber-100 border-amber-300",
      items: ["正文清洗", "关键词匹配", "LLM 分类", "质量评估"]
    },
    {
      name: "存储层",
      color: "bg-violet-100 border-violet-300",
      items: ["SQLite 数据库", "原始文档", "结构化洞察", "任务记录"]
    },
    {
      name: "展示应用层",
      color: "bg-rose-100 border-rose-300",
      items: ["商业洞察", "系统健康度", "工作台", "公司管理"]
    }
  ]
};

export default function OverviewPage() {
  return (
    <>
      <Head>
        <title>系统流程总览 | 商业洞察</title>
      </Head>
      <main className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-ink">商业洞察系统</h1>
                <p className="text-sm text-slate-500 mt-1">了解系统如何从网页变成洞察结论</p>
              </div>
              <a href="/" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                返回首页
              </a>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">一句话说明</h2>
            <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-6">
              <p className="text-lg leading-relaxed text-slate-700">
                <span className="font-semibold text-emerald-700">商业洞察系统</span> 自动抓取目标公司的公开网页，
                用 AI 分析内容并提取关键信息，最终生成
                <span className="font-semibold text-emerald-700"> 可行动的洞察结论</span>，
                帮助您快速了解竞争对手动态、市场趋势和商业机会。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">数据流转图</h2>
            <div className="rounded-2xl bg-white border border-slate-200 p-6 overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                <div className="px-4 py-3 rounded-xl bg-sky-100 border border-sky-300 text-sm font-medium text-sky-700">
                  🌐 网页
                </div>
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <div className="px-4 py-3 rounded-xl bg-emerald-100 border border-emerald-300 text-sm font-medium text-emerald-700">
                  🕷️ 爬取
                </div>
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <div className="px-4 py-3 rounded-xl bg-amber-100 border border-amber-300 text-sm font-medium text-amber-700">
                  🧹 清洗
                </div>
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <div className="px-4 py-3 rounded-xl bg-violet-100 border border-violet-300 text-sm font-medium text-violet-700">
                  🤖 AI分析
                </div>
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <div className="px-4 py-3 rounded-xl bg-rose-100 border border-rose-300 text-sm font-medium text-rose-700">
                  💡 洞察
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">六步流程详解</h2>
            <div className="space-y-4">
              {STEPS.map((step) => (
                <div key={step.step} className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-4 p-4 border-b border-slate-100">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-moss/10 flex items-center justify-center text-xl">
                      {step.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-400">步骤 {step.step}</span>
                        <h3 className="font-semibold text-ink">{step.name}</h3>
                      </div>
                      <p className="text-sm text-slate-600">{step.description}</p>
                    </div>
                    {step.moduleHref ? (
                      <a href={step.moduleHref} className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-slate-100 text-sm font-medium text-slate-600 hover:bg-slate-200">
                        → {step.module}
                      </a>
                    ) : (
                      <span className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-emerald-50 text-sm font-medium text-emerald-600">
                        自动进行
                      </span>
                    )}
                  </div>
                  <div className="p-4 bg-slate-50">
                    <ul className="grid gap-2 md:grid-cols-2">
                      {step.details.map((detail, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="text-slate-400">•</span>
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">系统分层架构</h2>
            <div className="rounded-2xl bg-white border border-slate-200 p-6">
              <div className="space-y-4">
                {ARCHITECTURE.layers.map((layer, idx) => (
                  <div key={idx}>
                    <div className={`rounded-lg ${layer.color} border p-3 mb-2`}>
                      <p className="text-sm font-semibold text-slate-700">{layer.name}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-4">
                      {layer.items.map((item, i) => (
                        <span key={i} className="px-2 py-1 rounded bg-white border border-slate-200 text-xs text-slate-600">
                          {item}
                        </span>
                      ))}
                    </div>
                    {idx < ARCHITECTURE.layers.length - 1 && (
                      <div className="flex justify-center my-2">
                        <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">使用的平台</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl bg-white border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🔍</span>
                  <h3 className="font-semibold text-ink">Jina Reader</h3>
                </div>
                <p className="text-sm text-slate-600">免费网页正文提取</p>
                <p className="text-xs text-slate-400 mt-1">额度：10,000次/天</p>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🔥</span>
                  <h3 className="font-semibold text-ink">Firecrawl</h3>
                </div>
                <p className="text-sm text-slate-600">深度抓取结构化内容</p>
                <p className="text-xs text-slate-400 mt-1">支持整站sitemap抓取</p>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🔎</span>
                  <h3 className="font-semibold text-ink">Tavily</h3>
                </div>
                <p className="text-sm text-slate-600">补充搜索发现相关页面</p>
                <p className="text-xs text-slate-400 mt-1">扩展信息发现渠道</p>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🤖</span>
                  <h3 className="font-semibold text-ink">DeepSeek</h3>
                </div>
                <p className="text-sm text-slate-600">LLM 分析内容主题</p>
                <p className="text-xs text-slate-400 mt-1">判断类型、提取关键信息</p>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🌐</span>
                  <h3 className="font-semibold text-ink">Next.js</h3>
                </div>
                <p className="text-sm text-slate-600">前端框架</p>
                <p className="text-xs text-slate-400 mt-1">页面渲染和路由管理</p>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🗄️</span>
                  <h3 className="font-semibold text-ink">SQLite</h3>
                </div>
                <p className="text-sm text-slate-600">本地数据库</p>
                <p className="text-xs text-slate-400 mt-1">存储洞察和任务记录</p>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🎭</span>
                  <h3 className="font-semibold text-ink">Playwright</h3>
                </div>
                <p className="text-sm text-slate-600">浏览器自动化</p>
                <p className="text-xs text-slate-400 mt-1">补充提取动态页面日期</p>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">⚙️</span>
                  <h3 className="font-semibold text-ink">OpenClaw</h3>
                </div>
                <p className="text-sm text-slate-600">运维管理平台</p>
                <p className="text-xs text-slate-400 mt-1">API Keys 安全存储</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">平台调用关系图</h2>
            <div className="rounded-2xl bg-white border border-slate-200 p-6 overflow-x-auto">
              <div className="min-w-max">
                <div className="flex flex-col items-center gap-1">
                  <div className="px-5 py-3 rounded-xl bg-indigo-500 text-white text-sm font-semibold shadow-sm">
                    ⚙️ OpenClaw
                  </div>
                  <p className="text-xs text-slate-400">总协调</p>
                </div>
                <div className="flex justify-center my-2">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>

                <div className="grid grid-cols-3 gap-6 items-start">
                  <div className="flex flex-col items-center gap-1">
                    <div className="px-4 py-3 rounded-xl bg-sky-100 border border-sky-300 text-sm font-medium text-sky-700">
                      🔍 Jina Reader
                    </div>
                    <p className="text-xs text-slate-400 text-center">读取网页正文</p>
                    <svg className="w-4 h-4 text-slate-300 my-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <div className="px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                      网页内容
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <div className="px-4 py-3 rounded-xl bg-orange-100 border border-orange-300 text-sm font-medium text-orange-700">
                      🔥 Firecrawl
                    </div>
                    <p className="text-xs text-slate-400 text-center">深度抓取<br/>结构化内容</p>
                    <svg className="w-4 h-4 text-slate-300 my-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <div className="px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                      结构化数据
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <div className="px-4 py-3 rounded-xl bg-violet-100 border border-violet-300 text-sm font-medium text-violet-700">
                      🔎 Tavily
                    </div>
                    <p className="text-xs text-slate-400 text-center">补充搜索<br/>发现更多页面</p>
                    <svg className="w-4 h-4 text-slate-300 my-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <div className="px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                      关联页面
                    </div>
                  </div>
                </div>

                <div className="flex justify-center my-3">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>

                <div className="grid grid-cols-3 gap-6 items-start">
                  <div className="flex flex-col items-center gap-1">
                    <div className="px-4 py-3 rounded-xl bg-amber-100 border border-amber-300 text-sm font-medium text-amber-700">
                      🎭 Playwright
                    </div>
                    <p className="text-xs text-slate-400 text-center">提取动态页面日期</p>
                    <svg className="w-4 h-4 text-slate-300 my-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <div className="px-4 py-2 rounded-lg bg-slate-100 border border-slate-300 text-xs text-slate-600">
                      发布日期
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <div className="px-4 py-3 rounded-xl bg-rose-100 border border-rose-300 text-sm font-medium text-rose-700">
                      🧹 正文清洗
                    </div>
                    <p className="text-xs text-rose-500 font-medium">Cheerio + Readability</p>
                    <p className="text-xs text-slate-400 text-center">去除广告导航<br/>保留主体内容</p>
                    <svg className="w-4 h-4 text-slate-300 my-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <div className="px-4 py-2 rounded-lg bg-slate-100 border border-slate-300 text-xs text-slate-600">
                      干净文本
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <div className="px-4 py-3 rounded-xl bg-teal-100 border border-teal-300 text-sm font-medium text-teal-700">
                      🤖 DeepSeek
                    </div>
                    <p className="text-xs text-slate-400 text-center">LLM 分析<br/>主题分类</p>
                    <svg className="w-4 h-4 text-slate-300 my-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <div className="px-4 py-2 rounded-lg bg-slate-100 border border-slate-300 text-xs text-slate-600">
                      结构化洞察
                    </div>
                  </div>
                </div>

                <div className="flex justify-center my-3">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>

                <div className="flex justify-center gap-12">
                  <div className="flex flex-col items-center gap-1">
                    <div className="px-5 py-3 rounded-xl bg-violet-500 text-white text-sm font-semibold shadow-sm">
                      🗄️ SQLite
                    </div>
                    <p className="text-xs text-slate-400">结构化存储</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="px-5 py-3 rounded-xl bg-cyan-500 text-white text-sm font-semibold shadow-sm">
                      🌐 Next.js
                    </div>
                    <p className="text-xs text-slate-400">前端展示</p>
                  </div>
                </div>

                <div className="flex justify-center my-2">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>

                <div className="flex justify-center">
                  <div className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-sm">
                    💡 商业洞察
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3 text-center">OpenClaw 协调各平台采集数据 → 清洗处理 → DeepSeek 分析 → 存入 SQLite → Next.js 展示</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">用户视角：我能做什么</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <a href="/insights" className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 hover:bg-emerald-100 transition-colors">
                <div className="text-2xl mb-2">💡</div>
                <h3 className="font-semibold text-emerald-800">看商业洞察</h3>
                <p className="text-sm text-emerald-600 mt-1">查看系统自动生成的洞察结论、趋势判断和行动建议</p>
              </a>
              <a href="/workbench" className="rounded-2xl bg-sky-50 border border-sky-200 p-5 hover:bg-sky-100 transition-colors">
                <div className="text-2xl mb-2">🔍</div>
                <h3 className="font-semibold text-sky-800">执行爬取</h3>
                <p className="text-sm text-sky-600 mt-1">选择目标公司，触发系统自动抓取最新信息</p>
              </a>
              <a href="/health" className="rounded-2xl bg-violet-50 border border-violet-200 p-5 hover:bg-violet-100 transition-colors">
                <div className="text-2xl mb-2">📋</div>
                <h3 className="font-semibold text-violet-800">看系统状态</h3>
                <p className="text-sm text-violet-600 mt-1">检查系统健康度，了解错误分布和优化方向</p>
              </a>
              <a href="/console" className="rounded-2xl bg-rose-50 border border-rose-200 p-5 hover:bg-rose-100 transition-colors">
                <div className="text-2xl mb-2">🏢</div>
                <h3 className="font-semibold text-rose-800">管理目标</h3>
                <p className="text-sm text-rose-600 mt-1">添加或移除要跟踪的目标公司和网站</p>
              </a>
              <a href="/list-all" className="rounded-2xl bg-amber-50 border border-amber-200 p-5 hover:bg-amber-100 transition-colors">
                <div className="text-2xl mb-2">📰</div>
                <h3 className="font-semibold text-amber-800">看原始信息</h3>
                <p className="text-sm text-amber-600 mt-1">浏览所有已采集的原始文档和资讯</p>
              </a>
              <a href="/learn" className="rounded-2xl bg-slate-100 border border-slate-200 p-5 hover:bg-slate-200 transition-colors">
                <div className="text-2xl mb-2">📚</div>
                <h3 className="font-semibold text-slate-800">学习原理</h3>
                <p className="text-sm text-slate-600 mt-1">深入了解系统采集和分析的技术原理</p>
              </a>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">常见问题</h2>
            <div className="space-y-3">
              <details className="rounded-xl bg-white border border-slate-200 p-4">
                <summary className="font-medium text-ink cursor-pointer">需要我手动输入信息吗？</summary>
                <p className="mt-2 text-sm text-slate-600">不需要。系统会自动从公开网页抓取信息，您只需要配置要跟踪的目标公司即可。</p>
              </details>
              <details className="rounded-xl bg-white border border-slate-200 p-4">
                <summary className="font-medium text-ink cursor-pointer">多久更新一次数据？</summary>
                <p className="mt-2 text-sm text-slate-600">每次您点击"执行爬取"时更新。您可以随时触发刷新获取最新信息。</p>
              </details>
              <details className="rounded-xl bg-white border border-slate-200 p-4">
                <summary className="font-medium text-ink cursor-pointer">系统能看到内部信息吗？</summary>
                <p className="mt-2 text-sm text-slate-600">不能。系统只抓取公开网页，无法访问需要登录或内部系统才能查看的内容。</p>
              </details>
              <details className="rounded-xl bg-white border border-slate-200 p-4">
                <summary className="font-medium text-ink cursor-pointer">发现错误怎么办？</summary>
                <p className="mt-2 text-sm text-slate-600">可以去"系统健康度"页面查看错误分类，有些错误（如URL失效）需要手动更新配置。</p>
              </details>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
