import * as cheerio from "cheerio";
import { chromium } from "playwright";
import type { CrawlStrategy, CrawlStrategyOptions, CrawlStrategyResult, ExtractedItem } from "./types";

export const hirainNewsStrategy: CrawlStrategy = {
  name: "hirain_news",
  displayName: "经纬恒润新闻",
  description: "爬取经纬恒润新闻页面，图片+标题+摘要，点击进入详情页",
  urlPatterns: [/www\.hirain\.com\/news\/企业新闻/i, /www\.hirain\.com\/news\/%E4%BC%81%E4%B8%9A%E6%96%B0%E9%97%BB/i],
  
  crawl: async (url: string, options?: CrawlStrategyOptions): Promise<CrawlStrategyResult> => {
    try {
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
      });
      const page = await context.newPage();
      
      // Get news links from pages with offset 0, 6, 12 (3 pages)
      const offsets = [0, 6, 12];
      const allNewsLinks = new Set<string>();
      
      for (const offset of offsets) {
        const pageUrl = offset === 0 
          ? "https://www.hirain.com/news/1897158317902606336-0-6.html"
          : `https://www.hirain.com/news/1897158317902606336-${offset}-6.html`;
        
        try {
          const response = await fetch(pageUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
            }
          });
          
          if (response.ok) {
            const html = await response.text();
            const $ = cheerio.load(html);
            
            $("a").each((i, el) => {
              const href = $(el).attr("href") || "";
              if (href.match(/\/news_detail\/\d+\.html/)) {
                if (href.startsWith("/")) {
                  allNewsLinks.add("https://www.hirain.com" + href);
                } else {
                  allNewsLinks.add(href);
                }
              }
            });
          }
        } catch (e) {
          console.log(`Failed to fetch page ${offset}:`, e);
        }
        
        await new Promise(r => setTimeout(r, 500));
      }
      
      await browser.close();
      
      // Crawl each news detail page
      const allItems: ExtractedItem[] = [];
      
      for (const newsUrl of Array.from(allNewsLinks)) {
        try {
          const item = await crawlNewsDetail(newsUrl);
          if (item) {
            allItems.push(item);
          }
        } catch (e) {
          console.log(`Failed to crawl ${newsUrl}:`, e);
        }
        
        await new Promise(r => setTimeout(r, 500));
      }
      
      const combinedText = allItems
        .map(item => `【${item.title}】\n日期: ${item.date}\n链接: ${item.url}\n摘要: ${item.summary}`)
        .join("\n\n---\n\n");
      
      return {
        success: true,
        page: {
          url,
          title: "经纬恒润新闻",
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
  
  // Extract title from meta title
  let title = $("title").text().split("-")[0].trim();
  
  // Extract date from content (pattern: YYYY-MM-DD)
  let date = "";
  const dateMatch = html.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    date = dateMatch[1];
  }
  
  // Extract summary from paragraphs
  const paragraphs: string[] = [];
  $("p").each((i, el) => {
    const text = $(el).text().trim();
    if (text.length > 40 && !text.includes("来源") && !text.includes("作者")) {
      paragraphs.push(text);
    }
  });
  
  const summary = paragraphs.slice(0, 3).join(" ").substring(0, 280);
  
  return {
    title,
    url,
    date,
    summary
  };
}