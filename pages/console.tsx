import Head from "next/head";
import type { GetServerSideProps } from "next";
import { useMemo, useState } from "react";

import { getSourceManagerData } from "@/lib/db/repository";
import { formatShanghaiDateTime } from "@/lib/format";
import type { UrlType } from "@/lib/types";

type Props = ReturnType<typeof getSourceManagerData>;

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

const companyTypeOptions = [
  { value: "official", label: "官方" },
  { value: "media", label: "媒体" },
  { value: "professional", label: "专业机构" },
  { value: "general", label: "综合" }
];

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  return {
    props: getSourceManagerData()
  };
};

export default function ConsolePage(props: Props) {
  const [currentCompanies, setCurrentCompanies] = useState(props.companies);
  const [currentSources, setCurrentSources] = useState(props.sources);
  
  const [selectedCompanyId, setSelectedCompanyId] = useState(props.companies[0]?.id || "");
  const [url, setUrl] = useState("");
  const [urlType, setUrlType] = useState<UrlType>("general");
  const [keywords, setKeywords] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyKeywords, setCompanyKeywords] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [disablingCompanyId, setDisablingCompanyId] = useState<string | null>(null);
  const [restoringCompanyId, setRestoringCompanyId] = useState<string | null>(null);

  const companiesWithSources = useMemo(() => {
    return currentCompanies.map(company => {
      const companySources = currentSources.filter(s => s.company_id === company.id);
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
  }, [currentCompanies, currentSources]);

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

  const inactiveCompanies = useMemo(() => {
    return currentCompanies.filter(c => c.is_active === false);
  }, [currentCompanies]);

  async function handleCreateSource() {
    if (!selectedCompanyId || !url.trim()) {
      setMessage("请选择公司并填写网址");
      return;
    }

    const trimmedKeywords = keywords.split(",").map(k => k.trim()).filter(Boolean);

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedCompanyId,
          url: url.trim(),
          urlType,
          keywords: trimmedKeywords,
          priority: 100,
          cacheTtlHours: 24,
          allowCache: true
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage(`新增失败: ${data.error || "未知错误"}`);
        return;
      }
      setCurrentSources(prev => [...prev, { ...data.record, keywords: trimmedKeywords }]);
      setUrl("");
      setKeywords("");
      setMessage("新增成功，实时同步到工作台");
    } catch (err) {
      setMessage(`新增失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSource(id: number) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/sources/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage(`删除失败: ${data.error || "未知错误"}`);
        return;
      }
      setCurrentSources(prev => prev.filter(s => s.id !== id));
      setMessage("删除成功");
    } catch (err) {
      setMessage(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreateCompany() {
    if (!companyName.trim() || !companyWebsite.trim() || !companyKeywords.trim()) {
      setMessage("请填写公司名称、官网和关键词");
      return;
    }

    setCompanyLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName.trim(),
          website: companyWebsite.trim(),
          keywords: companyKeywords
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage(`新增公司失败: ${data.message || data.error || "未知错误"}`);
        return;
      }
      setMessage("新增成功，实时同步到工作台");
      setCurrentCompanies(prev => [...prev, {
        id: data.record?.id || companyName.toLowerCase().replace(/\s+/g, "-"),
        name: companyName.trim(),
        website: companyWebsite.trim(),
        keywords: companyKeywords.split(",").map(k => k.trim()).filter(Boolean),
        urls: [],
        is_active: true,
        lastCrawlAt: null,
        company_type: null
      }]);
      setCompanyName("");
      setCompanyWebsite("");
      setCompanyKeywords("");
    } catch (err) {
      setMessage(`新增公司失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCompanyLoading(false);
    }
  }

  async function handleDisableCompany(companyId: string, companyNameValue: string) {
    const confirmed = window.confirm(`确认停用公司对象"${companyNameValue}"？停用后将不会出现在工作台中。`);
    if (!confirmed) return;

    setDisablingCompanyId(companyId);
    setMessage("");

    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage(`停用失败: ${data.message || data.error || "未知错误"}`);
        return;
      }
      setCurrentCompanies(prev => prev.map(c => c.id === companyId ? { ...c, is_active: false } : c));
      setMessage("停用成功");
    } catch (err) {
      setMessage(`停用失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDisablingCompanyId(null);
    }
  }

  async function handleRestoreCompany(companyId: string) {
    setRestoringCompanyId(companyId);
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage(`恢复失败: ${data.message || data.error || "未知错误"}`);
        return;
      }
      setCurrentCompanies(prev => prev.map(c => c.id === companyId ? { ...c, is_active: true } : c));
      setMessage("恢复成功");
    } catch (err) {
      setMessage(`恢复失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRestoringCompanyId(null);
    }
  }

  async function handleUpdateCompanyType(companyId: string, newType: string) {
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_type: newType })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage(`更新类别失败: ${data.message || data.error || "未知错误"}`);
        return;
      }
      setCurrentCompanies(prev => prev.map(c => c.id === companyId ? { ...c, company_type: newType } : c));
      setMessage("类别更新成功");
    } catch (err) {
      setMessage(`更新类别失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const toggleExpand = (companyId: string) => {
    setExpandedCompanyId(prev => prev === companyId ? null : companyId);
  };

  return (
    <>
      <Head>
        <title>公司管理 | Biz Insight</title>
      </Head>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-moss">Console</p>
            <h1 className="mt-2 text-4xl font-semibold text-ink">公司管理</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              管理公司及其来源网址，新增、停用、删除实时同步到工作台。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/learn" className="rounded-full border border-sky-200 bg-white px-5 py-3 text-sm font-semibold text-sky-700">智能爬虫系统</a>
            <a href="/workbench" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">工作台</a>
            <a href="/" className="rounded-full bg-moss px-5 py-3 text-sm font-semibold text-white">返回首页</a>
          </div>
        </div>

        {message && (
          <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm">{message}</div>
        )}

        <section className="mt-8 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-ink">公司统计</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-5">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Active 公司</div>
              <div className="mt-2 text-3xl font-semibold text-ink">{companiesWithSources.length}</div>
            </div>
            {(["official", "media", "professional", "general"] as const).map(type => {
              const meta = sourceTypeLabels[type];
              return (
                <div key={type} className={`rounded-2xl ${meta.bgColor} p-4`}>
                  <div className={`text-sm ${meta.color}`}>{meta.label}</div>
                  <div className="mt-2 text-3xl font-semibold text-ink">{groupedByType[type].length}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-ink mb-4">公司列表</h2>
          
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
                    const isExpanded = expandedCompanyId === company.id;
                    
                    return (
                      <div key={company.id}>
                        <article className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-base font-semibold text-ink truncate">{company.name}</h4>
                                <select
                                  value={company.company_type || "general"}
                                  onChange={(e) => handleUpdateCompanyType(company.id, e.target.value)}
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium border-0 cursor-pointer ${meta.bgColor} ${meta.color}`}
                                >
                                  {companyTypeOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              </div>
                              <p className="mt-1 text-xs text-slate-500 truncate">{company.website}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleExpand(company.id)}
                                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                                  isExpanded 
                                    ? "bg-moss text-white" 
                                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                {isExpanded ? "收起" : "展开"}
                              </button>
                              <button
                                onClick={() => handleDisableCompany(company.id, company.name)}
                                disabled={disablingCompanyId === company.id}
                                className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                停用
                              </button>
                            </div>
                          </div>
                        </article>

                        {isExpanded && (
                          <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="space-y-2">
                              {company.sources.map(source => {
                                const urlType = getSourceTypeFromUrl(source.url);
                                return (
                                  <div key={source.id} className="flex items-start gap-3 rounded-xl bg-white p-3">
                                    <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs ${sourceTypeLabels[urlType]?.bgColor} ${sourceTypeLabels[urlType]?.color}`}>
                                      {sourceTypeLabels[urlType]?.label}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="break-all text-sm text-ink">{source.url}</p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {source.keywords.join(", ") || "无关键词"} | {formatShanghaiDateTime(source.last_checked_at)}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => handleDeleteSource(source.id)}
                                      disabled={deletingId === source.id}
                                      className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      删除
                                    </button>
                                  </div>
                                );
                              })}
                              {company.sources.length === 0 && (
                                <p className="text-sm text-slate-500 text-center py-2">暂无网址</p>
                              )}
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

        {inactiveCompanies.length > 0 && (
          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
            <h2 className="text-xl font-semibold text-ink">已停用 ({inactiveCompanies.length})</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {inactiveCompanies.map(company => (
                <article key={company.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-ink truncate">{company.name}</h4>
                    <p className="text-xs text-slate-500 truncate">{company.website}</p>
                  </div>
                  <button
                    onClick={() => handleRestoreCompany(company.id)}
                    disabled={restoringCompanyId === company.id}
                    className="rounded-full bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss/90 disabled:opacity-50"
                  >
                    恢复
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-ink">新增公司</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1.2fr_1.2fr_auto]">
            <input
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="公司名称"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
            <input
              value={companyWebsite}
              onChange={e => setCompanyWebsite(e.target.value)}
              placeholder="官网，例如 example.com"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
            <input
              value={companyKeywords}
              onChange={e => setCompanyKeywords(e.target.value)}
              placeholder="关键词，逗号分隔"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
            <button
              onClick={handleCreateCompany}
              disabled={companyLoading}
              className="rounded-full bg-moss px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              新增
            </button>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-ink">新增网址</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1.5fr_0.8fr_1fr_auto]">
            <select
              value={selectedCompanyId}
              onChange={e => setSelectedCompanyId(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              {currentCompanies.filter(c => c.is_active !== false).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
            <select
              value={urlType}
              onChange={e => setUrlType(e.target.value as UrlType)}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="general">general</option>
              <option value="news">news</option>
              <option value="product">product</option>
              <option value="ecosystem">ecosystem</option>
              <option value="jobs">jobs</option>
            </select>
            <input
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="关键词，逗号分隔"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
            />
            <button
              onClick={handleCreateSource}
              disabled={loading}
              className="rounded-full bg-moss px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              新增
            </button>
          </div>
        </section>
      </main>
    </>
  );
}