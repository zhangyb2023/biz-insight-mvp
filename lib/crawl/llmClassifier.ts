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

export type ClassifiedItem = {
  id: string;
  title: string;
  summary?: string;
  category: string;
  reason?: string;
};

export async function classifyItemsWithLLM(
  items: Array<{ id: string; title: string; summary?: string }>
): Promise<ClassifiedItem[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("DEEPSEEK_API_KEY not found");
    return items.map((item) => ({
      ...item,
      category: guessCategory(item.title, item.summary),
    }));
  }

  const newsList = items
    .map(
      (item, i) =>
        `${i + 1}. 标题: ${item.title}${
          item.summary ? `\n   摘要: ${item.summary.substring(0, 150)}` : ""
        }`
    )
    .join("\n\n");

  const prompt = `你是一个专业的汽车行业商业新闻分类助手。请分析以下新闻，判断每个属于哪个分类。

分类标准（必须严格选择其一）：
- 产品技术：新品发布、产品获奖、技术突破、研发进展、专利算法、系统升级
- 生态合作：战略合作、联盟签约、生态伙伴奖、标准参与、并购整合
- 战略动向：融资动态、财报业绩、产能扩张、高管变动、上市、投资
- 政策法规：政府政策、行业标准、监管动态、合规要求、认证
- 人才动态：招聘需求、人才趋势、技能要求、社招、校招

新闻列表：
${newsList}

返回JSON格式（只返回JSON，不要其他内容）：
{"items":[{"id":"1","category":"分类名称","reason":"简短分类理由"},...]}`.trim();

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "你是一个专业的汽车行业商业新闻分类助手，分类要准确并给出简短理由。",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error(`DeepSeek API error: ${response.status}`);
      return items.map((item) => ({
        ...item,
        category: guessCategory(item.title, item.summary),
      }));
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { items: Array<{ id: string; category: string; reason?: string }> };
      return parsed.items.map((item) => {
        const original = items.find((it) => it.id === item.id);
        return {
          id: item.id,
          title: original?.title || "",
          summary: original?.summary,
          category: normalizeCategory(item.category),
          reason: item.reason,
        };
      });
    }
  } catch (error) {
    console.error("LLM classification error:", error);
  }

  return items.map((item) => ({
    ...item,
    category: guessCategory(item.title, item.summary),
  }));
}

function normalizeCategory(category: string): string {
  const cat = category.toLowerCase();
  if (cat.includes("产品") || cat.includes("技术") || cat.includes("product") || cat.includes("tech")) {
    return "产品技术";
  }
  if (cat.includes("生态") || cat.includes("合作") || cat.includes("ecosystem") || cat.includes("partner")) {
    return "生态合作";
  }
  if (cat.includes("战略") || cat.includes("投资") || cat.includes("融资") || cat.includes("财报") || cat.includes("strategy")) {
    return "战略动向";
  }
  if (cat.includes("政策") || cat.includes("法规") || cat.includes("监管") || cat.includes("policy") || cat.includes("regulation")) {
    return "政策法规";
  }
  if (cat.includes("人才") || cat.includes("招聘") || cat.includes("talent") || cat.includes("jobs") || cat.includes("recruitment")) {
    return "人才动态";
  }
  return "战略动向";
}

function guessCategory(title: string, summary?: string): string {
  const text = `${title} ${summary || ""}`.toLowerCase();

  if (/(招聘|人才|社招|校招|岗位)/.test(text)) {
    return "人才动态";
  }
  if (/(生态|合作|伙伴|联盟|签约|并购|收购)/.test(text)) {
    return "生态合作";
  }
  if (/(融资|投资|财报|业绩|扩张|高管|上市|ipo)/.test(text)) {
    return "战略动向";
  }
  if (/(政策|法规|标准|监管|合规|iso|iec)/.test(text)) {
    return "政策法规";
  }
  if (/(产品|发布|升级|获奖|新品|方案)/.test(text)) {
    return "产品技术";
  }
  if (/(技术|研发|专利|算法|突破|系统)/.test(text)) {
    return "产品技术";
  }

  return "战略动向";
}