import type { CrawlFailure, CrawlPage } from "@/lib/types";

type FireCrawlOptions = {
  timeoutMs?: number;
  useCache?: boolean;
  forceRefresh?: boolean;
  cacheMaxAgeHours?: number;
  skipTlsVerification?: boolean;
};

type FireCrawlResponse = {
  success?: boolean;
  data?: {
    html?: string;
    rawHtml?: string;
    metadata?: {
      title?: string;
      sourceURL?: string;
      url?: string;
      statusCode?: number;
      error?: string;
    };
    warning?: string;
  };
  error?: string;
};

function buildFireCrawlFailure(url: string, code: CrawlFailure["code"], message: string): CrawlFailure {
  return { url, code, message };
}

export async function firecrawlScrape(url: string, options: FireCrawlOptions = {}): Promise<{
  page?: CrawlPage;
  error?: CrawlFailure;
}> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return {
      error: buildFireCrawlFailure(url, "navigation_failed", "firecrawl_api_key_missing")
    };
  }

  const timeoutMs = options.timeoutMs ?? 30000;
  const cacheMaxAgeHours = options.cacheMaxAgeHours ?? 24;

  try {
    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      signal: AbortSignal.timeout(timeoutMs + 5000),
      body: JSON.stringify({
        url,
        formats: ["html"],
        onlyMainContent: false,
        timeout: timeoutMs,
        maxAge: options.forceRefresh ? 0 : cacheMaxAgeHours * 60 * 60 * 1000,
        storeInCache: options.useCache ?? true,
        removeBase64Images: true,
        blockAds: true,
        proxy: "auto",
        skipTlsVerification: options.skipTlsVerification ?? false
      })
    });

    const payload = (await response.json().catch(() => ({}))) as FireCrawlResponse;
    if (!response.ok || !payload.success) {
      const message = payload.error || payload.data?.metadata?.error || `firecrawl_http_${response.status}`;
      return {
        error: buildFireCrawlFailure(url, "navigation_failed", message)
      };
    }

    const html = payload.data?.rawHtml || payload.data?.html || "";
    if (!html || html.length < 100) {
      return {
        error: buildFireCrawlFailure(url, "content_empty", "firecrawl_content_empty")
      };
    }

    const fetchedAt = new Date().toISOString();
    return {
      page: {
        url: payload.data?.metadata?.sourceURL || payload.data?.metadata?.url || url,
        title: payload.data?.metadata?.title || "",
        html,
        fetchedAt,
        checkedAt: fetchedAt,
        fromCache: false,
        httpStatus: payload.data?.metadata?.statusCode ?? 200,
        fetchStrategy: "firecrawl",
        fallbackUsed: true,
        fallbackReason: null
      }
    };
  } catch (error) {
    return {
      error: buildFireCrawlFailure(
        url,
        String(error).includes("Timeout") ? "navigation_timeout" : "navigation_failed",
        `firecrawl_request_failed: ${error instanceof Error ? error.message : String(error)}`
      )
    };
  }
}
