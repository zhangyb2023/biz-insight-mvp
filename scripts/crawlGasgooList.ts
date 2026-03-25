import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";
import * as cheerio from "cheerio";

const BASE_URL = "https://auto.gasgoo.com";
const LIST_PAGE_URL = `${BASE_URL}/automaker/C-109`;
const OUTPUT_FILE = path.join(process.cwd(), "data", "raw_gasgoo_articles.json");

const CRAWL_DELAY_MS = 2000;
const MAX_PAGES_TO_CRAWL = 1;

export type GasgooArticle = {
  title: string;
  url: string;
  publishDate: string;
  author?: string;
  content?: string;
  fetchedAt: string;
};

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function crawlListPage(page: any, pageNum: number): Promise<{url: string, title: string}[]> {
  const url = pageNum === 1 ? LIST_PAGE_URL : `${LIST_PAGE_URL}/${pageNum}`;
  console.log(`  Crawling list page ${pageNum}: ${url}`);
  
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
  
  const content = await page.content();
  const $ = cheerio.load(content);
  
  const articles: {url: string, title: string}[] = [];
  
  $(".bigtitle a").each((i, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim();
    if (href.includes("/news/") && href.endsWith(".shtml")) {
      if (!articles.find(a => a.url === href)) {
        articles.push({ url: href, title: text });
      }
    }
  });
  
  console.log(`  Found ${articles.length} article links on page ${pageNum}`);
  return articles;
}

async function crawlArticle(page: any, article: GasgooArticle): Promise<GasgooArticle> {
  const fullUrl = BASE_URL + article.url;
  console.log(`  Crawling: ${article.title.substring(0, 50)}...`);
  
  await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
  
  const content = await page.content();
  const $ = cheerio.load(content);
  
  const title = $("h1").first().text().trim();
  if (title) {
    article.title = title;
  }
  
  const dateSpan = $(".userInfo span.time").text().trim();
  if (dateSpan && dateSpan.match(/\d{4}-\d{2}-\d{2}/)) {
    article.publishDate = dateSpan;
  } else {
    const allSpans = $(".userInfo span");
    for (let i = 0; i < allSpans.length; i++) {
      const text = $(allSpans[i]).text().trim();
      if (text.match(/\d{4}-\d{2}-\d{2}/)) {
        article.publishDate = text;
        break;
      }
    }
  }
  
  const author = $(".authorName span").first().text().trim();
  if (author) {
    article.author = author;
  } else {
    const authorLink = $(".userInfo a.editor").text().trim();
    if (authorLink) {
      article.author = authorLink;
    }
  }
  
  const detailedDiv = $(".detailed").first().html();
  if (detailedDiv) {
    let text = detailedDiv.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    article.content = text;
  }
  
  return article;
}

async function main() {
  console.log("=== Gasgoo List Page Crawler ===\n");
  console.log(`Target: ${LIST_PAGE_URL}`);
  console.log(`Max pages to crawl: ${MAX_PAGES_TO_CRAWL}`);
  console.log(`Output: ${OUTPUT_FILE}\n`);
  
  const browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false"
  });
  
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
  });
  
  const page = await context.newPage();
  
  const allArticles: {url: string, title: string}[] = [];
  
  console.log("--- Step 1: Extracting article links from list pages ---\n");
  
  for (let pageNum = 1; pageNum <= MAX_PAGES_TO_CRAWL; pageNum++) {
    try {
      const articles = await crawlListPage(page, pageNum);
      allArticles.push(...articles);
      console.log(`  Total unique article URLs so far: ${allArticles.length}\n`);
    } catch (error) {
      console.error(`  Error crawling list page ${pageNum}: ${error}\n`);
    }
    
    if (pageNum < MAX_PAGES_TO_CRAWL) {
      await delay(CRAWL_DELAY_MS);
    }
  }
  
  const uniqueArticles = allArticles.filter((a, i, arr) => 
    arr.findIndex(b => b.url === a.url) === i
  );
  
  console.log(`Total unique article URLs: ${uniqueArticles.length}\n`);
  
  if (uniqueArticles.length === 0) {
    console.log("No article URLs found. Exiting.");
    await browser.close();
    return;
  }
  
  console.log("--- Step 2: Crawling individual articles for full content ---\n");
  
  const results: GasgooArticle[] = [];
  
  for (let i = 0; i < uniqueArticles.length; i++) {
    const { url, title } = uniqueArticles[i];
    
    try {
      const article: GasgooArticle = {
        title,
        url,
        publishDate: "Unknown",
        fetchedAt: new Date().toISOString()
      };
      
      const fullArticle = await crawlArticle(page, article);
      results.push(fullArticle);
      
      console.log(`  [${i + 1}/${uniqueArticles.length}] Done: ${fullArticle.title.substring(0, 60)}...`);
      if (fullArticle.content) {
        console.log(`       Content length: ${fullArticle.content.length} chars`);
      }
    } catch (error) {
      console.error(`  Error crawling article ${url}: ${error}`);
    }
    
    if (i < uniqueArticles.length - 1) {
      await delay(CRAWL_DELAY_MS);
    }
  }
  
  await page.close();
  await context.close();
  await browser.close();
  
  console.log("\n--- Step 3: Saving results ---\n");
  
  const outputDir = path.dirname(OUTPUT_FILE);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf8");
  
  console.log(`Saved ${results.length} articles to ${OUTPUT_FILE}`);
  
  console.log("\n--- Sample articles ---\n");
  for (let i = 0; i < Math.min(3, results.length); i++) {
    const a = results[i];
    console.log(`[${i + 1}] ${a.title}`);
    console.log(`    URL: ${a.url}`);
    console.log(`    Date: ${a.publishDate}`);
    console.log(`    Author: ${a.author || "N/A"}`);
    console.log(`    Content preview: ${(a.content || "").substring(0, 150)}...`);
    console.log();
  }
  
  console.log("=== Done ===");
}

main().catch(console.error);