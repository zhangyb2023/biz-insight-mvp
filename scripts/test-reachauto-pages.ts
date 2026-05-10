import { chromium } from "playwright";
import * as cheerio from "cheerio";

const urls = [
  "https://www.reachauto.com/corporate-news/industry-activities",
  "https://www.reachauto.com/corporate-news/ecological-alliance"
];

async function checkPage(url: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  const html = await page.content();
  await browser.close();

  const $ = cheerio.load(html);
  const articles = $("article.elementor-post");
  const h4s = $("h4.ha-pg-title a");

  console.log(`\n=== ${url} ===`);
  console.log("article.elementor-post count:", articles.length);
  console.log("h4.ha-pg-title count:", h4s.length);

  if (articles.length > 0) {
    const first = articles.first();
    const title = first.find("h3 a").first().text().trim();
    const date = first.find("span.elementor-post-date").text().trim();
    console.log("最新文章:", title.slice(0, 40), "| 日期:", date);
  }

  if (h4s.length > 0) {
    const first = h4s.first();
    const title = first.text().trim();
    const contentArea = first.closest(".ha-pg-content-area");
    const date = contentArea.find(".ha-pg-date").text().trim();
    console.log("h4最新文章:", title.slice(0, 40), "| 日期:", date);
  }
}

async function main() {
  for (const url of urls) {
    await checkPage(url);
  }
}

main().catch(console.error);