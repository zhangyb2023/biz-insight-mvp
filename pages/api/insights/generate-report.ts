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

function filterHighQualityItems(items: any[]): any[] {
  return items.filter((item) => {
    const title = item.title || "";
    if (isLowQualityTitle(title)) return false;
    const url = item.url || "";
    const summary = (item.summary || "").toLowerCase();
    const combined = (title + " " + url + " " + summary).toLowerCase();
    if (/\/index\.html?$/i.test(url)) return false;
    if (/^https?:\/\/[^/]+\/$/i.test(url)) return false;
    if (/\/(news|products|solutions|about|contact)\/$/i.test(url)) return false;
    return true;
  });
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  if (dateStr.includes("T")) return dateStr.split("T")[0];
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    }
  }
  return dateStr;
}

type BriefResult = {
  window_summary: {
    time_window: string;
    overall_judgement: string;
    signal_density: string;
    manager_note: string;
  };
  top_changes: Array<{
    title: string;
    judgement: string;
    why_important: string;
    affected_companies: string[];
    related_topics: string[];
    to_phua_impact: string;
    recommended_action: string;
    evidence_count: number;
  }>;
  company_insights: Array<{
    company: string;
    signal_level: string;
    main_move: string;
    business_meaning: string;
    to_phua_impact: string;
    watch_next: string;
  }>;
  phua_impacts: {
    competition_pressure: string[];
    cooperation_opportunities: string[];
    product_market_reference: string[];
  };
  management_actions: Array<{
    department: string;
    action: string;
    priority: string;
    reason: string;
  }>;
};

const IMPROVED_SYSTEM_PROMPT = `你是汽车电子基础软件行业的商业洞察分析专家，服务对象是普华基础软件有限公司的管理层。

你的任务是将动态信息转化为有价值的商业判断，不是复述新闻。

【核心原则】
1. 不说空话套话，如"行业持续发展、竞争日趋激烈"
2. 每条结论都要有具体依据
3. 对普华影响要具体到：竞争威胁、合作机会、产品启发、市场参考
4. 证据不足时，明确写"证据有限，建议继续跟踪"
5. 结论措辞要适度：不用"必须/立即/否则"，多用"建议优先评估/建议重点验证/若趋势延续则可能"

【证据边界要求】
- 如果样本集中于某公司，明确说明"本期洞察主要由[公司]驱动，结论不代表行业整体"
- 如果只有单条证据，明确说明"样本有限，单条证据仅供参考"
- 如果行业分布不均，在结论中注明主要信号来源

【管理动作格式】
- 每条管理动作格式："建议[部门]：[具体动作]，原因：[为什么这样做]"
- 部门分类：产品/平台、市场/售前、生态/合作

输出要求：
- 只输出合法JSON
- 不要markdown格式
- 尽量具体，避免泛泛而谈`;

