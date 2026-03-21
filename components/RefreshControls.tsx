"use client";

import { useState } from "react";

type CompanyOption = {
  id: string;
  name: string;
};

type Props = {
  companies: CompanyOption[];
};

export function RefreshControls({ companies }: Props) {
  const [companyId, setCompanyId] = useState<string>("all");
  const [useCache, setUseCache] = useState(true);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [cacheMaxAgeHours, setCacheMaxAgeHours] = useState("24");
  const [mode, setMode] = useState<"check" | "crawl">("check");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  async function handleRefresh() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/crawl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          companyId: companyId === "all" ? undefined : companyId,
          useCache: mode === "check" ? useCache : false,
          forceRefresh: mode === "crawl" ? true : forceRefresh,
          cacheMaxAgeHours: Number(cacheMaxAgeHours)
        })
      });
      const data = (await response.json()) as {
        ok: boolean;
        processedCompanies?: string[];
        message?: string;
        error?: string;
      };
      if (!response.ok || !data.ok) {
        setMessage(`刷新失败：${data.message || data.error || "未知错误"}`);
        return;
      }
      setMessage(`${mode === "check" ? "检查" : "爬取"}完成：${(data.processedCompanies || []).join(", ") || "全部公司"}`);
      window.location.reload();
    } catch (error) {
      setMessage(`刷新失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel backdrop-blur">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Manual Refresh</p>
      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as "check" | "crawl")}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink"
          disabled={loading}
        >
          <option value="check">批量检查</option>
          <option value="crawl">批量爬取</option>
        </select>
        <select
          value={companyId}
          onChange={(event) => setCompanyId(event.target.value)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink"
          disabled={loading}
        >
          <option value="all">全部公司</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-full bg-moss px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "处理中..." : mode === "check" ? "执行检查" : "执行爬取"}
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <input type="checkbox" checked={useCache} onChange={(event) => setUseCache(event.target.checked)} />
          使用缓存
        </label>
        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={forceRefresh}
            onChange={(event) => setForceRefresh(event.target.checked)}
            disabled={mode === "crawl"}
          />
          强制刷新
        </label>
        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
          cache TTL
          <input
            className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm"
            value={cacheMaxAgeHours}
            onChange={(event) => setCacheMaxAgeHours(event.target.value)}
          />
          小时
        </label>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        检查：优先按缓存策略判断当前网址是否值得重新抓取。爬取：强制重新抓网页并重跑后续流程。TTL 控制缓存多久视为有效。
      </p>
      {message ? <p className="mt-3 text-sm font-medium text-ink">{message}</p> : null}
    </div>
  );
}
