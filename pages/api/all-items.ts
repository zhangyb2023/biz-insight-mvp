import type { NextApiHandler } from "next";
import { listConsumptionItems } from "@/lib/db/repository";

const handler: NextApiHandler = async (req, res) => {
  try {
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 200;
    const items = listConsumptionItems({ limit: Number.isFinite(limit) ? limit : 200 }).map((item) => {
      const extracted = item.extracted_items[0];
      return {
        company_id: item.company_id,
        company_name: item.company_name,
        title: extracted?.title || item.title,
        url: extracted?.url || item.url,
        fetch_date: item.fetch_date,
        published_at: item.published_at || extracted?.date || null,
        summary: extracted?.summary || item.summary,
        insight_type: item.insight_type,
        category: item.display_category || item.category,
        completeness_score: item.completeness_score,
        clean_text: item.summary,
        insight_event_type: extracted?.insight_event_type || "",
        insight_importance_level: extracted?.insight_importance_level || "",
        insight_evidence_strength: extracted?.insight_evidence_strength ?? null,
        insight_confidence: extracted?.insight_confidence ?? item.confidence ?? null,
        insight_statement: extracted?.insight_statement || "",
        insight_why_it_matters: extracted?.insight_why_it_matters || "",
        insight_next_action: extracted?.insight_next_action || "",
        insight_to_phua_relation: extracted?.insight_to_phua_relation || [],
        insight_topic_tags: extracted?.insight_topic_tags || [],
        insight_supporting_facts: extracted?.insight_supporting_facts || [],
        insight_risk_note: extracted?.insight_risk_note || "",
        insight_updated_at: extracted?.insight_updated_at || null,
      };
    });
    res.status(200).json({ items, totalCount: items.length });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
};

export default handler;
