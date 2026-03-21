/**
 * 智能爬取模块 - Intelligent Crawl
 * 
 * 三层策略：
 * - Tier 1 (官方): Jina Reader → Firecrawl
 * - Tier 2 (媒体): Jina Reader → Firecrawl
 * - Tier 3 (专业): Jina Reader → Firecrawl → Tavily发现 + Jina提取
 * 
 * 集成到 runCrawlJob.ts 作为智能爬取备选
 */

import https from "https";
import type { CrawlPage } from "@/lib/types";

const TAVILY_KEY = process.env.TAVILY_API_KEY;
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;
const TIMEOUT_MS = 25000;
import { playwrightDateExtract } from "./playwrightDateExtract";

// ============================================================================
// Jina Reader - 内容提取 (主力)
// ============================================================================

interface JinaResult {
  title: string;
  url: string;
  content: string;
  publishedTime?: string;
  error?: string;
}

export async function jinaExtract(url: string): Promise<JinaResult> {
  return new Promise((resolve) => {
    const req = https.get(
      `https://r.jina.ai/${encodeURIComponent(url)}`,
      { headers: { Accept: "text/plain" } },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const lines = body.split("\n");
            let title = "",
              sourceUrl = "",
              publishedTime = "",
              contentStart = 0;

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (line.startsWith("Title:")) {
                title = line.substring(6).trim();
              } else if (line.startsWith("URL Source:")) {
                sourceUrl = line.substring(11).trim();
              } else if (line.startsWith("Published Time:")) {
                publishedTime = line.substring(15).trim();
              } else if (line.startsWith("Markdown Content:")) {
                contentStart = i + 1;
                break;
              }
            }

            resolve({
              title: title || sourceUrl || url,
              url: sourceUrl || url,
              content: lines.slice(contentStart).join("\n").trim(),
              publishedTime,
            });
          } catch (e) {
            resolve({ title: url, url, content: "", error: String(e) });
          }
        });
      }
    );
    req.on("error", (e) => resolve({ title: url, url, content: "", error: e.message }));
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      resolve({ title: url, url, content: "", error: "Timeout" });
    });
  });
}

// ============================================================================
// Firecrawl - 备选提取
// ============================================================================

interface FirecrawlResult {
  title: string;
  content: string;
  url: string;
  publishedTime?: string;
  error?: string;
}

