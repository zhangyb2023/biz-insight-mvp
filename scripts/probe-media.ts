#!/usr/bin/env npx ts-node
import { chromium } from "playwright";

const SITES = [
  // 专业机构
  { name: "盖世汽车", url: "https://www.gasgoo.com", paths: ["/", "/news", "/auto"] },
  { name: "高工智能汽车", url: "https://www.gg-lb.com", paths: ["/", "/news"] },
  { name: "佐思汽研", url: "https://www.smartauto.com.cn", paths: ["/", "/news"] },
  { name: "爱普搜", url: "https://www.autoaps.cn", paths: ["/", "/news"] },
  { name: "汽车之心", url: "https://www.ai-autocar.com", paths: ["/", "/news"] },
  { name: "中国汽车报", url: "https://www.cnautonews.com", paths: ["/", "/news"] },
  // 主流媒体
  { name: "36氪", url: "https://www.36kr.com", paths: ["/", "/news", "/tech"] },
  { name: "虎嗅", url: "https://www.huxiu.com", paths: ["/", "/channel/auto"] },
  { name: "钛媒体", url: "https://www.tmtpost.com", paths: ["/", "/news"] },
  { name: "极客公园", url: "https://www.geekpark.net", paths: ["/", "/news"] },
];

async function probe(browser: any, url: string): Promise<{success: boolean, textLen: number, title: string, error?: string}> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(url, { timeout: 20000, waitUntil: "networkidle" });
    const text = await page.evaluate(() => document.body.innerText || "");
    const title = await page.title();
    await ctx.close();
    return { success: true, textLen: text.length, title };
  } catch(e: any) {
    await ctx.close();
    return { success: false, textLen: 0, title: "", error: e.message.slice(0, 100) };
  }
}

async function main() {
  console.log("探测专业机构 + 主流媒体...\n");
  const browser = await chromium.launch({ headless: true });
  const results: any[] = [];

  for (const site of SITES) {
    console.log(`\n${site.name} (${site.url})`);
    for (const p of site.paths) {
      const url = site.url.replace(/\/$/, "") + p;
      const r = await probe(browser, url);
      const quality = r.textLen > 2000 ? "✅高" : r.textLen > 500 ? "⚠️中" : r.success ? "❌低" : "🔴失败";
      console.log(`  ${p} -> ${r.textLen}字 ${quality} ${r.title ? `| ${r.title.slice(0,30)}` : ""}`);
      results.push({ site: site.name, url, path: p, ...r, quality });
    }
  }

  await browser.close();

  // 输出可添加到 companies.json 的站点
  console.log("\n\n=== 可添加的站点（>500字）===");
  const good = results.filter(r => r.textLen > 500);
  for (const r of good) {
    console.log(`{ name: "${r.site}", url: "${r.url}", type: "media" },`);
  }
  console.log(`\n共 ${good.length} 个可用站点`);
}

main().catch(console.error);
