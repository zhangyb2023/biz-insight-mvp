import type { ConsumptionItem } from "@/lib/types";

export type InsightEntryViewModel = {
  company_name: string;
  company_type: string;
  page_title: string;
  page_section: string;
  source_domain: string;
  page_kind:
    | "product_detail"
    | "solution_detail"
    | "news_detail"
    | "partnership_detail"
    | "standard_detail"
    | "whitepaper"
    | "download_doc"
    | "homepage"
    | "list_page"
    | "about_page"
    | "category_page";
  source_url: string;
  published_at: string | null;
  fetched_at: string | null;
  summary: string;
  event_type: string;
  product_keywords: string[];
  tech_keywords: string[];
  customer_or_partner: string | null;
  evidence_strength: "强" | "中" | "弱";
  supports_judgment: boolean;
  reference_value_for_pwh: string;
  should_enter_report: boolean;
  insight_judgment: string;
  insight_implication: string;
};

export const strongEvidencePageKinds: InsightEntryViewModel["page_kind"][] = [
  "news_detail",
  "partnership_detail",
  "whitepaper",
  "download_doc"
];

export function isStrongEvidencePageKind(pageKind: InsightEntryViewModel["page_kind"]) {
  return strongEvidencePageKinds.includes(pageKind);
}

export function isCompleteFrontstageInsight(item: InsightEntryViewModel) {
  return Boolean(
    item.page_title.trim() &&
      item.summary.trim() &&
      item.source_domain.trim() &&
      item.source_url.trim() &&
      item.page_kind &&
      item.insight_judgment.trim()
  );
}

function supportsFrontstageByEvidence(item: ConsumptionItem, pageKind: InsightEntryViewModel["page_kind"]) {
  const completenessScore = item.completeness_score ?? 0;
  const isDetail = (item.page_kind ?? "detail") === "detail";
  const hasPublishedAt = Boolean(item.published_at);
  const isDynamicSource = ["company_newsroom", "company_case_study", "ecosystem_partner", "industry_media", "generic_news_portal"].includes(
    item.source_type ?? ""
  );
  const isDynamicPageKind = ["news_detail", "partnership_detail"].includes(pageKind);

  if (!isDetail) {
    return false;
  }
  if (completenessScore < 0.75) {
    return false;
  }
  if (!isDynamicSource && !isDynamicPageKind) {
    return false;
  }
  if (!hasPublishedAt) {
    return false;
  }
  return isDynamicPageKind;
}

const companyTypeMap: Record<string, string> = {
  "i-soft": "中心参照",
  vector: "P1",
  elektrobit: "P1",
  reachauto: "P1",
  thundersoft: "P1",
  "huawei-qiankun-auto": "P1",
  autosar: "P1",
  "horizon-robotics": "P2",
  "black-sesame": "P2",
  "semi-drive": "P2"
};

const productKeywordPool = [
  "AUTOSAR",
  "Adaptive",
  "Classic",
  "Hypervisor",
  "PREEvision",
  "软件平台",
  "解决方案",
  "产品",
  "平台",
  "座舱",
  "智能驾驶",
  "域控制器"
];

const techKeywordPool = [
  "AUTOSAR",
  "SOA",
  "Hypervisor",
  "虚拟化",
  "中间件",
  "OS",
  "操作系统",
  "Classic",
  "Adaptive",
  "平台",
  "技术"
];

function collectKeywords(text: string, pool: string[]) {
  const haystack = text.toLowerCase();
  return pool.filter((keyword) => haystack.includes(keyword.toLowerCase())).slice(0, 4);
}

function inferPageSection(item: ConsumptionItem) {
  if (item.source_type === "company_case_study") {
    return "客户/案例";
  }
  if (item.source_type === "company_product_page") {
    return "产品/方案";
  }
  if (item.source_type === "company_newsroom") {
    return "新闻/动态";
  }
  if (item.display_category === "生态") {
    return "生态/合作";
  }
  if (item.display_category === "技术") {
    return "技术/标准";
  }
  return item.display_category || "其他";
}

function inferEventType(item: ConsumptionItem) {
  if (item.insight_type?.trim()) {
    return item.insight_type;
  }
  if (item.source_type === "company_case_study") {
    return "客户案例动态";
  }
  if (item.source_type === "company_product_page") {
    return "产品能力变化";
  }
  if (item.display_category === "生态") {
    return "生态合作动态";
  }
  return "行业动态";
}

