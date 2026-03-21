#!/usr/bin/env npx tsx
/**
 * 爬取流程测试 - 验证日期过滤逻辑
 * 测试官方、媒体、专业机构各一个URL
 */

import { intelligentCrawl } from "../lib/crawl/intelligentCrawl";
import { cleanText } from "../lib/clean/cleanText";
import { evaluateSourceQuality } from "../lib/evaluate/sourceQuality";
import type { IntelligentSourceType } from "../lib/crawl/intelligentCrawl";

const MIN_DATE = "2026-01-01";

function isEffectivePublishedDate(publishedAt: string | null | undefined): boolean {
  if (!publishedAt) return false;
  const dateStr = publishedAt.slice(0, 10);
  return dateStr >= MIN_DATE;
}

function shouldRunLlm(input: {
  pageKind?: "list" | "detail";
  completenessScore?: number;
  cleanText: string;
  publishedAt?: string | null;
}) {
  const pageKind = input.pageKind ?? "detail";
  const completenessScore = input.completenessScore ?? 0;
  const cleanTextLength = input.cleanText.trim().length;
  if (!isEffectivePublishedDate(input.publishedAt)) {
    return false;
  }
  return pageKind === "detail" && completenessScore >= 0.75 && cleanTextLength >= 400;
}

const testCases = [
  {
    name: "中科创达官方",
    type: "official" as IntelligentSourceType,
    url: "https://www.thundersoft.com/category/newsroom/",
    keyword: "智能驾驶"
  },
  {
    name: "36氪媒体",
    type: "media" as IntelligentSourceType,
    url: "https://www.36kr.com/feed",
    keyword: "智能驾驶"
  },
  {
    name: "东软睿驰专业",
    type: "professional" as IntelligentSourceType,
    url: "https://www.reachauto.com/news/",
    keyword: "AUTOSAR"
  }
];

async function testCrawl() {
  console.log("=".repeat(60));
  console.log("爬取系统测试 - 验证2026-01-01日期过滤");
  console.log("=".repeat(60));

  for (const tc of testCases) {
    console.log(`\n📍 测试: ${tc.name}`);
    console.log(`   URL: ${tc.url}`);
    console.log(`   类型: ${tc.type}`);

    const result = await intelligentCrawl(tc.url, tc.type, tc.keyword);

    if (!result.success || !result.page) {
      console.log(`   ❌ 爬取失败: ${result.error}`);
      continue;
    }

    const page = result.page;
    console.log(`   ✅ 爬取成功`);
    console.log(`   标题: ${page.title}`);
    console.log(`   方法: ${result.method}`);

    const cleanResult = cleanText(
      page.html,
      [tc.keyword],
      page.url,
      page.publishedTime
    );

    console.log(`\n   📊 清洗结果:`);
    console.log(`      文本长度: ${cleanResult.text.length} 字符`);
    console.log(`      提取条目: ${cleanResult.extractedItems?.length || 0} 条`);
    console.log(`      页面类型: ${cleanResult.pageKind}`);
    console.log(`      完整度评分: ${cleanResult.completenessScore}`);
    console.log(`      匹配关键词: ${cleanResult.matchedKeywords.join(", ")}`);

    if (cleanResult.publishedAt) {
      console.log(`      发布日期: ${cleanResult.publishedAt}`);
      const dateStr = cleanResult.publishedAt.slice(0, 10);
      const isAfterMinDate = dateStr >= MIN_DATE;
      console.log(`      日期有效性: ${isAfterMinDate ? "✅ 2026-01-01之后" : "❌ 早于2026-01-01"}`);
    } else {
      console.log(`      发布日期: ❌ 无日期`);
    }

    const sourceQuality = evaluateSourceQuality({
      url: page.url,
      title: page.title,
      cleanText: cleanResult.text,
      extractedItems: cleanResult.extractedItems,
      publishedAt: cleanResult.publishedAt
    });

    console.log(`\n   📊 质量评估:`);
    console.log(`      质量分数: ${sourceQuality.quality_score}`);
    console.log(`      是否高价值: ${sourceQuality.is_high_value ? "✅" : "❌"}`);
    console.log(`      是否噪音: ${sourceQuality.is_noise ? "⚠️" : "❌"}`);
    if (sourceQuality.matched_rules) {
      console.log(`      匹配规则: ${sourceQuality.matched_rules.join(", ")}`);
    }
    if (sourceQuality.source_signals) {
      console.log(`      质量信号: ${sourceQuality.source_signals.join(" | ")}`);
    }

    const llmAllowed = shouldRunLlm({
      pageKind: cleanResult.pageKind,
      completenessScore: cleanResult.completenessScore,
      cleanText: cleanResult.text,
      publishedAt: cleanResult.publishedAt
    });

    console.log(`\n   🔮 LLM分析门控:`);
    console.log(`      是否允许LLM分析: ${llmAllowed ? "✅ 允许" : "❌ 跳过"}`);

    if (cleanResult.extractedItems && cleanResult.extractedItems.length > 0) {
      console.log(`\n   📋 提取的列表项 (前5条):`);
      cleanResult.extractedItems.slice(0, 5).forEach((item, idx) => {
        const dateInfo = item.date ? ` | 日期: ${item.date}` : " | 无日期";
        const title = item.title.length > 40 ? item.title.slice(0, 40) + "..." : item.title;
        console.log(`      ${idx + 1}. ${title}${dateInfo}`);
      });
    }

    console.log("\n" + "-".repeat(60));
  }

  console.log("\n📌 日期过滤逻辑说明:");
  console.log("   1. shouldRunLlm: 无发布日期或早于2026-01-01 → 跳过LLM分析");
  console.log("   2. discoverDetailCandidates: URL中日期早于2026-01-01 → 不入队");
  console.log("   3. evaluateSourceQuality: 早于2026-01-01 → 评分衰减(每天-0.05分,上限-25分)");
}

testCrawl().catch(console.error);
