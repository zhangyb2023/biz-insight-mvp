import { runCrawlJob } from "@/lib/crawl/runCrawlJob";

export interface CrawlJob {
  id: string;
  status: "pending" | "running" | "success" | "partial" | "failed";
  companyId?: string;
  progress: { current: number; total: number; currentUrl?: string };
  result?: Awaited<ReturnType<typeof runCrawlJob>>;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

const MAX_CONCURRENT = 2;
const jobQueue: CrawlJob[] = [];
const runningJobs = new Set<string>();

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function processJob(jobId: string): Promise<void> {
  const job = jobQueue.find((j) => j.id === jobId);
  if (!job || job.status !== "pending") return;

  if (runningJobs.size >= MAX_CONCURRENT) {
    return;
  }

  runningJobs.add(jobId);
  job.status = "running";
  job.updatedAt = Date.now();

  try {
    const result = await runCrawlJob({
      companyId: job.companyId,
      triggerType: "api"
    });

    job.result = result;
    job.status = result.failureCount > 0 ? (result.successCount > 0 ? "partial" : "failed") : "success";
    job.progress = { current: result.targetCompanyCount, total: result.targetCompanyCount };
  } catch (error) {
    job.error = error instanceof Error ? error.message : String(error);
    job.status = "failed";
  } finally {
    runningJobs.delete(jobId);
    job.updatedAt = Date.now();
    dequeueNext();
  }
}

function dequeueNext(): void {
  const pendingJob = jobQueue.find((j) => j.status === "pending");
  if (pendingJob && runningJobs.size < MAX_CONCURRENT) {
    processJob(pendingJob.id);
  }
}

export function enqueueCrawlJob(options: { companyId?: string }): CrawlJob {
  const job: CrawlJob = {
    id: generateJobId(),
    status: "pending",
    companyId: options.companyId,
    progress: { current: 0, total: 0 },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  jobQueue.push(job);

  if (runningJobs.size < MAX_CONCURRENT) {
    processJob(job.id);
  }

  return job;
}

export function getJobStatus(jobId: string): CrawlJob | null {
  return jobQueue.find((j) => j.id === jobId) || null;
}

export function getAllJobs(): CrawlJob[] {
  return jobQueue.slice(-20).reverse();
}

export function getQueueStats(): { pending: number; running: number; maxConcurrent: number } {
  return {
    pending: jobQueue.filter((j) => j.status === "pending").length,
    running: runningJobs.size,
    maxConcurrent: MAX_CONCURRENT
  };
}
