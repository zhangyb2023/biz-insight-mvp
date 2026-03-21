/**
 * 只重新爬取当前无日期的有价值URL
 * 用法: npx tsx scripts/refresh-no-date-urls.ts
 */
import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import https from "https";
import * as cheerio from "cheerio";

// ---- Date extraction (same as cleanText.ts) ----
const RAW_HTML_DATE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /((?:19|20)\d{2}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:?\d{2}|Z)?)?)/i, label: "ISO8601" },
  { re: /((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(?:0?[1-9]|[12]\d|3[01]),?\s+(?:19|20)\d{2})/i, label: "EN_full" },
  { re: /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(?:0?[1-9]|[12]\d|3[01])\s+(?:19|20)\d{2})/i, label: "EN_short" },
  { re: /((?:19|20)\d{2}年\d{1,2}月\d{1,2}(?:日)?)/i, label: "CN" },
  { re: /((?:19|20)\d{2}\/\d{1,2}\/\d{1,2})/i, label: "YMD_slash" },
];

function stripNoise(v: string) { return v.replace(/\s+/g, " ").replace(/[ \t]+\n/g, "\n").trim(); }

function extractDateFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  // Jina-like meta extraction
  const metaDate = $("meta[property='article:published_time']").attr("content")
    || $("meta[name='article:published_time']").attr("content")
    || $("meta[property='og:published_time']").attr("content")
    || $("time").first().attr("datetime")
    || $("meta[name='pubdate']").attr("content");
  if (metaDate && stripNoise(metaDate).length >= 6) return stripNoise(metaDate);

  // <time> elements
  const timeEl = $("time").first();
  if (timeEl.length) {
    const dt = timeEl.attr("datetime");
    if (dt) return dt;
    const text = stripNoise(timeEl.text());
    if (text.length > 3) return text;
  }

  // class*="date"/"time" elements
  for (const sel of ["[class*='date']", "[class*='time']", "[class*='published']", "[class*='posted']"]) {
    const el = $(sel).first();
    if (el.length) {
      const text = stripNoise(el.text());
      if (text.length > 3 && !/^\d{1,2}:\d{2}$/.test(text) && !/^[\d\s\-:]+$/.test(text)) {
        return text;
      }
    }
  }

  // Global regex
  for (const { re } of RAW_HTML_DATE_PATTERNS) {
    const match = html.match(re);
    if (match && match[1]) {
      const c = match[1];
      if (!/\.(com|org|net|cn|gov)\//i.test(c) && c.length <= 40) return c;
    }
  }
  return null;
}

// ---- Jina Reader ----
async function jinaFetch(url: string): Promise<{ html: string; title: string; publishedTime?: string }> {
  return new Promise((resolve) => {
    let body = "";
    const req = https.get(`https://r.jina.ai/${encodeURIComponent(url)}`, { headers: { Accept: "text/plain" } }, (res) => {
      res.on("data", (c) => body += c);
      res.on("end", () => {
        const lines = body.split("\n");
        let title = "", sourceUrl = "", publishedTime = "", contentStart = 0;
        for (const line of lines) {
          if (line.startsWith("Title:")) title = line.slice(6).trim();
          else if (line.startsWith("URL Source:")) sourceUrl = line.slice(11).trim();
          else if (line.startsWith("Published Time:")) publishedTime = line.slice(15).trim();
          else if (line.startsWith("Markdown Content:")) { contentStart = lines.indexOf(line) + 1; break; }
        }
        const content = lines.slice(contentStart).join("\n");
        resolve({ html: content, title: title || sourceUrl, publishedTime: publishedTime || undefined });
      });
    });
    req.on("error", (e) => resolve({ html: "", title: url }));
    req.setTimeout(25000, () => { req.destroy(); resolve({ html: "", title: url }); });
  });
}

// ---- Filter: only truly valuable news URLs ----
const SKIP_PATHS = new Set([
  "", "about", "standards", "classic-platform", "index.html", "homez",
  "contact", "careers", "jobs", "unsupported", "not-found",
  "products", "product", "solution", "solutions", "index",
  "a-z", "az", "product-a-z", "global-en",
]);

function isWorthCrawling(url: string, cleanText: string): boolean {
  const u = new URL(url);
  const path = u.pathname.replace(/\/$/, "").split("/").pop() || "";
  const sample = (cleanText || "").slice(0, 200).toLowerCase();

  if (SKIP_PATHS.has(path.toLowerCase())) return false;
  if (sample.includes("page not found") || sample.includes("unavailable")) return false;
  if (/autosar adaptive|autosar classic|产品\s|platform\s|contact us/i.test(sample)) return false;

  // Has actual content indicators
  const hasNewsSignal = /新闻|动态|公告|发布|年会|奖项|合作|推出|融资|发布|award|release|announc/i.test(sample);
  const hasLongContent = (cleanText || "").length > 200;
  return hasNewsSignal || hasLongContent;
}

// ---- Main ----
async function main() {
const db = new DatabaseSync("db/sqlite.db");

// Get docs without valid dates
const noDateDocs = db.prepare(`
  SELECT d.id as doc_id, s.id as source_id, s.url, d.clean_text
  FROM documents d JOIN sources s ON d.source_id = s.id
  WHERE d.published_at IS NULL OR d.published_at <= '2026-01-01'
`).all() as Array<{doc_id: number; source_id: number; url: string; clean_text: string}>;

// Filter to worth-crawling
const targets = noDateDocs.filter(d => isWorthCrawling(d.url, d.clean_text));

console.log("需要重新爬取的URL: " + targets.length + "条\n");

const updated: string[] = [];
const failed: string[] = [];

for (const doc of targets) {
  const domain = doc.url.split("/")[2];
  process.stdout.write("[" + (updated.length + failed.length + 1) + "/" + targets.length + "] " + domain + "... ");

  try {
    const result = await jinaFetch(doc.url);
    const date = extractDateFromHtml(result.html);

    if (date) {
      db.prepare("UPDATE documents SET published_at = ? WHERE id = ?").run(date, doc.doc_id);
      // Also update the crawl cache
      const hash = crypto.createHash("sha1").update(doc.url).digest("hex");
      const cachePath = path.join("data", "crawl_cache", hash + ".json");
      if (fs.existsSync(cachePath)) {
        const cached = JSON.parse(fs.readFileSync(cachePath, "utf8"));
        cached.html = result.html;
        cached.title = result.title;
        fs.writeFileSync(cachePath, JSON.stringify(cached, null, 2));
      }
      console.log("✅ " + date);
      updated.push(domain + ": " + date);
    } else {
      console.log("❌ 无日期 (content: " + result.html.length + "B)");
      failed.push(domain);
    }
  } catch (e) {
    console.log("❌ 错误: " + e);
    failed.push(domain);
  }

  // Rate limit: 1 request per second
  await new Promise(r => setTimeout(r, 1000));
}

db.close();

console.log("\n=== 完成 ===");
console.log("成功: " + updated.length + " | 失败: " + failed.length);
console.log("\n成功示例:");
updated.slice(0, 10).forEach(u => console.log("  ✅ " + u));
}

main().catch(e => { console.error(e); process.exit(1); });