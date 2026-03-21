import type { InsightPayload, LlmRunResult } from "@/lib/types";

const PROMPT_VERSION = "deepseek-v1";
const MODEL_NAME = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const PROVIDER = process.env.DEEPSEEK_API_KEY ? "deepseek" : "fallback";

function fallbackInsight(text: string, keywords: string[], inputPayload: Record<string, unknown>, errorMessage?: string): LlmRunResult {
  return {
    summary: text.slice(0, 320),
    insight_type: "观察",
    confidence: 0.45,
    category: keywords.length ? "keyword-match" : "general",
    key_points: keywords.slice(0, 5),
    provider: PROVIDER,
    model_name: MODEL_NAME,
    prompt_version: PROMPT_VERSION,
    raw_response: "",
    parsed_json: {},
    fallback_used: true,
    retry_count: 0,
    duration_ms: 0,
    status: errorMessage ? "failed" : "fallback",
    error_message: errorMessage,
    input_payload: inputPayload
  };
}

export async function deepSeekAnalyze(input: {
  company: string;
  title: string;
  text: string;
  keywords: string[];
}): Promise<LlmRunResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const inputPayload = {
    company: input.company,
    title: input.title,
    matched_keywords: input.keywords,
    prompt_version: PROMPT_VERSION,
    content_preview: input.text.slice(0, 12000)
  };
  if (!apiKey) {
    return fallbackInsight(input.text, input.keywords, inputPayload);
  }

  let retryCount = 0;
  const startedAt = Date.now();
  let lastError = "";

  while (retryCount <= 1) {
    try {
      const response = await fetch(`${process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          model: MODEL_NAME,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are a business intelligence analyst. Return strict JSON only with keys summary, insight_type, confidence, category, key_points."
            },
            {
              role: "user",
              content: [
                `Company: ${input.company}`,
                `Title: ${input.title}`,
                `Matched keywords: ${input.keywords.join(", ") || "none"}`,
                "Return JSON like:",
                '{"summary":"...","insight_type":"新闻|产品|合作|招聘|观察","confidence":0.82,"category":"news|product|ecosystem|jobs|general","key_points":["a","b"]}',
                `Content:\n${input.text.slice(0, 12000)}`
              ].join("\n")
            }
          ]
        })
      });

      if (!response.ok) {
        lastError = `http_${response.status}`;
        retryCount += 1;
        continue;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        lastError = "empty_response";
        retryCount += 1;
        continue;
      }

      const parsed = JSON.parse(content) as InsightPayload;
      return {
        summary: parsed.summary,
        insight_type: parsed.insight_type,
        confidence: parsed.confidence,
        category: parsed.category,
        key_points: parsed.key_points ?? [],
        provider: PROVIDER,
        model_name: MODEL_NAME,
        prompt_version: PROMPT_VERSION,
        raw_response: content,
        parsed_json: parsed as unknown as Record<string, unknown>,
        fallback_used: false,
        retry_count: retryCount,
        duration_ms: Date.now() - startedAt,
        status: "success",
        input_payload: inputPayload
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      retryCount += 1;
    }
  }

  const fallback = fallbackInsight(input.text, input.keywords, inputPayload, lastError || "llm_failed");
  return {
    ...fallback,
    retry_count: retryCount - 1,
    duration_ms: Date.now() - startedAt
  };
}
