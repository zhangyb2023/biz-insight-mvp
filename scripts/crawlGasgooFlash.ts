import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";
import * as cheerio from "cheerio";

const BASE_URL = "https://auto.gasgoo.com";
const OUTPUT_FILE = path.join(process.cwd(), "data", "raw_gasgoo_flash.json");

const CRAWL_DELAY_MS = 2000;
const MAX_PAGES_TO_CRAWL = 3;

export type GasgooFlash = {
  title: string;
  url: string;
  publishDate: string;
  content: string;
  fetchedAt: string;
};

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function crawlFlashPage(page: any, pageNum: number): Promise<GasgooFlash[]> {
  const url = pageNum === 1 
    ? `${BASE_URL}/newsflash/flashnews/1` 
    : `${BASE_URL}/newsflash/flashnews/${pageNum}`;
  console.log(`  Crawling flash page ${pageNum}: ${url}`);
  
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
  
  const content = await page.content();
  const $ = cheerio.load(content);
  
  const articles: GasgooFlash[] = [];
  
  $("#flashList li").each((i, el) => {
    const titleEl = $(el).find("b a").first();
    const title = titleEl.text().trim();
    const url = titleEl.attr("href") || "";
    
    const dateDiv = $(el).find(".quInfo div").first().text().trim();
    
    const contentSpan = $(el).find(".quCon span").first();
    let articleContent = contentSpan.text().trim();
    
    if (title && articleContent) {
      articles.push({
        title,
        url,
        publishDate: dateDiv,
        content: articleContent,
        fetchedAt: new Date().toISOString()
      });
    }
  });
  
  console.log(`  Found ${articles.length} flash news on page ${pageNum}`);
  return articles;
}

async function main() {
  console.log("=== Gasgoo Flash News Crawler ===\n");
  console.log(`Target: ${BASE_URL}/newsflash/flashnews/{1,2,3}`);
  console.log(`Max pages to crawl: ${MAX_PAGES_TO_CRAWL}`);
  console.log(`Output: ${OUTPUT_FILE}\n`);
  
  const browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false"
  });
  
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
  });
  
  const page = await context.newPage();
  
  const allArticles: GasgooFlash[] = [];
  
  console.log("--- Crawling flash news pages ---\n");
  
  for (let pageNum = 1; pageNum <= MAX_PAGES_TO_CRAWL; pageNum++) {
    try {
      const articles = await crawlFlashPage(page, pageNum);
      allArticles.push(...articles);
      console.log(`  Total articles so far: ${allArticles.length}\n`);
    } catch (error) {
      console.error(`  Error crawling page ${pageNum}: ${error}\n`);
    }
    
    if (pageNum < MAX_PAGES_TO_CRAWL) {
      await delay(CRAWL_DELAY_MS);
    }
  }
  
  await page.close();
  await context.close();
  await browser.close();
  
  console.log("--- Saving results ---\n");
  
  const outputDir = path.dirname(OUTPUT_FILE);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(allArticles, null, 2), "utf8");
  
  console.log(`Saved ${allArticles.length} flash news to ${OUTPUT_FILE}`);
  
  console.log("\n--- Sample articles ---\n");
  for (let i = 0; i < Math.min(5, allArticles.length); i++) {
    const a = allArticles[i];
    console.log(`[${i + 1}] ${a.title}`);
    console.log(`    URL: ${a.url}`);
    console.log(`    Date: ${a.publishDate}`);
    console.log(`    Content preview: ${a.content.substring(0, 150)}...`);
    console.log();
  }
  
  console.log("=== Done ===");
}

main().catch(console.error);