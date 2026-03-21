import type { NextApiRequest, NextApiResponse } from "next";
import * as XLSX from "xlsx";

import { getDb } from "@/lib/db/sqlite";
import { parseIncludeInactive } from "@/lib/db/repository";
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
  const db = getDb();
  const workbook = XLSX.utils.book_new();
  const includeInactive = parseIncludeInactive(req.query.includeInactive);
  const activeWhere = includeInactive ? "" : " WHERE is_active = 1";
  const activeJoinWhere = includeInactive ? "" : " WHERE c.is_active = 1";

  const companies = db.prepare(`
    SELECT id, name, website, is_active
    FROM companies
    ${activeWhere}
    ORDER BY id ASC
  `).all() as Array<Record<string, unknown>>;
  const sources = db.prepare(`
    SELECT s.*, c.name AS company_name
    FROM sources s
    JOIN companies c ON c.id = s.company_id
    ${activeJoinWhere}
    ORDER BY s.company_id ASC, s.fetch_date DESC
  `).all() as Array<Record<string, unknown>>;
  const documents = db.prepare(`
    SELECT d.*, s.url, s.title, s.fetch_date, c.name AS company_name
    FROM documents d
    JOIN sources s ON s.id = d.source_id
    JOIN companies c ON c.id = s.company_id
    ${activeJoinWhere}
    ORDER BY s.company_id ASC, d.id DESC
  `).all() as Array<Record<string, unknown>>;
  const llmRuns = db.prepare(`
    SELECT lr.*, s.url, c.name AS company_name
    FROM llm_runs lr
    JOIN documents d ON d.id = lr.document_id
    JOIN sources s ON s.id = d.source_id
    JOIN companies c ON c.id = s.company_id
    ${activeJoinWhere}
    ORDER BY lr.id DESC
  `).all() as Array<Record<string, unknown>>;
  const latestLlmByDocument = new Map<number, Record<string, unknown>>();
  for (const row of llmRuns) {
    const documentId = Number(row.document_id);
    if (!latestLlmByDocument.has(documentId)) {
      latestLlmByDocument.set(documentId, row);
    }
  }

  const businessView = documents.map((row) => {
    const latest = latestLlmByDocument.get(Number(row.id));
    return withShanghaiTimes({
      company_name: row.company_name,
      url: row.url,
      title: row.title,
      final_summary: (latest?.parsed_json && String(latest.parsed_json) !== "{}") ? sanitizeCell(String(latest.parsed_json)) : "",
      latest_llm_status: String(latest?.status ?? ""),
      latest_llm_provider: String(latest?.provider ?? ""),
      matched_keywords: sanitizeCell(row.matched_keywords),
      extracted_items_count: (() => {
        try {
          const parsed = JSON.parse(String(row.extracted_items || "[]"));
          return Array.isArray(parsed) ? parsed.length : 0;
        } catch {
          return 0;
        }
      })(),
      why_this_row_exists: "这行给普通用户看：这条网址最终出了什么结果，值不值得继续看。"
    });
  });

  const technicalView = documents.map((row) => {
    const latest = latestLlmByDocument.get(Number(row.id));
    return withShanghaiTimes({
      company_name: row.company_name,
      document_id: row.id,
      url: row.url,
      clean_text_length: String(row.clean_text || "").length,
      latest_llm_status: String(latest?.status ?? ""),
      latest_llm_provider: String(latest?.provider ?? ""),
      fallback_used: latest?.fallback_used ?? "",
      retry_count: latest?.retry_count ?? "",
      duration_ms: latest?.duration_ms ?? "",
      reading_hint: "批量排查时，先按 latest_llm_status 过滤，再看 clean_text_length 和 extracted_items_count。"
    });
  });

  const overview = [
    withShanghaiTimes({
      export_scope: includeInactive ? "all_companies_with_history" : "active_companies_only",
      include_inactive: includeInactive,
      generated_at: new Date().toISOString(),
      company_count: companies.length,
      source_count: sources.length,
      document_count: documents.length,
      llm_run_count: llmRuns.length,
      how_to_read_1: "先看 companies 和 sources：确认维护范围。",
      how_to_read_2: "再看 documents：这是清洗后的正文结果。",
      how_to_read_3: "最后看 llm_runs：这是模型历史运行记录。"
    })
  ];

  XLSX.utils.book_append_sheet(workbook, buildSheet(overview), "overview");
  XLSX.utils.book_append_sheet(workbook, buildSheet(businessView, ["latest_llm_status"]), "business_view");
  XLSX.utils.book_append_sheet(workbook, buildSheet(technicalView, ["latest_llm_status"]), "technical_view");
  XLSX.utils.book_append_sheet(workbook, buildSheet(companies.map((row) => withShanghaiTimes(row))), "companies");
  XLSX.utils.book_append_sheet(workbook, buildSheet(sources.map((row) => withShanghaiTimes(row))), "sources");
  XLSX.utils.book_append_sheet(
    workbook,
    buildSheet(
      documents.map((row) =>
        withShanghaiTimes({
          ...row,
          matched_keywords: sanitizeCell(row.matched_keywords),
          extracted_items: sanitizeCell(row.extracted_items)
        })
      )
    ),
    "documents"
  );
  XLSX.utils.book_append_sheet(workbook, buildSheet(llmRuns.map((row) => withShanghaiTimes(row)), ["status"]), "llm_runs");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${includeInactive ? "all-companies-with-history" : "active-companies-only"}-cleaned-data.xlsx"`
  );
  return res.status(200).send(Buffer.from(buffer));
}
