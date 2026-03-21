#!/usr/bin/env npx tsx
/**
 * 专业机构完整爬取流程测试
 * 策略: Tavily发现 -> Jina提取 -> Firecrawl备选
 */

import https from "https";

const TAVILY_KEY = process.env.TAVILY_API_KEY || "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";
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY || "fc-30d1745f7cf44e99a212e84dd61368d4";
const TIMEOUT_MS = 20000;

interface JinaResult { title: string; url: string; content: string; publishedTime?: string; error?: string; }
interface TavilyResult { url: string; title: string; published_date?: string; score: number; }
interface FirecrawlResult { title: string; content: string; url: string; error?: string; }

async function jinaExtract(url: string): Promise<JinaResult> {
  return new Promise((resolve) => {
    const req = https.get(`https://r.jina.ai/${encodeURIComponent(url)}`, { headers: { Accept: "text/plain" } }, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        const lines = body.split("\n");
        let title = "", sourceUrl = "", publishedTime = "", contentStart = 0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith("Title:")) title = line.substring(6).trim();
          else if (line.startsWith("URL Source:")) sourceUrl = line.substring(11).trim();
          else if (line.startsWith("Published Time:")) publishedTime = line.substring(15).trim();
          else if (line.startsWith("Markdown Content:")) { contentStart = i + 1; break; }
        }
        resolve({ title: title || sourceUrl || url, url: sourceUrl || url, content: lines.slice(contentStart).join("\n").trim(), publishedTime });
      });
    });
    req.on("error", (e) => resolve({ title: url, url, content: "", error: e.message }));
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(); resolve({ title: url, url, content: "", error: "Timeout" }); });
  });
}

async function tavilySearch(query: string, maxResults = 5): Promise<TavilyResult[]> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ api_key: TAVILY_KEY, query, search_depth: "advanced", max_results: maxResults });
    const req = https.request({
      hostname: "api.tavily.com", path: "/search", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          const result = JSON.parse(body);
          resolve((result.results || []).map((r: any) => ({ title: r.title || "", url: r.url || "", published_date: r.published_date, score: r.score || 0 })));
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function firecrawlExtract(url: string): Promise<FirecrawlResult> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v0/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${FIRECRAWL_KEY}` },
      body: JSON.stringify({ url, pageOptions: { onlyMainContent: true } }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!response.ok) return { title: url, content: "", url, error: `HTTP ${response.status}` };
    const data = await response.json() as any;
    if (!data.success) return { title: url, content: "", url, error: data.error || "Firecrawl failed" };
    return { title: data.data?.metadata?.title || url, content: data.data?.markdown || data.data?.content || "", url: data.data?.metadata?.url || url };
  } catch (e) { return { title: url, content: "", url, error: String(e) }; }
}

async function crawlProfessional(name: string, website: string, keywords: string[]) {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`[${name}] 专业机构爬取`);
  console.log(`网站: ${website}`);
  console.log("=".repeat(50));

  let totalFound = 0;
  let totalSaved = 0;

  // 策略A: Tavily搜索发现
  console.log("\n[策略A] Tavily 搜索发现...");
  const discoveredUrls: TavilyResult[] = [];
  
  for (const kw of keywords.slice(0, 2)) {
    await new Promise(r => setTimeout(r, 1000)); // 避免限流
    const results = await tavilySearch(kw, 5);
    console.log(`  关键词 "${kw}": 发现 ${results.length} 个结果`);
    discoveredUrls.push(...results);
  }

  // 去重
  const uniqueUrls = discoveredUrls.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
  console.log(`  总计去重后: ${uniqueUrls.length} 个URL`);

  if (uniqueUrls.length === 0) {
    console.log("  ⚠️ 没有通过搜索发现URL，尝试直接爬网站...");
    // 直接尝试 Jina 提取网站首页
    const direct = await jinaExtract(website);
    if (direct.content && direct.content.length > 200) {
      console.log(`  ✅ 直接提取成功: ${direct.content.length} chars`);
      return { found: 1, saved: 1 };
    }
    return { found: 0, saved: 0 };
  }

  // 策略B: Jina提取
  console.log("\n[策略B] Jina 提取内容...");
  for (const item of uniqueUrls.slice(0, 5)) {
    await new Promise(r => setTimeout(r, 500));
    
    const jina = await jinaExtract(item.url);
    if (jina.content && jina.content.length > 200) {
      console.log(`  ✅ ${item.title?.slice(0, 40)}...`);
      console.log(`     [${jina.publishedTime?.slice(0,10) || '无日期'}] ${jina.content.length} chars`);
      totalFound++;
      totalSaved++;
    } else {
      // 策略C: Firecrawl备选
      const fc = await firecrawlExtract(item.url);
      if (fc.content && fc.content.length > 200) {
        console.log(`  ✅ [FC] ${fc.title?.slice(0, 40)}...`);
        totalFound++;
        totalSaved++;
      } else {
        console.log(`  ⚠️ 跳过: ${item.url.slice(0, 50)}...`);
      }
    }
  }

  console.log(`\n结果: 发现 ${totalFound} 条, 保存 ${totalSaved} 条`);
  return { found: totalFound, saved: totalSaved };
}

async function main() {
  const sources = [
    { name: "盖世汽车", website: "https://www.gasgoo.com/", keywords: ["盖世汽车 智能驾驶 2025", "gasgoo automotive news"] },
    { name: "第一电动", website: "https://www.d1ev.com/", keywords: ["第一电动 新能源汽车", "d1ev EV news"] },
    { name: "NE时代", website: "https://www.netimes.com.cn/", keywords: ["NE时代 新能源汽车 电驱动", "netimes automotive"] },
    { name: "焉知汽车", website: "https://www.yy异行.com/", keywords: ["焉知汽车 智能驾驶", "yy异行 automotive"] },
    { name: "高工智能汽车", website: "https://www.gg-lb.com/", keywords: ["高工智能汽车 ADAS", "gaogong automotive"] },
  ];

  let totalFound = 0, totalSaved = 0;
  
  for (const source of sources) {
    const result = await crawlProfessional(source.name, source.website, source.keywords);
    totalFound += result.found;
    totalSaved += result.saved;
  }

  console.log(`\n\n${"=".repeat(50)}`);
  console.log("总计:");
  console.log(`  发现: ${totalFound} 条`);
  console.log(`  保存: ${totalSaved} 条`);
  console.log("=".repeat(50));
}

main().catch(console.error);
