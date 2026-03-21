import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

import type { CleanedResult, ExtractedItem } from "@/lib/types";

// Extend these selector groups as we encounter more site patterns.
const LINK_TEXT_SELECTORS = ["main a", "article a", ".news a", ".list a", "section a", "li a"];
const LIST_BLOCK_SELECTORS = [
  "[class*='loopitem']",
  ".newsItem",
  ".news-item",
  ".article-item",
  "article.elementor-post",
  ".elementor-post",
  "article",
  ".news li",
  ".list li",
  ".news_list li",
  ".xw_list li",
  ".xx_list li",
  ".xwzx li",
  ".articleList li",
  ".ewb-data li",
  ".list_news li",
  "[class*='news-list'] li",
  "[class*='newslist'] li",
  "[class*='list'] li"
];
const PRODUCT_TEXT_SELECTORS = [
  ".m2pubTop_des",
  ".m2proac1rLay",
  ".m2proaLswiper",
  "[class*='product'] p",
  "[class*='product'] strong",
  "[class*='product'] h6",
  "[class*='product'] h5",
  "[class*='detail'] p",
  "[class*='detail'] li",
  "[class*='content'] p",
  "[class*='content'] li"
];
const LIST_TITLE_SELECTORS = [
  ".e_text-5 a",
  ".tit",
  ".elementor-post__title a",
  ".elementor-post__title",
  ".entry-title a",
  ".entry-title",
  ".e_text-5",
  ".title",
  "h3",
  "h4",
  "a"
];
const SUMMARY_SELECTORS = [
  ".e_text-6 a",
  ".txetCont p",
  ".elementor-post__excerpt p",
  ".excerpt",
  ".summary",
  ".desc",
  "p"
];
const DATE_SELECTORS = [
  ".e_timeFormat-9",
  "time",
  ".date",
  ".elementor-post-date",
  "[class*='date']",
  "[class*='time']"
];
const DATE_REGEX =
  /((?:19|20)\d{2}[-/.年](?:0?[1-9]|1[0-2])[-/.月](?:0?[1-9]|[12]\d|3[01])(?:日)?|(?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])[-/.](?:19|20)\d{2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[\\s.]+(?:0?[1-9]|[12]\\d|3[01]),?\\s+(?:19|20)\\d{2})/i;

// 原始HTML日期提取的正则模式（覆盖专业站点常见格式）
const RAW_HTML_DATE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /((?:19|20)\d{2}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:?\d{2}|Z)?)?)/i, label: "ISO8601" },
  { re: /((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(?:0?[1-9]|[12]\d|3[01]),?\s+(?:19|20)\d{2})/i, label: "EN_full" },
  { re: /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(?:0?[1-9]|[12]\d|3[01])\s+(?:19|20)\d{2})/i, label: "EN_short" },
  { re: /((?:19|20)\d{2}年\d{1,2}月\d{1,2}(?:日)?)/i, label: "CN" },
  { re: /((?:19|20)\d{2}\/\d{1,2}\/\d{1,2})/i, label: "YMD_slash" },
  { re: /((?:0?[1-9]|[12]\d|3[01])[.\- \/]?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[.,\/ \-]*(?:19|20)\d{2})/i, label: "DD_Mon_YYYY" },
];

/**
 * 从原始HTML中提取日期（对付专业站点日期藏在导航区的情况）
 */
