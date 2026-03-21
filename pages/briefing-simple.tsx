import Head from "next/head";
import { useState, useEffect } from "react";

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
  clean_text: string | null;
};

const CATEGORIES = ["全部", "产品", "技术", "生态", "招聘"] as const;

function trans(text: string): string {
  if (!text) return "";
  const m: Record<string, string> = {
    "AI meets safety": "AI与安全", "open source meets automotive": "开源与汽车",
    "showcases": "展示", "development solutions": "开发解决方案",
    "next generation": "下一代", "vehicles": "汽车",
    "embedded world": "嵌入式世界大会", "focusing on": "聚焦",
    "safety-critical": "安全关键", "automotive software": "汽车软件",
    "AUTOSAR Classic": "AUTOSAR Classic", "cybersecurity": "网络安全",
    "product launch": "产品发布", "collaboration": "合作",
    "partnership": "伙伴关系", "awards": "获奖", "innovation": "创新",
    "accelerated": "加速", "efficiency": "效率", "release": "发布",
    "contributed": "贡献", "collaborated with": "与...合作", "achieving": "实现",
    "provides": "提供", "introduces": "推出", "announces": "宣布",
    "ecosystem": "生态系统",
  };
  let r = text;
  Object.entries(m).sort((a,b) => b[0].length - a[0].length).forEach(([en,zh]) => {
    r = r.replace(new RegExp(en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), zh);
  });
  return r;
}

function isEn(text: string): boolean {
  if (!text) return false;
  return (text.match(/[\u4e00-\u9fff]/g) || []).length < text.length * 0.15;
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai", year:"numeric", month:"2-digit", day:"2-digit",
      hour:"2-digit", minute:"2-digit",
    });
  } catch { return ""; }
}

function getCatColor(cat: string) {
  switch(cat) {
    case "产品": return "bg-blue-100 text-blue-700";
    case "技术": return "bg-purple-100 text-purple-700";
    case "生态": return "bg-green-100 text-green-700";
    case "招聘": return "bg-orange-100 text-orange-700";
    default: return "bg-slate-100 text-slate-600";
  }
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function isNewsPage(url: string): boolean {
  return /news|press|media|动态|新闻|PR|activity|event|announcement/i.test(url);
}

function transCat(c: string): string {
  const m: Record<string, string> = { product:"产品", technology:"技术", ecosystem:"生态", news:"新闻动态", jobs:"招聘", general:"其他" };
  return m[c?.toLowerCase()] || c || "其他";
}

export default function BriefingSimple() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [cat, setCat] = useState("全部");
  const [newsOnly, setNewsOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/all-items")
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setTotal(d.totalCount || 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const counts: Record<string, number> = { "全部": items.length };
  for (const c of CATEGORIES) {
    if (c !== "全部") counts[c] = items.filter(i => transCat(i.category || i.insight_type || "") === c).length;
  }
  const newsCount = items.filter(i => isNewsPage(i.url)).length;

  // 过滤逻辑
  let filtered = items;
  if (newsOnly) {
    filtered = filtered.filter(i => isNewsPage(i.url));
  }
  if (cat !== "全部") {
    filtered = filtered.filter(i => transCat(i.category || i.insight_type || "") === cat);
  }

  if (loading) return <main className="max-w-5xl mx-auto px-6 py-8"><p className="text-slate-500">加载中...</p></main>;

  return (
    <>
      <Head><title>动态总览 | Biz Insight</title></Head>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-ink">动态总览</h1>
          <p className="mt-2 text-sm text-slate-500">
            共 {total} 条 · 新闻/动态 {newsCount} 条
          </p>
        </header>

        {/* 新闻动态开关 */}
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => setNewsOnly(!newsOnly)}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              newsOnly ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {newsOnly ? "✓ 仅看新闻动态" : "只看新闻动态"}
          </button>
          <span className="text-xs text-slate-400">聚焦各公司官网的新闻/动态/媒体板块</span>
        </div>

        <nav className="mb-6 flex gap-2 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${cat === c ? "bg-moss text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {c} ({counts[c]||0})
            </button>
          ))}
        </nav>

        <section className="space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center p-8 text-slate-500">暂无数据</div>
          ) : filtered.map((item, idx) => {
            const cat2 = transCat(item.category || item.insight_type || "");
            const enTitle = isEn(item.title);
            const title = enTitle ? trans(item.title) : item.title;
            const summary = item.summary ? (isEn(item.summary) ? trans(item.summary) : item.summary) : "";
            const origText = item.clean_text ? cleanText(item.clean_text).slice(0, 120) : "";
            const origEn = origText && isEn(origText);

            return (
              <article key={`${item.url}-${idx}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                {/* 顶栏 */}
                <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getCatColor(cat2)}`}>{cat2}</span>
                  {isNewsPage(item.url) && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">新闻</span>}
                  <span className="font-semibold text-ink">{item.company_name}</span>
                  <span className="text-slate-400">·</span>
                  {item.published_at ? <time className="text-slate-500">发布: {fmt(item.published_at)}</time> : null}
                  <time className="text-slate-400">抓取: {fmt(item.fetch_date)}</time>
                  {enTitle && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">英</span>}
                </div>

                {/* 标题 */}
                <h2 className="mb-3 text-lg font-semibold text-ink leading-snug">{title}</h2>

                {/* AI总结 */}
                {summary && (
                  <div className="mb-3 rounded-xl bg-blue-50 p-4 text-sm">
                    <p className="font-semibold text-blue-700 mb-1">AI总结</p>
                    <p className="text-blue-900 leading-relaxed">{summary}</p>
                  </div>
                )}

                {/* 原文 */}
                {origText && origText !== summary && (
                  <div className="mb-3 rounded-xl bg-slate-50 p-4 text-sm">
                    <p className="font-semibold text-slate-600 mb-1">原文</p>
                    <p className="text-slate-700 leading-relaxed">{origEn ? trans(origText) : origText}...</p>
                  </div>
                )}

                {/* 链接 */}
                <a href={item.url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-moss hover:underline">
                  阅读原文 →
                </a>
              </article>
            );
          })}
        </section>

        <footer className="mt-12 pt-6 border-t border-slate-200 text-center text-sm text-slate-400">
          <p>数据来源：各公司官网新闻/动态板块</p>
        </footer>
      </main>
    </>
  );
}
