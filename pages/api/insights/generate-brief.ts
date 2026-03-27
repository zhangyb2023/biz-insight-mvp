import type { NextApiHandler } from "next";
import fs from "fs";
import { getAllInsightItems } from "@/lib/db/repository";

const API_KEY_REGEX = /DEEPSEEK_API_KEY="([^"]+)"/;

function getApiKey(): string | null {
  try {
    const envContent = fs.readFileSync(".env.local", "utf8");
    const match = envContent.match(API_KEY_REGEX);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

const COMPANY_DISPLAY_NAMES: Record<string, string> = {
  "vector": "Vector",
  "elektrobit": "Elektrobit",
  "tttech-auto": "TTTech Auto",
  "hirain": "经纬恒润",
  "reachauto": "东软睿驰",
  "thundersoft": "中科创达",
  "huawei-qiankun-auto": "华为乾崑",
  "semi-drive": "芯驰科技",
  "black-sesame": "黑芝麻智能",
  "etas": "ETAS",
  "autosar": "AUTOSAR",
  "盖世汽车": "盖世汽车",
  "neu-sar": "NeuSAR",
};

function getDisplayName(companyId: string): string {
  return COMPANY_DISPLAY_NAMES[companyId] || companyId;
}

type BriefInput = {
  window_days?: number;
  company_ids?: string[];
  limit?: number;
};

type CompactItem = {
  company: string;
  company_id?: string;
  title: string;
  summary: string;
  date: string;
  category: string;
};

const LOW_VALUE_TITLE_PATTERNS = [
  /^policy$/i,
  /^menu$/i,
  /^导航$/i,
  /^read more$/i,
  /^learn more$/i,
  /^click here$/i,
  /^more info$/i,
  /^\s*$/,
  /^[\d\-\/\.]+$/,
  /^copyright$/i,
  /^\s*read more\s*$/i,
];

function isLowQualityTitle(title: string): boolean {
  if (!title || title.trim().length < 5) return true;
  const trimmed = title.trim();
  for (const pattern of LOW_VALUE_TITLE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  if (/(sidebar|侧边栏|页脚|footer|header|^read more|^learn more|^click here)/i.test(trimmed)) return true;
  return false;
}

function filterHighQualityItems(items: CompactItem[]): CompactItem[] {
  return items.filter((item) => {
    if (isLowQualityTitle(item.title)) return false;
    return true;
  });
}

type TopChange = {
  title: string;
  judgement: string;
  why_important: string;
  affected_companies: string[];
  related_topics: string[];
  to_phua_impact: string;
  recommended_action: string;
  evidence_count: number;
};

type CompanyInsight = {
  company: string;
  signal_level: "" | "high" | "medium" | "low";
  main_move: string;
  business_meaning: string;
  to_phua_impact: string;
  watch_next: string;
};

type PhuaImpacts = {
  competition_pressure: string[];
  cooperation_opportunities: string[];
  product_market_reference: string[];
};

type ManagementAction = {
  department: string;
  action: string;
  priority: "" | "high" | "medium" | "low";
  reason: string;
};

type WindowSummary = {
  time_window: string;
  overall_judgement: string;
  signal_density: "" | "high" | "medium" | "low";
  manager_note: string;
};

type BriefResult = {
  window_summary: WindowSummary;
  top_changes: TopChange[];
  company_insights: CompanyInsight[];
  phua_impacts: PhuaImpacts;
  management_actions: ManagementAction[];
};

const SYSTEM_PROMPT = `你是汽车电子基础软件行业的高级商业洞察分析助手，服务对象是普华基础软件有限公司的管理层、业务部门、产品部门、生态合作部门和信息化部门。

你将收到一批时间窗内的动态信息条目。你的任务不是逐条复述，而是做聚合商业判断。

【输出格式强制要求】
1. 只输出合法JSON，不输出任何其他内容
2. 不输出 markdown 代码块（如 \`\`\`json）
3. 不输出任何解释性文字
4. 不输出引言、总结或前后文
5. 每个字符串字段不超过200字符
6. top_changes 不超过5条
7. company_insights 不超过5条
8. management_actions 不超过5条

【核心原则】
1. 只基于输入证据，不编造
2. 不说空话套话，如"行业持续发展、竞争日趋激烈"
3. 如果证据不足或样本集中，要明确说明结论的边界，不要使用"必须、立即、否则将被排除"等过强结论
4. 结论措辞要适度：多用"建议优先评估、建议重点验证、若趋势延续则可能..."这类写法

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
- 对普华影响要有具体指向，不要泛泛写"值得关注"而是写"建议XX部门关注XX"

【输出JSON结构】
{
  "window_summary": { "time_window": "", "overall_judgement": "", "signal_density": "", "manager_note": "" },
  "top_changes": [{ "title": "", "judgement": "", "why_important": "", "affected_companies": [], "to_phua_impact": "", "recommended_action": "" }],
  "company_insights": [{ "company": "", "signal_level": "", "main_move": "", "business_meaning": "", "to_phua_impact": "" }],
  "phua_impacts": { "competition_pressure": [], "cooperation_opportunities": [], "product_market_reference": [] },
  "management_actions": [{ "department": "", "action": "", "priority": "", "reason": "" }]
}`;


function buildUserPrompt(windowDays: number, items: CompactItem[], isSingleCompany: boolean = false, singleCompanyName: string | null = null): string {
  const singleCompanyContext = isSingleCompany && singleCompanyName
    ? `\n\n【重点关注公司】本期聚合洞察聚焦于 ${singleCompanyName}。你的分析应以该公司为核心，提及其他公司时只作为对标/合作/生态关联对象。如果提及其他公司，必须说明与 ${singleCompanyName} 的关系。`
    : "";

  return `请基于以下近${windowDays}天的动态信息数组，输出聚合商业洞察 JSON。${singleCompanyContext}

输入条目：
${JSON.stringify(items, null, 2)}

【特别要求】
- top_changes 只保留最重要的3-5项，每项要包含：对普华的具体影响和建议动作
- company_insights 只保留最值得关注的公司（不超过5家）
- 如果某方面证据不足，明确写"当前公开信息有限，建议继续跟踪"
- management_actions 要落到具体部门（产品/平台、市场/售前、生态/合作），每条格式："建议[部门]：[具体动作]，原因：[为什么]"
- 结论措辞要适度，不用"必须/立即/否则"，多用"建议优先/建议重点/若趋势延续则可能"
${isSingleCompany && singleCompanyName ? `- 单公司视角：先写该公司近30天最重要动作，再写对普华的具体影响` : ''}

【输出格式严格JSON】`;
}

function normalizeString(v: any): string {
  return typeof v === "string" ? v : "";
}

function normalizeStringArr(v: any): string[] {
  return Array.isArray(v) ? v.filter((i): i is string => typeof i === "string") : [];
}

function normalizeImportance(v: any): "" | "high" | "medium" | "low" {
  if (typeof v !== "string") return "";
  const lvl = v.toLowerCase();
  if (lvl === "high" || lvl === "medium" || lvl === "low") return lvl;
  return "";
}

function normalizeSignalDensity(v: any): "" | "high" | "medium" | "low" {
  return normalizeImportance(v);
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // ISO format: 2026-03-25T06:30:41.926Z
  if (dateStr.includes("T")) {
    return dateStr.split("T")[0];
  }
  
  // Slash format: 2026/03/24
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    }
  }
  
  // RFC format: Tue, 24 Mar 2026 09:58:33 GMT - already returned as-is
  // This won't match YYYY-MM-DD comparison, but fetch_date is ISO so it works
  
  return dateStr;
}

function normalizeResult(raw: any): BriefResult {
  const str = normalizeString;
  const strArr = normalizeStringArr;

  // Handle window_summary - can be string or object
  let windowSummary: WindowSummary;
  if (typeof raw.window_summary === "string") {
    windowSummary = {
      time_window: str(raw.time_window || ""),
      overall_judgement: raw.window_summary || "",
      signal_density: "",
      manager_note: str(raw.manager_note || ""),
    };
  } else {
    windowSummary = {
      time_window: str(raw.window_summary?.time_window),
      overall_judgement: str(raw.window_summary?.overall_judgement),
      signal_density: normalizeSignalDensity(raw.window_summary?.signal_density),
      manager_note: str(raw.window_summary?.manager_note),
    };
  }

  // Handle top_changes - can be array of strings or array of objects
  let topChanges: TopChange[];
  if (Array.isArray(raw.top_changes)) {
    topChanges = raw.top_changes.slice(0, 5).map((tc: any) => {
      if (typeof tc === "string") {
        return {
          title: tc.substring(0, 100),
          judgement: "",
          why_important: "",
          affected_companies: [],
          related_topics: [],
          to_phua_impact: "",
          recommended_action: "",
          evidence_count: 1,
        };
      }
      return {
        title: str(tc.title),
        judgement: str(tc.judgement),
        why_important: str(tc.why_important),
        affected_companies: strArr(tc.affected_companies),
        related_topics: strArr(tc.related_topics),
        to_phua_impact: str(tc.to_phua_impact),
        recommended_action: str(tc.recommended_action),
        evidence_count: typeof tc.evidence_count === "number" ? Math.round(tc.evidence_count) : 0,
      };
    });
  } else {
    topChanges = [];
  }

  // Handle company_insights - can be object with company keys or array
  let companyInsights: CompanyInsight[];
  if (Array.isArray(raw.company_insights)) {
    companyInsights = raw.company_insights.slice(0, 5).map((ci: any) => ({
      company: str(ci.company),
      signal_level: normalizeImportance(ci.signal_level),
      main_move: str(ci.main_move),
      business_meaning: str(ci.business_meaning),
      to_phua_impact: str(ci.to_phua_impact),
      watch_next: str(ci.watch_next),
    }));
  } else if (typeof raw.company_insights === "object" && raw.company_insights !== null) {
    // Object with company names as keys
    companyInsights = Object.entries(raw.company_insights).slice(0, 5).map(([company, value]: [string, any]) => ({
      company,
      signal_level: "",
      main_move: typeof value === "string" ? value : str(value.main_move || value.business_meaning || ""),
      business_meaning: typeof value === "string" ? "" : str(value.business_meaning),
      to_phua_impact: typeof value === "string" ? "" : str(value.to_phua_impact),
      watch_next: typeof value === "string" ? "" : str(value.watch_next),
    }));
  } else {
    companyInsights = [];
  }

  // Handle phua_impacts - normalize Chinese keys to English
  let phuaImpacts: PhuaImpacts;
  if (typeof raw.phua_impacts === "object" && raw.phua_impacts !== null) {
    const ci = raw.phua_impacts;
    phuaImpacts = {
      competition_pressure: strArr(ci.competition_pressure || ci.竞争压力 || ci.竞争压力 || []),
      cooperation_opportunities: strArr(ci.cooperation_opportunities || ci.合作机会 || ci.合作机会 || []),
      product_market_reference: strArr(ci.product_market_reference || ci.产品市场参考 || []),
    };
  } else {
    phuaImpacts = {
      competition_pressure: [],
      cooperation_opportunities: [],
      product_market_reference: [],
    };
  }

  // Handle management_actions
  let managementActions: ManagementAction[];
  if (Array.isArray(raw.management_actions)) {
    managementActions = raw.management_actions.slice(0, 5).map((ma: any) => ({
      department: str(ma.department),
      action: str(ma.action),
      priority: normalizeImportance(ma.priority),
      reason: str(ma.reason),
    }));
  } else {
    managementActions = [];
  }

  return {
    window_summary: windowSummary,
    top_changes: topChanges,
    company_insights: companyInsights,
    phua_impacts: phuaImpacts,
    management_actions: managementActions,
  };
}

function getFallbackResult(windowDays: number, itemCount: number): BriefResult {
  return {
    window_summary: {
      time_window: `${windowDays}天`,
      overall_judgement: "数据不足，无法生成有效洞察",
      signal_density: "",
      manager_note: `共${itemCount}条原始数据，但LLM处理失败，请稍后重试或检查数据质量`,
    },
    top_changes: [],
    company_insights: [],
    phua_impacts: {
      competition_pressure: [],
      cooperation_opportunities: [],
      product_market_reference: [],
    },
    management_actions: [],
  };
}

async function callDeepSeek(apiKey: string, windowDays: number, items: CompactItem[], isSingleCompany: boolean = false, singleCompanyName: string | null = null): Promise<{result: BriefResult, rawContent: string}> {
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(windowDays, items, isSingleCompany, singleCompanyName) },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content || "";

  let jsonStr = content.trim();

  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {result: normalizeResult(parsed), rawContent: content};
  } catch (e) {
    console.error("JSON parse failed. Content preview:", jsonStr.substring(0, 300));
    console.error("Parse error:", e);
  }

  throw new Error("LLM输出格式异常，无法解析为有效JSON");
}

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const input = req.body as BriefInput;
  const windowDays = input.window_days || 7;
  const companyIds = input.company_ids;
  const limit = input.limit || 200;

  if (![7, 30, 90].includes(windowDays)) {
    return res.status(400).json({ ok: false, error: "window_days must be 7, 30, or 90" });
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);
  const cutoffStr = cutoffDate.toISOString().split("T")[0];

  const allItems = getAllInsightItems();

  const filteredItems = allItems
    .filter((item) => {
      const rawDate = item.published_at || item.fetch_date;
      if (!rawDate) return false;
      const itemDate = parseDate(rawDate);
      if (!itemDate) return false;
      return itemDate >= cutoffStr;
    })
    .filter((item) => {
      if (!companyIds || companyIds.length === 0) return true;
      // Precise match on company_id (slug) only
      return companyIds.some((id) => item.company_id === id);
    })
    .slice(0, limit);

  const compactItems: CompactItem[] = filteredItems.map((item) => ({
    company_id: item.company_id,
    company: item.company_name || "未知",
    title: item.title || "",
    summary: (item.summary || "").substring(0, 200),
    date: parseDate(item.published_at || item.fetch_date || "") || "",
    category: item.category || item.insight_type || "战略动向",
  }));

  const highQualityCompactItems = filterHighQualityItems(compactItems);

  const isSingleCompany = companyIds && companyIds.length === 1;
  const displayCompanyName = isSingleCompany && companyIds ? getDisplayName(companyIds[0]) : null;

  const meta = {
    window_days: windowDays,
    total_items_in_window: filteredItems.length,
    high_quality_items: highQualityCompactItems.length,
    companies_count: new Set(compactItems.map((i) => i.company_id)).size,
    matched_company_ids: companyIds || [],
    cutoff_date: cutoffStr,
  };

  const apiKey = getApiKey();

  if (!apiKey) {
    return res.status(200).json({
      ok: false,
      meta,
      error: "DEEPSEEK_API_KEY not configured",
      reason: "api_key_missing",
      result: getFallbackResult(windowDays, compactItems.length),
    });
  }

  if (highQualityCompactItems.length === 0) {
    return res.status(200).json({
      ok: true,
      meta,
      empty: true,
      reason: "no_high_quality_items",
      result: {
        window_summary: {
          time_window: `${windowDays}天`,
          overall_judgement: "暂无足够高质量样本",
          signal_density: "low" as const,
          manager_note: `共${compactItems.length}条原始数据，但经质量过滤后无可用样本，请检查数据源或扩大时间窗`,
        },
        top_changes: [],
        company_insights: [],
        phua_impacts: {
          competition_pressure: [],
          cooperation_opportunities: [],
          product_market_reference: [],
        },
        management_actions: [],
      },
    });
  }

  try {
    const {result} = await callDeepSeek(apiKey, windowDays, highQualityCompactItems, isSingleCompany, displayCompanyName);
    return res.status(200).json({
      ok: true,
      meta,
      empty: false,
      result,
    });
  } catch (error) {
    console.error("Brief generation failed:", error);
    return res.status(200).json({
      ok: false,
      meta,
      error: "LLM响应格式异常，请稍后重试",
      reason: "llm_call_failed",
      result: getFallbackResult(windowDays, highQualityCompactItems.length),
    });
  }
};

export default handler;