import { cleanText } from "../clean/cleanText";
import { playwrightCrawl } from "../crawl/playwrightCrawl";

import type {
  BatchFetchAndCleanResult,
  BatchFetchRequest,
  CleanedData,
  FetchAndCleanError,
  FetchAndCleanOptions,
  FetchAndCleanResult
} from "./types";

function buildInvalidInput(companyName: string, message: string): FetchAndCleanResult {
  return {
    ok: false,
    company: companyName,
    stats: {
      requested: 0,
      fetched: 0,
      succeeded: 0,
      failed: 0,
      from_cache: 0,
      duration_ms: 0
    },
    results: [],
    errors: [
      {
        code: "invalid_input",
        message
      }
    ]
  };
}

export async function fetchAndClean(
  companyName: string,
  urls: string[],
  keywords: string[],
  options: FetchAndCleanOptions = {}
): Promise<FetchAndCleanResult> {
  const startedAt = Date.now();
  if (!companyName.trim()) {
    return buildInvalidInput(companyName, "companyName is required");
  }
  if (!urls.length) {
    return buildInvalidInput(companyName, "urls is required");
  }

  const crawl = await playwrightCrawl(urls, options);
  const results: CleanedData[] = [];
  const errors: FetchAndCleanError[] = crawl.errors.map((error) => ({
    url: error.url,
    code: error.code,
    message: error.message
  }));

  for (const page of crawl.pages) {
    try {
      const cleaned = cleanText(page.html, keywords, page.url);
      results.push({
        url: page.url,
        company: companyName,
        title: page.title,
        clean_text: cleaned.text,
        matched_keywords: cleaned.matchedKeywords,
        fetched_at: page.fetchedAt,
        extracted_items: cleaned.extractedItems ?? [],
        canonical_url: cleaned.canonicalUrl ?? null,
        published_at: cleaned.publishedAt ?? null,
        page_kind: cleaned.pageKind ?? "detail",
        completeness_score: cleaned.completenessScore ?? 0,
        meta: {
          from_cache: page.fromCache ?? false,
          text_length: cleaned.text.length
        }
      });
    } catch (error) {
      errors.push({
        url: page.url,
        code: "clean_failed",
        message: String(error)
      });
    }
  }

  return {
    ok: results.length > 0,
    company: companyName,
    stats: {
      requested: urls.length,
      fetched: crawl.pages.length,
      succeeded: results.length,
      failed: errors.length,
      from_cache: results.filter((item) => item.meta.from_cache).length,
      duration_ms: Date.now() - startedAt
    },
    results,
    errors: results.length ? errors : errors.length ? errors : [{ code: "all_failed", message: "All URLs failed" }]
  };
}

export async function fetchAndCleanBatch(requests: BatchFetchRequest[]): Promise<BatchFetchAndCleanResult> {
  const startedAt = Date.now();
  const batches: FetchAndCleanResult[] = [];

  for (const request of requests) {
    batches.push(await fetchAndClean(request.companyName, request.urls, request.keywords, request.options));
  }

  return {
    ok: batches.every((batch) => batch.ok),
    total: batches.length,
    succeeded: batches.filter((batch) => batch.ok).length,
    failed: batches.filter((batch) => !batch.ok).length,
    duration_ms: Date.now() - startedAt,
    batches
  };
}
