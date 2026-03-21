import crypto from "crypto";
import fs from "fs";
import path from "path";

import type {
  CompanyRecord,
  ConsumptionCategory,
  ConsumptionCategorySummary,
  ConsumptionCompanySection,
  ConsumptionFilters,
  ConsumptionItem,
  ConsumptionSummary,
  ConsumptionQualitySummary,
  CrawlJob,
  CrawlJobStep,
  CrawlJobStatus,
  ExtractedItem,
  InsightPayload,
  KeywordSetRecord,
  LlmRunRecord,
  SourceRegistryRecord,
  StoredDocument,
  TriggerType,
  UrlType
} from "@/lib/types";

import { evaluateSourceQuality } from "@/lib/evaluate/sourceQuality";
import { getDb } from "./sqlite";

const companiesFile = path.join(process.cwd(), "data", "companies.json");

function nowIso() {
  return new Date().toISOString();
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function inferUrlType(url: string): UrlType {
  const normalized = url.toLowerCase();
  if (/(news|press|blog|dynamic|资讯|新闻)/.test(normalized)) {
    return "news";
  }
  if (/(product|solution|vehicle)/.test(normalized)) {
    return "product";
  }
  if (/(ecosystem|partner|alliance|cooperation)/.test(normalized)) {
    return "ecosystem";
  }
  if (/(jobs|career|hiring)/.test(normalized)) {
    return "jobs";
  }
  return "general";
}

function slugifyCompanyName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function isConfigCompanyActive(company: CompanyRecord) {
  return company.is_active !== false;
}

function buildIncludeInactiveFilter(includeInactive?: boolean) {
  return includeInactive ? "" : " WHERE c.is_active = 1";
}

const executiveCompanyTypeMap: Record<string, string> = {
  reachauto: "主机厂",
  vector: "Tier1",
  hirain: "Tier1",
  "i-soft": "软件供应商",
  thundersoft: "软件供应商"
};

const executiveCompanyTypeFallback = "其他动态";

const consumptionCategories: ConsumptionCategory[] = ["新闻动态", "产品", "技术", "招聘", "生态"];

function mapConsumptionCategory(input: {
  category?: string | null;
  insightType?: string | null;
  title?: string | null;
  url?: string | null;
  summary?: string | null;
}): ConsumptionCategory {
  const value = [input.category, input.insightType, input.title, input.url, input.summary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(jobs|career|talent|hiring|招聘|岗位|人才)/.test(value)) {
    return "招聘";
  }
  if (/(ecosystem|partner|alliance|cooperation|合作|伙伴|生态|联盟)/.test(value)) {
    return "生态";
  }
  if (/(technology|technical|software|autosar|platform|ai|chip|芯片|技术|软件|平台|系统|算法|基础软件)/.test(value)) {
    return "技术";
  }
  if (/(product|solution|launch|feature|车型|产品|方案|发布|升级)/.test(value)) {
    return "产品";
  }
  return "新闻动态";
}

export function loadCompanies() {
  const raw = fs.readFileSync(companiesFile, "utf8");
  return JSON.parse(raw) as CompanyRecord[];
}

export function syncCompanies(companies: CompanyRecord[]) {
  const db = getDb();
  const companyStatement = db.prepare(`
    INSERT INTO companies (id, name, website, keywords, is_active)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      website = excluded.website,
      keywords = excluded.keywords,
      is_active = excluded.is_active
  `);
  const keywordStatement = db.prepare(`
    INSERT INTO keyword_sets (company_id, name, keywords_json, version, enabled)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const company of companies) {
    companyStatement.run(
      company.id,
      company.name,
      company.website,
      JSON.stringify(company.keywords),
      isConfigCompanyActive(company) ? 1 : 0
    );
    const existingKeywordSet = db.prepare(`
      SELECT id FROM keyword_sets WHERE company_id = ? AND name = 'default'
    `).get(company.id) as { id: number } | undefined;
    if (!existingKeywordSet) {
      keywordStatement.run(company.id, "default", JSON.stringify(company.keywords), "v1", 1);
    }
  }

  if (companies.length) {
    const placeholders = companies.map(() => "?").join(", ");
    db.prepare(`UPDATE companies SET is_active = 0 WHERE id NOT IN (${placeholders})`).run(...companies.map((company) => company.id));
  } else {
    db.exec(`UPDATE companies SET is_active = 0`);
  }

  bootstrapSourceRegistryFromCompanies(companies.filter(isConfigCompanyActive));
}

export function bootstrapSourceRegistryFromCompanies(companies: CompanyRecord[]) {
  const db = getDb();
  const registryStatement = db.prepare(`
    INSERT INTO source_registry (
      company_id, url, url_type, keywords_json, priority, enabled, cache_ttl_hours, allow_cache, deleted_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(url) DO NOTHING
  `);

  for (const company of companies) {
    const urls = [...new Set([company.website, ...company.urls].filter(Boolean))];
    for (const url of urls) {
      registryStatement.run(
        company.id,
        url,
        inferUrlType(url),
        JSON.stringify(company.keywords),
        url === company.website ? 200 : 100,
        1,
        24,
        1,
        null
      );
    }
  }
}

export function createOrGetCompany(input: { name: string; website?: string; keywords?: string[] }) {
  const db = getDb();
  const normalizedName = input.name.trim();
  if (!normalizedName) {
    throw new Error("missing_company_name");
  }

  const existingByName = db.prepare(`
    SELECT id, name, website, keywords
    FROM companies
    WHERE lower(name) = lower(?)
  `).get(normalizedName) as { id: string; name: string; website: string; keywords: string } | undefined;

  if (existingByName) {
    return {
      ...existingByName,
      keywords: parseJson(existingByName.keywords, [] as string[])
    };
  }

  const baseId = slugifyCompanyName(normalizedName) || `company-${Date.now()}`;
  let candidateId = baseId;
  let suffix = 2;
  while (db.prepare(`SELECT id FROM companies WHERE id = ?`).get(candidateId)) {
    candidateId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const website = input.website?.trim() || "";
  const keywords = input.keywords ?? [];

  db.prepare(`
    INSERT INTO companies (id, name, website, keywords, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).run(candidateId, normalizedName, website, JSON.stringify(keywords));

  const existingKeywordSet = db.prepare(`
    SELECT id FROM keyword_sets WHERE company_id = ? AND name = 'default'
  `).get(candidateId) as { id: number } | undefined;

  if (!existingKeywordSet) {
    db.prepare(`
      INSERT INTO keyword_sets (company_id, name, keywords_json, version, enabled)
      VALUES (?, ?, ?, ?, ?)
    `).run(candidateId, "default", JSON.stringify(keywords), "v1", 1);
  }

  return {
    id: candidateId,
    name: normalizedName,
    website,
    keywords
  };
}

export function createCrawlJob(input: {
  triggerType: TriggerType;
  companyCount: number;
  urlCount: number;
  configSnapshot: Record<string, unknown>;
}) {
  const db = getDb();
  const row = db.prepare(`
    INSERT INTO crawl_jobs (
      trigger_type, status, started_at, company_count, url_count, config_snapshot_json
    )
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING *
  `).get(
    input.triggerType,
    "running",
    nowIso(),
    input.companyCount,
    input.urlCount,
    JSON.stringify(input.configSnapshot)
  ) as CrawlJob;
  return row;
}

export function finalizeCrawlJob(
  jobId: number,
  input: {
    status: CrawlJobStatus;
    successCount: number;
    failureCount: number;
    cacheHitCount: number;
    changedCount: number;
    insightCount: number;
  }
) {
  const db = getDb();
  const endedAt = nowIso();
  const started = db.prepare(`SELECT started_at FROM crawl_jobs WHERE id = ?`).get(jobId) as { started_at: string };
  const durationMs = Date.parse(endedAt) - Date.parse(started.started_at);
  db.prepare(`
    UPDATE crawl_jobs
    SET status = ?, ended_at = ?, duration_ms = ?, success_count = ?, failure_count = ?, cache_hit_count = ?, changed_count = ?, insight_count = ?
    WHERE id = ?
  `).run(
    input.status,
    endedAt,
    durationMs,
    input.successCount,
    input.failureCount,
    input.cacheHitCount,
    input.changedCount,
    input.insightCount,
    jobId
  );
}

export function createCrawlJobStep(input: {
  jobId: number;
  companyId?: string;
  sourceUrl?: string;
  stepName: string;
  stepOrder: number;
  toolType: string;
  toolName: string;
  moduleName: string;
  runtime: string;
  inputJson?: unknown;
  nextStep?: string;
}) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO crawl_job_steps (
      job_id, company_id, source_url, step_name, step_order, status, start_time,
      tool_type, tool_name, module_name, runtime, input_json, next_step
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    input.jobId,
    input.companyId ?? null,
    input.sourceUrl ?? null,
    input.stepName,
    input.stepOrder,
    "pending",
    nowIso(),
    input.toolType,
    input.toolName,
    input.moduleName,
    input.runtime,
    input.inputJson ? JSON.stringify(input.inputJson) : null,
    input.nextStep ?? null
  ) as { id: number };
}

export function finalizeCrawlJobStep(input: {
  stepId: number;
  status: "success" | "failed" | "skipped" | "fallback";
  outputJson?: unknown;
  errorMessage?: string;
  retryCount?: number;
  fallbackUsed?: boolean;
}) {
  const db = getDb();
  const endTime = nowIso();
  const started = db.prepare(`SELECT start_time FROM crawl_job_steps WHERE id = ?`).get(input.stepId) as { start_time: string };
  const durationMs = Date.parse(endTime) - Date.parse(started.start_time);
  db.prepare(`
    UPDATE crawl_job_steps
    SET status = ?, end_time = ?, duration_ms = ?, output_json = ?, error_message = ?, retry_count = ?, fallback_used = ?
    WHERE id = ?
  `).run(
    input.status,
    endTime,
    durationMs,
    input.outputJson ? JSON.stringify(input.outputJson) : null,
    input.errorMessage ?? null,
    input.retryCount ?? 0,
    input.fallbackUsed ? 1 : 0,
    input.stepId
  );
}

export function upsertSourceRegistryStatus(input: {
  url: string;
  lastCheckedAt?: string;
  lastFetchedAt?: string;
  lastChangedAt?: string;
  lastSuccessAt?: string;
}) {
  const db = getDb();
  db.prepare(`
    UPDATE source_registry
    SET
      last_checked_at = COALESCE(?, last_checked_at),
      last_fetched_at = COALESCE(?, last_fetched_at),
      last_changed_at = COALESCE(?, last_changed_at),
      last_success_at = COALESCE(?, last_success_at)
    WHERE url = ?
  `).run(
    input.lastCheckedAt ?? null,
    input.lastFetchedAt ?? null,
    input.lastChangedAt ?? null,
    input.lastSuccessAt ?? null,
    input.url
  );
}

export function updateSourceRegistryEvaluation(input: {
  url: string;
  crawlMode: string;
  evaluationStatus: string;
  evaluationScore: number;
  evaluationReason: string;
  fixedReason: string;
  successRate?: number;
  noiseScore?: number;
  valueScore?: number;
  isFixed?: boolean;
}) {
  const db = getDb();
  const current = db.prepare(`
    SELECT success_rate, noise_score, value_score, is_fixed, fixed_at
    FROM source_registry
    WHERE url = ?
  `).get(input.url) as
    | {
        success_rate?: number | null;
        noise_score?: number | null;
        value_score?: number | null;
        is_fixed?: number | null;
        fixed_at?: string | null;
      }
    | undefined;
  db.prepare(`
    UPDATE source_registry
    SET
      crawl_mode = ?,
      evaluation_status = ?,
      evaluation_score = ?,
      evaluation_reason = ?,
      fixed_reason = ?,
      success_rate = ?,
      noise_score = ?,
      value_score = ?,
      is_fixed = ?,
      fixed_at = ?
    WHERE url = ?
  `).run(
    input.crawlMode,
    input.evaluationStatus,
    input.evaluationScore,
    input.evaluationReason,
    input.fixedReason,
    input.successRate ?? current?.success_rate ?? 0,
    input.noiseScore ?? current?.noise_score ?? 0,
    input.valueScore ?? current?.value_score ?? 0,
    typeof input.isFixed === "boolean" ? (input.isFixed ? 1 : 0) : current?.is_fixed ?? 0,
    typeof input.isFixed === "boolean" ? (input.isFixed ? nowIso() : null) : current?.fixed_at ?? null,
    input.url
  );
}

export function getSourceRegistryByCompany(companyId?: string) {
  const db = getDb();
  const rows = companyId
    ? db.prepare(`SELECT * FROM source_registry WHERE deleted_at IS NULL AND company_id = ? ORDER BY priority ASC, id ASC`).all(companyId)
    : db.prepare(`SELECT * FROM source_registry WHERE deleted_at IS NULL ORDER BY company_id ASC, priority ASC, id ASC`).all();
  return rows as SourceRegistryRecord[];
}

export function getSourceRegistryRecord(id: number) {
  const db = getDb();
  return db.prepare(`
    SELECT *
    FROM source_registry
    WHERE id = ?
  `).get(id) as SourceRegistryRecord | undefined;
}

export function getEnabledSourceRegistry(companyId?: string) {
  const db = getDb();
  const rows = companyId
    ? db.prepare(`SELECT * FROM source_registry WHERE deleted_at IS NULL AND enabled = 1 AND company_id = ? ORDER BY priority ASC, id ASC`).all(companyId)
    : db.prepare(`SELECT * FROM source_registry WHERE deleted_at IS NULL AND enabled = 1 ORDER BY company_id ASC, priority ASC, id ASC`).all();
  return rows as SourceRegistryRecord[];
}

export function createSourceRegistryRecord(input: {
  companyId: string;
  url: string;
  urlType: UrlType;
  keywords: string[];
  priority?: number;
  enabled?: boolean;
  cacheTtlHours?: number;
  allowCache?: boolean;
}) {
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM source_registry WHERE url = ?`).get(input.url) as SourceRegistryRecord | undefined;
  if (existing) {
    if (existing.deleted_at) {
      db.prepare(`
        UPDATE source_registry
        SET
          company_id = ?,
          url_type = ?,
          keywords_json = ?,
          priority = ?,
          enabled = ?,
          cache_ttl_hours = ?,
          allow_cache = ?,
          deleted_at = NULL
        WHERE id = ?
      `).run(
        input.companyId,
        input.urlType,
        JSON.stringify(input.keywords),
        input.priority ?? 100,
        input.enabled === false ? 0 : 1,
        input.cacheTtlHours ?? 24,
        input.allowCache === false ? 0 : 1,
        existing.id
      );
      return db.prepare(`SELECT * FROM source_registry WHERE id = ?`).get(existing.id) as SourceRegistryRecord;
    }
    throw new Error("duplicate_source_url");
  }
  return db.prepare(`
    INSERT INTO source_registry (
      company_id, url, url_type, keywords_json, priority, enabled, cache_ttl_hours, allow_cache, deleted_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
    RETURNING *
  `).get(
    input.companyId,
    input.url,
    input.urlType,
    JSON.stringify(input.keywords),
    input.priority ?? 100,
    input.enabled === false ? 0 : 1,
    input.cacheTtlHours ?? 24,
    input.allowCache === false ? 0 : 1
  ) as SourceRegistryRecord;
}

export function updateSourceRegistryRecord(
  id: number,
  input: {
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
  }
) {
  const db = getDb();
  const current = db.prepare(`SELECT * FROM source_registry WHERE id = ?`).get(id) as SourceRegistryRecord | undefined;
  if (!current) {
    return null;
  }

  db.prepare(`
    UPDATE source_registry
    SET
      url = ?,
      url_type = ?,
      keywords_json = ?,
      priority = ?,
      enabled = ?,
      cache_ttl_hours = ?,
      allow_cache = ?,
      crawl_mode = ?,
      evaluation_status = ?,
      evaluation_score = ?,
      evaluation_reason = ?,
      fixed_reason = ?,
      is_fixed = ?,
      fixed_at = ?
    WHERE id = ?
  `).run(
    input.url ?? current.url,
    input.urlType ?? current.url_type,
    JSON.stringify(input.keywords ?? parseJson(current.keywords_json, [] as string[])),
    input.priority ?? current.priority,
    typeof input.enabled === "boolean" ? (input.enabled ? 1 : 0) : current.enabled,
    input.cacheTtlHours ?? current.cache_ttl_hours,
    typeof input.allowCache === "boolean" ? (input.allowCache ? 1 : 0) : current.allow_cache,
    input.crawlMode ?? current.crawl_mode ?? "auto",
    input.evaluationStatus ?? current.evaluation_status ?? "unknown",
    input.evaluationScore ?? current.evaluation_score ?? 0,
    input.evaluationReason ?? current.evaluation_reason ?? null,
    input.fixedReason ?? current.fixed_reason ?? null,
    typeof input.isFixed === "boolean" ? (input.isFixed ? 1 : 0) : current.is_fixed ?? 0,
    typeof input.isFixed === "boolean"
      ? (input.isFixed ? nowIso() : null)
      : current.fixed_at ?? null,
    id
  );

  return db.prepare(`SELECT * FROM source_registry WHERE id = ?`).get(id) as SourceRegistryRecord;
}

export function softDeleteSourceRegistryRecord(id: number) {
  const db = getDb();
  db.prepare(`
    UPDATE source_registry
    SET deleted_at = ?, enabled = 0
    WHERE id = ?
  `).run(nowIso(), id);
}

export function getKeywordSets(companyId?: string) {
  const db = getDb();
  const rows = companyId
    ? db.prepare(`SELECT * FROM keyword_sets WHERE company_id = ? ORDER BY id ASC`).all(companyId)
    : db.prepare(`SELECT * FROM keyword_sets ORDER BY company_id ASC, id ASC`).all();
  return rows as KeywordSetRecord[];
}

export function getSourceManagerData() {
  const db = getDb();
  const companies = db.prepare(`SELECT id, name, website, keywords, is_active > 0 as is_active FROM companies WHERE is_active = 1 ORDER BY name`).all() as unknown as Array<{
    id: string;
    name: string;
    website: string;
    keywords: string;
    is_active: boolean;
  }>;
  const sources = db.prepare(`
    SELECT sr.*
    FROM source_registry sr
    JOIN companies c ON c.id = sr.company_id
    WHERE sr.deleted_at IS NULL AND c.is_active = 1
    ORDER BY sr.company_id ASC, sr.priority ASC, sr.id ASC
  `).all() as SourceRegistryRecord[];

  return {
    companies: companies.map((company) => ({
      ...company,
      keywords: parseJson(company.keywords, [] as string[])
    })),
    sources: sources.map((source) => ({
      ...source,
      keywords: parseJson(source.keywords_json, [] as string[])
    }))
  };
}

export function getSourceByUrl(url: string) {
  const db = getDb();
  return db.prepare(`SELECT * FROM sources WHERE url = ?`).get(url) as
    | { id: number; company_id: string; url: string; title: string; fetch_date: string }
    | undefined;
}

export function getSourceExportData(sourceRegistryId: number) {
  const registry = getSourceRegistryRecord(sourceRegistryId);
  if (!registry) {
    return null;
  }
  const source = getSourceByUrl(registry.url);
  const db = getDb();
  const company = db.prepare(`
    SELECT id, name, website, keywords, is_active
    FROM companies
    WHERE id = ?
  `).get(registry.company_id) as
    | { id: string; name: string; website: string; keywords: string; is_active: number }
    | undefined;

  const document = source
    ? (db.prepare(`
        SELECT d.id, s.company_id, s.url, s.title, s.fetch_date, d.clean_text, d.matched_keywords, d.extracted_items,
               d.canonical_url, d.published_at, d.page_kind, d.completeness_score,
               i.summary, i.insight_type, i.confidence, i.category
        FROM sources s
        JOIN documents d ON d.source_id = s.id
        LEFT JOIN insights i ON i.document_id = d.id
        WHERE s.id = ?
      `).get(source.id) as
        | {
            id: number;
            company_id: string;
            url: string;
            title: string;
            fetch_date: string;
            clean_text: string;
            matched_keywords: string;
            extracted_items: string;
            canonical_url?: string | null;
            published_at?: string | null;
            page_kind?: string | null;
            completeness_score?: number | null;
            summary?: string;
            insight_type?: string;
            confidence?: number;
            category?: string;
          }
        | undefined)
    : undefined;

  return {
    registry,
    company: company
      ? {
          ...company,
          keywords: parseJson(company.keywords, [] as string[])
        }
      : null,
    source,
    document: document
      ? {
          ...document,
          matched_keywords: parseJson(document.matched_keywords, [] as string[]),
          extracted_items: parseJson(document.extracted_items, [] as Array<Record<string, unknown>>)
        }
      : null
  };
}

export function getLatestSourceVersion(sourceId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM source_versions
    WHERE source_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(sourceId) as
    | {
        id: number;
        source_id: number;
        content_hash: string;
        html_snapshot: string;
        clean_text: string;
        extracted_items_json: string;
        from_cache: number;
        is_changed: number;
        published_at?: string | null;
        last_checked_at: string;
        last_fetched_at?: string | null;
        last_changed_at?: string | null;
      }
    | undefined;
}

export function computeContentHash(input: {
  title: string;
  cleanText: string;
  extractedItems?: Array<{ title: string; summary?: string; date?: string }>;
}) {
  return crypto
    .createHash("sha1")
    .update(JSON.stringify([input.title, input.cleanText, input.extractedItems ?? []]))
    .digest("hex");
}

export function upsertDocument(input: {
  companyId: string;
  url: string;
  title: string;
  fetchDate: string;
  cleanText: string;
  matchedKeywords: string[];
  extractedItems?: Array<{
    title: string;
    summary?: string;
    date?: string;
  }>;
  canonicalUrl?: string;
  publishedAt?: string;
  pageKind?: "list" | "detail";
  completenessScore?: number;
}) {
  const db = getDb();
  const sourceStatement = db.prepare(`
    INSERT INTO sources (company_id, url, title, fetch_date)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(url) DO UPDATE SET
      title = excluded.title,
      fetch_date = excluded.fetch_date
    RETURNING id
  `);
  const source = sourceStatement.get(input.companyId, input.url, input.title, input.fetchDate) as { id: number };

  db.prepare(`
    INSERT INTO documents (source_id, clean_text, matched_keywords, extracted_items, canonical_url, published_at, page_kind, completeness_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_id) DO UPDATE SET
      clean_text = excluded.clean_text,
      matched_keywords = excluded.matched_keywords,
      extracted_items = excluded.extracted_items,
      canonical_url = excluded.canonical_url,
      published_at = excluded.published_at,
      page_kind = excluded.page_kind,
      completeness_score = excluded.completeness_score
  `).run(
    source.id,
    input.cleanText,
    JSON.stringify(input.matchedKeywords),
    JSON.stringify(input.extractedItems ?? []),
    input.canonicalUrl ?? null,
    input.publishedAt ?? null,
    input.pageKind ?? null,
    input.completenessScore ?? 0
  );

  const document = db.prepare(`
    SELECT id
    FROM documents
    WHERE source_id = ?
  `).get(source.id) as { id: number };

  return { sourceId: source.id, documentId: document.id };
}

export function createSourceVersion(input: {
  sourceId: number;
  htmlSnapshot: string;
  cleanText: string;
  extractedItems?: Array<{
    title: string;
    summary?: string;
    date?: string;
  }>;
  canonicalUrl?: string;
  fromCache: boolean;
  publishedAt?: string;
  pageKind?: "list" | "detail";
  completenessScore?: number;
  checkedAt: string;
  fetchedAt?: string;
  changedAt?: string;
}) {
  const db = getDb();
  const contentHash = computeContentHash({
    title: "",
    cleanText: input.cleanText,
    extractedItems: input.extractedItems
  });
  const latest = getLatestSourceVersion(input.sourceId);
  const isChanged = latest ? latest.content_hash !== contentHash : true;

  db.prepare(`
    INSERT INTO source_versions (
      source_id, content_hash, html_snapshot, clean_text, extracted_items_json, canonical_url, from_cache, is_changed,
      published_at, page_kind, completeness_score, last_checked_at, last_fetched_at, last_changed_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.sourceId,
    contentHash,
    input.htmlSnapshot,
    input.cleanText,
    JSON.stringify(input.extractedItems ?? []),
    input.canonicalUrl ?? null,
    input.fromCache ? 1 : 0,
    isChanged ? 1 : 0,
    input.publishedAt ?? null,
    input.pageKind ?? null,
    input.completenessScore ?? 0,
    input.checkedAt,
    input.fetchedAt ?? null,
    isChanged ? input.changedAt ?? input.checkedAt : latest?.last_changed_at ?? null
  );

  return {
    isChanged,
    contentHash
  };
}

export function upsertInsight(documentId: number, insight: InsightPayload) {
  const db = getDb();
  db.prepare(`
    INSERT INTO insights (document_id, summary, insight_type, confidence, category, key_points)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(document_id) DO UPDATE SET
      summary = excluded.summary,
      insight_type = excluded.insight_type,
      confidence = excluded.confidence,
      category = excluded.category,
      key_points = excluded.key_points
  `).run(
    documentId,
    insight.summary,
    insight.insight_type,
    insight.confidence,
    insight.category,
    JSON.stringify(insight.key_points)
  );
}

export function createLlmRun(input: {
  jobId?: number;
  stepId?: number;
  documentId?: number;
  provider: string;
  modelName: string;
  promptVersion: string;
  inputPayload: unknown;
  rawResponse: string;
  parsedJson: unknown;
  fallbackUsed: boolean;
  retryCount: number;
  durationMs: number;
  status: string;
  errorMessage?: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO llm_runs (
      job_id, step_id, document_id, provider, model_name, prompt_version, input_payload_json, raw_response,
      parsed_json, fallback_used, retry_count, duration_ms, status, error_message, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.jobId ?? null,
    input.stepId ?? null,
    input.documentId ?? null,
    input.provider,
    input.modelName,
    input.promptVersion,
    JSON.stringify(input.inputPayload),
    input.rawResponse,
    JSON.stringify(input.parsedJson),
    input.fallbackUsed ? 1 : 0,
    input.retryCount,
    input.durationMs,
    input.status,
    input.errorMessage ?? null,
    nowIso()
  );
}

export function getDashboardData() {
  const db = getDb();
  const companies = db.prepare("SELECT id, name, website, keywords FROM companies WHERE is_active = 1 ORDER BY name").all() as Array<{
    id: string;
    name: string;
    website: string;
    keywords: string;
  }>;
  const companySnapshots = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.website,
      c.keywords,
      COUNT(DISTINCT s.id) AS source_count,
      COUNT(DISTINCT d.id) AS document_count,
      COUNT(DISTINCT i.id) AS insight_count,
      MAX(s.fetch_date) AS latest_fetch_date
    FROM companies c
    LEFT JOIN sources s ON s.company_id = c.id
    LEFT JOIN documents d ON d.source_id = s.id
    LEFT JOIN insights i ON i.document_id = d.id
    WHERE c.is_active = 1
    GROUP BY c.id, c.name, c.website, c.keywords
  `).all() as Array<{
    id: string;
    name: string;
    website: string;
    keywords: string;
    source_count: number;
    document_count: number;
    insight_count: number;
    latest_fetch_date?: string | null;
  }>;
  const latestDocuments = db.prepare(`
    SELECT c.name as company_name, s.url, s.title, s.fetch_date, d.clean_text, d.extracted_items, i.summary, i.insight_type, i.category
    FROM sources s
    JOIN companies c ON c.id = s.company_id
    LEFT JOIN documents d ON d.source_id = s.id
    LEFT JOIN insights i ON i.document_id = d.id
    WHERE c.is_active = 1
    ORDER BY s.fetch_date DESC
    LIMIT 36
  `).all() as Array<{
    company_name: string;
    url: string;
    title: string;
    fetch_date: string;
    clean_text?: string | null;
    extracted_items?: string | null;
    summary?: string;
    insight_type?: string;
    category?: string;
  }>;
  const keywordRows = db.prepare(`
    SELECT d.matched_keywords
    FROM documents d
    JOIN sources s ON s.id = d.source_id
    JOIN companies c ON c.id = s.company_id
    WHERE c.is_active = 1
  `).all() as Array<{ matched_keywords: string }>;
  const latestJobs = db.prepare(`
    SELECT id, trigger_type, status, started_at, ended_at, duration_ms, company_count, url_count, success_count, failure_count, cache_hit_count, changed_count, insight_count
    FROM crawl_jobs
    ORDER BY id DESC
    LIMIT 5
  `).all() as CrawlJob[];
  const recentErrors = db.prepare(`
    SELECT id, job_id, company_id, source_url, step_name, error_message, end_time
    FROM crawl_job_steps
    WHERE status = 'failed' AND (
      company_id IS NULL OR EXISTS (
        SELECT 1 FROM companies c WHERE c.id = crawl_job_steps.company_id AND c.is_active = 1
      )
    )
    ORDER BY id DESC
    LIMIT 8
  `).all() as Array<{
    id: number;
    job_id: number;
    company_id?: string;
    source_url?: string;
    step_name: string;
    error_message?: string;
    end_time?: string;
  }>;
  const recentChanges = db.prepare(`
    SELECT sv.id, s.company_id, s.url, s.title, sv.last_changed_at, sv.from_cache, sv.content_hash
    FROM source_versions sv
    JOIN sources s ON s.id = sv.source_id
    JOIN companies c ON c.id = s.company_id
    WHERE sv.is_changed = 1 AND c.is_active = 1
    ORDER BY sv.id DESC
    LIMIT 8
  `).all() as Array<{
    id: number;
    company_id: string;
    url: string;
    title: string;
    last_changed_at: string;
    from_cache: number;
    content_hash: string;
  }>;
  const llmStats = db.prepare(`
    SELECT
      COUNT(*) AS total_runs,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_runs,
      SUM(CASE WHEN fallback_used = 1 THEN 1 ELSE 0 END) AS fallback_runs
    FROM llm_runs lr
    JOIN documents d ON d.id = lr.document_id
    JOIN sources s ON s.id = d.source_id
    JOIN companies c ON c.id = s.company_id
    WHERE c.is_active = 1
  `).get() as { total_runs: number; success_runs: number; fallback_runs: number };
  const sourceStats = db.prepare(`
    SELECT
      COUNT(*) AS total_sources,
      SUM(CASE WHEN sr.enabled = 1 THEN 1 ELSE 0 END) AS enabled_sources,
      AVG(sr.noise_score) AS avg_noise_score,
      AVG(sr.value_score) AS avg_value_score
    FROM source_registry sr
    JOIN companies c ON c.id = sr.company_id
    WHERE sr.deleted_at IS NULL AND c.is_active = 1
  `).get() as {
    total_sources: number;
    enabled_sources: number;
    avg_noise_score?: number | null;
    avg_value_score?: number | null;
  };
  const totals = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM companies WHERE is_active = 1) AS company_count,
      (SELECT COUNT(*) FROM sources s JOIN companies c ON c.id = s.company_id WHERE c.is_active = 1) AS source_count,
      (SELECT COUNT(*) FROM documents d JOIN sources s ON s.id = d.source_id JOIN companies c ON c.id = s.company_id WHERE c.is_active = 1) AS document_count,
      (SELECT MAX(s.fetch_date) FROM sources s JOIN companies c ON c.id = s.company_id WHERE c.is_active = 1) AS latest_fetch_date
  `).get() as {
    company_count: number;
    source_count: number;
    document_count: number;
    latest_fetch_date?: string | null;
  };

  const keywordCounts = new Map<string, number>();
  for (const row of keywordRows) {
    const values = parseJson<string[]>(row.matched_keywords, []);
    for (const keyword of values) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
    }
  }

  return {
    stats: {
      companyCount: totals.company_count,
      sourceCount: totals.source_count,
      documentCount: totals.document_count,
      latestFetchDate: totals.latest_fetch_date ?? null
    },
    companySnapshots: companySnapshots
      .map((company) => ({
        ...company,
        keywords: parseJson(company.keywords, [] as string[])
      }))
      .sort((left, right) => {
        const leftTime = left.latest_fetch_date ? Date.parse(left.latest_fetch_date) : 0;
        const rightTime = right.latest_fetch_date ? Date.parse(right.latest_fetch_date) : 0;
        return rightTime - leftTime || left.name.localeCompare(right.name, "zh-CN");
      }),
    companies: companies.map((company) => ({
      ...company,
      keywords: parseJson(company.keywords, [] as string[])
    })),
    latestDocuments: dedupePrimaryDisplayItems(
      latestDocuments
        .map((item) => {
          const extractedItems = parseJson(item.extracted_items, [] as ExtractedItem[]);
          const quality = evaluateSourceQuality({
            url: item.url,
            title: item.title,
            cleanText: item.clean_text || "",
            extractedItems
          });

          return {
            ...item,
            clean_text: item.clean_text || "",
            source_type: quality.source_type ?? "",
            is_high_value: quality.is_high_value ?? false,
            is_noise: quality.is_noise ?? false
          };
        })
        .filter((item) =>
          isPrimaryDisplayCandidate({
            url: item.url,
            cleanText: item.clean_text,
            sourceType: item.source_type,
            isHighValue: item.is_high_value,
            isNoise: item.is_noise
          })
        )
        .slice(0, 12)
    ).map(({ clean_text: _cleanText, source_type: _sourceType, is_high_value: _isHighValue, is_noise: _isNoise, extracted_items: _extractedItems, ...item }) => item),
    topKeywords: [...keywordCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count })),
    latestJobs,
    recentErrors,
    recentChanges,
    llmStats,
    sourceStats,
    configSnapshot: {
      crawlTool: "Playwright + Chromium",
      cleanTool: "Readability + Cheerio",
      llmProvider: process.env.DEEPSEEK_API_KEY ? "deepseek" : "fallback",
      llmModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      database: "SQLite",
      cacheDir: path.join(process.cwd(), "data", "crawl_cache"),
      promptVersion: "deepseek-v1",
      defaultCacheTtlHours: 24
    }
  };
}

