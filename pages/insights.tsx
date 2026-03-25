import Head from "next/head";
import { useState, useEffect, useMemo } from "react";

type InsightItem = {
  company_name: string;
  title: string;
  url: string;
  fetch_date: string;
  published_at: string | null;
  summary: string | null;
  insight_type: string | null;
  category: string | null;
  completeness_score: number | null;
  clean_text: string | null;
  insight_event_type: string;
  insight_importance_level: "" | "high" | "medium" | "low";
  insight_evidence_strength: number | null;
  insight_confidence: number | null;
  insight_statement: string;
  insight_why_it_matters: string;
  insight_next_action: string;
  insight_to_phua_relation: string[];
  insight_topic_tags: string[];
  insight_supporting_facts: string[];
  insight_risk_note: string;
  insight_updated_at: string | null;
};

type TimeRange = "7d" | "30d" | "90d";
type ImpactLevel = "高" | "中" | "低";
type ConfidenceLevel = "高" | "中" | "低";
type TrendDirection = "上升" | "稳定" | "下降";
type EntityType = "target_company" | "source_media" | "other";
type EvidencePriority = "core" | "reference" | "low";

const MIN_DATE = "2026-01-01";

const TOPICS = [
  { key: "product_tech", label: "产品技术", icon: "🚗" },
  { key: "ecosystem", label: "生态合作", icon: "🤝" },
  { key: "strategy", label: "战略动向", icon: "🎯" },
  { key: "policy", label: "政策法规", icon: "📋" },
  { key: "talent", label: "人才动态", icon: "👥" },
  { key: "market", label: "行业动态", icon: "📡" },
];

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: "7d", label: "近7天" },
  { key: "30d", label: "近30天" },
  { key: "90d", label: "近90天" },
];

const METRIC_DEFINITIONS = {
  validEvidence: "已过滤明显噪音后，可用于形成判断的洞察条目数",
  highConfidence: "来源较可靠、信息较完整、可优先参考的洞察数",
  targetCompany: "本期洞察中出现的重点跟踪公司数量",
  primarySourceRatio: "直接来自目标公司官网、官方发布或一手公开资料的信息占比",
};

const ENTITY_TYPE_LABELS = {
  target_company: { text: "目标公司", tooltip: "重点跟踪对象的官方或直接信息" },
  source_media: { text: "信息来源", tooltip: "媒体或第三方平台的信息来源" },
  other: { text: "其他", tooltip: "相关但优先级较低的辅助信息" },
};

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/20 text-white/60 text-xs ml-1 cursor-help group relative">
      ?
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
        {text}
      </span>
    </span>
  );
}

const IMPACT_SCOPES = [
  { key: "all", label: "全部" },
  { key: "sales", label: "销售" },
  { key: "product", label: "产品" },
  { key: "ecosystem", label: "生态" },
  { key: "management", label: "管理层" },
];

const EVIDENCE_TYPES = [
  { key: "all", label: "全部" },
  { key: "official", label: "官网新闻" },
  { key: "product_page", label: "方案页" },
  { key: "case_study", label: "案例页" },
  { key: "media", label: "媒体报道" },
  { key: "job", label: "招聘信息" },
  { key: "document", label: "技术文档" },
  { key: "full_text", label: "摘要完整" },
];

const TARGET_COMPANIES = [
  "vector", "etas", "elektrobit", "thundersoft", "华为", "普华", "东软", "芯驰",
  "地平线", "黑芝麻", "经纬恒润", "中科创达", "NeuSAR", "i-soft", "reachauto",
  "TTTech", "denso", "autosar", "极氪", "比亚迪", "吉利", "长安", "长城"
];

const LOW_VALUE_PATTERNS = [
  { pattern: /车型|报价|参数|配置|购车|导购|试驾|车图|车视频/i, reason: "车型报价类", priority: "low" },
  { pattern: /车友会|论坛|社区|帖子|回复|评论/i, reason: "用户生成内容", priority: "low" },
  { pattern: /招聘|职位|薪资|面试|入职/i, reason: "招聘信息类", priority: "reference" },
  { pattern: /视频|图文|直播|短视频/i, reason: "视频内容", priority: "reference" },
  { pattern: /天气|日历|计算|工具|下载/i, reason: "工具类", priority: "low" },
  { pattern: /排行榜|评测|横评|对比|选车/i, reason: "评测对比类", priority: "reference" },
  { pattern: /官网首页|站点首页|网站首页|入口页|导航页/i, reason: "站点首页类", priority: "low" },
  { pattern: /频道首页|栏目首页|分类首页|列表页$/i, reason: "频道首页类", priority: "low" },
  { pattern: /专题页|合集页|汇总页|精选/i, reason: "汇编内容", priority: "reference" },
  { pattern: /^policy[\s\-_]*/i, reason: "系统菜单项", priority: "low" },
  { pattern: /^menu[\s\-_]*/i, reason: "系统菜单项", priority: "low" },
  { pattern: /^导航$/i, reason: "导航页", priority: "low" },
  { pattern: /sidebar|侧边栏|页脚|footer|header/i, reason: "页面框架元素", priority: "low" },
  { pattern: /^read more|^learn more|^click here|^more info/i, reason: "通用链接文字", priority: "low" },
  { pattern: /^\s*$/, reason: "空白标题", priority: "low" },
  { pattern: /copyright|©|版权所有|保留所有权利/i, reason: "版权信息", priority: "low" },
];

function isSiteHomepage(url: string, title: string): boolean {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();
  if (/\/index\.html?$/i.test(lowerUrl)) return true;
  if (/^https?:\/\/[^/]+\/$/i.test(lowerUrl)) return true;
  if (/\/news\/$/i.test(lowerUrl) || /\/article\/$/i.test(lowerUrl)) return true;
  if (/首页$/.test(lowerTitle) && lowerTitle.length < 20) return true;
  if (/\/(news|products|solutions|about|contact|company)\/$/i.test(lowerUrl)) return true;
  if (title.length < 5) return true;
  return false;
}

function isLowQualityTitle(title: string): boolean {
  if (!title || title.trim().length < 5) return true;
  const lower = title.toLowerCase().trim();
  if (/^(policy[\s\-_]*|menu[\s\-_]*)/i.test(lower)) return true;
  if (/^(导航|首页)$/.test(lower)) return true;
  if (/^(read more|learn more|click here|more info)$/i.test(lower)) return true;
  if (/^[\d\-\/\.]+$/.test(lower)) return true;
  if (/(sidebar|侧边栏|页脚|footer|header)/i.test(title)) return true;
  return false;
}

function getDateRange(key: TimeRange): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  let from = new Date(now);
  switch (key) {
    case "7d": from.setDate(from.getDate() - 7); break;
    case "30d": from.setDate(from.getDate() - 30); break;
    case "90d": from.setDate(from.getDate() - 90); break;
  }
  return { from, to };
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  } catch { return ""; }
}

function formatDateFull(dateStr: string | null): string {
  if (!dateStr) return "未知";
  try {
    return new Date(dateStr).toLocaleString("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
    });
  } catch { return String(dateStr).slice(0, 16); }
}

