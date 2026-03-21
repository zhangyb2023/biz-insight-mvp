/**
 * Playwright 日期提取 - 专门对付 JS 渲染站
 * 当 Jina/Firecrawl 拿不到日期时，使用 Playwright 渲染后提取
 */
import { chromium, type Page } from "playwright";

const TIMEOUT_MS = 20000;

// 专业站点常见日期选择器（按优先级排列）
const DATE_SELECTOR_STRATEGIES = [
  // 最常见的选择器
  "time[datetime]",
  "article time",
  ".article time",
  "article .date",
  "article .time",
  "article .publish-date",
  "article .published-date",
  "article .post-date",
  // 新闻列表项
  ".news-list .date",
  ".news-list .time",
  ".news-list .publish-date",
  ".news-item .date",
  ".news-item .time",
  ".article-list .date",
  ".article-list .time",
  ".post-list .date",
  ".post-list .time",
  // 通用
  "[class*='publish-date']",
  "[class*='published-date']",
  "[class*='post-date']",
  "[class*='news-date']",
  "[class*='article-date']",
  "[class*='date'][class*='time']",
  "[class*='time'][class*='date']",
  "time",
  // 备选
  ".date",
  ".time",
  ".publishTime",
  ".publish_time",
  ".article-time",
];

// 日期正则模式
const DATE_PATTERNS = [
  { re: /((?:19|20)\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:?\d{2}|Z)?)/i, label: "ISO" },
  { re: /((?:19|20)\d{2}-\d{2}-\d{2})/i, label: "ISO_DATE" },
  { re: /((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(?:0?[1-9]|[12]\d|3[01]),?\s+(?:19|20)\d{2})/i, label: "EN_LONG" },
  { re: /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(?:0?[1-9]|[12]\d|3[01])\s+(?:19|20)\d{2})/i, label: "EN_SHORT" },
  { re: /((?:19|20)\d{2}年\d{1,2}月\d{1,2}(?:日)?)/i, label: "CN" },
  { re: /((?:19|20)\d{2}\/\d{1,2}\/\d{1,2})/i, label: "YMD" },
];

function stripNoise(v: string) {
  return v.replace(/\s+/g, " ").replace(/[ \t]+\n/g, "\n").trim();
}

function deriveDate(value: string): string | null {
  for (const { re } of DATE_PATTERNS) {
    const match = stripNoise(value).match(re);
    if (match && match[1]) {
      const c = match[1];
      if (/\.(com|org|net|cn|gov)\//i.test(c)) continue;
      if (c.length > 40) continue;
      return c;
    }
  }
  return null;
}

/**
 * 从 Playwright Page 中提取日期
 * @param page Playwright page instance
 * @param url 用于从 URL 中提取日期
 */
async function extractDateFromPage(page: Page, url: string): Promise<{ date: string | null; method: string; html: string }> {
  // 策略1: 从 URL 提取日期
  const urlDateMatch = url.match(/\/((?:19|20)\d{2})[-/年](\d{1,2})[-/月](\d{1,2})[\/\-]/);
  if (urlDateMatch) {
    const [, year, month, day] = urlDateMatch;
    return {
      date: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
      method: "url_date",
      html: ""
    };
  }

  // 策略2: 遍历选择器，找第一个有效日期
  for (const selector of DATE_SELECTOR_STRATEGIES) {
    try {
      const elements = await page.locator(selector).all();
      for (const el of elements) {
        try {
          // 1. datetime 属性
          const dt = await el.getAttribute("datetime");
          if (dt && stripNoise(dt).length >= 6) {
            return { date: stripNoise(dt), method: `selector:${selector}[datetime]`, html: "" };
          }
          // 2. text content
          const text = await el.textContent();
          if (text) {
            const cleaned = stripNoise(text);
            if (cleaned.length >= 4 && cleaned.length <= 60) {
              const derived = deriveDate(cleaned);
              if (derived) {
                return { date: derived, method: `selector:${selector}[text]`, html: "" };
              }
            }
          }
        } catch {
          // continue
        }
      }
    } catch {
      // 选择器不匹配，继续下一个
    }
  }

  // 策略3: 获取完整 HTML，做全局正则扫描
  const html = await page.content();
  for (const { re, label } of DATE_PATTERNS) {
    const match = html.match(re);
    if (match && match[1]) {
      const c = match[1];
      if (/\.(com|org|net|cn|gov)\//i.test(c)) continue;
      if (c.length > 40) continue;
      return { date: c, method: `regex:${label}`, html };
    }
  }

  return { date: null, method: "none", html };
}

export interface PlaywrightDateResult {
  date: string | null;
  method: string;
  html: string;
  title: string;
  success: boolean;
}

/**
 * 使用 Playwright 渲染页面并提取日期
 * @param url 目标 URL
 * @param waitMs 等待 JS 渲染的时间（默认 3000ms）
 */
export async function playwrightDateExtract(url: string, waitMs = 3000): Promise<PlaywrightDateResult> {
  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_MS
    });

    const statusCode = response?.status() ?? 200;

    // 等待 JS 渲染
    await page.waitForTimeout(waitMs);

    // 额外等待：等网络空闲（最多等待 2s）
    try {
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => { });
    } catch { }

    const title = await page.title();

    // 提取日期
    const result = await extractDateFromPage(page, url);

    // 获取 HTML（带 JS 渲染内容）
    const html = await page.content();

    await context.close();

    return {
      date: result.date,
      method: result.method,
      html,
      title,
      success: statusCode >= 200 && statusCode < 400
    };
  } catch (error) {
    return {
      date: null,
      method: `error:${String(error).slice(0, 50)}`,
      html: "",
      title: "",
      success: false
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => { });
    }
  }
}
