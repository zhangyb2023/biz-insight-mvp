export type CompanyRecord = {
  id: string;
  name: string;
  website: string;
  keywords: string[];
  urls: string[];
  is_active?: boolean;
};

export type UrlType = "news" | "product" | "ecosystem" | "jobs" | "general";

export type SourceType =
  | "company_official"
  | "company_newsroom"
  | "company_product_page"
  | "company_case_study"
  | "recruitment_page"
  | "ecosystem_partner"
  | "industry_media"
  | "generic_news_portal"
  | "social_platform"
  | "video_platform"
  | "document_or_pdf"
  | "unknown";

export type SourceQuality = {
  source_domain: string;
  source_type: SourceType;
  quality_score: number;
  is_high_value: boolean;
  is_noise: boolean;
  noise_reason?: string;
  quality_reason?: string;
  matched_rules?: string[];
  source_signals?: string[];
};

export type CrawlPage = {
  url: string;
  title: string;
  html: string;
  fetchedAt: string;
  checkedAt: string;
  fromCache?: boolean;
  httpStatus?: number;
  cacheAgeHours?: number;
  fetchStrategy?: "playwright" | "firecrawl" | "jina" | "intelligent+jina" | "intelligent+firecrawl" | "tavily+jina" | "intelligent-first" | "playwright_date";
  fallbackUsed?: boolean;
  fallbackReason?: string | null;
  publishedTime?: string;
};

export type CrawlErrorCode =
  | "invalid_url"
  | "navigation_timeout"
  | "navigation_failed"
  | "content_empty"
  | "browser_failed";

export type CrawlFailure = {
  url: string;
  code: CrawlErrorCode;
  message: string;
};

export type ExtractedItem = {
  title: string;
  summary?: string;
  date?: string;
  url?: string;
};

export type ConsumptionCategory = "新闻动态" | "产品" | "技术" | "招聘" | "生态";

export type ConsumptionItem = {
  company_id: string;
  company_name: string;
  url: string;
  canonical_url?: string | null;
  title: string;
  fetch_date: string;
  published_at?: string | null;
  page_kind?: "list" | "detail" | null;
  completeness_score?: number | null;
  extracted_items: ExtractedItem[];
  summary: string;
  insight_type: string;
  category: string;
  confidence: number;
  display_category: ConsumptionCategory;
  source_domain?: string;
  source_type?: SourceType;
  quality_score?: number;
  is_high_value?: boolean;
  is_noise?: boolean;
  noise_reason?: string;
  quality_reason?: string;
  matched_rules?: string[];
  source_signals?: string[];
};

export type ConsumptionQualitySummary = {
  totalItems: number;
  tracedItems: number;
  extractedItems: number;
  summarizedItems: number;
};

export type ConsumptionFilters = {
  companyId?: string;
  companyIds?: string[];
  companyType?: string;
  companyQuery?: string;
  category?: ConsumptionCategory;
  limit?: number;
  includeInactive?: boolean;
  isHighValue?: boolean;
  isNoise?: boolean;
  sourceType?: string;
};

export type ConsumptionCategorySummary = {
  category: ConsumptionCategory;
  count: number;
};

export type ConsumptionSummary = {
  totalItems: number;
  tracedItems: number;
  extractedItems: number;
  summarizedItems: number;
  categories: ConsumptionCategorySummary[];
};

export type ConsumptionCompanySection = {
  id: string;
  name: string;
  website?: string | null;
  keywords: string[];
  document_count: number;
  latest_fetch_date?: string | null;
  type: string;
  total_items: number;
  items: ConsumptionItem[];
  categories: Array<{
    category: ConsumptionCategory;
    items: ConsumptionItem[];
  }>;
};

export type CleanedResult = {
  text: string;
  matchedKeywords: string[];
  extractedItems?: ExtractedItem[];
  canonicalUrl?: string | null;
  publishedAt?: string | null;
  pageKind?: "list" | "detail";
  completenessScore?: number;
};

export type StoredDocument = {
  id: number;
  company_id: string;
  url: string;
  title: string;
  fetch_date: string;
  clean_text: string;
  matched_keywords: string[];
  extracted_items?: ExtractedItem[];
  canonical_url?: string | null;
  published_at?: string | null;
  page_kind?: "list" | "detail" | null;
  completeness_score?: number | null;
  summary?: string;
  insight_type?: string;
  confidence?: number;
  category?: string;
};

export type InsightPayload = {
  summary: string;
  insight_type: string;
  confidence: number;
  category: string;
  key_points: string[];
};

export type LlmRunResult = InsightPayload & {
  provider: string;
  model_name: string;
  prompt_version: string;
  raw_response: string;
  parsed_json: Record<string, unknown>;
  fallback_used: boolean;
  retry_count: number;
  duration_ms: number;
  status: "success" | "fallback" | "failed";
  error_message?: string;
  input_payload: Record<string, unknown>;
};

export type CrawlJobStatus = "running" | "success" | "partial" | "failed";
export type CrawlStepStatus = "pending" | "success" | "failed" | "skipped" | "fallback";
export type TriggerType = "manual" | "scheduled" | "api";

export type CrawlJob = {
  id: number;
  trigger_type: TriggerType;
  status: CrawlJobStatus;
  started_at: string;
  ended_at?: string | null;
  duration_ms?: number | null;
  company_count: number;
  url_count: number;
  success_count: number;
  failure_count: number;
  cache_hit_count: number;
  changed_count: number;
  insight_count: number;
  config_snapshot_json: string;
};

export type CrawlJobStep = {
  id: number;
  job_id: number;
  company_id?: string | null;
  source_url?: string | null;
  step_name: string;
  step_order: number;
  status: CrawlStepStatus;
  duration_ms?: number | null;
  start_time: string;
  end_time?: string | null;
  tool_type: string;
  tool_name: string;
  module_name: string;
  runtime: string;
  input_json?: string | null;
  output_json?: string | null;
  error_message?: string | null;
  retry_count: number;
  fallback_used: number;
  next_step?: string | null;
};

export type SourceRegistryRecord = {
  id: number;
  company_id: string;
  url: string;
  url_type: UrlType;
  crawl_mode?: string | null;
  evaluation_status?: string | null;
  evaluation_score?: number | null;
  evaluation_reason?: string | null;
  fixed_reason?: string | null;
  is_fixed?: number | null;
  fixed_at?: string | null;
  keywords_json: string;
  priority: number;
  enabled: number;
  cache_ttl_hours: number;
  allow_cache: number;
  last_checked_at?: string | null;
  last_fetched_at?: string | null;
  last_changed_at?: string | null;
  last_success_at?: string | null;
  success_rate?: number | null;
  noise_score?: number | null;
  value_score?: number | null;
  deleted_at?: string | null;
};

export type SourceVersionRecord = {
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
};

export type LlmRunRecord = {
  id: number;
  job_id?: number | null;
  step_id?: number | null;
  document_id?: number | null;
  provider: string;
  model_name: string;
  prompt_version: string;
  input_payload_json: string;
  raw_response: string;
  parsed_json: string;
  fallback_used: number;
  retry_count: number;
  duration_ms: number;
  status: string;
  error_message?: string | null;
  created_at: string;
};

export type KeywordSetRecord = {
  id: number;
  company_id: string;
  name: string;
  keywords_json: string;
  version: string;
  enabled: number;
};
