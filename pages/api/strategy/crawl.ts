import type { NextApiHandler } from "next";
import { findStrategyForUrl } from "@/lib/crawl/strategies";
import { getDb } from "@/lib/db/sqlite";
import { classifyItemsWithLLM } from "@/lib/crawl/llmClassifier";

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url, pages, useLLMClassification } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const startTime = new Date();
  const db = getDb();

  try {
    const strategy = findStrategyForUrl(url);
    
    if (!strategy) {
      return res.status(404).json({ error: "No strategy found for this URL" });
    }

    const result = await strategy.crawl(url, { pages: pages || [1, 2, 3] });

    if (!result.success) {
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      db.prepare(`
        INSERT INTO crawl_jobs (trigger_type, status, started_at, ended_at, duration_ms, company_count, url_count, success_count, failure_count, cache_hit_count, changed_count, insight_count, config_snapshot_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'api', 'failed', startTime.toISOString(), endTime.toISOString(), durationMs,
        1, 1, 0, 1, 0, 0, 0, JSON.stringify({ url, pages })
      );
      return res.status(500).json({ error: result.error || "Crawl failed" });
    }

    let extractedItems = result.extractedItems || [];
    
    // Use LLM classification if requested
    if (useLLMClassification !== false && extractedItems.length > 0 && extractedItems.length <= 50) {
      try {
        const itemsWithCategory = await classifyItemsWithLLM(
          extractedItems.map((item, idx) => ({
            id: String(idx),
            title: item.title || "",
            summary: item.summary,
          }))
        );
        
        // Merge LLM category back to items
        extractedItems = extractedItems.map((item, idx) => ({
          ...item,
          category: itemsWithCategory[idx]?.category || item.category,
        }));
      } catch (llmError) {
        console.error("LLM classification failed:", llmError);
      }
    }
    
    const source = db.prepare("SELECT * FROM sources WHERE url = ?").get(url) as any;
    
    if (source) {
      const now = new Date().toISOString();
      const extractedItemsJson = JSON.stringify(extractedItems);
      const cleanText = result.page?.html || "";
      
      const existingDoc = db.prepare("SELECT * FROM documents WHERE source_id = ?").get(source.id);
      
      if (existingDoc) {
        db.prepare(
          "UPDATE documents SET clean_text = ?, extracted_items = ?, published_at = ?, page_kind = 'list', completeness_score = 1, matched_keywords = '[]' WHERE source_id = ?"
        ).run(cleanText, extractedItemsJson, now, source.id);
      } else {
        db.prepare(
          "INSERT INTO documents (source_id, clean_text, extracted_items, published_at, page_kind, completeness_score, matched_keywords) VALUES (?, ?, ?, ?, 'list', 1, '[]')"
        ).run(source.id, cleanText, extractedItemsJson, now);
      }
      
      db.prepare("UPDATE sources SET fetch_date = ? WHERE id = ?").run(now, source.id);
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    const successCount = extractedItems.length;
    const changedCount = successCount > 0 ? 1 : 0;

    db.prepare(`
      INSERT INTO crawl_jobs (trigger_type, status, started_at, ended_at, duration_ms, company_count, url_count, success_count, failure_count, cache_hit_count, changed_count, insight_count, config_snapshot_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'api', 'success', startTime.toISOString(), endTime.toISOString(), durationMs,
      1, 1, successCount, 0, 0, changedCount, 0, JSON.stringify({ url, pages })
    );

    return res.status(200).json({
      success: true,
      data: {
        page: result.page,
        extractedItems: extractedItems
      }
    });
  } catch (error) {
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    db.prepare(`
      INSERT INTO crawl_jobs (trigger_type, status, started_at, ended_at, duration_ms, company_count, url_count, success_count, failure_count, cache_hit_count, changed_count, insight_count, config_snapshot_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'api', 'failed', startTime.toISOString(), endTime.toISOString(), durationMs,
      1, 1, 0, 1, 0, 0, 0, JSON.stringify({ url, pages })
    );
    return res.status(500).json({ error: String(error) });
  }
};

export default handler;
