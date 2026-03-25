import { chromium } from "playwright";
import * as cheerio from "cheerio";
import { parseGasgooFlashPage, isGasgooFlashPage } from "../lib/extract/gasgooFlash";
import { playwrightCrawl } from "../lib/crawl/playwrightCrawl";

async function main() {
  console.log("=== Testing Gasgoo Flash Crawl ===\n");

  const testUrl = "https://auto.gasgoo.com/newsflash/flashnews/1";
  
  console.log("1. Testing URL detection...");
  console.log(`   Is gasgoo flash page: ${isGasgooFlashPage(testUrl)}`);
  
  console.log("\n2. Crawling pages 1, 2, 3...");
  const urls = [
    "https://auto.gasgoo.com/newsflash/flashnews/1",
    "https://auto.gasgoo.com/newsflash/flashnews/2", 
    "https://auto.gasgoo.com/newsflash/flashnews/3"
  ];
  
  const result = await playwrightCrawl(urls, {
    useCache: false,
    forceRefresh: true
  });
  
  console.log(`   Crawled ${result.pages.length} pages`);
  console.log(`   Errors: ${result.errors.length}`);
  
  let allItems: any[] = [];
  
  for (const page of result.pages) {
    console.log(`\n3. Parsing page: ${page.url}`);
    const parsed = parseGasgooFlashPage(page.html, testUrl);
    console.log(`   Found ${parsed.items.length} items on this page`);
    allItems = allItems.concat(parsed.items);
  }
  
  console.log(`\n=== TOTAL: ${allItems.length} items extracted ===\n`);
  
  console.log("--- Sample items (first 3) ---\n");
  for (let i = 0; i < Math.min(3, allItems.length); i++) {
    const item = allItems[i];
    console.log(`[${i + 1}] ${item.title}`);
    console.log(`    URL: ${item.url}`);
    console.log(`    Date: ${item.publishDate}`);
    console.log(`    Content: ${item.content.substring(0, 100)}...`);
    console.log();
  }
  
  console.log("--- Saving to test file ---");
  const fs = await import("fs");
  fs.writeFileSync("data/test_gasgoo_flash.json", JSON.stringify(allItems, null, 2));
  console.log(`Saved ${allItems.length} items to data/test_gasgoo_flash.json`);
  
  console.log("\n=== Done ===");
}

main().catch(console.error);