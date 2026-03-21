import type { NextApiRequest, NextApiResponse } from "next";
import * as XLSX from "xlsx";

import { getCompanyDetails, loadCompanies, parseIncludeInactive, syncCompanies } from "@/lib/db/repository";
import { getDb } from "@/lib/db/sqlite";
import { formatShanghaiDateTime } from "@/lib/format";

const EXCEL_CELL_LIMIT = 32000;

function safeFilenamePart(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "company";
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function sanitizeCell(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }
  if (value.length <= EXCEL_CELL_LIMIT) {
    return value;
  }
  return `${value.slice(0, EXCEL_CELL_LIMIT)}\n...[TRUNCATED_FOR_EXCEL]`;
}

function sanitizeRows<T extends Record<string, unknown>>(rows: T[]) {
  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, sanitizeCell(value)]))
  );
}

function buildSheet(rows: Record<string, unknown>[], statusFields: string[] = []) {
  const sheet = XLSX.utils.json_to_sheet(sanitizeRows(rows));
  if (!rows.length || !statusFields.length || !sheet["!ref"]) {
    return sheet;
  }
  const headers = Object.keys(rows[0]);
  for (const field of statusFields) {
    const columnIndex = headers.indexOf(field);
    if (columnIndex < 0) {
      continue;
    }
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const cellAddress = XLSX.utils.encode_cell({ c: columnIndex, r: rowIndex + 1 });
      const cell = sheet[cellAddress];
      if (!cell || typeof cell.v !== "string") {
        continue;
      }
      const value = String(cell.v).toLowerCase();
      if (value.includes("success")) {
        cell.s = {
          fill: { fgColor: { rgb: "C6EFCE" } },
          font: { color: { rgb: "006100" }, bold: true }
        };
      } else if (value.includes("failed") || value.includes("error")) {
        cell.s = {
          fill: { fgColor: { rgb: "FFC7CE" } },
          font: { color: { rgb: "9C0006" }, bold: true }
        };
      } else if (value.includes("fallback")) {
        cell.s = {
          fill: { fgColor: { rgb: "FCE4D6" } },
          font: { color: { rgb: "C65911" }, bold: true }
        };
      }
    }
  }
  return sheet;
}

