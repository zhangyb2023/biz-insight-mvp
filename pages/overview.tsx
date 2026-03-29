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
    phase: "原始数据",
    icon: "📰",
    steps: [
      { title: "61条原始新闻", desc: "从12家目标公司官网抓取的原始信息" },
      { title: "标题+摘要+日期+来源", desc: "每条包含：title, summary, date, company, url" },
    ]
  },
  {
    phase: "质量过滤",
    icon: "🧹",
    steps: [
      { title: "低质量标题过滤", desc: "过滤 Policy/Menu/Read more/空白标题" },
      { title: "首页过滤", desc: "过滤 /index.html、列表页尾" },
      { title: "格式化 CompactItem", desc: "统一字段格式，准备输入 LLM" },
    ]
  },
  {
    phase: "LLM 分类",
    icon: "🏷️",
    steps: [
      { title: "DeepSeek 分类", desc: "判断每条新闻属于哪个类别" },
      { title: "5大分类", desc: "产品技术/生态合作/战略动向/政策法规/人才动态" },
      { title: "降噪过滤", desc: "过滤低质量标题（Policy/Menu/Read more等）" },
    ]
  },
  {
    phase: "LLM 聚合",
    icon: "🤖",
    steps: [
      { title: "DeepSeek 分析", desc: "基于 Prompt 规则，将多条聚合成结构化判断" },
      { title: "生成洞察", desc: "输出 window_summary / top_changes / phua_impacts" },
      { title: "管理建议", desc: "落到具体部门（产品/平台、市场/售前、生态/合作）" },
    ]
  },
  {
    phase: "结构化输出",
    icon: "💡",
    steps: [
      { title: "window_summary", desc: "执行摘要：3件最值得关注的事" },
      { title: "top_changes", desc: "重点变化：3-5条具体变化及影响" },
      { title: "phua_impacts", desc: "对普华影响：竞争压力/合作机会/市场参考" },
      { title: "management_actions", desc: "管理动作：谁做什么，为什么" },
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

          {/* 61条如何变成聚合洞察 */}
          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">61条原始信息如何变成聚合洞察</h2>
            <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-6">

              {/* 第一步：数据来源 */}
              <div className="border-l-4 border-sky-400 pl-4">
                <h3 className="text-sm font-semibold text-ink mb-2">📰 第一步：原始数据（61条）</h3>
                <p className="text-xs text-slate-600 mb-2">从12家目标公司官网抓取的原始信息，每条包含：</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded bg-slate-100 text-xs text-slate-600">title（标题）</span>
                  <span className="px-2 py-1 rounded bg-slate-100 text-xs text-slate-600">summary（摘要）</span>
                  <span className="px-2 py-1 rounded bg-slate-100 text-xs text-slate-600">date（日期）</span>
                  <span className="px-2 py-1 rounded bg-slate-100 text-xs text-slate-600">company（公司）</span>
                  <span className="px-2 py-1 rounded bg-slate-100 text-xs text-slate-600">url（链接）</span>
                </div>
                <p className="text-xs text-slate-500 mt-2 italic">示例：华为发布乾崑智能驾驶方案 | 2026-03-20 | 华为乾崑 | auto.huawei.com/...</p>
              </div>

              {/* 箭头 */}
              <div className="flex justify-center">
                <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>

              {/* 第二步：质量过滤 */}
              <div className="border-l-4 border-amber-400 pl-4">
                <h3 className="text-sm font-semibold text-ink mb-2">🧹 第二步：质量过滤（61条 → 50条）</h3>
                <p className="text-xs text-slate-600 mb-2">过滤低质量内容，保留有效信息：</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-red-400">✗</span>
                    <span className="text-xs text-slate-600">Policy / Menu / Read more / 空白标题</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-400">✗</span>
                    <span className="text-xs text-slate-600">/index.html、站点首页、列表页尾</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span className="text-xs text-slate-600">保留：有实质内容的新闻、公告、发布</span>
                  </div>
                </div>
              </div>

              {/* 箭头 */}
              <div className="flex justify-center">
                <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>

              {/* 第三步：LLM分析 */}
              <div className="border-l-4 border-violet-400 pl-4">
                <h3 className="text-sm font-semibold text-ink mb-2">🤖 第三步：DeepSeek LLM 分析（生成聚合洞察）</h3>
                <p className="text-xs text-slate-600 mb-3">这是最核心的一步！LLM 基于"提示词"对50条有效信息进行聚合商业判断，生成结构化洞察报告。</p>

                {/* 提示词明文展示 */}
                <div className="space-y-4">
                  <div className="rounded-lg bg-slate-900 text-slate-100 p-4 font-mono text-xs overflow-x-auto">
                    <p className="text-emerald-400 mb-2">【System Prompt - 系统提示词】</p>
                    <pre className="whitespace-pre-wrap">{`你是汽车电子基础软件行业的高级商业洞察分析助手，服务对象是普华基础软件有限公司的管理层、业务部门、产品部门、生态合作部门和信息化部门。

你将收到一批时间窗内的动态信息条目。你的任务不是逐条复述，而是做聚合商业判断。

【输出格式强制要求】
1. 只输出合法JSON，不输出任何其他内容
2. 不输出 markdown 代码块
3. 不输出任何解释性文字
4. 不输出引言、总结或前后文
5. 每个字符串字段不超过200字符
6. top_changes 不超过5条
7. company_insights 不超过5条
8. management_actions 不超过5条

【核心原则】
1. 只基于输入证据，不编造
2. 不说空话套话，如"行业持续发展、竞争日趋激烈"
3. 如果证据不足或样本集中，要明确说明结论的边界
4. 结论措辞要适度：多用"建议优先评估、建议重点验证"

【重点关注】
- 产品技术：新产品/方案发布、技术突破、量产进展
- 生态合作：战略合作、标准推进、生态绑定
- 市场动作：客户拓展、融资、产能变化
- 组织变化：关键人才、战略调整

【对普华影响分类】
- 竞争压力：威胁普华市场地位的动作
- 合作机会：可借鉴或可参与的机会
- 产品/市场参考：产品策略、市场定位参考

【管理动作要求】
- management_actions 要落到具体部门（产品/平台、市场/售前、生态/合作）
- 每条建议要包含：哪个部门做什么，为什么

【结论边界要求】
- 如果只有单条证据就说"趋势"，明确说明"样本有限，单条证据仅供参考"
- 如果行业分布集中（如某公司占80%），要说明"本期洞察主要由某公司驱动，结论不代表行业整体"
- 对普华影响要有具体指向，不要泛泛写"值得关注"而是写"建议XX部门关注XX"`}</pre>
                  </div>

                  {/* 提示词作用分解 */}
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-sm font-semibold text-amber-800 mb-3">📌 提示词各部分的作用</p>
                    <div className="space-y-2 text-xs">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="font-medium text-slate-700">提示词部分</div>
                        <div className="font-medium text-slate-700">作用</div>
                        <div className="font-medium text-slate-700">如果不写会怎样</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 border-t border-amber-200 pt-2">
                        <div className="text-slate-600">"不逐条复述，而是聚合商业判断"</div>
                        <div className="text-slate-600">防止 LLM 做"复读机"</div>
                        <div className="text-slate-600">报告变成新闻列表，没有分析</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 border-t border-amber-200 pt-2">
                        <div className="text-slate-600">"不说空话套话"</div>
                        <div className="text-slate-600">防止废话输出</div>
                        <div className="text-slate-600">"行业持续发展"这种无用句子</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 border-t border-amber-200 pt-2">
                        <div className="text-slate-600">"证据不足说明边界"</div>
                        <div className="text-slate-600">防止过度推断</div>
                        <div className="text-slate-600">单条证据被说成"行业趋势"</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 border-t border-amber-200 pt-2">
                        <div className="text-slate-600">"落到具体部门"</div>
                        <div className="text-slate-600">报告可执行</div>
                        <div className="text-slate-600">"建议关注"不知道谁来做</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 border-t border-amber-200 pt-2">
                        <div className="text-slate-600">"竞争压力/合作机会分类"</div>
                        <div className="text-slate-600">分析有普华视角</div>
                        <div className="text-slate-600">泛泛而谈，没有针对性</div>
                      </div>
                    </div>
                  </div>

                  {/* 质量保证机制 */}
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-sm font-semibold text-emerald-800 mb-2">📊 置信率保证机制</p>
                    <div className="grid md:grid-cols-2 gap-3 text-xs text-emerald-700">
                      <div className="flex items-start gap-2">
                        <span className="font-bold">1.</span>
                        <span><strong>证据数量限制</strong>：top_changes 不超过5条，每条都是精选的</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold">2.</span>
                        <span><strong>单条证据边界</strong>：要说明"样本有限"，不会以偏概全</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold">3.</span>
                        <span><strong>分布集中说明</strong>：某公司占80%要说明"主要由某公司驱动"</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold">4.</span>
                        <span><strong>措辞边界</strong>：多用"建议优先"，不用"必须立即否则"</span>
                      </div>
                    </div>
                  </div>

                  {/* 输入输出例子 */}
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-sm font-semibold text-slate-700 mb-2">📝 输入→输出例子</p>
                    <div className="space-y-2 text-xs">
                      <div>
                        <p className="font-medium text-slate-600 mb-1">输入数据（3条新闻）：</p>
                        <div className="bg-slate-100 p-2 rounded text-slate-600 font-mono">
                          1. 经纬恒润发布ZCU技术白皮书 | 2026-03-27<br/>
                          2. 丰田与电装合资推进车载SoC研发 | 2026-03-25<br/>
                          3. 法雷奥投资2.25亿美元在美国建厂 | 2026-03-20
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-slate-600 mb-1">LLM 输出的洞察：</p>
                        <div className="bg-slate-100 p-2 rounded text-slate-600 font-mono">
                          top_changes[0] = &#123;<br/>
                          &nbsp;&nbsp;title: "经纬恒润发布ZCU白皮书",<br/>
                          &nbsp;&nbsp;judgement: "新产品发布，在区域控制器领域与普华形成竞争",<br/>
                          &nbsp;&nbsp;to_phua_impact: "竞争压力",<br/>
                          &nbsp;&nbsp;recommended_action: "建议产品部门验证Autosar方案与ZCU兼容性"<br/>
                          &#125;
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 箭头 */}
              <div className="flex justify-center">
                <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>

              {/* 第四步：结构化输出 */}
              <div className="border-l-4 border-emerald-400 pl-4">
                <h3 className="text-sm font-semibold text-ink mb-2">💡 第四步：结构化输出（5大模块）</h3>
                <p className="text-xs text-slate-600 mb-3">LLM 输出的结构化洞察：</p>
                
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-emerald-700">window_summary</span>
                      <span className="text-xs text-emerald-500">执行摘要</span>
                    </div>
                    <p className="text-xs text-emerald-600">→ 本期最值得关注的3件事 + 信号强度 + 边界说明</p>
                    <p className="text-xs text-slate-500 mt-1 italic">"近30天产品技术信号最活跃（18次命中），行业关注点集中于此"</p>
                  </div>

                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-blue-700">top_changes</span>
                      <span className="text-xs text-blue-500">重点变化（3-5条）</span>
                    </div>
                    <p className="text-xs text-blue-600">→ 每条包含：标题 + 判断 + 重要性 + 对普华影响 + 建议动作</p>
                    <p className="text-xs text-slate-500 mt-1 italic">"华为发布乾崑智能驾驶方案 → 需评估对基础软件兼容性需求"</p>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-amber-700">phua_impacts</span>
                      <span className="text-xs text-amber-500">对普华影响（三栏）</span>
                    </div>
                    <p className="text-xs text-amber-600">→ 竞争压力 / 合作机会 / 产品市场参考</p>
                    <p className="text-xs text-slate-500 mt-1 italic">"中科创达座舱方案可能压缩普华在长安的项目机会"</p>
                  </div>

                  <div className="p-3 rounded-lg bg-violet-50 border border-violet-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-violet-700">company_insights</span>
                      <span className="text-xs text-violet-500">重点公司观察</span>
                    </div>
                    <p className="text-xs text-violet-600">→ 每公司：信号级别 + 核心动作 + 商业含义 + 对普华</p>
                  </div>

                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-rose-700">management_actions</span>
                      <span className="text-xs text-rose-500">管理动作建议</span>
                    </div>
                    <p className="text-xs text-rose-600">→ 部门 + 具体动作 + 优先级 + 原因</p>
                    <p className="text-xs text-slate-500 mt-1 italic">"建议市场/售前团队：尽快对接长安，了解智能驾驶方案选型计划，原因：华为已获长安量产定点"</p>
                  </div>
                </div>
              </div>

              {/* 证据链说明 */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <h4 className="text-sm font-semibold text-ink mb-2">🔗 证据链：每条洞察都可追溯</h4>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <span className="text-violet-500 font-bold">1.</span>
                    <span><strong>原始数据</strong> → 12家公司官网发布的61条新闻（含标题、链接、日期）</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-violet-500 font-bold">2.</span>
                    <span><strong>质量过滤</strong> → 过滤后保留50条有效信息（去除 Policy/Menu/首页等）</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-violet-500 font-bold">3.</span>
                    <span><strong>LLM 聚合</strong> → DeepSeek 基于 Prompt 分析50条，输出结构化判断</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-violet-500 font-bold">4.</span>
                    <span><strong>结果溯源</strong> → 用户可点击洞察卡片，查看对应原始新闻链接</span>
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* LLM 分类阶段详解 */}
          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">LLM 分类阶段详解（Stage 1）</h2>
            <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-6">
              <div className="p-4 rounded-lg bg-violet-50 border border-violet-200">
                <p className="text-sm text-violet-800">
                  <span className="font-semibold">为什么需要分类？</span>
                  原始新闻来自12家公司，主题杂乱。分类可以帮助：1) 过滤噪音（如政策页面）；2) 按主题筛选查看；3) 为后续聚合阶段提供结构化输入。
                </p>
              </div>

              <div className="border-l-4 border-violet-400 pl-4">
                <h3 className="text-sm font-semibold text-ink mb-2">🏷️ 分类 Prompt 明文</h3>
                <div className="bg-slate-900 text-slate-100 p-4 rounded font-mono text-xs overflow-x-auto">
                  <pre className="whitespace-pre-wrap">{`你是一个专业的汽车行业商业新闻分类助手。请分析以下新闻，判断每个属于哪个分类。

分类标准（必须严格选择其一）：
- 产品技术：新品发布、产品获奖、技术突破、研发进展、专利算法、系统升级
- 生态合作：战略合作、联盟签约、生态伙伴奖、标准参与、并购整合
- 战略动向：融资动态、财报业绩、产能扩张、高管变动、上市、投资
- 政策法规：政府政策、行业标准、监管动态、合规要求、认证
- 人才动态：招聘需求、人才趋势、技能要求、社招、校招

返回JSON格式（只返回JSON，不要其他内容）：
{"items":[{"id":"1","category":"分类名称","reason":"简短分类理由"},...]}`}</pre>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm font-semibold text-amber-800 mb-3">📌 分类 Prompt 设计解析</p>
                <div className="space-y-3 text-xs text-amber-700">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="font-medium text-slate-700">Prompt 部分</div>
                    <div className="font-medium text-slate-700">作用</div>
                    <div className="font-medium text-slate-700">如果不写会怎样</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-amber-200 pt-2">
                    <div className="text-slate-600">"必须严格选择其一"</div>
                    <div className="text-slate-600">防止模糊分类</div>
                    <div className="text-slate-600">新闻被归为多个类别或"其他"</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-amber-200 pt-2">
                    <div className="text-slate-600">5大分类明确界定</div>
                    <div className="text-slate-600">标准统一可执行</div>
                    <div className="text-slate-600">不同人/次分类结果不一致</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-amber-200 pt-2">
                    <div className="text-slate-600">返回 JSON 格式</div>
                    <div className="text-slate-600">便于程序解析</div>
                    <div className="text-slate-600">需要额外解析步骤</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-amber-200 pt-2">
                    <div className="text-slate-600">包含 reason 理由</div>
                    <div className="text-slate-600">可追溯分类逻辑</div>
                    <div className="text-slate-600">无法调试错误分类</div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-sm font-semibold text-emerald-800 mb-2">📊 分类类别说明</p>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div className="p-2 rounded bg-emerald-100/50">
                    <span className="font-semibold text-emerald-700">产品技术</span>
                    <p className="text-emerald-600 mt-1">新品发布、获奖、技术突破、研发进展、专利、系统升级</p>
                  </div>
                  <div className="p-2 rounded bg-blue-100/50">
                    <span className="font-semibold text-blue-700">生态合作</span>
                    <p className="text-blue-600 mt-1">战略合作、联盟签约、生态伙伴奖、标准参与、并购整合</p>
                  </div>
                  <div className="p-2 rounded bg-amber-100/50">
                    <span className="font-semibold text-amber-700">战略动向</span>
                    <p className="text-amber-600 mt-1">融资、财报、产能扩张、高管变动、上市、投资</p>
                  </div>
                  <div className="p-2 rounded bg-violet-100/50">
                    <span className="font-semibold text-violet-700">政策法规</span>
                    <p className="text-violet-600 mt-1">政府政策、行业标准、监管动态、合规要求、认证</p>
                  </div>
                  <div className="p-2 rounded bg-rose-100/50">
                    <span className="font-semibold text-rose-700">人才动态</span>
                    <p className="text-rose-600 mt-1">招聘需求、人才趋势、技能要求、社招、校招</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-sm font-semibold text-slate-700 mb-2">📝 输入→输出例子</p>
                <div className="space-y-2 text-xs">
                  <div>
                    <p className="font-medium text-slate-600 mb-1">输入数据（3条原始新闻）：</p>
                    <div className="bg-slate-100 p-2 rounded text-slate-600 font-mono">
                      1. 华为发布乾崑智能驾驶解决方案 V2.0<br/>
                      2. 普华基础软件与中科创达签署战略合作协议<br/>
                      3. 经纬恒润招聘高级嵌入式软件工程师
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-slate-600 mb-1">LLM 返回的 JSON：</p>
                    <div className="bg-slate-100 p-2 rounded text-slate-600 font-mono">
                      &#123;"items":[<br/>
                      &nbsp;&nbsp;&#123;"id":"1","category":"产品技术","reason":"智能驾驶解决方案发布属于产品技术类"&#125;,<br/>
                      &nbsp;&nbsp;&#123;"id":"2","category":"生态合作","reason":"战略合作协议属于生态合作类"&#125;,<br/>
                      &nbsp;&nbsp;&#123;"id":"3","category":"人才动态","reason":"招聘需求属于人才动态类"&#125;<br/>
                      ]&#125;
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm font-semibold text-red-800 mb-2">⚠️ 分类失败降级机制</p>
                <p className="text-xs text-red-700">
                  如果 DeepSeek API 调用失败（如网络错误、超时），系统不会中断，而是降级到 <code className="bg-red-100 px-1 rounded">guessCategory()</code> 函数，
                  基于规则（关键词匹配）进行分类。例如：标题含"招聘"→人才动态，含"融资"→战略动向。
                </p>
                <p className="text-xs text-red-600 mt-2">
                  分类阶段失败不影响整体流程，但分类准确性会下降。
                </p>
              </div>
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
                    <p className="text-xs font-medium text-slate-500 mb-3">⭐ 核心 Prompt 明文（System Prompt）</p>
                    <div className="bg-slate-900 text-slate-100 p-3 rounded font-mono text-xs overflow-x-auto max-h-64">
                      <pre className="whitespace-pre-wrap">{`你是汽车电子基础软件行业的高级商业洞察分析助手，服务对象是普华基础软件有限公司的管理层、业务部门、产品部门、生态合作部门和信息化部门。

你将收到一批时间窗内的动态信息条目。你的任务不是逐条复述，而是做聚合商业判断。

【输出格式强制要求】
1. 只输出合法JSON，不输出任何其他内容
2. 不输出 markdown 代码块
3. 不输出任何解释性文字
4. 不输出引言、总结或前后文
5. 每个字符串字段不超过200字符

【核心原则】
1. 只基于输入证据，不编造
2. 不说空话套话，如"行业持续发展、竞争日趋激烈"
3. 如果证据不足或样本集中，要明确说明结论的边界
4. 结论措辞要适度：多用"建议优先评估、建议重点验证"

【对普华影响分类】
- 竞争压力：威胁普华市场地位的动作
- 合作机会：可借鉴或可参与的机会
- 产品/市场参考：产品策略、市场定位参考

【管理动作要求】
- management_actions 要落到具体部门（产品/平台、市场/售前、生态/合作）
- 每条建议要包含：哪个部门做什么，为什么

【结论边界要求】
- 如果只有单条证据就说"趋势"，明确说明"样本有限，单条证据仅供参考"
- 如果行业分布集中（如某公司占80%），要说明"本期洞察主要由某公司驱动"
- 对普华影响要有具体指向，不要泛泛写"值得关注"而是写"建议XX部门关注XX"`}</pre>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-sm font-semibold text-amber-800 mb-2">📌 提示词关键设计说明</p>
                    <div className="space-y-2 text-xs text-amber-700">
                      <div className="flex items-start gap-2">
                        <span className="font-bold">"不逐条复述"</span>
                        <span>→ 防止 LLM 做复读机，要求做商业判断</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold">"不说空话套话"</span>
                        <span>→ 防止"行业持续发展"这种废话</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold">"落到具体部门"</span>
                        <span>→ 报告可执行，不是"建议关注"这种空话</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold">"说明结论边界"</span>
                        <span>→ 单条证据不夸大，样本集中要说明</span>
                      </div>
                    </div>
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
                    <p className="text-xs font-medium text-slate-500 mb-3">⭐ 核心 Prompt 明文</p>
                    <div className="bg-slate-900 text-slate-100 p-3 rounded font-mono text-xs overflow-x-auto max-h-48">
                      <pre className="whitespace-pre-wrap">{`直接基于原始新闻生成报告，不是基于聚合洞察再加工。

【简版报告要求】
- top_changes 只保留最重要的3条，每条包含公司名、产品名、事件名
- management_actions 只保留3条
- 结论要有具体依据，不泛泛而谈

【管理层报告要求】
- top_changes 保留5条，内容更详细，增加背景和分析深度
- management_actions 保留5条
- 适合管理层汇报，每条结论要有支撑数据或事件

【单公司报告要求】
- 重点写该公司，其他公司只作为对标/合作对象提及
- 先写该公司近30天最重要动作，再写对普华的具体影响

【结论要求】
- 每条结论都要有具体依据：具体到公司名、产品名、合作事件名
- 如果证据不足，明确写"当前公开信息有限，建议继续跟踪"
- 不用"必须/立即/否则"，多用"建议优先/建议重点/若趋势延续则可能"`}</pre>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-sm font-semibold text-emerald-800 mb-2">📌 与聚合洞察的本质区别</p>
                    <div className="space-y-2 text-xs text-emerald-700">
                      <div className="flex items-start gap-2">
                        <span className="font-bold">1.</span>
                        <span><strong>数据来源不同</strong>：聚合洞察用已聚合并排序的数据，商业洞察报告直接用原始新闻</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold">2.</span>
                        <span><strong>详细程度不同</strong>：商业洞察报告要求具体到公司名、产品名、事件名</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-bold">3.</span>
                        <span><strong>用途不同</strong>：聚合洞察是页面展示，商业洞察报告是可下载的 Markdown</span>
                      </div>
                    </div>
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

          {/* LLM 调试指南 */}
          <section>
            <h2 className="text-lg font-semibold text-ink mb-4">LLM 调试指南</h2>
            <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-6">
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">什么时候需要调试 LLM 输出？</span>
                  当洞察报告出现：1) 结论空洞（"行业持续发展"）；2) 分类错误；3) 遗漏重要信息；4) 结论过度推断时，需要检查 Prompt 设计。
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-ink mb-3">🔍 常见问题与解决方案</h3>
                <div className="space-y-3">
                  <div className="p-4 rounded-lg border border-slate-200">
                    <p className="text-xs font-medium text-red-600 mb-1">问题：报告出现"行业持续发展、竞争日趋激烈"等废话</p>
                    <p className="text-xs text-slate-600 mb-1"><span className="font-semibold">原因：</span>Prompt 没有明确禁止空话套话</p>
                    <p className="text-xs text-slate-600"><span className="font-semibold">解决：</span>在核心原则中添加"不说空话套话，如'行业持续发展、竞争日趋激烈'"</p>
                  </div>
                  <div className="p-4 rounded-lg border border-slate-200">
                    <p className="text-xs font-medium text-red-600 mb-1">问题：单条证据被夸大成"行业趋势"</p>
                    <p className="text-xs text-slate-600 mb-1"><span className="font-semibold">原因：</span>Prompt 没有要求说明结论边界</p>
                    <p className="text-xs text-slate-600"><span className="font-semibold">解决：</span>添加"如果只有单条证据就说'趋势'，明确说明'样本有限，单条证据仅供参考'"</p>
                  </div>
                  <div className="p-4 rounded-lg border border-slate-200">
                    <p className="text-xs font-medium text-red-600 mb-1">问题：管理建议写成"建议关注XX"（不知道谁来做）</p>
                    <p className="text-xs text-slate-600 mb-1"><span className="font-semibold">原因：</span>Prompt 没有要求落到具体部门</p>
                    <p className="text-xs text-slate-600"><span className="font-semibold">解决：</span>添加"management_actions 要落到具体部门（产品/平台、市场/售前、生态/合作），每条建议要包含：哪个部门做什么，为什么"</p>
                  </div>
                  <div className="p-4 rounded-lg border border-slate-200">
                    <p className="text-xs font-medium text-red-600 mb-1">问题：分类结果不准确（如合作新闻被归为产品技术）</p>
                    <p className="text-xs text-slate-600 mb-1"><span className="font-semibold">原因：</span>分类标准定义不够清晰或重叠</p>
                    <p className="text-xs text-slate-600"><span className="font-semibold">解决：</span>在分类 prompt 中明确各类别的边界关键词，如"战略合作"是生态合作，"技术突破"是产品技术</p>
                  </div>
                  <div className="p-4 rounded-lg border border-slate-200">
                    <p className="text-xs font-medium text-red-600 mb-1">问题：报告结论过于模糊（"值得关注"）</p>
                    <p className="text-xs text-slate-600 mb-1"><span className="font-semibold">原因：</span>Prompt 没有要求具体影响分析</p>
                    <p className="text-xs text-slate-600"><span className="font-semibold">解决：</span>添加"对普华影响要有具体指向，不要泛泛写'值得关注'而是写'建议XX部门关注XX'"</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-ink mb-3">📐 Prompt 优化检查清单</h3>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>明确禁止项：如"不说空话套话"、"不逐条复述"、"不输出 markdown"</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>输出格式约束：JSON 结构、字段数量限制（如 top_changes 不超过5条）</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>结论边界要求：证据不足时说明、单条证据不夸大、样本集中要说明</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>具体性要求：落到公司名、产品名、事件名、具体部门</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>措辞边界：多用"建议优先"，不用"必须立即否则"</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>降级机制：API 失败时的 fallback 策略</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-ink mb-3">🧪 调试方法</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-violet-50 border border-violet-100">
                    <p className="text-xs font-semibold text-violet-700 mb-2">1. 直接测试 API</p>
                    <p className="text-xs text-violet-600">使用 curl 直接调用 DeepSeek API，传入设计的 Prompt 和样本数据，检查输出是否符合理想</p>
                  </div>
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                    <p className="text-xs font-semibold text-emerald-700 mb-2">2. 控制变量测试</p>
                    <p className="text-xs text-emerald-600">保持其他条件不变，只修改 Prompt 某一部分，对比输出差异</p>
                  </div>
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
                    <p className="text-xs font-semibold text-amber-700 mb-2">3. 边界条件测试</p>
                    <p className="text-xs text-amber-600">用单条证据、空白数据、异常数据测试，观察 Prompt 的约束是否有效</p>
                  </div>
                  <div className="p-4 rounded-lg bg-sky-50 border border-sky-100">
                    <p className="text-xs font-semibold text-sky-700 mb-2">4. 温度参数调优</p>
                    <p className="text-xs text-sky-600">当前使用 temperature=0.3（低随机性），如果需要更创造性输出可提高到 0.5-0.7</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-100 border border-slate-200">
                <p className="text-xs text-slate-500">
                  <span className="font-semibold">Prompt 文件位置：</span>
                  <code className="bg-slate-200 px-1 rounded">lib/crawl/llmClassifier.ts</code>（分类阶段）|
                  <code className="bg-slate-200 px-1 rounded">pages/api/insights/generate-brief.ts</code>（聚合阶段）|
                  <code className="bg-slate-200 px-1 rounded">pages/api/insights/report.ts</code>（报告阶段）
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
