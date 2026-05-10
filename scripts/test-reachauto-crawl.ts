import { reachautoNewsStrategy } from "@/lib/crawl/strategies/reachautoNewsStrategy";
import * as cheerio from "cheerio";
import { chromium } from "playwright";

const urls = [
  "https://www.reachauto.com/corporate-news/industry-activities/",
  "https://www.reachauto.com/corporate-news/ecological-alliance/",
  "https://www.reachauto.com/corporate-news/product-technology/"
];

async function crawlAll() {
  console.log("开始爬取东软睿驰...\n");

  for (const url of urls) {
    console.log(`=== 爬取: ${url} ===`);
    const result = await reachautoNewsStrategy.crawl(url);

    if (result.success) {
      console.log("成功!");
      console.log(`提取到 ${result.extractedItems.length} 条文章:`);
      result.extractedItems.slice(0, 5).forEach((item, i) => {
        console.log(`  [${i+1}] ${item.date} - ${item.title.slice(0, 50)}...`);
      });
      if (result.extractedItems.length > 5) {
        console.log(`  ... 还有 ${result.extractedItems.length - 5} 条`);
      }
    } else {
      console.log("失败:", result.error);
    }
    console.log("");
  }
}

crawlAll().catch(console.error);