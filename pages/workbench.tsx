import Head from "next/head";
import type { GetServerSideProps } from "next";
import { useMemo, useState, useCallback, useRef } from "react";

import { formatShanghaiDateTime } from "@/lib/format";
import { getSourceManagerData } from "@/lib/db/repository";

type Props = ReturnType<typeof getSourceManagerData>;

type CompanyResult = {
  companyId: string;
  companyName: string;
  successCount: number;
  failureCount: number;
  cacheHitCount: number;
  changedCount: number;
  insightCount: number;
  status: "pending" | "running" | "success" | "failed";
  error?: string;
};

type CrawlResult = {
  companies: CompanyResult[];
  totalSuccess: number;
  totalFailure: number;
  totalCacheHit: number;
  totalChanged: number;
  totalInsight: number;
  durationMs: number;
};

const sourceTypeLabels: Record<string, { label: string; color: string; bgColor: string }> = {
  official: { label: "官方网站", color: "text-blue-700", bgColor: "bg-blue-100" },
  media: { label: "媒体网站", color: "text-emerald-700", bgColor: "bg-emerald-100" },
  professional: { label: "专业机构", color: "text-violet-700", bgColor: "bg-violet-100" },
  general: { label: "综合网站", color: "text-slate-700", bgColor: "bg-slate-100" }
};

function getSourceTypeFromUrl(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes("news") || urlLower.includes("press") || urlLower.includes("media") || 
      urlLower.includes("blog") || urlLower.includes("article")) {
    return "media";
  }
  if (urlLower.includes("partner") || urlLower.includes("ecosystem") || urlLower.includes("community") ||
      urlLower.includes("developer")) {
    return "professional";
  }
  if (urlLower.includes("product") || urlLower.includes("solution")) {
    return "official";
  }
  return "general";
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  return {
    props: getSourceManagerData()
  };
};

