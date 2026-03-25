import * as cheerio from "cheerio";
import { chromium } from "playwright";
import type { CrawlStrategy, CrawlStrategyOptions, CrawlStrategyResult, ExtractedItem } from "./types";

const MONTH_MAP: Record<string, string> = {
  "january": "01", "february": "02", "march": "03", "april": "04",
  "may": "05", "june": "06", "july": "07", "august": "08",
  "september": "09", "october": "10", "november": "11", "december": "12",
  "jan": "01", "feb": "02", "mar": "03", "apr": "04",
  "jun": "06", "jul": "07", "aug": "08", "sep": "09",
  "oct": "10", "nov": "11", "dec": "12"
};

const TRANSLATIONS: Record<string, string> = {
  "Success Story": "成功案例",
  "Software-Defined Vehicle": "软件定义汽车",
  "Forum": "论坛",
  "AUTOSAR China Day": "AUTOSAR中国日",
  "Automotive Software": "汽车软件",
  "Safety Technology": "安全技术",
  "Week": "周",
  "China User Group Meeting": "中国用户组会议",
  "Q1": "第一季度",
  "Q2": "第二季度",
  "Q3": "第三季度",
  "Q4": "第四季度",
  "SystemWeaver": "SystemWeaver",
  "Scalable": "可扩展",
  "Software Lifecycle": "软件生命周期",
  "Management": "管理",
  "Mixed AUTOSAR": "混合AUTOSAR",
  "Architectures": "架构",
  "Elektrobit": "Elektrobit",
  "Cybersecurity": "网络安全",
  "Compliance": "合规",
  "Products": "产品",
  "iSOFT": "iSOFT",
  "Smart Lighting": "智能照明",
  "Solution": "解决方案",
  "Powered by": "基于",
  "Classic AUTOSAR": "Classic AUTOSAR",
  "Platform": "平台",
  "ATC's": "ATC",
  "Representative": "代表",
  "member": "成员",
  "All WG Meeting": "全体工作组会议",
  "US Automotive Computing Conference": "美国汽车计算大会",
  "Panel Discussion": "专题讨论",
  "AutoTech": "汽车技术展",
  "Event": "活动",
  "Meeting": "会议",
  "Workshop": "研讨会",
  "Release Event": "发布活动",
  "Quarterly Newsletter": "季度通讯",
  "Open Conference": "开放大会",
  "Sponsorship Opportunities": "赞助机会",
  "Venue & Accommodation": "场地与住宿",
  "Ticketing": "票务",
  "Agenda": "议程",
  "Location": "地点",
  "Training Program": "培训计划",
  "University Program": "大学计划",
  "Demo Development": "演示开发",
  "Past Projects": "往期项目",
  "UG-CN": "中国用户组",
  "UG-NA": "北美用户组",
};

function translateToChinese(text: string): string {
  let result = text;
  for (const [en, zh] of Object.entries(TRANSLATIONS)) {
    result = result.split(en).join(zh);
  }
  return result;
}

function parseEnglishDate(dateStr: string): string {
  dateStr = dateStr.toLowerCase().trim();
  
  const dotMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dotMatch) {
    const [, day, month, year] = dotMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  
  const monthYearMatch = dateStr.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})?/);
  if (monthYearMatch) {
    const [, month, day, year] = monthYearMatch;
    const monthNum = MONTH_MAP[month] || "01";
    const yearStr = year || new Date().getFullYear().toString();
    return `${yearStr}-${monthNum}-${day.padStart(2, "0")}`;
  }
  
  const onlyMonthYear = dateStr.match(/(\w+)\s+(\d{4})/);
  if (onlyMonthYear) {
    const [, month, year] = onlyMonthYear;
    const monthNum = MONTH_MAP[month] || "01";
    return `${year}-${monthNum}-01`;
  }
  
  return dateStr;
}

export const autosarNewsStrategy: CrawlStrategy = {
  name: "autosar_news",
  displayName: "AUTOSAR新闻",
  description: "爬取AUTOSAR新闻页面，自动解析每条新闻的标题、日期、摘要和链接",
  urlPatterns: [/www\.autosar\.org\/news-events/i],
  
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
        const pageUrl = pageNum === 1 ? url : url.replace(/\/page-(\d+)$/, `/page-${pageNum}`);
        
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
        
        const html = await page.content();
        const items = parseAutosarNews(html, "https://www.autosar.org");
        
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
          title: "AUTOSAR News & Events",
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
          translatedTitle: translateToChinese(item.title),
          url: item.url,
          date: item.date,
          summary: item.summary?.slice(0, 280) || item.summary,
          translatedSummary: translateToChinese(item.summary || "").slice(0, 280),
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

function parseAutosarNews(html: string, baseUrl: string): ExtractedItem[] {
  const $ = cheerio.load(html);
  const items: ExtractedItem[] = [];

  $(".article").each((_, el) => {
    const root = $(el);
    
    const titleEl = root.find(".news-list-title span").first();
    const title = titleEl.text().trim();
    
    const dateEl = root.find("time").first();
    const rawDate = dateEl.text().trim();
    const date = parseEnglishDate(rawDate);
    
    const descEl = root.find("[itemprop='description']").first();
    const summary = descEl.text().trim();
    
    const linkEl = root.find(".more").first();
    let link = linkEl.attr("href") || "";
    
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
