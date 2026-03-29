import Head from "next/head";
import { useState, useEffect } from "react";

interface LLMTrace {
  id: number;
  prompt_version: string;
  model_name: string;
  status: string;
  llm_confidence: number | null;
  created_at: string;
  company_id: string;
  doc_url: string;
  doc_title: string;
  insight_id: number | null;
  insight_summary: string | null;
  insight_confidence: number | null;
  insight_category: string | null;
  item_count: number;
  input_preview: any[];
  raw_response: string;
}

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null || confidence === undefined) {
    return <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-xs">无数据</span>;
  }
  const level = confidence >= 0.6 ? "高" : confidence >= 0.5 ? "中" : "低";
  const color = confidence >= 0.6 ? "emerald" : confidence >= 0.5 ? "amber" : "rose";
  const colorClass = {
    emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    rose: "bg-rose-100 text-rose-700 border-rose-200",
  }[color];
  return (
    <span className={`px-2 py-0.5 rounded border text-xs font-medium ${colorClass}`}>
      {level} ({confidence.toFixed(2)})
    </span>
  );
}

function PipelineStage({
  stage,
  icon,
  summary,
  purpose,
  input,
  output,
  tools,
  rules,
  details,
  whitebox,
  example,
  color,
  bg,
  border,
}: {
  stage: string;
  icon?: string;
  summary: string;
  purpose: string;
  input: string[];
  output: string[];
  tools: string[];
  rules: string[];
  details: string[];
  whitebox: string;
  example?: { before?: string; after?: string; note?: string };
  color: string;
  bg: string;
  border: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border ${border} ${bg} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-opacity-80 transition-colors"
      >
        <div className={`w-10 h-10 rounded-full bg-white border-2 ${border} flex items-center justify-center flex-shrink-0 text-lg`}>
          {icon || stage.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">{stage}</span>
            <span className="text-xs text-slate-400">→</span>
            <span className="text-xs text-slate-600">{purpose}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{summary}</div>
        </div>
        <div className="hidden md:flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-xs text-sky-500">📥</span>
            <span className="text-xs text-slate-600">{input[0]}</span>
          </div>
          <div className="text-slate-300">→</div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-emerald-500">📤</span>
            <span className="text-xs text-slate-600">{output[0]}</span>
          </div>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-200 pt-3">
          <div className="bg-white/60 rounded-lg p-3 mb-4">
            <div className="text-xs font-semibold text-slate-500 mb-1">🎯 这个步骤为什么存在？</div>
            <p className="text-sm text-slate-700">{purpose}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                <span className="text-sky-500">📥</span> 输入
              </div>
              <ul className="space-y-1">
                {input.map((inp, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-1">
                    <span className="text-sky-400 mt-0.5">•</span> {inp}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                <span className="text-emerald-500">📤</span> 输出
              </div>
              <ul className="space-y-1">
                {output.map((out, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-1">
                    <span className="text-emerald-400 mt-0.5">•</span> {out}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                <span className="text-violet-500">🔧</span> 工具 / 函数
              </div>
              <div className="flex flex-wrap gap-1">
                {tools.map((tool, i) => (
                  <span key={i} className="px-2 py-0.5 bg-slate-800 text-slate-100 rounded text-xs font-mono">{tool}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                <span className="text-amber-500">📏</span> 规则
              </div>
              <div className="flex flex-wrap gap-1">
                {rules.map((rule, i) => (
                  <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs">{rule}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
              <span className="text-cyan-500">📋</span> 详细步骤
            </div>
            <ul className="space-y-1 bg-white rounded-lg p-2">
              {details.map((detail, i) => (
                <li key={i} className="text-xs text-slate-600 flex items-start gap-1">
                  <span className="text-cyan-400 mt-0.5">{i + 1}.</span> {detail}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mb-4">
            <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
              <span className="text-slate-400">🔬</span> 白盒透明性
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{whitebox}</p>
          </div>

          {example && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-3 border border-indigo-200">
              <div className="text-xs font-semibold text-indigo-700 mb-2 flex items-center gap-1">
                <span className="text-indigo-400">📎</span> 实际案例
              </div>
              {example.before && (
                <div className="mb-2">
                  <div className="text-xs text-slate-500 mb-0.5">处理前：</div>
                  <div className="text-xs text-slate-600 bg-white/60 rounded p-2 font-mono">{example.before}</div>
                </div>
              )}
              {example.after && (
                <div className="mb-2">
                  <div className="text-xs text-slate-500 mb-0.5">处理后：</div>
                  <div className="text-xs text-slate-600 bg-white/60 rounded p-2 font-mono">{example.after}</div>
                </div>
              )}
              {example.note && (
                <div className="text-xs text-indigo-600 italic">{example.note}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FullPipelineDiagram() {
  const stages = [
    {
      num: 1,
      stage: "爬取策略",
      icon: "🎯",
      summary: "确定目标公司，用对应解析规则",
      purpose: "告诉系统去哪找信息、用什么规则解析",
      input: ["目标公司列表 (12家)"],
      output: ["匹配到的 Strategy"],
      tools: ["findStrategyForUrl()"],
      rules: ["URL 正则匹配 12 家公司"],
      details: [
        "Vector / Elektrobit / TTTech Auto / 经纬恒润 / 东软睿驰 / 中科创达 / 华为乾崑 / 芯驰科技 / 黑芝麻智能 / ETAS / AUTOSAR / 盖世汽车",
        "每家公司有独立的 URL pattern 和 CSS selector",
        "策略模式：改一家不影响其他",
      ],
      whitebox: "爬取策略是策略模式的实现，每家公司独立解析逻辑。页面改版只需改对应 strategy 文件。",
      example: {
        before: "系统收到URL: https://autosar.com/news.html",
        after: "匹配到 AUTOSAR Strategy，得知使用 #news-list > li > a 作为新闻列表选择器",
        note: "如果某公司改版，只要更新对应的 selector 即可，不影响其他公司",
      },
      color: "sky",
      bg: "bg-sky-50",
      border: "border-sky-200",
    },
    {
      num: 2,
      stage: "信息爬取",
      icon: "🌐",
      summary: "按规则抓取目标页面 HTML",
      purpose: "把网页内容下载到本地",
      input: ["URL", "pages (翻页配置)"],
      output: ["原始 HTML 字符串"],
      tools: ["fetch()"],
      rules: ["遵守 robots.txt", "超时 30s"],
      details: [
        "HTTP GET 请求下载页面",
        "支持多页翻页 (pages: [1,2,3])",
        "网络错误不影响其他页面",
      ],
      whitebox: "遵守 robots.txt 是互联网爬取的基本伦理。错误隔离确保单站失败不影响整体。",
      example: {
        before: "URL: https://vector.com/technologies.html, pages: [1,2,3]",
        after: "下载得到 vector.com 第1-3页的完整 HTML 源码",
        note: "即使 vector.com 无法访问，autosar.com 仍然可以正常抓取",
      },
      color: "sky",
      bg: "bg-sky-50",
      border: "border-sky-200",
    },
    {
      num: 3,
      stage: "HTML解析",
      icon: "🔍",
      summary: "从 HTML 中提取新闻标题/摘要/日期",
      purpose: "把网页结构化，变成数据",
      input: ["原始 HTML"],
      output: ["items: { title, summary, date, url }"],
      tools: ["cheerio.load()"],
      rules: ["每家公司有独立 CSS selector"],
      details: [
        "cheerio = Node.js 端的 jQuery",
        "根据 selector 定位新闻列表",
        "提取: 标题 / 摘要 / 日期 / 链接",
      ],
      whitebox: "cheerio 让 HTML 解析像操作 DOM 一样简单。每个 selector 是根据目标页面结构手写的。",
      example: {
        before: '<li><a href="/news/123">华为发布乾崑ADS 3.0</a><span>2024-01-15</span></li>',
        after: '{ title: "华为发布乾崑ADS 3.0", date: "2024-01-15", url: "/news/123", summary: "..." }',
        note: "每个 selector 都是工程师根据目标页面亲手写的，确保精准提取",
      },
      color: "cyan",
      bg: "bg-cyan-50",
      border: "border-cyan-200",
    },
    {
      num: 4,
      stage: "信息标准化",
      icon: "🧹",
      summary: "清洗脏数据，统一格式",
      purpose: "去除杂质，保证数据质量",
      input: ["原始 items (含噪声)"],
      output: ["干净的 items"],
      tools: ["parseDate()", "trim()"],
      rules: ["日期 ISO 8601", "summary ≤ 200字"],
      details: [
        "日期统一 YYYY-MM-DD",
        "去除 HTML 标签/空白",
        "去除广告/导航占位符",
      ],
      whitebox: "ETL 的 Transform 环节。统一格式方便后续处理，长度限制防存储溢出。",
      example: {
        before: '{ title: "  华为发布乾崑ADS 3.0  \n\n", date: "January 15, 2024", summary: "华为在昨日的发布会上..." }',
        after: '{ title: "华为发布乾崑ADS 3.0", date: "2024-01-15", summary: "华为在昨日的发布会上..." }',
        note: '" 华为 " → "华为"，"January 15, 2024" → "2024-01-15"，统一格式便于后续处理',
      },
      color: "teal",
      bg: "bg-teal-50",
      border: "border-teal-200",
    },
    {
      num: 5,
      stage: "LLM分类",
      icon: "🏷️",
      summary: "AI 识别新闻属于哪一类",
      purpose: "打标签，便于后续按类别筛选分析",
      input: ["items[] (≤ 50条)"],
      output: ["每条带 category + reason + confidence"],
      tools: ["DeepSeek API (temp=0.3)"],
      rules: ["5类: 产品技术/生态合作/战略动向/政策法规/人才动态"],
      details: [
        "调用 DeepSeek 分类",
        "返回: 分类 + 理由 + 置信度",
        "失败则 fallback 关键词匹配",
        "所有调用记录到 llm_runs 表",
      ],
      whitebox: "黑盒 AI 第一次介入。temperature=0.3 减少随机性。记录完整输入输出供审计追溯。",
      example: {
        before: '[{ "title": "华为发布乾崑ADS 3.0", "summary": "华为发布新一代自动驾驶..." }]',
        after: '[{ "title": "华为发布乾崑ADS 3.0", "category": "产品技术", "reason": "新品发布/技术突破", "confidence": 0.92 }]',
        note: "AI 判断这是'产品技术'类，理由是'新品发布/技术突破'，置信度 0.92",
      },
      color: "violet",
      bg: "bg-violet-50",
      border: "border-violet-200",
    },
    {
      num: 6,
      stage: "命中判断",
      icon: "✅",
      summary: "关键词匹配，过滤相关内容",
      purpose: "只保留与目标相关的信息",
      input: ["带分类的 items"],
      output: ["命中的 items + matched_keywords"],
      tools: ["keyword matching"],
      rules: ["命中则标记关键词"],
      details: [
        "遍历关键词列表",
        "标题/summary 包含则命中",
        "记录命中的关键词",
      ],
      whitebox: "第一层过滤。只有真正与目标相关的条目才进入后续分析。",
      example: {
        before: '[{ "title": "某手机厂商发布新款手机", "category": "产品技术" }]',
        after: "未命中（无目标关键词），跳过",
        note: "虽然这条是'产品技术'类，但跟我们的目标公司/技术方向无关，所以不进入后续分析",
      },
      color: "purple",
      bg: "bg-purple-50",
      border: "border-purple-200",
    },
    {
      num: 7,
      stage: "降噪过滤",
      icon: "🗑️",
      summary: "去掉导航/广告/低质量条目",
      purpose: "确保数据库存的都是真新闻",
      input: ["可能含噪声的 items"],
      output: ["高质量 items"],
      tools: ["isLowQualityTitle()"],
      rules: ["标题 ≥ 5字符", "去除 policy/menu/导航等"],
      details: [
        "过滤短标题 (< 5字)",
        "过滤 'read more' 等占位符",
        "去重标题",
      ],
      whitebox: "网页充满干扰内容，降噪确保数据纯净。",
      example: {
        before: "['Read more', '产品技术', '联系我们', '华为发布乾崑ADS 3.0', '华为发布乾崑ADS 3.0']",
        after: "['华为发布乾崑ADS 3.0']",
        note: "Read more 太短被过滤，产品技术是导航被过滤，重复的标题被去重",
      },
      color: "fuchsia",
      bg: "bg-fuchsia-50",
      border: "border-fuchsia-200",
    },
    {
      num: 8,
      stage: "数据存储",
      icon: "💾",
      summary: "持久化到 SQLite，支持追溯",
      purpose: "记录每一步操作，随时可查",
      input: ["processed items", "LLM 元数据"],
      output: ["sources / documents / llm_runs 三表"],
      tools: ["SQLite INSERT/UPDATE"],
      rules: ["sources: url 唯一", "llm_runs: 记录完整 prompt/response"],
      details: [
        "sources: URL → 公司映射",
        "documents: 解析后的内容",
        "llm_runs: AI 调用的完整记录",
      ],
      whitebox: "三表设计实现完整审计链: URL可查原文、AI输入输出可查、结论可溯源。",
      example: {
        before: "一条干净的新闻: { title: '华为发布乾崑ADS 3.0', url: 'https://...', company: '华为乾崑' }",
        after: "sources表: url→华为乾崑 | documents表: 标题/摘要/日期 | llm_runs表: AI调用记录",
        note: "未来可以追溯：这条新闻从哪个URL来的？是哪个AI调用处理的？用了什么prompt？",
      },
      color: "indigo",
      bg: "bg-indigo-50",
      border: "border-indigo-200",
    },
    {
      num: 9,
      stage: "洞察聚合",
      icon: "🔗",
      summary: "AI 关联多文档，生成结构化结论",
      purpose: "把散乱新闻变成可行动的洞察",
      input: ["时间窗口内所有 items"],
      output: ["{ top_changes, company_insights, management_actions }"],
      tools: ["DeepSeek API", "generateBrief()"],
      rules: ["≤ 5条结论", "不编造", "边界说明"],
      details: [
        "时间窗口: 7/30/90天",
        "可按公司筛选或全公司",
        "AI 聚合生成结构化 JSON",
        "四大约束防过度推断",
      ],
      whitebox: "黑盒 AI 第二次介入。核心约束: 不编造 + 说边界 + 落到部门 + 不套话。",
      example: {
        before: "[17条新闻: 华为发布ADS3.0 | 黑芝麻发布芯片... | 经纬恒润合作... ]",
        after: '{ "top_changes": ["自动驾驶进入量产阶段", "芯片国产化加速"], "company_insights": [{ "company": "华为", "insight": "乾崑品牌独立运营" }], "management_actions": [{ "dept": "产品部", "action": "评估华为乾崑合作可能" }] }',
        note: "AI 把17条散乱的新闻聚合成3条有价值的洞察，每条都可回溯到原始新闻",
      },
      color: "blue",
      bg: "bg-blue-50",
      border: "border-blue-200",
    },
    {
      num: 10,
      stage: "报告生成",
      icon: "📝",
      summary: "JSON 转 Markdown，可读可分享",
      purpose: "让管理层快速抓住重点",
      input: ["brief JSON"],
      output: ["Markdown 报告"],
      tools: ["buildMarkdown()"],
      rules: ["brief: 3条 / exec: 5条"],
      details: [
        "brief: 高管版 (简洁抓重点)",
        "exec: 业务版 (详细可执行)",
        "包含: 执行摘要/重点变化/对普华影响/管理动作",
      ],
      whitebox: "两种版本满足不同受众。Markdown 便于传播和存档。",
      example: {
        before: '{ "top_changes": ["自动驾驶量产"], "management_actions": [{ "dept": "产品部", "action": "评估" }] }',
        after: "## 执行摘要\n自动驾驶进入量产阶段，建议优先评估...\n\n## 重点变化\n1. 多家公司发布量产方案\n\n## 对普华影响\n...\n\n## 管理动作\n产品部：评估华为乾崑合作可能性",
        note: "同一个JSON，brief版只显示3条最关键的，exec版显示5条带详细分析",
      },
      color: "amber",
      bg: "bg-amber-50",
      border: "border-amber-200",
    },
    {
      num: 11,
      stage: "置信率计算",
      icon: "📊",
      summary: "基于Embedding语义匹配计算置信度",
      purpose: "告诉用户这条结论有多可靠，可验证",
      input: ["top_change 文本", "所有新闻条目"],
      output: ["final_confidence (30-95%)"],
      tools: ["SiliconFlow Embedding (BAAI/bge-large-zh-v1.5)", "余弦相似度", "URL去重", "日期计算"],
      rules: ["Base 0.30 + 证据0.10/条 + 跨公司+0.15 + 跨媒体+0.15 + 时效(7天+0.10, 30天+0.05)", "相似度阈值 0.55"],
      details: [
        "Base: 0.30 (最低起点)",
        "Embedding相似度阈值: 0.55 (只有 ≥0.55 才算相关)",
        "证据得分: 每条相似URL +0.10，上限 0.40",
        "多样性-公司: 跨2+目标公司 +0.15",
        "多样性-媒体: 跨2+媒体域名 +0.15",
        "时效: 7天内 +0.10，30天内 +0.05",
        "上限: 0.95 (永远留5%不确定性)",
      ],
      whitebox: "置信率使用向量模型做语义匹配，而非简单的关键词匹配。只有当新闻内容与洞察结论的语义相似度 ≥0.55 时，才计入证据。API不可用时回退到关键词匹配。",
      example: {
        before: "洞察: '华为乾崑发布896线激光雷达'\n匹配: 华为官网1篇 + 盖世汽车2篇（共3条URL）\n来源: 华为、盖世汽车（2家公司，2个媒体）\n时效: 最新1天前",
        after: "置信率 = 0.30 + 0.30(证据3条) + 0.15(跨公司) + 0.15(跨媒体) + 0.10(7天内) = 1.00 → 上限0.95\n\n🟢 高置信率 (95%)",
        note: "3条独立来源新闻，语义相似度均≥0.55，跨2家公司和2个媒体，3天内发布，互相印证，置信度很高",
      },
      color: "orange",
      bg: "bg-orange-50",
      border: "border-orange-200",
    },
    {
      num: 12,
      stage: "内容输出",
      icon: "📤",
      summary: "渲染报告 + 附原文链接 + 置信率标注",
      purpose: "让用户看得信，看得懂，能核实",
      input: ["Markdown", "citations", "confidence"],
      output: ["可读的 HTML 页面"],
      tools: ["Markdown renderer"],
      rules: ["每条结论附原文链接", "置信率 badge"],
      details: [
        "Markdown 渲染",
        "点击查看原文核实",
        "置信率: 高(绿)/中(黄)/低(红)",
      ],
      whitebox: "从'信任 AI'到'验证 AI'。每条结论可回溯原始文档。",
      example: {
        before: "洞察: '华为乾崑与多家公司合作' 置信率: 0.98",
        after: "🟢 高 (0.98) 华为乾崑与多家公司建立战略合作  [查看原文1] [查看原文2] [查看原文3]",
        note: "用户点击可以直接跳转到原始新闻页面核实，不需要信任AI",
      },
      color: "emerald",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🎯</span>
          <h3 className="text-lg font-bold text-emerald-800">您将得到一份能改变业务策略的洞察报告</h3>
        </div>
        <div className="bg-white/60 rounded-xl p-4 space-y-3">
          <p className="text-sm text-slate-700">
            系统自动追踪 <span className="font-semibold text-emerald-700">12 家目标公司</span>的公开新闻，
            AI 聚合分析生成<span className="font-semibold text-emerald-700">结构化洞察结论</span>——
            每条结论附带置信率和原文链接，您可以验证后再做决策。
          </p>
          <div className="flex items-center gap-2 text-slate-400 justify-center">↓</div>
          <div className="bg-emerald-100 rounded-lg p-3 text-center">
            <p className="text-sm font-semibold text-emerald-800">最终您得到的是：</p>
            <p className="text-sm text-emerald-700 mt-1">
              一份知道什么该信、什么要核实的商业洞察报告，帮您做出更有依据的战略决策
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl border border-violet-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">📖</span>
          <h3 className="text-lg font-bold text-violet-800">一个具体的例子：新闻怎么变成洞察？</h3>
        </div>
        <div className="bg-white/60 rounded-xl p-4 space-y-4">
          <div className="border-l-4 border-sky-400 pl-4 py-2 bg-sky-50 rounded-r-lg">
            <div className="text-xs font-semibold text-sky-600 mb-1">Step 1-4 原始新闻（3月4日）</div>
            <p className="text-sm text-slate-700">华为乾崑官网出现一条新闻：<span className="font-semibold">"华为乾崑发布新一代双光路图像级激光雷达，896线全球量产最高规格"</span></p>
            <p className="text-xs text-slate-500 mt-1">发布时间：2026-03-04 | 来源：auto.huawei.com</p>
          </div>
          
          <div className="text-center text-slate-400">↓</div>
          
          <div className="border-l-4 border-violet-400 pl-4 py-2 bg-violet-50 rounded-r-lg">
            <div className="text-xs font-semibold text-violet-600 mb-1">Step 5 LLM分类</div>
            <p className="text-sm text-slate-700">AI 判断：这是一条 <span className="font-semibold text-violet-600">产品技术</span> 类新闻</p>
            <p className="text-xs text-slate-500 mt-1">理由：新品发布/技术突破 | 进入分析库待聚合</p>
          </div>
          
          <div className="text-center text-slate-400">↓</div>
          
          <div className="border-l-4 border-purple-400 pl-4 py-2 bg-purple-50 rounded-r-lg">
            <div className="text-xs font-semibold text-purple-600 mb-1">Step 6-8 命中判断 & 降噪 & 存储</div>
            <p className="text-sm text-slate-700">命中关键词"华为"、"激光雷达"、"自动驾驶" → 进入分析库</p>
            <p className="text-xs text-slate-500 mt-1">同时发现 RoboSense速腾聚创 也发布了新款激光雷达并实现盈利</p>
          </div>
          
          <div className="text-center text-slate-400">↓</div>
          
          <div className="border-l-4 border-blue-400 pl-4 py-2 bg-blue-50 rounded-r-lg">
            <div className="text-xs font-semibold text-blue-600 mb-1">Step 9 洞察聚合（AI分析）</div>
            <p className="text-sm text-slate-700">基于3家公司（华为、RoboSense速腾聚创、小马智行）的报道，AI 聚合成：</p>
            <p className="text-sm text-blue-700 font-medium mt-1">"激光雷达进入'图像级'感知时代，国产厂商技术迭代加速"</p>
          </div>
          
          <div className="text-center text-slate-400">↓</div>
          
          <div className="border-l-4 border-orange-400 pl-4 py-2 bg-orange-50 rounded-r-lg">
            <div className="text-xs font-semibold text-orange-600 mb-1">Step 11 置信率计算（Embedding语义匹配）</div>
            
            <div className="bg-slate-800 rounded-lg p-3 mt-2 font-mono text-xs text-slate-100">
              <div className="text-amber-400 mb-2">置信率 = 0.30 + 0.30 + 0.15 + 0.15 + 0.10 = 1.00 → 0.95</div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-200">
                <p className="text-xs font-semibold text-emerald-700 mb-1">① Base = 0.30（最低起点）</p>
                <p className="text-xs text-slate-600">即使没有任何证据匹配，也有30%的基本置信度</p>
              </div>

              <div className="bg-sky-50 rounded-lg p-2 border border-sky-200">
                <p className="text-xs font-semibold text-sky-700 mb-1">② 证据得分 = +0.30（3条独立URL，语义相似度≥0.55）</p>
                <p className="text-xs text-slate-600 mb-1">计算过程：Embedding向量化 → 计算余弦相似度 → 过滤阈值≥0.55 → URL去重</p>
                <div className="bg-white rounded p-1.5 mt-1 space-y-0.5">
                  <p className="text-xs text-slate-500">使用 SiliconFlow BAAI/bge-large-zh-v1.5 模型生成1024维向量</p>
                  <p className="text-xs text-slate-500">匹配到3条独立URL新闻（相似度均≥0.55）：</p>
                  <p className="text-xs text-slate-400 ml-2">1. auto.huawei.com/... 相似度0.72（华为官网）</p>
                  <p className="text-xs text-slate-400 ml-2">2. gasgoo.com/...203734... 相似度0.68（RoboSense速腾聚创Q4盈利）</p>
                  <p className="text-xs text-slate-400 ml-2">3. gasgoo.com/... 相似度0.61（小马智行Robotaxi）</p>
                  <p className="text-xs text-slate-500 mt-1">证据得分 = min(0.40, 3×0.10) = 0.30</p>
                </div>
              </div>

              <div className="bg-violet-50 rounded-lg p-2 border border-violet-200">
                <p className="text-xs font-semibold text-violet-700 mb-1">③ 多样性-公司 = +0.15（跨2+公司）</p>
                <div className="bg-white rounded p-1.5 mt-1">
                  <p className="text-xs text-slate-500">独立公司数：华为 + 速腾 + 小马智行 = 3家</p>
                  <p className="text-xs text-slate-500 mt-1">3家 ≥ 2家 → +0.15</p>
                </div>
              </div>

              <div className="bg-orange-50 rounded-lg p-2 border border-orange-200">
                <p className="text-xs font-semibold text-orange-700 mb-1">④ 多样性-媒体 = +0.15（跨2+媒体域名）</p>
                <div className="bg-white rounded p-1.5 mt-1">
                  <p className="text-xs text-slate-500">独立媒体域名：auto.huawei.com + gasgoo.com = 2个</p>
                  <p className="text-xs text-slate-500 mt-1">2个 ≥ 2个 → +0.15</p>
                </div>
              </div>

              <div className="bg-pink-50 rounded-lg p-2 border border-pink-200">
                <p className="text-xs font-semibold text-pink-700 mb-1">⑤ 时效得分 = +0.10（7天内）</p>
                <div className="bg-white rounded p-1.5 mt-1">
                  <p className="text-xs text-slate-500">最新新闻日期：2026-03-04（距今约3天）</p>
                  <p className="text-xs text-slate-500 mt-1">3天 ≤ 7天 → +0.10</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-100 rounded-lg p-2 mt-3">
              <p className="text-xs font-semibold text-slate-700">计算结果：</p>
              <p className="text-xs text-slate-600 mt-1">0.30(Base) + 0.30(证据3条) + 0.15(跨公司) + 0.15(跨媒体) + 0.10(时效) = <span className="font-bold text-emerald-600">1.00 → 0.95</span></p>
              <p className="text-xs text-slate-500 mt-1">置信等级：🟢 高 (95%) — 可直接用于决策参考</p>
            </div>

            <div className="bg-cyan-50 rounded-lg p-2 mt-3 border border-cyan-200">
              <p className="text-xs font-semibold text-cyan-700 mb-1">🔬 为什么用Embedding而不是关键词？</p>
              <p className="text-xs text-slate-600">关键词匹配会错误地把"华为发布手机"当成"华为汽车"的相关证据。Embedding通过语义向量判断内容是否真正讨论相同主题，只有相似度≥0.55的才计入证据。</p>
            </div>
          </div>
          
          <div className="text-center text-slate-400">↓</div>
          
          <div className="border-l-4 border-emerald-400 pl-4 py-2 bg-emerald-50 rounded-r-lg">
            <div className="text-xs font-semibold text-emerald-600 mb-1">Step 12 最终呈现</div>
            <div className="bg-white rounded-lg p-3 border border-emerald-200 mt-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">置信率: 95%</span>
                <span className="text-xs text-slate-500">🟢 高置信</span>
              </div>
              <p className="text-sm text-slate-800">激光雷达进入"图像级"感知时代，国产厂商技术迭代加速</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <a href="https://auto.huawei.com/cn/news/2026/2026-3-4-lidar" target="_blank" className="text-xs text-sky-600 hover:text-sky-800 bg-sky-50 px-2 py-1 rounded">华为乾崑激光雷达 2026-03-04 ↗</a>
                <a href="https://autodata.gasgoo.com/information/imView/articleDetails/2037340329185660928" target="_blank" className="text-xs text-sky-600 hover:text-sky-800 bg-sky-50 px-2 py-1 rounded">RoboSense速腾聚创Q4盈利 2026-03-26 ↗</a>
                <a href="https://autodata.gasgoo.com/information/imView/articleDetails/20" target="_blank" className="text-xs text-sky-600 hover:text-sky-800 bg-sky-50 px-2 py-1 rounded">小马智行Robotaxi 2026-03-27 ↗</a>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">点击任意链接可直接查看原始新闻，您可自行核实这条结论是否准确</p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border border-slate-300 p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🔬</span>
          <h3 className="text-lg font-bold text-slate-800">报告的科学性与客观性</h3>
        </div>
        <div className="bg-white/60 rounded-xl p-4 mb-4">
          <p className="text-sm text-slate-700 leading-relaxed mb-3">
            当别人问"凭什么这么说？"——系统用以下机制保证报告经得起质疑：
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📰</span>
                <span className="font-semibold text-blue-800 text-sm">数据来源客观</span>
              </div>
              <p className="text-xs text-blue-700">全部来自目标公司公开新闻，非主观臆测，无利益相关性</p>
            </div>
            <div className="bg-violet-50 rounded-lg p-3 border border-violet-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔗</span>
                <span className="font-semibold text-violet-800 text-sm">结论可回溯</span>
              </div>
              <p className="text-xs text-violet-700">每条洞察点击即可查看原始出处，您可独立核实，无需信任 AI</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">⚖️</span>
                <span className="font-semibold text-emerald-800 text-sm">置信率可审计</span>
              </div>
              <p className="text-xs text-emerald-700">置信率由Embedding语义匹配+公式计算：相似度阈值0.55，证据数量×多样性×时效性，公式公开透明，可人工验算</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🚫</span>
                <span className="font-semibold text-amber-800 text-sm">AI 有约束</span>
              </div>
              <p className="text-xs text-amber-700">AI 不能随意发挥：不许编造、不许说套话、证据不足必须说明边界</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-100 rounded-lg p-3 text-center">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">一句话说明：</span>
            您不是在信任 AI，您是在信任<span className="text-emerald-700 font-semibold">可验证的公开数据</span>、<span className="text-emerald-700 font-semibold">Embedding向量语义匹配</span>和<span className="text-emerald-700 font-semibold">透明的计算公式</span>
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">📊</span>
          <h3 className="text-lg font-bold text-amber-800">为什么置信率让报告值得信赖？</h3>
        </div>

        <div className="bg-white/70 rounded-xl p-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0 text-amber-600 font-bold text-sm">?</div>
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-1">为什么要看置信率？</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                AI 分析新闻后会说"X 公司正在大力推广 Y 技术"——但这到底是多条报道交叉验证的事实，还是单条消息的过度推断？
                置信率把"证据质量"量化出来，让结论不再是模糊的"我觉得靠谱"。
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-4 mb-5 font-mono">
          <div className="text-xs text-slate-400 mb-2">科学置信率公式（基于Embedding语义匹配）</div>
          <div className="text-sm text-slate-100">
            <span className="text-amber-400">置信率</span>
            <span className="text-slate-500 mx-2">=</span>
            <span className="text-emerald-400">0.30</span>
            <span className="text-slate-500"> + </span>
            <span className="text-sky-400">证据得分</span>
            <span className="text-slate-500"> + </span>
            <span className="text-violet-400">多样性得分</span>
            <span className="text-slate-500"> + </span>
            <span className="text-orange-400">时效得分</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700 grid md:grid-cols-4 gap-3 text-xs">
            <div><span className="text-emerald-400">Base</span><br/><span className="text-slate-400">0.30 最低起点</span></div>
            <div><span className="text-sky-400">证据得分</span><br/><span className="text-slate-400">+0.10/条（相似度≥0.55），上限0.40</span></div>
            <div><span className="text-violet-400">多样性得分</span><br/><span className="text-slate-400">跨2+公司+0.15 / 跨2+媒体+0.15</span></div>
            <div><span className="text-orange-400">时效得分</span><br/><span className="text-slate-400">7天内+0.10 / 30天内+0.05</span></div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700">
            <div className="text-xs text-cyan-400 mb-1">向量模型: SiliconFlow BAAI/bge-large-zh-v1.5 (1024维)</div>
            <div className="text-xs text-slate-400">API不可用时回退到关键词匹配</div>
          </div>
        </div>

        <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-cyan-100 border border-cyan-200 flex items-center justify-center flex-shrink-0 text-cyan-600 font-bold text-sm">💡</div>
            <div>
              <p className="text-sm font-semibold text-cyan-800 mb-1">为什么需要 0.55 相似度阈值？</p>
              <p className="text-xs text-cyan-700 leading-relaxed">
                置信率的核心逻辑是：只有当<span className="font-semibold">新闻内容与洞察结论讨论的是同一个话题</span>时，才算作有效证据。
                相似度 ≥0.55 意味着新闻和洞察在语义空间中是"相关的"，而不是简单地包含相同关键词。
                例如，"华为发布手机"和"华为汽车"都包含"华为"这个词，但向量模型能判断它们讨论的是完全不同的话题，不会错误地计为证据。
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-5">
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🟢</span>
              <span className="font-bold text-emerald-800">高 ≥ 60%</span>
            </div>
            <p className="text-sm text-emerald-700 mb-2">结论有较多证据支撑，值得关注</p>
            <div className="bg-white/60 rounded-lg p-2 space-y-1">
              <p className="text-xs text-slate-600">2+独立来源或跨公司/媒体佐证</p>
              <p className="text-xs text-slate-600 mt-1">可直接用于汇报、决策、重点工作推进</p>
            </div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🟡</span>
              <span className="font-bold text-amber-800">中 50-60%</span>
            </div>
            <p className="text-sm text-amber-700 mb-2">有初步依据，建议核实</p>
            <div className="bg-white/60 rounded-lg p-2 space-y-1">
              <p className="text-xs text-slate-600">单一来源或时间较旧</p>
              <p className="text-xs text-slate-600 mt-1">适合初步判断、列入关注清单、后续跟踪</p>
            </div>
          </div>
          <div className="bg-rose-50 rounded-xl p-4 border border-rose-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🔴</span>
              <span className="font-bold text-rose-800">低 &lt; 50%</span>
            </div>
            <p className="text-sm text-rose-700 mb-2">证据不足，需谨慎</p>
            <div className="bg-white/60 rounded-lg p-2 space-y-1">
              <p className="text-xs text-slate-600">仅单条弱证据，需补充更多来源</p>
              <p className="text-xs text-slate-600 mt-1">仅作线索参考，不可作为决策依据</p>
            </div>
          </div>
        </div>

        <div className="bg-white/60 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center flex-shrink-0 text-emerald-600">✓</div>
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-1">报告的核心价值</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                自动追踪 12 家目标公司的公开新闻，AI 聚合分析 → 生成结构化洞察 → 每条结论可回溯原始出处。
                置信率让"AI 说的"变成"有证据支撑的"，您不是在信任 AI，您是在信任证据。
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🔄</span>
          <h3 className="font-semibold text-slate-800">全流程详解</h3>
          <span className="text-xs text-slate-400">(点击展开查看每步详情)</span>
        </div>
        <div className="space-y-2">
          {stages.map((s) => (
            <PipelineStage key={s.num} {...s} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ReasoningTrace({ trace }: { trace: LLMTrace }) {
  let parsedOutput: any = { confidence: null, summary: "", category: "" };
  try {
    parsedOutput = JSON.parse(trace.raw_response || "{}");
  } catch {}

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-3 flex-wrap">
        <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-700 text-xs font-mono">
          {trace.prompt_version || "deepseek-v1"}
        </span>
        <span className="text-xs text-slate-500">{trace.item_count} 条输入证据</span>
        <span className="text-xs text-slate-400">{new Date(trace.created_at).toLocaleString("zh-CN")}</span>
        <span className={`px-2 py-0.5 rounded text-xs ${trace.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
          {trace.status === "success" ? "成功" : "失败"}
        </span>
        <ConfidenceBadge confidence={trace.llm_confidence} />
      </div>

      <div className="p-4 space-y-4">
        <div className="flex gap-4">
          <div className="w-12 text-center flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-sky-100 border-2 border-sky-300 flex items-center justify-center mx-auto">
              <span className="text-xs">📥</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-700">输入证据</span>
              <span className="text-xs text-slate-400">{trace.item_count} 条</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 max-h-32 overflow-y-auto">
              {trace.input_preview.length > 0 ? (
                <div className="space-y-2">
                  {trace.input_preview.map((item: any, idx: number) => (
                    <div key={idx} className="text-xs">
                      <span className="font-medium text-slate-700">[{item.category || '未分类'}]</span>
                      <span className="text-slate-600 ml-1">{item.summary || item.title || JSON.stringify(item).slice(0, 80)}</span>
                    </div>
                  ))}
                  {trace.item_count > 2 && (
                    <div className="text-xs text-slate-400">...还有 {trace.item_count - 2} 条</div>
                  )}
                </div>
              ) : (
                <span className="text-xs text-slate-400">无输入数据</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="w-12 text-center flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-violet-100 border-2 border-violet-300 flex items-center justify-center mx-auto">
              <span className="text-xs">🤖</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-700">LLM 推理输出</span>
              <span className="text-xs text-slate-400">JSON</span>
            </div>
            <div className="bg-slate-900 text-slate-100 rounded-lg p-2 max-h-40 overflow-y-auto font-mono text-xs">
              <div className="text-emerald-400">confidence: {trace.llm_confidence ?? parsedOutput.confidence ?? "null"}</div>
              <div className="text-blue-400">category: {trace.insight_category || parsedOutput.category || "null"}</div>
              <div className="text-slate-300 mt-1 text-xs">
                {JSON.stringify(parsedOutput).slice(0, 200)}...
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="w-12 text-center flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center mx-auto">
              <span className="text-xs">📄</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-700">源文档</span>
              <span className="text-xs text-slate-400">可点击验证</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate">{trace.doc_title || "无标题"}</p>
                  <p className="text-xs text-slate-400">{trace.company_id}</p>
                </div>
                {trace.doc_url && (
                  <a href={trace.doc_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-sky-600 hover:text-sky-800 flex-shrink-0 px-2 py-1 bg-sky-50 rounded">
                    查看原文 →
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="w-12 text-center flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center mx-auto">
              <span className="text-xs">💡</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-700">洞察结论</span>
              <ConfidenceBadge confidence={trace.insight_confidence} />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              {trace.insight_summary ? (
                <p className="text-sm text-slate-700">{trace.insight_summary}</p>
              ) : (
                <p className="text-xs text-slate-400">暂无洞察结论</p>
              )}
              <div className="mt-2 pt-2 border-t border-amber-200 flex items-center gap-2">
                <span className="text-xs text-amber-700">分类：{trace.insight_category || "未知"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PromptConstraints() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🏷️</span>
          <h3 className="font-semibold text-slate-800">Stage 1: 分类 Prompt</h3>
          <span className="text-xs bg-sky-100 text-sky-600 px-2 py-0.5 rounded">lib/crawl/llmClassifier.ts</span>
        </div>
        <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
          <pre className="whitespace-pre-wrap">{`你是一个专业的汽车行业商业新闻分类助手，分类要准确并给出简短理由。

分类标准（必须严格选择其一）：
- 产品技术：新品发布、技术突破、研发进展
- 生态合作：战略合作、标准推进、生态绑定
- 战略动向：融资、高管变动、上市
- 政策法规：政府政策、行业标准
- 人才动态：招聘需求

返回JSON格式：
{"items":[{"id":"1","category":"分类名称","reason":"理由"},{"id":"2",...}]}`}</pre>
        </div>
        <div className="mt-3 p-3 bg-slate-50 rounded-lg">
          <div className="text-xs text-slate-600">
            <span className="font-semibold">约束：</span>必须给出分类理由，避免模糊分类
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🤖</span>
          <h3 className="font-semibold text-slate-800">Stage 2: 聚合 Prompt</h3>
          <span className="text-xs bg-violet-100 text-violet-600 px-2 py-0.5 rounded">pages/api/insights/generate-brief.ts</span>
        </div>
        <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-48">
          <pre className="whitespace-pre-wrap">{`【核心原则】
1. 只基于输入证据，不编造
2. 不说空话套话，如"行业持续发展、竞争日趋激烈"
3. 如果证据不足或样本集中，要明确说明结论的边界

【结论边界要求】
- 单条证据要说"样本有限，单条证据仅供参考"
- 行业分布集中须说明"主要由某公司驱动"
- 结论措辞适度：多用"建议优先评估"，不用"必须/立即"

【输出JSON结构】
{ "top_changes": [...], "company_insights": [...], "management_actions": [...] }`}</pre>
        </div>
        <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <div className="text-xs text-amber-800">
            <span className="font-semibold">四大约束：</span>
            不逐条复述 | 不说空话套话 | 落到具体部门 | 说明结论边界
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [llmTraces, setLlmTraces] = useState<LLMTrace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLLMTraces();
  }, []);

  async function fetchLLMTraces() {
    setLoading(true);
    try {
      const res = await fetch("/api/db/llm-trace?limit=5");
      if (res.ok) {
        const data = await res.json();
        setLlmTraces(data.rows || []);
      }
    } catch (e) {
      console.error("Failed to fetch LLM traces", e);
    } finally {
      setLoading(false);
    }
  }

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
                <h1 className="text-2xl font-bold text-slate-800">商业洞察系统总览</h1>
                <p className="text-sm text-slate-500 mt-1">透明 · 可追溯 · 科学</p>
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

        <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">

          <FullPipelineDiagram />

          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔍</span>
                <h3 className="font-semibold text-slate-800">推理过程示例</h3>
              </div>
              <button onClick={fetchLLMTraces} disabled={loading}
                className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded disabled:opacity-50">
                {loading ? "加载中..." : "刷新"}
              </button>
            </div>

            {llmTraces.length === 0 ? (
              <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-slate-600 mb-1">暂无 LLM 调用记录</p>
                <p className="text-xs text-slate-400">请先执行一次抓取和洞察生成</p>
              </div>
            ) : (
              <div className="space-y-4">
                {llmTraces.map((trace) => (
                  <ReasoningTrace key={trace.id} trace={trace} />
                ))}
              </div>
            )}
          </section>

          <PromptConstraints />

          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">⚙️</span>
              <h3 className="font-semibold text-slate-800">快速导航</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <a href="/insights" className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 hover:bg-emerald-100 transition-colors">
                <div className="text-2xl mb-2">💡</div>
                <h3 className="font-semibold text-emerald-800">商业洞察</h3>
                <p className="text-sm text-emerald-600 mt-1">查看聚合洞察</p>
              </a>
              <a href="/workbench" className="rounded-2xl bg-sky-50 border border-sky-200 p-5 hover:bg-sky-100 transition-colors">
                <div className="text-2xl mb-2">🕷️</div>
                <h3 className="font-semibold text-sky-800">工作台</h3>
                <p className="text-sm text-sky-600 mt-1">执行爬取</p>
              </a>
              <a href="/list-all" className="rounded-2xl bg-violet-50 border border-violet-200 p-5 hover:bg-violet-100 transition-colors">
                <div className="text-2xl mb-2">📋</div>
                <h3 className="font-semibold text-violet-800">全部文档</h3>
                <p className="text-sm text-violet-600 mt-1">查看明细</p>
              </a>
            </div>
          </section>

        </div>
      </main>
    </>
  );
}