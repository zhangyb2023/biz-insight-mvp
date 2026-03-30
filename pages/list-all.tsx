import Head from "next/head";
import { useState, useEffect, useMemo } from "react";

type ListItem = {
  company_name: string;
  title: string;
  url: string;
  fetch_date: string;
  published_at: string | null;
  summary: string | null;
  insight_type: string | null;
  category: string | null;
  completeness_score: number | null;
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

const CATEGORIES = ["全部", "产品技术", "生态合作", "战略动向", "政策法规", "人才动态"] as const;
const TIME_FILTERS = [
  { key: "all", label: "全选" },
  { key: "published", label: "发布时间" },
  { key: "fetched", label: "爬取时间" }
] as const;

type TimeFilterKey = typeof TIME_FILTERS[number]["key"];
type SortOrder = "desc" | "asc";
type ShowMode = "valid" | "all";

const MIN_INSIGHT_DATE = "2026-01-01";

function translateCategory(cat: string): string {
  const map: Record<string, string> = {
    "product": "产品技术",
    "technology": "产品技术",
    "tech": "产品技术",
    "ecosystem": "生态合作",
    "strategy": "战略动向",
    "strategic": "战略动向",
    "policy": "政策法规",
    "regulation": "政策法规",
    "jobs": "人才动态",
    "talent": "人才动态",
    "recruitment": "人才动态",
    "news": "战略动向",
    "general": "战略动向",
  };
  return map[cat?.toLowerCase()] || cat || "战略动向";
}

function translateToChinese(text: string): string {
  if (!text) return "";
  const translations: Record<string, string> = {
    "AI meets safety": "AI与安全",
    "open source meets automotive": "开源与汽车",
    "showcases": "展示",
    "development solutions": "开发解决方案",
    "next generation": "下一代",
    "vehicles": "汽车",
    "embedded world": "嵌入式世界大会",
    "focusing on": "聚焦",
    "safety-critical": "安全关键",
    "applications": "应用",
    "automotive software": "汽车软件",
    "AUTOSAR Classic": "AUTOSAR Classic",
    "cybersecurity": "网络安全",
    "compliance": "合规",
    "EU Cyber Resilience Act": "欧盟网络弹性法案",
    "product launch": "产品发布",
    "collaboration": "合作",
    "partnership": "伙伴",
    "strategic": "战略",
    "awards": "获奖",
    "innovation": "创新",
    "accelerated": "加速",
    "efficiency": "效率",
    "release": "发布",
    "contributed": "贡献",
    "latest": "最新",
    "collaborated with": "与...合作",
    "achieving": "实现",
  };
  let result = text;
  for (const [en, zh] of Object.entries(translations)) {
    result = result.replace(new RegExp(en, 'gi'), zh);
  }
  return result;
}

function isEnglish(text: string): boolean {
  if (!text) return false;
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  return chineseChars < text.length * 0.2;
}

function formatDate(dateStr: string | null, showTime: boolean = false): string {
  if (!dateStr) return "未知";
  try {
    const d = new Date(dateStr);
    if (showTime) {
      return d.toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return d.toLocaleDateString("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return String(dateStr).slice(0, 10);
  }
}

function isValidInsight(item: ListItem): boolean {
  if (!item.published_at || !item.published_at.trim()) return false;
  const dateStr = item.published_at.split('T')[0];
  return dateStr >= MIN_INSIGHT_DATE;
}

export default function ListAllPage() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string>("全部");
  const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilterKey>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showMode, setShowMode] = useState<ShowMode>("valid");
  const [loading, setLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState<string>("");

  useEffect(() => {
    fetch("/api/all-items")
      .then(res => res.json())
      .then(data => {
        setItems(data.items || []);
        setTotalCount(data.totalCount || 0);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const hasDateFilter = dateFrom || dateTo;

  const clearDateFilter = () => {
    setDateFrom("");
    setDateTo("");
  };

  // 有效洞察（有发布时间且在阈值日期后）
  const validInsightItems = useMemo(() => {
    return items.filter(item => isValidInsight(item));
  }, [items]);

  const allItemsCount = items.length;
  const validItemsCount = validInsightItems.length;

  // 日期过滤后的items
  const dateFilteredItems = useMemo(() => {
    let result = showMode === "valid" ? [...validInsightItems] : [...items];
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      result = result.filter(item => {
        const dateToCheck = item.published_at || item.fetch_date;
        if (!dateToCheck) return false;
        return new Date(dateToCheck) >= fromDate;
      });
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(item => {
        const dateToCheck = item.published_at || item.fetch_date;
        if (!dateToCheck) return false;
        return new Date(dateToCheck) <= toDate;
      });
    }
    
    return result;
  }, [items, validInsightItems, showMode, dateFrom, dateTo]);

  // 分类统计
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { "全部": dateFilteredItems.length };
    for (const cat of CATEGORIES) {
      if (cat !== "全部") {
        counts[cat] = dateFilteredItems.filter(item => 
          translateCategory(item.category || item.insight_type || "") === cat
        ).length;
      }
    }
    return counts;
  }, [dateFilteredItems]);

  // 时间类型统计
  const timeFilterCounts = useMemo(() => ({
    all: dateFilteredItems.length,
    published: dateFilteredItems.filter(item => item.published_at).length,
    fetched: dateFilteredItems.filter(item => !item.published_at).length,
  }), [dateFilteredItems]);

  // 最终排序后的过滤结果
  const filteredItems = useMemo(() => {
    let result = [...dateFilteredItems];

    // 分类过滤
    if (activeCategory !== "全部") {
      result = result.filter(item => {
        const itemCat = translateCategory(item.category || item.insight_type || "");
        return itemCat === activeCategory;
      });
    }

    // 公司过滤
    if (companyFilter.trim()) {
      const query = companyFilter.trim().toLowerCase();
      result = result.filter(item => 
        item.company_name?.toLowerCase().includes(query)
      );
    }

    // 时间过滤
    if (activeTimeFilter === "published") {
      result = result.filter(item => item.published_at);
    } else if (activeTimeFilter === "fetched") {
      result = result.filter(item => !item.published_at);
    }

    result.sort((a, b) => {
      const dateA = new Date(a.published_at || a.fetch_date).getTime();
      const dateB = new Date(b.published_at || b.fetch_date).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [dateFilteredItems, activeTimeFilter, activeCategory, sortOrder, companyFilter]);

  const resetFilters = () => {
    setActiveCategory("全部");
    setActiveTimeFilter("all");
    setSortOrder("desc");
    setCompanyFilter("");
    clearDateFilter();
  };

  const isDefaultState = activeCategory === "全部" && activeTimeFilter === "all" && sortOrder === "desc" && !hasDateFilter && !companyFilter;

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-3xl font-bold text-ink">动态信息列表</h1>
        <p className="mt-4 text-slate-500">加载中...</p>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>动态信息列表 | Biz Insight</title>
      </Head>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-ink">动态信息列表</h1>
              <p className="mt-2 text-sm text-slate-500">
                共 {totalCount} 条 | 有效洞察 {validItemsCount} 条 | 当前筛选 {filteredItems.length} 条
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!isDefaultState && (
                <button
                  onClick={resetFilters}
                  className="rounded-full bg-red-100 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-200"
                >
                  重置全部筛选
                </button>
              )}
              <a href="/" className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm hover:bg-slate-100">
                返回首页
              </a>
            </div>
          </div>
        </header>

        <section className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-violet-700">显示模式：</span>
              <button
                onClick={() => setShowMode("valid")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  showMode === "valid"
                    ? "bg-violet-600 text-white"
                    : "bg-white text-violet-700 hover:bg-violet-100"
                }`}
              >
                有效洞察 ({validItemsCount} 条)
              </button>
              <button
                onClick={() => setShowMode("all")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  showMode === "all"
                    ? "bg-violet-600 text-white"
                    : "bg-white text-violet-700 hover:bg-violet-100"
                }`}
              >
                全部信息 ({allItemsCount} 条)
              </button>
            </div>
            <p className="text-xs text-violet-600">
              有效洞察 = 有发布时间且 ≥ {MIN_INSIGHT_DATE}
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">排序：</span>
              <button
                onClick={() => setSortOrder("desc")}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  sortOrder === "desc"
                    ? "bg-moss text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                最新优先 ↓
              </button>
              <button
                onClick={() => setSortOrder("asc")}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  sortOrder === "asc"
                    ? "bg-moss text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                最早优先 ↑
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">公司：</span>
              <input
                type="text"
                value={companyFilter}
                onChange={e => setCompanyFilter(e.target.value)}
                placeholder="输入公司名称"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-36"
              />
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">日期筛选：</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              />
              <span className="text-slate-400">至</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              />
              {hasDateFilter && (
                <button
                  onClick={clearDateFilter}
                  className="rounded-full bg-red-100 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-200"
                >
                  清除
                </button>
              )}
            </div>
          </div>
        </section>

        <nav className="mb-4 flex flex-wrap gap-2">
          {TIME_FILTERS.map(filter => (
            <button
              key={filter.key}
              onClick={() => setActiveTimeFilter(filter.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeTimeFilter === filter.key
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {filter.label} ({timeFilterCounts[filter.key]})
            </button>
          ))}
        </nav>

        <nav className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-moss text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat} ({categoryCounts[cat] || 0})
            </button>
          ))}
        </nav>

        <section className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
              暂无数据
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const cat = translateCategory(item.category || item.insight_type || "");
              const enSummary = item.summary && isEnglish(item.summary);
              const displayTitle = enSummary ? translateToChinese(item.title) : item.title;
              const displaySummary = item.summary 
                ? (enSummary ? translateToChinese(item.summary) : item.summary)
                : "无摘要";
              const hasPublishedTime = !!item.published_at;
              const isItemValid = isValidInsight(item);

              return (
                <article
                  key={`${item.url}-${idx}`}
                  className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      cat === "产品" ? "bg-blue-100 text-blue-700" :
                      cat === "技术" ? "bg-purple-100 text-purple-700" :
                      cat === "生态" ? "bg-green-100 text-green-700" :
                      cat === "招聘" ? "bg-orange-100 text-orange-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {cat}
                    </span>
                    <span className="font-semibold text-ink">{item.company_name}</span>
                    <span className="text-slate-400">·</span>
                    {hasPublishedTime ? (
                      <span className={isItemValid ? "text-emerald-600" : "text-amber-600"}>
                        <span className="text-xs opacity-60">发布于 </span>
                        <time>{formatDate(item.published_at)}</time>
                        {!isItemValid && (
                          <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">早于阈值</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        <span className="text-xs opacity-60">待确认 </span>
                        <time>{formatDate(item.fetch_date)}</time>
                      </span>
                    )}
                    {enSummary && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">英</span>
                    )}
                    {item.completeness_score !== null && (
                      <span className={`text-xs ${
                        item.completeness_score >= 0.60 ? "text-green-600" :
                        item.completeness_score >= 0.50 ? "text-yellow-600" :
                        "text-red-600"
                      }`}>
                        {Math.round(item.completeness_score * 100)}%
                      </span>
                    )}
                  </div>

                  <h2 className="mb-2 text-base font-semibold leading-snug text-ink">
                    {displayTitle}
                  </h2>

                  <p className={`text-sm leading-relaxed ${enSummary ? "text-slate-500 italic" : "text-slate-600"}`}>
                    {displaySummary.length > 200 ? displaySummary.slice(0, 200) + "..." : displaySummary}
                  </p>

                  <div className="mt-3">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-moss hover:underline"
                    >
                      查看原文 →
                    </a>
                  </div>
                </article>
              );
            })
          )}
        </section>

        <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-sm text-slate-400">
          <p>数据来源：各公司官网 | 有效洞察阈值：{MIN_INSIGHT_DATE} 及之后</p>
        </footer>
      </main>
    </>
  );
}