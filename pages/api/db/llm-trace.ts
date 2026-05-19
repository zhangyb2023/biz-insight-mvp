import type { NextApiHandler } from "next";
import { getDb } from "@/lib/db/sqlite";

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { limit = "10" } = req.query;
  const limitNum = Math.min(parseInt(limit as string) || 10, 50);

  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT 
        lr.id,
        lr.provider,
        lr.prompt_version,
        lr.model_name,
        lr.input_payload_json,
        lr.raw_response,
        lr.parsed_json,
        lr.fallback_used,
        lr.retry_count,
        lr.duration_ms,
        lr.status,
        lr.error_message,
        lr.created_at,
        s.id as source_id,
        s.company_id,
        s.url as doc_url,
        s.title as doc_title,
        i.id as insight_id,
        i.summary as insight_summary,
        i.confidence as insight_confidence,
        i.category as insight_category
      FROM llm_runs lr
      LEFT JOIN documents d ON lr.document_id = d.id
      LEFT JOIN sources s ON d.source_id = s.id
      LEFT JOIN insights i ON i.document_id = d.id
      ORDER BY lr.created_at DESC
      LIMIT ?
    `).all(limitNum);

    const traces = (rows as any[]).map(r => {
      let inputPayload: any = {};
      try {
        inputPayload = JSON.parse(r.input_payload_json || "{}");
      } catch {}
      
      let parsedOutput: any = { confidence: null };
      try {
        parsedOutput = JSON.parse(r.parsed_json || "{}");
      } catch {}
      
      let rawOutput: any = {};
      try {
        rawOutput = JSON.parse(r.raw_response || "{}");
      } catch {}

      const inputItems = inputPayload.items || [inputPayload];
      const itemCount = inputPayload.items ? inputPayload.items.length : 1;

      return {
        id: r.id,
        prompt_version: r.prompt_version || "deepseek-v1",
        provider: r.provider || "",
        model_name: r.model_name || "deepseek-chat",
        status: r.status,
        fallback_used: Boolean(r.fallback_used),
        retry_count: r.retry_count ?? 0,
        duration_ms: r.duration_ms ?? 0,
        error_message: r.error_message || "",
        llm_confidence: parsedOutput.confidence ?? rawOutput.confidence ?? null,
        created_at: r.created_at,
        source_id: r.source_id,
        company_id: r.company_id || inputPayload.company,
        doc_url: r.doc_url,
        doc_title: r.doc_title || inputPayload.title,
        insight_id: r.insight_id,
        insight_summary: r.insight_summary,
        insight_confidence: r.insight_confidence,
        insight_category: r.insight_category,
        item_count: itemCount,
        input_preview: inputItems.slice(0, 2),
        input_payload: inputPayload,
        parsed_json: parsedOutput,
        raw_response: r.raw_response || "",
      };
    });

    res.status(200).json({ rows: traces, count: traces.length });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
};

export default handler;
