#!/usr/bin/env npx tsx
/**
 * Firecrawl Crawl 深度爬取测试 - 作为最后兜底
 */

const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY || "fc-30d1745f7cf44e99a212e84dd61368d4";
const TIMEOUT_MS = 60000;
const MAX_PAGES = 20;

interface FirecrawlCrawlResult { urls?: string[]; error?: string; }

async function firecrawlCrawl(url: string, maxPages = MAX_PAGES): Promise<FirecrawlCrawlResult> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v0/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${FIRECRAWL_KEY}` },
      body: JSON.stringify({ url, pageOptions: { onlyMainContent: true }, limit: maxPages }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }

    const data = await response.json() as any;
    if (!data.success) {
      return { error: data.error || "Crawl failed" };
    }

    return { urls: data.data || [] };
  } catch (e) {
    return { error: String(e) };
  }
}

async function firecrawlScrape(url: string): Promise<{ content?: string; title?: string; error?: string }> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v0/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${FIRECRAWL_KEY}` },
      body: JSON.stringify({ url, pageOptions: { onlyMainContent: true } }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }

    const data = await response.json() as any;
    if (!data.success) {
      return { error: data.error || "Scrape failed" };
    }

    return {
      content: data.data?.markdown || data.data?.content || "",
      title: data.data?.metadata?.title || ""
    };
  } catch (e) {
    return { error: String(e) };
  }
}

async function main() {
  console.log("🔥 Firecrawl Crawl 深度爬取测试\n");

  const sites = [
    { name: "NE时代", url: "https://www.netimes.com.cn/", type: "professional" },
    { name: "焉知汽车", url: "https://www.yy异行.com/", type: "professional" },
    { name: "高工智能汽车", url: "https://www.gg-lb.com/", type: "professional" },
    { name: "盖世汽车", url: "https://www.gasgoo.com/", type: "professional" },
  ];

  for (const site of sites) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`[${site.name}] Firecrawl Crawl 测试`);
    console.log(`URL: ${site.url}`);
    console.log("=".repeat(50));

    // 先尝试直接 scrape
    console.log("\n1. 直接 scrape...");
    const scrape = await firecrawlScrape(site.url);
    if (scrape.content && scrape.content.length > 200) {
      console.log(`   ✅ 成功! 内容: ${scrape.content.length} chars`);
      console.log(`   标题: ${scrape.title?.slice(0, 50)}`);
      continue;
    }
    console.log(`   ❌ 失败: ${scrape.error}`);

    // 尝试 crawl 发现更多页面
    console.log("\n2. Crawl 深度发现...");
    const crawl = await firecrawlCrawl(site.url, 20);
    if (crawl.error) {
      console.log(`   ❌ Crawl 失败: ${crawl.error}`);
      continue;
    }

    const urls = crawl.urls || [];
    console.log(`   发现 ${urls.length} 个页面`);

    if (urls.length === 0) {
      console.log("   没有发现更多页面");
      continue;
    }

    // 尝试抓取发现的页面
    console.log("\n3. 抓取发现的页面...");
    let successCount = 0;
    for (const discoveredUrl of urls.slice(0, 5)) {
      const r = await firecrawlScrape(discoveredUrl);
      if (r.content && r.content.length > 200) {
        console.log(`   ✅ ${discoveredUrl.slice(0, 60)}... -> ${r.content.length} chars`);
        successCount++;
        if (successCount >= 3) break;
      }
    }
    console.log(`\n   总计成功: ${successCount}/${Math.min(5, urls.length)}`);
  }

  console.log("\n\n✅ 测试完成!");
}

main().catch(console.error);
