import { chromium } from "playwright";
import * as cheerio from "cheerio";
import type { CrawlStrategy, CrawlStrategyOptions, CrawlStrategyResult, ExtractedItem } from "./types";

export const tttechAutoNewsStrategy: CrawlStrategy = {
  name: "tttech_auto_news",
  displayName: "TTTech Auto新闻",
  description: "爬取TTTech Auto新闻页面，图片+日期+标题，点击read more进入详情",
  urlPatterns: [/www\.tttech-auto\.com\/newsroom/i],
  
  crawl: async (url: string, options?: CrawlStrategyOptions): Promise<CrawlStrategyResult> => {
    try {
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
      });
      const page = await context.newPage();
      
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      
      const html = await page.content();
      const $ = cheerio.load(html);
      
      const newsItems: { href: string; title: string; date: string; imageUrl: string }[] = [];
      
      $("a.read-more, a.read-more-btn, a.news-read-more").each((_, el) => {
        const $el = $(el);
        const href = $el.attr("href") || "";
        
        if (href.match(/\/newsroom\/[a-z0-9-]+/i)) {
          const card = $el.closest("div, article, section");
          const title = card.find("h2, h3, .title, .news-title, .card-title").text().trim() || $el.text().trim();
          const dateText = card.find(".date, .publish-date, time, .news-date, .article-date").text().trim();
          const imageEl = card.find("img").first();
          const imageUrl = imageEl.attr("src") || imageEl.attr("data-src") || "";
          
          const fullUrl = href.startsWith("http") ? href : `https://www.tttech-auto.com${href}`;
          if (title && !newsItems.some(n => n.href === fullUrl)) {
            newsItems.push({ href: fullUrl, title, date: dateText, imageUrl });
          }
        }
      });
      
      if (newsItems.length === 0) {
        $("a").each((_, el) => {
          const $el = $(el);
          const href = $el.attr("href") || "";
          if (href.match(/\/newsroom\/[a-z0-9-]+\/?$/i) && !href.endsWith("/newsroom")) {
            const card = $el.closest("div, article, section");
            const title = card.find("h2, h3, .title, .news-title, .card-title").text().trim() || $el.text().trim();
            const dateText = card.find(".date, .publish-date, time, .news-date, .article-date").text().trim();
            const imageEl = card.find("img").first();
            const imageUrl = imageEl.attr("src") || imageEl.attr("data-src") || "";
            
            const fullUrl = href.startsWith("http") ? href : `https://www.tttech-auto.com${href}`;
            if (title && !newsItems.some(n => n.href === fullUrl)) {
              newsItems.push({ href: fullUrl, title, date: dateText, imageUrl });
            }
          }
        });
      }
      
      const allItems: ExtractedItem[] = [];
      
      for (const news of newsItems.slice(0, 15)) {
        const title = news.title.replace(/^Read more:\s*/i, "").trim();
        
        if (!title || title.length < 5 || title.toLowerCase().includes("policy menu")) {
          continue;
        }
        
        try {
          const detail = await crawlDetailPage(news.href);
          allItems.push({
            title,
            url: news.href,
            date: detail.date || news.date,
            summary: detail.summary
          });
        } catch (e) {
          console.log(`Failed to crawl ${news.href}:`, e);
          allItems.push({
            title,
            url: news.href,
            date: news.date,
            summary: ""
          });
        }
        
        await new Promise(r => setTimeout(r, 500));
      }
      
      await browser.close();
      
      const combinedText = allItems
        .map(item => `【${item.title}】\n日期: ${item.date}\n链接: ${item.url}\n摘要: ${item.summary}`)
        .join("\n\n---\n\n");
      
      return {
        success: true,
        page: {
          url,
          title: "TTTech Auto Newsroom",
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
      return { success: false, error: String(error) };
    }
  }
};

async function crawlDetailPage(url: string): Promise<{ date: string; summary: string }> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
  });
  const page = await context.newPage();
  
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  
  const html = await page.content();
  const $ = cheerio.load(html);
  
  let date = "";
  $(".date, .publish-date, time, .news-date, .article-date").each((_, el) => {
    const text = $(el).text().trim();
    const match = text.match(/(\d{4})-(\d{2})-(\d{2})/) || text.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    if (match) {
      date = `${match[1]}-${match[2]}-${match[3]}`;
      return false;
    }
  });
  
  if (!date) {
    const metaDate = $("meta[property='article:published_time']").attr("content");
    if (metaDate) {
      const match = metaDate.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        date = `${match[1]}-${match[2]}-${match[3]}`;
      }
    }
  }
  
  let summary = "";
  $("article, .article-content, .news-content, .content, main").find("p").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 50 && !text.includes("Copyright") && !text.includes("©") && !text.includes("All rights")) {
      summary = text;
      return false;
    }
  });
  
  await browser.close();
  return { date, summary };
}