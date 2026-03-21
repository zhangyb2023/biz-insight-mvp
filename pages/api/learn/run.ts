import type { NextApiRequest, NextApiResponse } from "next";

import { deepSeekAnalyze } from "@/lib/analyze/deepSeek";
import { cleanText } from "@/lib/clean/cleanText";
import { playwrightCrawl } from "@/lib/crawl/playwrightCrawl";
import { getCompanyDetails, loadCompanies, syncCompanies } from "@/lib/db/repository";

type LearnStep = {
  step_name: string;
  step_order: number;
  status: "success" | "failed" | "fallback";
  tool_name: string;
  module_name: string;
  duration_ms: number;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  error_message?: string;
  fallback_used?: boolean;
  explanation: {
    purpose: string;
    writes_to: string;
    common_failures: string[];
    debug_hint: string;
  };
};

type LearnResponse = {
  ok: boolean;
  company: string;
  url: string;
  steps: LearnStep[];
  final_result?: {
    clean_text: string;
    matched_keywords: string[];
    extracted_items: Array<{ title: string; summary?: string; date?: string }>;
    llm: Awaited<ReturnType<typeof deepSeekAnalyze>>;
  };
  errors: Array<{ step_name: string; message: string }>;
};

function nowMs() {
  return Date.now();
}

