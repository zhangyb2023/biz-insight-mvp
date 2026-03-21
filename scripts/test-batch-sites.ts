#!/usr/bin/env npx tsx
/**
 * 批量网站测试 - 测试更多网站
 */

import https from "https";
import http from "http";

const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY || "fc-30d1745f7cf44e99a212e84dd61368d4";
const TIMEOUT_MS = 20000;

interface JinaResult { title: string; url: string; content: string; publishedTime?: string; error?: string; }
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

async function test(name: string, url: string, type: string) {
  process.stdout.write(`[${type}] ${name}: `);
  try {
    const r = await jinaExtract(url);
    if (r.content && r.content.length > 200) {
      console.log(`Jina OK (${r.content.length} chars) ${r.publishedTime ? '| Date: ' + r.publishedTime.slice(0,10) : ''}`);
      return { success: true, method: "jina", len: r.content.length, date: r.publishedTime };
    }
    const fc = await firecrawlExtract(url);
    if (fc.content && fc.content.length > 200) {
      console.log(`Firecrawl OK (${fc.content.length} chars)`);
      return { success: true, method: "firecrawl", len: fc.content.length };
    }
    console.log(`FAILED (Jina: ${r.content?.length || 0}, FC: ${fc.content?.length || 0})`);
    return { success: false, jinaLen: r.content?.length || 0, fcLen: fc.content?.length || 0, error: fc.error || r.error };
  } catch (e: any) {
    console.log(`ERROR: ${e.message.slice(0, 50)}`);
    return { success: false, error: e.message };
  }
}

async function main() {
  const sites: [string, string, string][] = [
    // Official
    ["东软睿驰", "https://www.reachauto.com/corporate-news/", "official"],
    ["中科创达", "https://www.thundersoft.com/category/newsroom/", "official"],
    ["普华基础软件", "https://www.i-soft.com.cn/news/dynamic.html", "official"],
    ["地平线", "https://www.horizon.auto/", "official"],
    ["黑芝麻智能", "https://www.blacksesame.com/", "official"],
    ["芯驰科技", "https://www.semidrive.com/news", "official"],
    ["华为乾崑", "https://auto.huawei.com/cn/", "official"],
    // Media
    ["虎嗅", "https://www.huxiu.com/", "media"],
    ["钛媒体", "https://www.tmtpost.com/", "media"],
    ["汽车之家", "https://www.autohome.com.cn/news/", "media"],
    ["新浪汽车", "https://auto.sina.com.cn/", "media"],
    // Professional
    ["第一电动", "https://www.d1ev.com/news/", "professional"],
    ["NE时代", "https://www.netimes.com.cn/", "professional"],
    ["焉知汽车", "https://www.yy异行.com/news/", "professional"],
  ];

  let ok = 0, fail = 0;
  const failed: any[] = [];
  
  for (const [name, url, type] of sites) {
    const r = await test(name, url, type);
    if (r.success) ok++; else { fail++; failed.push({ name, url, type, ...r }); }
  }
  
  console.log(`\n\n总计: ${ok}/${ok+fail} 成功`);
  if (failed.length > 0) {
    console.log("\n失败的网站:");
    for (const f of failed) {
      console.log(`  - ${f.name} (${f.type}): Jina=${f.jinaLen}chars, FC=${f.fcLen}chars, Error=${f.error?.slice(0,50)}`);
    }
  }
}

main().catch(console.error);
