import type { NextApiRequest, NextApiResponse } from "next";

import { enqueueCrawlJob, getJobStatus, getQueueStats } from "@/lib/crawl/jobQueue";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const companyId =
      typeof req.body?.companyId === "string" && req.body.companyId.trim()
        ? String(req.body.companyId)
        : undefined;

    const useCache = req.body?.useCache === undefined ? true : Boolean(req.body.useCache);
    const forceRefresh = Boolean(req.body?.forceRefresh);
    const cacheMaxAgeHours = typeof req.body?.cacheMaxAgeHours === "number" ? req.body.cacheMaxAgeHours : 24;

    const job = enqueueCrawlJob({ companyId, useCache, forceRefresh, cacheMaxAgeHours });

    return res.status(202).json({
      ok: true,
      jobId: job.id,
      status: job.status,
      message: "任务已加入队列，请使用 jobId 轮询状态"
    });
  }

  if (req.method === "GET") {
    const jobId = typeof req.query.jobId === "string" ? req.query.jobId : undefined;

    if (jobId) {
      const job = getJobStatus(jobId);
      if (!job) {
        return res.status(404).json({ ok: false, error: "job_not_found" });
      }
      return res.status(200).json({
        ok: true,
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        result: job.result
      });
    }

    const stats = getQueueStats();
    return res.status(200).json({ ok: true, stats });
  }

  return res.status(405).json({ ok: false, error: "method_not_allowed" });
}
