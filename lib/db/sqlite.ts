import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const dbDir = path.join(process.cwd(), "db");
const dbPath = path.join(dbDir, "sqlite.db");

let dbInstance: DatabaseSync | undefined;

function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function ensureTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      website TEXT NOT NULL,
      keywords TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      fetch_date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL UNIQUE,
      clean_text TEXT NOT NULL,
      matched_keywords TEXT NOT NULL,
      extracted_items TEXT NOT NULL DEFAULT '[]',
      canonical_url TEXT,
      published_at TEXT,
      page_kind TEXT,
      completeness_score REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      insight_type TEXT NOT NULL,
      confidence REAL NOT NULL,
      category TEXT NOT NULL,
      key_points TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crawl_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_type TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_ms INTEGER,
      company_count INTEGER NOT NULL DEFAULT 0,
      url_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      failure_count INTEGER NOT NULL DEFAULT 0,
      cache_hit_count INTEGER NOT NULL DEFAULT 0,
      changed_count INTEGER NOT NULL DEFAULT 0,
      insight_count INTEGER NOT NULL DEFAULT 0,
      config_snapshot_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS crawl_job_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      company_id TEXT,
      source_url TEXT,
      step_name TEXT NOT NULL,
      step_order INTEGER NOT NULL,
      status TEXT NOT NULL,
      duration_ms INTEGER,
      start_time TEXT NOT NULL,
      end_time TEXT,
      tool_type TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      module_name TEXT NOT NULL,
      runtime TEXT NOT NULL,
      input_json TEXT,
      output_json TEXT,
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      fallback_used INTEGER NOT NULL DEFAULT 0,
      next_step TEXT
    );

    CREATE TABLE IF NOT EXISTS source_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      html_snapshot TEXT NOT NULL,
      clean_text TEXT NOT NULL,
      extracted_items_json TEXT NOT NULL DEFAULT '[]',
      canonical_url TEXT,
      from_cache INTEGER NOT NULL DEFAULT 0,
      is_changed INTEGER NOT NULL DEFAULT 0,
      published_at TEXT,
      page_kind TEXT,
      completeness_score REAL DEFAULT 0,
      last_checked_at TEXT NOT NULL,
      last_fetched_at TEXT,
      last_changed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS llm_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER,
      step_id INTEGER,
      document_id INTEGER,
      provider TEXT NOT NULL,
      model_name TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      input_payload_json TEXT NOT NULL,
      raw_response TEXT NOT NULL,
      parsed_json TEXT NOT NULL,
      fallback_used INTEGER NOT NULL DEFAULT 0,
      retry_count INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS source_registry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      url_type TEXT NOT NULL DEFAULT 'general',
      crawl_mode TEXT DEFAULT 'auto',
      evaluation_status TEXT DEFAULT 'unknown',
      evaluation_score REAL DEFAULT 0,
      evaluation_reason TEXT,
      fixed_reason TEXT,
      is_fixed INTEGER NOT NULL DEFAULT 0,
      fixed_at TEXT,
      keywords_json TEXT NOT NULL DEFAULT '[]',
      priority INTEGER NOT NULL DEFAULT 100,
      enabled INTEGER NOT NULL DEFAULT 1,
      cache_ttl_hours INTEGER NOT NULL DEFAULT 24,
      allow_cache INTEGER NOT NULL DEFAULT 1,
      last_checked_at TEXT,
      last_fetched_at TEXT,
      last_changed_at TEXT,
      last_success_at TEXT,
      success_rate REAL DEFAULT 0,
      noise_score REAL DEFAULT 0,
      value_score REAL DEFAULT 0,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS keyword_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      keywords_json TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT 'v1',
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

function ensureLegacyColumns(db: DatabaseSync) {
  ensureColumn(db, "companies", "is_active", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "documents", "extracted_items", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "documents", "canonical_url", "TEXT");
  ensureColumn(db, "documents", "published_at", "TEXT");
  ensureColumn(db, "documents", "page_kind", "TEXT");
  ensureColumn(db, "documents", "completeness_score", "REAL DEFAULT 0");
  ensureColumn(db, "source_versions", "canonical_url", "TEXT");
  ensureColumn(db, "source_versions", "page_kind", "TEXT");
  ensureColumn(db, "source_versions", "completeness_score", "REAL DEFAULT 0");
  ensureColumn(db, "source_registry", "deleted_at", "TEXT");
  ensureColumn(db, "source_registry", "crawl_mode", "TEXT DEFAULT 'auto'");
  ensureColumn(db, "source_registry", "evaluation_status", "TEXT DEFAULT 'unknown'");
  ensureColumn(db, "source_registry", "evaluation_score", "REAL DEFAULT 0");
  ensureColumn(db, "source_registry", "evaluation_reason", "TEXT");
  ensureColumn(db, "source_registry", "fixed_reason", "TEXT");
  ensureColumn(db, "source_registry", "is_fixed", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "source_registry", "fixed_at", "TEXT");
}

export function getDb() {
  if (!dbInstance) {
    fs.mkdirSync(dbDir, { recursive: true });
    dbInstance = new DatabaseSync(dbPath);
    ensureTables(dbInstance);
    ensureLegacyColumns(dbInstance);
  }

  return dbInstance;
}
