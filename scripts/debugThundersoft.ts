import { chromium } from "playwright";
import * as cheerio from "cheerio";

async function test() {
  const url = "https://www.thundersoft.com/category/newsroom/";
  
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
  });
  const page = await context.newPage();
  
  console.log("Navigating...");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  
  console.log("Waiting for content to load...");
  await page.waitForTimeout(3000);
  
  const html = await page.content();
  console.log("HTML length:", html.length);
  
  const $ = cheerio.load(html);
  
  console.log("\n=== Checking selectors ===");
  console.log(".newsList:", $(".newsList").length);
  console.log(".newsItem:", $(".newsItem").length);
  console.log("article:", $("article").length);
  console.log(".post:", $(".post").length);
  
  console.log("\n=== Checking body content ===");
  const bodyText = $("body").text().substring(0, 500);
  console.log("Body text preview:", bodyText);
  
  await browser.close();
}

test().catch(console.error);