function buildUserPrompt(windowDays: number, items: any[], isSingleCompany: boolean, singleCompanyName?: string | null): string {
  const singleCompanyContext = isSingleCompany && singleCompanyName
    ? `\n\n【重点关注公司】本期报告聚焦于 ${singleCompanyName}。你的分析应以此公司为核心，提及其他公司时只作为对标对象、合作上下文或生态关联对象，不能喧宾夺主。如果提及其他公司的动作，必须说明与 ${singleCompanyName} 的关系（合作、竞争、对标）。`
    : "";

  return `请分析以下近${windowDays}天的汽车电子行业动态，生成结构化商业洞察。${singleCompanyContext}

输入数据：
${JSON.stringify(items, null, 2)}

【特别要求】
1. 执行摘要要明确写出"本期最值得管理层关注的3件事是什么"
2. 重点变化每条都要包含：具体变化内容、对普华的具体影响、建议动作
3. 对普华影响不要写"值得关注"，要写具体：影响哪个方面、可能带来什么机会或威胁
4. 管理动作建议要具体到部门和具体事项，如"建议产品/平台团队：跟进XXX技术进展，评估对基础软件的影响"
5. 如果某方面证据不足，明确写"当前公开信息有限，建议继续跟踪"
6. 结论措辞要适度：不用"必须/立即/否则"，多用"建议优先评估/建议重点验证/若趋势延续则可能"
7. 如果样本集中，明确说明结论边界
${isSingleCompany && singleCompanyName ? `\n8. 单公司报告：先写该公司近30天最重要动作，再写对普华的具体影响` : ''}

输出格式（必须严格JSON）：
{
  "window_summary": {
    "overall_judgement": "本期最值得关注的3件事",
    "signal_density": "high/medium/low",
    "manager_note": "管理层特别说明"
  },
  "top_changes": [...],
  "phua_impacts": {...},
  "management_actions": [...]
}`;
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

function normalizeResult(raw: any): BriefResult {
  let windowSummary: BriefResult["window_summary"];
  if (typeof raw.window_summary === "string") {
    windowSummary = {
      time_window: "",
      overall_judgement: raw.window_summary || "",
      signal_density: "",
      manager_note: raw.manager_note || "",
    };
  } else {
    windowSummary = {
      time_window: normalizeString(raw.window_summary?.time_window),
      overall_judgement: normalizeString(raw.window_summary?.overall_judgement),
      signal_density: normalizeImportance(raw.window_summary?.signal_density),
      manager_note: normalizeString(raw.window_summary?.manager_note),
    };
  }

  let topChanges: BriefResult["top_changes"] = [];
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
        title: normalizeString(tc.title),
        judgement: normalizeString(tc.judgement),
        why_important: normalizeString(tc.why_important),
        affected_companies: normalizeStringArr(tc.affected_companies),
        related_topics: normalizeStringArr(tc.related_topics),
        to_phua_impact: normalizeString(tc.to_phua_impact),
        recommended_action: normalizeString(tc.recommended_action),
        evidence_count: typeof tc.evidence_count === "number" ? Math.round(tc.evidence_count) : 0,
      };
    });
  }

  let companyInsights: BriefResult["company_insights"] = [];
  if (Array.isArray(raw.company_insights)) {
    companyInsights = raw.company_insights.slice(0, 5).map((ci: any) => ({
      company: normalizeString(ci.company),
      signal_level: normalizeImportance(ci.signal_level),
      main_move: normalizeString(ci.main_move),
      business_meaning: normalizeString(ci.business_meaning),
      to_phua_impact: normalizeString(ci.to_phua_impact),
      watch_next: normalizeString(ci.watch_next),
    }));
  } else if (typeof raw.company_insights === "object" && raw.company_insights !== null) {
    companyInsights = Object.entries(raw.company_insights).slice(0, 5).map(([company, value]: [string, any]) => ({
      company,
      signal_level: "",
      main_move: typeof value === "string" ? value : normalizeString(value?.main_move || value?.business_meaning || ""),
      business_meaning: typeof value === "string" ? "" : normalizeString(value?.business_meaning),
      to_phua_impact: typeof value === "string" ? "" : normalizeString(value?.to_phua_impact),
      watch_next: typeof value === "string" ? "" : normalizeString(value?.watch_next),
    }));
  }

  let phuaImpacts: BriefResult["phua_impacts"];
  if (typeof raw.phua_impacts === "object" && raw.phua_impacts !== null) {
    const pi = raw.phua_impacts;
    phuaImpacts = {
      competition_pressure: normalizeStringArr(pi.competition_pressure || pi.竞争压力 || []),
      cooperation_opportunities: normalizeStringArr(pi.cooperation_opportunities || pi.合作机会 || []),
      product_market_reference: normalizeStringArr(pi.product_market_reference || pi.产品市场参考 || []),
    };
  } else {
    phuaImpacts = { competition_pressure: [], cooperation_opportunities: [], product_market_reference: [] };
  }

  let managementActions: BriefResult["management_actions"] = [];
  if (Array.isArray(raw.management_actions)) {
    managementActions = raw.management_actions.slice(0, 5).map((ma: any) => ({
      department: normalizeString(ma.department),
      action: normalizeString(ma.action),
      priority: normalizeImportance(ma.priority),
      reason: normalizeString(ma.reason),
    }));
  }

  return {
    window_summary: windowSummary,
    top_changes: topChanges,
    company_insights: companyInsights,
    phua_impacts: phuaImpacts,
    management_actions: managementActions,
  };
}

async function callDeepSeekBrief(apiKey: string, windowDays: number, items: any[], isSingleCompany: boolean = false, singleCompanyName: string | null = null): Promise<BriefResult> {
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: IMPROVED_SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(windowDays, items, isSingleCompany, singleCompanyName) },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content || "";

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return normalizeResult(JSON.parse(jsonMatch[0]));
    } catch {
      console.error("JSON parse failed");
    }
  }
  throw new Error("No valid JSON found");
}

function getFallbackBrief(): BriefResult {
  return {
    window_summary: {
      time_window: "",
      overall_judgement: "",
      signal_density: "",
      manager_note: "",
    },
    top_changes: [],
    company_insights: [],
    phua_impacts: { competition_pressure: [], cooperation_opportunities: [], product_market_reference: [] },
    management_actions: [],
  };
}

