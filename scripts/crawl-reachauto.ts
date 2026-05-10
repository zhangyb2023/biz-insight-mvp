import { reachautoNewsStrategy } from "@/lib/crawl/strategies/reachautoNewsStrategy";
import { upsertDocument, upsertInsight } from "@/lib/db/repository";
import { createCrawlJob, finalizeCrawlJob } from "@/lib/db/repository";
import { computeContentHash } from "@/lib/db/repository";

const urls = [
  "https://www.reachauto.com/corporate-news/industry-activities/",
  "https://www.reachauto.com/corporate-news/ecological-alliance/",
  "https://www.reachauto.com/corporate-news/product-technology/"
];

const REACHAUTO_ID = "reachauto";

async function crawlReachauto() {
  console.log("开始爬取东软睿驰...\n");

  const job = createCrawlJob({
    triggerType: "manual",
    companyCount: 1,
    urlCount: urls.length,
    configSnapshot: { target: "reachauto" }
  });

  let successCount = 0;
  let failureCount = 0;
  let newCount = 0;

  for (const url of urls) {
    console.log(`=== 爬取: ${url} ===`);
    try {
      const result = await reachautoNewsStrategy.crawl(url);

      if (result.success) {
        successCount++;
        console.log(`成功! 提取到 ${result.extractedItems.length} 条文章`);

        const hash = computeContentHash({
          title: result.page.title,
          cleanText: result.page.html,
          extractedItems: result.extractedItems
        });

        const { sourceId } = upsertDocument({
          companyId: REACHAUTO_ID,
          url: url,
          title: result.page.title,
          fetchDate: new Date().toISOString(),
          cleanText: result.page.html,
          matchedKeywords: [],
          extractedItems: result.extractedItems,
          publishedAt: result.extractedItems[0]?.date || null,
          pageKind: "list",
          completenessScore: 1
        });

        console.log(`  更新数据库: sourceId=${sourceId}`);
      } else {
        failureCount++;
        console.log(`失败: ${result.error}`);
      }
    } catch (e) {
      failureCount++;
      console.log(`异常: ${e}`);
    }
    console.log("");
  }

  finalizeCrawlJob(job.id, {
    status: failureCount === 0 ? "success" : "partial",
    successCount,
    failureCount,
    cacheHitCount: 0,
    changedCount: newCount,
    insightCount: 0
  });

  console.log("\n=== 完成 ===");
  console.log(`成功: ${successCount}, 失败: ${failureCount}`);
}

crawlReachauto().catch(console.error);