export async function firecrawlExtract(url: string): Promise<FirecrawlResult> {
  if (!FIRECRAWL_KEY) {
    return { title: url, content: "", url, error: "No API key" };
  }

  try {
    const response = await fetch("https://api.firecrawl.dev/v0/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FIRECRAWL_KEY}`,
      },
      body: JSON.stringify({ url, pageOptions: { onlyMainContent: true } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      return { title: url, content: "", url, error: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return { title: url, content: "", url, error: data.error || "Firecrawl failed" };
    }

    return {
      title: data.data?.metadata?.title || url,
      content: data.data?.markdown || data.data?.content || "",
      url: data.data?.metadata?.url || url,
      publishedTime: data.data?.metadata?.publishDate || data.data?.metadata?.publishedTime,
    };
  } catch (e) {
    return { title: url, content: "", url, error: String(e) };
  }
}

// ============================================================================
// Tavily Search - 专业机构内容发现
// ============================================================================

interface TavilyResult {
  url: string;
  title: string;
  published_date?: string;
  score: number;
}

export async function tavilySearch(query: string, maxResults = 5): Promise<TavilyResult[]> {
  if (!TAVILY_KEY) {
    console.log("[Tavily] No API key");
    return [];
  }

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      api_key: TAVILY_KEY,
      query,
      search_depth: "advanced",
      max_results: maxResults,
    });

    const req = https.request(
      {
        hostname: "api.tavily.com",
        path: "/search",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const result = JSON.parse(body);
            resolve(
              (result.results || []).map((r: any) => ({
                title: r.title || "",
                url: r.url || "",
                published_date: r.published_date,
                score: r.score || 0,
              }))
            );
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ============================================================================
// 智能爬取 - 根据来源类型选择策略
// ============================================================================

export type IntelligentSourceType = "official" | "media" | "professional";

export type IntelligentCrawlMethod = "jina" | "firecrawl" | "tavily+jina" | "playwright_date" | "failed";

export interface IntelligentCrawlResult {
  success: boolean;
  page?: CrawlPage;
  method: IntelligentCrawlMethod | `playwright_date[${string}]`;
  error?: string;
  discoveredUrls?: TavilyResult[];
}

/**
 * 智能爬取函数
 * @param url 要爬取的URL
 * @param sourceType 来源类型: official/media/professional
 * @param searchKeyword 用于Tavily发现的关键词（专业机构用）
 * @param companyWebsite 公司官网（用于域名校验）
 */
export async function intelligentCrawl(
  url: string,
  sourceType: IntelligentSourceType = "official",
  searchKeyword?: string,
  companyWebsite?: string
): Promise<IntelligentCrawlResult> {
  // 策略A: Jina Reader
  const jinaResult = await jinaExtract(url);

  if (jinaResult.content && jinaResult.content.length > 200) {
    // Jina成功：检查日期，若无则 Playwright 补提
    const jinaUrl = jinaResult.url || url;
    let publishedTime = jinaResult.publishedTime || undefined;
    let htmlContent = jinaResult.content;
    let pageTitle = jinaResult.title;

    // Jina 无日期 → Playwright 补提（对付 JS 渲染站）
    if (!publishedTime) {
      try {
        const pwResult = await playwrightDateExtract(jinaUrl);
        if (pwResult.success && pwResult.date) {
          publishedTime = pwResult.date;
          if (pwResult.html) htmlContent = pwResult.html;
          if (pwResult.title) pageTitle = pwResult.title;
          const page: CrawlPage = {
            url: jinaUrl,
            title: pageTitle,
            html: htmlContent,
            fetchedAt: new Date().toISOString(),
            checkedAt: new Date().toISOString(),
            fromCache: false,
            httpStatus: 200,
            fetchStrategy: "playwright_date",
            fallbackUsed: true,
            fallbackReason: "jina_no_date",
            publishedTime,
          };
          return { success: true, page, method: `playwright_date[${pwResult.method}]` };
        }
      } catch { /* Playwright 失败，继续用 Jina 结果 */ }
    }

    const page: CrawlPage = {
      url: jinaUrl,
      title: pageTitle,
      html: htmlContent,
      fetchedAt: new Date().toISOString(),
      checkedAt: new Date().toISOString(),
      fromCache: false,
      httpStatus: 200,
      fetchStrategy: publishedTime ? "jina" : "jina",
      fallbackUsed: false,
      fallbackReason: null,
      publishedTime,
    };

    return {
      success: true,
      page,
      method: "jina",
    };
  }

  // 策略B: Firecrawl备选
  const fcResult = await firecrawlExtract(url);

  if (fcResult.content && fcResult.content.length > 200) {
    const fcUrl = fcResult.url || url;
    let publishedTime = fcResult.publishedTime || undefined;
    let htmlContent = fcResult.content;
    let pageTitle = fcResult.title;

    // Firecrawl 无日期 → Playwright 补提
    if (!publishedTime) {
      try {
        const pwResult = await playwrightDateExtract(fcUrl);
        if (pwResult.success && pwResult.date) {
          publishedTime = pwResult.date;
          if (pwResult.html) htmlContent = pwResult.html;
          if (pwResult.title) pageTitle = pwResult.title;
          const page: CrawlPage = {
            url: fcUrl,
            title: pageTitle,
            html: htmlContent,
            fetchedAt: new Date().toISOString(),
            checkedAt: new Date().toISOString(),
            fromCache: false,
            httpStatus: 200,
            fetchStrategy: "playwright_date",
            fallbackUsed: true,
            fallbackReason: "firecrawl_no_date",
            publishedTime,
          };
          return { success: true, page, method: `playwright_date[${pwResult.method}]` };
        }
      } catch { /* Playwright 失败 */ }
    }

    const page: CrawlPage = {
      url: fcUrl,
      title: pageTitle,
      html: htmlContent,
      fetchedAt: new Date().toISOString(),
      checkedAt: new Date().toISOString(),
      fromCache: false,
      httpStatus: 200,
      fetchStrategy: "firecrawl",
      fallbackUsed: true,
      fallbackReason: "jina_failed",
      publishedTime,
    };

    return {
      success: true,
      page,
      method: "firecrawl",
    };
  }

  // 策略C: 专业机构使用Tavily发现
  if (sourceType === "professional" && searchKeyword) {
    const tavilyResults = await tavilySearch(searchKeyword, 5);

    if (tavilyResults.length > 0) {
      for (const result of tavilyResults) {
        if (result.url && isValidUrl(result.url)) {
          if (companyWebsite && !isSameDomain(result.url, companyWebsite)) {
            continue;
          }

          const jinaFromTavily = await jinaExtract(result.url);
          if (jinaFromTavily.content && jinaFromTavily.content.length > 200) {
            const tUrl = jinaFromTavily.url || result.url;
            let publishedTime = jinaFromTavily.publishedTime || result.published_date || undefined;
            let htmlContent = jinaFromTavily.content;
            let pageTitle = jinaFromTavily.title || result.title;

            // 无日期 → Playwright 补提
            if (!publishedTime) {
              try {
                const pwResult = await playwrightDateExtract(tUrl);
                if (pwResult.success && pwResult.date) {
                  publishedTime = pwResult.date;
                  if (pwResult.html) htmlContent = pwResult.html;
                  if (pwResult.title) pageTitle = pwResult.title;
                  const page: CrawlPage = {
                    url: tUrl,
                    title: pageTitle,
                    html: htmlContent,
                    fetchedAt: new Date().toISOString(),
                    checkedAt: new Date().toISOString(),
                    fromCache: false,
                    httpStatus: 200,
                    fetchStrategy: "playwright_date",
                    fallbackUsed: true,
                    fallbackReason: "tavily_jina_no_date",
                    publishedTime,
                  };
                  return { success: true, page, method: "playwright_date[tavily+jina]", discoveredUrls: tavilyResults };
                }
              } catch { /* noop */ }
            }

            const page: CrawlPage = {
              url: tUrl,
              title: pageTitle,
              html: htmlContent,
              fetchedAt: new Date().toISOString(),
              checkedAt: new Date().toISOString(),
              fromCache: false,
              httpStatus: 200,
              fetchStrategy: "tavily+jina",
              fallbackUsed: true,
              fallbackReason: "tavily_discovery",
              publishedTime,
            };

            return {
              success: true,
              page,
              method: "tavily+jina",
              discoveredUrls: tavilyResults,
            };
          }
        }
      }

      // 如果发现了但都没成功提取
      return {
        success: false,
        method: "failed",
        error: `Tavily发现${tavilyResults.length}个URL但都无法提取内容`,
        discoveredUrls: tavilyResults,
      };
    }
  }

  // 全部失败
  return {
    success: false,
    method: "failed",
    error: `Jina: ${jinaResult.error || "内容太短"}, Firecrawl: ${fcResult.error || "内容太短"}`,
  };
}

// ============================================================================
// 工具函数
// ============================================================================

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return url.startsWith("http://") || url.startsWith("https://");
  } catch {
    return false;
  }
}

function isSameDomain(url1: string, url2: string): boolean {
  try {
    const host1 = new URL(url1).hostname.replace(/^www\./, "").toLowerCase();
    const host2 = new URL(url2).hostname.replace(/^www\./, "").toLowerCase();
    return host1 === host2 || host1.endsWith("." + host2) || host2.endsWith("." + host1);
  } catch {
    return false;
  }
}

// ============================================================================
// 批量智能爬取
// ============================================================================

export interface BatchCrawlResult {
  pages: CrawlPage[];
  errors: Array<{ url: string; error: string }>;
  methods: Record<string, IntelligentCrawlMethod | `playwright_date[${string}]`>;
}

/**
 * 批量智能爬取
 */
export async function batchIntelligentCrawl(
  urls: string[],
  sourceType: IntelligentSourceType = "official",
  searchKeyword?: string,
  companyWebsite?: string
): Promise<BatchCrawlResult> {
  const pages: CrawlPage[] = [];
  const errors: Array<{ url: string; error: string }> = [];
  const methods: Record<string, IntelligentCrawlMethod | `playwright_date[${string}]`> = {};

  for (const url of urls) {
    const result = await intelligentCrawl(url, sourceType, searchKeyword, companyWebsite);

    if (result.success && result.page) {
      pages.push(result.page);
      methods[url] = result.method;
    } else {
      errors.push({ url, error: result.error || "Unknown error" });
      methods[url] = result.method;
    }

    // 每个URL之间延迟500ms，避免请求过快
    await new Promise((r) => setTimeout(r, 500));
  }

  return { pages, errors, methods };
}
