import Head from "next/head";

const COMPANIES = [
  { id: "vector", name: "Vector", url: "www.vector.com" },
  { id: "elektrobit", name: "Elektrobit", url: "www.elektrobit.com" },
  { id: "tttech-auto", name: "TTTech Auto", url: "www.tttech-auto.com" },
  { id: "hirain", name: "经纬恒润", url: "www.hirain.com" },
  { id: "reachauto", name: "东软睿驰", url: "reachauto.com" },
  { id: "thundersoft", name: "中科创达", url: "www.thundersoft.com" },
  { id: "huawei-qiankun-auto", name: "华为乾崑", url: "auto.huawei.com" },
  { id: "semi-drive", name: "芯驰科技", url: "www.semidrive.com" },
  { id: "black-sesame", name: "黑芝麻智能", url: "www.blacksesame.com" },
  { id: "etas", name: "ETAS", url: "www.etas.com" },
  { id: "autosar", name: "AUTOSAR", url: "www.autosar.org" },
  { id: "gasgoo", name: "盖世汽车", url: "auto.gasgoo.com" },
];

const CRAWL_STRATEGIES = [
  { name: "gasgoo_flash", company: "盖世汽车", url: "auto.gasgoo.com/newsflash", tech: "Cheerio + 分页解析", note: "快讯列表，含多页翻页" },
  { name: "autosar_news", company: "AUTOSAR", url: "www.autosar.org/news-events", tech: "Cheerio + 日期提取", note: "英文新闻，含日期解析" },
  { name: "thundersoft_news", company: "中科创达", url: "www.thundersoft.com/category/newsroom", tech: "WordPress 结构解析", note: "WordPress CMS" },
  { name: "huaweiAuto_news", company: "华为乾崑", url: "auto.huawei.com/cn/news", tech: "Cheerio + 详情页抓取", note: "需抓列表+详情页" },
  { name: "hirain_news", company: "经纬恒润", url: "www.hirain.com/news", tech: "Cheerio + 分页", note: "多页翻页" },
  { name: "reachauto_news", company: "东软睿驰", url: "reachauto.com/corporate-news", tech: "Cheerio + 双HTML结构", note: "两种列表结构" },
  { name: "etas_news", company: "ETAS", url: "www.etas.com/ww/en/about-etas/newsroom", tech: "Cheerio + 英文", note: "英文站点" },
  { name: "vector_news", company: "Vector", url: "www.vector.com/.*/events/overview", tech: "Playwright", note: "动态渲染，需浏览器" },
  { name: "semidrive_news", company: "芯驰科技", url: "www.semidrive.com/news", tech: "Cheerio + 多页", note: "多页+图片处理" },
  { name: "elektrobit_news", company: "Elektrobit", url: "www.elektrobit.com/newsroom", tech: "Cheerio + 表格结构", note: "表格布局" },
  { name: "blacksesame_news", company: "黑芝麻智能", url: "www.blacksesame.com/zh/news-center", tech: "Cheerio + 详情页", note: "需抓详情页日期" },
  { name: "tttech_auto_news", company: "TTTech Auto", url: "www.tttech-auto.com/newsroom", tech: "Playwright + Cloudflare", note: "动态渲染+反爬" },
];

const INSIGHT_WORKFLOW = [
  {
    phase: "数据采集",
    icon: "🕷️",
    steps: [
      { title: "策略匹配", desc: "根据URL自动匹配爬虫策略" },
      { title: "页面抓取", desc: "Cheerio静态抓取 / Playwright动态渲染" },
      { title: "内容提取", desc: "提取标题、日期、摘要、正文、链接" },
      { title: "质量过滤", desc: "过滤低质量标题（Policy/Menu/空白等）" },
    ]
  },
  {
    phase: "LLM 分析",
    icon: "🤖",
    steps: [
      { title: "输入处理", desc: "将原始数据格式化为 CompactItem" },
      { title: "Prompt 构建", desc: "包含系统角色、输出格式强制要求、字段长度限制" },
      { title: "DeepSeek 调用", desc: "temperature=0.3，强制JSON输出" },
      { title: "容错解析", desc: "处理 ```json 代码块，提取 { } 区间内容" },
    ]
  },
  {
    phase: "聚合洞察",
    icon: "💡",
    steps: [
      { title: "generate-brief API", desc: "聚合多源信息，输出 window_summary / top_changes / company_insights / phua_impacts / management_actions" },
      { title: "范围过滤", desc: "按 company_ids 精确过滤，单公司报告独立生成" },
      { title: "状态返回", desc: "ok + empty + reason 三元状态，前端明确展示" },
    ]
  },
  {
    phase: "报告生成",
    icon: "📄",
    steps: [
      { title: "generate-report API", desc: "基于 brief_data 生成 Markdown 格式报告" },
      { title: "报告类型", desc: "总览简报（全部公司）vs 观察简报（单公司）" },
      { title: "报告结构", desc: "报告说明 → 执行摘要 → 重点变化 → 公司观察 → 对普华影响 → 管理动作 → 证据附录" },
    ]
  },
];

