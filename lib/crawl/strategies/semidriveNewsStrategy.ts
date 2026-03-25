import * as cheerio from "cheerio";
import { chromium } from "playwright";
import type { CrawlStrategy, CrawlStrategyOptions, CrawlStrategyResult, ExtractedItem } from "./types";

export const semidriveNewsStrategy: CrawlStrategy = {
  name: "semidrive_news",
  displayName: "芯驰科技新闻",
  description: "爬取芯驰科技新闻页面，提取标题、日期、图片",
  urlPatterns: [
    /www\.semidrive\.com\/news/i
  ],
  
  crawl: async (url: string, options?: CrawlStrategyOptions): Promise<CrawlStrategyResult> => {
    try {
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
      });
      const page = await context.newPage();
      
      const allItems: ExtractedItem[] = [];
      const baseUrl = url.replace(/\?.*/, "").replace(/\/$/, "");
      
      const pagesToCrawl = [1, 2, 3];
      
      for (const pageNum of pagesToCrawl) {
        const pageUrl = pageNum === 1 ? baseUrl : `${baseUrl}?page=${pageNum}`;
        
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(5000);
        
        const html = await page.content();
        const items = parseSemidriveNews(html, baseUrl);
        allItems.push(...items);
      }
      
      await browser.close();
      
      const combinedText = allItems
        .map(item => `【${item.title}】\n日期: ${item.date}\n链接: ${item.url}\n图片: ${item.imageUrl || '无'}\n摘要: ${item.summary}`)
        .join("\n\n---\n\n");
      
      return {
        success: true,
        page: {
          url,
          title: "芯驰科技新闻",
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
          content: item.summary,
          imageUrl: item.imageUrl
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

function parseSemidriveNews(html: string, baseUrl: string): ExtractedItem[] {
  const $ = cheerio.load(html);
  const items: ExtractedItem[] = [];
  const seenUrls = new Set<string>();
  
  $("div.newsw").each((i, el) => {
    const article = $(el);
    
    const imgEl = article.find("img.imgc");
    let imageUrl = imgEl.attr("src") || "";
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = `https://www.semidrive.com${imageUrl}`;
    }
    
    const els = article.find(".els");
    const paragraphs = els.find("p");
    const date = paragraphs.eq(0).text().trim();
    const title = paragraphs.eq(1).text().trim();
    
    const linkEl = article.find("a");
    let href = linkEl.attr("href") || "";
    if (href && !href.startsWith("http")) {
      href = `https://www.semidrive.com${href}`;
    }
    
    if (!href || seenUrls.has(href)) return;
    seenUrls.add(href);
    
    if (!title || title.length < 5) return;
    
    items.push({ 
      title, 
      url: href, 
      date, 
      summary: title,
      imageUrl
    });
  });

  return items;
}