#!/usr/bin/env npx tsx
/**
 * 智能爬取系统完整测试报告
 * 三层策略验证
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
      let body = ""; res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        const lines = body.split("\n"); let title = "", sourceUrl = "", publishedTime = "", contentStart = 0;
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
    const req = https.request({ hostname: "api.tavily.com", path: "/search", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } }, (res) => {
      let body = ""; res.on("data", (chunk) => body += chunk);
      res.on("end", () => { try { const r = JSON.parse(body); resolve((r.results || []).map((x: any) => ({ title: x.title || "", url: x.url || "", published_date: x.published_date, score: x.score || 0 }))); } catch (e) { reject(e); } });
    });
    req.on("error", reject); req.write(data); req.end();
  });
}

async function firecrawlExtract(url: string): Promise<FirecrawlResult> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v0/scrape", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${FIRECRAWL_KEY}` },
      body: JSON.stringify({ url, pageOptions: { onlyMainContent: true } }), signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!response.ok) return { title: url, content: "", url, error: `HTTP ${response.status}` };
    const data = await response.json() as any;
    if (!data.success) return { title: url, content: "", url, error: data.error || "Firecrawl failed" };
    return { title: data.data?.metadata?.title || url, content: data.data?.markdown || data.data?.content || "", url: data.data?.metadata?.url || url };
  } catch (e) { return { title: url, content: "", url, error: String(e) }; }
}

async function testCrawl(type: "official" | "media" | "professional", name: string, url: string, searchKw?: string) {
  process.stdout.write(`[${type}] ${name}: `);
  
  // Tier 1 & 2: Jina -> Firecrawl
  const jina = await jinaExtract(url);
  if (jina.content && jina.content.length > 200) {
    const date = jina.publishedTime ? ` | ${jina.publishedTime.slice(0,10)}` : "";
    console.log(`✅ Jina (${jina.content.length} chars${date})`);
    return { success: true, method: "jina", len: jina.content.length, date: jina.publishedTime };
  }

  const fc = await firecrawlExtract(url);
  if (fc.content && fc.content.length > 200) {
    console.log(`✅ Firecrawl (${fc.content.length} chars)`);
    return { success: true, method: "firecrawl", len: fc.content.length };
  }

  // Tier 3: Tavily 发现
  if (type === "professional" && searchKw) {
    const tavily = await tavilySearch(searchKw, 3);
    if (tavily.length > 0) {
      const first = await jinaExtract(tavily[0].url);
      if (first.content && first.content.length > 200) {
        console.log(`✅ Tavily+Jina (${first.content.length} chars)`);
        return { success: true, method: "tavily+jina", len: first.content.length };
      }
    }
  }

  console.log(`❌ 全部失败 (J:${jina.content?.length||0} FC:${fc.content?.length||0})`);
  return { success: false, jinaLen: jina.content?.length || 0, fcLen: fc.content?.length || 0 };
}

async function main() {
  console.log("🧪 智能爬取系统 - 完整测试\n");

  const results: any[] = [];
  
  // Tier 1: Official
  console.log("\n【Tier 1: 官方公司网站】");
  const official = [
    ["Vector", "https://www.vector.com/cn/zh/"],
    ["AUTOSAR", "https://www.autosar.org/news-events/"],
    ["Elektrobit", "https://www.elektrobit.com/newsroom/"],
    ["东软睿驰", "https://www.reachauto.com/corporate-news/"],
    ["中科创达", "https://www.thundersoft.com/category/newsroom/"],
    ["普华基础软件", "https://www.i-soft.com.cn/news/dynamic.html"],
    ["地平线", "https://www.horizon.auto/"],
    ["黑芝麻智能", "https://www.blacksesame.com/"],
    ["芯驰科技", "https://www.semidrive.com/news"],
    ["华为乾崑", "https://auto.huawei.com/cn/"],
  ];
  for (const [n, u] of official) { const r = await testCrawl("official", n, u); results.push({ type: "official", name: n, ...r }); }

  // Tier 2: Media
  console.log("\n【Tier 2: 主流媒体】");
  const media = [
    ["36氪", "https://www.36kr.com/"],
    ["极客公园", "https://www.geekpark.net/"],
    ["虎嗅", "https://www.huxiu.com/"],
    ["钛媒体", "https://www.tmtpost.com/"],
    ["汽车之家", "https://www.autohome.com.cn/news/"],
    ["新浪汽车", "https://auto.sina.com.cn/"],
  ];
  for (const [n, u] of media) { const r = await testCrawl("media", n, u); results.push({ type: "media", name: n, ...r }); }

  // Tier 3: Professional
  console.log("\n【Tier 3: 专业机构】");
  const professional = [
    ["盖世汽车", "https://i.gasgoo.com/news/", "盖世汽车 智能驾驶 2025"],
    ["第一电动", "https://www.d1ev.com/news/", "第一电动 新能源汽车"],
  ];
  for (const [n, u, kw] of professional) { const r = await testCrawl("professional", n, u, kw); results.push({ type: "professional", name: n, ...r }); }

  // Summary
  console.log("\n\n" + "=".repeat(60));
  console.log("测试结果汇总");
  console.log("=".repeat(60));
  
  const byType: Record<string, { ok: number, fail: number }> = {};
  for (const r of results) {
    byType[r.type] = byType[r.type] || { ok: 0, fail: 0 };
    if (r.success) byType[r.type].ok++; else byType[r.type].fail++;
  }
  
  let totalOk = 0, totalFail = 0;
  for (const [type, stat] of Object.entries(byType)) {
    const total = stat.ok + stat.fail;
    const rate = ((stat.ok / total) * 100).toFixed(1);
    console.log(`${type}: ${stat.ok}/${total} 成功 (${rate}%)`);
    totalOk += stat.ok; totalFail += stat.fail;
  }
  
  console.log("=".repeat(60));
  console.log(`总计: ${totalOk}/${totalOk + totalFail} 成功`);
  console.log("=".repeat(60));

  // Failed details
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log("\n失败详情:");
    for (const f of failed) {
      console.log(`  - ${f.name} (${f.type}): Jina=${f.jinaLen}chars, FC=${f.fcLen}chars`);
    }
  }

  console.log("\n✅ 测试完成!");
}

main().catch(console.error);
