import type { NextApiRequest, NextApiResponse } from "next";
import * as XLSX from "xlsx";

import {
  getConsumptionSummary,
  listCompanyConsumptionItems,
  listConsumptionItems,
  loadCompanies,
  parseCompanyIdsQuery,
  parseIncludeInactive,
  syncCompanies
} from "@/lib/db/repository";
import { formatShanghaiDateTime } from "@/lib/format";
import type { ConsumptionCategory } from "@/lib/types";

const EXCEL_CELL_LIMIT = 32000;
const allowedCategories: ConsumptionCategory[] = ["新闻动态", "产品", "技术", "招聘", "生态"];

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

function buildSheet(rows: Record<string, unknown>[]) {
  return XLSX.utils.json_to_sheet(sanitizeRows(rows));
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
  const activeCompanies = loadCompanies();
  syncCompanies(activeCompanies);

  const includeInactive = parseIncludeInactive(req.query.includeInactive);
  const companyIds = parseCompanyIdsQuery(req.query.company_ids);
  const companyId = typeof req.query.companyId === "string" ? req.query.companyId : undefined;
  const companyType = typeof req.query.companyType === "string" ? req.query.companyType : undefined;
  const companyQuery = typeof req.query.companyQuery === "string" ? req.query.companyQuery : undefined;
  const category = typeof req.query.category === "string" && allowedCategories.includes(req.query.category as ConsumptionCategory)
    ? (req.query.category as ConsumptionCategory)
    : undefined;
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
  const filters = {
    companyId,
    companyIds: companyIds.length ? companyIds : undefined,
    companyType,
    companyQuery,
    category,
    limit: Number.isFinite(limit) ? limit : undefined,
    includeInactive
  };

  const summary = getConsumptionSummary(filters);
  const items = listConsumptionItems(filters);
  const companies = listCompanyConsumptionItems(filters);
  const workbook = XLSX.utils.book_new();

  const activeCompanyNames = activeCompanies.filter((company) => company.is_active !== false).map((company) => company.name);
  const exportedCompanyNames = companies.map((company) => company.name);
  const exportScope = companyIds.length
    ? includeInactive
      ? "selected_companies_include_inactive"
      : "selected_companies_active_only"
    : includeInactive
      ? "include_inactive"
      : "active_only";

  const overviewSheet = [
    withShanghaiTimes({
      export_scope: exportScope,
      active_company_names: activeCompanyNames.join(", "),
      exported_company_names: exportedCompanyNames.join(", "),
      generated_at: new Date().toISOString(),
      include_inactive: includeInactive,
      company_id: companyId || (companyIds.length === 1 ? companyIds[0] : companyIds.length ? "selected" : "all"),
      company_ids: companyIds.join(", "),
      company_type: companyType || (companyIds.length ? "selected_companies" : "all"),
      company_query: companyQuery || "",
      category: category || "all",
      exported_company_count: companies.length,
      total_items: summary.totalItems,
      traced_items: summary.tracedItems,
      extracted_items: summary.extractedItems,
      summarized_items: summary.summarizedItems,
      how_to_read_1: "overview 看消费层总量和过滤条件。",
      how_to_read_2: "items 是标准消费数据明细，可直接给网页/API/报告使用。",
      how_to_read_3: "companies 是按公司聚合后的消费层视图。"
    })
  ];

  const categoriesSheet = summary.categories.map((row) => ({
    category: row.category,
    count: row.count
  }));

  const itemsSheet = items.map((item) =>
    withShanghaiTimes({
      company_id: item.company_id,
      company_name: item.company_name,
      display_category: item.display_category,
      title: item.title,
      url: item.url,
      fetch_date: item.fetch_date,
      summary: item.summary,
      insight_type: item.insight_type,
      category: item.category,
      confidence: item.confidence,
      extracted_items_count: item.extracted_items.length,
      extracted_items_json: JSON.stringify(item.extracted_items),
      source_domain: item.source_domain ?? "",
      source_type: item.source_type ?? "",
      quality_score: item.quality_score ?? 0,
      is_high_value: item.is_high_value ?? false,
      is_noise: item.is_noise ?? false,
      noise_reason: item.noise_reason ?? "",
      quality_reason: item.quality_reason ?? "",
      matched_rules: (item.matched_rules ?? []).join("; "),
      source_signals: (item.source_signals ?? []).join("; ")
    })
  );

  const companiesSheet = companies.map((company) =>
    withShanghaiTimes({
      company_id: company.id,
      company_name: company.name,
      company_type: company.type,
      website: company.website || "",
      latest_fetch_date: company.latest_fetch_date || "",
      document_count: company.document_count,
      consumption_item_count: company.total_items,
      keywords: company.keywords.join(", ")
    })
  );

  XLSX.utils.book_append_sheet(workbook, buildSheet(overviewSheet), "overview");
  XLSX.utils.book_append_sheet(workbook, buildSheet(categoriesSheet), "categories");
  XLSX.utils.book_append_sheet(workbook, buildSheet(itemsSheet), "items");
  XLSX.utils.book_append_sheet(workbook, buildSheet(companiesSheet), "companies");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${includeInactive ? "consumption-with-history" : "consumption-active-only"}-data.xlsx"`
  );
  return res.status(200).send(Buffer.from(buffer));
}
