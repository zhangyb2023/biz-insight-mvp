import fs from "fs";
import path from "path";

import type { NextApiRequest, NextApiResponse } from "next";

import { loadCompanies, syncCompanies } from "@/lib/db/repository";
import type { CompanyRecord } from "@/lib/types";

const companiesFile = path.join(process.cwd(), "data", "companies.json");

function normalizeWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "/");
}

function normalizeKeywords(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.join(",") : String(value ?? "");
  const seen = new Set<string>();
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildCompanyId(name: string, companies: CompanyRecord[]): string {
  const baseId = slugify(name) || `company-${Date.now()}`;
  let candidateId = baseId;
  let suffix = 2;

  while (companies.some((company) => company.id === candidateId)) {
    candidateId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidateId;
}

function writeCompanies(companies: CompanyRecord[]) {
  fs.writeFileSync(companiesFile, `${JSON.stringify(companies, null, 2)}\n`, "utf8");
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed", message: "仅支持 POST" });
  }

  const body = req.body as {
    name?: string;
    website?: string;
    keywords?: string[] | string;
  };

  const name = body.name?.trim() || "";
  const website = normalizeWebsite(body.website || "");
  const keywords = normalizeKeywords(body.keywords);

  if (!name || !website || keywords.length === 0) {
    return res.status(400).json({
      ok: false,
      error: "missing_required_fields",
      message: "name、website、keywords 为必填项"
    });
  }

  let parsedWebsite: URL;
  try {
    parsedWebsite = new URL(website);
    if (!["http:", "https:"].includes(parsedWebsite.protocol)) {
      return res.status(400).json({ ok: false, error: "invalid_website_protocol", message: "官网地址协议无效" });
    }
  } catch {
    return res.status(400).json({ ok: false, error: "invalid_website", message: "官网地址格式无效" });
  }

  const companies = loadCompanies();
  const id = buildCompanyId(name, companies);

  const company: CompanyRecord = {
    id,
    name,
    website: parsedWebsite.toString(),
    is_active: true,
    keywords,
    urls: [parsedWebsite.toString()]
  };

  writeCompanies([...companies, company]);
  syncCompanies(loadCompanies());

  return res.status(200).json({
    ok: true,
    message: "新增公司成功",
    company: {
      id: company.id,
      name: company.name
    }
  });
}