function buildMarkdown(title: string, meta: any, brief: BriefResult, evidenceItems: any[], reportDescription: string): string {
  const lines: string[] = [];
  const displayCompany = meta.matched_company_ids?.length === 1
    ? getDisplayName(meta.matched_company_ids[0])
    : "全部公司";

  lines.push(`# ${title}`);
  lines.push("");
  lines.push("**【报告说明】**");
  lines.push(reportDescription);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("**【筛选条件】**");
  lines.push(`- 时间窗：近${meta.window_days}天`);
  lines.push(`- 公司范围：${displayCompany}`);
  lines.push(`- 数据生成时间：${new Date().toLocaleString("zh-CN")}`);
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push("## 一、执行摘要");
  lines.push("");
  if (brief.window_summary.overall_judgement) {
    lines.push(brief.window_summary.overall_judgement);
    lines.push("");
  }
  if (brief.window_summary.manager_note) {
    lines.push(`**管理层提示**：${brief.window_summary.manager_note}`);
    lines.push("");
  }
  const densityMap: Record<string, string> = { high: "高", medium: "中", low: "低", "": "未知" };
  if (brief.window_summary.signal_density) {
    lines.push(`**信号强度**：${densityMap[brief.window_summary.signal_density] || "未知"}`);
    lines.push("");
  }
  lines.push(`*本期共${meta.total_items_in_window}条动态，涉及${meta.companies_count}家公司*`);
  lines.push("");

  if (brief.top_changes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## 二、本期重点变化");
    lines.push("");
    brief.top_changes.forEach((change, idx) => {
      lines.push(`### ${idx + 1}. ${change.title}`);
      lines.push("");
      if (change.judgement) {
        lines.push(`**判断**：${change.judgement}`);
        lines.push("");
      }
      if (change.why_important) {
        lines.push(`**为什么重要**：${change.why_important}`);
        lines.push("");
      }
      if (change.to_phua_impact) {
        lines.push(`**对普华影响**：${change.to_phua_impact}`);
        lines.push("");
      }
      if (change.recommended_action) {
        lines.push(`**建议动作**：${change.recommended_action}`);
        lines.push("");
      }
      if (change.affected_companies.length > 0) {
        const companies = change.affected_companies.map(c => getDisplayName(c) || c).join("、");
        lines.push(`**涉及公司**：${companies}`);
        lines.push("");
      }
      lines.push(`*支撑证据数：${change.evidence_count}*`);
      lines.push("");
    });
  }

  if (brief.company_insights.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## 三、重点公司观察");
    lines.push("");
    brief.company_insights.forEach((ci) => {
      const displayC = getDisplayName(ci.company) || ci.company;
      lines.push(`### ${displayC}`);
      lines.push("");
      if (ci.signal_level) {
        const levelMap: Record<string, string> = { high: "高信号", medium: "中信号", low: "低信号", "": "未知" };
        lines.push(`**信号级别**：${levelMap[ci.signal_level] || ci.signal_level}`);
      }
      if (ci.main_move) {
        lines.push(`**主要动作**：${ci.main_move}`);
      }
      if (ci.business_meaning) {
        lines.push(`**商业含义**：${ci.business_meaning}`);
      }
      if (ci.to_phua_impact) {
        lines.push(`**对普华影响**：${ci.to_phua_impact}`);
      }
      if (ci.watch_next) {
        lines.push(`**下一步关注**：${ci.watch_next}`);
      }
      lines.push("");
    });
  }

  if (brief.phua_impacts.competition_pressure.length > 0 ||
      brief.phua_impacts.cooperation_opportunities.length > 0 ||
      brief.phua_impacts.product_market_reference.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## 四、对普华影响");
    lines.push("");

    if (brief.phua_impacts.competition_pressure.length > 0) {
      lines.push("### 竞争压力");
      brief.phua_impacts.competition_pressure.forEach(item => lines.push(`- ${item}`));
      lines.push("");
    }

    if (brief.phua_impacts.cooperation_opportunities.length > 0) {
      lines.push("### 合作机会");
      brief.phua_impacts.cooperation_opportunities.forEach(item => lines.push(`- ${item}`));
      lines.push("");
    }

    if (brief.phua_impacts.product_market_reference.length > 0) {
      lines.push("### 产品/市场参考");
      brief.phua_impacts.product_market_reference.forEach(item => lines.push(`- ${item}`));
      lines.push("");
    }
  }

  if (brief.management_actions.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## 五、管理动作建议");
    lines.push("");
    const priorityLabels: Record<string, string> = { high: "高", medium: "中", low: "低", "": "未知" };
    brief.management_actions.forEach((ma) => {
      lines.push(`### ${ma.department} 【${priorityLabels[ma.priority] || "未知"}优先级】`);
      lines.push("");
      lines.push(`**建议动作**：${ma.action}`);
      if (ma.reason) {
        lines.push(`**原因**：${ma.reason}`);
      }
      lines.push("");
    });
  }

  if (evidenceItems.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## 六、支撑证据附录");
    lines.push("");
    lines.push(`| 公司 | 标题 | 时间 |`);
    lines.push("|------|------|------|");
    evidenceItems.slice(0, 30).forEach((item: any) => {
      const company = getDisplayName(item.company_id) || item.company || item.company_name || "未知";
      const title = (item.title || "").substring(0, 50);
      const date = item.date || "未知";
      lines.push(`| ${company} | ${title} | ${date} |`);
    });
    lines.push("");
    lines.push(`*以上共${evidenceItems.length}条原始动态，仅展示前30条*`);
  }

  lines.push("");
  lines.push("---");
  lines.push("*本报告由普华汽车电子商业洞察系统自动生成*");

  return lines.join("\n");
}

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const input = req.body as {
    window_days?: number;
    company_ids?: string[];
    format?: string;
    brief_data?: BriefResult;
  };

  const windowDays = input.window_days || 30;
  const companyIds = input.company_ids || [];
  const format = input.format || "markdown";
  const providedBriefData = input.brief_data;

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
      if (companyIds.length === 0) return true;
      return companyIds.some((id) => (item as any).company_id === id);
    });

  const rawEvidenceItems = filteredItems.map((item) => ({
    company: item.company_name,
    company_id: (item as any).company_id,
    title: item.title,
    url: item.url,
    date: parseDate(item.published_at || item.fetch_date) || "",
    category: item.category || item.insight_type || "战略动向",
    summary: item.summary,
  }));

  const evidenceItems = filterHighQualityItems(rawEvidenceItems);

  const meta = {
    window_days: windowDays,
    total_items_in_window: filteredItems.length,
    companies_count: new Set(evidenceItems.map((i: any) => i.company_id)).size,
    matched_company_ids: companyIds,
    cutoff_date: cutoffStr,
  };

  const isSingleCompany = companyIds.length === 1;
  const displayCompanyName = isSingleCompany ? getDisplayName(companyIds[0]) : null;
  let title = `普华汽车电子商业洞察总览简报（近${windowDays}天）`;
  if (displayCompanyName) {
    title = `普华汽车电子商业洞察观察简报：${displayCompanyName}（近${windowDays}天）`;
  }

  const reportDescription = isSingleCompany
    ? `本报告基于近${windowDays}天 ${displayCompanyName} 相关公开动态信息生成，用于从普华视角观察该公司的重点动作、潜在影响及建议跟踪方向。`
    : `本报告基于近${windowDays}天全部目标公司的公开动态信息生成，用于辅助管理层快速识别行业重点变化、竞争信号与合作机会。`;

  if (format === "markdown") {
    if (filteredItems.length === 0) {
      const emptyBrief = getFallbackBrief();
      const emptyMarkdown = buildMarkdown(title, meta, emptyBrief, [], reportDescription);
      return res.status(200).json({
        ok: true,
        meta,
        title,
        markdown: emptyMarkdown,
      });
    }

    let brief: BriefResult;

    if (providedBriefData && companyIds.length === 0) {
      brief = normalizeResult(providedBriefData);
    } else {
      const apiKey = getApiKey();
      if (!apiKey) {
        const fallbackBrief = getFallbackBrief();
        const fallbackMarkdown = buildMarkdown(title, meta, fallbackBrief, evidenceItems, reportDescription);
        return res.status(200).json({
          ok: true,
          meta,
          title,
          markdown: fallbackMarkdown,
          warning: "DEEPSEEK_API_KEY not configured and no brief_data provided",
        });
      }

      try {
        const compactItems = evidenceItems.map((item: any) => ({
          company: getDisplayName(item.company_id) || item.company,
          title: item.title,
          summary: (item.summary || "").substring(0, 200),
          date: item.date,
          category: item.category,
        }));

        brief = await callDeepSeekBrief(apiKey, windowDays, compactItems, isSingleCompany, displayCompanyName);
      } catch (error) {
        console.error("Report generation failed:", error);
        const fallbackBrief = getFallbackBrief();
        const fallbackMarkdown = buildMarkdown(title, meta, fallbackBrief, evidenceItems, reportDescription);
        return res.status(200).json({
          ok: true,
          meta,
          title,
          markdown: fallbackMarkdown,
          error: String(error),
        });
      }
    }

    const markdown = buildMarkdown(title, meta, brief, evidenceItems, reportDescription);

    return res.status(200).json({
      ok: true,
      meta,
      title,
      markdown,
    });
  }

  return res.status(400).json({ ok: false, error: "Unsupported format" });
};

export default handler;