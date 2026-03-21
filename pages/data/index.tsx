import Head from "next/head";

const tables = [
  "companies",
  "sources",
  "documents",
  "insights",
  "crawl_jobs",
  "crawl_job_steps",
  "source_versions",
  "llm_runs",
  "source_registry",
  "keyword_sets"
];

export default function DataIndexPage() {
  return (
    <>
      <Head>
        <title>Data Explorer | Biz Insight MVP</title>
      </Head>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-moss">Data Explorer</p>
            <h1 className="mt-2 text-4xl font-semibold text-ink">数据库浏览器</h1>
            <p className="mt-3 text-sm text-slate-600">默认只看当前 active 公司。需要排查历史残留时，再切到显示历史数据。</p>
          </div>
          <a href="/" className="inline-flex rounded-full bg-moss px-5 py-3 text-sm font-semibold text-white">
            返回控制台
          </a>
        </div>
        <section className="mt-6 flex flex-wrap gap-3">
          <a href="/data/companies" className="inline-flex rounded-full bg-moss px-5 py-3 text-sm font-semibold text-white">
            仅当前 active 公司
          </a>
          <a
            href="/data/companies?includeInactive=true"
            className="inline-flex rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            显示历史数据
          </a>
        </section>
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {tables.map((table) => (
            <div key={table} className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
              <h2 className="text-lg font-semibold text-ink">{table}</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href={`/data/${table}`} className="text-sm font-semibold text-moss">
                  仅当前 active
                </a>
                <a href={`/data/${table}?includeInactive=true`} className="text-sm font-semibold text-slate-600">
                  显示历史
                </a>
              </div>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
