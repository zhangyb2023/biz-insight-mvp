import type { NextApiRequest, NextApiResponse } from "next";

import { getConsumptionSummary, loadCompanies, parseCompanyIdsQuery, parseIncludeInactive, syncCompanies } from "@/lib/db/repository";
import type { ConsumptionCategory, SourceType } from "@/lib/types";

const allowedCategories: ConsumptionCategory[] = ["新闻动态", "产品", "技术", "招聘", "生态"];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  syncCompanies(loadCompanies());

  const includeInactive = parseIncludeInactive(req.query.includeInactive);
  const companyIds = parseCompanyIdsQuery(req.query.company_ids);
  const companyId = typeof req.query.companyId === "string" ? req.query.companyId : undefined;
  const companyType = typeof req.query.companyType === "string" ? req.query.companyType : undefined;
  const companyQuery = typeof req.query.companyQuery === "string" ? req.query.companyQuery : undefined;
  const category = typeof req.query.category === "string" && allowedCategories.includes(req.query.category as ConsumptionCategory)
    ? (req.query.category as ConsumptionCategory)
    : undefined;
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;

  const isHighValue = req.query.isHighValue === "true" ? true : req.query.isHighValue === "false" ? false : undefined;
  const isNoise = req.query.isNoise === "true" ? true : req.query.isNoise === "false" ? false : undefined;
  const sourceType = typeof req.query.sourceType === "string" ? req.query.sourceType as SourceType : undefined;

  const filters = {
    companyId,
    companyIds: companyIds.length ? companyIds : undefined,
    companyType,
    companyQuery,
    category,
    limit: Number.isFinite(limit) ? limit : undefined,
    includeInactive,
    isHighValue,
    isNoise,
    sourceType
  };

  return res.status(200).json({
    ok: true,
    filters,
    summary: getConsumptionSummary(filters)
  });
}
