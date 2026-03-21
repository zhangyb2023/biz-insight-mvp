export type CrawlMode =
  | "news_list"
  | "product_detail"
  | "portal_home"
  | "detail_page"
  | "invalid_source"
  | "general";

export type EvaluationStepKey =
  | "url_resolve"
  | "page_fetch"
  | "clean_text"
  | "list_extract"
  | "keyword_match"
  | "llm_analysis"
  | "aggregate";

export type EvaluationStep = {
  key: EvaluationStepKey;
  label: string;
  score: number;
  passed: boolean;
  reason: string;
  input: string;
  output: string;
  tool: string;
  suggestion?: string;
};

export type EvaluationSummary = {
  crawlMode: CrawlMode;
  totalScore: number;
  status: "fixed" | "usable" | "failed";
  finalVerdict: string;
  recommendedAction: string;
  fixedReason: string;
  steps: EvaluationStep[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function containsLowValueText(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("cookie") ||
    normalized.includes("consent") ||
    normalized.includes("隐私政策") ||
    normalized.includes("source status: unavailable") ||
    normalized.includes("the news record is not available anymore")
  );
}

export function inferCrawlMode(input: {
  url: string;
  urlType: string;
  extractedItemsCount: number;
  cleanText: string;
}) {
  const normalizedUrl = input.url.toLowerCase();
  const cleanText = input.cleanText.toLowerCase();
  if (containsLowValueText(cleanText)) {
    return "invalid_source" as const;
  }
  if (input.urlType === "product") {
    return "product_detail" as const;
  }
  if (input.urlType === "news" && input.extractedItemsCount >= 3) {
    return "news_list" as const;
  }
  if ((normalizedUrl.includes("index") || /news\.[^/]+\/?$/.test(normalizedUrl) || normalizedUrl.endsWith("/")) && input.extractedItemsCount >= 1) {
    return "portal_home" as const;
  }
  if (cleanText.length >= 200) {
    return "detail_page" as const;
  }
  return "general" as const;
}

export function evaluateSourceResult(input: {
  url: string;
  urlType: string;
  cleanText: string;
  matchedKeywords: string[];
  extractedItemsCount: number;
  llmStatus: string;
  llmProvider: string;
  fallbackUsed: boolean;
  summary: string;
  category: string;
  sourceExists: boolean;
}) : EvaluationSummary {
  const mode = inferCrawlMode({
    url: input.url,
    urlType: input.urlType,
    extractedItemsCount: input.extractedItemsCount,
    cleanText: input.cleanText
  });
  const steps: EvaluationStep[] = [];

  const urlResolveScore = input.url.startsWith("http://") || input.url.startsWith("https://") ? 100 : 0;
  steps.push({
    key: "url_resolve",
    label: "网址识别",
    score: urlResolveScore,
    passed: urlResolveScore >= 80,
    reason: urlResolveScore >= 80 ? "网址格式有效，能进入抓取流程。" : "网址格式异常，后续流程不可靠。",
    input: "来源网址",
    output: "规范化网址",
    tool: "source_registry / URL parser",
    suggestion: urlResolveScore >= 80 ? "保持当前网址。" : "先修正网址格式。"
  });

  const pageFetchScore = input.sourceExists ? 100 : 10;
  steps.push({
    key: "page_fetch",
    label: "页面抓取",
    score: pageFetchScore,
    passed: pageFetchScore >= 80,
    reason: input.sourceExists ? "抓取后已有正式来源记录。" : "没有对应正式来源，抓取链路可能没走通。",
    input: "网址 + 抓取配置",
    output: "HTML / title / fetch_date",
    tool: "Playwright + Chromium",
    suggestion: input.sourceExists ? "抓取环节基本稳定。" : "优先检查工作台或控制台的这条网址是否真正入库。"
  });

  let cleanTextScore = 0;
  if (containsLowValueText(input.cleanText)) {
    cleanTextScore = 15;
  } else if (input.cleanText.length >= 1500) {
    cleanTextScore = 95;
  } else if (input.cleanText.length >= 500) {
    cleanTextScore = 85;
  } else if (input.cleanText.length >= 150) {
    cleanTextScore = 65;
  } else {
    cleanTextScore = 35;
  }
  steps.push({
    key: "clean_text",
    label: "正文清洗",
    score: cleanTextScore,
    passed: cleanTextScore >= 70,
    reason: containsLowValueText(input.cleanText)
      ? "清洗结果更像 cookie、失效提示或页脚，不像目标正文。"
      : `清洗后正文长度约 ${input.cleanText.length} 字，已可用于后续分析。`,
    input: "HTML snapshot",
    output: "clean_text",
    tool: "Readability + Cheerio",
    suggestion: cleanTextScore >= 70 ? "正文质量基本通过。" : "优先优化正文主区识别，不要急着调 LLM。"
  });

  let listScore = 50;
  if (mode === "news_list" || mode === "portal_home") {
    listScore = input.extractedItemsCount >= 8 ? 95 : input.extractedItemsCount >= 3 ? 80 : input.extractedItemsCount >= 1 ? 60 : 25;
  } else if (mode === "product_detail" || mode === "detail_page") {
    listScore = input.extractedItemsCount > 0 ? 60 : 85;
  }
  steps.push({
    key: "list_extract",
    label: "列表提取",
    score: listScore,
    passed: listScore >= 70,
    reason:
      mode === "news_list" || mode === "portal_home"
        ? `当前抽取到 ${input.extractedItemsCount} 条结构化条目。`
        : input.extractedItemsCount > 0
          ? "详情页也提取出了条目，但这不是必须条件。"
          : "详情页没有条目提取也属正常。",
    input: "clean_text / DOM blocks",
    output: "extracted_items",
    tool: "custom extractor",
    suggestion:
      mode === "news_list" || mode === "portal_home"
        ? (input.extractedItemsCount >= 3 ? "列表型页面条目提取已基本可用。" : "列表型页面条目太少，后续应继续优化提取规则。")
        : "这一步对详情页影响较小。"
  });

  const keywordScore = input.matchedKeywords.length >= 3 ? 90 : input.matchedKeywords.length >= 1 ? 70 : 45;
  steps.push({
    key: "keyword_match",
    label: "关键词匹配",
    score: keywordScore,
    passed: keywordScore >= 60,
    reason: input.matchedKeywords.length
      ? `命中关键词：${input.matchedKeywords.join("、")}`
      : "没有命中关键词，但不代表最终一定失败。",
    input: "clean_text + 预设关键词",
    output: "matched_keywords",
    tool: "keyword matcher",
    suggestion: input.matchedKeywords.length ? "关键词可继续辅助判断。" : "如果这是重点来源，可补更贴近业务的关键词。"
  });

  let llmScore = 0;
  if (input.llmStatus === "success" && !input.fallbackUsed) {
    llmScore = 95;
  } else if (input.fallbackUsed || input.llmStatus === "fallback") {
    llmScore = 55;
  } else if (input.llmStatus === "failed") {
    llmScore = 20;
  } else {
    llmScore = 40;
  }
  steps.push({
    key: "llm_analysis",
    label: "LLM 分析",
    score: llmScore,
    passed: llmScore >= 70,
    reason:
      input.llmStatus === "success" && !input.fallbackUsed
        ? `LLM 成功，分类为 ${input.category || "未标注"}。`
        : input.fallbackUsed
          ? "LLM 走了降级结果，说明当前分类可信度一般。"
          : "LLM 未稳定产出高质量结果。",
    input: "clean_text + matched_keywords",
    output: "summary / category / insight_type",
    tool: input.llmProvider || "LLM",
    suggestion: llmScore >= 70 ? "模型输出可进入后续洞察。" : "先修正文和条目，再看模型。"
  });

  const total = clamp(
    Math.round(
      urlResolveScore * 0.08 +
      pageFetchScore * 0.12 +
      cleanTextScore * 0.26 +
      listScore * 0.16 +
      keywordScore * 0.1 +
      llmScore * 0.28
    )
  );

  const aggregatePassed = total >= 85 && cleanTextScore >= 70 && llmScore >= 70;
  const status: EvaluationSummary["status"] = aggregatePassed ? "fixed" : total >= 65 ? "usable" : "failed";
  steps.push({
    key: "aggregate",
    label: "总评",
    score: total,
    passed: aggregatePassed,
    reason:
      status === "fixed"
        ? "这条来源已经达到可固定的抓取标准。"
        : status === "usable"
          ? "这条来源基本可用，但还有优化空间。"
          : "这条来源当前不建议固定，需继续调试。",
    input: "前面各步骤结果",
    output: "总评分 / 通过状态",
    tool: "evaluation engine",
    suggestion:
      status === "fixed"
        ? "可以固定为长期监控来源。"
        : status === "usable"
          ? "可继续用，但建议针对低分步骤优化。"
          : "先不要固定，继续调 clean_text / 列表提取或来源本身。"
  });

  const finalVerdict =
    status === "fixed"
      ? "通过，可固定"
      : status === "usable"
        ? "可用但待优化"
        : "不通过";

  const recommendedAction =
    status === "fixed"
      ? `建议固定为「${mode}」模式长期爬取。`
      : status === "usable"
        ? `建议继续沿「${mode}」模式优化，再复测。`
        : containsLowValueText(input.cleanText)
          ? "建议优先检查来源网址是否失效或正文是否抓偏。"
          : "建议继续调试清洗/提取规则，暂不固定。";

  const fixedReason =
    status === "fixed"
      ? `总分 ${total}，正文、条目/详情和 LLM 三个关键环节都达到标准，适合固定为 ${mode} 模式。`
      : status === "usable"
        ? `总分 ${total}，已具备可用性，但仍有低分步骤，暂时不建议完全固定。`
        : `总分 ${total}，至少一个关键步骤未过线，不能固定。`;

  return {
    crawlMode: mode,
    totalScore: total,
    status,
    finalVerdict,
    recommendedAction,
    fixedReason,
    steps
  };
}
