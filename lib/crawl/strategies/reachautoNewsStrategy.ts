import * as cheerio from "cheerio";
import { chromium } from "playwright";
import type { CrawlStrategy, CrawlStrategyOptions, CrawlStrategyResult, ExtractedItem } from "./types";

export const reachautoNewsStrategy: CrawlStrategy = {
  name: "reachauto_news",
  displayName: "东软睿驰新闻",
  description: "爬取东软睿驰新闻页面（行业活动/生态合作/产品技术），自动提取标题、日期、摘要",
  urlPatterns: [
    /www\.reachauto\.com\/corporate-news\/industry-activities/i,
    /www\.reachauto\.com\/corporate-news\/ecological-alliance/i,
    /www\.reachauto\.com\/corporate-news\/product-technology/i
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
      
      const allItems = parseReachautoNews(html, url);
      
      const combinedText = allItems
        .map(item => `【${item.title}】\n日期: ${item.date}\n链接: ${item.url}\n摘要: ${item.summary}`)
        .join("\n\n---\n\n");
      
      return {
        success: true,
        page: {
          url,
          title: "东软睿驰新闻",
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

function parseReachautoNews(html: string, baseUrl: string): ExtractedItem[] {
  const $ = cheerio.load(html);
  const items: ExtractedItem[] = [];
  const seenUrls = new Set<string>();
  
  // Structure 1: article.elementor-post (used by industry-activities, product-technology)
  $("article.elementor-post").each((i, el) => {
    const article = $(el);
    
    const titleLink = article.find("h3 a").first();
    const href = titleLink.attr("href") || "";
    const title = titleLink.text().trim();
    
    if (!href || !title || title.length < 5) return;
    if (!href.includes("/202")) return;
    
    const fullUrl = href.startsWith("http") ? href : `https://${href}`;
    if (seenUrls.has(fullUrl)) return;
    
    const articleMatch = fullUrl.match(/reachauto\.com\/(\d{4})\/(\d{2})\/[^/]+\//);
    if (!articleMatch) return;
    seenUrls.add(fullUrl);
    
    const dateText = article.find("span.elementor-post-date").text().trim();
    let date = "";
    if (dateText && dateText.includes("年")) {
      const cnDateMatch = dateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (cnDateMatch) {
        date = `${cnDateMatch[1]}-${cnDateMatch[2].padStart(2, "0")}-${cnDateMatch[3].padStart(2, "0")}`;
      }
    }
    if (!date) {
      date = `${articleMatch[1]}-${articleMatch[2]}`;
    }
    
    const summary = article.find(".elementor-post__excerpt p").text().trim() || "";
    
    items.push({ title, url: fullUrl, date, summary });
  });
  
  // Structure 2: h4.ha-pg-title (used by ecological-alliance)
  if (items.length === 0) {
    $("h4.ha-pg-title a").each((i, el) => {
      const href = $(el).attr("href") || "";
      const title = $(el).text().trim();
      
      if (!href || !title || title.length < 5) return;
      if (!href.includes("/202")) return;
      
      const fullUrl = href.startsWith("http") ? href : `https://${href}`;
      if (seenUrls.has(fullUrl)) return;
      
      const articleMatch = fullUrl.match(/reachauto\.com\/(\d{4})\/(\d{2})\/[^/]+\//);
      if (!articleMatch) return;
      seenUrls.add(fullUrl);
      
      const contentArea = $(el).closest(".ha-pg-content-area");
      
      let date = "";
      const dateText = contentArea.find(".ha-pg-date").text().trim();
      if (dateText && dateText.includes("年")) {
        const cnDateMatch = dateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (cnDateMatch) {
          date = `${cnDateMatch[1]}-${cnDateMatch[2].padStart(2, "0")}-${cnDateMatch[3].padStart(2, "0")}`;
        }
      }
      if (!date) {
        date = `${articleMatch[1]}-${articleMatch[2]}`;
      }
      
      const summary = contentArea.find(".ha-pg-excerpt p").text().trim() || "";
      
      items.push({ title, url: fullUrl, date, summary });
    });
  }

  return items;
}