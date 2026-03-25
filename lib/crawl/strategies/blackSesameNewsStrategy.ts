import * as cheerio from "cheerio";
import type { CrawlStrategy, CrawlStrategyOptions, CrawlStrategyResult, ExtractedItem } from "./types";

export const blackSesameNewsStrategy: CrawlStrategy = {
  name: "blacksesame_news",
  displayName: "黑芝麻智能新闻",
  description: "爬取黑芝麻智能新闻中心，图片卡片形式，点击详情进入详情页获取发布日期",
  urlPatterns: [/www\.blacksesame\.com\/zh\/news-center/i],
  
  crawl: async (url: string, options?: CrawlStrategyOptions): Promise<CrawlStrategyResult> => {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
        }
      });
      
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      const newsLinks: { href: string; title: string; summary: string }[] = [];
      
      $("a.ppItem2.tra").each((_, el) => {
        const $el = $(el);
        const href = $el.attr("href") || "";
        const title = $el.find("div.ppItemTitle").text().trim();
        const summary = $el.find("div.ppItemSmallLeft").text().trim();
        
        if (href && title) {
          const fullUrl = href.startsWith("http") ? href : `https://www.blacksesame.com${href}`;
          newsLinks.push({ href: fullUrl, title, summary });
        }
      });
      
      const allItems: ExtractedItem[] = [];
      
      for (const news of newsLinks.slice(0, 20)) {
        try {
          const item = await crawlDetailPage(news.href);
          allItems.push({
            title: news.title,
            url: news.href,
            date: item.date,
            summary: item.summary || news.summary.substring(0, 280)
          });
        } catch (e) {
          console.log(`Failed to crawl ${news.href}:`, e);
          allItems.push({
            title: news.title,
            url: news.href,
            date: "",
            summary: news.summary.substring(0, 280)
          });
        }
        
        await new Promise(r => setTimeout(r, 300));
      }
      
      const combinedText = allItems
        .map(item => `【${item.title}】\n日期: ${item.date}\n链接: ${item.url}\n摘要: ${item.summary}`)
        .join("\n\n---\n\n");
      
      return {
        success: true,
        page: {
          url,
          title: "黑芝麻智能新闻中心",
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
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
    }
  });
  
  if (!response.ok) {
    return { date: "", summary: "" };
  }
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  let date = "";
  
  const dateSpan = $(".deta span").first();
  const dateText = dateSpan.text().trim();
  const match = dateText.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (match) {
    date = `${match[1]}-${match[2]}-${match[3]}`;
  }
  
  let summary = "";
  $("div.content, div.article-content, div.news-content, div.article, div.news-content, div.newsDetailBox").find("p").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 50 && !text.includes("Copyright") && !text.includes("版权所有") && !text.includes("免责")) {
      summary = text;
      return false;
    }
  });
  
  return { date, summary };
}