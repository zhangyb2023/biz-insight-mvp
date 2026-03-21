export type SkillErrorCode =
  | "invalid_input"
  | "crawl_failed"
  | "clean_failed"
  | "all_failed";

export type ExtractedListItem = {
  title: string;
  summary?: string;
  date?: string;
};

export type CleanedData = {
  url: string;
  company: string;
  title: string;
  clean_text: string;
  matched_keywords: string[];
  fetched_at: string;
  extracted_items: ExtractedListItem[];
  canonical_url?: string | null;
  published_at?: string | null;
  page_kind?: "list" | "detail";
  completeness_score?: number;
  meta: {
    from_cache: boolean;
    text_length: number;
  };
};

export type FetchAndCleanError = {
  url?: string;
  code: SkillErrorCode | string;
  message: string;
};

export type FetchAndCleanStats = {
  requested: number;
  fetched: number;
  succeeded: number;
  failed: number;
  from_cache: number;
  duration_ms: number;
};

export type FetchAndCleanOptions = {
  timeoutMs?: number;
  concurrency?: number;
  useCache?: boolean;
  forceRefresh?: boolean;
  cacheMaxAgeHours?: number;
};

export type FetchAndCleanResult = {
  ok: boolean;
  company: string;
  stats: FetchAndCleanStats;
  results: CleanedData[];
  errors: FetchAndCleanError[];
};

export type BatchFetchRequest = {
  companyName: string;
  urls: string[];
  keywords: string[];
  options?: FetchAndCleanOptions;
};

export type BatchFetchAndCleanResult = {
  ok: boolean;
  total: number;
  succeeded: number;
  failed: number;
  duration_ms: number;
  batches: FetchAndCleanResult[];
};
