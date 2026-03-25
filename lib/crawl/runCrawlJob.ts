import { deepSeekAnalyze } from "@/lib/analyze/deepSeek";
import { cleanText } from "@/lib/clean/cleanText";
import { evaluateSourceQuality } from "@/lib/evaluate/sourceQuality";
import { evaluateSourceResult } from "@/lib/evaluation";
import {
  createCrawlJob,
  createCrawlJobStep,
  createLlmRun,
  createSourceRegistryRecord,
  createSourceVersion,
  finalizeCrawlJob,
  finalizeCrawlJobStep,
  getCompanyDetails,
  getEnabledSourceRegistry,
  loadCompanies,
  syncCompanies,
  updateSourceRegistryEvaluation,
  upsertDocument,
  upsertInsight,
  upsertSourceRegistryStatus
} from "@/lib/db/repository";
import { resolveCompanyUrls } from "@/lib/search/searchUrls";
import type { ExtractedItem, SourceRegistryRecord, TriggerType, UrlType } from "@/lib/types";
import { intelligentCrawl, batchIntelligentCrawl, type IntelligentSourceType } from "@/lib/crawl/intelligentCrawl";
import { playwrightCrawl } from "@/lib/crawl/playwrightCrawl";
import { parseGasgooFlashPage, isGasgooFlashPage, type GasgooFlashItem } from "@/lib/extract/gasgooFlash";

type RunCrawlJobOptions = {
  companyId?: string;
  triggerType?: TriggerType;
  useCache?: boolean;
  forceRefresh?: boolean;
  cacheMaxAgeHours?: number;
};

const MIN_EFFECTIVE_DATE = "2026-01-01";

function isEffectivePublishedDate(publishedAt: string | null | undefined): boolean {
  if (!publishedAt) return false;
  const dateStr = publishedAt.slice(0, 10);
  return dateStr >= MIN_EFFECTIVE_DATE;
}

function shouldRunLlm(input: {
  pageKind?: "list" | "detail";
  completenessScore?: number;
  cleanText: string;
  publishedAt?: string | null;
}) {
  const pageKind = input.pageKind ?? "detail";
  const completenessScore = input.completenessScore ?? 0;
  const cleanTextLength = input.cleanText.trim().length;

  if (!isEffectivePublishedDate(input.publishedAt)) {
    return false;
  }

  return pageKind === "detail" && completenessScore >= 0.75 && cleanTextLength >= 400;
}

function normalizeQueueUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|spm|from|source|fbclid|gclid|mkt_tok)/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function matchesAllowedHostname(candidateUrl: string, companyWebsite: string, sourceUrl: string) {
  try {
    const candidateHost = new URL(candidateUrl).hostname.replace(/^www\./, "");
    const sourceHost = new URL(sourceUrl).hostname.replace(/^www\./, "");
    const companyHost = new URL(companyWebsite || sourceUrl).hostname.replace(/^www\./, "");
    return candidateHost === sourceHost || candidateHost === companyHost;
  } catch {
    return false;
  }
}

function inferDiscoveredUrlType(parentUrlType: UrlType, item: ExtractedItem, url: string): UrlType {
  const text = `${item.title} ${item.summary ?? ""} ${url}`.toLowerCase();
  if (/(news|press|blog|media|story|stories|release|新闻|动态|资讯|发布)/.test(text)) {
    return "news";
  }
  if (/(product|solution|产品|方案)/.test(text)) {
    return "product";
  }
  if (/(partner|ecosystem|合作|伙伴|生态)/.test(text)) {
    return "ecosystem";
  }
  if (/(career|job|招聘)/.test(text)) {
    return "jobs";
  }
  return parentUrlType === "general" ? "news" : parentUrlType;
}