function extractDateFromRawHtml(rawHtml: string): { date: string; method: string } | null {
  // 策略1: <time datetime="..."> 元素
  for (const m of rawHtml.matchAll(/<time[^>]*?(?:datetime=["']([^"']+)["']|[^>]*)>([^<]{1,80})<\/time>/gi)) {
    const dt = m[0].match(/datetime=["']([^"']+)["']/i);
    if (dt) return { date: dt[1], method: "time[datetime]" };
    const text = stripNoise(m[2]);
    if (text && text.length > 3) return { date: text, method: "time[text]" };
  }
  // 策略2: class含"time"/"date"/"published"元素
  for (const m of rawHtml.matchAll(/<[a-z][^>]*class="[^"]*(?:\btime\b|\bdate\b|\bpublished\b|\bposted\b)[^"]*"[^>]*>([^<]{3,80})/gi)) {
    const text = stripNoise(m[1]);
    if (text && text.length > 3 && !/^\d{1,2}:\d{2}$/.test(text) && !/^[\d\s\-:]+$/.test(text)) {
      return { date: text, method: "dateClassElement" };
    }
  }
  // 策略3: 全局正则扫描
  for (const { re, label } of RAW_HTML_DATE_PATTERNS) {
    const match = rawHtml.match(re);
    if (match && match[1]) {
      const c = match[1];
      if (/\.(com|org|net|cn|gov)\//i.test(c)) continue;
      if (c.length > 40) continue;
      return { date: c, method: `rawHtml:${label}` };
    }
  }
  return null;
}


const LOW_VALUE_TITLE_REGEX =
  /(首页|关于我们|联系我们|加入我们|更多|上一页|下一页|在线留言|在线咨询|登录|注册|English|中文|繁體|手机版|无障碍|点击查看更多|实时热点|免费下载|视频公开课|广告|推广|立即下载|奇幻|绝世高手|高能调解员|万丈红尘|都市一等奇医|超强神尊|房东|战神|神医|赘婿|龙王|红颜|逆袭|修仙|兵王|总裁|豪门|仙尊|都市)/i;
const NEWS_HREF_REGEX =
  /(\/(?:19|20)\d{2}-\d{2}-\d{2}\/|doc-[a-z0-9]+|article[_-]\d+|slide\.news|news\.sina|news\.163|\/w\/|\/c\/|\/gov\/|\/zx\/|\/roll\/|subject-\d+)/i;

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").replace(/[ \t]+\n/g, "\n").trim();
}

function stripNoise(value: string) {
  return normalizeText(
    value
      .replace(/查看详情\s*»?/g, " ")
      .replace(/learn more/gi, " ")
      .replace(/read more/gi, " ")
      .replace(/accept (all|cookies)/gi, " ")
      .replace(/cookie settings/gi, " ")
      .replace(/privacy preference center/gi, " ")
      .replace(/allow all cookies/gi, " ")
      .replace(/save settings/gi, " ")
      .replace(/confirm my choices/gi, " ")
      .replace(/联系我们[\s\S]{0,120}?@[\w.-]+/g, " ")
      .replace(/产品技术咨询[\s\S]{0,120}/g, " ")
      .replace(/服务热线[\s\S]{0,80}/g, " ")
  );
}

function deriveDate(value: string) {
  const match = stripNoise(value).match(DATE_REGEX);
  return match?.[1];
}

function toAbsoluteUrl(candidate: string | undefined, sourceUrl?: string) {
  if (!candidate) {
    return null;
  }
  try {
    return new URL(candidate, sourceUrl).toString();
  } catch {
    return null;
  }
}