function getConsumptionBaseRows(includeInactive?: boolean) {
  const db = getDb();
  const activeFilter = buildIncludeInactiveFilter(includeInactive);
  const rows = db.prepare(`
    SELECT
      c.id AS company_id,
      c.name AS company_name,
      c.website AS company_website,
      c.keywords AS company_keywords,
      s.url,
      d.canonical_url,
      s.title,
      s.fetch_date,
      d.published_at,
      d.page_kind,
      d.completeness_score,
      d.extracted_items,
      d.clean_text,
      i.summary,
      i.insight_type,
      i.category,
      i.confidence
    FROM insights i
    JOIN documents d ON d.id = i.document_id
    JOIN sources s ON s.id = d.source_id
    JOIN companies c ON c.id = s.company_id
    ${activeFilter}
    ORDER BY s.fetch_date DESC, i.confidence DESC
  `).all() as Array<{
    company_id: string;
    company_name: string;
    company_website?: string | null;
    company_keywords: string;
    url: string;
    canonical_url?: string | null;
    title: string;
    fetch_date: string;
    published_at?: string | null;
    page_kind?: "list" | "detail" | null;
    completeness_score?: number | null;
    extracted_items: string;
    clean_text: string;
    summary: string;
    insight_type: string;
    category: string;
    confidence: number;
  }>;

  return rows;
}

