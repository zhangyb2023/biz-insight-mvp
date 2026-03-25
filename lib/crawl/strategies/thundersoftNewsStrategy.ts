import * as cheerio from "cheerio";
import { chromium } from "playwright";
import type { CrawlStrategy, CrawlStrategyOptions, CrawlStrategyResult, ExtractedItem } from "./types";

export const thundersoftNewsStrategy: CrawlStrategy = {
  name: "thundersoft_news",
  displayName: "中科创达新闻",
  description: "爬取中科创达新闻页面，自动解析每条新闻的标题、日期、摘要和链接",
  urlPatterns: [/www\.thundersoft\.com\/category\/newsroom/i],
  
  crawl: async (url: string, options?: CrawlStrategyOptions): Promise<CrawlStrategyResult> => {
    const pages = options?.pages || [1, 2, 3];
    
    try {
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
      });
      const page = await context.newPage();
      
      const allItems: ExtractedItem[] = [];
      
      for (const pageNum of pages) {
        const pageUrl = pageNum === 1 ? url : url.replace(/\/page\/\d+\/?$/, `/page/${pageNum}/`).replace(/\/$/, `/page/${pageNum}/`);
        
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
        
        const html = await page.content();
        const items = parseThundersoftNews(html, "https://www.thundersoft.com");
        
        allItems.push(...items);
        
        if (pageNum < pages.length) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      await browser.close();
      
      const combinedText = allItems
        .map(item => `【${item.title}】\n日期: ${item.date}\n链接: ${item.url}\n摘要: ${item.summary}`)
        .join("\n\n---\n\n");
      
      return {
        success: true,
        page: {
          url,
          title: "中科创达新闻",
          html: combinedText,
          fetchedAt: new Date().toISOString(),
          checkedAt: new Date().toISOString(),
          fromCache: false,
          httpStatus: 200,
          fetchStrategy: "playwright",
          fallbackUsed: false,
          fallbackReason: null
        },
        extractedItems: allItems.map(item => ({
          title: item.title,
          url: item.url,
          date: item.date,
          summary: item.summary?.slice(0, 280) || item.summary,
          content: item.summary
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

function parseThundersoftNews(html: string, baseUrl: string): ExtractedItem[] {
  const $ = cheerio.load(html);
  const items: ExtractedItem[] = [];

  $(".newsItem").each((i, el) => {
    const root = $(el);
    
    const titleEl = root.find(".flexStart .tit, .content .tit").first();
    const title = titleEl.text().trim();
    
    const linkEl = root.find(".flexStart a, .content a").first();
    let link = linkEl.attr("href") || "";
    
    const dateEl = root.find(".date").first();
    const date = dateEl.text().trim();
    
    const descEl = root.find(".txetCont p, .content p").first();
    const summary = descEl.text().trim().substring(0, 200);
    
    if (title) {
      if (link && !link.startsWith("http")) {
        link = baseUrl + link;
      }
      items.push({ 
        title, 
        url: link, 
        date, 
        summary 
      });
    }
  });

  return items;
}
