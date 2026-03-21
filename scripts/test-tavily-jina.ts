/**
 * 测试脚本: Tavily + Jina 全新爬取流程
 * 不依赖Playwright，使用云端API
 */

import https from "https";
import http from "http";

const TAVILY_KEY = process.env.TAVILY_API_KEY || "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";

interface TavilyResult {
  title: string;
  url: string;
  score: number;
  description: string;
  published_date?: string;
}

interface JinaContent {
  title: string;
  url: string;
  content: string;
  publishedTime?: string;
}

async function tavilySearch(query: string, maxResults = 5): Promise<TavilyResult[]> {
  const data = JSON.stringify({
    api_key: TAVILY_KEY,
    query,
    search_depth: "advanced",
    max_results: maxResults,
    include_answer: true,
    include_raw_content: false,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.tavily.com",
        path: "/search",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const result = JSON.parse(body);
            resolve(
              (result.results || []).map((r: any) => ({
                title: r.title || "",
                url: r.url || "",
                score: r.score || 0,
                description: r.description || "",
                published_date: r.published_date,
              }))
            );
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function jinaExtract(url: string): Promise<JinaContent> {
  const encodedUrl = encodeURIComponent(url);
  const jinaUrl = `https://r.jina.ai/${encodedUrl}`;

  return new Promise((resolve, reject) => {
    https.get(jinaUrl, { headers: { Accept: "text/plain" } }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        // Parse Jina's markdown format
        const lines = body.split("\n");
        let title = "";
        let sourceUrl = "";
        let publishedTime = "";
        let contentStart = 0;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith("Title:")) {
            title = line.substring(6).trim();
          } else if (line.startsWith("URL Source:")) {
            sourceUrl = line.substring(11).trim();
          } else if (line.startsWith("Published Time:")) {
            publishedTime = line.substring(15).trim();
          } else if (line.startsWith("Markdown Content:")) {
            contentStart = i + 1;
            break;
          }
        }

        const content = lines.slice(contentStart).join("\n").trim();

        resolve({
          title,
          url: sourceUrl || url,
          content,
          publishedTime,
        });
      });
    }).on("error", reject);
  });
}

async function main() {
  console.log("🚀 Testing Tavily + Jina Pipeline\n");

  // Test 1: Tavily Search
  console.log("=== Step 1: Tavily Search ===");
  const companies = [
    "Vector AUTOSAR",
    "ETAS 汽车软件",
    "Elektrobit EB tresos",
  ];

  for (const company of companies) {
    console.log(`\nSearching for: ${company}`);
    try {
      const results = await tavilySearch(`${company} 最新动态 新闻 2024 2025`, 3);
      console.log(`  Found ${results.length} results:`);
      for (const r of results) {
        console.log(`    - [${r.score.toFixed(2)}] ${r.title.substring(0, 60)}`);
        console.log(`      ${r.url.substring(0, 70)}`);
      }
    } catch (e) {
      console.log(`  Error: ${e}`);
    }
  }

  // Test 2: Jina Extract on AUTOSAR PDF
  console.log("\n\n=== Step 2: Jina Extract (PDF Test) ===");
  const testUrl = "https://www.autosar.org/fileadmin/user_upload/Newsletter/Q3_Newsletter_China.pdf";
  console.log(`Extracting: ${testUrl}`);
  try {
    const content = await jinaExtract(testUrl);
    console.log(`\nTitle: ${content.title}`);
    console.log(`Published: ${content.publishedTime}`);
    console.log(`Content length: ${content.content.length} chars`);
    console.log(`\nPreview:\n${content.content.substring(0, 500)}...`);
  } catch (e) {
    console.log(`Error: ${e}`);
  }

  // Test 3: Full Pipeline - Search + Extract
  console.log("\n\n=== Step 3: Full Pipeline (Search → Extract) ===");
  try {
    const results = await tavilySearch("普华基础软件 i-soft AUTOSAR 2025", 3);
    if (results.length > 0) {
      const top = results[0];
      console.log(`Top result: ${top.title}`);
      console.log(`URL: ${top.url}`);

      const extracted = await jinaExtract(top.url);
      console.log(`\nExtracted content:`);
      console.log(`  Title: ${extracted.title}`);
      console.log(`  Length: ${extracted.content.length} chars`);
      console.log(`  Preview: ${extracted.content.substring(0, 300)}...`);
    }
  } catch (e) {
    console.log(`Error: ${e}`);
  }

  console.log("\n\n✅ Test Complete!");
}

main().catch(console.error);
