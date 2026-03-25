import { isGasgooFlashPage, parseGasgooFlashPage } from "../lib/extract/gasgooFlash";
import { playwrightCrawl } from "../lib/crawl/playwrightCrawl";

async function main() {
  console.log("=== 直接测试盖世快讯爬取 ===\n");

  const testUrl = "https://auto.gasgoo.com/newsflash/flashnews/1";
  
  console.log("1. URL检测");
  console.log(`   isGasgooFlashPage: ${isGasgooFlashPage(testUrl)}\n`);

  if (!isGasgooFlashPage(testUrl)) {
    console.log("URL不是盖世快讯页面，退出");
    return;
  }

  console.log("2. 爬取第1、2、3页...");
  
  const urls = [
    "https://auto.gasgoo.com/newsflash/flashnews/1",
    "https://auto.gasgoo.com/newsflash/flashnews/2",
    "https://auto.gasgoo.com/newsflash/flashnews/3"
  ];

  const crawlResult = await playwrightCrawl(urls, {
    useCache: false,
    forceRefresh: true
  });

  console.log(`   爬取完成: ${crawlResult.pages.length} 页`);
  console.log(`   错误: ${crawlResult.errors.length}\n`);

  console.log("3. 解析快讯...");
  
  let allItems: any[] = [];
  
  for (const rawPage of crawlResult.pages) {
    const parsed = parseGasgooFlashPage(rawPage.html, testUrl);
    console.log(`   ${rawPage.url}: ${parsed.items.length} 条`);
    allItems = allItems.concat(parsed.items);
  }

  console.log(`\n=== 总计: ${allItems.length} 条快讯 ===\n`);

  // 显示前5条
  console.log("--- 前5条详情 ---\n");
  for (let i = 0; i < Math.min(5, allItems.length); i++) {
    const item = allItems[i];
    console.log(`【${i + 1}】${item.title}`);
    console.log(`    日期: ${item.publishDate}`);
    console.log(`    链接: ${item.url}`);
    console.log(`    内容: ${item.content.substring(0, 150)}...\n`);
  }
}

main().catch(console.error);