import fs from "fs";
import path from "path";

import type { NextApiRequest, NextApiResponse } from "next";

import { loadCompanies, syncCompanies, updateCompanyTypeInDb } from "@/lib/db/repository";
import type { CompanyRecord } from "@/lib/types";

const companiesFile = path.join(process.cwd(), "data", "companies.json");

function writeCompanies(companies: CompanyRecord[]) {
  fs.writeFileSync(companiesFile, `${JSON.stringify(companies, null, 2)}\n`, "utf8");
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id || "").trim();
  if (!id) {
    return res.status(400).json({ ok: false, error: "invalid_id", message: "公司 id 无效" });
  }

  if (req.method === "PATCH") {
    const body = req.body as { is_active?: boolean; company_type?: string };
    if (typeof body.is_active !== "boolean" && typeof body.company_type !== "string") {
      return res.status(400).json({ ok: false, error: "invalid_payload", message: "当前仅支持更新 is_active 或 company_type" });
    }

    const companies = loadCompanies();
    const index = companies.findIndex((company) => company.id === id);
    if (index < 0) {
      return res.status(404).json({ ok: false, error: "not_found", message: "未找到目标公司" });
    }

    const nextCompanies = [...companies];
    nextCompanies[index] = {
      ...nextCompanies[index],
      ...(typeof body.is_active === "boolean" && { is_active: body.is_active }),
      ...(typeof body.company_type === "string" && { company_type: body.company_type })
    };

    writeCompanies(nextCompanies);
    syncCompanies(loadCompanies());

    if (typeof body.company_type === "string") {
      updateCompanyTypeInDb(id, body.company_type);
    }

    return res.status(200).json({
      ok: true,
      message: "更新成功"
    });
  }

  if (req.method === "DELETE") {
    const companies = loadCompanies();
    const index = companies.findIndex((company) => company.id === id);
    if (index < 0) {
      return res.status(404).json({ ok: false, error: "not_found", message: "未找到目标公司" });
    }

    const nextCompanies = companies.filter(c => c.id !== id);
    writeCompanies(nextCompanies);

    const { getDb } = require("@/lib/db/sqlite");
    const db = getDb();
    const sources = db.prepare("SELECT id FROM sources WHERE company_id = ?").all(id) as Array<{ id: number }>;
    const sourceIds = sources.map(s => s.id);
    
    if (sourceIds.length > 0) {
      db.prepare(`DELETE FROM documents WHERE source_id IN (${sourceIds.join(",")})`).run();
      db.prepare(`DELETE FROM sources WHERE company_id = ?`).run(id);
    }
    db.prepare(`DELETE FROM companies WHERE id = ?`).run(id);

    syncCompanies(loadCompanies());

    return res.status(200).json({
      ok: true,
      message: "删除成功",
      deletedCompany: id,
      deletedSources: sourceIds.length
    });
  }

  return res.status(405).json({ ok: false, error: "method_not_allowed", message: "仅支持 PATCH 和 DELETE" });
}