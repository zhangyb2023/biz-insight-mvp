import { chromium } from "playwright";

const TARGET_URLS = [
  "https://intelligentautomotive.huawei.com/",
  "https://intelligentautomotive.huawei.com/cn/solutions/",
  "https://intelligentautomotive.huawei.com/cn/news/"
];

async function main() {
  const browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false"
  });

  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
    });

    for (const url of TARGET_URLS) {
      const page = await context.newPage();
      const gotoOptions = { waitUntil: "domcontentloaded" as const, timeout: 30000 };

      console.log(`\n=== Visiting: ${url} ===`);
      console.log("goto options:", JSON.stringify(gotoOptions));

      try {
        const response = await page.goto(url, gotoOptions);
        console.log("response.status:", response?.status() ?? null);
        console.log("response.url:", response?.url() ?? null);
        console.log("page.url:", page.url());
      } catch (error) {
        console.log("response.status:", null);
        console.log("response.url:", null);
        console.log("page.url:", page.url());
        console.log("error:", error);
      } finally {
        await page.close();
      }
    }

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("fatal:", error);
  process.exit(1);
});
