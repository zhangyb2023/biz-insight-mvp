import Head from "next/head";
import type { GetServerSideProps } from "next";

import { InsightList } from "@/components/InsightList";
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
          <h2 className="text-2xl font-semibold text-ink">抓取效果预览</h2>
          <div className="mt-6 space-y-6">
            {documents.slice(0, 3).map((document) => (
              <article key={`preview-${document.id}`} className="rounded-3xl border border-slate-100 bg-sand/60 p-5">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold text-ink">{document.title}</h3>
                  <a className="text-sm font-medium" href={document.url} target="_blank" rel="noreferrer">
                    原文
                  </a>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-700">{document.clean_text.slice(0, 420)}...</p>
                {document.extracted_items?.length ? (
                  <div className="mt-4 space-y-3">
                    {document.extracted_items.slice(0, 3).map((item, index) => (
                      <div key={`${document.id}-${index}`} className="rounded-2xl bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <p className="font-medium text-ink">{item.title}</p>
                          {item.date ? <span className="text-xs text-slate-500">{item.date}</span> : null}
                        </div>
                        {item.summary ? <p className="mt-2 text-sm text-slate-600">{item.summary}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <InsightList
            items={documents.map((document) => ({
              title: document.title,
              url: document.url,
              fetch_date: document.fetch_date,
              summary: document.summary,
              insight_type: document.insight_type,
              category: document.category
            }))}
          />
        </section>
      </main>
    </>
  );
}
