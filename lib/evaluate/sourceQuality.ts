import type { SourceType } from "../types";

const OFFICIAL_COMPANY_DOMAINS: Record<string, string> = {
  "vector.com": "vector",
  "i-soft.com.cn": "i-soft",
  "reachauto.com": "reachauto",
  "hirain.com": "hirain",
  "thundersoft.com": "thundersoft",
  "denso.com": "denso",
  "zeekrlife.com": "zeekr",
  "byd.com": "byd",
  "geely.com": "geely",
  "gac.com": "gac",
  "saicmotor.com": "saic",
  "changan.com": "changan",
  "baic.com": "baic",
  "greatwall.com": "greatwall",
  "cherry.com": "cherry",
  "jac.com": "jac"
};

const INDUSTRY_MEDIA_DOMAINS = [
  "autov.com",
  "autov.com.cn",
  "car-tech.cn",
  "eeof.cn",
  "autotimes.com",
  "che360.com",
  "qichemall.com",
  "gasgoo.com",
  "chinaautomobile.com",
  "evlook.com",
  "d1ev.com",
  "nev360.com",
  "liumiao.com",
  "sinoauto.cn",
  "pcauto.com.cn",
  "yiche.com",
  "bitauto.com",
  "car2100.com",
  "autohome.com.cn",
  "eet-china.com"
];

const GENERIC_NEWS_PORTAL_DOMAINS = [
  "sina.com.cn",
  "sina.com",
  "163.com",
  "126.com",
  "sohu.com",
  "qq.com",
  "ifeng.com",
  "baidu.com",
  "tom.com",
  "21cn.com",
  "people.com.cn",
  "xinhuanet.com",
  "cnn.com",
  "bbc.com",
  "reuters.com",
  "news.sina.com",
  "news.163.com"
];

const SOCIAL_PLATFORM_DOMAINS = [
  "weibo.com",
  "weixin.qq.com",
  "twitter.com",
  "facebook.com",
  "linkedin.com",
  "zhihu.com",
  "douban.com",
  "xiaohongshu.com"
];

const VIDEO_PLATFORM_DOMAINS = [
  "youku.com",
  "iqiyi.com",
  "tencent.com",
  "bilibili.com",
  "youtube.com",
  "v.qq.com",
  "mgtv.com",
  "sohu.com/video",
  "ifeng.com/video"
];

const HIGH_VALUE_PATH_PATTERNS = [
  "/product",
  "/products",
  "/solution",
  "/solutions",
  "/platform",
  "/service",
  "/services",
  "/product-a-z",
  "/product_",
  "/about",
  "/company",
  "/news",
  "/press",
  "/blog",
  "/dynamic",
  "/media",
  "/career",
  "/jobs",
  "/hiring",
  "/join",
  "/recruit",
  "/partner",
  "/partners",
  "/ecosystem",
  "/alliance",
  "/cooperation"
];

const HIGH_VALUE_TITLE_KEYWORDS = [
  "产品",
  "方案",
  "平台",
  "解决方案",
  "软件",
  "系统",
  "服务",
  "产品介绍",
  "产品详情",
  "产品优势",
  "方案介绍",
  "解决方案",
  "product",
  "solution",
  "platform"
];

const AUTO_ELECTRONIC_KEYWORDS = [
  "AUTOSAR",
  "域控制器",
  "中间件",
  "基础软件",
  "车用操作系统",
  "SOA",
  "OTA",
  "线控",
  "智驾",
  "座舱",
  "自动驾驶",
  "智能驾驶",
  "车载",
  "工具链",
  "软件定义汽车",
  "ECU",
  "VCU",
  "BMS",
  "T-BOX",
  "GW",
  "CAN",
  "LIN",
  "Ethernet",
  "OSEK",
  "OSEK/VDX",
  "Adaptive AUTOSAR",
  "Classic AUTOSAR",
  "RTE",
  "BSW",
  "MCAL",
  "微内核",
  "内核",
  "虚拟化",
  "hypervisor",
  "Safety",
  "ASIL",
  "功能安全",
  "信息安全",
  "OTA升级",
  "远程诊断",
  "诊断",
  "测试工具",
  "调试工具",
  "开发工具",
  "compiler",
  "IDE",
  "调试器",
  "logger",
  "记录仪",
  "汽车",
  "芯片",
  "处理器",
  "软件",
  "系统",
  "平台",
  "方案",
  "产品",
  "技术",
  "服务",
  "零部件",
  "动力总成",
  "安全系统",
  "电装"
];

