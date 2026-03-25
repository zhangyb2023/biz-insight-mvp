import type { NextApiHandler } from "next";
import fs from "fs";

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

type EnrichInput = {
  company_name?: string;
  title: string;
  summary?: string;
  published_at?: string;
  url?: string;
  category?: string;
};

type EnrichResult = {
  insight_event_type: string;
  insight_importance_level: "" | "high" | "medium" | "low";
  insight_evidence_strength: number | null;
  insight_confidence: number | null;
  insight_statement: string;
  insight_why_it_matters: string;
  insight_next_action: string;
  insight_to_phua_relation: string[];
  insight_topic_tags: string[];
  insight_supporting_facts: string[];
  insight_risk_note: string;
};

const SYSTEM_PROMPT = `你是汽车电子基础软件行业的商业洞察分析助手，服务对象是普华基础软件有限公司的信息化/业务支持团队。

你的任务不是复述新闻，而是从单条公开信息中提炼其商业意义，并输出结构化 JSON。

要求：
1. 只基于输入事实判断，不编造
2. 不说空话套话
3. 不输出 markdown
4. 只输出合法 JSON
5. 若证据不足，要在 insight_risk_note 中明确说明
6. 判断聚焦：产品技术、生态合作、市场动作、标准影响、客户合作、量产交付、组织变化等维度
7. 对"对普华的关系"尽量判断为：竞争相关、合作机会、技术参考、客户参考、销售参考、品牌参考、暂不相关

输出字段固定为：
{
  "insight_event_type": "",
  "insight_importance_level": "",
  "insight_evidence_strength": null,
  "insight_confidence": null,
  "insight_statement": "",
  "insight_why_it_matters": "",
  "insight_next_action": "",
  "insight_to_phua_relation": [],
  "insight_topic_tags": [],
  "insight_supporting_facts": [],
  "insight_risk_note": ""
}`;

function buildUserPrompt(input: EnrichInput): string {
  return `请基于以下动态信息，输出结构化商业洞察 JSON。

【公司】
${input.company_name || "未知"}

【标题】
${input.title}

【摘要】
${input.summary || "无"}

【发布时间】
${input.published_at || "未知"}

【链接】
${input.url || "无"}

【分类】
${input.category || "战略动向"}

要求：
- 只输出 JSON
- 不要解释
- insight_statement 用一句话写出业务判断
- insight_why_it_matters 说明为什么值得关注
- insight_next_action 只写一个最合适的动作，例如：持续跟踪、补充验证、纳入周报、纳入专题、提醒销售关注、提醒产品关注、提醒生态关注、仅存档
- insight_to_phua_relation 尽量判断与普华的关系：竞争相关、合作机会、技术参考、客户参考、销售参考、品牌参考、暂不相关`;
}

function normalizeResult(raw: any): EnrichResult {
  const str = (v: any): string => typeof v === "string" ? v : "";
  const strArr = (v: any): string[] => Array.isArray(v) ? v.filter((i): i is string => typeof i === "string") : [];
  const numOrNull = (v: any): number | null => typeof v === "number" && v >= 0 && v <= 100 ? Math.round(v) : null;
  const confOrNull = (v: any): number | null => typeof v === "number" && v >= 0 && v <= 1 ? v : null;

  const importanceLevels = ["high", "medium", "low", ""];
  let importance: "" | "high" | "medium" | "low" = "";
  if (typeof raw.insight_importance_level === "string") {
    const lvl = raw.insight_importance_level.toLowerCase();
    if (lvl === "high" || lvl === "medium" || lvl === "low") {
      importance = lvl;
    }
  }

  return {
    insight_event_type: str(raw.insight_event_type),
    insight_importance_level: importance,
    insight_evidence_strength: numOrNull(raw.insight_evidence_strength),
    insight_confidence: confOrNull(raw.insight_confidence),
    insight_statement: str(raw.insight_statement),
    insight_why_it_matters: str(raw.insight_why_it_matters),
    insight_next_action: str(raw.insight_next_action),
    insight_to_phua_relation: strArr(raw.insight_to_phua_relation),
    insight_topic_tags: strArr(raw.insight_topic_tags),
    insight_supporting_facts: strArr(raw.insight_supporting_facts),
    insight_risk_note: str(raw.insight_risk_note),
  };
}

function getFallbackResult(): EnrichResult {
  return {
    insight_event_type: "",
    insight_importance_level: "",
    insight_evidence_strength: null,
    insight_confidence: null,
    insight_statement: "",
    insight_why_it_matters: "",
    insight_next_action: "",
    insight_to_phua_relation: [],
    insight_topic_tags: [],
    insight_supporting_facts: [],
    insight_risk_note: "",
  };
}

async function callDeepSeek(apiKey: string, input: EnrichInput): Promise<EnrichResult> {
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
        { role: "user", content: buildUserPrompt(input) },
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

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return normalizeResult(parsed);
    } catch {
      console.error("JSON parse failed:", jsonMatch[0].substring(0, 100));
    }
  }

  return getFallbackResult();
}

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const input = req.body as EnrichInput;

  if (!input || !input.title) {
    return res.status(400).json({ ok: false, error: "title is required" });
  }

  const apiKey = getApiKey();

  if (!apiKey) {
    return res.status(200).json({
      ok: true,
      input: {
        company_name: input.company_name,
        title: input.title,
        summary: input.summary?.substring(0, 100),
        published_at: input.published_at,
        url: input.url,
        category: input.category,
      },
      result: getFallbackResult(),
      warning: "DEEPSEEK_API_KEY not configured, returning empty result",
    });
  }

  try {
    const result = await callDeepSeek(apiKey, input);
    return res.status(200).json({
      ok: true,
      input: {
        company_name: input.company_name,
        title: input.title,
        summary: input.summary?.substring(0, 100),
        published_at: input.published_at,
        url: input.url,
        category: input.category,
      },
      result,
    });
  } catch (error) {
    console.error("Enrichment failed:", error);
    return res.status(200).json({
      ok: true,
      input: {
        company_name: input.company_name,
        title: input.title,
        summary: input.summary?.substring(0, 100),
        published_at: input.published_at,
        url: input.url,
        category: input.category,
      },
      result: getFallbackResult(),
      error: String(error),
    });
  }
};

export default handler;