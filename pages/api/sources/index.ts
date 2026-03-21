import type { NextApiRequest, NextApiResponse } from "next";

import { createOrGetCompany, createSourceRegistryRecord, getSourceManagerData, syncCompanies, loadCompanies } from "@/lib/db/repository";
import type { UrlType } from "@/lib/types";

const allowedTypes: UrlType[] = ["news", "product", "ecosystem", "jobs", "general"];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  syncCompanies(loadCompanies());

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      ...getSourceManagerData()
    });
  }

  if (req.method === "POST") {
    const body = req.body as {
      companyId?: string;
      companyName?: string;
      url?: string;
      urlType?: UrlType;
      keywords?: string[];
      priority?: number;
      enabled?: boolean;
      cacheTtlHours?: number;
      allowCache?: boolean;
    };

    if ((!body.companyId && !body.companyName) || !body.url) {
      return res.status(400).json({ ok: false, error: "missing_required_fields" });
    }
    try {
      const parsed = new URL(body.url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return res.status(400).json({ ok: false, error: "invalid_url_protocol" });
      }
    } catch {
      return res.status(400).json({ ok: false, error: "invalid_url_format" });
    }
    if (!allowedTypes.includes(body.urlType ?? "general")) {
      return res.status(400).json({ ok: false, error: "invalid_url_type" });
    }

    try {
      let companyId = body.companyId;
      if (!companyId && body.companyName) {
        const createdCompany = createOrGetCompany({
          name: body.companyName,
          website: "",
          keywords: body.keywords ?? []
        });
        companyId = createdCompany.id;
      }

      const record = createSourceRegistryRecord({
        companyId: companyId!,
        url: body.url,
        urlType: body.urlType ?? "general",
        keywords: body.keywords ?? [],
        priority: body.priority,
        enabled: body.enabled,
        cacheTtlHours: body.cacheTtlHours,
        allowCache: body.allowCache
      });
      return res.status(200).json({ ok: true, record });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({
        ok: false,
        error: message === "duplicate_source_url" ? "duplicate_source_url" : "create_source_failed",
        message:
          message === "duplicate_source_url"
            ? "该网址已经存在于来源管理里。如果之前删过，会自动恢复；如果仍在列表中，请直接编辑或测试。"
            : message
      });
    }
  }

  return res.status(405).json({ ok: false, error: "method_not_allowed" });
}