function withShanghaiTimes<T extends Record<string, unknown>>(row: T) {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "string" && /(_at|_date)$/.test(key) && value) {
      extra[`${key}_shanghai`] = formatShanghaiDateTime(value);
    }
  }
  return { ...row, ...extra };
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id || "");
  const since = typeof req.query.since === "string" ? req.query.since : undefined;
  const includeInactive = parseIncludeInactive(req.query.includeInactive);
  syncCompanies(loadCompanies());
  const details = getCompanyDetails(id, { includeInactive });

  if (!details) {
    return res.status(404).json({ ok: false, error: "company_not_found" });
  }

  const documents = since
    ? details.documents.filter((document) => document.fetch_date >= since)
    : details.documents;

  const workbook = XLSX.utils.book_new();
  const db = getDb();

  const documentsSheet = documents.map((document) => withShanghaiTimes({
    company_id: document.company_id,
    document_id: document.id,
    url: document.url,
    title: document.title,
    fetch_date: document.fetch_date,
    matched_keywords: document.matched_keywords.join(", "),
    clean_text: document.clean_text,
    summary: document.summary || "",
    insight_type: document.insight_type || "",
    confidence: document.confidence ?? "",
    category: document.category || ""
  }));

  const detailedResultsSheet = documents.map((document) => {
    const llmRun = db.prepare(`
      SELECT provider, model_name, prompt_version, raw_response, parsed_json, fallback_used, retry_count, duration_ms, status, error_message, created_at
      FROM llm_runs
      WHERE document_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(document.id) as
      | {
          provider: string;
          model_name: string;
          prompt_version: string;
          raw_response: string;
          parsed_json: string;
          fallback_used: number;
          retry_count: number;
          duration_ms: number;
          status: string;
          error_message?: string | null;
          created_at: string;
        }
      | undefined;

    return withShanghaiTimes({
      company_id: document.company_id,
      document_id: document.id,
      url: document.url,
      title: document.title,
      fetch_date: document.fetch_date,
      matched_keywords: document.matched_keywords.join(", "),
      summary: document.summary || "",
      insight_type: document.insight_type || "",
      confidence: document.confidence ?? "",
      category: document.category || "",
      clean_text: document.clean_text,
      extracted_items_json: JSON.stringify(document.extracted_items ?? []),
      llm_provider: llmRun?.provider || "",
      llm_model: llmRun?.model_name || "",
      prompt_version: llmRun?.prompt_version || "",
      llm_status: llmRun?.status || "",
      fallback_used: llmRun ? Boolean(llmRun.fallback_used) : false,
      retry_count: llmRun?.retry_count ?? 0,
      llm_duration_ms: llmRun?.duration_ms ?? "",
      llm_created_at: llmRun?.created_at || "",
      parsed_json: llmRun?.parsed_json || "",
      raw_response: llmRun?.raw_response || "",
      llm_error_message: llmRun?.error_message || ""
    });
  });

  const extractedItemsSheet = documents.flatMap((document) =>
    (document.extracted_items || []).map((item, index) => withShanghaiTimes({
      company_id: document.company_id,
      document_id: document.id,
      source_url: document.url,
      source_title: document.title,
      item_order: index + 1,
      item_title: item.title,
      item_summary: item.summary || "",
      item_date: item.date || ""
    }))
  );

  const sourcesSheet = documents.map((document) => withShanghaiTimes({
    company_id: document.company_id,
    document_id: document.id,
    url: document.url,
    title: document.title,
    fetch_date: document.fetch_date
  }));

  const companyLlmRuns = db.prepare(`
    SELECT
      lr.id,
      s.company_id,
      s.url,
      s.title,
      d.id AS document_id,
      lr.provider,
      lr.model_name,
      lr.prompt_version,
      lr.input_payload_json,
      lr.raw_response,
      lr.parsed_json,
      lr.fallback_used,
      lr.retry_count,
      lr.duration_ms,
      lr.status,
      lr.error_message,
      lr.created_at
    FROM llm_runs lr
    JOIN documents d ON d.id = lr.document_id
    JOIN sources s ON s.id = d.source_id
    WHERE s.company_id = ?
    ORDER BY lr.id DESC
  `).all(id) as Array<Record<string, unknown>>;

  const filteredLlmRuns = since
    ? companyLlmRuns.filter((row) => String(row.created_at || "") >= since)
    : companyLlmRuns;

  const sourceVersions = db.prepare(`
    SELECT
      sv.id,
      s.company_id,
      s.url,
      s.title,
      sv.content_hash,
      sv.from_cache,
      sv.is_changed,
      sv.published_at,
      sv.last_checked_at,
      sv.last_fetched_at,
      sv.last_changed_at,
      sv.clean_text,
      sv.extracted_items_json,
      sv.html_snapshot
    FROM source_versions sv
    JOIN sources s ON s.id = sv.source_id
    WHERE s.company_id = ?
    ORDER BY sv.id DESC
  `).all(id) as Array<Record<string, unknown>>;

  const filteredVersions = since
    ? sourceVersions.filter((row) => String(row.last_checked_at || "") >= since)
    : sourceVersions;

  const latestLlmRunByDocument = new Map<number, number>();
  for (const row of filteredLlmRuns) {
    const documentId = Number(row.document_id);
    if (!latestLlmRunByDocument.has(documentId)) {
      latestLlmRunByDocument.set(documentId, Number(row.id));
    }
  }

  const latestVersionByUrl = new Map<string, number>();
  for (const row of filteredVersions) {
    const url = String(row.url || "");
    if (!latestVersionByUrl.has(url)) {
      latestVersionByUrl.set(url, Number(row.id));
    }
  }

  const overviewSheet = [
    withShanghaiTimes({
      export_scope: "company",
      company_id: details.company.id,
      company_name: details.company.name,
      source_count: documents.length,
      classified_result_count: detailedResultsSheet.length,
      llm_run_count: filteredLlmRuns.length,
      source_version_count: filteredVersions.length,
      since: since || "all",
      generated_at: new Date().toISOString(),
      how_to_read_1: "先看 classified_details：这是每个网址当前最终分类结果。",
      how_to_read_2: "再看 llm_runs：这是模型历史运行记录，不是最终结果表。",
      how_to_read_3: "再看 source_versions：这是页面内容版本变化记录。",
      how_to_read_4: "documents/sources 是基础抓取结果，insights 是摘要层。"
    })
  ];

  const insightsSheet = detailedResultsSheet.map((item) => withShanghaiTimes({
    company_id: item.company_id,
    document_id: item.document_id,
    url: item.url,
    title: item.title,
    summary: item.summary,
    insight_type: item.insight_type,
    confidence: item.confidence,
    category: item.category,
    matched_keywords: item.matched_keywords,
    parsed_json: item.parsed_json
  }));

  const llmRunsSheet = filteredLlmRuns.map((row) =>
    withShanghaiTimes({
      ...row,
      is_latest_for_document: latestLlmRunByDocument.get(Number(row.document_id)) === Number(row.id)
    })
  );

  const sourceVersionsSheet = filteredVersions.map((row) =>
    withShanghaiTimes({
      ...row,
      is_latest_for_url: latestVersionByUrl.get(String(row.url || "")) === Number(row.id)
    })
  );

  const businessViewSheet = detailedResultsSheet.map((item) => withShanghaiTimes({
    company_id: item.company_id,
    company_name: details.company.name,
    url: item.url,
    title: item.title,
    final_category: item.category,
    final_insight_type: item.insight_type,
    final_confidence: item.confidence,
    final_summary: item.summary,
    key_evidence_keywords: item.matched_keywords,
    key_evidence_items_count: parseJson<Array<Record<string, unknown>>>(String(item.extracted_items_json || "[]"), []).length,
    latest_llm_status: item.llm_status,
    why_this_row_exists: "这行给业务或普通用户看：每个网址最后被判成什么、摘要是什么、有哪些关键证据。"
  }));

  const technicalViewSheet = detailedResultsSheet.map((item) => {
    const itemsCount = parseJson<Array<Record<string, unknown>>>(String(item.extracted_items_json || "[]"), []).length;
    return withShanghaiTimes({
      company_id: item.company_id,
      document_id: item.document_id,
      url: item.url,
      clean_text_length: String(item.clean_text || "").length,
      matched_keywords_count: String(item.matched_keywords || "").split(",").filter(Boolean).length,
      extracted_items_count: itemsCount,
      llm_provider: item.llm_provider,
      llm_status: item.llm_status,
      fallback_used: item.fallback_used,
      retry_count: item.retry_count,
      llm_duration_ms: item.llm_duration_ms,
      reading_hint: "技术排查先看 llm_status，再看 extracted_items_count，再看 clean_text_length。"
    });
  });

  XLSX.utils.book_append_sheet(workbook, buildSheet(overviewSheet), "overview");
  XLSX.utils.book_append_sheet(workbook, buildSheet(businessViewSheet, ["latest_llm_status"]), "business_view");
  XLSX.utils.book_append_sheet(workbook, buildSheet(technicalViewSheet, ["llm_status"]), "technical_view");
  XLSX.utils.book_append_sheet(workbook, buildSheet(documentsSheet), "documents");
  XLSX.utils.book_append_sheet(workbook, buildSheet(detailedResultsSheet, ["llm_status"]), "classified_details");
  XLSX.utils.book_append_sheet(workbook, buildSheet(extractedItemsSheet), "extracted_items");
  XLSX.utils.book_append_sheet(workbook, buildSheet(insightsSheet), "insights");
  XLSX.utils.book_append_sheet(workbook, buildSheet(sourcesSheet), "sources");
  XLSX.utils.book_append_sheet(workbook, buildSheet(llmRunsSheet, ["status"]), "llm_runs");
  XLSX.utils.book_append_sheet(workbook, buildSheet(sourceVersionsSheet), "source_versions");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });

  const filename = `${safeFilenamePart(details.company.id)}${since ? `-${safeFilenamePart(since)}` : ""}-cleaned-data.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
  return res.status(200).send(Buffer.from(buffer));
}
