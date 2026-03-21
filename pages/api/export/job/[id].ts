import type { NextApiRequest, NextApiResponse } from "next";
import * as XLSX from "xlsx";

import { getJobDetails, getLlmRuns, getSourceVersionsByUrls } from "@/lib/db/repository";
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
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, error: "invalid_job_id" });
  }

  const jobData = getJobDetails(id);
  if (!jobData) {
    return res.status(404).json({ ok: false, error: "job_not_found" });
  }

  const llmRuns = getLlmRuns(id);
  const urls = [...new Set(jobData.steps.map((step) => step.source_url).filter(Boolean) as string[])];
  const versions = getSourceVersionsByUrls(urls);

  const workbook = XLSX.utils.book_new();
  const overviewSheet = [
    withShanghaiTimes({
      export_scope: "job",
      job_id: jobData.job.id,
      trigger_type: jobData.job.trigger_type,
      status: jobData.job.status,
      company_count: jobData.job.company_count,
      url_count: jobData.job.url_count,
      generated_at: new Date().toISOString(),
      how_to_read_1: "先看 steps：这是任务里每个 URL 每一步的状态。",
      how_to_read_2: "再看 llm_runs：这是该任务的模型运行记录。",
      how_to_read_3: "再看 source_versions：这是这批网址的内容版本快照。"
    })
  ];
  XLSX.utils.book_append_sheet(workbook, buildSheet(overviewSheet, ["status"]), "overview");
  XLSX.utils.book_append_sheet(workbook, buildSheet([withShanghaiTimes(jobData.job as Record<string, unknown>)], ["status"]), "job");
  XLSX.utils.book_append_sheet(workbook, buildSheet((jobData.steps as unknown as Record<string, unknown>[]).map((row) => withShanghaiTimes(row)), ["status"]), "steps");
  XLSX.utils.book_append_sheet(workbook, buildSheet((llmRuns as unknown as Record<string, unknown>[]).map((row) => withShanghaiTimes(row)), ["status"]), "llm_runs");
  XLSX.utils.book_append_sheet(workbook, buildSheet((versions as Record<string, unknown>[]).map((row) => withShanghaiTimes(row))), "source_versions");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=\"job-${id}-trace.xlsx\"`);
  return res.status(200).send(Buffer.from(buffer));
}