function matchesConsumptionFilters(item: ConsumptionItem, filters: ConsumptionFilters) {
  if (filters.companyIds?.length && !filters.companyIds.includes(item.company_id)) {
    return false;
  }
  if (filters.companyId && item.company_id !== filters.companyId) {
    return false;
  }
  if (filters.companyType) {
    const companyType = executiveCompanyTypeMap[item.company_id] ?? executiveCompanyTypeFallback;
    if (filters.companyType !== "全部" && companyType !== filters.companyType) {
      return false;
    }
  }
  if (filters.companyQuery) {
    const query = filters.companyQuery.trim().toLowerCase();
    if (query && !item.company_name.toLowerCase().includes(query)) {
      return false;
    }
  }
  if (filters.category && item.display_category !== filters.category) {
    return false;
  }
  if (filters.isHighValue !== undefined && item.is_high_value !== filters.isHighValue) {
    return false;
  }
  if (filters.isNoise !== undefined && item.is_noise !== filters.isNoise) {
    return false;
  }
  if (filters.sourceType && item.source_type !== filters.sourceType) {
    return false;
  }
  return true;
}

function normalizeDisplayUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function isHomepageLikeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" || parsed.pathname === "";
  } catch {
    return false;
  }
}

function isPrimaryDisplayCandidate(input: {
  url: string;
  canonicalUrl?: string | null;
  pageKind?: "list" | "detail" | null;
  publishedAt?: string | null;
  completenessScore?: number | null;
  cleanText: string;
  sourceType: string;
  isHighValue: boolean;
  isNoise: boolean;
}) {
  const dynamicSourceTypes = new Set([
    "company_newsroom",
    "company_case_study",
    "ecosystem_partner",
    "industry_media",
    "generic_news_portal"
  ]);

  if (input.isNoise) {
    return false;
  }

  if (isHomepageLikeUrl(input.url) || input.sourceType === "company_official") {
    return false;
  }

  if ((input.pageKind ?? "detail") !== "detail") {
    return false;
  }

  if (!dynamicSourceTypes.has(input.sourceType)) {
    return false;
  }

  if ((input.completenessScore ?? 0) < 0.75) {
    return false;
  }

  if (!input.canonicalUrl) {
    return false;
  }

  // [TEMP DISABLED] if (!input.publishedAt) { return false; }

  if ((input.cleanText || "").trim().length < 300) {
    return false;
  }

  return input.isHighValue;
}
function dedupePrimaryDisplayItems<T extends { url: string; canonical_url?: string | null; title?: string | null }>(items: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const item of items) {
    const key = `${normalizeDisplayUrl(item.canonical_url || item.url)}::${(item.title || "").trim()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

export function listConsumptionItems(filters: ConsumptionFilters = {}): ConsumptionItem[] {
  const normalizedRows = getConsumptionBaseRows(filters.includeInactive).map((item) => {
    const extractedItems = parseJson(item.extracted_items, [] as ExtractedItem[]);
    const quality = evaluateSourceQuality({
      url: item.url,
      title: item.title,
      cleanText: item.clean_text || "",
      extractedItems
    });

    return {
      company_id: item.company_id,
      company_name: item.company_name,
      url: item.url,
      canonical_url: item.canonical_url ?? null,
      title: item.title,
      fetch_date: item.fetch_date,
      published_at: item.published_at ?? null,
      page_kind: item.page_kind ?? null,
      completeness_score: item.completeness_score ?? 0,
      extracted_items: extractedItems,
      summary: item.summary,
      insight_type: item.insight_type,
      category: item.category,
      confidence: item.confidence,
      display_category: mapConsumptionCategory({
        category: item.category,
        insightType: item.insight_type,
        title: item.title,
        url: item.url,
        summary: item.summary
      }),
      source_domain: quality.source_domain ?? "",
      source_type: quality.source_type ?? "",
      quality_score: quality.quality_score ?? 0,
      is_high_value: quality.is_high_value ?? false,
      is_noise: quality.is_noise ?? false,
      noise_reason: quality.noise_reason ?? "",
      quality_reason: quality.quality_reason ?? "",
      matched_rules: quality.matched_rules ?? [],
      source_signals: quality.source_signals ?? [],
      _clean_text: item.clean_text || ""
    };
  });

  const filteredItems = dedupePrimaryDisplayItems(normalizedRows)
    .filter((item) =>
      isPrimaryDisplayCandidate({
        url: item.url,
        canonicalUrl: item.canonical_url,
        pageKind: item.page_kind,
        publishedAt: item.published_at,
        completenessScore: item.completeness_score,
        cleanText: item._clean_text,
        sourceType: item.source_type,
        isHighValue: item.is_high_value,
        isNoise: item.is_noise
      }) && matchesConsumptionFilters(item, filters)
    )
    .map(({ _clean_text: _cleanText, ...item }) => item);

  return typeof filters.limit === "number" ? filteredItems.slice(0, filters.limit) : filteredItems;
}

export function getConsumptionSummary(filters: ConsumptionFilters = {}): ConsumptionSummary {
  const items = listConsumptionItems(filters);
  const categories: ConsumptionCategorySummary[] = consumptionCategories.map((category) => ({
    category,
    count: items.filter((item) => item.display_category === category).length
  }));

  return {
    totalItems: items.length,
    tracedItems: items.filter((item) => /^https?:\/\//.test(item.url)).length,
    extractedItems: items.filter((item) => item.extracted_items.length > 0).length,
    summarizedItems: items.filter((item) => Boolean(item.summary?.trim())).length,
    categories
  };
}

export function listCompanyConsumptionItems(filters: ConsumptionFilters = {}): ConsumptionCompanySection[] {
  const dashboard = getDashboardData();
  const items = listConsumptionItems(filters);
  const companySnapshots = dashboard.companySnapshots.map((company) => ({
    ...company,
    website: company.website ?? null,
    keywords: company.keywords,
    type: executiveCompanyTypeMap[company.id] ?? executiveCompanyTypeFallback
  }));

  return companySnapshots
    .map((company) => {
      const companyItems = items.filter((item) => item.company_id === company.id);
      const categories = consumptionCategories
        .map((category) => ({
          category,
          items: companyItems.filter((item) => item.display_category === category).slice(0, 5)
        }))
        .filter((category) => category.items.length > 0);

      return {
        id: company.id,
        name: company.name,
        website: company.website,
        keywords: company.keywords,
        document_count: company.document_count,
        latest_fetch_date: company.latest_fetch_date ?? null,
        type: company.type,
        total_items: companyItems.length,
        items: companyItems,
        categories
      };
    })
    .filter((company) => company.document_count > 0 && company.total_items > 0)
    .sort((left, right) => {
      const leftTime = left.latest_fetch_date ? Date.parse(left.latest_fetch_date) : 0;
      const rightTime = right.latest_fetch_date ? Date.parse(right.latest_fetch_date) : 0;
      return rightTime - leftTime || right.total_items - left.total_items;
    });
}

export function getExecutiveDashboardData() {
  const dashboard = getDashboardData();
  const companyTypeOptions = ["全部", ...new Set([...Object.values(executiveCompanyTypeMap), executiveCompanyTypeFallback])];
  const companyDetails = dashboard.companySnapshots.map((company) => ({
    ...company,
    type: executiveCompanyTypeMap[company.id] ?? executiveCompanyTypeFallback
  }));
  const normalizedInsights = listConsumptionItems({ limit: 200 });
  const recentByCategory = consumptionCategories.map((category) => {
    const items = normalizedInsights.filter((item) => item.display_category === category);
    return {
      category,
      count: items.length,
      items: items.slice(0, 5)
    };
  });
  const qualitySummary: ConsumptionQualitySummary = getConsumptionSummary();
  const companySections = listCompanyConsumptionItems({ limit: 200 });

  return {
    ...dashboard,
    companyDetails,
    companyTypeOptions,
    recentByCategory,
    companySections,
    consumptionCategories,
    qualitySummary,
    totalTrackedItems: normalizedInsights.length,
    featuredInsights: normalizedInsights
      .sort((left, right) => {
        const leftTime = left.published_at ? Date.parse(left.published_at) : Date.parse(left.fetch_date);
        const rightTime = right.published_at ? Date.parse(right.published_at) : Date.parse(right.fetch_date);
        return rightTime - leftTime || (right.confidence ?? 0) - (left.confidence ?? 0);
      })
      .slice(0, 20)
  };
}

export function getCompanyDetails(companyId: string, options: { includeInactive?: boolean } = {}) {
  const db = getDb();
  const company = db.prepare(`
    SELECT id, name, website, keywords
    FROM companies
    WHERE id = ? AND (? = 1 OR is_active = 1)
  `).get(companyId, options.includeInactive ? 1 : 0) as
    | { id: string; name: string; website: string; keywords: string }
    | undefined;

  if (!company) {
    return null;
  }

  const documents = db.prepare(`
    SELECT d.id, s.company_id, s.url, s.title, s.fetch_date, d.clean_text, d.matched_keywords, d.extracted_items,
           d.canonical_url, d.published_at, d.page_kind, d.completeness_score,
           i.summary, i.insight_type, i.confidence, i.category
    FROM sources s
    JOIN documents d ON d.source_id = s.id
    LEFT JOIN insights i ON i.document_id = d.id
    WHERE s.company_id = ?
    ORDER BY s.fetch_date DESC
  `).all(companyId) as Array<{
    id: number;
    company_id: string;
    url: string;
    title: string;
    fetch_date: string;
    clean_text: string;
    matched_keywords: string;
    extracted_items: string;
    canonical_url?: string | null;
    published_at?: string | null;
    page_kind?: "list" | "detail" | null;
    completeness_score?: number | null;
    summary?: string;
    insight_type?: string;
    confidence?: number;
    category?: string;
  }>;

  return {
    company: {
      ...company,
      keywords: parseJson(company.keywords, [] as string[])
    },
    documents: documents.map((item) => ({
      ...item,
      matched_keywords: parseJson(item.matched_keywords, [] as string[]),
      extracted_items: parseJson(item.extracted_items, [])
    })) as StoredDocument[]
  };
}

export function getReportData(companyId: string, since?: string) {
  const details = getCompanyDetails(companyId);
  if (!details) {
    return null;
  }

  const documents = since
    ? details.documents.filter((document) => document.fetch_date >= since)
    : details.documents;

  return {
    company: details.company,
    documents
  };
}

export function parseIncludeInactive(input: unknown) {
  if (typeof input !== "string") {
    return false;
  }
  return input === "1" || input.toLowerCase() === "true";
}

export function parseCompanyIdsQuery(input: unknown) {
  // Supports ?company_ids=a&company_ids=b,c and trims / deduplicates empty values.
  const values = Array.isArray(input) ? input : [input];
  const normalized = values
    .flatMap((value) => (typeof value === "string" ? value.split(",") : []))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

export function getJobs() {
  const db = getDb();
  return db.prepare(`
    SELECT *
    FROM crawl_jobs
    ORDER BY id DESC
  `).all() as CrawlJob[];
}

export function getJobDetails(jobId: number) {
  const db = getDb();
  const job = db.prepare(`SELECT * FROM crawl_jobs WHERE id = ?`).get(jobId) as CrawlJob | undefined;
  if (!job) {
    return null;
  }
  const steps = db.prepare(`
    SELECT *
    FROM crawl_job_steps
    WHERE job_id = ?
    ORDER BY company_id ASC, source_url ASC, step_order ASC, id ASC
  `).all(jobId) as CrawlJobStep[];
  return { job, steps };
}

export function getStepDetails(stepId: number) {
  const db = getDb();
  const step = db.prepare(`SELECT * FROM crawl_job_steps WHERE id = ?`).get(stepId) as CrawlJobStep | undefined;
  if (!step) {
    return null;
  }
  return step;
}

export function getInspectorData(stepId: number) {
  const db = getDb();
  const step = getStepDetails(stepId);
  if (!step) {
    return null;
  }

  const llmRun = db.prepare(`
    SELECT *
    FROM llm_runs
    WHERE step_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(stepId) as LlmRunRecord | undefined;

  const source = step.source_url
    ? (db.prepare(`SELECT * FROM sources WHERE url = ?`).get(step.source_url) as
        | { id: number; company_id: string; url: string; title: string; fetch_date: string }
        | undefined)
    : undefined;

  const version = source
    ? (db.prepare(`
        SELECT *
        FROM source_versions
        WHERE source_id = ?
        ORDER BY id DESC
        LIMIT 1
      `).get(source.id) as
        | {
            id: number;
            source_id: number;
            content_hash: string;
            html_snapshot: string;
            clean_text: string;
            extracted_items_json: string;
            from_cache: number;
            is_changed: number;
            published_at?: string | null;
            last_checked_at: string;
            last_fetched_at?: string | null;
            last_changed_at?: string | null;
          }
        | undefined)
    : undefined;

  const sourceRegistry = step.source_url
    ? (db.prepare(`
        SELECT *
        FROM source_registry
        WHERE url = ?
      `).get(step.source_url) as SourceRegistryRecord | undefined)
    : undefined;

  return {
    step,
    llmRun,
    source,
    version: version
      ? {
          ...version,
          extracted_items: parseJson(version.extracted_items_json, [] as Array<Record<string, unknown>>)
        }
      : null,
    sourceRegistry: sourceRegistry
      ? {
          ...sourceRegistry,
          keywords: parseJson(sourceRegistry.keywords_json, [] as string[])
        }
      : null
  };
}