function mapToTopic(item: InsightItem): string {
  const topicTags = item.insight_topic_tags || [];
  if (topicTags.length > 0) {
    const firstTag = topicTags[0].toLowerCase();
    if (firstTag.includes("product") || firstTag.includes("tech") || firstTag.includes("产品") || firstTag.includes("技术")) return "product_tech";
    if (firstTag.includes("ecosystem") || firstTag.includes("合作") || firstTag.includes("生态")) return "ecosystem";
    if (firstTag.includes("strategy") || firstTag.includes("战略动向")) return "strategy";
    if (firstTag.includes("policy") || firstTag.includes("政策") || firstTag.includes("法规")) return "policy";
    if (firstTag.includes("talent") || firstTag.includes("人才") || firstTag.includes("招聘")) return "talent";
  }

  const eventType = (item.insight_event_type || "").toLowerCase();
  if (eventType) {
    if (eventType.includes("product") || eventType.includes("tech") || eventType.includes("产品") || eventType.includes("技术")) return "product_tech";
    if (eventType.includes("ecosystem") || eventType.includes("合作") || eventType.includes("生态")) return "ecosystem";
    if (eventType.includes("strategy") || eventType.includes("战略动向")) return "strategy";
    if (eventType.includes("policy") || eventType.includes("政策") || eventType.includes("法规")) return "policy";
    if (eventType.includes("talent") || eventType.includes("人才") || eventType.includes("招聘")) return "talent";
  }

  const cat = ((item.category || item.insight_type || "") as string).toLowerCase();
  const title = (item.title || "").toLowerCase();
  const combined = (cat + " " + title).toLowerCase();
  
  if (combined.includes("产品技术") || combined.includes("产品发布") || combined.includes("技术发布") || 
      combined.includes("新品发布") || combined.includes("产品升级") || combined.includes("技术升级") ||
      combined.includes("解决方案") && combined.includes("发布")) return "product_tech";
  if (combined.includes("生态合作") || combined.includes("战略合作") || combined.includes("合作伙伴") ||
      combined.includes("合作签约") || combined.includes("联合")) return "ecosystem";
  if (combined.includes("战略动向") || combined.includes("融资") || combined.includes("上市") ||
      combined.includes("高管变动") || combined.includes("组织调整") || combined.includes("战略转型") ||
      combined.includes("并购") || combined.includes("收购")) return "strategy";
  if (combined.includes("政策法规") || combined.includes("法规") || combined.includes("标准") ||
      combined.includes("认证") || combined.includes("监管")) return "policy";
  if (combined.includes("人才动态") || combined.includes("招聘") || combined.includes("人才")) return "talent";
  return "market";
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function getImpactLevel(score: number | null): ImpactLevel {
  if (!score) return "中";
  if (score >= 0.8) return "高";
  if (score >= 0.5) return "中";
  return "低";
}

function getConfidenceLevel(score: number | null): ConfidenceLevel {
  if (!score) return "中";
  if (score >= 0.75) return "高";
  if (score >= 0.5) return "中";
  return "低";
}

function getEntityType(companyName: string, url: string): EntityType {
  const lowerName = companyName.toLowerCase();
  const lowerUrl = url.toLowerCase();
  const isTarget = TARGET_COMPANIES.some(c => lowerName.includes(c.toLowerCase()));
  if (isTarget) return "target_company";
  const isMedia = /gasgoo|autohome|36kr|pcauto|iyiou|sina|geekpark|huxiu|tmtpost/i.test(lowerUrl);
  if (isMedia) return "source_media";
  return "other";
}

function getEvidencePriority(item: InsightItem): EvidencePriority {
  const title = item.title || "";
  const url = item.url || "";
  const summary = (item.summary || "").toLowerCase();
  const combined = (title + " " + url + " " + summary).toLowerCase();
  if (isSiteHomepage(url, title)) return "low";
  if (isLowQualityTitle(title)) return "low";
  for (const { pattern, priority } of LOW_VALUE_PATTERNS) {
    if (pattern.test(combined)) return priority as EvidencePriority;
  }
  if (item.completeness_score && item.completeness_score >= 0.75) return "core";
  return "reference";
}

function generateJudgment(item: InsightItem): string {
  const title = item.title || "";
  const summary = item.summary || "";
  if (summary && summary.length > 20) {
    if (title.includes("预售") || title.includes("上市") || title.includes("发布")) {
      return "新产品/方案发布，观察市场定位与竞争力";
    }
    if (title.includes("合作") || title.includes("签约") || title.includes("中标")) {
      return "战略合作达成，评估后续落地影响";
    }
    if (title.includes("融资") || title.includes("投资")) {
      return "资本动作，关注资金用途与战略意图";
    }
    if (title.includes("召回") || title.includes("故障") || title.includes("问题")) {
      return "质量风险信号，需关注召回范围与处理方案";
    }
    return summary.slice(0, 60);
  }
  if (title.includes("预售")) return "新产品预售信号，观察定价策略";
  if (title.includes("合作")) return "合作动态，评估合作深度与影响";
  if (title.includes("发布")) return "重大发布，关注技术/产品亮点";
  return "行业动态，持续跟踪";
}

function generateBusinessImplication(item: InsightItem): string {
  const title = item.title || "";
  const summary = item.summary || "";
  const isHighImpact = (item.completeness_score || 0) >= 0.75;
  if (!isHighImpact) return "";
  
  if (title.includes("合作") || title.includes("签约") || title.includes("中标")) {
    if (title.includes("战略") || title.includes("深度")) return "深度绑定后难以替换，合作窗口期有限";
    if (title.includes("渠道") || title.includes("代理")) return "渠道覆盖扩大，需评估对我们分销网络的影响";
    if (title.includes("技术") || title.includes("联合")) return "技术互补但存在方案替代风险";
    return "生态绑定加深，需评估对我们客户关系的影响";
  }
  if (title.includes("预售") || title.includes("上市") || title.includes("发布")) {
    if (title.includes("价格") || title.includes("售价")) return "定价策略直接影响客户选择，需及时调整我们的方案定位";
    if (title.includes("车型") || title.includes("产品线")) return "客户采购清单可能重新排布，窗口期3-6个月";
    return "市场格局生变，目标客户的方案评估周期可能缩短";
  }
  if (title.includes("融资") || title.includes("投资")) {
    if (title.includes("量产") || title.includes("扩产")) return "产能扩张信号，警惕价格战风险";
    if (title.includes("研发") || title.includes("技术")) return "技术投入加速，后来者追赶难度增加";
    if (title.includes("收购") || title.includes("并购")) return "市场整合加速，可能直接挤压我们的市场空间";
    return "资源补充后竞争门槛提高，需关注其市场份额变化";
  }
  if (title.includes("召回") || title.includes("故障") || title.includes("问题")) {
    return "竞品受损期间是我们的窗口期，可加大客户接触力度";
  }
  if (title.includes("招聘") || title.includes("扩张")) {
    if (title.includes("研发") || title.includes("技术")) return "技术团队扩张，警惕产品迭代提速";
    if (title.includes("销售") || title.includes("市场")) return "市场投入加大，警惕价格竞争或客户争夺";
    return "业务规模扩张信号，关注其重点投入方向";
  }
  if (title.includes("裁员") || title.includes("收缩")) {
    if (title.includes("研发")) return "技术积累可能中断，产品迭代可能放缓";
    if (title.includes("销售") || title.includes("市场")) return "市场声量可能下降，可趁机加强客户关系";
    return "战略收缩期间可能释放客户和市场机会";
  }
  if (title.includes("预测") || title.includes("预计") || title.includes("或将")) {
    return "媒体推测成分较大，需以官方发布为准";
  }
  if (summary.includes("首家") || summary.includes("独家") || summary.includes("唯一")) {
    return "先发优势形成护城河，客户替换成本高";
  }
  if (summary.includes("突破") || summary.includes("创新")) {
    if (summary.includes("成本") || summary.includes("降价")) return "可能引发价格战或方案替代";
    if (summary.includes("性能") || summary.includes("效率")) return "技术代差形成，窗口期6-12个月";
    return "可能重新定义竞争规则";
  }
  return "";
}

function generateRiskNote(item: InsightItem): string {
  const priority = getEvidencePriority(item);
  if (priority === "low") return "⚠️ 信息来源权威性有限，建议交叉验证";
  const title = item.title || "";
  const isMedia = /gasgoo|autohome|36kr|pcauto|iyiou|sina/i.test(item.url);
  if (isMedia) return "⚠️ 信息来自媒体报道，存在传播放大效应";
  if (title.includes("召回") || title.includes("故障")) return "⚠️ 负面信号，需确认真实性";
  if (title.includes("预测") || title.includes("预计") || title.includes("或将")) {
    return "⚠️ 包含预测性内容，请关注后续进展";
  }
  return "";
}

function generateNextAction(item: InsightItem): string {
  const topic = mapToTopic(item);
  const priority = getEvidencePriority(item);
  const title = item.title || "";
  const url = item.url || "";
  const summary = item.summary || "";
  if (priority === "low") return "仅作外围参考，建议交叉验证官方信源";
  
  if (title.includes("合作") || title.includes("签约") || title.includes("中标")) {
    const partner = title.match(/(.{2,6})(与|和|同)/)?.[1] || "合作方";
    return `补抓${partner}背景信息，横向对比同类合作案例，验证是否排他，跟踪6个月内落地里程碑`;
  }
  if (title.includes("预售") || title.includes("上市") || title.includes("发布")) {
    return `跟踪正式售价发布，对比与我们方案的参数差异，验证是否进入目标客户采购清单`;
  }
  if (title.includes("融资") || title.includes("投资")) {
    return `分析被投方业务方向，判断是财务投资还是战略绑定，3个月内跟踪资金到账与用途`;
  }
  if (title.includes("召回") || title.includes("故障") || title.includes("问题")) {
    return `跟踪官方处理方案，观察是否影响目标客户的采购决策，窗口期内验证是否有替代机会`;
  }
  if (title.includes("招聘") || title.includes("扩张")) {
    return `分析招聘岗位与人数变化，验证战略聚焦方向是否调整，1个月内跟踪核心岗位到位情况`;
  }
  if (title.includes("裁员") || title.includes("收缩")) {
    return `观察是否释放关键人才，关注客户关系和渠道是否受影响，验证是否有市场切入机会`;
  }
  if (url.includes("/product") || url.includes("/solution")) {
    return `补抓方案白皮书和技术文档，横向对比我们的差异化优势，验证技术壁垒是否成立`;
  }
  if (url.includes("/case") || url.includes("/example")) {
    return `梳理案例客户行业与规模，验证可复制性，跟踪是否进入更多行业`;
  }
  if (url.includes("/news") || url.includes("/press")) {
    return `跟踪是否有分析师解读和后续报道，验证信息是否进入主流认知`;
  }
  if (summary.includes("首家") || summary.includes("独家") || summary.includes("唯一")) {
    return `分析先发优势的持续性，验证后来者追赶难度，评估是否需要加速投入`;
  }
  
  switch (topic) {
    case "product": return "跟踪产品迭代节奏，补抓标杆客户反馈，验证与我们方案的竞争或互补性";
    case "ecosystem": return "研究合作模式，补抓合作伙伴背景，验证是否有潜在合作切入点";
    case "strategy": return "跟踪战略落地执行，验证关键里程碑达成情况，评估对行业格局的影响";
    case "tech": return "评估技术成熟度，补抓专利布局信息，验证商用可行性和时间窗口";
    case "market": return "分析市场反馈，补抓第三方报告数据，验证竞争态势变化";
    default: return "根据业务需求决定跟进优先级";
  }
}

interface CoreJudgment {
  type: "趋势" | "结构" | "风险";
  text: string;
}

function generateCoreJudgment(
  items: InsightItem[],
  topicCounts: Record<string, number>,
  highValueCount: number,
  timeRangeLabel: string,
  sourceDistribution: { label: string; percent: number }[]
): CoreJudgment[] {
  const judgments: CoreJudgment[] = [];
  const total = items.length;
  if (total === 0) return judgments;
  
  // 1. 趋势判断 - 基于主题分布
  const topicKeys = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);
  if (topicKeys.length > 0) {
    const [topTopic, topCount] = topicKeys[0];
    const topTopicLabel = TOPICS.find(t => t.key === topTopic)?.label || topTopic;
    const topRatio = topCount / total;
    
    if (topRatio > 0.5) {
      judgments.push({
        type: "趋势",
        text: `${timeRangeLabel}${topTopicLabel}信号最活跃（${topCount}次标签命中），行业关注点集中于此`
      });
    } else {
      judgments.push({
        type: "趋势", 
        text: `${timeRangeLabel}信号分布多元，${topTopicLabel}略多（${topCount}次标签命中），行业关注点相对分散`
      });
    }
    
    // 检测技术信号强度
    const techCount = topicCounts.product_tech || 0;
    const techRatio = techCount / total;
    if (techRatio < 0.15 && total > 5) {
      judgments.push({
        type: "结构",
        text: `技术成熟度信号偏弱（${techCount}次），公开信息仍以传播层内容为主`
      });
    } else if (techRatio > 0.25) {
      judgments.push({
        type: "结构",
        text: `技术成熟度信号较强(${techCount}次)，行业正处技术投入期`
      });
    }
  }
  
  // 2. 结构判断 - 基于来源分布
  const primarySource = sourceDistribution.find(s => s.label === "一手信源");
  const secondarySource = sourceDistribution.find(s => s.label === "二手信源");
  const primaryPercent = primarySource?.percent || 0;
  const secondaryPercent = secondarySource?.percent || 0;
  
  if (primaryPercent >= 40) {
    judgments.push({
      type: "结构",
      text: `一手信源占比${primaryPercent}%，信息源头质量较高，判断可信度较好`
    });
  } else if (secondaryPercent > primaryPercent * 1.5) {
    judgments.push({
      type: "结构",
      text: `二手媒体传播为主(${secondaryPercent}%)，信息经过媒体解读，需警惕放大效应`
    });
  } else {
    judgments.push({
      type: "结构", 
      text: `信源结构多元，一手${primaryPercent}%与二手${secondaryPercent}%并存`
    });
  }
  
  // 3. 风险判断 - 基于置信度和信噪比
  const highRatio = highValueCount / total;
  const lowPriorityItems = items.filter(i => {
    const p = getEvidencePriority(i);
    return p === "low" || p === "reference";
  }).length;
  const noiseRatio = lowPriorityItems / total;
  
  if (noiseRatio > 0.4) {
    judgments.push({
      type: "风险",
      text: `低价值噪音内容占比偏高(${Math.round(noiseRatio * 100)}%)，结论适用性受限，建议开启"核心洞察"筛选`
    });
  } else if (highRatio < 0.25 && total > 10) {
    judgments.push({
      type: "风险",
      text: `高置信证据不足(仅${highValueCount}条，占${Math.round(highRatio * 100)}%)，结论推断性质较强`
    });
  } else if (primaryPercent < 20) {
    judgments.push({
      type: "风险",
      text: `一手信源稀缺(仅${primaryPercent}%)，建议补充目标公司官方发布渠道的监控`
    });
  } else {
    judgments.push({
      type: "风险",
      text: `样本量适中(${total}条)，置信度中等，结论供参考使用`
    });
  }
  
  return judgments.slice(0, 3);
}