const LOW_VALUE_KEYWORDS = [
  "娱乐",
  "体育",
  "社会",
  "彩票",
  "小说",
  "传奇",
  "游戏",
  "八卦",
  "网红",
  "明星",
  "搞笑",
  "段子",
  "娱乐新闻",
  "体育新闻",
  "社会热点",
  "足球",
  "篮球",
  "股票",
  "证券",
  "英超",
  "欧冠",
  "电影",
  "电视剧",
  "综艺",
  "动漫",
  "整形",
  "美容",
  "减肥",
  "养生",
  "偏方",
  "风水",
  "算命",
  "星座",
  "运势"
];

const LIST_PAGE_PATH_PATTERNS = [
  "/list",
  "/lists",
  "/tag",
  "/tags",
  "/category",
  "/categories",
  "/archive",
  "/archives",
  "/page/",
  "/pages",
  "/index_",
  "/news_"
];

const LIST_PAGE_TITLE_KEYWORDS = [
  "列表",
  "汇总",
  "全部",
  "最新资讯",
  "更多",
  "标签",
  "专题",
  "推荐",
  "热门",
  "排行榜",
  "分类"
];

const CHINESE_CCTLD = ["cn", "com.cn", "net.cn", "org.cn", "gov.cn"];

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const parts = hostname.split(".");
    
    if (parts.length >= 3) {
      const lastTwo = parts.slice(-2).join(".");
      if (CHINESE_CCTLD.includes(lastTwo)) {
        return parts.slice(-3).join(".");
      }
    }
    
    if (parts.length >= 2) {
      return parts.slice(-2).join(".");
    }
    return hostname;
  } catch {
    return "";
  }
}

function extractRootDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const parts = hostname.split(".");
    
    if (parts.length >= 3) {
      const lastTwo = parts.slice(-2).join(".");
      if (CHINESE_CCTLD.includes(lastTwo)) {
        return parts.slice(-4).join(".");
      }
      return parts.slice(-3).join(".");
    }
    if (parts.length === 2) {
      return hostname;
    }
    return "";
  } catch {
    return "";
  }
}

function matchPattern(text: string, patterns: string[]): boolean {
  const lowerText = text.toLowerCase();
  return patterns.some((pattern) => lowerText.includes(pattern.toLowerCase()));
}

