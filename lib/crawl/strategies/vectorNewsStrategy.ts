import * as cheerio from "cheerio";
import { chromium } from "playwright";
import type { CrawlStrategy, CrawlStrategyOptions, CrawlStrategyResult, ExtractedItem } from "./types";

export const vectorNewsStrategy: CrawlStrategy = {
  name: "vector_news",
  displayName: "Vector活动",
  description: "爬取Vector活动页面，提取标题、日期",
  urlPatterns: [
    /www\.vector\.com\/cn\/zh\/events\/overview/i,
    /www\.vector\.com\/int\/en\/events\/overview/i,
    /www\.vector\.com\/.*\/events\/overview/i
  ],
  
  crawl: async (url: string, options?: CrawlStrategyOptions): Promise<CrawlStrategyResult> => {
    try {
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
      });
      const page = await context.newPage();
      
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(5000);
      
      const html = await page.content();
      await browser.close();
      
      const allItems = parseVectorEvents(html, url);
      
      const combinedText = allItems
        .map(item => `【${item.title}】\n日期: ${item.date}\n链接: ${item.url}\n摘要: ${item.summary}`)
        .join("\n\n---\n\n");
      
      return {
        success: true,
        page: {
          url,
          title: "Vector活动",
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

function parseVectorEvents(html: string, baseUrl: string): ExtractedItem[] {
  const $ = cheerio.load(html);
  const items: ExtractedItem[] = [];
  const seenUrls = new Set<string>();
  
  $(".event-list .event").each((i, el) => {
    const date = $(el).find(".event__date").text().trim();
    const linkEl = $(el).find("a");
    let title = linkEl.text().trim();
    let href = linkEl.attr("href") || "";
    
    title = title.replace(/^网络研讨会:\s*/, "");
    
    if (!title || title.length < 5) return;
    
    if (href && !href.startsWith("http")) {
      href = `https://www.vector.com${href}`;
    }
    
    if (href && seenUrls.has(href)) return;
    if (href) seenUrls.add(href);
    
    items.push({ title, url: href, date, summary: title });
  });

  return items;
}