function generateChartConclusion(topicCounts: Record<string, number>): string {
  const total = Object.values(topicCounts).reduce((a, b) => a + b, 0);
  if (total === 0) return "暂无信号数据";
  
  const productTechRatio = (topicCounts.product_tech || 0) / total;
  const ecosystemRatio = (topicCounts.ecosystem || 0) / total;
  if (productTechRatio > 0.5) return `以"产品技术"为主(${Math.round(productTechRatio * 100)}%)，技术信号偏弱——公开信息以传播层内容为主`;
  if (ecosystemRatio > 0.4) return `以"生态合作"为主(${Math.round(ecosystemRatio * 100)}%)，本期行业重点在生态布局`;
  return `信号分布相对均衡，产品技术(${Math.round(productTechRatio * 100)}%)为主`;
}

function isValidItem(item: InsightItem): boolean {
  if (!item.published_at || !item.published_at.trim()) return false;
  if (item.published_at.includes("invalid") || item.published_at.includes("NaN")) return false;
  const dateStr = item.published_at.split("T")[0];
  if (dateStr < MIN_DATE) return false;
  return true;
}

function hasValidCleanText(item: InsightItem | InsightCardData): boolean {
  const cleanText = ("clean_text" in item ? item.clean_text : item.cleanText) || "";
  if (cleanText.toLowerCase().startsWith("pasted") || cleanText.startsWith("[Pasted")) return false;
  if (cleanText.length < 20) return false;
  return true;
}

