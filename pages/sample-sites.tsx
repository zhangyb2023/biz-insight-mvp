import Head from "next/head";
import type { GetServerSideProps } from "next";
import fs from "fs";
import path from "path";

type SampleSite = {
  group: string;
  companyName: string;
  website: string;
  sources: Array<{
    url: string;
    type: string;
    expectedMode: string;
  }>;
};

type Props = {
  samples: SampleSite[];
};

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const filePath = path.join(process.cwd(), "data", "sample_sites.json");
  const raw = fs.readFileSync(filePath, "utf8");
  return {
    props: {
      samples: JSON.parse(raw) as SampleSite[]
    }
  };
};

export default function SampleSitesPage({ samples }: Props) {
  return (
    <>
      <Head>
        <title>样本站点池 | Biz Insight MVP</title>
      </Head>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-moss">Sample Pool</p>
            <h1 className="mt-2 text-4xl font-semibold text-ink">样本站点池</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              这页是后续固定抓取模式和评分验收的样本清单。先用它逐站点调试，再沉淀成固定模式。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/console" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
              控制台
            </a>
            <a href="/workbench" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
              工作台
            </a>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {samples.map((sample) => (
            <section key={`${sample.group}-${sample.companyName}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{sample.group}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">{sample.companyName}</h2>
                  <p className="mt-2 text-sm text-slate-600">{sample.website}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  {sample.sources.length} 条样本来源
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {sample.sources.map((source) => (
                  <article key={source.url} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="break-all text-sm font-semibold text-ink">{source.url}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      类型：{source.type} | 预期模式：{source.expectedMode}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