const TOPIC_TAGS = [
  { key: "product_tech", label: "产品技术", desc: "新产品/方案发布、技术突破、量产进展" },
  { key: "ecosystem", label: "生态合作", desc: "战略合作、标准推进、生态绑定" },
  { key: "strategy", label: "战略动向", desc: "融资、高管变动、组织调整、战略转型" },
  { key: "policy", label: "政策法规", desc: "法规、标准、认证、监管" },
  { key: "talent", label: "人才动态", desc: "招聘、人才流动" },
  { key: "market", label: "行业动态", desc: "市场分析、媒体解读（兜底分类）" },
];

const EVIDENCE_TYPES = [
  { key: "all", label: "全部证据" },
  { key: "official", label: "官方发布" },
  { key: "product_page", label: "方案产品页" },
  { key: "case_study", label: "案例页" },
  { key: "media", label: "媒体报道" },
  { key: "job", label: "招聘信息" },
  { key: "document", label: "文档资料" },
  { key: "full_text", label: "长文本" },
];

export default function OverviewPage() {
  return (
    <>
      <Head>
        <title>系统总览 | 商业洞察</title>
      </Head>
      <main className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-ink">商业洞察系统总览</h1>
                <p className="text-sm text-slate-500 mt-1">工作流程、爬虫策略与洞察生成方法</p>
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

        <div className="mx-auto max-w-6xl px-6 py-8 space-y-10">

          {/* 一句话说明 */}
          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">系统定位</h2>
            <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-6">
              <p className="text-lg leading-relaxed text-slate-700">
                <span className="font-semibold text-emerald-700">商业洞察系统</span> 自动抓取目标公司的公开网页，
                用 AI 分析内容并提取关键信息，最终生成
                <span className="font-semibold text-emerald-700"> 可行动的洞察结论</span>，
                帮助您快速了解竞争对手动态、市场趋势和商业机会。
              </p>
            </div>
          </section>

          {/* 数据流转图 */}
          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">数据流转</h2>
            <div className="rounded-2xl bg-white border border-slate-200 p-6 overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                <div className="px-4 py-3 rounded-xl bg-sky-100 border border-sky-300 text-sm font-medium text-sky-700">
                  🌐 网页
                </div>
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <div className="px-4 py-3 rounded-xl bg-emerald-100 border border-emerald-300 text-sm font-medium text-emerald-700">
                  🕷️ 策略爬取
                </div>
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <div className="px-4 py-3 rounded-xl bg-amber-100 border border-amber-300 text-sm font-medium text-amber-700">
                  🧹 质量过滤
                </div>
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <div className="px-4 py-3 rounded-xl bg-violet-100 border border-violet-300 text-sm font-medium text-violet-700">
                  🤖 LLM分析
                </div>
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <div className="px-4 py-3 rounded-xl bg-rose-100 border border-rose-300 text-sm font-medium text-rose-700">
                  💡 洞察输出
                </div>
              </div>
            </div>
          </section>

          {/* 目标公司 */}
          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">跟踪目标公司（{COMPANIES.length}家）</h2>
            <div className="rounded-2xl bg-white border border-slate-200 p-6">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {COMPANIES.map((company) => (
                  <div key={company.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-lg">🏢</span>
                    <div>
                      <p className="text-sm font-medium text-ink">{company.name}</p>
                      <p className="text-xs text-slate-400">{company.url}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 爬虫策略 */}
          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">爬虫策略（{CRAWL_STRATEGIES.length}个）</h2>
            <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">策略名</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">公司</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">URL模式</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">技术</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">备注</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {CRAWL_STRATEGIES.map((strategy) => (
                      <tr key={strategy.name} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-violet-600">{strategy.name}</td>
                        <td className="px-4 py-3 text-sm text-ink">{strategy.company}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500 max-w-xs truncate">{strategy.url}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">{strategy.tech}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{strategy.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  策略文件位置：<code className="bg-slate-200 px-1 rounded">lib/crawl/strategies/</code>
                  | 注册文件：<code className="bg-slate-200 px-1 rounded">lib/crawl/strategies/index.ts</code>
                </p>
              </div>
            </div>
          </section>

          {/* 洞察生成流程 */}
          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">商业洞察生成流程</h2>
            <div className="space-y-6">
              {INSIGHT_WORKFLOW.map((phase) => (
                <div key={phase.phase} className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-3 px-6 py-4 bg-slate-50 border-b border-slate-200">
                    <span className="text-2xl">{phase.icon}</span>
                    <h3 className="font-semibold text-ink">{phase.phase}</h3>
                  </div>
                  <div className="p-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      {phase.steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-moss/10 text-moss text-xs font-medium flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-ink">{step.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 主题分类 */}
          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">主题分类体系</h2>
            <div className="rounded-2xl bg-white border border-slate-200 p-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {TOPIC_TAGS.map((topic) => (
                  <div key={topic.key} className="p-4 rounded-lg border border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-ink">{topic.label}</span>
                      <code className="text-xs bg-slate-200 px-1.5 rounded text-slate-500">{topic.key}</code>
                    </div>
                    <p className="text-xs text-slate-500">{topic.desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm text-amber-800">
                  <span className="font-medium">分类优先级：</span>
                  insight_topic_tags → insight_event_type → category/insight_type → market（兜底）
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  mapToTopic() 函数位于 pages/insights.tsx，负责将原始数据映射到主题分类
                </p>
              </div>
            </div>
          </section>

          {/* 证据类型 */}
          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">证据类型筛选</h2>
            <div className="rounded-2xl bg-white border border-slate-200 p-6">
              <div className="flex flex-wrap gap-2">
                {EVIDENCE_TYPES.map((type) => (
                  <span key={type.key} className="px-3 py-1.5 rounded-lg bg-slate-100 text-sm text-slate-600">
                    {type.label}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3">
                证据类型在 filteredItems useMemo 中通过 getEntityType() 判断，用于筛选不同类型的原始文档
              </p>
            </div>
          </section>

          {/* 三大洞察输出详解 */}
          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">三大洞察输出详解</h2>
            <div className="space-y-6">

              {/* 聚合洞察 */}
              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-slate-200">
                  <span className="text-2xl">💡</span>
                  <div>
                    <h3 className="font-semibold text-ink">聚合洞察（页面显示）</h3>
                    <p className="text-xs text-slate-500">页面加载时自动生成，用户进入页面即可见</p>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-xs font-medium text-slate-500 mb-2">调用时机</p>
                      <p className="text-sm text-ink">用户访问 /insights 页面时自动调用</p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-xs font-medium text-slate-500 mb-2">API 端点</p>
                      <p className="text-sm text-ink font-mono">/api/insights/generate-brief</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">输出内容（5大模块）</p>
                    <div className="space-y-2">
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                        <span className="text-emerald-600 font-bold text-sm w-36">window_summary</span>
                        <div>
                          <p className="text-sm font-medium text-emerald-800">执行摘要</p>
                          <p className="text-xs text-emerald-600">overall_judgement: 本期最值得关注的3件事</p>
                          <p className="text-xs text-emerald-600">signal_density: 信号强度（高/中/低）</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                        <span className="text-blue-600 font-bold text-sm w-36">top_changes</span>
                        <div>
                          <p className="text-sm font-medium text-blue-800">本期重点变化（3-5条）</p>
                          <p className="text-xs text-blue-600">title/judgement/why_important/to_phua_impact/recommended_action</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                        <span className="text-amber-600 font-bold text-sm w-36">phua_impacts</span>
                        <div>
                          <p className="text-sm font-medium text-amber-800">对普华影响（三栏）</p>
                          <p className="text-xs text-amber-600">competition_pressure: 竞争压力</p>
                          <p className="text-xs text-amber-600">cooperation_opportunities: 合作机会</p>
                          <p className="text-xs text-amber-600">product_market_reference: 产品/市场参考</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-violet-50 border border-violet-100">
                        <span className="text-violet-600 font-bold text-sm w-36">company_insights</span>
                        <div>
                          <p className="text-sm font-medium text-violet-800">重点公司观察</p>
                          <p className="text-xs text-violet-600">company/signal_level/main_move/business_meaning/to_phua_impact</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-50 border border-rose-100">
                        <span className="text-rose-600 font-bold text-sm w-36">management_actions</span>
                        <div>
                          <p className="text-sm font-medium text-rose-800">管理动作建议</p>
                          <p className="text-xs text-rose-600">department/action/priority/reason</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-xs font-medium text-slate-500 mb-2">核心 Prompt 逻辑</p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      将多条原始新闻聚合成结构化判断，不逐条复述新闻，而是提取商业意义。<br/>
                      结论边界：单条证据说明"样本有限"，分布集中说明"主要由某公司驱动"。<br/>
                      措辞要求：多用"建议优先评估/建议重点验证"，不用"必须/立即/否则"。
                    </p>
                  </div>
                </div>
              </div>

              {/* 商业洞察报告 */}
              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-200">
                  <span className="text-2xl">📊</span>
                  <div>
                    <h3 className="font-semibold text-ink">商业洞察报告（弹窗生成）</h3>
                    <p className="text-xs text-slate-500">点击"生成洞察报告"按钮，选择简版/管理层报告后生成</p>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-xs font-medium text-slate-500 mb-2">调用时机</p>
                      <p className="text-sm text-ink">用户点击"生成洞察报告"按钮，在弹窗中选择报告类型后调用</p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-xs font-medium text-slate-500 mb-2">API 端点</p>
                      <p className="text-sm text-ink font-mono">/api/insights/report</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
                      <p className="text-xs font-medium text-amber-600 mb-1">📝 简版报告</p>
                      <p className="text-xs text-amber-600">重点变化 3 条，管理动作 3 条</p>
                      <p className="text-xs text-amber-600 mt-1">适合快速浏览</p>
                    </div>
                    <div className="p-4 rounded-lg bg-violet-50 border border-violet-100">
                      <p className="text-xs font-medium text-violet-600 mb-1">📊 管理层报告</p>
                      <p className="text-xs text-violet-600">重点变化 5 条，管理动作 5 条</p>
                      <p className="text-xs text-violet-600 mt-1">适合管理层汇报</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">与聚合洞察的区别</p>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-500">✓</span>
                        <p className="text-xs text-slate-600">传入数据：直接传入原始新闻（compactItems），不是已聚合的二手数据</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-500">✓</span>
                        <p className="text-xs text-slate-600">Prompt 要求：内容具体到公司名、产品名、事件名</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-500">✓</span>
                        <p className="text-xs text-slate-600">区分简版/管理层：内容详细程度不同</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-500">✓</span>
                        <p className="text-xs text-slate-600">输出格式：Markdown</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-xs font-medium text-slate-500 mb-2">核心 Prompt 逻辑</p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      直接基于原始新闻生成报告，不是基于聚合洞察再加工。<br/>
                      每条结论都要有具体依据，具体到公司名、产品名、合作事件名。<br/>
                      单公司报告：重点写该公司，其他公司只作为对标/合作对象提及。
                    </p>
                  </div>
                </div>
              </div>

              {/* Markdown报告 */}
              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-sky-50 to-cyan-50 border-b border-slate-200">
                  <span className="text-2xl">📥</span>
                  <div>
                    <h3 className="font-semibold text-ink">Markdown 报告（下载）</h3>
                    <p className="text-xs text-slate-500">点击"下载 Markdown 报告"按钮，直接下载文件</p>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-xs font-medium text-slate-500 mb-2">调用时机</p>
                      <p className="text-sm text-ink">用户点击"下载 Markdown 报告"按钮，直接下载</p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-xs font-medium text-slate-500 mb-2">API 端点</p>
                      <p className="text-sm text-ink font-mono">/api/insights/generate-report</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                      <p className="text-xs font-medium text-emerald-600 mb-1">✅ 优先复用 brief_data</p>
                      <p className="text-xs text-emerald-600">当页面已有聚合洞察时，直接复用，不重新调用 DeepSeek</p>
                    </div>
                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
                      <p className="text-xs font-medium text-amber-600 mb-1">📋 报告结构</p>
                      <p className="text-xs text-amber-600">报告说明 → 执行摘要 → 重点变化 → 对普华影响 → 管理动作</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">与商业洞察报告的区别</p>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-500">✓</span>
                        <p className="text-xs text-slate-600">数据来源：复用页面已生成的聚合洞察（brief_data）</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-500">✓</span>
                        <p className="text-xs text-slate-600">不需要重新调用 DeepSeek，节省 API 成本</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-500">✓</span>
                        <p className="text-xs text-slate-600">内容与页面聚合洞察一致，只是 Markdown 格式</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-500">✓</span>
                        <p className="text-xs text-slate-600">报告类型：总览简报（全部公司）/ 观察简报（单公司）</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* API 端点 */}
          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">核心 API 端点</h2>
            <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">端点</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">方法</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">功能</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-violet-600">/api/insights/generate-brief</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs">POST</span></td>
                    <td className="px-4 py-3 text-sm text-slate-600">聚合洞察：window_summary / top_changes / company_insights / phua_impacts / management_actions</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-violet-600">/api/insights/generate-report</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs">POST</span></td>
                    <td className="px-4 py-3 text-sm text-slate-600">Markdown 报告生成，支持传入 brief_data 复用</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-violet-600">/api/insights/enrich-one</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs">POST</span></td>
                    <td className="px-4 py-3 text-sm text-slate-600">单条信息增强，补充 insight_* 字段</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs text-violet-600">/api/all-items</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-sky-100 text-sky-700 text-xs">GET</span></td>
                    <td className="px-4 py-3 text-sm text-slate-600">获取全部原始文档列表</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 低质量过滤规则 */}
          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">低质量内容过滤规则</h2>
            <div className="rounded-2xl bg-white border border-slate-200 p-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-ink mb-2">isLowQualityTitle() - 标题过滤</h4>
                  <div className="flex flex-wrap gap-2">
                    {["Policy", "Menu", "Policy menu", "Read more", "Learn more", "Click here", "导航", "空白标题", "纯日期"].map((item) => (
                      <span key={item} className="px-2 py-1 rounded bg-red-50 border border-red-200 text-xs text-red-700">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-ink mb-2">LOW_VALUE_PATTERNS - 综合模式</h4>
                  <div className="flex flex-wrap gap-2">
                    {["车型报价类", "用户生成内容", "视频内容", "工具类", "评测对比类", "站点首页类", "频道首页类", "版权信息"].map((item) => (
                      <span key={item} className="px-2 py-1 rounded bg-amber-50 border border-amber-200 text-xs text-amber-700">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-ink mb-2">isSiteHomepage() - 首页过滤</h4>
                  <p className="text-xs text-slate-500">过滤 /index.html、纯域名 URL、/news/、/products/ 等列表页尾</p>
                </div>
              </div>
              <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">
                  过滤函数位于 <code className="bg-slate-200 px-1 rounded">pages/insights.tsx</code>，
                  同时下沉到 <code className="bg-slate-200 px-1 rounded">generate-brief.ts</code> 和 <code className="bg-slate-200 px-1 rounded">generate-report.ts</code>
                </p>
              </div>
            </div>
          </section>

          {/* 快速导航 */}
          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">快速导航</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <a href="/insights" className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 hover:bg-emerald-100 transition-colors">
                <div className="text-2xl mb-2">💡</div>
                <h3 className="font-semibold text-emerald-800">商业洞察</h3>
                <p className="text-sm text-emerald-600 mt-1">查看聚合洞察、核心判断、重点变化</p>
              </a>
              <a href="/workbench" className="rounded-2xl bg-sky-50 border border-sky-200 p-5 hover:bg-sky-100 transition-colors">
                <div className="text-2xl mb-2">🕷️</div>
                <h3 className="font-semibold text-sky-800">工作台</h3>
                <p className="text-sm text-sky-600 mt-1">执行爬取、选择策略、查看结果</p>
              </a>
              <a href="/console" className="rounded-2xl bg-violet-50 border border-violet-200 p-5 hover:bg-violet-100 transition-colors">
                <div className="text-2xl mb-2">🏢</div>
                <h3 className="font-semibold text-violet-800">公司管理</h3>
                <p className="text-sm text-violet-600 mt-1">配置目标公司和爬取规则</p>
              </a>
            </div>
          </section>

        </div>
      </main>
    </>
  );
}
