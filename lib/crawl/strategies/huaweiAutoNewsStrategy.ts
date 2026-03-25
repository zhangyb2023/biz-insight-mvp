import * as cheerio from "cheerio";
import { chromium } from "playwright";
import type { CrawlStrategy, CrawlStrategyOptions, CrawlStrategyResult, ExtractedItem } from "./types";

export const huaweiAutoNewsStrategy: CrawlStrategy = {
  name: "huawei_auto_news",
  displayName: "华为乾崑新闻",
  description: "爬取华为乾崑智能汽车新闻页面，图片+标题+摘要，点击进入详情页",
  urlPatterns: [/auto\.huawei\.com\/cn\/news$/i, /auto\.huawei\.com\/cn\/news\//i],
  
  crawl: async (url: string, options?: CrawlStrategyOptions): Promise<CrawlStrategyResult> => {
    try {
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
      });
      const page = await context.newPage();
      
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);
      
      // Extract news links from the rendered page
      const newsLinks = await page.$$eval('a', links => {
        return links
          .filter(l => l.href && l.href.match(/\/news\/\d{4}\//))
          .map(l => l.href)
          .filter((v, i, a) => a.indexOf(v) === i);
      });
      
      await browser.close();
      
      // Crawl each news detail page
      const allItems: ExtractedItem[] = [];
      
      for (const newsUrl of newsLinks) {
        try {
          const item = await crawlNewsDetail(newsUrl);
          if (item) {
            allItems.push(item);
          }
        } catch (e) {
          console.log(`Failed to crawl ${newsUrl}:`, e);
        }
        
        await new Promise(r => setTimeout(r, 800));
      }
      
      const combinedText = allItems
        .map(item => `【${item.title}】\n日期: ${item.date}\n链接: ${item.url}\n摘要: ${item.summary}`)
        .join("\n\n---\n\n");
      
      return {
        success: true,
        page: {
          url,
          title: "华为乾崑新闻",
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

async function crawlNewsDetail(url: string): Promise<ExtractedItem | null> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
    }
  });
  
  if (!response.ok) {
    return null;
  }
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Extract title and date from first paragraph
  // Format: 【中国，深圳，2026 年 3 月 4 日】title content...
  const firstPara = $("p").first().text().trim();
  let title = "";
  let date = "";
  
  // Date pattern: 【...，2026 年 3 月 4 日】
  const dateMatch = firstPara.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  
  // Title is after the date bracket
  const titleMatch = firstPara.match(/】(.+)/);
  if (titleMatch) {
    title = titleMatch[1].substring(0, 150).trim();
  }
  
  // If no title, try meta title
  if (!title) {
    title = $("title").text().replace(/新闻-华为乾崑智能汽车解决方案/i, "").trim() || "华为乾崑新闻";
  }
  
  // Extract summary from paragraphs (skip data notes and numbered items)
  const paragraphs: string[] = [];
  $("p").each((i, el) => {
    const text = $(el).text().trim();
    if (text.length > 40 && !text.includes("数据统计截止") && !text.match(/^\d+\.$/)) {
      paragraphs.push(text);
    }
  });
  
  const summary = paragraphs.slice(0, 4).join(" ").substring(0, 300);
  
  // Fallback date from URL: /news/2026/2026-3-4-lidar
  if (!date) {
    const urlDateMatch = url.match(/\/news\/\d{4}\/(\d{4})-(\d+)-(\d+)-/);
    if (urlDateMatch) {
      const [, year, month, day] = urlDateMatch;
      date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }
  
  return {
    title,
    url,
    date,
    summary
  };
}