import { chromium } from "playwright";
import * as cheerio from "cheerio";

const BASE_URL = "https://auto.gasgoo.com";
const PAGES_TO_CHECK = [1, 2, 3, 4, 5];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const allUrls = new Set<string>();
  
  for (const pageNum of PAGES_TO_CHECK) {
    const url = pageNum === 1 
      ? `${BASE_URL}/automaker/C-109` 
      : `${BASE_URL}/automaker/C-109?page=${pageNum}`;
    
    console.log(`\n=== Page ${pageNum} ===`);
    console.log(`URL: ${url}`);
    
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
    
    const content = await page.content();
    const $ = cheerio.load(content);
    
    const pageUrls: string[] = [];
    $(".bigtitle a").each((i, el) => {
      const href = $(el).attr("href") || "";
      if (href.includes("/news/") && href.endsWith(".shtml")) {
        pageUrls.push(href);
      }
    });
    
    console.log(`Found ${pageUrls.length} article links on this page`);
    
    // Show first few URLs
    pageUrls.slice(0, 5).forEach((u, i) => {
      console.log(`  ${i + 1}. ${u}`);
    });
    
    // Check how many are new vs already seen
    const newUrls = pageUrls.filter(u => !allUrls.has(u));
    console.log(`  -> ${newUrls.length} NEW URLs (${pageUrls.length - newUrls.length} duplicates)`);
    
    pageUrls.forEach(u => allUrls.add(u));
  }
  
  console.log(`\n=== TOTAL UNIQUE URLS across pages 1-5: ${allUrls.size} ===`);
  
  await browser.close();
}

main().catch(console.error);