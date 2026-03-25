import * as cheerio from "cheerio";
import type { CrawlStrategy, CrawlStrategyOptions, CrawlStrategyResult, ExtractedItem } from "./types";

const MONTH_MAP: Record<string, string> = {
  "january": "01", "february": "02", "march": "03", "april": "04",
  "may": "05", "june": "06", "july": "07", "august": "08",
  "september": "09", "october": "10", "november": "11", "december": "12",
  "jan": "01", "feb": "02", "mar": "03", "apr": "04",
  "jun": "06", "jul": "07", "aug": "08", "sep": "09",
  "oct": "10", "nov": "11", "dec": "12"
};

function parseEnglishDate(dateStr: string): string {
  dateStr = dateStr.toLowerCase().trim();
  
  const match = dateStr.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})?/);
  if (match) {
    const [, month, day, year] = match;
    const monthNum = MONTH_MAP[month] || "01";
    const yearStr = year || new Date().getFullYear().toString();
    return `${yearStr}-${monthNum}-${day.padStart(2, "0")}`;
  }
  
  return dateStr;
}

export const elektrobitNewsStrategy: CrawlStrategy = {
  name: "elektrobit_news",
  displayName: "Elektrobit新闻",
  description: "爬取Elektrobit新闻页面，表格形式展示日期、标题、摘要",
  urlPatterns: [/www\.elektrobit\.com\/newsroom/i],
  
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
      const items = parseElektrobitNews(html);
      
      const combinedText = items
        .map(item => `【${item.title}】\n日期: ${item.date}\n链接: ${item.url}\n摘要: ${item.summary}`)
        .join("\n\n---\n\n");
      
      return {
        success: true,
        page: {
          url,
          title: "Elektrobit Newsroom",
          html: combinedText,
          fetchedAt: new Date().toISOString(),
          checkedAt: new Date().toISOString(),
          fromCache: false,
          httpStatus: 200,
          fetchStrategy: "playwright",
          fallbackUsed: false,
          fallbackReason: null
        },
        extractedItems: items.map(item => ({
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

function parseElektrobitNews(html: string): ExtractedItem[] {
  const $ = cheerio.load(html);
  const items: ExtractedItem[] = [];
  
  $("table#newsList tbody tr").each((_, row) => {
    const $row = $(row);
    
    const dateDiv = $row.find("div.col-md-3.pad0").first();
    const rawDate = dateDiv.text().trim();
    const date = parseEnglishDate(rawDate);
    
    const titleLink = $row.find("a.prod-url").first();
    const title = titleLink.text().trim();
    const itemUrl = titleLink.attr("href") || "";
    
    const summaryP = $row.find("p.prod-desc").first();
    const summary = summaryP.text().trim();
    
    if (title) {
      items.push({
        title,
        url: itemUrl,
        date,
        summary
      });
    }
  });
  
  return items;
}