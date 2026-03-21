import fs from "fs";
import path from "path";

import * as XLSX from "xlsx";

import type { CompanyRecord } from "@/lib/types";

export function loadCompanySource(filePath = path.join(process.cwd(), "data", "companies.json")) {
  if (filePath.endsWith(".xlsx") || filePath.endsWith(".xls")) {
    const workbook = XLSX.readFile(filePath);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet) as CompanyRecord[];
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as CompanyRecord[];
}

export function resolveCompanyUrls(company: CompanyRecord) {
  return [...new Set([company.website, ...company.urls].filter(Boolean))];
}
