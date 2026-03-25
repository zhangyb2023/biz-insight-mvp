import * as cheerio from "cheerio";
import { chromium } from "playwright";
import type { CrawlStrategy, CrawlStrategyOptions, CrawlStrategyResult, ExtractedItem } from "./types";

export const gasgooFlashStrategy: CrawlStrategy = {
  name: "gasgoo_flash",
  displayName: "盖世快讯",
  description: "爬取盖世汽车快讯页面，自动解析每条快讯的标题、日期、内容和链接",
  urlPatterns: [/auto\.gasgoo\.com\/newsflash\/flashnews/i],
  
  crawl: async (url: string, options?: CrawlStrategyOptions): Promise<CrawlStrategyResult> => {
    const pages = options?.pages || [1, 2, 3];
    
    try {
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
      });
      const page = await context.newPage();
      
      const allItems: ExtractedItem[] = [];
      let latestDate = "";
      
      for (const pageNum of pages) {
        const pageUrl = pageNum === 1 ? url : url.replace(/(\/\d+)$/, `/${pageNum}`);
        
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
        
        const html = await page.content();
        const items = parseFlashPage(html, "https://auto.gasgoo.com");
        
        allItems.push(...items);
        if (items.length > 0 && items[0].date) {
          latestDate = items[0].date;
        }
        
        if (pageNum < pages.length) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      await browser.close();
      
      const combinedText = allItems
        .map(item => `【${item.title}】\n日期: ${item.date}\n链接: ${item.url}\n内容: ${item.content}`)
        .join("\n\n---\n\n");
      
      return {
        success: true,
        page: {
          url,
          title: "盖世快讯",
          html: combinedText,
          fetchedAt: new Date().toISOString(),
          checkedAt: new Date().toISOString(),
          fromCache: false,
          httpStatus: 200,
          fetchStrategy: "playwright",
          fallbackUsed: false,
          fallbackReason: null,
          publishedTime: latestDate || undefined
        },
        extractedItems: allItems.map(item => ({
          title: item.title,
          url: item.url,
          date: item.date,
          summary: item.content?.slice(0, 280) || item.content,
          content: item.content
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: String(error)
      };
    }
  }
};

function parseFlashPage(html: string, baseUrl: string): ExtractedItem[] {
  const $ = cheerio.load(html);
  const items: ExtractedItem[] = [];

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
      items.push({ title, url, date: dateDiv, content });
    }
  });

  return items;
}
