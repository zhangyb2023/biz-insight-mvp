import type { NextApiRequest, NextApiResponse } from "next";
import * as XLSX from "xlsx";

import { getSourceExportData, loadCompanies, parseIncludeInactive, syncCompanies } from "@/lib/db/repository";
import { getDb } from "@/lib/db/sqlite";
import { formatShanghaiDateTime } from "@/lib/format";

const EXCEL_CELL_LIMIT = 32000;

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
  const id = Number(req.query.id);
  const includeInactive = parseIncludeInactive(req.query.includeInactive);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, error: "invalid_source_id" });
  }

  syncCompanies(loadCompanies());
  const data = getSourceExportData(id);
  if (!data || (!includeInactive && data.company && "is_active" in data.company && (data.company as { is_active?: number }).is_active === 0)) {
    return res.status(404).json({ ok: false, error: "source_not_found" });
  }

  const workbook = XLSX.utils.book_new();
  const overviewSheet = [
    withShanghaiTimes({
      export_scope: "single_source",
      source_registry_id: data.registry.id,
      company_id: data.registry.company_id,
      url: data.registry.url,
      url_type: data.registry.url_type,
      generated_at: new Date().toISOString(),
      how_to_read_1: "先看 classified_details：这是这个网址当前最终分类结果。",
      how_to_read_2: "再看 llm_runs：这是这个网址历史模型运行记录。",
      how_to_read_3: "再看 source_versions：这是这个网址的版本变化。",
      how_to_read_4: "document 是清洗正文，extracted_items 是抽取条目。"
    })
  ];
  XLSX.utils.book_append_sheet(workbook, buildSheet(overviewSheet), "overview");
  XLSX.utils.book_append_sheet(workbook, buildSheet([withShanghaiTimes(data.registry as Record<string, unknown>)]), "source_registry");
  if (data.source) {
    XLSX.utils.book_append_sheet(workbook, buildSheet([withShanghaiTimes(data.source as Record<string, unknown>)]), "source");
  }
  if (data.document) {
    const db = getDb();
    const llmRuns = db.prepare(`
      SELECT *
      FROM llm_runs
      WHERE document_id = ?
      ORDER BY id DESC
    `).all(data.document.id) as Array<Record<string, unknown>>;

    const sourceVersions = data.source
      ? (db.prepare(`
          SELECT *
          FROM source_versions
          WHERE source_id = ?
          ORDER BY id DESC
        `).all(data.source.id) as Array<Record<string, unknown>>)
      : [];

    const matchedKeywords = Array.isArray(data.document.matched_keywords)
      ? data.document.matched_keywords.join(", ")
      : String(data.document.matched_keywords ?? "");
    const extractedItemsJson = JSON.stringify(data.document.extracted_items ?? []);
    XLSX.utils.book_append_sheet(workbook, buildSheet([withShanghaiTimes({
      ...data.document,
      matched_keywords: matchedKeywords,
      extracted_items: extractedItemsJson
    })]), "document");

    const extractedItems = (Array.isArray(data.document.extracted_items) ? data.document.extracted_items : []).map((item, index) => ({
      item_order: index + 1,
      ...item
    }));
    const llmRunsSheet = llmRuns.map((row, index) => withShanghaiTimes({
      ...row,
      is_latest_for_document: index === 0
    }));
    const sourceVersionsSheet = sourceVersions.map((row, index) => withShanghaiTimes({
      ...row,
      is_latest_for_url: index === 0
    }));

    const businessView = [
      withShanghaiTimes({
        company_name: data.company?.name ?? data.registry.company_id,
        url: data.registry.url,
        url_type: data.registry.url_type,
        final_title: data.document.title,
        final_category: data.document.category ?? "",
        final_insight_type: data.document.insight_type ?? "",
        final_confidence: data.document.confidence ?? "",
        final_summary: data.document.summary ?? "",
        key_evidence_keywords: matchedKeywords,
        key_evidence_items_count: extractedItems.length,
        latest_llm_status: String(llmRuns[0]?.status ?? ""),
        latest_llm_provider: String(llmRuns[0]?.provider ?? ""),
        what_this_means: "这一行是给业务或普通用户看的最终结论：这条网址最后被判定成什么、为什么值得关注。",
        next_step_if_wrong: "如果最终分类或摘要不对，先去结果解释页，再看 llm_runs 和 source_versions。"
      })
    ];
    const technicalView = [
      withShanghaiTimes({
        source_registry_id: data.registry.id,
        source_id: data.source?.id ?? "",
        document_id: data.document.id,
        latest_llm_run_id: llmRuns[0]?.id ?? "",
        latest_source_version_id: sourceVersions[0]?.id ?? "",
        clean_text_length: data.document.clean_text.length,
        extracted_items_count: extractedItems.length,
        matched_keywords_count: Array.isArray(data.document.matched_keywords) ? data.document.matched_keywords.length : 0,
        latest_llm_status: String(llmRuns[0]?.status ?? ""),
        latest_llm_fallback_used: llmRuns[0]?.fallback_used ?? "",
        latest_source_from_cache: sourceVersions[0]?.from_cache ?? "",
        latest_source_is_changed: sourceVersions[0]?.is_changed ?? "",
        field_reading_order: "先看 classified_details，再看 business_view，再看 llm_runs/source_versions。"
      })
    ];

    XLSX.utils.book_append_sheet(workbook, buildSheet(businessView, ["latest_llm_status"]), "business_view");
    XLSX.utils.book_append_sheet(workbook, buildSheet(technicalView, ["latest_llm_status"]), "technical_view");
    XLSX.utils.book_append_sheet(workbook, buildSheet(extractedItems.map((row) => withShanghaiTimes(row as Record<string, unknown>))), "extracted_items");
    XLSX.utils.book_append_sheet(workbook, buildSheet(llmRunsSheet, ["status"]), "llm_runs");
    XLSX.utils.book_append_sheet(workbook, buildSheet(sourceVersionsSheet), "source_versions");

    const finalClassified = llmRuns[0]
      ? [{
          source_registry_id: data.registry.id,
          document_id: data.document.id,
          company_id: data.document.company_id,
          url: data.document.url,
          title: data.document.title,
          fetch_date: data.document.fetch_date,
          matched_keywords: matchedKeywords,
          summary: data.document.summary ?? "",
          insight_type: data.document.insight_type ?? "",
          confidence: data.document.confidence ?? "",
          category: data.document.category ?? "",
          clean_text: data.document.clean_text,
          extracted_items_json: extractedItemsJson,
          llm_provider: llmRuns[0].provider ?? "",
          llm_model: llmRuns[0].model_name ?? "",
          prompt_version: llmRuns[0].prompt_version ?? "",
          llm_status: llmRuns[0].status ?? "",
          parsed_json: llmRuns[0].parsed_json ?? "",
          raw_response: llmRuns[0].raw_response ?? "",
          fallback_used: llmRuns[0].fallback_used ?? 0,
          retry_count: llmRuns[0].retry_count ?? 0,
          duration_ms: llmRuns[0].duration_ms ?? "",
          error_message: llmRuns[0].error_message ?? ""
        }]
      : [{
          source_registry_id: data.registry.id,
          document_id: data.document.id,
          company_id: data.document.company_id,
          url: data.document.url,
          title: data.document.title,
          fetch_date: data.document.fetch_date,
          matched_keywords: matchedKeywords,
          summary: data.document.summary ?? "",
          insight_type: data.document.insight_type ?? "",
          confidence: data.document.confidence ?? "",
          category: data.document.category ?? "",
          clean_text: data.document.clean_text,
          extracted_items_json: extractedItemsJson,
          llm_provider: "",
          llm_model: "",
          prompt_version: "",
          llm_status: "",
          parsed_json: "",
          raw_response: "",
          fallback_used: 0,
          retry_count: 0,
          duration_ms: "",
          error_message: ""
        }];
    XLSX.utils.book_append_sheet(workbook, buildSheet(finalClassified.map((row) => withShanghaiTimes(row as Record<string, unknown>)), ["llm_status"]), "classified_details");
  }

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=\"source-${id}-cleaned-data.xlsx\"`);
  return res.status(200).send(Buffer.from(buffer));
}