export default function WorkbenchPage(props: Props) {
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [crawlMode, setCrawlMode] = useState<"check" | "crawl">("crawl");
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const cancelRef = useRef(false);

  const companiesWithSources = useMemo(() => {
    return props.companies.map(company => {
      const companySources = props.sources.filter(s => s.company_id === company.id);
      const sourceTypes = new Set<string>();
      companySources.forEach(s => {
        sourceTypes.add(getSourceTypeFromUrl(s.url));
      });
      return {
        ...company,
        sourceCount: companySources.length,
        sourceTypes: Array.from(sourceTypes),
        sources: companySources
      };
    }).filter(c => c.sourceCount > 0);
  }, [props.companies, props.sources]);

  const groupedByType = useMemo(() => {
    const groups: Record<string, typeof companiesWithSources> = {
      official: [],
      media: [],
      professional: [],
      general: []
    };
    companiesWithSources.forEach(company => {
      if (company.sourceTypes.includes("official")) {
        groups.official.push(company);
      } else if (company.sourceTypes.includes("media")) {
        groups.media.push(company);
      } else if (company.sourceTypes.includes("professional")) {
        groups.professional.push(company);
      } else {
        groups.general.push(company);
      }
    });
    return groups;
  }, [companiesWithSources]);

  const toggleExpand = useCallback((companyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCompanyId(prev => prev === companyId ? null : companyId);
  }, []);

  const selectCompany = useCallback((companyId: string) => {
    if (isRunning) return;
    setSelectedCompanyIds(prev => 
      prev.includes(companyId) 
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
    setExpandedCompanyId(null);
  }, [isRunning]);

  const selectAll = useCallback((type?: string) => {
    if (isRunning) return;
    const toSelect = type 
      ? groupedByType[type].map(c => c.id)
      : companiesWithSources.map(c => c.id);
    setSelectedCompanyIds(toSelect);
  }, [isRunning, groupedByType, companiesWithSources]);

  const clearSelection = useCallback(() => {
    if (isRunning) return;
    setSelectedCompanyIds([]);
    setExpandedCompanyId(null);
    setCrawlResult(null);
  }, [isRunning]);

  async function runCrawl() {
    if (selectedCompanyIds.length === 0) {
      return;
    }

    setIsRunning(true);
    setCrawlResult(null);
    setProcessedCount(0);
    cancelRef.current = false;

    const companiesToProcess = [...selectedCompanyIds];

    const results: CompanyResult[] = [];
    let totalSuccess = 0;
    let totalFailure = 0;
    let totalCacheHit = 0;
    let totalChanged = 0;
    let totalInsight = 0;
    const startTime = Date.now();

    try {
      for (let i = 0; i < companiesToProcess.length; i++) {
        if (cancelRef.current) break;

        const companyId = companiesToProcess[i];
        const company = companiesWithSources.find(c => c.id === companyId);
        
        setCurrentCompanyId(companyId);
        
        const companyResult: CompanyResult = {
          companyId,
          companyName: company?.name || companyId,
          successCount: 0,
          failureCount: 0,
          cacheHitCount: 0,
          changedCount: 0,
          insightCount: 0,
          status: "running"
        };

        try {
          const response = await fetch("/api/crawl", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companyId,
              useCache: crawlMode === "check",
              forceRefresh: crawlMode === "crawl",
              cacheMaxAgeHours: 24
            })
          });

          const data = await response.json();
          
          if (data.ok) {
            companyResult.successCount = data.successCount || 0;
            companyResult.failureCount = data.failureCount || 0;
            companyResult.cacheHitCount = data.cacheHitCount || 0;
            companyResult.changedCount = data.changedCount || 0;
            companyResult.insightCount = data.insightCount || 0;
            companyResult.status = "success";
            
            totalSuccess += companyResult.successCount;
            totalFailure += companyResult.failureCount;
            totalCacheHit += companyResult.cacheHitCount;
            totalChanged += companyResult.changedCount;
            totalInsight += companyResult.insightCount;
          } else {
            companyResult.status = "failed";
            companyResult.error = data.error || "未知错误";
            totalFailure += 1;
          }
        } catch (err) {
          companyResult.status = "failed";
          companyResult.error = err instanceof Error ? err.message : String(err);
          totalFailure += 1;
        }

        results.push(companyResult);
        setProcessedCount(i + 1);
        setCrawlResult({
          companies: [...results],
          totalSuccess,
          totalFailure,
          totalCacheHit,
          totalChanged,
          totalInsight,
          durationMs: Date.now() - startTime
        });
      }
    } finally {
      setIsRunning(false);
      setCurrentCompanyId(null);
    }
  }

  const selectedCompanies = selectedCompanyIds
    .map(id => companiesWithSources.find(c => c.id === id))
    .filter(Boolean);

  return (
    <>
      <Head>
        <title>工作台 | Biz Insight MVP</title>
      </Head>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-moss">Workbench</p>
            <h1 className="mt-2 text-4xl font-semibold text-ink">工作台</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              选择公司执行智能爬取，支持单选和多选，实时显示进度和关键指标。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/learn" className="rounded-full border border-sky-200 bg-white px-5 py-3 text-sm font-semibold text-sky-700">
              智能爬虫系统
            </a>
            <a href="/jobs" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
              任务中心
            </a>
            <a href="/" className="rounded-full bg-moss px-5 py-3 text-sm font-semibold text-white">
              返回首页
            </a>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => selectAll()}
                disabled={isRunning}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                全选 ({companiesWithSources.length})
              </button>
              <button
                onClick={clearSelection}
                disabled={isRunning || selectedCompanyIds.length === 0}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                清空选择
              </button>
              {Object.entries(groupedByType).filter(([_, companies]) => companies.length > 0).map(([type, companies]) => (
                <button
                  key={type}
                  onClick={() => selectAll(type)}
                  disabled={isRunning}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                >
                  {sourceTypeLabels[type]?.label} ({companies.length})
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={crawlMode === "check"}
                  onChange={() => setCrawlMode("check")}
                  disabled={isRunning}
                  className="text-moss"
                />
                <span className="text-slate-700">检查模式</span>
              </label>
              <label className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={crawlMode === "crawl"}
                  onChange={() => setCrawlMode("crawl")}
                  disabled={isRunning}
                  className="text-amber-600"
                />
                <span className="text-amber-700">爬取模式</span>
              </label>
            </div>
          </div>

          {selectedCompanyIds.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-moss/10 px-4 py-2 text-sm text-moss">
                已选择 {selectedCompanyIds.length} 个公司
              </span>
              <button
                onClick={clearSelection}
                disabled={isRunning}
                className="rounded-full border border-moss/30 bg-white px-4 py-2 text-sm text-moss hover:bg-moss/5 disabled:opacity-50"
              >
                清空
              </button>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button
              onClick={runCrawl}
              disabled={isRunning || selectedCompanyIds.length === 0}
              className="rounded-full bg-moss px-8 py-3 text-base font-semibold text-white disabled:opacity-50"
            >
              {isRunning 
                ? `正在${crawlMode === "check" ? "检查" : "爬取"}...` 
                : `${crawlMode === "check" ? "检查" : "爬取"}选中公司 (${selectedCompanyIds.length})`}
            </button>
            {selectedCompanyIds.length === 0 && !isRunning && (
              <span className="text-sm text-slate-500">请从下方选择公司（可多选）</span>
            )}
          </div>
        </section>

        {isRunning && (
          <section className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-700">执行进度</p>
                <p className="mt-1 text-sm text-blue-600">
                  正在处理: {currentCompanyId} ({processedCount}/{selectedCompanyIds.length})
                </p>
              </div>
              <span className="text-3xl font-bold text-blue-700">
                {Math.round((processedCount / selectedCompanyIds.length) * 100)}%
              </span>
            </div>
            <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-blue-200">
              <div 
                className="h-full rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(processedCount / selectedCompanyIds.length) * 100}%` }}
              />
            </div>
            {crawlResult && crawlResult.companies.length > 0 && (
              <div className="mt-4 space-y-2">
                {crawlResult.companies.map((company, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                    {company.status === "running" && (
                      <span className="h-2 w-2 animate-spin rounded-full bg-blue-500" />
                    )}
                    {company.status === "success" && (
                      <span className="text-emerald-600">✓</span>
                    )}
                    {company.status === "failed" && (
                      <span className="text-red-600">✗</span>
                    )}
                    <span className="font-medium">{company.companyName}</span>
                    {company.status === "running" && <span className="text-slate-500">处理中...</span>}
                    {company.status === "success" && (
                      <span className="text-slate-500">
                        成功 {company.successCount} | 失败 {company.failureCount} | 缓存 {company.cacheHitCount}
                      </span>
                    )}
                    {company.status === "failed" && (
                      <span className="text-red-500">{company.error}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {crawlResult && !isRunning && (
          <section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
            <h2 className="text-lg font-semibold text-emerald-800">执行结果</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-white p-4 text-center">
                <p className="text-3xl font-bold text-emerald-600">{crawlResult.totalSuccess}</p>
                <p className="text-sm text-slate-600">成功</p>
              </div>
              <div className="rounded-2xl bg-white p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{crawlResult.totalFailure}</p>
                <p className="text-sm text-slate-600">失败</p>
              </div>
              <div className="rounded-2xl bg-white p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{crawlResult.totalCacheHit}</p>
                <p className="text-sm text-slate-600">缓存命中</p>
              </div>
              <div className="rounded-2xl bg-white p-4 text-center">
                <p className="text-3xl font-bold text-violet-600">{crawlResult.totalInsight}</p>
                <p className="text-sm text-slate-600">洞察生成</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 text-center">
                <p className="text-2xl font-bold text-slate-700">{crawlResult.companies.length}</p>
                <p className="text-sm text-slate-600">处理公司数</p>
              </div>
              <div className="rounded-2xl bg-white p-4 text-center">
                <p className="text-2xl font-bold text-slate-700">{crawlResult.durationMs}ms</p>
                <p className="text-sm text-slate-600">总耗时</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {crawlResult.companies.map((company, idx) => (
                <div key={idx} className="flex items-center gap-3 rounded-lg bg-white px-4 py-3">
                  <span className={company.status === "success" ? "text-emerald-600" : "text-red-600"}>
                    {company.status === "success" ? "✓" : "✗"}
                  </span>
                  <span className="font-medium">{company.companyName}</span>
                  <span className="text-sm text-slate-500">
                    成功 {company.successCount} | 失败 {company.failureCount} | 缓存 {company.cacheHitCount} | 洞察 {company.insightCount}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href="/jobs" className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white">
                查看任务中心
              </a>
              <a href="/errors" className="rounded-full border border-red-200 bg-white px-5 py-2 text-sm font-semibold text-red-600">
                查看错误
              </a>
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-ink">公司列表</h2>
          <p className="mt-1 text-sm text-slate-600">点击公司卡片可选中，点击展开按钮可查看网址详情</p>
          
          {(["official", "media", "professional", "general"] as const).map(type => {
            const companies = groupedByType[type];
            if (companies.length === 0) return null;
            const meta = sourceTypeLabels[type];
            
            return (
              <div key={type} className="mt-6">
                <h3 className={`inline-flex items-center gap-2 rounded-full ${meta.bgColor} px-4 py-2 text-sm font-semibold ${meta.color}`}>
                  {meta.label}
                  <span className="text-xs opacity-60">({companies.length})</span>
                </h3>
                <div className="mt-3 space-y-3">
                  {companies.map(company => {
                    const isSelected = selectedCompanyIds.includes(company.id);
                    const isExpanded = expandedCompanyId === company.id;
                    
                    return (
                      <div key={company.id}>
                        <article
                          onClick={() => selectCompany(company.id)}
                          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                            isSelected 
                              ? "border-moss bg-moss/5 shadow-md" 
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className={`h-3 w-3 rounded-full border-2 ${
                                  isSelected 
                                    ? "border-moss bg-moss" 
                                    : "border-slate-300"
                                }`} />
                                <h4 className="text-base font-semibold text-ink truncate">{company.name}</h4>
                              </div>
                              <p className="mt-1 text-xs text-slate-500 truncate">{company.website}</p>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {company.sourceTypes.map(t => (
                                  <span key={t} className={`rounded-full px-2 py-0.5 text-xs ${sourceTypeLabels[t]?.bgColor} ${sourceTypeLabels[t]?.color}`}>
                                    {sourceTypeLabels[t]?.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="rounded-full bg-slate-100 px-3 py-1 text-center">
                                <span className="text-lg font-bold text-slate-700">{company.sourceCount}</span>
                                <p className="text-xs text-slate-500">网址</p>
                              </div>
                              <button
                                onClick={(e) => toggleExpand(company.id, e)}
                                className={`rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold transition-all ${
                                  isExpanded ? "bg-moss text-white border-moss" : "text-slate-700"
                                }`}
                              >
                                {isExpanded ? "收起" : "展开"}
                              </button>
                            </div>
                          </div>
                        </article>

                        {isExpanded && (
                          <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <h5 className="text-sm font-semibold text-ink mb-3">网址列表</h5>
                            <div className="space-y-2">
                              {company.sources.map((source) => {
                                const urlType = getSourceTypeFromUrl(source.url);
                                return (
                                  <div key={source.id} className="flex items-start gap-3 rounded-xl bg-white p-3">
                                    <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs ${sourceTypeLabels[urlType]?.bgColor} ${sourceTypeLabels[urlType]?.color}`}>
                                      {sourceTypeLabels[urlType]?.label}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="break-all text-sm text-ink">{source.url}</p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        关键词: {source.keywords.join(", ") || "无"} | 最后检查: {formatShanghaiDateTime(source.last_checked_at)}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  runCrawl();
                                }}
                                disabled={isRunning}
                                className="rounded-full bg-moss px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                爬取该公司
                              </button>
                              <a
                                href={`/company/${company.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                              >
                                查看公司详情
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </>
  );
}