function inferPageKind(item: ConsumptionItem): InsightEntryViewModel["page_kind"] {
  const url = item.url.toLowerCase();
  const title = item.title.toLowerCase();
  const pathname = (() => {
    try {
      return new URL(item.url).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();
  const isRootHomepage = pathname === "/" || pathname === "";

  if (url.includes("/about")) {
    return "about_page";
  }
  if (url.includes("/download") || url.includes("/downloads") || url.includes("/file")) {
    return "download_doc";
  }
  if (url.includes("/whitepaper") || title.includes("whitepaper") || title.includes("白皮书")) {
    return "whitepaper";
  }
  if (
    item.source_type === "company_case_study" ||
    /合作|签约|客户|案例|伙伴|联合|中标|定点|交付|launch|release|award|deal|partnership|customer|case study/i.test(item.title)
  ) {
    return "partnership_detail";
  }
  if (
    item.source_type === "company_newsroom" ||
    /\/news\/|\/press\/|\/article|\/media\/|\/blog\/|\/insights?\//.test(url) ||
    /新闻|动态|资讯|公告|发布|press|news|blog|insight/i.test(item.title)
  ) {
    return "news_detail";
  }
  if (item.source_type === "company_product_page") {
    if (url.includes("/solution") || title.includes("solution") || title.includes("解决方案")) {
      return "solution_detail";
    }
    if (url.includes("/standard") || title.includes("standard") || title.includes("autosar")) {
      return "standard_detail";
    }
    return "product_detail";
  }
  if (isRootHomepage) {
    return "homepage";
  }
  if (url.includes("/category") || url.includes("/categories")) {
    return "category_page";
  }
  if (url.includes("/list") || url.includes("/news") || url.includes("/products") || url.includes("/solutions")) {
    return "list_page";
  }
  return "category_page";
}

function inferEvidenceStrength(pageKind: InsightEntryViewModel["page_kind"]): InsightEntryViewModel["evidence_strength"] {
  if (["partnership_detail", "whitepaper", "download_doc"].includes(pageKind)) {
    return "强";
  }
  if (["news_detail", "standard_detail", "product_detail", "solution_detail"].includes(pageKind)) {
    return "中";
  }
  return "弱";
}

function inferCustomerOrPartner(item: ConsumptionItem) {
  const text = `${item.title} ${item.summary}`.trim();
  const matched = text.match(/(?:合作|伙伴|客户|联合)\s*[:：]?\s*([\u4e00-\u9fa5A-Za-z0-9·&\-\s]{2,24})/);
  return matched?.[1]?.trim() || null;
}

function inferPublishedAt(item: ConsumptionItem, pageKind: InsightEntryViewModel["page_kind"]) {
  if (item.published_at?.trim()) {
    return item.published_at.trim();
  }
  const candidate = item.extracted_items.find((entry) => entry.date && entry.date.trim());
  if (candidate?.date?.trim()) {
    return candidate.date.trim();
  }
  if (
    item.fetch_date &&
    isStrongEvidencePageKind(pageKind) &&
    item.is_high_value &&
    !item.is_noise &&
    !["news_detail", "partnership_detail"].includes(pageKind)
  ) {
    return item.fetch_date.slice(0, 10);
  }
  return null;
}

function inferSourceDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function inferReferenceValue(item: ConsumptionItem) {
  if (item.source_type === "company_newsroom" || item.source_type === "company_case_study") {
    return "可用于判断近期市场动作、合作关系与客户推进方向。";
  }
  if (item.source_type === "company_product_page") {
    return "可直接用于产品路线与能力对标。";
  }
  if (item.display_category === "生态") {
    return "可用于判断合作关系与生态卡位变化。";
  }
  if (item.display_category === "技术") {
    return "可用于判断技术路线和平台门槛变化。";
  }
  return "可作为业务判断的辅助证据。";
}

function inferJudgment(item: ConsumptionItem) {
  if (item.source_type === "company_case_study") {
    return "该条目更像客户/合作动作，具备商业跟踪价值。";
  }
  if (item.source_type === "company_product_page") {
    return "该条目更像明确产品/方案信号，具备直接观察价值。";
  }
  if (item.display_category === "生态") {
    return "该条目反映生态关系变化，值得跟踪合作与绑定方向。";
  }
  if (item.source_type === "company_newsroom") {
    return "该条目属于动态发布，需结合对象上下文判断是否进入重点报告。";
  }
  return "该条目可作为阶段性观察证据，但需要结合专题上下文使用。";
}

function inferImplication(item: ConsumptionItem) {
  if (item.source_type === "company_newsroom" || item.source_type === "company_case_study") {
    return "建议优先用于跟踪市场动作、客户信号和合作进展，再决定是否进入管理层专题判断。";
  }
  if (item.source_type === "company_product_page") {
    return "建议优先用于产品竞争对标，识别普华能力补齐或差异化空间。";
  }
  if (item.display_category === "生态") {
    return "建议关注合作对象变化对普华生态位置和进入路径的影响。";
  }
  if (item.display_category === "技术") {
    return "建议结合技术路线变化，判断普华中长期投入优先级。";
  }
  return "建议作为专题观察输入，而不是单独形成管理层结论。";
}

export function toInsightEntryViewModel(item: ConsumptionItem): InsightEntryViewModel {
  const text = `${item.title} ${item.summary}`.trim();
  const pageKind = inferPageKind(item);
  const evidenceStrength = inferEvidenceStrength(pageKind);
  const supportsJudgment = supportsFrontstageByEvidence(item, pageKind);
  return {
    company_name: item.company_name,
    company_type: companyTypeMap[item.company_id] ?? "其他对象",
    page_title: item.title,
    page_section: inferPageSection(item),
    source_domain: inferSourceDomain(item.url),
    page_kind: pageKind,
    source_url: item.url,
    published_at: inferPublishedAt(item, pageKind),
    fetched_at: item.fetch_date || null,
    summary: item.summary,
    event_type: inferEventType(item),
    product_keywords: collectKeywords(text, productKeywordPool),
    tech_keywords: collectKeywords(text, techKeywordPool),
    customer_or_partner: inferCustomerOrPartner(item),
    evidence_strength: evidenceStrength,
    supports_judgment: supportsJudgment,
    reference_value_for_pwh: inferReferenceValue(item),
    should_enter_report: Boolean(
      item.is_high_value &&
        !item.is_noise &&
        (item.quality_score ?? 0) >= 80 &&
        (item.completeness_score ?? 0) >= 0.75 &&
        supportsJudgment
    ),
    insight_judgment: supportsJudgment ? inferJudgment(item) : "当前证据强度不足，暂不支撑强判断。",
    insight_implication: inferImplication(item)
  };
}