function normalizeCandidateUrl(candidate: string | undefined, sourceUrl?: string) {
  const absoluteUrl = toAbsoluteUrl(candidate, sourceUrl);
  if (!absoluteUrl) {
    return null;
  }

  try {
    const parsed = new URL(absoluteUrl);
    if (["mailto:", "tel:", "javascript:"].includes(parsed.protocol)) {
      return null;
    }
    if (/\.(?:pdf|jpg|jpeg|png|gif|svg|webp|zip|rar|docx?|xlsx?|pptx?)$/i.test(parsed.pathname)) {
      return null;
    }
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|spm|from|source|fbclid|gclid|mkt_tok)/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inferAnchorUrl($: cheerio.CheerioAPI, root: cheerio.Cheerio<any>, sourceUrl?: string, expectedTitle?: string) {
  const anchors = root
    .find("a[href]")
    .toArray()
    .map((anchor) => ({
      text: normalizeTitleLikeText($(anchor).text()),
      url: normalizeCandidateUrl($(anchor).attr("href"), sourceUrl)
    }))
    .filter((item) => item.url);

  if (!anchors.length) {
    return undefined;
  }

  const preferred =
    anchors.find((item) => expectedTitle && item.text === expectedTitle) ||
    anchors.find((item) => item.text) ||
    anchors[0];

  return preferred?.url ?? undefined;
}

function extractCanonicalUrl($: cheerio.CheerioAPI, sourceUrl?: string) {
  const canonical =
    $("link[rel='canonical']").attr("href") ||
    $("meta[property='og:url']").attr("content") ||
    $("meta[name='og:url']").attr("content");

  return toAbsoluteUrl(canonical, sourceUrl) ?? sourceUrl ?? null;
}

function extractPublishedAt($: cheerio.CheerioAPI, extractedItems: ExtractedItem[], crawlerPublishedTime: string | undefined, sourceUrl: string | undefined, rawHtml?: string) {
  // 优先使用爬取工具（Jina/Firecrawl）提取的发布时间
  if (crawlerPublishedTime && stripNoise(crawlerPublishedTime).length >= 6) {
    return stripNoise(crawlerPublishedTime);
  }

  const structuredSignals = [
    $("meta[property='article:published_time']").attr("content"),
    $("meta[name='article:published_time']").attr("content"),
    $("meta[property='og:published_time']").attr("content"),
    $("time").first().attr("datetime"),
    $("meta[name='pubdate']").attr("content")
  ].filter(Boolean) as string[];

  const directSignal = structuredSignals.find((value) => stripNoise(value).length >= 6);
  if (directSignal) {
    return stripNoise(directSignal);
  }

  const extractedDate = extractedItems.find((item) => item.date?.trim())?.date?.trim();
  if (extractedDate) {
    return extractedDate;
  }

  // 从URL中提取日期（如 /2024-01-15/ 或 /20240115/）- 优先于body提取
  if (sourceUrl) {
    const urlDateMatch = sourceUrl.match(/\/(\d{4})[年\-](\d{1,2})[月\-](\d{1,2})[\/\-]/);
    if (urlDateMatch) {
      const [, year, month, day] = urlDateMatch;
      const paddedMonth = month.padStart(2, "0");
      const paddedDay = day.padStart(2, "0");
      return `${year}-${paddedMonth}-${paddedDay}`;
    }
    const compactDateMatch = sourceUrl.match(/\/(\d{4})(\d{2})(\d{2})[\/\-]/);
    if (compactDateMatch) {
      const [, year, month, day] = compactDateMatch;
      return `${year}-${month}-${day}`;
    }
  }

  // Fallback 1: 从原始HTML提取（对付专业站点日期藏在导航区的情况）
  if (rawHtml) {
    const rawResult = extractDateFromRawHtml(rawHtml);
    if (rawResult) {
      return rawResult.date;
    }
  }

  // Fallback 2: 从Readability提取的body正文提取
  const bodyDate = deriveDate($("main, article, body").text().slice(0, 2400));
  return bodyDate ?? null;
}

function inferPageKind(input: {
  title: string;
  readableText: string;
  structuredItems: ExtractedItem[];
  newsLinkItems: ExtractedItem[];
  portalItems: ExtractedItem[];
}) {
  const titleLooksLikeList = /(news|press|blog|资讯|新闻|动态|列表|汇总|专题)/i.test(input.title);
  const listItemCount = Math.max(input.structuredItems.length, input.newsLinkItems.length, input.portalItems.length);

  if (listItemCount >= 4 && input.readableText.length < 1200) {
    return "list" as const;
  }

  if (titleLooksLikeList && listItemCount >= 3 && input.readableText.length < 900) {
    return "list" as const;
  }

  return "detail" as const;
}

function computeCompletenessScore(input: {
  title: string;
  canonicalUrl?: string | null;
  publishedAt?: string | null;
  pageKind: "list" | "detail";
  finalText: string;
  extractedItems: ExtractedItem[];
}) {
  const weights = {
    title: 0.15,
    canonicalUrl: 0.15,
    publishedAt: input.pageKind === "detail" ? 0.2 : 0.1,
    content: 0.35,
    structure: 0.15
  };

  let score = 0;
  if (input.title.trim()) {
    score += weights.title;
  }
  if (input.canonicalUrl) {
    score += weights.canonicalUrl;
  }
  if (input.publishedAt) {
    score += weights.publishedAt;
  }
  if (input.finalText.trim().length >= (input.pageKind === "detail" ? 400 : 180)) {
    score += weights.content;
  }
  if (input.pageKind === "detail" || input.extractedItems.length > 0) {
    score += weights.structure;
  }

  return Number(score.toFixed(2));
}

function normalizeTitleLikeText(value: string) {
  const text = stripNoise(value);
  if (!text) {
    return "";
  }
  if (text.length < 8 || text.length > 180) {
    return "";
  }
  if (LOW_VALUE_TITLE_REGEX.test(text)) {
    return "";
  }
  return text;
}

function removeSelectorList($: cheerio.CheerioAPI, selectors: string[]) {
  for (const selector of selectors) {
    $(selector).remove();
  }
}

function detectUnavailableNotice($: cheerio.CheerioAPI, title: string) {
  const text = stripNoise($("main, article, body").text()).slice(0, 4000);
  const patterns = [
    /the news record is not available anymore/i,
    /record is not available anymore/i,
    /page not found/i,
    /内容不存在|记录不存在|页面不存在|该页面不存在|该记录不存在/
  ];
  const matched = patterns.find((pattern) => pattern.test(text));
  if (!matched) {
    return "";
  }
  return [title, "Source status: unavailable", matched.source].filter(Boolean).join("\n\n");
}

function extractListLikeText($: cheerio.CheerioAPI) {
  const items = new Set<string>();

  for (const selector of LINK_TEXT_SELECTORS) {
    $(selector).each((_, element) => {
      const text = normalizeTitleLikeText($(element).text());
      if (!text) {
        return;
      }
      items.add(text);
    });
  }

  for (const selector of LIST_BLOCK_SELECTORS) {
    $(selector).each((_, element) => {
      const text = stripNoise($(element).text());
      if (!text || text.length < 20 || text.length > 400) {
        return;
      }
      if (!DATE_REGEX.test(text)) {
        return;
      }
      items.add(text);
    });
  }

  return [...items].slice(0, 20).join(" ");
}

function extractStructuredListItems($: cheerio.CheerioAPI, sourceUrl?: string) {
  const items: ExtractedItem[] = [];

  for (const selector of LIST_BLOCK_SELECTORS) {
    $(selector).each((_, element) => {
      const root = $(element);
      const titleCandidate =
        LIST_TITLE_SELECTORS.map((item) => root.find(item).first().text()).find((item) => normalizeTitleLikeText(item)) ||
        root.find("img").first().attr("alt") ||
        root.find("img").first().attr("title") ||
        "";
      const title = normalizeTitleLikeText(titleCandidate);
      if (!title) {
        return;
      }

      const summaryCandidate = SUMMARY_SELECTORS.map((item) => root.find(item).first().text()).find(Boolean) || root.text();
      const summary = stripNoise(summaryCandidate).replace(title, "").trim();
      const dateCandidate = DATE_SELECTORS.map((item) => root.find(item).first().text()).find(Boolean) || root.text();
      const date = deriveDate(dateCandidate);

      items.push({
        title,
        summary: summary && summary !== title ? summary.slice(0, 280) : undefined,
        date,
        url: inferAnchorUrl($, root, sourceUrl, title)
      });
    });

    if (items.length) {
      break;
    }
  }

  const deduped = new Map<string, (typeof items)[number]>();
  for (const item of items) {
    const key = `${item.title}:${item.date ?? ""}`;
    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  }

  return [...deduped.values()].slice(0, 12);
}

function extractPortalStructuredItems($: cheerio.CheerioAPI, sourceUrl?: string) {
  const items: ExtractedItem[] = [];

  for (const selector of LIST_BLOCK_SELECTORS) {
    $(selector).each((_, element) => {
      const root = $(element);
      const links = root.find("a");
      if (!links.length) {
        return;
      }

      const bestLink = links
        .toArray()
        .map((anchor) => normalizeTitleLikeText($(anchor).text()))
        .find(Boolean);

      if (!bestLink) {
        return;
      }

      const fullText = stripNoise(root.text());
      const date = deriveDate(fullText);
      const summary = fullText.replace(bestLink, "").replace(date ?? "", "").trim();

      items.push({
        title: bestLink,
        summary: summary ? summary.slice(0, 220) : undefined,
        date,
        url: inferAnchorUrl($, root, sourceUrl, bestLink)
      });
    });

    if (items.length >= 6) {
      break;
    }
  }

  const deduped = new Map<string, (typeof items)[number]>();
  for (const item of items) {
    const key = `${item.title}:${item.date ?? ""}`;
    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  }

  return [...deduped.values()].slice(0, 15);
}

function hasLowValueStructuredItems(items: ExtractedItem[]) {
  if (!items.length) {
    return false;
  }
  const lowValueCount = items.filter((item) => LOW_VALUE_TITLE_REGEX.test(item.title)).length;
  return lowValueCount === items.length || (items.length <= 2 && lowValueCount >= 1);
}

function extractNewsLinkItems($: cheerio.CheerioAPI, sourceUrl?: string) {
  const items: ExtractedItem[] = [];

  $("a[href]").each((_, element) => {
    const root = $(element);
    const href = root.attr("href") || "";
    if (!NEWS_HREF_REGEX.test(href)) {
      return;
    }

    const title = normalizeTitleLikeText(root.text());
    if (!title) {
      return;
    }

    const nearbyText = stripNoise(root.parent().text() || root.closest("li,div,article").text() || "");
    const date = deriveDate(nearbyText);
    const summary = stripNoise(nearbyText.replace(title, "").replace(date ?? "", "").trim());

    items.push({
      title,
      summary: summary ? summary.slice(0, 220) : undefined,
      date,
      url: normalizeCandidateUrl(href, sourceUrl) ?? undefined
    });
  });

  const deduped = new Map<string, (typeof items)[number]>();
  for (const item of items) {
    const key = `${item.title}:${item.date ?? ""}`;
    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  }

  return [...deduped.values()].slice(0, 20);
}

function extractProductLikeText($: cheerio.CheerioAPI) {
  const items = new Set<string>();

  for (const selector of PRODUCT_TEXT_SELECTORS) {
    $(selector).each((_, element) => {
      const text = stripNoise($(element).text());
      if (!text || text.length < 18 || text.length > 600) {
        return;
      }
      if (/(申请表|隐私政策|在线咨询|立即提交|请输入|搜索|工作时间|快速解答)/.test(text)) {
        return;
      }
      items.add(text);
    });
  }

  return [...items].slice(0, 18).join(" ");
}

export function cleanText(html: string, keywords: string[], sourceUrl?: string, crawlerPublishedTime?: string): CleanedResult {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, svg").remove();
  removeSelectorList($, [
    "header",
    "footer",
    "nav",
    "aside",
    "form",
    ".cookie",
    ".cookies",
    ".breadcrumb",
    ".share",
    ".language",
    ".nav",
    ".menu",
    ".footer",
    "#onetrust-banner-sdk",
    "#onetrust-consent-sdk",
    "#onetrust-pc-sdk",
    "#onetrust-group-container",
    "#onetrust-button-group-parent",
    "[id*='onetrust']",
    "[class*='onetrust']",
    "[id*='cookie']",
    "[class*='cookie']",
    "[id*='consent']",
    "[class*='consent']",
    "[aria-label*='cookie']",
    "[aria-label*='consent']",
    "[data-nosnippet='true']",
    ".dsNone",
    ".m2spBg",
    ".m2spLayerWpr",
    ".m2spLayer",
    ".m2spLyfm",
    ".m2webBom",
    ".m2spLy_bmdes",
    ".m2kfCke",
    ".mkfBtn",
    ".validateItemFP",
    "[class*='popup']",
    "[class*='consult']"
  ]);

  const dom = new JSDOM($.html(), {
    url: "https://local-cleaner.invalid/"
  });
  const readable = new Readability(dom.window.document).parse();

  const title = readable?.title?.trim() || $("title").text().trim();
  const unavailableNotice = detectUnavailableNotice($, title);
  if (unavailableNotice) {
    const lowerUnavailable = unavailableNotice.toLowerCase();
    const matchedKeywords = keywords.filter((keyword) => lowerUnavailable.includes(keyword.toLowerCase()));
    return {
      text: unavailableNotice,
      matchedKeywords,
      extractedItems: []
    };
  }
  const readableText = readable?.textContent ? stripNoise(readable.textContent) : "";
  const fallbackText = stripNoise($("main, article, body").text());
  const listLikeText = extractListLikeText($);
  const productLikeText = extractProductLikeText($);
  const structuredItems = extractStructuredListItems($, sourceUrl);
  const newsLinkItems = extractNewsLinkItems($, sourceUrl);
  const preferNewsLinks = hasLowValueStructuredItems(structuredItems) && newsLinkItems.length > 0;
  const portalItems = structuredItems.length || newsLinkItems.length ? [] : extractPortalStructuredItems($, sourceUrl);
  const finalExtractedItems = preferNewsLinks
    ? newsLinkItems
    : structuredItems.length
      ? structuredItems
      : newsLinkItems.length
        ? newsLinkItems
        : portalItems;
  const structuredListText = structuredItems
    .map((item) => [item.title, item.summary, item.date].filter(Boolean).join(" "))
    .join(" ");
  const newsLinkText = newsLinkItems
    .map((item) => [item.title, item.summary, item.date].filter(Boolean).join(" "))
    .join(" ");
  const portalListText = portalItems
    .map((item) => [item.title, item.summary, item.date].filter(Boolean).join(" "))
    .join(" ");
  const titleLooksLikeList = /(news|press|blog|资讯|新闻|动态)/i.test(title);
  const titleLooksLikePortal = /(新闻中心|政务|教育|招生|公告|通知|资讯)/i.test(title);
  const titleLooksLikeProduct = /(product|products|solution|solutions|产品|方案|平台)/i.test(title);
  const chosenBody =
    titleLooksLikeList &&
    (!readableText || readableText.length < 250 || /联系我们|产品技术咨询|采购部|证券部|邮箱|电话/.test(readableText))
      ? (preferNewsLinks ? newsLinkText : structuredListText) || newsLinkText || portalListText || listLikeText || fallbackText
      : titleLooksLikePortal &&
          (!readableText || readableText.length < 350 || /首页|滚动|更多|专题|视频|图片/.test(readableText))
        ? newsLinkText || portalListText || structuredListText || listLikeText || fallbackText
      : titleLooksLikeProduct &&
          (!readableText ||
            /申请表|隐私政策|在线咨询|立即提交|工作时间|快速解答/.test(readableText) ||
            readableText.length < 250)
        ? productLikeText || readableText || fallbackText
      : readableText || structuredListText || portalListText || listLikeText || fallbackText;
  const finalText = [title, chosenBody]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 30000);
  const canonicalUrl = extractCanonicalUrl($, sourceUrl);
  const publishedAt = extractPublishedAt($, finalExtractedItems, crawlerPublishedTime, sourceUrl, html);
  const pageKind = inferPageKind({
    title,
    readableText,
    structuredItems,
    newsLinkItems,
    portalItems
  });
  const completenessScore = computeCompletenessScore({
    title,
    canonicalUrl,
    publishedAt,
    pageKind,
    finalText,
    extractedItems: finalExtractedItems
  });

  const lower = finalText.toLowerCase();
  const matchedKeywords = keywords.filter((keyword) => lower.includes(keyword.toLowerCase()));

  return {
    text: finalText,
    matchedKeywords,
    extractedItems: finalExtractedItems,
    canonicalUrl,
    publishedAt,
    pageKind,
    completenessScore
  };
}
