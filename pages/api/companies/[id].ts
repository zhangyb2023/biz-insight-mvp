import fs from "fs";
import path from "path";

import type { NextApiRequest, NextApiResponse } from "next";

import { loadCompanies, syncCompanies } from "@/lib/db/repository";
import type { CompanyRecord } from "@/lib/types";

const companiesFile = path.join(process.cwd(), "data", "companies.json");

function writeCompanies(companies: CompanyRecord[]) {
  fs.writeFileSync(companiesFile, `${JSON.stringify(companies, null, 2)}\n`, "utf8");
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ ok: false, error: "method_not_allowed", message: "仅支持 PATCH" });
  }

  const id = String(req.query.id || "").trim();
  if (!id) {
    return res.status(400).json({ ok: false, error: "invalid_id", message: "公司 id 无效" });
  }

  const body = req.body as { is_active?: boolean };
  if (typeof body.is_active !== "boolean") {
    return res.status(400).json({ ok: false, error: "invalid_payload", message: "当前仅支持更新 is_active" });
  }

  if (id === "i-soft" && body.is_active === false) {
    return res.status(400).json({ ok: false, error: "forbidden", message: "普华基础软件不允许停用" });
  }

  const companies = loadCompanies();
  const index = companies.findIndex((company) => company.id === id);
  if (index < 0) {
    return res.status(404).json({ ok: false, error: "not_found", message: "未找到目标公司" });
  }

  const nextCompanies = [...companies];
  nextCompanies[index] = {
    ...nextCompanies[index],
    is_active: body.is_active
  };

  writeCompanies(nextCompanies);
  syncCompanies(loadCompanies());

  return res.status(200).json({
    ok: true,
    message: body.is_active ? "启用公司成功" : "停用公司成功"
  });
}
