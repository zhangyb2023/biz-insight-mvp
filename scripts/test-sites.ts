#!/usr/bin/env npx tsx
import { chromium } from "playwright";

async function testSite(name: string, url: string) {
  console.log(`\n=== 测试: ${name} ===`);
  console.log(`URL: ${url}`);
  
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  
  try {
    await page.goto(url, { timeout: 20000, waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    
    const title = await page.title();
    const textLen = (await page.evaluate(() => document.body.innerText || "")).length;
    
    console.log(`Title: ${title.slice(0, 50)}`);
    console.log(`Text length: ${textLen} chars`);
    console.log(`Status: ${textLen > 1000 ? "✅ OK" : "⚠️ Low content"}`);
  } catch (e: any) {
    console.log(`Error: ${e.message.slice(0, 80)}`);
  } finally {
    await browser.close();
  }
}

async function main() {
  const sites = [
    ["Vector", "https://www.vector.com/cn/zh/"],
    ["Elektrobit", "https://www.elektrobit.com/newsroom/"],
    ["AUTOSAR", "https://www.autosar.org/news-events/"],
    ["36kr", "https://www.36kr.com/"],
    ["极客公园", "https://www.geekpark.net/"],
  ];

  for (const [name, url] of sites) {
    await testSite(name, url);
  }
}

main().catch(console.error);
