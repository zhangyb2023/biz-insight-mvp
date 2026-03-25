import type { NextApiRequest, NextApiResponse } from "next";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

interface CompactItem {
  company: string;
  company_id?: string;
  title: string;
  summary: string;
  date: string;
  category: string;
}

interface ReportRequest {
  report_type: "brief" | "exec";
  time_range: string;
  time_window_days: number;
  window_days: number;
  company_ids?: string[];
  filters: {
    topic?: string;
    core_only?: boolean;
    include_reference?: boolean;
    evidence_type?: string;
    search_query?: string;
  };
  items: CompactItem[];
  meta: {
    total_items: number;
    companies_count: number;
    cutoff_date: string;
  };
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

function buildPrompt(data: ReportRequest): string {
  const isExec = data.report_type === "exec";
  const displayCompany = data.company_ids?.length === 1 ? getDisplayName(data.company_ids[0]) : null;
  
  const reportTitle = displayCompany 
    ? `普华汽车电子商业洞察观察简报：${displayCompany}（近${data.window_days}天）`
    : `普华汽车电子商业洞察总览简报（近${data.window_days}天）`;

  const reportDescription = displayCompany
    ? `本报告基于近${data.window_days}天 ${displayCompany} 相关公开动态信息生成，用于从普华视角观察该公司的重点动作、潜在影响及建议跟踪方向。`
    : `本报告基于近${data.window_days}天全部目标公司的公开动态信息生成，用于辅助管理层快速识别行业重点变化、竞争信号与合作机会。`;

  const singleCompanyContext = displayCompany
    ? `\n\n【重点关注公司】本期报告聚焦于 ${displayCompany}。你的分析应以此公司为核心，提及其他公司时只作为对标对象，合作上下文或生态关联对象，不能喧宾夺主。`
    : "";

  const detailLevel = isExec ? "详细" : "简洁";
  const topChangesLimit = isExec ? "5" : "3";
  const managementActionsLimit = isExec ? "5" : "3";

  return `你是汽车电子基础软件行业的商业洞察分析专家，服务对象是普华基础软件有限公司的管理层。

请分析以下近${data.window_days}天的汽车电子行业动态，生成${detailLevel}版商业洞察报告。${singleCompanyContext}

输入数据：
${JSON.stringify(data.items, null, 2)}

【数据概览】
- 有效洞察: ${data.items.length}条
- 涉及目标公司: ${data.meta.companies_count}家
- 时间范围: 近${data.window_days}天

【核心原则】
1. 只基于输入证据，不编造
2. 不说空话套话，如"行业持续发展、竞争日趋激烈"
3. 每条结论都要有具体依据，具体到公司名、产品名、合作事件名
4. 对普华影响要具体：影响哪个方面、可能带来什么机会或威胁
5. 结论措辞要适度：多用"建议优先评估、建议重点验证、若趋势延续则可能"
6. 如果证据不足或样本集中，明确说明结论边界

【特别要求】
1. 执行摘要：明确写出"本期最值得管理层关注的${topChangesLimit}件事"，每件事都要具体到公司名和事件
2. 重点变化：每条都要包含具体变化内容、对普华的具体影响、建议动作，最多${topChangesLimit}条
3. 对普华影响：不要写"值得关注"，要写具体影响，如"可能压缩普华在XX公司的市场份额"
4. 管理动作：要具体到部门，如"建议市场/售前团队：尽快对接XX公司，了解其智能驾驶方案选型计划"
5. 如果是单公司报告，重点写该公司，其他公司只作为对标/合作对象提及

【输出格式严格JSON】：
{
  "window_summary": {
    "overall_judgement": "本期最值得关注的3件事（每件都要具体到公司名和事件）",
    "signal_density": "high/medium/low",
    "manager_note": "结论边界说明"
  },
  "top_changes": [{ "title": "具体事件标题", "judgement": "判断", "why_important": "为什么重要", "to_phua_impact": "对普华的具体影响", "recommended_action": "建议动作" }],
  "phua_impacts": { "competition_pressure": [], "cooperation_opportunities": [], "product_market_reference": [] },
  "management_actions": [{ "department": "部门", "action": "具体动作", "priority": "high/medium/low", "reason": "原因" }]
}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: "DeepSeek API Key not configured" });
  }

  const body = req.body as ReportRequest;

  try {
    const prompt = buildPrompt(body);

    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: "system",
            content: `你是汽车电子基础软件行业的商业洞察分析专家，服务对象是普华基础软件有限公司的管理层。

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

【管理动作格式】
- 每条管理动作格式："建议[部门]：[具体动作]，原因：[为什么这样做]"
- 部门分类：产品/平台、市场/售前、生态/合作`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `DeepSeek API error: ${response.status}`, details: errorText });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    let reportJson = null;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        reportJson = JSON.parse(jsonMatch[0]);
      } catch {
        console.error("JSON parse failed");
      }
    }

    const isExec = body.report_type === "exec";
    const displayCompany = body.company_ids?.length === 1 ? getDisplayName(body.company_ids[0]) : null;
    const reportTitle = displayCompany 
      ? `普华汽车电子商业洞察观察简报：${displayCompany}（近${body.window_days}天）`
      : `普华汽车电子商业洞察总览简报（近${body.window_days}天）`;
    const reportDescription = displayCompany
      ? `本报告基于近${body.window_days}天 ${displayCompany} 相关公开动态信息生成，用于从普华视角观察该公司的重点动作、潜在影响及建议跟踪方向。`
      : `本报告基于近${body.window_days}天全部目标公司的公开动态信息生成，用于辅助管理层快速识别行业重点变化、竞争信号与合作机会。`;

    const buildMarkdown = (data: any): string => {
      const lines: string[] = [];
      
      lines.push(`# ${reportTitle}`);
      lines.push("");
      lines.push("**【报告说明】**");
      lines.push(reportDescription);
      lines.push("");
      lines.push("---");
      lines.push("");

      lines.push("## 执行摘要");
      if (data.window_summary) {
        if (data.window_summary.overall_judgement) {
          lines.push(`**核心判断：** ${data.window_summary.overall_judgement}`);
        }
        if (data.window_summary.signal_density) {
          const densityMap: Record<string, string> = { high: "高", medium: "中", low: "低" };
          lines.push(`**信号强度：** ${densityMap[data.window_summary.signal_density] || data.window_summary.signal_density}`);
        }
        if (data.window_summary.manager_note) {
          lines.push("");
          lines.push(data.window_summary.manager_note);
        }
      }
      lines.push("");

      lines.push("## 本期重点变化");
      if (data.top_changes && data.top_changes.length > 0) {
        data.top_changes.slice(0, 5).forEach((change: any, idx: number) => {
          lines.push(`${idx + 1}. **${change.title || "无标题"}**`);
          if (change.judgement) lines.push(`   - 判断：${change.judgement}`);
          if (change.why_important) lines.push(`   - 重要性：${change.why_important}`);
          if (change.to_phua_impact) lines.push(`   - 对普华：${change.to_phua_impact}`);
          if (change.recommended_action) lines.push(`   - 建议：${change.recommended_action}`);
          lines.push("");
        });
      } else {
        lines.push("暂无重点变化数据");
        lines.push("");
      }

      lines.push("## 对普华影响");
      if (data.phua_impacts) {
        if (data.phua_impacts.competition_pressure?.length > 0) {
          lines.push("### 竞争压力");
          data.phua_impacts.competition_pressure.forEach((item: string) => {
            lines.push(`- ${item}`);
          });
          lines.push("");
        }
        if (data.phua_impacts.cooperation_opportunities?.length > 0) {
          lines.push("### 合作机会");
          data.phua_impacts.cooperation_opportunities.forEach((item: string) => {
            lines.push(`- ${item}`);
          });
          lines.push("");
        }
        if (data.phua_impacts.product_market_reference?.length > 0) {
          lines.push("### 产品/市场参考");
          data.phua_impacts.product_market_reference.forEach((item: string) => {
            lines.push(`- ${item}`);
          });
          lines.push("");
        }
      }

      lines.push("## 管理动作建议");
      if (data.management_actions && data.management_actions.length > 0) {
        data.management_actions.slice(0, 5).forEach((action: any, idx: number) => {
          lines.push(`${idx + 1}. **${action.department || "未知部门"}**：${action.action || ""}`);
          if (action.reason) {
            lines.push(`   - 原因：${action.reason}`);
          }
        });
      } else {
        lines.push("暂无管理动作建议");
      }
      lines.push("");

      lines.push("---");
      lines.push("*本报告由普华汽车电子商业洞察系统自动生成*");

      return lines.join("\n");
    };

    const markdown = reportJson ? buildMarkdown(reportJson) : `# 报告生成失败

无法解析 DeepSeek 返回结果，请稍后重试。

原始返回：
\`\`\`
${content.substring(0, 500)}
\`\`\``;

    const filename = `insight-report-${body.report_type}-${new Date().toISOString().slice(0, 10)}.md`;

    res.status(200).json({
      report_markdown: markdown,
      report_meta: {
        report_type: body.report_type,
        time_range: body.time_range,
        window_days: body.window_days,
        generated_at: new Date().toISOString(),
        model: DEEPSEEK_MODEL,
        item_count: body.items.length,
        filters: body.filters
      },
      filename
    });
  } catch (error) {
    console.error("Report generation error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate report"
    });
  }
}