const explanations: Record<string, LearnStep["explanation"]> = {
  url_resolve: {
    purpose: "确认本次学习案例最终要抓的真实网址，以及这个网址属于哪个公司和哪一类来源。",
    writes_to: "学习模式默认不写库，只展示 source_registry / companies 的对应关系。",
    common_failures: ["网址格式错误", "公司未选择或公司信息不存在"],
    debug_hint: "先检查 URL 是否是 http/https，再确认公司和关键词是否匹配。"
  },
  page_fetch: {
    purpose: "用 Playwright + Chromium 打开网页，拿到真实渲染后的 HTML。",
    writes_to: "工作模式会进入 sources / source_versions；学习模式先只展示抓取结果。",
    common_failures: ["页面超时", "网址无法访问", "被重定向到异常页面"],
    debug_hint: "先看是否命中缓存，再看 fetched_at、from_cache、html_length 是否正常。"
  },
  html_capture: {
    purpose: "把当前页面的 HTML 快照作为后续清洗和追溯的原始输入。",
    writes_to: "工作模式会进入 source_versions.html_snapshot 和 crawl_job_steps。",
    common_failures: ["HTML 为空", "页面只返回壳内容", "被登录页或错误页替换"],
    debug_hint: "先看 html_length 和 title，再决定是不是页面本身没加载成功。"
  },
  clean_text: {
    purpose: "去掉导航、页脚和噪音，尽量提取正文和列表条目。",
    writes_to: "工作模式会进入 documents / source_versions。",
    common_failures: ["正文过短", "抽到导航文字", "列表页条目为空"],
    debug_hint: "重点看 clean_text_preview 和 extracted_items，判断是不是页面结构识别错了。"
  },
  list_extract: {
    purpose: "针对新闻列表页或动态页，尽量抽出结构化条目，帮助后续直接理解页面价值。",
    writes_to: "工作模式会进入 documents.extracted_items 和 source_versions.extracted_items_json。",
    common_failures: ["新闻条目为空", "只抽到导航按钮", "日期识别不到"],
    debug_hint: "重点看 extracted_items 里有没有标题、摘要、日期，不要只看 clean_text。"
  },
  keyword_match: {
    purpose: "把配置好的关键词与清洗后的正文做匹配，帮助后续理解页面价值。",
    writes_to: "工作模式会写入 documents.matched_keywords。",
    common_failures: ["关键词配置缺失", "正文清洗不准导致命中偏少"],
    debug_hint: "如果命中为空，先不要急着怀疑模型，先看 clean_text 和关键词配置。"
  },
  llm_analysis: {
    purpose: "调用 DeepSeek 做摘要、分类和结构化分析。",
    writes_to: "工作模式会写入 llm_runs 和 insights。",
    common_failures: ["超时", "返回非 JSON", "fallback 被触发"],
    debug_hint: "看 raw_response、parsed_json、fallback_used 和 retry_count。"
  },
  json_structured: {
    purpose: "把清洗结果和 LLM 结果重新整理成标准结构，便于入库和前端展示。",
    writes_to: "工作模式会进入 insights、llm_runs，以及后续导出 JSON/Excel。",
    common_failures: ["字段不全", "分类字段不稳定", "用户分不清 raw 和 parsed"],
    debug_hint: "重点比较 input payload、parsed_json 和最终 summary 是否一致。"
  },
  database_upsert: {
    purpose: "把结果写入数据库或在学习模式里展示预演后的入库载荷。",
    writes_to: "sources / documents / insights / source_versions / llm_runs。",
    common_failures: ["字段映射不清", "用户误以为学习模式已经入正式库"],
    debug_hint: "学习模式默认只展示预演 payload；真正写库请回到工作模式。"
  }
  ,
  aggregate_display: {
    purpose: "把已经入库的结果组织成查询、展示、导出和消费页面可读格式。",
    writes_to: "工作模式最终会通过 briefing、jobs、trace、inspector、export 等页面读取展示。",
    common_failures: ["用户看不懂字段", "时间语义混乱", "把消费页误当成底层数据本身"],
    debug_hint: "如果这里看不懂，优先补说明和页面引导，而不是先改底层抓取和入库逻辑。"
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<LearnResponse>) {
  syncCompanies(loadCompanies());

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, company: "", url: "", steps: [], errors: [{ step_name: "request", message: "method_not_allowed" }] });
  }

  const body = req.body as {
    companyId?: string;
    url?: string;
    keywords?: string[];
    useCache?: boolean;
    forceRefresh?: boolean;
    cacheMaxAgeHours?: number;
  };

  if (!body.url) {
    return res.status(400).json({ ok: false, company: "", url: "", steps: [], errors: [{ step_name: "url_resolve", message: "missing_url" }] });
  }

  let normalizedUrl = body.url;
  try {
    normalizedUrl = new URL(body.url).toString();
  } catch {
    return res.status(400).json({ ok: false, company: "", url: body.url, steps: [], errors: [{ step_name: "url_resolve", message: "invalid_url_format" }] });
  }

  const companyDetails = body.companyId ? getCompanyDetails(body.companyId) : null;
  const companyName = companyDetails?.company.name || "学习模式临时案例";
  const keywords = body.keywords?.length ? body.keywords : companyDetails?.company.keywords || [];
  const steps: LearnStep[] = [];
  const errors: Array<{ step_name: string; message: string }> = [];

  const resolveStarted = nowMs();
  steps.push({
    step_name: "url_resolve",
    step_order: 1,
    status: "success",
    tool_name: "source resolver",
    module_name: "lib/search/searchUrls.ts",
    duration_ms: nowMs() - resolveStarted,
    input_json: {
      company_id: body.companyId ?? null,
      raw_url: body.url,
      requested_keywords: body.keywords ?? []
    },
    output_json: {
      normalized_url: normalizedUrl,
      company_name: companyName,
      resolved_keywords: keywords
    },
    explanation: explanations.url_resolve
  });

  const fetchStarted = nowMs();
  const crawl = await playwrightCrawl([normalizedUrl], {
    concurrency: 1,
    useCache: body.useCache ?? true,
    forceRefresh: body.forceRefresh ?? false,
    cacheMaxAgeHours: body.cacheMaxAgeHours ?? 24,
    timeoutMs: 30000
  });
  const page = crawl.pages[0];
  const crawlError = crawl.errors[0];
  steps.push({
    step_name: "page_fetch",
    step_order: 2,
    status: page ? "success" : "failed",
    tool_name: "Playwright + Chromium",
    module_name: "lib/crawl/playwrightCrawl.ts",
    duration_ms: nowMs() - fetchStarted,
    input_json: {
      url: normalizedUrl,
      useCache: body.useCache ?? true,
      forceRefresh: body.forceRefresh ?? false,
      cacheMaxAgeHours: body.cacheMaxAgeHours ?? 24
    },
    output_json: page
      ? {
          title: page.title,
          fetched_at: page.fetchedAt,
          checked_at: page.checkedAt,
          from_cache: page.fromCache ?? false,
          http_status: page.httpStatus ?? 200,
          html_length: page.html.length
        }
      : {
          errors: crawl.errors
        },
    error_message: crawlError?.message,
    explanation: explanations.page_fetch
  });

  if (!page) {
    errors.push({ step_name: "page_fetch", message: crawlError?.message || "page_fetch_failed" });
    return res.status(200).json({ ok: false, company: companyName, url: normalizedUrl, steps, errors });
  }

  const cleanStarted = nowMs();
  const htmlOutput = {
    title: page.title,
    html_length: page.html.length,
    http_status: page.httpStatus ?? 200,
    html_preview: page.html.slice(0, 1200)
  };
  steps.push({
    step_name: "html_capture",
    step_order: 3,
    status: "success",
    tool_name: "playwright page html",
    module_name: "lib/crawl/playwrightCrawl.ts",
    duration_ms: Math.max(1, nowMs() - cleanStarted),
    input_json: {
      source: "rendered_page"
    },
    output_json: htmlOutput,
    explanation: explanations.html_capture
  });

  const cleanResultStarted = nowMs();
  const cleaned = cleanText(page.html, keywords, normalizedUrl);
  steps.push({
    step_name: "clean_text",
    step_order: 4,
    status: "success",
    tool_name: "Readability + Cheerio",
    module_name: "lib/clean/cleanText.ts",
    duration_ms: nowMs() - cleanResultStarted,
    input_json: {
      title: page.title,
      html_length: page.html.length
    },
    output_json: {
      clean_text_preview: cleaned.text.slice(0, 1200),
      clean_text_length: cleaned.text.length,
      extracted_items: cleaned.extractedItems ?? [],
      canonical_url: cleaned.canonicalUrl ?? null,
      published_at: cleaned.publishedAt ?? null,
      page_kind: cleaned.pageKind ?? "detail",
      completeness_score: cleaned.completenessScore ?? 0
    },
    explanation: explanations.clean_text
  });

  const listStarted = nowMs();
  steps.push({
    step_name: "list_extract",
    step_order: 5,
    status: "success",
    tool_name: "custom list extractor",
    module_name: "lib/clean/cleanText.ts",
    duration_ms: nowMs() - listStarted,
    input_json: {
      page_title: page.title
    },
    output_json: {
      extracted_items: cleaned.extractedItems ?? [],
      extracted_count: cleaned.extractedItems?.length ?? 0
    },
    explanation: explanations.list_extract
  });

  const keywordStarted = nowMs();
  steps.push({
    step_name: "keyword_match",
    step_order: 6,
    status: "success",
    tool_name: "keyword matcher",
    module_name: "lib/clean/cleanText.ts",
    duration_ms: nowMs() - keywordStarted,
    input_json: {
      configured_keywords: keywords
    },
    output_json: {
      matched_keywords: cleaned.matchedKeywords
    },
    explanation: explanations.keyword_match
  });

  const llmStarted = nowMs();
  const llm = await deepSeekAnalyze({
    company: companyName,
    title: page.title,
    text: cleaned.text,
    keywords: cleaned.matchedKeywords
  });
  steps.push({
    step_name: "llm_analysis",
    step_order: 7,
    status: llm.status === "success" ? "success" : llm.fallback_used ? "fallback" : "failed",
    tool_name: `${llm.provider} / ${llm.model_name}`,
    module_name: "lib/analyze/deepSeek.ts",
    duration_ms: nowMs() - llmStarted,
    input_json: llm.input_payload,
    output_json: {
      summary: llm.summary,
      category: llm.category,
      insight_type: llm.insight_type,
      confidence: llm.confidence,
      parsed_json: llm.parsed_json,
      raw_response: llm.raw_response
    },
    error_message: llm.error_message,
    fallback_used: llm.fallback_used,
    explanation: explanations.llm_analysis
  });

  const structuredStarted = nowMs();
  steps.push({
    step_name: "json_structured",
    step_order: 8,
    status: "success",
    tool_name: "schema shaping",
    module_name: "pages/api/learn/run.ts",
    duration_ms: nowMs() - structuredStarted,
    input_json: {
      clean_text_length: cleaned.text.length,
      matched_keywords: cleaned.matchedKeywords,
      llm_status: llm.status
    },
    output_json: {
      clean_text: cleaned.text.slice(0, 800),
      extracted_items: cleaned.extractedItems ?? [],
      llm_summary: llm.summary,
      llm_category: llm.category,
      parsed_json: llm.parsed_json
    },
    explanation: explanations.json_structured
  });

  const dbStarted = nowMs();
  steps.push({
    step_name: "database_upsert",
    step_order: 9,
    status: "success",
    tool_name: "repository preview",
    module_name: "lib/db/repository.ts",
    duration_ms: nowMs() - dbStarted,
    input_json: {
      source_payload: {
        company: companyName,
        url: normalizedUrl,
        title: page.title,
        fetched_at: page.fetchedAt
      },
      document_payload: {
        clean_text_length: cleaned.text.length,
        matched_keywords: cleaned.matchedKeywords,
        extracted_items_count: cleaned.extractedItems?.length ?? 0
      },
      insight_payload: {
        summary: llm.summary,
        category: llm.category,
        confidence: llm.confidence
      }
    },
    output_json: {
      mode: "learning_preview_only",
      writes_if_work_mode: ["sources", "documents", "insights", "source_versions", "llm_runs"]
    },
    explanation: explanations.database_upsert
  });

  const aggregateStarted = nowMs();
  steps.push({
    step_name: "aggregate_display",
    step_order: 10,
    status: "success",
    tool_name: "ui aggregation",
    module_name: "pages/learn.tsx",
    duration_ms: nowMs() - aggregateStarted,
    input_json: {
      step_count: steps.length + 1,
      final_summary: llm.summary
    },
    output_json: {
      display_targets: ["learn", "jobs", "trace", "inspector", "excel export"]
    },
    explanation: explanations.aggregate_display
  });

  return res.status(200).json({
    ok: true,
    company: companyName,
    url: normalizedUrl,
    steps,
    final_result: {
      clean_text: cleaned.text,
      matched_keywords: cleaned.matchedKeywords,
      extracted_items: cleaned.extractedItems ?? [],
      llm
    },
    errors
  });
}