function discoverDetailCandidates(input: {
  companyWebsite: string;
  source: { url: string; url_type: UrlType };
  extractedItems?: ExtractedItem[];
  seenUrls: Set<string>;
}) {
  const candidates: Array<{ url: string; urlType: UrlType; title: string }> = [];

  for (const item of input.extractedItems ?? []) {
    if (!item.url) {
      continue;
    }
    const normalizedUrl = normalizeQueueUrl(item.url);
    if (!normalizedUrl || normalizedUrl === normalizeQueueUrl(input.source.url)) {
      continue;
    }
    if (input.seenUrls.has(normalizedUrl)) {
      continue;
    }
    if (!matchesAllowedHostname(normalizedUrl, input.companyWebsite, input.source.url)) {
      continue;
    }
    if (!isUrlDateEffective(normalizedUrl)) {
      continue;
    }
    candidates.push({
      url: normalizedUrl,
      urlType: inferDiscoveredUrlType(input.source.url_type, item, normalizedUrl),
      title: item.title
    });
  }

  return candidates.slice(0, 8);
}

function extractDateFromUrl(url: string): string | null {
  const patterns = [
    /\/(\d{4})-(\d{2})-(\d{2})[\/\-]/,
    /\/(\d{4})\/(\d{1,2})\/(\d{1,2})[\/\-]/,
    /\/(\d{4})(\d{2})(\d{2})[\/\-]/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) {
      const [, y, mo, d] = m;
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  return null;
}

function isUrlDateEffective(url: string): boolean {
  const urlDate = extractDateFromUrl(url);
  if (!urlDate) return true;
  return urlDate >= MIN_EFFECTIVE_DATE;
}

function shouldExpandDiscoveredLinks(input: {
  pageKind?: "list" | "detail";
  extractedItems?: ExtractedItem[];
}) {
  if ((input.pageKind ?? "detail") === "list") {
    return true;
  }

  return (input.extractedItems ?? []).some((item) => {
    const value = `${item.url ?? ""} ${item.title} ${item.summary ?? ""}`.toLowerCase();
    return /(news|press|media|blog|story|stories|case|customer|partner|cooperation|合作|案例|动态|资讯)/.test(value);
  });
}

export async function runCrawlJob(options: RunCrawlJobOptions = {}) {
  const companies = loadCompanies();
  syncCompanies(companies);

  const triggerType = options.triggerType ?? "manual";
  const targets = options.companyId ? companies.filter((company) => company.id === options.companyId) : companies;
  const targetCompanyIds = targets.map((company) => company.id);
  const urlCount = targets.reduce((count, company) => {
    const sourceRegistry = getEnabledSourceRegistry(company.id);
    return count + (sourceRegistry.length || resolveCompanyUrls(company).length);
  }, 0);

  const job = createCrawlJob({
    triggerType,
    companyCount: targets.length,
    urlCount,
    configSnapshot: {
      crawlTool: "Intelligent Crawl (Jina + Firecrawl + Tavily)",
      cleanTool: "Readability + Cheerio",
      llmProvider: process.env.DEEPSEEK_API_KEY ? "deepseek" : "fallback",
      llmModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      useCache: options.useCache ?? true,
      forceRefresh: options.forceRefresh ?? false,
      cacheMaxAgeHours: options.cacheMaxAgeHours ?? 24
    }
  });

  let successCount = 0;
  let failureCount = 0;
  let cacheHitCount = 0;
  let changedCount = 0;
  let insightCount = 0;
  let createdStepCount = 0;
  const processedCompanyIds = new Set<string>();

  function createTrackedStep(input: Parameters<typeof createCrawlJobStep>[0]) {
    const step = createCrawlJobStep(input);
    createdStepCount += 1;
    if (input.companyId) {
      processedCompanyIds.add(input.companyId);
    }
    return step;
  }

  for (const company of targets) {
    const sourceRegistry = getEnabledSourceRegistry(company.id);
    const fallbackUrls = resolveCompanyUrls(company).map((url) => ({
      url,
      company_id: company.id,
      url_type: "general" as UrlType,
      keywords_json: JSON.stringify(company.keywords),
      cache_ttl_hours: 24,
      allow_cache: 1
    }));
    const sources = sourceRegistry.length ? sourceRegistry : fallbackUrls;
    const queue: Array<SourceRegistryRecord | (typeof fallbackUrls)[number]> = [...sources];
    const seenUrls = new Set(queue.map((item) => normalizeQueueUrl(item.url)));

    for (let sourceIndex = 0; sourceIndex < queue.length; sourceIndex += 1) {
      const source = queue[sourceIndex];
      try {
        const resolveStep = createTrackedStep({
          jobId: job.id,
          companyId: company.id,
          sourceUrl: source.url,
          stepName: "url_resolve",
          stepOrder: 1,
          toolType: "config",
          toolName: "source_registry",
          moduleName: "lib/search/searchUrls.ts",
          runtime: "node",
          inputJson: {
            company: company.name,
            url: source.url,
            url_type: source.url_type,
            useCache: options.useCache ?? true,
            forceRefresh: options.forceRefresh ?? false,
            cacheMaxAgeHours: source.cache_ttl_hours ?? options.cacheMaxAgeHours ?? 24
          },
          nextStep: "page_fetch"
        });
        finalizeCrawlJobStep({
          stepId: resolveStep.id,
          status: "success",
          outputJson: {
            resolved_url: source.url,
            url_type: source.url_type
          }
        });

        const fetchStep = createTrackedStep({
          jobId: job.id,
          companyId: company.id,
          sourceUrl: source.url,
          stepName: "page_fetch",
          stepOrder: 2,
          toolType: "crawler",
          toolName: "intelligent-crawl",
          moduleName: "lib/crawl/intelligentCrawl.ts",
          runtime: "node",
          inputJson: {
            url: source.url,
            useCache: source.allow_cache ? options.useCache ?? true : false,
            forceRefresh: options.forceRefresh ?? false,
            cacheMaxAgeHours: source.cache_ttl_hours ?? options.cacheMaxAgeHours ?? 24
          },
          nextStep: "html_capture"
        });

        // =========================================================
        // 智能爬取 (Jina → Firecrawl → Tavily发现)
        // =========================================================
        const sourceType: IntelligentSourceType = 
          source.url_type === "news" ? "media" : 
          source.url_type === "ecosystem" ? "professional" : "official";
        const searchKeyword = (company.keywords || []).join(" ");

        let intelligentResult: Awaited<ReturnType<typeof intelligentCrawl>> | null = null;
        let page = undefined;
        let gasgooFlashItems: GasgooFlashItem[] = [];

        if (isGasgooFlashPage(source.url)) {
          const pageNumbers = [1, 2, 3];
          const urlsToCrawl = pageNumbers.map(p => {
            if (p === 1) return source.url;
            return source.url.replace(/\/(\d+)$/, `/${p}`);
          });
          
          const crawlResult = await playwrightCrawl(urlsToCrawl, {
            useCache: options.useCache ?? true,
            forceRefresh: options.forceRefresh ?? false,
            cacheMaxAgeHours: source.cache_ttl_hours ?? options.cacheMaxAgeHours ?? 24
          });
          
          let allItems: GasgooFlashItem[] = [];
          let latestDate = "";
          let htmlContent = "";
          
          for (const rawPage of crawlResult.pages) {
            if (rawPage && rawPage.html && rawPage.html.length > 100) {
              const parsed = parseGasgooFlashPage(rawPage.html, source.url);
              allItems = allItems.concat(parsed.items);
              if (parsed.items.length > 0 && parsed.items[0].publishDate) {
                latestDate = parsed.items[0].publishDate;
              }
              if (!htmlContent) {
                htmlContent = rawPage.html;
              }
            }
          }
          
          if (allItems.length > 0) {
            gasgooFlashItems = allItems;
            page = {
              url: source.url,
              title: "盖世快讯",
              html: htmlContent,
              fetchedAt: new Date().toISOString(),
              checkedAt: new Date().toISOString(),
              fromCache: false,
              httpStatus: 200,
              fetchStrategy: "playwright",
              fallbackUsed: false,
              fallbackReason: null,
              publishedTime: latestDate || undefined
            };
          } else {
            intelligentResult = await intelligentCrawl(
              source.url,
              sourceType,
              searchKeyword,
              company.website
            );
            page = intelligentResult.success ? intelligentResult.page : undefined;
          }
        } else {
          intelligentResult = await intelligentCrawl(
            source.url,
            sourceType,
            searchKeyword,
            company.website
          );
          page = intelligentResult.success ? intelligentResult.page : undefined;
        }

        upsertSourceRegistryStatus({
          url: source.url,
          lastCheckedAt: new Date().toISOString()
        });

        if (!page) {
          updateSourceRegistryEvaluation({
            url: source.url,
            crawlMode: "invalid_source",
            evaluationStatus: "failed",
            evaluationScore: 10,
            evaluationReason: intelligentResult?.error || "crawl_failed",
            fixedReason: "爬取失败，来源需排查。",
            successRate: 0,
            noiseScore: 0.5,
            valueScore: 0.1,
            isFixed: false
          });
          finalizeCrawlJobStep({
            stepId: fetchStep.id,
            status: "failed",
            outputJson: { error: intelligentResult?.error || "crawl_failed" },
            errorMessage: `爬取失败: ${intelligentResult?.error || "unknown"}`
          });
          failureCount += 1;
          continue;
        }

        if (page.fromCache) {
          cacheHitCount += 1;
        }

        finalizeCrawlJobStep({
          stepId: fetchStep.id,
          status: "success",
          outputJson: {
            title: page.title,
            fetched_at: page.fetchedAt,
            checked_at: page.checkedAt,
            from_cache: page.fromCache,
            cache_age_hours: page.cacheAgeHours ?? null,
            fetch_strategy: page.fetchStrategy ?? "intelligent",
            fallback_used: page.fallbackUsed ?? false,
            fallback_reason: page.fallbackReason ?? null,
            intelligent_used: intelligentResult?.success ?? false
          }
        });

        const htmlStep = createTrackedStep({
          jobId: job.id,
          companyId: company.id,
          sourceUrl: source.url,
          stepName: "html_capture",
          stepOrder: 3,
          toolType: "crawler",
          toolName: isGasgooFlashPage(source.url) ? "playwright" : "jina-reader",
          moduleName: "lib/crawl/intelligentCrawl.ts",
          runtime: "node",
          inputJson: { html_length: page.html.length },
          nextStep: "clean_text"
        });
        finalizeCrawlJobStep({
          stepId: htmlStep.id,
          status: "success",
          outputJson: {
            title: page.title,
            html_length: page.html.length,
            http_status: page.httpStatus ?? 200,
            fetch_strategy: page.fetchStrategy ?? "jina"
          }
        });

        const isGasgooPage = isGasgooFlashPage(source.url);
        
        let cleanResult: ReturnType<typeof cleanText>;
        if (isGasgooPage && gasgooFlashItems.length > 0) {
          const extractedItemsForGasgoo: ExtractedItem[] = gasgooFlashItems.map(item => ({
            title: item.title,
            summary: item.content.slice(0, 280),
            date: item.publishDate,
            url: item.url
          }));
          const combinedText = gasgooFlashItems
            .map(item => `${item.title}\n${item.publishDate}\n${item.content}`)
            .join("\n\n");
          
          cleanResult = {
            text: combinedText,
            extractedItems: extractedItemsForGasgoo,
            pageKind: "list" as const,
            publishedAt: gasgooFlashItems[0]?.publishDate,
            completenessScore: 1,
            canonicalUrl: page.url,
            matchedKeywords: []
          };
        } else {
          cleanResult = cleanText(page.html, JSON.parse(source.keywords_json || "[]") as string[], page.url, page.publishedTime);
        }

        const cleanStep = createTrackedStep({
          jobId: job.id,
          companyId: company.id,
          sourceUrl: source.url,
          stepName: "clean_text",
          stepOrder: 4,
          toolType: "extractor",
          toolName: "readability+cheerio",
          moduleName: "lib/clean/cleanText.ts",
          runtime: "node",
          inputJson: { title: page.title, html_length: page.html.length },
          nextStep: "list_extract"
        });
        finalizeCrawlJobStep({
          stepId: cleanStep.id,
          status: "success",
          outputJson: {
            clean_text_preview: cleanResult.text.slice(0, 500),
            clean_text_length: cleanResult.text.length,
            canonical_url: cleanResult.canonicalUrl ?? null,
            published_at: cleanResult.publishedAt ?? null,
            page_kind: cleanResult.pageKind ?? "detail",
            completeness_score: cleanResult.completenessScore ?? 0
          }
        });

        const listStep = createTrackedStep({
          jobId: job.id,
          companyId: company.id,
          sourceUrl: source.url,
          stepName: "list_extract",
          stepOrder: 5,
          toolType: "extractor",
          toolName: "custom_list_extractor",
          moduleName: "lib/clean/cleanText.ts",
          runtime: "node",
          inputJson: { url_type: source.url_type },
          nextStep: "keyword_match"
        });
        finalizeCrawlJobStep({
          stepId: listStep.id,
          status: "success",
          outputJson: {
            extracted_items: cleanResult.extractedItems ?? [],
            extracted_count: cleanResult.extractedItems?.length ?? 0,
            extracted_urls: (cleanResult.extractedItems ?? []).map((item) => item.url).filter(Boolean)
          }
        });

        const detailDiscoveryStep = createTrackedStep({
          jobId: job.id,
          companyId: company.id,
          sourceUrl: source.url,
          stepName: "detail_discovery",
          stepOrder: 6,
          toolType: "router",
          toolName: "detail_link_expander",
          moduleName: "lib/crawl/runCrawlJob.ts",
          runtime: "node",
          inputJson: {
            page_kind: cleanResult.pageKind ?? "detail",
            extracted_count: cleanResult.extractedItems?.length ?? 0
          },
          nextStep: "keyword_match"
        });
        const discoveredCandidates = shouldExpandDiscoveredLinks({
          pageKind: cleanResult.pageKind,
          extractedItems: cleanResult.extractedItems
        })
          ? discoverDetailCandidates({
              companyWebsite: company.website,
              source: { url: source.url, url_type: source.url_type },
              extractedItems: cleanResult.extractedItems,
              seenUrls
            })
          : [];
        const queuedUrls: string[] = [];

        for (const candidate of discoveredCandidates) {
          try {
            const created = createSourceRegistryRecord({
              companyId: company.id,
              url: candidate.url,
              urlType: candidate.urlType,
              keywords: company.keywords,
              priority: 80,
              enabled: true,
              cacheTtlHours: source.cache_ttl_hours ?? 24,
              allowCache: true
            });
            queue.push(created);
            seenUrls.add(candidate.url);
            queuedUrls.push(candidate.url);
          } catch (error) {
            if (error instanceof Error && error.message === "duplicate_source_url") {
              seenUrls.add(candidate.url);
              continue;
            }
            throw error;
          }
        }

        finalizeCrawlJobStep({
          stepId: detailDiscoveryStep.id,
          status: "success",
          outputJson: {
            page_kind: cleanResult.pageKind ?? "detail",
            discovered_count: discoveredCandidates.length,
            queued_count: queuedUrls.length,
            queued_urls: queuedUrls
          }
        });

        const keywordStep = createTrackedStep({
          jobId: job.id,
          companyId: company.id,
          sourceUrl: source.url,
          stepName: "keyword_match",
          stepOrder: 7,
          toolType: "rule",
          toolName: "keyword_matcher",
          moduleName: "lib/clean/cleanText.ts",
          runtime: "node",
          inputJson: { configured_keywords: JSON.parse(source.keywords_json || "[]") },
          nextStep: "llm_analysis"
        });
        finalizeCrawlJobStep({
          stepId: keywordStep.id,
          status: "success",
          outputJson: {
            matched_keywords: cleanResult.matchedKeywords
          }
        });

        const { sourceId, documentId } = upsertDocument({
          companyId: company.id,
          url: page.url,
          title: page.title,
          fetchDate: page.fetchedAt,
          cleanText: cleanResult.text,
          matchedKeywords: cleanResult.matchedKeywords,
          extractedItems: cleanResult.extractedItems,
          canonicalUrl: cleanResult.canonicalUrl ?? undefined,
          publishedAt: cleanResult.publishedAt ?? undefined,
          pageKind: cleanResult.pageKind ?? undefined,
          completenessScore: cleanResult.completenessScore ?? undefined
        });

        const version = createSourceVersion({
          sourceId,
          htmlSnapshot: page.html,
          cleanText: cleanResult.text,
          extractedItems: cleanResult.extractedItems,
          canonicalUrl: cleanResult.canonicalUrl ?? undefined,
          fromCache: !!page.fromCache,
          pageKind: cleanResult.pageKind ?? undefined,
          completenessScore: cleanResult.completenessScore ?? undefined,
          checkedAt: page.checkedAt,
          fetchedAt: page.fromCache ? undefined : page.fetchedAt,
          publishedAt: cleanResult.publishedAt ?? undefined
        });

        if (version.isChanged) {
          changedCount += 1;
        }

        upsertSourceRegistryStatus({
          url: source.url,
          lastFetchedAt: page.fromCache ? undefined : page.fetchedAt,
          lastChangedAt: version.isChanged ? page.checkedAt : undefined,
          lastSuccessAt: page.checkedAt
        });

        const llmAllowed = shouldRunLlm({
          pageKind: cleanResult.pageKind,
          completenessScore: cleanResult.completenessScore,
          cleanText: cleanResult.text,
          publishedAt: cleanResult.publishedAt
        });
        const sourceQuality = evaluateSourceQuality({
          url: page.url,
          title: page.title,
          cleanText: cleanResult.text,
          extractedItems: cleanResult.extractedItems ?? [],
          publishedAt: cleanResult.publishedAt
        });

        const llmStep = createTrackedStep({
          jobId: job.id,
          companyId: company.id,
          sourceUrl: source.url,
          stepName: "llm_analysis",
          stepOrder: 8,
          toolType: "llm",
          toolName: process.env.DEEPSEEK_API_KEY ? "deepseek" : "fallback",
          moduleName: "lib/analyze/deepSeek.ts",
          runtime: "http",
          inputJson: {
            company: company.name,
            title: page.title,
            matched_keywords: cleanResult.matchedKeywords,
            prompt_version: "deepseek-v1"
          },
          nextStep: "json_structured"
        });

        if (!llmAllowed) {
          const evaluation = evaluateSourceResult({
            url: source.url,
            urlType: source.url_type,
            cleanText: cleanResult.text,
            matchedKeywords: cleanResult.matchedKeywords,
            extractedItemsCount: cleanResult.extractedItems?.length ?? 0,
            llmStatus: "skipped",
            llmProvider: "gated",
            fallbackUsed: false,
            summary: "",
            category: "",
            sourceExists: true
          });
          updateSourceRegistryEvaluation({
            url: page.url,
            crawlMode: evaluation.crawlMode,
            evaluationStatus: evaluation.status,
            evaluationScore: evaluation.totalScore,
            evaluationReason: evaluation.finalVerdict,
            fixedReason: evaluation.fixedReason,
            successRate: 1,
            noiseScore: sourceQuality.is_noise ? 1 : Math.max(0, Number((1 - (sourceQuality.quality_score / 100)).toFixed(2))),
            valueScore: Number((sourceQuality.quality_score / 100).toFixed(2)),
            isFixed: evaluation.status === "fixed"
          });

          finalizeCrawlJobStep({
            stepId: llmStep.id,
            status: "skipped",
            outputJson: {
              skipped_reason: "evidence_gate_not_met",
              page_kind: cleanResult.pageKind ?? "detail",
              completeness_score: cleanResult.completenessScore ?? 0,
              clean_text_length: cleanResult.text.length
            }
          });

          const jsonStep = createTrackedStep({
            jobId: job.id,
            companyId: company.id,
            sourceUrl: source.url,
            stepName: "json_structured",
            stepOrder: 9,
            toolType: "llm",
            toolName: "json_parser",
            moduleName: "lib/analyze/deepSeek.ts",
            runtime: "node",
            inputJson: {
              skipped_from: "llm_analysis",
              reason: "evidence_gate_not_met"
            },
            nextStep: "database_upsert"
          });
          finalizeCrawlJobStep({
            stepId: jsonStep.id,
            status: "skipped",
            outputJson: {
              parsed_json: null,
              skipped_reason: "evidence_gate_not_met"
            }
          });

          const dbStep = createTrackedStep({
            jobId: job.id,
            companyId: company.id,
            sourceUrl: source.url,
            stepName: "database_upsert",
            stepOrder: 10,
            toolType: "database",
            toolName: "sqlite",
            moduleName: "lib/db/repository.ts",
            runtime: "node:sqlite",
            inputJson: { source_id: sourceId, document_id: documentId },
            nextStep: "aggregate_display"
          });
          finalizeCrawlJobStep({
            stepId: dbStep.id,
            status: "success",
            outputJson: {
              source_id: sourceId,
              document_id: documentId,
              changed: version.isChanged,
              llm_skipped: true
            }
          });

          const aggregateStep = createTrackedStep({
            jobId: job.id,
            companyId: company.id,
            sourceUrl: source.url,
            stepName: "aggregate_display",
            stepOrder: 11,
            toolType: "query",
            toolName: "dashboard_projection",
            moduleName: "lib/db/repository.ts",
            runtime: "node",
            inputJson: { company_id: company.id, source_url: source.url }
          });
          finalizeCrawlJobStep({
            stepId: aggregateStep.id,
            status: "success",
            outputJson: {
              latest_fetch_date: page.fetchedAt,
              insight_generated_at: null,
              llm_skipped: true
            }
          });

          successCount += 1;
          continue;
        }

        const llmResult = await deepSeekAnalyze({
          company: company.name,
          title: page.title,
          text: cleanResult.text,
          keywords: cleanResult.matchedKeywords
        });
        const evaluation = evaluateSourceResult({
          url: source.url,
          urlType: source.url_type,
          cleanText: cleanResult.text,
          matchedKeywords: cleanResult.matchedKeywords,
          extractedItemsCount: cleanResult.extractedItems?.length ?? 0,
          llmStatus: llmResult.status,
          llmProvider: llmResult.provider,
          fallbackUsed: llmResult.fallback_used,
          summary: llmResult.summary,
          category: llmResult.category,
          sourceExists: true
        });
        updateSourceRegistryEvaluation({
          url: page.url,
          crawlMode: evaluation.crawlMode,
          evaluationStatus: evaluation.status,
          evaluationScore: evaluation.totalScore,
          evaluationReason: evaluation.finalVerdict,
          fixedReason: evaluation.fixedReason,
          successRate: 1,
          noiseScore: sourceQuality.is_noise ? 1 : Math.max(0, Number((1 - (sourceQuality.quality_score / 100)).toFixed(2))),
          valueScore: Number((sourceQuality.quality_score / 100).toFixed(2)),
          isFixed: evaluation.status === "fixed"
        });

        createLlmRun({
          jobId: job.id,
          stepId: llmStep.id,
          documentId,
          provider: llmResult.provider,
          modelName: llmResult.model_name,
          promptVersion: llmResult.prompt_version,
          inputPayload: llmResult.input_payload,
          rawResponse: llmResult.raw_response,
          parsedJson: llmResult.parsed_json,
          fallbackUsed: llmResult.fallback_used,
          retryCount: llmResult.retry_count,
          durationMs: llmResult.duration_ms,
          status: llmResult.status,
          errorMessage: llmResult.error_message
        });

        finalizeCrawlJobStep({
          stepId: llmStep.id,
          status: llmResult.status === "failed" ? "failed" : llmResult.fallback_used ? "fallback" : "success",
          outputJson: {
            provider: llmResult.provider,
            model_name: llmResult.model_name,
            summary: llmResult.summary,
            category: llmResult.category,
            fallback_used: llmResult.fallback_used
          },
          errorMessage: llmResult.error_message,
          retryCount: llmResult.retry_count,
          fallbackUsed: llmResult.fallback_used
        });

        const jsonStep = createTrackedStep({
          jobId: job.id,
          companyId: company.id,
          sourceUrl: source.url,
          stepName: "json_structured",
          stepOrder: 9,
          toolType: "llm",
          toolName: "json_parser",
          moduleName: "lib/analyze/deepSeek.ts",
          runtime: "node",
          inputJson: { raw_response_length: llmResult.raw_response.length },
          nextStep: "database_upsert"
        });
        finalizeCrawlJobStep({
          stepId: jsonStep.id,
          status: llmResult.status === "failed" ? "fallback" : "success",
          outputJson: {
            parsed_json: llmResult.parsed_json
          },
          fallbackUsed: llmResult.fallback_used
        });

        upsertInsight(documentId, llmResult);
        insightCount += 1;

        const dbStep = createTrackedStep({
          jobId: job.id,
          companyId: company.id,
          sourceUrl: source.url,
          stepName: "database_upsert",
          stepOrder: 10,
          toolType: "database",
          toolName: "sqlite",
          moduleName: "lib/db/repository.ts",
          runtime: "node:sqlite",
          inputJson: { source_id: sourceId, document_id: documentId },
          nextStep: "aggregate_display"
        });
        finalizeCrawlJobStep({
          stepId: dbStep.id,
          status: "success",
          outputJson: {
            source_id: sourceId,
            document_id: documentId,
            changed: version.isChanged
          }
        });

        const aggregateStep = createTrackedStep({
          jobId: job.id,
          companyId: company.id,
          sourceUrl: source.url,
          stepName: "aggregate_display",
          stepOrder: 11,
          toolType: "query",
          toolName: "dashboard_projection",
          moduleName: "lib/db/repository.ts",
          runtime: "node",
          inputJson: { company_id: company.id, source_url: source.url }
        });
        finalizeCrawlJobStep({
          stepId: aggregateStep.id,
          status: "success",
          outputJson: {
            latest_fetch_date: page.fetchedAt,
            insight_generated_at: new Date().toISOString()
          }
        });

        successCount += 1;
      } catch (error) {
        failureCount += 1;
        const failedStep = createTrackedStep({
          jobId: job.id,
          companyId: company.id,
          sourceUrl: source.url,
          stepName: "unhandled_error",
          stepOrder: 99,
          toolType: "runtime",
          toolName: "job_runner",
          moduleName: "lib/crawl/runCrawlJob.ts",
          runtime: "node",
          inputJson: { url: source.url }
        });
        finalizeCrawlJobStep({
          stepId: failedStep.id,
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  finalizeCrawlJob(job.id, {
    status: failureCount ? (successCount ? "partial" : "failed") : "success",
    successCount,
    failureCount,
    cacheHitCount,
    changedCount,
    insightCount
  });

  return {
    ok: failureCount === 0,
    jobId: job.id,
    targetCompanyIds,
    targetCompanyCount: targetCompanyIds.length,
    processedCompanies: Array.from(processedCompanyIds),
    createdStepCount,
    successCount,
    failureCount,
    cacheHitCount,
    changedCount,
    insightCount,
    preview: options.companyId ? getCompanyDetails(options.companyId) : null
  };
}
