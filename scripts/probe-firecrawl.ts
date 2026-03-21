import { chromium } from "playwright";

const FAILED_SITES = [
  { name: "盖世汽车", url: "https://www.gasgoo.com" },
  { name: "高工智能汽车", url: "https://www.gg-lb.com" },
  { name: "佐思汽研", url: "https://www.smartauto.com.cn" },
  { name: "爱普搜", url: "https://www.autoaps.cn" },
  { name: "汽车之心", url: "https://www.ai-autocar.com" },
  { name: "中国汽车报", url: "https://www.cnautonews.com" },
];

// Also test some alternative URLs
const ALTERNATIVE_PATHS = [
  "/news",
  "/news/list",
  "/article",
  "/information",
];

async function probe(browser: any, url: string): Promise<{success: boolean, textLen: number, title: string}> {
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { timeout: 20000, waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000); // Wait for JS
    const text = await page.evaluate(() => document.body.innerText || "");
    const title = await page.title();
    await ctx.close();
    return { success: true, textLen: text.length, title };
  } catch(e: any) {
    await ctx.close();
    return { success: false, textLen: 0, title: e.message.slice(0, 80) };
  }
}

async function main() {
  console.log("Firecrawl风格探测（带User-Agent + 等待JS渲染）...\n");
  const browser = await chromium.launch({ headless: true });
  const results: any[] = [];

  for (const site of FAILED_SITES) {
    console.log(`\n${site.name} (${site.url})`);
    
    // Try main page
    const main = await probe(browser, site.url);
    console.log(`  / -> ${main.textLen}字 ${main.textLen > 500 ? "✅" : main.textLen > 100 ? "⚠️" : "❌"} | ${main.title.slice(0,40)}`);
    results.push({ site: site.name, path: "/", ...main });

    // Try common news paths
    for (const path of ALTERNATIVE_PATHS) {
      const r = await probe(browser, site.url + path);
      console.log(`  ${path} -> ${r.textLen}字 ${r.textLen > 500 ? "✅" : r.textLen > 100 ? "⚠️" : "❌"}`);
      results.push({ site: site.name, path, ...r });
    }
  }

  await browser.close();

  console.log("\n\n=== 可用站点汇总 (>500字) ===");
  const good = results.filter(r => r.textLen > 500);
  for (const r of good) {
    console.log(`[${r.site}] ${r.path} - ${r.title.slice(0,40)}`);
  }
  console.log(`\n共 ${good.length} 个可用页面`);
}

main().catch(console.error);