interface InsightCardData {
  id: string;
  topic: string;
  title: string;
  judgment: string;
  businessImplication: string;
  riskNote: string;
  nextAction: string;
  timeRange: string;
  impactLevel: ImpactLevel;
  confidenceLevel: ConfidenceLevel;
  company: string;
  entityType: EntityType;
  priority: EvidencePriority;
  url: string;
  cleanText: string;
  publishedAt: string;
  score: number | null;
}

function InsightCard({ item }: { item: InsightCardData }) {
  return (
    <div className={`rounded-xl border p-5 transition-all ${
      item.priority === "core" ? "bg-white border-moss shadow-sm" :
      item.priority === "reference" ? "bg-slate-50 border-slate-200" :
      "bg-slate-50 border-slate-100 opacity-75"
    }`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              item.impactLevel === "高" ? "bg-rose-100 text-rose-700" :
              item.impactLevel === "中" ? "bg-amber-100 text-amber-700" :
              "bg-slate-100 text-slate-600"
            }`}>影响力:{item.impactLevel}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              item.confidenceLevel === "高" ? "bg-emerald-100 text-emerald-700" :
              item.confidenceLevel === "中" ? "bg-blue-100 text-blue-700" :
              "bg-slate-100 text-slate-600"
            }`}>置信度:{item.confidenceLevel}</span>
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">
              {TOPICS.find(t => t.key === item.topic)?.label || item.topic}
            </span>
            {item.priority === "reference" && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-600">
                外围参考
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-ink leading-snug">{item.title}</h3>
        </div>
        <time className="text-xs text-slate-500 whitespace-nowrap pt-1">{item.timeRange}</time>
      </div>

      <div className="mb-3 rounded-lg bg-emerald-50 border border-emerald-100 p-3">
        <p className="text-xs font-medium text-emerald-700 mb-1">📌 判断</p>
        <p className="text-sm text-slate-800 leading-relaxed">{item.judgment}</p>
        {item.businessImplication && (
          <p className="text-sm text-emerald-700 leading-relaxed mt-1.5 border-t border-emerald-100 pt-1.5">
            → {item.businessImplication}
          </p>
        )}
      </div>

      {item.riskNote && (
        <div className="mb-3 rounded-lg bg-amber-50 border border-amber-100 p-3">
          <p className="text-xs font-medium text-amber-700 mb-1">⚠️ 风险提示</p>
          <p className="text-sm text-slate-700">{item.riskNote}</p>
        </div>
      )}

      <div className="mb-3 rounded-lg bg-blue-50 border border-blue-100 p-3">
        <p className="text-xs font-medium text-blue-700 mb-1">→ 下一步建议</p>
        <p className="text-sm text-slate-700">{item.nextAction}</p>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3">
          <span>🌐 {extractDomain(item.url)}</span>
          <span>📅 {formatDateFull(item.publishedAt)}</span>
          <span className={`group relative px-1.5 py-0.5 rounded text-xs ${
            item.entityType === "target_company" ? "bg-emerald-50 text-emerald-600" :
            item.entityType === "source_media" ? "bg-blue-50 text-blue-600" :
            "bg-slate-100 text-slate-500"
          }`}>
            {item.entityType === "target_company" ? "目标公司" :
             item.entityType === "source_media" ? "信息来源" : "其他"}
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
              {ENTITY_TYPE_LABELS[item.entityType]?.tooltip}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-moss hover:underline flex items-center gap-1">
            原文 ↗
          </a>
        </div>
      </div>

      {item.cleanText && item.cleanText.length >= 20 && (
        <div className="mt-3 rounded-lg bg-slate-100 p-3">
          <p className="text-xs font-medium text-slate-500 mb-1">原文摘要</p>
          <p className="text-xs text-slate-600 leading-relaxed">
            {item.cleanText?.slice(0, 300)}
          </p>
        </div>
      )}
    </div>
  );
}

function TopicCard({ topic, count, trend, isActive, onClick }: {
  topic: typeof TOPICS[number];
  count: number;
  trend: TrendDirection;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`rounded-xl border p-4 text-left transition-all ${isActive ? "border-moss bg-moss/5 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{topic.icon}</span>
        <span className={`text-xs font-medium ${trend === "上升" ? "text-emerald-600" : trend === "下降" ? "text-rose-600" : "text-slate-500"}`}>
          {trend === "上升" ? "↑" : trend === "下降" ? "↓" : "→"} {trend}
        </span>
      </div>
      <p className="font-medium text-ink text-sm">{topic.label}</p>
      <p className="text-2xl font-bold text-moss mt-1">{count}</p>
      <p className="text-xs text-slate-500">次标签命中</p>
    </button>
  );
}

function BarChart({ data, title, conclusion }: { data: { label: string; value: number }[]; title: string; conclusion: string }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
      </div>
      <div className="space-y-2">
        {data.slice(0, 6).map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-xs text-slate-600 w-20 truncate">{item.label}</span>
            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-moss rounded-full transition-all" style={{ width: `${(item.value / maxVal) * 100}%` }} />
            </div>
            <span className="text-xs text-slate-500 w-8 text-right">{item.value}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500 italic border-t border-slate-100 pt-2">{conclusion}</p>
    </div>
  );
}

function PieChart({ data, title, conclusion }: { data: { label: string; value: number; percent: number }[]; title: string; conclusion: string }) {
  const colors = ["#059669", "#2563eb", "#7c3aed", "#d97706", "#dc2626"];
  let cumulative = 0;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h4 className="text-sm font-semibold text-ink mb-3">{title}</h4>
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full">
            {data.map((item, idx) => {
              const startDeg = cumulative * 3.6;
              const endDeg = cumulative + item.percent * 3.6;
              cumulative += item.percent;
              const start = (startDeg - 90) * Math.PI / 180;
              const end = (endDeg - 90) * Math.PI / 180;
              const largeArc = item.percent > 50 ? 1 : 0;
              const x1 = 18 + 16 * Math.cos(start);
              const y1 = 18 + 16 * Math.sin(start);
              const x2 = 18 + 16 * Math.cos(end);
              const y2 = 18 + 16 * Math.sin(end);
              const d = `M 18 18 L ${x1} ${y1} A 16 16 0 ${largeArc} 1 ${x2} ${y2} Z`;
              return <path key={idx} d={d} fill={colors[idx % colors.length]} />;
            })}
            <circle cx="18" cy="18" r="10" fill="white" />
          </svg>
        </div>
        <div className="flex-1 space-y-1">
          {data.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
              <span className="text-slate-600 flex-1">{item.label}</span>
              <span className="text-slate-500">{item.percent}%</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500 italic border-t border-slate-100 pt-2">{conclusion}</p>
    </div>
  );
}

function Heatmap({ targetData, sourceData }: {
  targetData: { name: string; count: number }[];
  sourceData: { name: string; count: number }[];
}) {
  const maxTarget = Math.max(...targetData.map(d => d.count), 1);
  const maxSource = Math.max(...sourceData.map(d => d.count), 1);
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h4 className="text-sm font-semibold text-ink mb-1">🔥 重点对象与主要信息来源</h4>
      <p className="text-xs text-slate-400 mb-3">快速识别值得跟踪的重点对象，以及本期最主要的信息来源。</p>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-emerald-600 mb-1.5">🏢 目标公司</p>
          {targetData.slice(0, 5).map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-600 w-16 truncate">{item.name}</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(item.count / maxTarget) * 100}%` }} />
              </div>
              <span className="text-xs text-slate-500 w-6 text-right">{item.count}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-medium text-blue-600 mb-1.5">📡 信息来源</p>
          {sourceData.slice(0, 5).map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-600 w-16 truncate">{item.name}</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(item.count / maxSource) * 100}%` }} />
              </div>
              <span className="text-xs text-slate-500 w-6 text-right">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500 italic border-t border-slate-100 pt-2">
        目标公司用于判断业务进展，信息来源热度仅作为参考
      </p>
    </div>
  );
}

