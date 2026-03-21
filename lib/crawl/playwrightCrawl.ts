import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import fsSync from "fs";

import { chromium } from "playwright";

import type { CrawlFailure, CrawlPage } from "@/lib/types";
import {
  defaultCrawlProtectionConfig,
  type CrawlProtectionConfig,
  type CrawlLogEntry,
  extractDomain,
  waitForDomainConcurrency,
  releaseDomainConcurrency,
  waitForDomainDelay,
  shouldSkipRecent,
  isBlockedStatus,
  isBlockedContent,
  calculateRetryDelay,
  fetchRobotsTxt,
  isAllowedByRobots,
  createCrawlLogEntry
} from "./crawlProtection";

function cachePath(url: string) {
  const hash = crypto.createHash("sha1").update(url).digest("hex");
  return path.join(process.cwd(), "data", "crawl_cache", `${hash}.json`);
}

export type CrawlOptions = {
  timeoutMs?: number;
  concurrency?: number;
  useCache?: boolean;
  forceRefresh?: boolean;
  cacheMaxAgeHours?: number;
  protection?: Partial<CrawlProtectionConfig>;
};

export type CrawlResult = {
  pages: CrawlPage[];
  errors: CrawlFailure[];
  logs: CrawlLogEntry[];
};

export async function playwrightCrawl(urls: string[], options: CrawlOptions = {}): Promise<CrawlResult> {
  const timeoutMs = options.timeoutMs ?? 30000;
  const concurrency = Math.max(1, options.concurrency ?? 3);
  const useCache = options.useCache ?? true;
  const forceRefresh = options.forceRefresh ?? false;
  const cacheMaxAgeHours = options.cacheMaxAgeHours ?? 24;
  const protection = { ...defaultCrawlProtectionConfig, ...options.protection };
  
  const logs: CrawlLogEntry[] = [];

  const browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false"
  });

  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
    });

    const chunks = urls.reduce<string[][]>((accumulator, url, index) => {
      const bucket = Math.floor(index / concurrency);
      accumulator[bucket] ??= [];
      accumulator[bucket].push(url);
      return accumulator;
    }, []);

    const results: CrawlPage[] = [];
    const errors: CrawlFailure[] = [];

    const processedUrls = new Set<string>();

    for (const batch of chunks) {
      const pages = await Promise.all(
        batch.map(async (url) => {
          const domain = extractDomain(url);
          if (!domain) {
            errors.push({ url, code: "invalid_url", message: "URL is invalid" });
            return null;
          }

          if (protection.enableRobotsCheck) {
            const robotsRules = await fetchRobotsTxt(domain);
            if (!isAllowedByRobots(url, robotsRules)) {
              logs.push(createCrawlLogEntry({ url, statusCode: 0, retryCount: 0, blockedSuspected: true, error: "blocked_by_robots" }));
              return null;
            }
          }

          await waitForDomainConcurrency(domain, protection);
          await waitForDomainDelay(domain, protection);

          try {
            new URL(url);
          } catch {
            errors.push({ url, code: "invalid_url", message: "URL is invalid" });
            return null;
          }

          if (processedUrls.has(url)) {
            return null;
          }
          processedUrls.add(url);

          const file = cachePath(url);
          let cachedFetchedAt: string | null = null;
          
          if (useCache && !forceRefresh && fsSync.existsSync(file)) {
            try {
              const cached = JSON.parse(await fs.readFile(file, "utf8")) as CrawlPage;
              cachedFetchedAt = cached.fetchedAt;
              
              if (shouldSkipRecent(url, cachedFetchedAt, protection)) {
                const fetchedAtTs = Date.parse(cached.fetchedAt);
                const ageHours = Number.isFinite(fetchedAtTs) ? (Date.now() - fetchedAtTs) / (1000 * 60 * 60) : Infinity;
                logs.push(createCrawlLogEntry({ url, statusCode: 200, retryCount: 0, blockedSuspected: false }));
                return { ...cached, checkedAt: new Date().toISOString(), fromCache: true, cacheAgeHours: ageHours } satisfies CrawlPage;
              }
              
              const fetchedAtTs2 = Date.parse(cached.fetchedAt);
              const ageHours = Number.isFinite(fetchedAtTs2) ? (Date.now() - fetchedAtTs2) / (1000 * 60 * 60) : Infinity;
              if (ageHours <= cacheMaxAgeHours) {
                logs.push(createCrawlLogEntry({ url, statusCode: 200, retryCount: 0, blockedSuspected: false }));
                return { ...cached, checkedAt: new Date().toISOString(), fromCache: true, cacheAgeHours: ageHours } satisfies CrawlPage;
              }
            } catch {}
          }

          let retryCount = 0;
          let lastError: string | undefined;
          let lastStatusCode = 0;

          while (retryCount <= protection.maxRetryCount) {
            const page = await context.newPage();
            try {
              const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
              await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 5000) }).catch(() => undefined);
              
              const statusCode = response?.status() ?? 200;
              lastStatusCode = statusCode;
              
              if (isBlockedStatus(statusCode) || statusCode === 0) {
                const retryDelay = calculateRetryDelay(retryCount, protection.retryDelayBaseMs);
                logs.push(createCrawlLogEntry({ url, statusCode, retryCount, blockedSuspected: true, error: `http_${statusCode}` }));
                
                if (retryCount < protection.maxRetryCount) {
                  retryCount++;
                  await new Promise((resolve) => setTimeout(resolve, retryDelay));
                  continue;
                } else {
                  errors.push({ url, code: "navigation_failed", message: `HTTP ${statusCode} after ${retryCount} retries` });
                  return null;
                }
              }
              
              const html = await page.content();
              const title = await page.title();
              
              if (isBlockedContent(html, statusCode)) {
                const retryDelay = calculateRetryDelay(retryCount, protection.retryDelayBaseMs);
                logs.push(createCrawlLogEntry({ url, statusCode, retryCount, blockedSuspected: true, error: "content_blocked" }));
                
                if (retryCount < protection.maxRetryCount) {
                  retryCount++;
                  await new Promise((resolve) => setTimeout(resolve, retryDelay));
                  continue;
                }
              }
              
              if (!html || html.length < 100) {
                errors.push({ url, code: "content_empty", message: "Fetched page content is empty" });
                logs.push(createCrawlLogEntry({ url, statusCode: statusCode || 0, retryCount, blockedSuspected: false, error: "content_empty" }));
                return null;
              }
              
              logs.push(createCrawlLogEntry({ url, statusCode, retryCount, blockedSuspected: false }));
              
              const fetchedAt = new Date().toISOString();
              const payload = { url, title, html, fetchedAt, checkedAt: fetchedAt, fromCache: false, httpStatus: statusCode };
              await fs.writeFile(cachePath(url), JSON.stringify(payload, null, 2), "utf8");
              return payload;
            } catch (error) {
              lastError = String(error);
              const retryDelay = calculateRetryDelay(retryCount, protection.retryDelayBaseMs);
              
              logs.push(createCrawlLogEntry({ url, statusCode: lastStatusCode, retryCount, blockedSuspected: true, error: lastError }));
              
              if (retryCount < protection.maxRetryCount) {
                retryCount++;
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
                continue;
              }
              
              errors.push({
                url,
                code: lastError.includes("Timeout") ? "navigation_timeout" : "navigation_failed",
                message: lastError
              });
              return null;
            } finally {
              await page.close();
            }
          }
          
          return null;
        })
      );

      results.push(
        ...pages.filter(
          (page): page is NonNullable<typeof page> => page !== null
        )
      );

      for (const url of batch) {
        const domain = extractDomain(url);
        releaseDomainConcurrency(domain);
      }
    }

    await context.close();
    return { pages: results, errors, logs };
  } finally {
    await browser.close();
  }
}
