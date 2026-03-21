import type { NextApiRequest, NextApiResponse } from "next";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

interface ReportRequest {
  report_type: "brief" | "exec";
  time_range: string;
  filters: {
    topic?: string;
    core_only?: boolean;
    include_reference?: boolean;
    evidence_type?: string;
    search_query?: string;
  };
  summary: {
    total_count: number;
    high_value_count: number;
    target_company_count: number;
    source_purity_percent: number;
  };
  core_judgments: string[];
  topic_stats: Record<string, { count: number; trend: string; insight: string }>;
  top_insights: Array<{
    title: string;
    topic: string;
    judgment: string;
    risk_note: string;
    next_action: string;
    company: string;
    published_at: string;
    confidence: string;
    entity_type: string;
  }>;
  source_distribution: Array<{ label: string; value: number; percent: number }>;
  company_heat: { target: Array<{ name: string; count: number }>; source: Array<{ name: string; count: number }> };
  generated_at: string;
}

function buildPrompt(data: ReportRequest): string {
  const isExec = data.report_type === "exec";
  
  const confidenceLevel = data.summary.total_count === 0 ? "样本不足" :
    data.summary.source_purity_percent >= 40 && (data.summary.high_value_count / data.summary.total_count) >= 0.3 ? "较高" :
    data.summary.source_purity_percent >= 20 ? "中等" : "较低";
  
  const topEvidence = data.top_insights
    .slice(0, isExec ? 5 : 3)
    .filter(i => i.confidence === "高" || i.entity_type === "一手信源")
    .map((insight, idx) => ({
      title: insight.title,
      company: insight.company,
      date: insight.published_at,
      why: insight.judgment || insight.next_action
    }));

  const keyEvidence = topEvidence.length > 0 ? topEvidence.map((e, idx) => 
`${idx + 1}. **${e.title}**
   - 来源: ${e.company} | ${e.date}
   - 重要性: ${e.why}`
  ).join("\n\n") : "样本不足，无法确定代表性证据";

  const sourceNote = data.source_distribution.map(s => 
    `${s.label}: ${s.value}条(${s.percent}%)`
  ).join("、");

  return `你是商业洞察分析助手。请基于以下结构化数据，生成一份面向管理层的商业洞察报告。

【核心任务】输出商业判断，不是信息摘要。每一个判断都要回答：这对我们的业务意味着什么？

【报告类型】${isExec ? "管理层报告" : "简版报告"}
【观察范围】${data.time_range}
【数据概览】
- 有效洞察: ${data.summary.total_count}条
- 高置信洞察: ${data.summary.high_value_count}条
- 涉及目标公司: ${data.summary.target_company_count}家
- 来源分布: ${sourceNote}

【置信说明】
- 置信水平: ${confidenceLevel}
- 样本量: ${data.summary.total_count}条
- 一手信源占比: ${data.summary.source_purity_percent}%
- 适用边界: 本报告反映公开信息动态，不替代尽调

【重点对象】
目标公司:
${data.company_heat.target.slice(0, 5).map(c => `- ${c.name}: ${c.count}条信号`).join("\n") || "无"}

二手信源:
${data.company_heat.source.slice(0, 5).map(c => `- ${c.name}: ${c.count}条`).join("\n") || "无"}

【代表证据】(按置信度和来源筛选)
${keyEvidence}

请严格按照以下结构输出Markdown报告。语言简洁，面向管理层，禁止堆砌原文:

# 商业洞察报告

## 置信说明
- **置信水平**: ${confidenceLevel}
- **样本量**: ${data.summary.total_count}条
- **一手信源占比**: ${data.summary.source_purity_percent}%
- **适用边界**: 本报告反映公开信息动态，不替代尽调

## 观察范围
- 时间范围: ${data.time_range}
- 数据来源: ${data.summary.total_count}条洞察，${sourceNote}

## 核心结论（固定3条）
请输出：
1. **趋势判断**: 当前最显著的信号是什么，说明什么行业动向
2. **结构判断**: 信源结构如何，高价值内容占比多少
3. **风险判断**: 主要风险点是什么，结论适用边界在哪里

## 主题分析
对以下5个主题逐一分析，每主题不超过3句话:
### 产品与方案
### 技术成熟度
### 生态合作
### 战略动向
### 市场信号

## 重点对象
### 目标公司动态
列出活跃的目标公司及信号数量

## 风险与局限
明确写出：
- 样本局限性
- 信源局限性  
- 结论适用边界

## 下一步建议
给出2-3条具体可执行的建议

## 代表证据（3~5条）
列出最重要的证据，每条包含：标题、来源、日期、为什么重要

【重要要求】
- **核心原则**: 每句话都要回答"这对我们的业务意味着什么"，禁止信息堆砌
- 输出"商业洞察判断"，禁止复述原文内容
- 语言简洁，每段不超过3句
- 禁止空话套话，如"值得关注"、"需要进一步观察"等无价值表述
- 如某主题样本<3条，明确写"样本不足"
- 管理层可快速阅读（报告总长控制在1页内）
- 报告语言为简体中文`;
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
            content: "你是一个专业的商业战略分析顾问。你的核心能力是：从公开信息中提取商业判断，而不是信息摘要。每个判断必须回答：这对目标公司的业务意味着什么？竞争优势如何变化？市场格局如何演进？"
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
    const reportMarkdown = result.choices?.[0]?.message?.content || "";

    if (!reportMarkdown) {
      return res.status(500).json({ error: "Empty response from DeepSeek" });
    }

    const filename = `insight-report-${body.report_type}-${new Date().toISOString().slice(0, 10)}.md`;

    res.status(200).json({
      report_markdown: reportMarkdown,
      report_meta: {
        report_type: body.report_type,
        time_range: body.time_range,
        generated_at: new Date().toISOString(),
        model: DEEPSEEK_MODEL,
        insight_count: body.summary.total_count,
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
