import Head from "next/head";
import type { GetServerSideProps } from "next";

import { getReportData, loadCompanies, syncCompanies } from "@/lib/db/repository";

type Props = NonNullable<ReturnType<typeof getReportData>>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  syncCompanies(loadCompanies());
  const id = String(context.params?.id || "");
  const since = typeof context.query.since === "string" ? context.query.since : undefined;
  const report = getReportData(id, since);
  if (!report) {
    return { notFound: true };
  }
  return { props: report };
};

export default function ReportPage({ company, documents }: Props) {
  return (
    <>
      <Head>
        <title>{company.name} Report</title>
      </Head>
      <main className="mx-auto max-w-4xl px-6 py-10">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-10 shadow-panel">
          <p className="text-sm uppercase tracking-[0.3em] text-moss">PDF Report Source</p>
          <h1 className="mt-3 text-4xl font-semibold text-ink">{company.name} 商业洞察报告</h1>
          <p className="mt-3 text-sm text-slate-600">{company.website}</p>
          <div className="mt-8 space-y-6">
            {documents.map((document) => (
              <article key={document.id} className="rounded-3xl border border-slate-200 p-6">
                <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-wide text-slate-500">
                  <span>{document.category || "general"}</span>
                  <span>{document.fetch_date}</span>
                </div>
                <h2 className="mt-3 text-xl font-semibold text-ink">{document.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-700">{document.summary || document.clean_text.slice(0, 320)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {document.matched_keywords.map((keyword) => (
                    <span key={keyword} className="rounded-full bg-sand px-3 py-1 text-xs font-medium text-ink">
                      {keyword}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
