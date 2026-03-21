import crypto from "crypto";
/**
 * 重新提取文档日期 - 基于现有HTML缓存
 * 用法: npx tsx scripts/re-extract-dates.ts
 */
import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import * as cheerio from "cheerio";

const RAW_HTML_DATE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /((?:19|20)\d{2}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:?\d{2}|Z)?)?)/i, label: "ISO8601" },
  { re: /((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(?:0?[1-9]|[12]\d|3[01]),?\s+(?:19|20)\d{2})/i, label: "EN_full" },
  { re: /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(?:0?[1-9]|[12]\d|3[01])\s+(?:19|20)\d{2})/i, label: "EN_short" },
  { re: /((?:19|20)\d{2}年\d{1,2}月\d{1,2}(?:日)?)/i, label: "CN" },
  { re: /((?:19|20)\d{2}\/\d{1,2}\/\d{1,2})/i, label: "YMD_slash" },
  { re: /((?:0?[1-9]|[12]\d|3[01])[.\- \/]?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[.,\/ \-]*(?:19|20)\d{2})/i, label: "DD_Mon_YYYY" },
];

function stripNoise(v: string) { return v.replace(/\s+/g, " ").replace(/[ \t]+\n/g, "\n").trim(); }

function extractDateFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, svg").remove();

  // 策略1: meta标签（Jina/Firecrawl 提取的）
  const metaDate = $("meta[property='article:published_time']").attr("content")
    || $("meta[name='article:published_time']").attr("content")
    || $("meta[property='og:published_time']").attr("content")
    || $("time").first().attr("datetime")
    || $("meta[name='pubdate']").attr("content");
  if (metaDate && stripNoise(metaDate).length >= 6) return stripNoise(metaDate);

  // 策略2: <time>元素
  const timeEl = $("time").first();
  if (timeEl.length) {
    const dt = timeEl.attr("datetime");
    if (dt) return dt;
    const text = stripNoise(timeEl.text());
    if (text.length > 3) return text;
  }

  // 策略3: class含"time"/"date"的元素
  for (const sel of ["[class*='date']", "[class*='time']", "[class*='published']", "[class*='posted']"]) {
    const el = $(sel).first();
    if (el.length) {
      const text = stripNoise(el.text());
      if (text.length > 3 && !/^\d{1,2}:\d{2}$/.test(text) && !/^[\d\s\-:]+$/.test(text)) {
        return text;
      }
    }
  }

  // 策略4: 全局正则扫描
  for (const { re } of RAW_HTML_DATE_PATTERNS) {
    const match = html.match(re);
    if (match && match[1]) {
      const c = match[1];
      if (/\.(com|org|net|cn|gov)\//i.test(c)) continue;
      if (c.length > 40) continue;
      return c;
    }
  }

  return null;
}

const db = new DatabaseSync("db/sqlite.db");

// 找出所有文档（含无日期的）
const rows = db.prepare(`
  SELECT d.id, d.source_id, s.url, d.published_at 
  FROM documents d 
  JOIN sources s ON d.source_id = s.id
`).all() as Array<{id: number; source_id: number; url: string; published_at: string | null}>;

let updated = 0, skipped = 0, error = 0;
const updates: Array<[string, number]> = [];

for (const row of rows) {
  const hash = crypto.createHash("sha1").update(row.url).digest("hex");
  const cachePath = path.join("data", "crawl_cache", `${hash}.json`);
  
  if (!fs.existsSync(cachePath)) { skipped++; continue; }
  
  try {
    const data = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    const html = data.html || "";
    if (!html || html.length < 500) { skipped++; continue; }
    
    const newDate = extractDateFromHtml(html);
    if (newDate && newDate !== row.published_at) {
      updates.push([newDate, row.id]);
      updated++;
    } else {
      skipped++;
    }
  } catch {
    error++;
  }
}

if (updates.length > 0) {
  const stmt = db.prepare("UPDATE documents SET published_at = ? WHERE id = ?");
  for (const [date, id] of updates) {
    stmt.run(date, id);
  }
}

console.log(`\n=== 日期重新提取完成 ===`);
console.log(`总文档: ${rows.length}`);
console.log(`更新: ${updated} | 跳过: ${skipped} | 错误: ${error}`);

// 统计
const withDate = db.prepare("SELECT COUNT(*) FROM documents WHERE published_at IS NOT NULL AND published_at > '2026-01-01'").get() as number;
const withoutDate = db.prepare("SELECT COUNT(*) FROM documents WHERE published_at IS NULL OR published_at <= '2026-01-01'").get() as number;
const total = db.prepare("SELECT COUNT(*) FROM documents").get() as number;
console.log(`\n有2026后日期: ${withDate} (${Math.round(withDate/total*100)}%)`);
console.log(`无有效日期: ${withoutDate}`);

db.close();
