import Head from "next/head";
import type { GetServerSideProps } from "next";

import { getExecutiveDashboardData } from "@/lib/db/repository";
import { formatShanghaiDateTime } from "@/lib/format";
import {
  isCompleteFrontstageInsight,
  isStrongEvidencePageKind,
  toInsightEntryViewModel
} from "@/lib/presentation/insightViewModel";

type Props = ReturnType<typeof getExecutiveDashboardData>;

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  return {
    props: getExecutiveDashboardData()
  };
};

function formatCount(value?: number | null) {
  return Intl.NumberFormat("zh-CN").format(value ?? 0);
}

const methodologyLayers = [
  "行业变化",
  "重点公司",
  "技术路线",
  "生态关系",
  "客户/市场信号",
  "普华动作"
] as const;

export default function BriefingPage(props: Props) {
  const structuredInsights = props.featuredInsights.map(toInsightEntryViewModel);
  const completeInsights = structuredInsights.filter(isCompleteFrontstageInsight);
  const strongEvidenceInsights = completeInsights.filter(
    (item) => item.supports_judgment && isStrongEvidencePageKind(item.page_kind)
  );
  const supportReadyInsights = completeInsights.filter((item) => item.supports_judgment);
  const backlogInsights = completeInsights.filter((item) => !item.supports_judgment);
  const mostImportantChanges = supportReadyInsights.slice(0, 4);
  const keyCompanies = props.companySections.slice(0, 6);
  const keyEvidenceItems = supportReadyInsights.slice(0, 8);
  const methodologyCards = [
    {
      layer: "行业变化",
      judgment: mostImportantChanges[0]?.insight_judgment || "当前高强度行业变化样本不足。",
      count: completeInsights.length,
      status: supportReadyInsights.length >= 2 ? "可判断" : supportReadyInsights.length === 1 ? "待补强" : "暂不判断"
    },
    {
      layer: "重点公司",
      judgment: keyCompanies.length ? `当前已形成 ${keyCompanies.length} 家重点公司观察。` : "重点公司样本不足。",
      count: keyCompanies.length,
      status: keyCompanies.length >= 3 ? "可判断" : keyCompanies.length > 0 ? "待补强" : "暂不判断"
    },
    {
      layer: "技术路线",
      judgment: completeInsights.some((item) => item.tech_keywords.length > 0) ? "已出现可用于技术路线判断的证据。": "技术路线证据仍偏弱。",
      count: completeInsights.filter((item) => item.tech_keywords.length > 0).length,
      status: completeInsights.filter((item) => item.tech_keywords.length > 0).length >= 2 ? "可判断" : "待补强"
    },
    {
      layer: "生态关系",
      judgment: completeInsights.some((item) => item.customer_or_partner) ? "已出现合作/伙伴类证据。": "生态关系证据仍需补强。",
      count: completeInsights.filter((item) => item.customer_or_partner).length,
      status: completeInsights.filter((item) => item.customer_or_partner).length > 0 ? "可判断" : "待补强"
    },
    {
      layer: "客户/市场信号",
      judgment: completeInsights.some((item) => item.event_type.includes("新闻") || item.event_type.includes("合作")) ? "已出现客户/市场动态信号。": "客户/市场证据仍不足。",
      count: completeInsights.filter((item) => item.event_type.includes("新闻") || item.event_type.includes("合作")).length,
      status: completeInsights.filter((item) => item.event_type.includes("新闻") || item.event_type.includes("合作")).length >= 2 ? "可判断" : "待补强"
    },
    {
      layer: "普华动作",
      judgment: supportReadyInsights.length ? "当前已能形成有限的普华行动建议。": "暂不建议形成强动作。",
      count: supportReadyInsights.filter((item) => item.should_enter_report).length,
      status: supportReadyInsights.filter((item) => item.should_enter_report).length > 0 ? "可判断" : "暂不判断"
    }
  ];
  const impactPoints = [
    `当前已形成 ${formatCount(props.qualitySummary.totalItems)} 条可消费结果，重点集中在技术与生态相关对象。`,
    `覆盖公司 ${formatCount(props.stats.companyCount)} 家，其中近期有结果更新的对象已能支撑管理层基础浏览。`,
    `当前阶段仍需继续补齐高价值详情样本，避免结论过度依赖少量公司。`
  ];
  const actionItems = [
    "优先跟踪重点公司中已形成稳定高价值样本的对象，形成固定管理层观察清单。",
    "对边界页和聚合页继续收口，确保管理层看到的是判断结果，不是原始噪音。",
    "围绕专题入口继续组织内容，把老板视角和专题视角彻底分开。"
  ];

  return (
    <>
      <Head>
        <title>老板视角 | Biz Insight MVP</title>
      </Head>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="rounded-[2rem] border border-white/60 bg-white/85 p-8 shadow-panel backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-4xl">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-moss">Executive View</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight text-ink md:text-5xl">老板视角</h1>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                面向总经理和董事长的固定结构阅读页，只保留本期最重要变化、重点公司判断、方法论摘要、对普华影响与建议动作。
              </p>
              <p className="mt-4 text-xs text-slate-500">最近抓取时间：{formatShanghaiDateTime(props.stats.latestFetchDate)}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/" className="rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700">
                返回首页
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-full bg-ember px-5 py-3 text-sm font-semibold text-white"
              >
                导出管理层PDF
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-panel backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-moss">Key Changes</p>
          <h2 className="mt-2 text-3xl font-semibold text-ink">本期最重要变化</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            当前主展示区优先展示 `detail` 且完整度达标的条目。新闻类页面优先要求有发布时间，其他详情页允许先作为待补强证据展示。
          </p>
          {mostImportantChanges.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
              当前没有字段完整且可支撑判断的证据条目，老板页暂不展示强判断。
            </div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {mostImportantChanges.map((item) => (
              <article key={`${item.company_name}-${item.source_url}-${item.fetched_at}`} className="rounded-3xl bg-sand/50 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                  <span>{item.company_name}</span>
                  <span>{item.page_section}</span>
                  <span>{item.evidence_strength}证据</span>
                  <span>{item.published_at ? `发布时间 ${item.published_at}` : "发布时间待补"}</span>
                  <span>{item.fetched_at ? `抓取 ${formatShanghaiDateTime(item.fetched_at)}` : "未记录抓取时间"}</span>
                </div>
                <h3 className="mt-2 text-lg font-semibold text-ink">{item.page_title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-700">{item.summary}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">一句话判断</p>
                    <p className="mt-2">{item.insight_judgment}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">对普华意义</p>
                    <p className="mt-2">{item.reference_value_for_pwh}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">引用来源</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{item.source_domain}</span>
                    <span>{item.page_kind}</span>
                    <span>{item.evidence_strength}证据</span>
                    <span>{item.supports_judgment ? "可支撑判断" : "待补强"}</span>
                  </div>
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center text-sm font-semibold text-ink underline decoration-slate-300 underline-offset-4"
                  >
                    查看原文
                  </a>
                </div>
              </article>
              ))}
            </div>
          )}
        </section>

        {backlogInsights.length > 0 ? (
          <section className="mt-8 rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-panel backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-moss">Backlog</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">待补强证据</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              这些条目已经具备标题、摘要和来源，但还不够支撑强判断，通常是缺发布时间、证据强度偏弱或页面类型偏边界。
            </p>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {backlogInsights.slice(0, 6).map((item) => (
                <article key={`${item.company_name}-${item.source_url}-${item.fetched_at}-backlog`} className="rounded-3xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                    <span>{item.company_name}</span>
                    <span>{item.page_section}</span>
                    <span>{item.page_kind}</span>
                    <span>{item.published_at ? `发布时间 ${item.published_at}` : "发布时间待补"}</span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-ink">{item.page_title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{item.summary}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{item.evidence_strength}证据</span>
                    <span>待补强</span>
                  </div>
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center text-sm font-semibold text-ink underline decoration-slate-300 underline-offset-4"
                  >
                    查看原文
                  </a>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="space-y-6">
            <section className="rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-panel backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-moss">Impact</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">对普华影响</h2>
              <div className="mt-5 space-y-3">
                {impactPoints.map((item) => (
                  <div key={item} className="rounded-3xl bg-sand/50 p-4 text-sm leading-7 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-panel backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-moss">Actions</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">建议动作</h2>
              <div className="mt-5 space-y-3">
                {actionItems.map((item, index) => (
                  <div key={item} className="rounded-3xl bg-sand/50 p-4 text-sm leading-7 text-slate-700">
                    {index + 1}. {item}
                  </div>
                ))}
              </div>
            </section>
          </section>

          <section className="rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-panel backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-moss">Focus Companies</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">重点公司判断</h2>
            {keyEvidenceItems.length === 0 ? (
              <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
                当前没有字段完整且可核验的关键证据，老板页暂不展示证据表。
              </div>
            ) : (
              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-sand/60 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">公司</th>
                      <th className="px-4 py-3">类型</th>
                      <th className="px-4 py-3">当前判断</th>
                      <th className="px-4 py-3">是否进报告</th>
                      <th className="px-4 py-3 text-right">条目数</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {keyCompanies.map((company) => (
                      <tr key={company.id}>
                        <td className="px-4 py-4 font-semibold text-ink">{company.name}</td>
                        <td className="px-4 py-4 text-slate-600">{company.type}</td>
                        <td className="px-4 py-4 text-slate-700">已形成持续观察样本，可进入本期重点判断。</td>
                        <td className="px-4 py-4 text-slate-700">{company.total_items > 1 ? "建议纳入" : "视样本而定"}</td>
                        <td className="px-4 py-4 text-right font-semibold text-ink">{formatCount(company.total_items)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-panel backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-moss">Methodology</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">六层方法论摘要</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {methodologyCards.map((item, index) => (
                <div key={item.layer} className="rounded-3xl bg-sand/50 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">第 {index + 1} 层</p>
                  <p className="mt-2 text-base font-semibold text-ink">{item.layer}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{item.judgment}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{item.count} 条证据</span>
                    <span>{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-panel backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-moss">Evidence</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">关键证据表</h2>
            {keyEvidenceItems.length === 0 ? (
              <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
                当前没有字段完整且可核验的关键证据。
              </div>
            ) : (
              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-sand/60 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">公司 / 类型</th>
                      <th className="px-4 py-3">原文标题</th>
                      <th className="px-4 py-3">摘要</th>
                      <th className="px-4 py-3">来源网站</th>
                      <th className="px-4 py-3">page_kind</th>
                      <th className="px-4 py-3">发布时间</th>
                      <th className="px-4 py-3">抓取时间</th>
                      <th className="px-4 py-3">证据强度</th>
                      <th className="px-4 py-3">支撑判断</th>
                      <th className="px-4 py-3">一句话判断</th>
                      <th className="px-4 py-3">对普华意义</th>
                      <th className="px-4 py-3">进报告</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {keyEvidenceItems.map((item) => (
                      <tr key={`${item.company_name}-${item.source_url}-${item.fetched_at}`}>
                        <td className="px-4 py-4 align-top">
                          <div className="font-semibold text-ink">{item.company_name}</div>
                          <div className="mt-1 text-xs text-slate-500">{item.company_type} · {item.page_section}</div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <a href={item.source_url} target="_blank" rel="noreferrer" className="font-semibold text-ink underline decoration-slate-300 underline-offset-4">
                            {item.page_title}
                          </a>
                        </td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.summary}</td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.source_domain}</td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.page_kind}</td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.published_at}</td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.fetched_at ? formatShanghaiDateTime(item.fetched_at) : "待确认"}</td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.evidence_strength}</td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.supports_judgment ? "是" : "否"}</td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.insight_judgment}</td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.reference_value_for_pwh}</td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.should_enter_report ? "建议进入" : "暂不进入"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </main>
    </>
  );
}
