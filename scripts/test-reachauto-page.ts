import { chromium } from "playwright";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testReachauto() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://www.reachauto.com/corporate-news/product-technology", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  const html = await page.content();
  await browser.close();

  const $ = cheerio.load(html);

  console.log("=== Structure 1: article.elementor-post ===");
  const articles = $("article.elementor-post");
  console.log("Count:", articles.length);

  if (articles.length > 0) {
    articles.each((i, el) => {
      const title = $(el).find("h3 a").first().text().trim();
      const href = $(el).find("h3 a").first().attr("href");
      const date = $(el).find("span.elementor-post-date").text().trim();
      console.log(`  [${i+1}] title: ${title.slice(0, 50)}, href: ${href}, date: ${date}`);
    });
  }

  console.log("\n=== Structure 2: h4.ha-pg-title ===");
  const h4s = $("h4.ha-pg-title a");
  console.log("Count:", h4s.length);

  console.log("\n=== Any /2024/ or /2025/ URLs ===");
  const allLinks = $("a");
  let count = 0;
  allLinks.each((i, el) => {
    const href = $(el).attr("href") || "";
    if (href.includes("/202") && count < 10) {
      console.log("  Link:", href);
      count++;
    }
  });

  console.log("\n=== Search for posts-container or similar ===");
  const containers = $("[class*='post'], [class*='article']");
  console.log("Found post-related elements:", containers.length);
}

testReachauto().catch(e => console.error("Error:", e.message));