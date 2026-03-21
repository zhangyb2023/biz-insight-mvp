import type { NextApiRequest, NextApiResponse } from "next";

import { softDeleteSourceRegistryRecord, updateSourceRegistryRecord } from "@/lib/db/repository";
import type { UrlType } from "@/lib/types";

const allowedTypes: UrlType[] = ["news", "product", "ecosystem", "jobs", "general"];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, error: "invalid_id" });
  }

  if (req.method === "PATCH") {
    const body = req.body as {
      url?: string;
      urlType?: UrlType;
      keywords?: string[];
      priority?: number;
      enabled?: boolean;
      cacheTtlHours?: number;
      allowCache?: boolean;
      crawlMode?: string;
      evaluationStatus?: string;
      evaluationScore?: number;
      evaluationReason?: string;
      fixedReason?: string;
      isFixed?: boolean;
    };
    if (body.urlType && !allowedTypes.includes(body.urlType)) {
      return res.status(400).json({ ok: false, error: "invalid_url_type" });
    }
    const record = updateSourceRegistryRecord(id, body);
    if (!record) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }
    return res.status(200).json({ ok: true, record });
  }

  if (req.method === "DELETE") {
    softDeleteSourceRegistryRecord(id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: "method_not_allowed" });
}
