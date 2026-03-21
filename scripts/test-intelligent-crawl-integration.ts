#!/usr/bin/env npx tsx
/**
 * 智能爬取集成测试
 * 测试 intelligentCrawl 函数是否正确工作
 */

import { intelligentCrawl, batchIntelligentCrawl } from "../lib/crawl/intelligentCrawl";

async function testSingle() {
  console.log("=== 单URL智能爬取测试 ===\n");

  const testCases = [
    { name: "Vector", url: "https://www.vector.com/cn/zh/", type: "official" as const },
    { name: "AUTOSAR", url: "https://www.autosar.org/news-events/", type: "official" as const },
    { name: "36氪", url: "https://www.36kr.com/", type: "media" as const },
    { name: "盖世汽车", url: "https://i.gasgoo.com/news/", type: "professional" as const, keyword: "智能驾驶 2025" },
  ];

  for (const tc of testCases) {
    console.log(`\n[${tc.name}] ${tc.url}`);
    console.log(`类型: ${tc.type}`);
    
    const result = await intelligentCrawl(tc.url, tc.type, tc.keyword, tc.url);
    
    if (result.success && result.page) {
      console.log(`✅ 成功!`);
      console.log(`  方法: ${result.method}`);
      console.log(`  标题: ${result.page.title?.slice(0, 50)}`);
      console.log(`  内容长度: ${result.page.html.length} chars`);
    } else {
      console.log(`❌ 失败: ${result.error}`);
    }
  }
}

async function testBatch() {
  console.log("\n\n=== 批量智能爬取测试 ===\n");

  const urls = [
    "https://www.vector.com/cn/zh/",
    "https://www.autosar.org/news-events/",
    "https://www.36kr.com/",
  ];

  const result = await batchIntelligentCrawl(urls, "official");

  console.log(`成功: ${result.pages.length}/${urls.length}`);
  console.log(`失败: ${result.errors.length}`);
  
  for (const [url, method] of Object.entries(result.methods)) {
    const status = result.pages.find(p => p.url === url) ? "✅" : "❌";
    console.log(`  ${status} ${method}: ${url.slice(0, 50)}`);
  }
}

async function main() {
  console.log("🧪 智能爬取集成测试\n");

  await testSingle();
  await testBatch();

  console.log("\n\n✅ 测试完成!");
}

main().catch(console.error);