export function getLlmRuns(jobId?: number) {
  const db = getDb();
  const rows = jobId
    ? db.prepare(`SELECT * FROM llm_runs WHERE job_id = ? ORDER BY id DESC`).all(jobId)
    : db.prepare(`SELECT * FROM llm_runs ORDER BY id DESC LIMIT 100`).all();
  return rows as LlmRunRecord[];
}

export function getSourceVersionsByUrls(urls: string[]) {
  if (!urls.length) {
    return [];
  }
  const db = getDb();
  const placeholders = urls.map(() => "?").join(", ");
  return db.prepare(`
    SELECT sv.*, s.url, s.company_id, s.title
    FROM source_versions sv
    JOIN sources s ON s.id = sv.source_id
    WHERE s.url IN (${placeholders})
    ORDER BY sv.id DESC
  `).all(...urls) as Array<Record<string, unknown>>;
}

export function getErrorCenterItems() {
  const db = getDb();
  return db.prepare(`
    SELECT s.id, s.job_id, s.company_id, s.source_url, s.step_name, s.error_message, s.retry_count, s.end_time,
           (
             SELECT MAX(last_success_at) FROM source_registry r WHERE r.url = s.source_url
           ) AS last_success_at
    FROM crawl_job_steps s
    WHERE s.status = 'failed'
    ORDER BY s.id DESC
    LIMIT 200
  `).all() as Array<{
    id: number;
    job_id: number;
    company_id?: string | null;
    source_url?: string | null;
    step_name: string;
    error_message?: string | null;
    retry_count: number;
    end_time?: string | null;
    last_success_at?: string | null;
  }>;
}

