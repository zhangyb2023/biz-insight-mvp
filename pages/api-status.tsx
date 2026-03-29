import Head from "next/head";
import { useState, useEffect } from "react";
import { ApiStatus } from "@/lib/api/apiStatus";

export default function ApiStatusPage() {
  const [apiStatus, setApiStatus] = useState<ApiStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const fetchApiStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/status/apis");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setApiStatus(data.apis);
      setLastChecked(new Date(data.checkedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApiStatus();
  }, []);

  return (
    <>
      <Head>
        <title>API 状态监控 | 商业洞察</title>
      </Head>
      <main className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-800">API 状态监控</h1>
                <p className="text-sm text-slate-500 mt-1">实时监控各模型服务状态和配额</p>
              </div>
              <a href="/" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                返回首页
              </a>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">模型服务状态</h2>
                <p className="text-sm text-slate-500 mt-1">商业洞察系统使用的所有 AI 模型和 API 服务</p>
              </div>
              <button
                onClick={() => fetchApiStatus()}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "检查中..." : "刷新状态"}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {apiStatus.map((api) => (
                <div key={api.name} className={`rounded-2xl border p-5 ${
                  api.status === "active" ? "border-emerald-200 bg-emerald-50" :
                  api.status === "unauthorized" ? "border-red-200 bg-red-50" :
                  api.status === "error" ? "border-amber-200 bg-amber-50" :
                  "border-slate-200 bg-white"
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`size-3 rounded-full ${
                      api.status === "active" ? "bg-emerald-500" :
                      api.status === "unauthorized" ? "bg-red-500" :
                      api.status === "error" ? "bg-amber-500" :
                      "bg-slate-400"
                    }`} />
                    <span className="font-semibold text-slate-800">{api.name}</span>
                  </div>
                  <p className="text-sm text-slate-600 font-mono">{api.key}</p>
                  <p className="mt-2 text-sm">
                    <span className={
                      api.status === "active" ? "text-emerald-700" :
                      api.status === "unauthorized" ? "text-red-700" :
                      api.status === "error" ? "text-amber-700" :
                      "text-slate-600"
                    }>{api.message}</span>
                  </p>
                  {api.quota?.message && (
                    <p className="mt-2 text-xs text-slate-500">{api.quota.message}</p>
                  )}
                  {api.description && (
                    <p className="mt-3 text-xs text-sky-600 bg-sky-50 px-3 py-2 rounded-lg">{api.description}</p>
                  )}
                </div>
              ))}
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-600">加载失败: {error}</p>
            )}
            {lastChecked && (
              <p className="mt-4 text-xs text-slate-500">最后检查: {lastChecked}</p>
            )}
          </div>

          <div className="bg-gradient-to-r from-slate-100 to-slate-50 rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">模型说明</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4 border border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📄</span>
                  <span className="font-medium text-slate-700">Jina Reader</span>
                </div>
                <p className="text-xs text-slate-500">免费无需 Key。将网页 HTML 转换为纯文本，是页面抓取的主力工具。</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🔥</span>
                  <span className="font-medium text-slate-700">Firecrawl</span>
                </div>
                <p className="text-xs text-slate-500">深度爬取工具，支持 JavaScript 渲染。当 Jina 无法处理时备选使用。</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🔍</span>
                  <span className="font-medium text-slate-700">Tavily</span>
                </div>
                <p className="text-xs text-slate-500">专业发现工具，用于探测专业论坛、垂直网站等非常规来源。</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🤖</span>
                  <span className="font-medium text-slate-700">DeepSeek</span>
                </div>
                <p className="text-xs text-slate-500">LLM 推理模型。负责新闻分类（将新闻归类到产品技术/生态合作等）和洞察聚合（将多条新闻聚合成结构化结论）。</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🔗</span>
                  <span className="font-medium text-slate-700">SiliconFlow</span>
                </div>
                <p className="text-xs text-slate-500">向量嵌入模型（BAAI/bge-large-zh-v1.5）。用于置信率计算：判断新闻内容与洞察结论的语义相似度（阈值 0.55），只有相似度≥0.55 的新闻才计入证据。</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}