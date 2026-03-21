import type { NextApiRequest, NextApiResponse } from "next";

import { deepSeekAnalyze } from "@/lib/analyze/deepSeek";
import { cleanText } from "@/lib/clean/cleanText";
import { playwrightCrawl } from "@/lib/crawl/playwrightCrawl";
import {
  createLlmRun,
  createSourceVersion,
  getSourceManagerData,
  getSourceRegistryRecord,
  loadCompanies,
  syncCompanies,
  upsertDocument,
  upsertInsight,
  updateSourceRegistryEvaluation,
  upsertSourceRegistryStatus
} from "@/lib/db/repository";
import { evaluateSourceResult } from "@/lib/evaluation";
import type { FetchAndCleanResult } from "@/lib/skill/types";

type TestSourceResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  registry?: {
    id: number;
    url: string;
    url_type: string;
    cache_ttl_hours: number;
    allow_cache: number;
  };
  company?: {
    id: string;
    name: string;
    website: string;
    keywords: string[];
  };
  fetch?: FetchAndCleanResult;
  llm?: Awaited<ReturnType<typeof deepSeekAnalyze>> | null;
  evidence_gate?: {
    passed: boolean;
    page_kind: string;
    completeness_score: number;
    clean_text_length: number;
  };
};

function shouldRunLlm(input: {
  pageKind?: "list" | "detail";
  completenessScore?: number;
  cleanText: string;
}) {
  return (input.pageKind ?? "detail") === "detail" && (input.completenessScore ?? 0) >= 0.75 && input.cleanText.trim().length >= 400;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<TestSourceResponse>) {
  syncCompanies(loadCompanies());

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const body = req.body as {
    sourceId?: number;
    useCache?: boolean;
    forceRefresh?: boolean;
    cacheMaxAgeHours?: number;
    persist?: boolean;
  };

  if (!body.sourceId || Number.isNaN(Number(body.sourceId))) {
    return res.status(400).json({ ok: false, error: "missing_source_id" });
  }

  const sourceId = Number(body.sourceId);
  const registry = getSourceRegistryRecord(sourceId);
  if (!registry || registry.deleted_at) {
    return res.status(404).json({ ok: false, error: "source_not_found" });
  }

  const sourceManagerData = getSourceManagerData();
  const company = sourceManagerData.companies.find((item) => item.id === registry.company_id);
  if (!company) {
    return res.status(404).json({ ok: false, error: "company_not_found" });
  }

  try {
    const keywords = registry.keywords_json ? JSON.parse(registry.keywords_json) : company.keywords;
    const useCache = typeof body.useCache === "boolean" ? body.useCache : registry.allow_cache === 1;
    const forceRefresh = typeof body.forceRefresh === "boolean" ? body.forceRefresh : false;
    const cacheMaxAgeHours = typeof body.cacheMaxAgeHours === "number" ? body.cacheMaxAgeHours : registry.cache_ttl_hours;
    const persist = typeof body.persist === "boolean" ? body.persist : true;

    const crawl = await playwrightCrawl([registry.url], {
      concurrency: 1,
      useCache,
      forceRefresh,
      cacheMaxAgeHours
    });

    const page = crawl.pages[0];
    const fetch: FetchAndCleanResult = page
      ? (() => {
          const startedAt = Date.now();
          const cleaned = cleanText(page.html, keywords, page.url);

          return {
            ok: true,
            company: company.name,
            stats: {
              requested: 1,
              fetched: 1,
              succeeded: 1,
              failed: crawl.errors.length,
              from_cache: page.fromCache ? 1 : 0,
              duration_ms: Date.now() - startedAt
            },
            results: [
              {
                url: page.url,
                company: company.name,
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
              }
            ],
            errors: crawl.errors.map((error) => ({
              url: error.url,
              code: error.code,
              message: error.message
            }))
          };
        })()
      : {
          ok: false,
          company: company.name,
          stats: {
            requested: 1,
            fetched: 0,
            succeeded: 0,
            failed: crawl.errors.length || 1,
            from_cache: 0,
            duration_ms: 0
          },
          results: [],
          errors: crawl.errors.map((error) => ({
            url: error.url,
            code: error.code,
            message: error.message
          }))
        };

    const first = fetch.results[0];
    const evidenceGate = first
      ? {
          passed: shouldRunLlm({
            pageKind: first.page_kind,
            completenessScore: first.completeness_score,
            cleanText: first.clean_text
          }),
          page_kind: first.page_kind ?? "detail",
          completeness_score: first.completeness_score ?? 0,
          clean_text_length: first.clean_text.length
        }
      : null;

    const llm = first && evidenceGate?.passed
      ? await deepSeekAnalyze({
          company: company.name,
          title: first.title,
          text: first.clean_text,
          keywords: first.matched_keywords
        })
      : null;

    const evaluation = first
      ? evaluateSourceResult({
          url: registry.url,
          urlType: registry.url_type,
          cleanText: first.clean_text,
          matchedKeywords: first.matched_keywords,
          extractedItemsCount: first.extracted_items?.length ?? 0,
          llmStatus: llm?.status ?? "failed",
          llmProvider: llm?.provider ?? "",
          fallbackUsed: llm?.fallback_used ?? false,
          summary: llm?.summary ?? "",
          category: llm?.category ?? "",
          sourceExists: !!page
        })
      : null;

    if (persist && page && first && llm) {
      const { sourceId, documentId } = upsertDocument({
        companyId: company.id,
        url: page.url,
        title: page.title,
        fetchDate: page.fetchedAt,
        cleanText: first.clean_text,
        matchedKeywords: first.matched_keywords,
        extractedItems: first.extracted_items,
        canonicalUrl: first.canonical_url ?? undefined,
        publishedAt: first.published_at ?? undefined,
        pageKind: first.page_kind ?? undefined,
        completenessScore: first.completeness_score ?? undefined
      });

      createSourceVersion({
        sourceId,
        htmlSnapshot: page.html,
        cleanText: first.clean_text,
        extractedItems: first.extracted_items,
        canonicalUrl: first.canonical_url ?? undefined,
        fromCache: !!page.fromCache,
        pageKind: first.page_kind ?? undefined,
        completenessScore: first.completeness_score ?? undefined,
        checkedAt: page.checkedAt,
        fetchedAt: page.fromCache ? undefined : page.fetchedAt,
        publishedAt: first.published_at ?? undefined
      });

      upsertInsight(documentId, llm);
      createLlmRun({
        documentId,
        provider: llm.provider,
        modelName: llm.model_name,
        promptVersion: llm.prompt_version,
        inputPayload: llm.input_payload,
        rawResponse: llm.raw_response,
        parsedJson: llm.parsed_json,
        fallbackUsed: llm.fallback_used,
        retryCount: llm.retry_count,
        durationMs: llm.duration_ms,
        status: llm.status,
        errorMessage: llm.error_message
      });

      upsertSourceRegistryStatus({
        url: page.url,
        lastCheckedAt: page.checkedAt,
        lastFetchedAt: page.fromCache ? undefined : page.fetchedAt,
        lastChangedAt: page.checkedAt,
        lastSuccessAt: page.checkedAt
      });
      if (evaluation) {
        updateSourceRegistryEvaluation({
          url: page.url,
          crawlMode: evaluation.crawlMode,
          evaluationStatus: evaluation.status,
          evaluationScore: evaluation.totalScore,
          evaluationReason: evaluation.finalVerdict,
          fixedReason: evaluation.fixedReason
        });
      }
    }

    return res.status(200).json({
      ok: fetch.ok,
      registry: {
        id: registry.id,
        url: registry.url,
        url_type: registry.url_type,
        cache_ttl_hours: registry.cache_ttl_hours,
        allow_cache: registry.allow_cache
      },
      company,
      fetch,
      llm,
      evidence_gate: evidenceGate ?? undefined
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "source_test_failed",
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