export function getTableRows(table: string, limit = 200, options: { includeInactive?: boolean } = {}) {
  const db = getDb();
  const allowedTables = [
    "companies",
    "sources",
    "documents",
    "insights",
    "crawl_jobs",
    "crawl_job_steps",
    "source_versions",
    "llm_runs",
    "source_registry",
    "keyword_sets"
  ];
  if (!allowedTables.includes(table)) {
    throw new Error(`Unsupported table: ${table}`);
  }

  if (options.includeInactive) {
    return db.prepare(`SELECT * FROM ${table} ORDER BY rowid DESC LIMIT ?`).all(limit) as Array<Record<string, unknown>>;
  }

  const activeTableQueries: Partial<Record<string, string>> = {
    companies: `
      SELECT *
      FROM companies
      WHERE is_active = 1
      ORDER BY rowid DESC
      LIMIT ?
    `,
    sources: `
      SELECT s.*
      FROM sources s
      JOIN companies c ON c.id = s.company_id
      WHERE c.is_active = 1
      ORDER BY s.rowid DESC
      LIMIT ?
    `,
    documents: `
      SELECT d.*
      FROM documents d
      JOIN sources s ON s.id = d.source_id
      JOIN companies c ON c.id = s.company_id
      WHERE c.is_active = 1
      ORDER BY d.rowid DESC
      LIMIT ?
    `,
    insights: `
      SELECT i.*
      FROM insights i
      JOIN documents d ON d.id = i.document_id
      JOIN sources s ON s.id = d.source_id
      JOIN companies c ON c.id = s.company_id
      WHERE c.is_active = 1
      ORDER BY i.rowid DESC
      LIMIT ?
    `,
    crawl_job_steps: `
      SELECT cjs.*
      FROM crawl_job_steps cjs
      WHERE cjs.company_id IS NULL
         OR EXISTS (
           SELECT 1
           FROM companies c
           WHERE c.id = cjs.company_id AND c.is_active = 1
         )
      ORDER BY cjs.rowid DESC
      LIMIT ?
    `,
    source_versions: `
      SELECT sv.*
      FROM source_versions sv
      JOIN sources s ON s.id = sv.source_id
      JOIN companies c ON c.id = s.company_id
      WHERE c.is_active = 1
      ORDER BY sv.rowid DESC
      LIMIT ?
    `,
    llm_runs: `
      SELECT lr.*
      FROM llm_runs lr
      JOIN documents d ON d.id = lr.document_id
      JOIN sources s ON s.id = d.source_id
      JOIN companies c ON c.id = s.company_id
      WHERE c.is_active = 1
      ORDER BY lr.rowid DESC
      LIMIT ?
    `,
    source_registry: `
      SELECT sr.*
      FROM source_registry sr
      JOIN companies c ON c.id = sr.company_id
      WHERE c.is_active = 1
      ORDER BY sr.rowid DESC
      LIMIT ?
    `,
    keyword_sets: `
      SELECT ks.*
      FROM keyword_sets ks
      JOIN companies c ON c.id = ks.company_id
      WHERE c.is_active = 1
      ORDER BY ks.rowid DESC
      LIMIT ?
    `
  };

  const activeQuery = activeTableQueries[table];
  if (activeQuery) {
    return db.prepare(activeQuery).all(limit) as Array<Record<string, unknown>>;
  }

  return db.prepare(`SELECT * FROM ${table} ORDER BY rowid DESC LIMIT ?`).all(limit) as Array<Record<string, unknown>>;
}

export function getTableColumns(table: string) {
  const db = getDb();
  return db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value?: string | null;
    pk: number;
  }>;
}

export function getAllInsightItems() {
  const db = getDb();
  return db.prepare(`
    SELECT 
      c.name as company_name,
      s.title,
      s.url,
      s.fetch_date,
      d.published_at,
      i.summary,
      i.insight_type,
      i.category,
      d.completeness_score,
      d.clean_text
    FROM sources s
    JOIN companies c ON c.id = s.company_id
    LEFT JOIN documents d ON d.source_id = s.id
    LEFT JOIN insights i ON d.id = i.document_id
    WHERE c.is_active = 1
      AND s.title IS NOT NULL
      AND s.title != ''
    ORDER BY s.fetch_date DESC
    LIMIT 200
  `).all();
}
