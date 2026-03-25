import * as cheerio from "cheerio";
import { chromium } from "playwright";
import type { CrawlStrategy, CrawlStrategyOptions, CrawlStrategyResult, ExtractedItem } from "./types";

export const etasNewsStrategy: CrawlStrategy = {
  name: "etas_news",
  displayName: "ETAS新闻",
  description: "爬取ETAS新闻页面，提取标题、日期、摘要",
  urlPatterns: [
    /www\.etas\.com\/ww\/en\/about-etas\/newsroom/i,
    /www\.etas\.com\/ww\/en\/about-etas\/newsroom\//i
  ],
  
  crawl: async (url: string, options?: CrawlStrategyOptions): Promise<CrawlStrategyResult> => {
    try {
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
      });
      const page = await context.newPage();
      
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);
      
      const html = await page.content();
      await browser.close();
      
      const allItems = parseEtasNews(html, url);
      
      const combinedText = allItems
        .map(item => `【${item.title}】\n日期: ${item.date}\n链接: ${item.url}\n摘要: ${item.summary}`)
        .join("\n\n---\n\n");
      
      return {
        success: true,
        page: {
          url,
          title: "ETAS新闻",
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

function parseEtasNews(html: string, baseUrl: string): ExtractedItem[] {
  const $ = cheerio.load(html);
  const items: ExtractedItem[] = [];
  const seenUrls = new Set<string>();
  
  $("article a.A-Teaser-NewsTeaser").each((i, el) => {
    const article = $(el);
    
    const href = article.attr("href") || "";
    if (!href) return;
    
    const fullUrl = href.startsWith("http") ? href : `https://www.etas.com${href}`;
    if (seenUrls.has(fullUrl)) return;
    
    const title = article.attr("aria-label")?.trim() || 
                   article.find("h3.A-Teaser-NewsTeaser__headline").text().trim();
    
    if (!title || title.length < 5) return;
    seenUrls.add(fullUrl);
    
    const dateText = article.find(".A-Teaser-NewsTeaser__metaInformation__date").text().trim();
    let date = "";
    if (dateText) {
      const parts = dateText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (parts) {
        date = `${parts[3]}-${parts[1]}-${parts[2]}`;
      }
    }
    
    const imageMeta = article.find('meta[itemprop="image"]').attr("content") || "";
    const imageUrl = imageMeta ? `https://www.etas.com${imageMeta}` : "";
    
    const summary = article.find(".A-Teaser-NewsTeaser__innerLink").text().replace("Read more", "").trim() || title;
    
    items.push({ title, url: fullUrl, date, summary, imageUrl });
  });

  return items;
}