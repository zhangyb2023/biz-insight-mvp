import type { NextApiHandler } from "next";
import { getDb } from "@/lib/db/sqlite";

const allowedColumnsByTable: Record<string, string[]> = {
  llm_runs: ["id", "prompt_version", "model_name", "status", "created_at", "duration_ms", "provider"],
  documents: ["id", "source_id", "clean_text", "matched_keywords", "published_at", "page_kind", "completeness_score"],
  crawl_jobs: ["id", "trigger_type", "status", "started_at", "ended_at", "duration_ms", "success_count", "failure_count"],
  insights: ["id", "document_id", "summary", "insight_type", "confidence", "category"],
  sources: ["id", "company_id", "url", "title", "fetch_date"]
};

function parseLimit(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw || "10", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10;
  }
  return Math.min(parsed, 100);
}

function parseFields(table: string, value: string | string[] | undefined): string | null {
  if (!value || Array.isArray(value) || value === "*") {
    return "*";
  }

  const allowed = new Set(allowedColumnsByTable[table]);
  const fields = value.split(",").map((field) => field.trim()).filter(Boolean);
  if (!fields.length || fields.some((field) => !allowed.has(field))) {
    return null;
  }

  return fields.join(", ");
}

function parseOrder(table: string, value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value || "id desc";
  const match = raw.trim().match(/^([a-z_]+)(?:\s+(asc|desc))?$/i);
  if (!match) {
    return null;
  }

  const [, column, direction = "desc"] = match;
  if (!allowedColumnsByTable[table].includes(column)) {
    return null;
  }

  return `${column} ${direction.toUpperCase()}`;
}

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { table, limit, order, fields, join, on } = req.query;

  if (!table || typeof table !== "string") {
    return res.status(400).json({ error: "table is required" });
  }

  const allowedTables = Object.keys(allowedColumnsByTable);
  if (!allowedTables.includes(table)) {
    return res.status(400).json({ error: `table must be one of: ${allowedTables.join(", ")}` });
  }

  if (join || on) {
    return res.status(400).json({ error: "join queries are disabled for demo stability" });
  }

  const limitNum = parseLimit(limit);
  const fieldsStr = parseFields(table, fields);
  const orderStr = parseOrder(table, order);

  if (!fieldsStr) {
    return res.status(400).json({ error: "invalid fields" });
  }

  if (!orderStr) {
    return res.status(400).json({ error: "invalid order" });
  }

  try {
    const db = getDb();
    const sql = `SELECT ${fieldsStr} FROM ${table} ORDER BY ${orderStr} LIMIT ?`;
    const rows = db.prepare(sql).all(limitNum);
    res.status(200).json({ rows, count: rows.length });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
};

export default handler;
