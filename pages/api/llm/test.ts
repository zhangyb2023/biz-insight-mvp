import type { NextApiRequest, NextApiResponse } from "next";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

type TestRequest = {
  systemPrompt?: string;
  userPrompt?: string;
  inputPayload?: unknown;
  temperature?: number;
};

function clampTemperature(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0.2;
  return Math.min(1, Math.max(0, parsed));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: "DeepSeek API Key not configured" });
  }

  const body = req.body as TestRequest;
  const systemPrompt = String(body.systemPrompt || "").trim();
  const userPrompt = String(body.userPrompt || "").trim();

  if (!systemPrompt || !userPrompt) {
    return res.status(400).json({ error: "systemPrompt and userPrompt are required" });
  }

  const startedAt = Date.now();

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: clampTemperature(body.temperature),
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              userPrompt,
              "",
              "【输入数据】",
              JSON.stringify(body.inputPayload ?? {}, null, 2)
            ].join("\n")
          }
        ]
      })
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({
        error: `DeepSeek API error: ${response.status}`,
        details: text,
        duration_ms: Date.now() - startedAt
      });
    }

    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({ error: "DeepSeek response is not JSON", details: text });
    }

    const content = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({
      ok: true,
      provider: "deepseek",
      model_name: DEEPSEEK_MODEL,
      duration_ms: Date.now() - startedAt,
      raw_response: content,
      usage: data.usage || null
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - startedAt
    });
  }
}