export default function InsightsPage() {
  const [items, setItems] = useState<InsightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [activeTopic, setActiveTopic] = useState("all");
  const [coreOnly, setCoreOnly] = useState(false);
  const [includeReference, setIncludeReference] = useState(false);
  const [impactScope, setImpactScope] = useState("all");
  const [evidenceType, setEvidenceType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // 报告生成状态
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState<"brief" | "exec">("exec");
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportLoadingStep, setReportLoadingStep] = useState("");
  const [generatedReport, setGeneratedReport] = useState<{
    markdown: string;
    meta: Record<string, unknown>;
    filename: string;
  } | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // Markdown 下载状态
  const [isDownloading, setIsDownloading] = useState(false);

  // 公司筛选状态
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

  // 可选公司列表 (company_id -> name)
  const COMPANY_OPTIONS: { id: string; name: string }[] = [
    { id: "vector", name: "Vector" },
    { id: "elektrobit", name: "Elektrobit" },
    { id: "tttech-auto", name: "TTTech Auto" },
    { id: "hirain", name: "经纬恒润" },
    { id: "reachauto", name: "东软睿驰" },
    { id: "thundersoft", name: "中科创达" },
    { id: "huawei-qiankun-auto", name: "华为乾崑" },
    { id: "semi-drive", name: "芯驰科技" },
    { id: "black-sesame", name: "黑芝麻智能" },
    { id: "etas", name: "ETAS" },
    { id: "autosar", name: "AUTOSAR" },
    { id: "盖世汽车", name: "盖世汽车" },
  ];

  // 聚合洞察状态
  const [briefData, setBriefData] = useState<{
    window_summary: {
      time_window: string;
      overall_judgement: string;
      signal_density: string;
      manager_note: string;
    };
    top_changes: Array<{
      title: string;
      judgement: string;
      why_important: string;
      affected_companies: string[];
      related_topics: string[];
      to_phua_impact: string;
      recommended_action: string;
      evidence_count: number;
    }>;
    company_insights: Array<{
      company: string;
      signal_level: string;
      main_move: string;
      business_meaning: string;
      to_phua_impact: string;
      watch_next: string;
    }>;
    phua_impacts: {
      competition_pressure: string[];
      cooperation_opportunities: string[];
      product_market_reference: string[];
    };
    management_actions: Array<{
      department: string;
      action: string;
      priority: string;
      reason: string;
    }>;
  } | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [briefEmpty, setBriefEmpty] = useState(false);

  // 调用 generate-brief API
  useEffect(() => {
    const windowDaysMap: Record<TimeRange, number> = {
      "7d": 7,
      "30d": 30,
      "90d": 90
    };
    const windowDays = windowDaysMap[timeRange];

    setBriefLoading(true);
    setBriefError(null);
    setBriefEmpty(false);
    setBriefData(null);

    fetch("/api/insights/generate-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        window_days: windowDays, 
        limit: 50,
        company_ids: selectedCompanyIds.length > 0 ? selectedCompanyIds : undefined
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setBriefData(data.result);
          setBriefEmpty(data.empty === true);
        } else {
          setBriefError("聚合洞察生成失败");
          setBriefEmpty(false);
        }
      })
      .catch(err => {
        setBriefError("网络异常，请检查网络连接");
        setBriefEmpty(false);
      })
      .finally(() => {
        setBriefLoading(false);
      });
  }, [timeRange, selectedCompanyIds]);

  useEffect(() => {
    fetch("/api/all-items")
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const validItems = useMemo(() => items.filter(isValidItem), [items]);

  const filteredByTime = useMemo(() => {
    const { from, to } = getDateRange(timeRange);
    return validItems.filter(item => {
      const d = new Date(item.published_at || item.fetch_date);
      return d >= from && d <= to;
    });
  }, [validItems, timeRange]);

  const filteredItems = useMemo(() => {
    let result = filteredByTime;
    if (!includeReference) {
      result = result.filter(item => getEvidencePriority(item) !== "low");
    }
    if (activeTopic !== "all") {
      result = result.filter(item => mapToTopic(item) === activeTopic);
    }
    if (coreOnly) {
      result = result.filter(item => getEvidencePriority(item) === "core" || (item.completeness_score || 0) >= 0.75);
    }
    if (impactScope !== "all") {
      result = result.filter(item => mapToTopic(item) === impactScope);
    }
    if (evidenceType !== "all") {
      result = result.filter(item => {
        const priority = getEvidencePriority(item);
        if (evidenceType === "official") return item.url.includes("/news/") || item.url.includes("/press");
        if (evidenceType === "product_page") return item.url.includes("/product") || item.url.includes("/solution");
        if (evidenceType === "case_study") return item.url.includes("/case") || item.url.includes("/example");
        if (evidenceType === "media") return getEntityType(item.company_name, item.url) === "source_media";
        if (evidenceType === "job") return priority === "reference" && /招聘|职位/i.test(item.title);
        if (evidenceType === "document") return item.url.includes(".pdf") || item.url.includes("/doc");
        if (evidenceType === "full_text") {
          const cleanText = item.clean_text || "";
          return !cleanText.toLowerCase().startsWith("pasted") && 
                 !cleanText.startsWith("[Pasted") && 
                 cleanText.length >= 20;
        }
        return true;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.title?.toLowerCase().includes(q) ||
        item.summary?.toLowerCase().includes(q) ||
        item.company_name?.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) =>
      new Date(b.published_at || b.fetch_date).getTime() -
      new Date(a.published_at || a.fetch_date).getTime()
    );
  }, [filteredByTime, activeTopic, coreOnly, includeReference, impactScope, evidenceType, searchQuery]);

  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredByTime.forEach(item => {
      const topic = mapToTopic(item);
      counts[topic] = (counts[topic] || 0) + 1;
    });
    return counts;
  }, [filteredByTime]);

  const highValueCount = useMemo(() =>
    filteredItems.filter(i => (i.completeness_score || 0) >= 0.75).length
  , [filteredItems]);

  const sourceDistribution = useMemo(() => {
    const sources: Record<string, number> = {};
    filteredItems.forEach(item => {
      const type = getEntityType(item.company_name, item.url);
      const label = type === "target_company" ? "一手信源" : type === "source_media" ? "二手信源" : "外围参考";
      sources[label] = (sources[label] || 0) + 1;
    });
    const total = Object.values(sources).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(sources).map(([label, value]) => ({
      label, value, percent: Math.round((value / total) * 100)
    }));
  }, [filteredItems]);

  const coreJudgments = useMemo(() =>
    generateCoreJudgment(filteredItems, topicCounts, highValueCount, TIME_RANGES.find(t => t.key === timeRange)?.label || "", sourceDistribution)
  , [filteredItems, topicCounts, highValueCount, timeRange, sourceDistribution]);

  const insightCards = useMemo((): InsightCardData[] =>
    filteredItems.map((item, idx) => ({
      id: `${item.url}-${idx}`,
      topic: mapToTopic(item),
      title: item.title || "无标题",
      judgment: generateJudgment(item),
      businessImplication: generateBusinessImplication(item),
      riskNote: generateRiskNote(item),
      nextAction: generateNextAction(item),
      timeRange: formatDateShort(item.published_at),
      impactLevel: getImpactLevel(item.completeness_score),
      confidenceLevel: getConfidenceLevel(item.completeness_score),
      company: item.company_name,
      entityType: getEntityType(item.company_name, item.url),
      priority: getEvidencePriority(item),
      url: item.url,
      cleanText: item.clean_text || "",
      publishedAt: item.published_at || item.fetch_date,
      score: item.completeness_score,
    }))
  , [filteredItems]);

  const targetCompanies = useMemo(() => {
    const map: Record<string, number> = {};
    filteredItems.forEach(item => {
      if (getEntityType(item.company_name, item.url) === "target_company") {
        const name = item.company_name;
        map[name] = (map[name] || 0) + 1;
      }
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [filteredItems]);

  const sourceMedia = useMemo(() => {
    const map: Record<string, number> = {};
    filteredItems.forEach(item => {
      if (getEntityType(item.company_name, item.url) === "source_media") {
        const name = extractDomain(item.url) || item.company_name;
        map[name] = (map[name] || 0) + 1;
      }
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [filteredItems]);

  const chartConclusion = useMemo(() => generateChartConclusion(topicCounts), [topicCounts]);

  const timeRangeLabel = TIME_RANGES.find(t => t.key === timeRange)?.label || "当前";

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setReportError(null);
    setReportLoadingStep("正在汇总当前筛选范围内的洞察数据...");
    setShowReportModal(true);

    try {
      setReportLoadingStep("正在调用 DeepSeek 生成报告...");

      const topicStats: Record<string, { count: number; trend: string; insight: string }> = {};
      TOPICS.slice(1).forEach(t => {
        const topicItems = filteredItems.filter(item => mapToTopic(item) === t.key);
        topicStats[t.label] = {
          count: topicItems.length,
          trend: topicItems.length >= 5 ? "上升" : topicItems.length >= 2 ? "稳定" : "下降",
          insight: topicItems.length > 0 ? generateJudgment(topicItems[0]) : "样本不足"
        };
      });

      const reportData = {
        report_type: reportType,
        time_range: timeRangeLabel,
        filters: {
          topic: activeTopic !== "all" ? activeTopic : undefined,
          core_only: coreOnly,
          include_reference: includeReference,
          evidence_type: evidenceType !== "all" ? evidenceType : undefined,
          search_query: searchQuery || undefined
        },
        summary: {
          total_count: filteredItems.length,
          high_value_count: highValueCount,
          target_company_count: targetCompanies.length,
          source_purity_percent: sourceDistribution.find(s => s.label === "一手信源")?.percent || 0
        },
        core_judgments: coreJudgments.map(j => `${j.type}: ${j.text}`),
        topic_stats: topicStats,
        top_insights: insightCards.slice(0, 20).map(card => ({
          title: card.title,
          topic: TOPICS.find(t => t.key === card.topic)?.label || card.topic,
          judgment: card.judgment,
          risk_note: card.riskNote,
          next_action: card.nextAction,
          company: card.company,
          published_at: card.timeRange,
          confidence: card.confidenceLevel,
          entity_type: card.entityType === "target_company" ? "目标公司" : card.entityType === "source_media" ? "信息来源" : "其他"
        })),
        source_distribution: sourceDistribution,
        company_heat: {
          target: targetCompanies.slice(0, 10),
          source: sourceMedia.slice(0, 10)
        },
        generated_at: new Date().toISOString()
      };

      const response = await fetch("/api/insights/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "报告生成失败");
      }

      const result = await response.json();
      setGeneratedReport({
        markdown: result.report_markdown,
        meta: result.report_meta,
        filename: result.filename
      });
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "未知错误");
    } finally {
      setIsGenerating(false);
      setReportLoadingStep("");
    }
  };

  const handleDownloadMarkdown = () => {
    if (!generatedReport) return;
    const blob = new Blob([generatedReport.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = generatedReport.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadBriefMarkdown = async () => {
    setIsDownloading(true);
    try {
      const windowDaysMap: Record<TimeRange, number> = { "7d": 7, "30d": 30, "90d": 90 };
      const windowDays = windowDaysMap[timeRange];
      const companyIds = selectedCompanyIds.length > 0 ? selectedCompanyIds : undefined;

      const requestBody: any = {
        window_days: windowDays,
        format: "markdown"
      };
      if (companyIds) {
        requestBody.company_ids = companyIds;
      }
      if (briefData) {
        requestBody.brief_data = briefData;
      }

      const response = await fetch("/api/insights/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error("报告生成失败");
      }

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || "报告生成失败");
      }

      const blob = new Blob([data.markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.title}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "下载失败";
      alert(`报告下载失败: ${msg}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <Head><title>商业洞察 | Biz Insight</title></Head>
      <main className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="mx-auto max-w-6xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a href="/" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                返回首页
              </a>
              <div>
                <h1 className="text-xl font-semibold text-ink">💡 商业洞察</h1>
                <p className="text-sm text-slate-500">用于业务研判、重点跟踪与管理汇报准备</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg border border-slate-200 bg-white p-1">
                {TIME_RANGES.map(tr => (
                  <button key={tr.key} onClick={() => setTimeRange(tr.key)}
                    className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${timeRange === tr.key ? "bg-moss text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                    {tr.label}
                  </button>
                ))}
              </div>
              <select
                value={selectedCompanyIds[0] || ""}
                onChange={e => setSelectedCompanyIds(e.target.value ? [e.target.value] : [])}
                className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-moss focus:outline-none"
              >
                <option value="">全部公司</option>
                {COMPANY_OPTIONS.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowReportModal(true)}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-emerald-700 hover:to-emerald-600 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                生成洞察报告
              </button>
              <button
                onClick={handleDownloadBriefMarkdown}
                disabled={isDownloading}
                title={selectedCompanyIds.length === 1 ? `下载${COMPANY_OPTIONS.find(c => c.id === selectedCompanyIds[0])?.name || '该公司'}的观察报告` : "下载全部公司的总览报告"}
                className="flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50 transition-all"
              >
                {isDownloading ? (
                  <>
                    <span className="h-4 w-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    下载 Markdown 报告
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">

          {/* LLM聚合洞察区 - 洞察优先 */}
          {briefLoading ? (
            <section className="rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 p-6 text-white">
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="h-8 w-8 mx-auto border-4 border-white/30 border-t-white rounded-full animate-spin mb-3" />
                  <p className="text-sm opacity-80">正在生成聚合洞察...</p>
                  <p className="text-xs opacity-60 mt-1">
                    {selectedCompanyIds.length === 1 
                      ? `${COMPANY_OPTIONS.find(c => c.id === selectedCompanyIds[0])?.name || selectedCompanyIds[0]} · ${timeRangeLabel}`
                      : `全部公司 · ${timeRangeLabel}`}
                  </p>
                </div>
              </div>
            </section>
          ) : briefError ? (
            <section className="rounded-xl bg-red-50 border border-red-200 p-6">
              <div className="text-center">
                <p className="text-sm text-red-600 mb-2">⚠️ 聚合洞察暂未生成成功</p>
                <p className="text-xs text-slate-500 mb-3">请稍后重试，下方统计洞察仍可正常查看。</p>
                <div className="inline-flex items-center gap-4 text-xs text-slate-400 bg-white px-4 py-2 rounded-lg border border-slate-200">
                  <span>📅 {timeRangeLabel}</span>
                  <span>🏢 {selectedCompanyIds.length === 1 ? (COMPANY_OPTIONS.find(c => c.id === selectedCompanyIds[0])?.name || "单公司") : "全部公司"}</span>
                </div>
                <p className="text-xs text-slate-400 mt-3">原始动态列表仍可正常查看</p>
              </div>
            </section>
          ) : briefEmpty ? (
            <section className="rounded-xl bg-slate-100 border border-slate-200 p-6">
              <div className="text-center py-4">
                <p className="text-sm text-slate-600 mb-2">📭 暂无足够聚合样本</p>
                <p className="text-xs text-slate-500 mb-3">当前时间窗内高质量动态样本不足，已保留下方原始动态列表供查看</p>
                <div className="inline-flex items-center gap-4 text-xs text-slate-400 bg-white px-4 py-2 rounded-lg border border-slate-200">
                  <span>📅 {timeRangeLabel}</span>
                  <span>🏢 {selectedCompanyIds.length === 1 ? (COMPANY_OPTIONS.find(c => c.id === selectedCompanyIds[0])?.name || "单公司") : "全部公司"}</span>
                  <span>📊 {filteredItems.length}条动态</span>
                </div>
              </div>
            </section>
          ) : briefData ? (
            <>
              {/* 范围提示头 */}
              <div className="flex items-center justify-center gap-4 text-xs text-slate-600 bg-slate-50 rounded-lg px-4 py-2 border border-slate-200">
                <span className="flex items-center gap-1">
                  <span>📅</span> {timeRangeLabel}
                </span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1">
                  <span>🏢</span> {selectedCompanyIds.length === 1 ? (COMPANY_OPTIONS.find(c => c.id === selectedCompanyIds[0])?.name || "单公司") : "全部公司"}
                </span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1">
                  <span>📊</span> {filteredItems.length}条动态
                </span>
              </div>
              {/* 核心判断卡 */}
              {briefData.window_summary.overall_judgement && (
                <section className="rounded-xl bg-gradient-to-r from-slate-700 to-slate-600 border border-slate-500 p-6 text-white">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🎯</span>
                    <h3 className="text-sm font-semibold">本期核心判断</h3>
                    {briefData.window_summary.signal_density && (
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                        briefData.window_summary.signal_density === "high" ? "bg-emerald-500/30 text-emerald-300" :
                        briefData.window_summary.signal_density === "medium" ? "bg-amber-500/30 text-amber-300" :
                        "bg-slate-500/30 text-slate-300"
                      }`}>
                        信号强度: {briefData.window_summary.signal_density === "high" ? "高" : briefData.window_summary.signal_density === "medium" ? "中" : "低"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-slate-100 mb-3">
                    {briefData.window_summary.overall_judgement}
                  </p>
                  {briefData.window_summary.manager_note && (
                    <p className="text-xs text-slate-300">
                      {briefData.window_summary.manager_note}
                    </p>
                  )}
                </section>
              )}

              {/* 重点变化 */}
              {briefData.top_changes.length > 0 && (
                <section className="rounded-xl bg-white border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                    <span>📌</span> 本期重点变化
                  </h3>
                  <div className="space-y-4">
                    {briefData.top_changes.slice(0, 5).map((change, idx) => (
                      <div key={idx} className="border-l-4 border-violet-400 pl-4 space-y-2">
                        <p className="text-sm font-medium text-ink">{change.title}</p>
                        {change.judgement && (
                          <p className="text-xs text-slate-600">{change.judgement}</p>
                        )}
                        {change.why_important && (
                          <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                            💡 为什么重要：{change.why_important}
                          </p>
                        )}
                        {change.to_phua_impact && (
                          <p className="text-xs text-violet-600 font-medium">
                            → 对普华影响：{change.to_phua_impact}
                          </p>
                        )}
                        {change.recommended_action && (
                          <p className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                            ✅ 建议动作：{change.recommended_action}
                          </p>
                        )}
                        {change.affected_companies.length > 0 && (
                          <p className="text-xs text-slate-400">
                            涉及公司：{change.affected_companies.join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 对普华影响 + 管理动作 - 三栏布局 */}
              {(briefData.phua_impacts.competition_pressure.length > 0 ||
                briefData.phua_impacts.cooperation_opportunities.length > 0 ||
                briefData.phua_impacts.product_market_reference.length > 0 ||
                briefData.management_actions.length > 0) && (
                <section className="grid gap-4 md:grid-cols-3">
                  {briefData.phua_impacts.competition_pressure.length > 0 && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                      <h4 className="text-xs font-semibold text-red-700 mb-2">⚔️ 竞争压力</h4>
                      <ul className="space-y-1">
                        {briefData.phua_impacts.competition_pressure.map((item, idx) => (
                          <li key={idx} className="text-xs text-red-800">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {briefData.phua_impacts.cooperation_opportunities.length > 0 && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                      <h4 className="text-xs font-semibold text-emerald-700 mb-2">🤝 合作机会</h4>
                      <ul className="space-y-1">
                        {briefData.phua_impacts.cooperation_opportunities.map((item, idx) => (
                          <li key={idx} className="text-xs text-emerald-800">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {briefData.phua_impacts.product_market_reference.length > 0 && (
                    <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                      <h4 className="text-xs font-semibold text-blue-700 mb-2">📊 产品市场参考</h4>
                      <ul className="space-y-1">
                        {briefData.phua_impacts.product_market_reference.map((item, idx) => (
                          <li key={idx} className="text-xs text-blue-800">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {/* 管理动作建议 */}
              {briefData.management_actions.length > 0 && (
                <section className="rounded-xl bg-white border border-slate-200 p-5">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                      <span>📋</span> 管理动作建议
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">基于近30天信号生成，按"建议动作 + 依据说明"展示</p>
                  </div>
                  <div className="space-y-4">
                    {briefData.management_actions.slice(0, 5).map((action, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                        <div className="flex items-start gap-3">
                          <span className={`flex-shrink-0 text-xs font-medium px-2 py-1 rounded ${
                            action.priority === "high" ? "bg-red-100 text-red-700" :
                            action.priority === "medium" ? "bg-amber-100 text-amber-700" :
                            "bg-slate-200 text-slate-600"
                          }`}>
                            {action.department}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 leading-relaxed">{action.action}</p>
                            {action.reason && (
                              <p className="text-xs text-slate-500 mt-2 leading-relaxed">{action.reason}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 重点公司观察 */}
              {briefData.company_insights.length > 0 && (
                <section className="rounded-xl bg-white border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                    <span>🏢</span> 重点公司观察
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {briefData.company_insights.slice(0, 6).map((insight, idx) => (
                      <div key={idx} className="border border-slate-100 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink">{insight.company}</span>
                          {insight.signal_level && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              insight.signal_level === "high" ? "bg-red-100 text-red-700" :
                              insight.signal_level === "medium" ? "bg-amber-100 text-amber-700" :
                              "bg-slate-100 text-slate-700"
                            }`}>
                              {insight.signal_level === "high" ? "高信号" : insight.signal_level === "medium" ? "中信号" : "低信号"}
                            </span>
                          )}
                        </div>
                        {insight.main_move && (
                          <div>
                            <span className="text-xs font-medium text-violet-600">● 核心动作</span>
                            <p className="text-xs text-slate-700 mt-0.5">{insight.main_move}</p>
                          </div>
                        )}
                        {insight.business_meaning && (
                          <div>
                            <span className="text-xs font-medium text-amber-600">● 商业含义</span>
                            <p className="text-xs text-slate-600 mt-0.5">{insight.business_meaning}</p>
                          </div>
                        )}
                        {insight.to_phua_impact && (
                          <div className="bg-violet-50 rounded p-2">
                            <span className="text-xs font-medium text-violet-700">● 对普华影响</span>
                            <p className="text-xs text-violet-700 mt-0.5">{insight.to_phua_impact}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : null}

          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white">
              <p className="text-xs opacity-80 flex items-center">
                有效证据
                <InfoTooltip text={METRIC_DEFINITIONS.validEvidence} />
              </p>
              <p className="mt-1 text-3xl font-bold">{filteredItems.length}</p>
              <p className="text-xs opacity-70 mt-1">条洞察</p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white">
              <p className="text-xs opacity-80 flex items-center">
                高置信证据
                <InfoTooltip text={METRIC_DEFINITIONS.highConfidence} />
              </p>
              <p className="mt-1 text-3xl font-bold">{highValueCount}</p>
              <p className="text-xs opacity-70 mt-1">条 (≥75%)</p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 p-5 text-white">
              <p className="text-xs opacity-80 flex items-center">
                目标公司
                <InfoTooltip text={METRIC_DEFINITIONS.targetCompany} />
              </p>
              <p className="mt-1 text-3xl font-bold">{targetCompanies.length}</p>
              <p className="text-xs opacity-70 mt-1">家出现</p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 p-5 text-white">
              <p className="text-xs opacity-80 flex items-center">
                一手信源占比
                <InfoTooltip text={METRIC_DEFINITIONS.primarySourceRatio} />
              </p>
              <p className="mt-1 text-3xl font-bold">{sourceDistribution.find(s => s.label === "一手信源")?.percent || 0}%</p>
              <p className="text-xs opacity-70 mt-1">高置信判断依据</p>
            </div>
          </section>

          {coreJudgments.length > 0 && (
            <section className="rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 border border-slate-600 p-5 text-white">
              <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                <span className="text-lg">🔥</span> 核心判断
                <span className="ml-auto text-xs opacity-70">{timeRangeLabel}汇总</span>
              </h3>
              <p className="text-xs text-slate-400 mb-3">先看这3条，就能快速知道本期最重要变化。</p>
              <div className="space-y-3">
                {coreJudgments.map((j, idx) => (
                  <div key={idx} className="flex items-start gap-3 pl-4 border-l-2 border-emerald-400">
                    <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded ${
                      j.type === "趋势" ? "bg-emerald-500/30 text-emerald-300" :
                      j.type === "结构" ? "bg-blue-500/30 text-blue-300" :
                      "bg-amber-500/30 text-amber-300"
                    }`}>
                      {j.type}
                    </span>
                    <p className="text-sm leading-relaxed text-slate-100">
                      {j.text}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">📊 主题分布</h3>
                <p className="text-xs text-slate-400">看本期变化主要集中在哪些方向。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked={coreOnly} onChange={e => setCoreOnly(e.target.checked)}
                    className="rounded border-slate-300 text-moss focus:ring-moss" />
                  核心洞察
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked={includeReference} onChange={e => setIncludeReference(e.target.checked)}
                    className="rounded border-slate-300 text-moss focus:ring-moss" />
                  含外围参考
                </label>
              </div>
            </div>
            <div className="grid gap-3 grid-cols-3 md:grid-cols-5">
              {TOPICS.map(topic => (
                <TopicCard
                  key={topic.key}
                  topic={topic}
                  count={topicCounts[topic.key] || 0}
                  trend={(topicCounts[topic.key] || 0) >= 5 ? "上升" : (topicCounts[topic.key] || 0) >= 2 ? "稳定" : "下降"}
                  isActive={activeTopic === topic.key}
                  onClick={() => setActiveTopic(activeTopic === topic.key ? "all" : topic.key)}
                />
              ))}
            </div>
            <div className="bg-slate-50 rounded-lg px-4 py-2 border border-slate-200">
              <p className="text-xs text-slate-500">
                <span className="font-medium text-slate-700">统计口径说明：</span>
                上方数字为去重后的洞察条数；下方为主题标签命中次数，同一洞察可命中多个主题，两者口径不同。
              </p>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <BarChart
                title="本期关注重点"
                data={TOPICS.map(t => ({ label: t.label, value: topicCounts[t.key] || 0 }))}
                conclusion="比较不同主题的热度高低，帮助判断本期关注重心。"
              />
              <div className="flex gap-4">
                <div className="flex-1">
                  <PieChart
                    title="信息来源结构"
                    data={sourceDistribution}
                    conclusion="当媒体转述占比较高时，需警惕信息被放大或失真。"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <Heatmap targetData={targetCompanies} sourceData={sourceMedia} />
            </div>
          </section>

<section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">📋 重点洞察 ({filteredItems.length})</h3>
                <p className="text-xs text-slate-400">逐条查看判断、风险提示和下一步建议。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={evidenceType} onChange={e => setEvidenceType(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-moss focus:outline-none">
                  {EVIDENCE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-4">
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索洞察..."
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/20" />
            </div>
            <div className="space-y-4">
              {insightCards.map(card => <InsightCard key={card.id} item={card} />)}
              {insightCards.length === 0 && !loading && (
                <div className="text-center py-12 text-slate-500">
                  <p className="text-lg mb-2">📭</p>
                  <p>暂无符合条件的洞察</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* 报告生成 Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-ink">洞察报告预览</h2>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setGeneratedReport(null);
                  setReportError(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!isGenerating && !generatedReport && !reportError && (
                <div className="p-6">
                  <h3 className="text-sm font-semibold text-ink mb-4">选择报告类型</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <button
                      onClick={() => setReportType("brief")}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        reportType === "brief"
                          ? "border-moss bg-moss/5"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">📝</span>
                        <span className="font-semibold text-ink">简版报告</span>
                      </div>
                      <p className="text-sm text-slate-600">适合快速浏览，包含核心判断和关键洞察</p>
                    </button>
                    <button
                      onClick={() => setReportType("exec")}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        reportType === "exec"
                          ? "border-moss bg-moss/5"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">📊</span>
                        <span className="font-semibold text-ink">管理层报告</span>
                      </div>
                      <p className="text-sm text-slate-600">适合管理层汇报，包含完整分析和代表证据</p>
                    </button>
                  </div>
                  <div className="mt-6 p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-600 mb-2">📋 当前数据范围</p>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">时间范围</p>
                        <p className="font-medium text-ink">{timeRangeLabel}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">有效洞察</p>
                        <p className="font-medium text-ink">{filteredItems.length}条</p>
                      </div>
                      <div>
                        <p className="text-slate-500">高置信</p>
                        <p className="font-medium text-ink">{highValueCount}条</p>
                      </div>
                      <div>
                        <p className="text-slate-500">涉及公司</p>
                        <p className="font-medium text-ink">{targetCompanies.length}家</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleGenerateReport}
                    disabled={filteredItems.length === 0}
                    className="mt-6 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-3 text-sm font-medium text-white shadow-sm hover:from-emerald-700 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    确认生成 {reportType === "exec" ? "管理层报告" : "简版报告"}
                  </button>
                </div>
              )}

              {isGenerating && (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4" />
                  <p className="text-sm text-slate-600">{reportLoadingStep}</p>
                  <p className="text-xs text-slate-400 mt-2">请稍候...</p>
                </div>
              )}

              {reportError && (
                <div className="flex flex-col items-center justify-center py-20 px-6">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <span className="text-2xl">❌</span>
                  </div>
                  <p className="text-sm text-red-600 mb-2">报告生成失败</p>
                  <p className="text-xs text-slate-500 text-center">{reportError}</p>
                  <button
                    onClick={() => {
                      setReportError(null);
                    }}
                    className="mt-4 px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                  >
                    返回选择
                  </button>
                </div>
              )}

              {generatedReport && !isGenerating && (
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3 bg-slate-50">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-slate-600">
                        📄 {reportType === "exec" ? "管理层报告" : "简版报告"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(generatedReport.meta.generated_at as string).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDownloadMarkdown}
                        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        下载 Markdown
                      </button>
                      <button
                        onClick={() => setGeneratedReport(null)}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        生成新报告
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="prose prose-sm max-w-none">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                        {generatedReport.markdown}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
