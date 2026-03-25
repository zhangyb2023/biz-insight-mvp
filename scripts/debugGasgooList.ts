import { chromium } from "playwright";
import * as cheerio from "cheerio";

const LIST_PAGE_URL = "https://auto.gasgoo.com/automaker/C-109";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Crawling:", LIST_PAGE_URL);
  await page.goto(LIST_PAGE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
  
  const content = await page.content();
  
  const $ = cheerio.load(content);
  
  console.log("Page content length:", content.length);
  
  console.log("\n--- Searching for news article links ---\n");
  
  const articleLinks: string[] = [];
  
  $("a").each((i, el) => {
    const href = $(el).attr("href") || "";
    if (href.includes("/news/") && href.endsWith(".shtml")) {
      articleLinks.push(href);
    }
  });
  
  console.log("Total article links found:", articleLinks.length);
  console.log("\nFirst 20 links:");
  articleLinks.slice(0, 20).forEach((link, i) => {
    console.log(`  ${i + 1}. ${link}`);
  });
  
  console.log("\n--- Searching for listArticle content blocks ---\n");
  
  const listArticles = $(".listArticle").length;
  console.log("Number of .listArticle elements:", listArticles);
  
  const contentLists = $(".contentList").length;
  console.log("Number of .contentList elements:", contentLists);
  
  console.log("\n--- Bigtitle links ---\n");
  
  $(".bigtitle a").each((i, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim();
    if (href && i < 10) {
      console.log(`  ${i + 1}. Text: "${text.substring(0, 50)}..."`);
      console.log(`     Link: ${href}`);
    }
  });
  
  await browser.close();
}

main().catch(console.error);