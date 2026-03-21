#!/usr/bin/env npx tsx
/**
 * 智能爬取流程测试
 * 
 * 三层策略：
 * - Tier 1 (官方): Jina Reader → Firecrawl
 * - Tier 2 (媒体): HTTP直接爬 → Jina → Firecrawl
 * - Tier 3 (专业): Tavily发现 → Jina → Firecrawl → Firecrawl深度爬取
 */

import https from "https";
import http from "http";

const TAVILY_KEY = process.env.TAVILY_API_KEY || "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";
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY || "fc-30d1745f7cf44e99a212e84dd61368d4";

const TIMEOUT_MS = 20000;

// ============================================================================
// Jina Reader - 内容提取
// ============================================================================

interface JinaResult {
  title: string;
  url: string;
  content: string;
  publishedTime?: string;
  error?: string;
}

async function jinaExtract(url: string): Promise<JinaResult> {
  const encodedUrl = encodeURIComponent(url);
  const jinaUrl = `https://r.jina.ai/${encodedUrl}`;

  return new Promise((resolve) => {
    const req = https.get(jinaUrl, { headers: { Accept: "text/plain" } }, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          const lines = body.split("\n");
          let title = "", sourceUrl = "", publishedTime = "", contentStart = 0;

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith("Title:")) title = line.substring(6).trim();
            else if (line.startsWith("URL Source:")) sourceUrl = line.substring(11).trim();
            else if (line.startsWith("Published Time:")) publishedTime = line.substring(15).trim();
            else if (line.startsWith("Markdown Content:")) { contentStart = i + 1; break; }
          }

          resolve({
            title: title || sourceUrl || url,
            url: sourceUrl || url,
            content: lines.slice(contentStart).join("\n").trim(),
            publishedTime
          });
        } catch (e) {
          resolve({ title: url, url, content: "", error: String(e) });
        }
      });
    });
    req.on("error", (e) => resolve({ title: url, url, content: "", error: e.message }));
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(); resolve({ title: url, url, content: "", error: "Timeout" }); });
  });
}

// ============================================================================
// Tavily Search - 内容发现
// ============================================================================

interface TavilyResult {
  url: string;
  title: string;
  published_date?: string;
  score: number;
}

async function tavilySearch(query: string, maxResults = 5): Promise<TavilyResult[]> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      api_key: TAVILY_KEY,
      query,
      search_depth: "advanced",
      max_results: maxResults,
    });

    const req = https.request({
      hostname: "api.tavily.com",
      path: "/search",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          const result = JSON.parse(body);
          resolve((result.results || []).map((r: any) => ({
            title: r.title || "",
            url: r.url || "",
            published_date: r.published_date,
            score: r.score || 0,
          })));
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ============================================================================
// Firecrawl - 备选提取
// ============================================================================

interface FirecrawlResult {
  title: string;
  content: string;
  url: string;
  error?: string;
}

async function firecrawlExtract(url: string): Promise<FirecrawlResult> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v0/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${FIRECRAWL_KEY}`
      },
      body: JSON.stringify({ url, pageOptions: { onlyMainContent: true } }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (!response.ok) {
      return { title: url, content: "", url, error: `HTTP ${response.status}` };
    }

    const data = await response.json() as any;
    if (!data.success) {
      return { title: url, content: "", url, error: data.error || "Firecrawl failed" };
    }

    return {
      title: data.data?.metadata?.title || url,
      content: data.data?.markdown || data.data?.content || "",
      url: data.data?.metadata?.url || url,
    };
  } catch (e) {
    return { title: url, content: "", url, error: String(e) };
  }
}

// ============================================================================
// 智能爬取策略
// ============================================================================

type SourceType = "official" | "media" | "professional";

async function crawlWithStrategy(type: SourceType, name: string, url: string, searchKeyword?: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${name}] ${type} 站点爬取测试`);
  console.log(`URL: ${url}`);
  console.log("=".repeat(60));

  // 策略A: Jina Reader
  console.log(`\n[策略A] Jina Reader 提取...`);
  const jinaResult = await jinaExtract(url);
  
  if (jinaResult.error || !jinaResult.content || jinaResult.content.length < 200) {
    console.log(`  ❌ Jina失败: ${jinaResult.error || "内容太短 (" + jinaResult.content?.length + " chars)"}`);
    
    // 策略B: Firecrawl
    console.log(`\n[策略B] Firecrawl 备选...`);
    const fcResult = await firecrawlExtract(url);
    
    if (fcResult.error || !fcResult.content || fcResult.content.length < 200) {
      console.log(`  ❌ Firecrawl也失败: ${fcResult.error || "内容太短"}`);
      return { success: false, jina: jinaResult, firecrawl: fcResult };
    }
    
    console.log(`  ✅ Firecrawl成功: ${fcResult.title?.slice(0, 40)}...`);
    console.log(`  内容长度: ${fcResult.content.length} chars`);
    return { success: true, method: "firecrawl", result: fcResult };
  }

  console.log(`  ✅ Jina成功!`);
  console.log(`  标题: ${jinaResult.title?.slice(0, 50)}`);
  console.log(`  内容长度: ${jinaResult.content.length} chars`);
  console.log(`  发布时间: ${jinaResult.publishedTime || "无"}`);
  
  // Tier 3 额外: Tavily搜索发现
  if (type === "professional" && searchKeyword) {
    console.log(`\n[额外] Tavily 搜索发现...`);
    const tavilyResults = await tavilySearch(searchKeyword, 3);
    console.log(`  发现 ${tavilyResults.length} 个结果`);
    for (const r of tavilyResults.slice(0, 2)) {
      console.log(`  - [${r.score.toFixed(2)}] ${r.title?.slice(0, 40)}`);
    }
  }

  return { success: true, method: "jina", result: jinaResult };
}

// ============================================================================
// 主测试
// ============================================================================

async function main() {
  console.log("🧪 智能爬取流程测试\n");

  // Tier 1: 官方公司网站
  console.log("\n\n" + "🔷".repeat(30));
  console.log("Tier 1: 官方公司网站测试");
  console.log("🔷".repeat(30));
  
  await crawlWithStrategy("official", "Vector", "https://www.vector.com/cn/zh/");
  await crawlWithStrategy("official", "AUTOSAR", "https://www.autosar.org/news-events/");
  await crawlWithStrategy("official", "Elektrobit", "https://www.elektrobit.com/newsroom/");

  // Tier 2: 主流媒体
  console.log("\n\n" + "🔶".repeat(30));
  console.log("Tier 2: 主流媒体测试");
  console.log("🔶".repeat(30));
  
  await crawlWithStrategy("media", "36氪", "https://www.36kr.com/");
  await crawlWithStrategy("media", "极客公园", "https://www.geekpark.net/");

  // Tier 3: 专业机构
  console.log("\n\n" + "🔴".repeat(30));
  console.log("Tier 3: 专业机构测试");
  console.log("🔴".repeat(30));
  
  await crawlWithStrategy("professional", "盖世汽车", "https://i.gasgoo.com/news/", "智能驾驶 2025");
  await crawlWithStrategy("professional", "高工智能汽车", "https://www.gg-lb.com/", "自动驾驶");

  console.log("\n\n✅ 测试完成!");
}

main().catch(console.error);