function classifyByUrlAndTitle(url: string, title: string): SourceType | null {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();

  if (
    matchPattern(lowerUrl, [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"])
  ) {
    return "document_or_pdf";
  }

  if (
    matchPattern(lowerUrl, ["/video", "/watch", "/vod", "/v/"])
  ) {
    return "video_platform";
  }

  if (
    matchPattern(lowerUrl, ["/weibo", "/weixin", "/zhihu", "/twitter", "/facebook", "/linkedin"])
  ) {
    return "social_platform";
  }

  if (
    matchPattern(lowerUrl, [
      "/news",
      "/press",
      "/blog",
      "/dynamic",
      "/media",
      "/zx"
    ]) ||
    matchPattern(lowerTitle, ["新闻", "动态", "资讯", "press", "blog"])
  ) {
    return "company_newsroom";
  }

  if (
    matchPattern(lowerUrl, [
      "/case",
      "/cases",
      "/example",
      "/examples",
      "/success",
      "/stories"
    ]) ||
    matchPattern(lowerTitle, ["案例", "成功案例", "客户案例", "case study"])
  ) {
    return "company_case_study";
  }

  if (
    matchPattern(lowerUrl, [
      "/product",
      "/products",
      "/solution",
      "/solutions",
      "/platform",
      "/service",
      "/services",
      "/product-a-z"
    ]) ||
    matchPattern(lowerTitle, ["产品", "方案", "平台", "解决方案", "product", "solution", "platform"])
  ) {
    return "company_product_page";
  }

  if (
    matchPattern(lowerUrl, [
      "/jobs",
      "/career",
      "/hiring",
      "/join",
      "/recruit",
      "/zhaopin"
    ]) ||
    matchPattern(lowerTitle, ["招聘", "加入", "人才", "岗位", "career", "jobs", "hiring"])
  ) {
    return "recruitment_page";
  }

  if (
    matchPattern(lowerUrl, [
      "/partner",
      "/partners",
      "/ecosystem",
      "/alliance",
      "/cooperation"
    ]) ||
    matchPattern(lowerTitle, ["合作", "伙伴", "生态", "联盟", "partner", "ecosystem"])
  ) {
    return "ecosystem_partner";
  }

  return null;
}

function classifyByDomain(url: string): SourceType | null {
  const domain = extractDomain(url);
  const rootDomain = extractRootDomain(url);

  if (Object.keys(OFFICIAL_COMPANY_DOMAINS).some((d) => domain.endsWith(d) || rootDomain.endsWith(d))) {
    return "company_official";
  }

  if (INDUSTRY_MEDIA_DOMAINS.some((d) => domain.endsWith(d) || rootDomain.endsWith(d))) {
    return "industry_media";
  }

  if (GENERIC_NEWS_PORTAL_DOMAINS.some((d) => domain.endsWith(d) || rootDomain.endsWith(d))) {
    return "generic_news_portal";
  }

  if (SOCIAL_PLATFORM_DOMAINS.some((d) => domain.endsWith(d) || rootDomain.endsWith(d))) {
    return "social_platform";
  }

  if (VIDEO_PLATFORM_DOMAINS.some((d) => domain.endsWith(d) || rootDomain.endsWith(d))) {
    return "video_platform";
  }

  return null;
}

export function classifySourceType(url: string, title: string): SourceType {
  const domain = extractDomain(url);
  const rootDomain = extractRootDomain(url);

  if (GENERIC_NEWS_PORTAL_DOMAINS.some((d) => domain.endsWith(d) || rootDomain.endsWith(d))) {
    return "generic_news_portal";
  }

  if (INDUSTRY_MEDIA_DOMAINS.some((d) => domain.endsWith(d) || rootDomain.endsWith(d))) {
    return "industry_media";
  }

  const pageType = classifyByUrlAndTitle(url, title);
  if (pageType) {
    return pageType;
  }

  if (Object.keys(OFFICIAL_COMPANY_DOMAINS).some((d) => domain.endsWith(d) || rootDomain.endsWith(d))) {
    return "company_official";
  }

  if (VIDEO_PLATFORM_DOMAINS.some((d) => domain.endsWith(d) || rootDomain.endsWith(d))) {
    return "video_platform";
  }

  if (SOCIAL_PLATFORM_DOMAINS.some((d) => domain.endsWith(d) || rootDomain.endsWith(d))) {
    return "social_platform";
  }

  if (matchPattern(url.toLowerCase(), [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"])) {
    return "document_or_pdf";
  }

  return "unknown";
}

export function isListPage(url: string, title: string, cleanText: string): boolean {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();

  if (matchPattern(lowerUrl, LIST_PAGE_PATH_PATTERNS)) {
    return true;
  }

  if (matchPattern(lowerTitle, LIST_PAGE_TITLE_KEYWORDS)) {
    return true;
  }

  if (cleanText) {
    const lines = cleanText.split("\n").filter((line) => line.trim().length > 20);
    if (lines.length > 10) {
      const shortLineRatio = lines.filter((line) => line.trim().length < 50).length / lines.length;
      if (shortLineRatio > 0.7) {
        return true;
      }
    }
  }

  return false;
}

const QUALITY_MIN_DATE = "2026-01-01";

function computeDateDecay(publishedAt: string | null | undefined): number {
  if (!publishedAt) return 0;
  const dateStr = publishedAt.slice(0, 10);
  if (dateStr < QUALITY_MIN_DATE) {
    const d1 = new Date(dateStr).getTime();
    const d2 = new Date(QUALITY_MIN_DATE).getTime();
    const daysDiff = Math.max(0, (d2 - d1) / (1000 * 60 * 60 * 24));
    const decay = Math.min(25, daysDiff * 0.05);
    return -decay;
  }
  return 0;
}

export function evaluateSourceQuality(input: {
  url: string;
  title: string;
  cleanText?: string;
  extractedItems?: Array<{ title: string; summary?: string; date?: string }>;
  publishedAt?: string | null;
}): {
  source_domain: string;
  source_type: SourceType;
  quality_score: number;
  is_high_value: boolean;
  is_noise: boolean;
  noise_reason?: string;
  quality_reason?: string;
  matched_rules?: string[];
  source_signals?: string[];
} {
  const { url, title, cleanText = "", extractedItems = [] } = input;

  const sourceDomain = extractDomain(url);
  const sourceType = classifySourceType(url, title);
  const isList = isListPage(url, title, cleanText);

  let score = 50;
  const noiseReasons: string[] = [];
  const matchedRules: string[] = [];
  const sourceSignals: string[] = [];

  const lowerTitle = title.toLowerCase();
  const lowerUrl = url.toLowerCase();
  const lowerText = cleanText.toLowerCase();

  if (sourceType === "company_product_page") {
    score = 80;
    matchedRules.push("company_product_page");
    sourceSignals.push("产品/解决方案页，高商业价值");
  } else if (sourceType === "company_case_study") {
    score = 70;
    matchedRules.push("company_case_study");
    sourceSignals.push("案例页，含实际应用场景");
  } else if (sourceType === "company_newsroom") {
    score = 65;
    matchedRules.push("company_newsroom");
    sourceSignals.push("公司新闻，有行业动态信息");
  } else if (sourceType === "ecosystem_partner") {
    score = 65;
    matchedRules.push("ecosystem_partner");
    sourceSignals.push("生态合作页，含伙伴信息");
  } else if (sourceType === "document_or_pdf") {
    score = 60;
    matchedRules.push("document_or_pdf");
    sourceSignals.push("技术文档/白皮书");
  } else if (sourceType === "industry_media") {
    score = 50;
    matchedRules.push("industry_media");
    sourceSignals.push("行业垂直媒体");
  } else if (sourceType === "company_official") {
    score = 55;
    matchedRules.push("company_official");
    sourceSignals.push("公司官网页面");
  } else if (sourceType === "recruitment_page") {
    score = 30;
    matchedRules.push("recruitment_page");
    sourceSignals.push("招聘页面，商业洞察价值有限");
  } else if (sourceType === "generic_news_portal") {
    score = 25;
    matchedRules.push("generic_news_portal");
    sourceSignals.push("综合门户，非垂直内容");
  } else if (sourceType === "social_platform") {
    score = 20;
    matchedRules.push("social_platform");
    sourceSignals.push("社交平台，非专业内容");
  } else if (sourceType === "video_platform") {
    score = 25;
    matchedRules.push("video_platform");
    sourceSignals.push("视频平台，不利文本分析");
  } else {
    score = 40;
    matchedRules.push("unknown");
    sourceSignals.push("未知来源类型");
  }

  if (matchPattern(lowerUrl, HIGH_VALUE_PATH_PATTERNS)) {
    score += 10;
    matchedRules.push("high_value_path");
  }

  if (matchPattern(lowerTitle, HIGH_VALUE_TITLE_KEYWORDS)) {
    score += 8;
    matchedRules.push("high_value_title");
  }

  if (matchPattern(lowerTitle, AUTO_ELECTRONIC_KEYWORDS) || matchPattern(lowerText, AUTO_ELECTRONIC_KEYWORDS)) {
    score += 12;
    matchedRules.push("auto_electronic_keyword");
    sourceSignals.push("含汽车电子/基础软件关键词");
  }

  if (cleanText.length > 500) {
    score += 5;
    matchedRules.push("content_length_good");
  }

  if (cleanText.length === 0) {
    score -= 25;
    noiseReasons.push("content_empty");
  } else if (cleanText.length < 200) {
    score -= 20;
    noiseReasons.push("content_too_short");
  }

  if (sourceType === "industry_media" && (matchPattern(lowerTitle, AUTO_ELECTRONIC_KEYWORDS) || matchPattern(lowerText, AUTO_ELECTRONIC_KEYWORDS))) {
    score += 15;
    matchedRules.push("industry_media_relevant");
  }

  const hasAutoKeyword = matchPattern(lowerTitle, AUTO_ELECTRONIC_KEYWORDS) || matchPattern(lowerText, AUTO_ELECTRONIC_KEYWORDS);
  
  if ((matchPattern(lowerTitle, LOW_VALUE_KEYWORDS) || matchPattern(lowerText, LOW_VALUE_KEYWORDS)) && !hasAutoKeyword) {
    score -= 30;
    noiseReasons.push("unrelated_topic");
    sourceSignals.push("内容与目标行业无关");
  }

  if (isList) {
    score -= 10;
    if (!noiseReasons.includes("list_page")) {
      noiseReasons.push("list_page");
    }
    sourceSignals.push("列表/聚合页");
  }

  if (matchedRules.includes("auto_electronic_keyword") && cleanText.length >= 200) {
    score += 10;
    matchedRules.push("industry_relevant_content");
  }

  score = Math.max(0, Math.min(100, score));

  const dateDecay = computeDateDecay(input.publishedAt);
  if (dateDecay < 0) {
    score += dateDecay;
    matchedRules.push("date_decay");
    sourceSignals.push(`发布日期早于${QUALITY_MIN_DATE}，时效性衰减${Math.abs(dateDecay).toFixed(1)}分`);
  }

  const isListPageNoise = isList && cleanText.length < 500;

  if (sourceType === "company_newsroom" && cleanText.length > 0 && cleanText.length < 300) {
    score -= 15;
    matchedRules.push("news_content_short");
    if (!noiseReasons.includes("content_too_short")) {
      noiseReasons.push("news_content_short");
    }
    sourceSignals.push("官网新闻页内容较短");
  }

  if (isListPageNoise) {
    score -= 15;
    matchedRules.push("list_page_low_quality");
    sourceSignals.push("列表页信息量不足");
  }

  const isNoise =
    noiseReasons.includes("unrelated_topic") ||
    (sourceType === "generic_news_portal" && !matchedRules.includes("industry_media_relevant")) ||
    sourceType === "social_platform" ||
    sourceType === "video_platform" ||
    (sourceType !== "document_or_pdf" && cleanText.length === 0);

  const highValueTypes = ["company_product_page", "company_case_study", "ecosystem_partner", "document_or_pdf"];
  const isHighValueType = highValueTypes.includes(sourceType);
  const hasIndustryKeyword = matchedRules.includes("auto_electronic_keyword") || matchedRules.includes("industry_relevant_content");
  const hasGoodContent = cleanText.length >= 300;
  
  const isHighValue = 
    (isHighValueType && !isNoise) ||
    (sourceType === "company_newsroom" && hasIndustryKeyword && hasGoodContent && !isNoise) ||
    (score >= 75 && !isNoise);

  let qualityReason = "";
  if (isHighValue) {
    qualityReason = `高价值页面: ${sourceType}类型，内容充实且与行业相关`;
  } else if (isNoise) {
    qualityReason = `噪音页面: ${noiseReasons.join(", ")}`;
  } else if (score >= 50) {
    qualityReason = `中等价值: ${sourceType}类型，内容质量一般`;
  } else {
    qualityReason = `低价值页面`;
  }

  return {
    source_domain: sourceDomain,
    source_type: sourceType,
    quality_score: score,
    is_high_value: isHighValue,
    is_noise: isNoise,
    noise_reason: noiseReasons.length > 0 ? noiseReasons[0] : undefined,
    quality_reason: qualityReason,
    matched_rules: matchedRules,
    source_signals: sourceSignals
  };
}
