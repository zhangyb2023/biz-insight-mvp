import Head from "next/head";
import type { GetServerSideProps } from "next";

import { getCompanyDetails, loadCompanies, syncCompanies } from "@/lib/db/repository";

type Props = NonNullable<ReturnType<typeof getCompanyDetails>>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  syncCompanies(loadCompanies());
  const id = String(context.params?.id || "");
  const details = getCompanyDetails(id);
  if (!details) {
    return { notFound: true };
  }
  return { props: details };
};

export default function CompanyPage({ company, documents }: Props) {
  return (
    <>
      <Head>
        <title>{company.name} | Biz Insight MVP</title>
      </Head>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <a
          href="/workbench"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 mb-6"
        >
          ← 返回工作台
        </a>
        <div className="rounded-[2rem] border border-white/60 bg-white/80 p-8 shadow-panel backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-moss">Company Detail</p>
              <h1 className="mt-2 text-4xl font-semibold text-ink">{company.name}</h1>
              <p className="mt-3 text-sm text-slate-600">{company.website}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {company.keywords.map((keyword) => (
                  <span key={keyword} className="rounded-full bg-mint px-3 py-1 text-xs font-medium text-ink">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={`/api/export/${company.id}`}
                className="inline-flex rounded-full bg-ember px-5 py-3 text-sm font-semibold text-white"
              >
                导出清洗数据 Excel
              </a>
              <a
                href={`/report/${company.id}`}
                className="inline-flex rounded-full bg-moss px-5 py-3 text-sm font-semibold text-white"
              >
                查看报告页
              </a>
            </div>
          </div>
        </div>

        <section className="mt-8 rounded-[2rem] border border-white/60 bg-white/80 p-8 shadow-panel backdrop-blur">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-ink">动态信息列表</h2>
            <span className="text-sm text-slate-500">
              共 {documents.reduce((sum, d) => sum + ((d.extracted_items?.length) || 0), 0)} 条
            </span>
          </div>
          
          <div className="space-y-3">
            {documents.flatMap((document) =>
              (document.extracted_items || []).map((item, index) => (
                <div key={`${document.id}-item-${index}`} className="rounded-2xl bg-white px-4 py-3 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-ink">{item.title}</p>
                      {item.summary ? (
                        <p className="mt-1 text-sm text-slate-600 line-clamp-2">{item.summary}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {item.date ? <span className="text-xs text-slate-500">{item.date}</span> : null}
                      {item.url ? (
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-xs text-moss hover:underline"
                        >
                          原文
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </>
  );
}
