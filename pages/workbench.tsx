import Head from "next/head";
import type { GetServerSideProps } from "next";
import { useMemo, useState, useCallback, useRef } from "react";

import { formatShanghaiDateTime } from "@/lib/format";
import { getSourceManagerData } from "@/lib/db/repository";

const STRATEGY_PATTERNS: { name: string; displayName: string; patterns: RegExp[] }[] = [
  {
    name: "gasgoo_flash",
    displayName: "盖世快讯",
    patterns: [/auto\.gasgoo\.com\/newsflash\/flashnews/i]
  },
  {
    name: "autosar_news",
    displayName: "AUTOSAR新闻",
    patterns: [/www\.autosar\.org\/news-events/i]
  },
  {
    name: "thundersoft_news",
    displayName: "中科创达新闻",
    patterns: [/www\.thundersoft\.com\/category\/newsroom/i]
  },
  {
    name: "huawei_auto_news",
    displayName: "华为乾崑新闻",
    patterns: [/auto\.huawei\.com\/cn\/news/i]
  },
  {
    name: "hirain_news",
    displayName: "经纬恒润新闻",
    patterns: [/www\.hirain\.com\/news\/企业新闻/i, /www\.hirain\.com\/news\/%E4%BC%81%E4%B8%9A%E6%96%B0%E9%97%BB/i]
  },
  {
    name: "reachauto_news",
    displayName: "东软睿驰新闻",
    patterns: [
      /www\.reachauto\.com\/corporate-news\/industry-activities/i,
      /www\.reachauto\.com\/corporate-news\/ecological-alliance/i,
      /www\.reachauto\.com\/corporate-news\/product-technology/i
    ]
  },
  {
    name: "etas_news",
    displayName: "ETAS新闻",
    patterns: [
      /www\.etas\.com\/ww\/en\/about-etas\/newsroom/i
    ]
  },
  {
    name: "vector_news",
    displayName: "Vector活动",
    patterns: [
      /www\.vector\.com\/.*\/events\/overview/i
    ]
  },
  {
    name: "semidrive_news",
    displayName: "芯驰科技新闻",
    patterns: [
      /www\.semidrive\.com\/news/i
    ]
  },
  {
    name: "elektrobit_news",
    displayName: "Elektrobit新闻",
    patterns: [
      /www\.elektrobit\.com\/newsroom/i
    ]
  },
  {
    name: "blacksesame_news",
    displayName: "黑芝麻智能新闻",
    patterns: [
      /www\.blacksesame\.com\/zh\/news-center/i
    ]
  },
  {
    name: "tttech_auto_news",
    displayName: "TTTech Auto新闻",
    patterns: [
      /www\.tttech-auto\.com\/newsroom/i
    ]
  }
];

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

function urlTypeToCategory(urlType: string): string {
  if (urlType === "news") return "media";
  if (urlType === "ecosystem") return "professional";
  if (urlType === "product") return "official";
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
  const [strategyRunning, setStrategyRunning] = useState<string | null>(null);

  const companiesWithSources = useMemo(() => {
    return props.companies.map(company => {
      const companySources = props.sources.filter(s => s.company_id === company.id);
      const sourceTypes = new Set<string>();
      companySources.forEach(s => {
        sourceTypes.add(urlTypeToCategory(s.url_type || "general"));
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
      const companyType = company.company_type || "general";
      groups[companyType].push(company);
    });
    return groups;
  }, [companiesWithSources]);

  const toggleExpand = useCallback((companyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCompanyId(prev => prev === companyId ? null : companyId);
  }, []);

  const selectCompany = useCallback((companyId: string) => {
    setSelectedCompanyIds(prev => 
      prev.includes(companyId) 
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
    setExpandedCompanyId(null);
  }, []);

  const selectAll = useCallback((type?: string) => {
    const toSelect = type 
      ? groupedByType[type].map(c => c.id)
      : companiesWithSources.map(c => c.id);
    setSelectedCompanyIds(toSelect);
  }, [groupedByType, companiesWithSources]);

  const clearSelection = useCallback(() => {
    setSelectedCompanyIds([]);
    setExpandedCompanyId(null);
  }, []);

  const runStrategyCrawl = useCallback(async (companyId: string, strategyName: string, url: string) => {
    setStrategyRunning(strategyName);
    try {
      const response = await fetch("/api/strategy/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, strategyName, pages: [1, 2, 3] })
      });
      const data = await response.json();
      if (data.success) {
        alert(`${strategyName} 爬取成功！\n提取了 ${data.data.extractedItems?.length || 0} 条信息`);
      } else {
        alert(`爬取失败: ${data.error}`);
      }
    } catch (err) {
      alert(`爬取失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setStrategyRunning(null);
    }
  }, []);

  const selectedCompanies = selectedCompanyIds
    .map(id => companiesWithSources.find(c => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

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
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                全选 ({companiesWithSources.length})
              </button>
              <button
                onClick={clearSelection}
                disabled={selectedCompanyIds.length === 0}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                清空选择
              </button>
              {Object.entries(groupedByType).filter(([_, companies]) => companies.length > 0).map(([type, companies]) => (
                <button
                  key={type}
                  onClick={() => selectAll(type)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  {sourceTypeLabels[type]?.label} ({companies.length})
                </button>
              ))}
            </div>
          </div>

          {selectedCompanyIds.length > 0 && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="rounded-full bg-moss/10 px-4 py-2 text-sm text-moss">
                  已选择 {selectedCompanyIds.length} 个公司
                </span>
                <button
                  onClick={clearSelection}
                  className="rounded-full border border-moss/30 bg-white px-4 py-2 text-sm text-moss hover:bg-moss/5"
                >
                  清空
                </button>
              </div>
              
              <div className="space-y-3">
                {selectedCompanies.map(company => {
                  const matchedStrategies = STRATEGY_PATTERNS.filter(strategy => 
                    company.sources.some(source => 
                      strategy.patterns.some(pattern => pattern.test(source.url))
                    )
                  );
                  
                  if (matchedStrategies.length === 0) return null;
                  
                  return (
                    <div key={company.id} className="rounded-2xl border border-moss/20 bg-moss/5 p-4">
                      <h4 className="text-sm font-semibold text-moss mb-2">{company.name}</h4>
                      <div className="flex gap-2 flex-wrap">
                        {matchedStrategies.map(strategy => {
                          const matchedUrl = company.sources.find(s => 
                            strategy.patterns.some(pattern => pattern.test(s.url))
                          )?.url;
                          return (
                            <button
                              key={strategy.name}
                              onClick={() => {
                                if (matchedUrl) {
                                  runStrategyCrawl(company.id, strategy.name, matchedUrl);
                                }
                              }}
                              disabled={strategyRunning === strategy.name}
                              className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              {strategyRunning === strategy.name ? "爬取中..." : strategy.displayName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

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
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="rounded-full bg-slate-100 px-3 py-1 text-center">
                                <span className="text-lg font-bold text-slate-700">{company.sourceCount}</span>
                                <p className="text-xs text-slate-500">网址</p>
                              </div>
                              {company.lastCrawlAt && (
                                <div className="rounded-full bg-amber-50 px-3 py-1 text-center">
                                  <span className="text-sm font-medium text-amber-700">
                                    {formatShanghaiDateTime(company.lastCrawlAt)}
                                  </span>
                                  <p className="text-xs text-amber-600">最近爬取</p>
                                </div>
                              )}
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
                            <div className="mt-4 flex gap-2 flex-wrap">
                              <a
                                href={`/company/${company.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                              >
                                查看爬取详情
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