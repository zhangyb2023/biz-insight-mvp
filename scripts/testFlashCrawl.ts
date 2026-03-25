import { chromium } from "playwright";
import * as cheerio from "cheerio";

const BASE_URL = "https://auto.gasgoo.com";
const PAGES = [1, 2, 3];

export type GasgooFlashItem = {
  title: string;
  url: string;
  publishDate: string;
  content: string;
};

function parseFlashPage(html: string, baseUrl: string): GasgooFlashItem[] {
  const $ = cheerio.load(html);
  const items: GasgooFlashItem[] = [];

  $("#flashList li").each((_, el) => {
    const root = $(el);
    
    const titleEl = root.find("b a").first();
    const title = titleEl.text().trim();
    let url = titleEl.attr("href") || "";
    
    const dateDiv = root.find(".quInfo div").first().text().trim();
    
    const contentSpan = root.find(".quCon span").first();
    const content = contentSpan.text().trim();
    
    if (title && content) {
      if (!url.startsWith("http")) {
        url = baseUrl + url;
      }
      items.push({ title, url, publishDate: dateDiv, content });
    }
  });

  return items;
}

async function main() {
  console.log("=== 盖世快讯爬取测试 ===\n");
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
  });
  const page = await context.newPage();
  
  const allItems: GasgooFlashItem[] = [];
  
  for (const pageNum of PAGES) {
    const url = pageNum === 1 
      ? `${BASE_URL}/newsflash/flashnews/1`
      : `${BASE_URL}/newsflash/flashnews/${pageNum}`;
    
    console.log(`爬取第 ${pageNum} 页: ${url}`);
    
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
      
      const html = await page.content();
      const items = parseFlashPage(html, BASE_URL);
      
      console.log(`  解析到 ${items.length} 条快讯`);
      allItems.push(...items);
    } catch (error) {
      console.error(`  爬取失败: ${error}`);
    }
    
    if (pageNum < PAGES.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  await browser.close();
  
  console.log(`\n=== 总计: ${allItems.length} 条快讯 ===\n`);
  
  // 展示前5条
  console.log("--- 前5条快讯详情 ---\n");
  for (let i = 0; i < Math.min(5, allItems.length); i++) {
    const item = allItems[i];
    console.log(`【${i + 1}】${item.title}`);
    console.log(`    日期: ${item.publishDate}`);
    console.log(`    链接: ${item.url}`);
    console.log(`    内容: ${item.content.substring(0, 200)}...`);
    console.log();
  }
  
  // 保存到文件
  const fs = await import("fs");
  fs.writeFileSync("data/gasgoo_flash_result.json", JSON.stringify(allItems, null, 2));
  console.log(`已保存到 data/gasgoo_flash_result.json`);
}

main().catch(console.error);