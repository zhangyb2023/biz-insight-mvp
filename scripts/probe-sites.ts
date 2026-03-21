#!/usr/bin/env npx ts-node
import { chromium } from "playwright";

const TARGET_SITES = [
  { name: "Vector", url: "https://www.vector.com/cn/zh/" },
  { name: "Elektrobit", url: "https://www.elektrobit.com/" },
  { name: "东软睿驰", url: "https://www.reachauto.com/" },
  { name: "中科创达", url: "https://www.thundersoft.com/" },
  { name: "华为乾崑", url: "https://auto.huawei.com/cn/" },
  { name: "AUTOSAR", url: "https://www.autosar.org/" },
  { name: "地平线", url: "https://www.horizon.auto/" },
  { name: "黑芝麻", url: "https://blacksesame.com/" },
  { name: "芯驰", url: "https://www.semidrive.com/" },
  { name: "NXP", url: "https://www.nxp.com/" },
  { name: "比亚迪", url: "https://www.bydglobal.com/" },
  { name: "吉利", url: "https://global.geely.com/" },
  { name: "理想", url: "https://www.lixiang.com/" },
];

const PATHS = ["/", "/news", "/newsroom", "/press", "/media", "/products", "/solutions", "/about", "/partners"];

async function probePage(browser: any, url: string): Promise<{url: string, success: boolean, title: string, textLen: number, cleanText: string}> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(url, { timeout: 15000, waitUntil: "networkidle" });
    const text = await page.evaluate(() => document.body.innerText || "");
    const title = await page.title();
    await context.close();
    return { url, success: true, title, textLen: text.length, cleanText: text.slice(0, 500) };
  } catch (e: any) {
    await context.close();
    return { url, success: false, title: "", textLen: 0, cleanText: e.message };
  }
}

async function main() {
  console.log("开始探测13个站点...\n");
  const browser = await chromium.launch({ headless: true });
  const results: Array<{site: string, path: string, success: boolean, title: string, textLen: number, quality: string}> = [];

  for (const site of TARGET_SITES) {
    console.log(`探测 ${site.name}...`);
    for (const path of PATHS) {
      const fullUrl = site.url.replace(/\/$/, "") + path;
      const result = await probePage(browser, fullUrl);
      const quality = result.textLen > 500 ? "高" : result.textLen > 100 ? "中" : result.textLen > 0 ? "低" : "失败";
      results.push({ site: site.name, path, ...result, quality });
      process.stdout.write(`  ${path} -> ${result.textLen}字 (${quality})\n`);
    }
  }
  await browser.close();

  // 输出汇总
  console.log("\n=== 探测结果汇总 ===\n");
  console.log("站点".padEnd(10), "路径".padEnd(12), "字数".padEnd(8), "质量");
  console.log("-".repeat(50));
  for (const r of results) {
    if (r.textLen > 100) {
      console.log(r.site.padEnd(10), r.path.padEnd(12), `${r.textLen}`.padEnd(8), r.quality);
    }
  }

  // 按质量排序输出
  const good = results.filter(r => r.textLen > 500);
  console.log(`\n高质量页面 (${good.length}个):`);
  for (const r of good) {
    console.log(`  [${r.site}] ${r.path} - ${r.title.slice(0,40)}`);
  }
}

main().catch(console.error);
