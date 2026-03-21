import Head from "next/head";
import type { GetServerSideProps } from "next";

import { getExecutiveDashboardData } from "@/lib/db/repository";
import { formatShanghaiDateTime } from "@/lib/format";
import {
  isCompleteFrontstageInsight,
  isStrongEvidencePageKind,
  toInsightEntryViewModel
} from "@/lib/presentation/insightViewModel";

type DashboardProps = ReturnType<typeof getExecutiveDashboardData>;

type TopicSlug = "market" | "sales" | "product" | "technology" | "ecosystem" | "customer";

type TopicConfig = {
  slug: TopicSlug;
  title: string;
  subtitle: string;
  summary: string;
  implications: string[];
  tags: string[];
};

type Props = {
  topic: TopicConfig;
  featuredItems: DashboardProps["featuredInsights"];
  featuredKeywords: DashboardProps["topKeywords"];
};

const TOPICS: Record<TopicSlug, TopicConfig> = {
  market: {
    slug: "market",
    title: "市场专题",
    subtitle: "行业结构、竞争格局与重点市场信号",
    summary: "聚焦当前市场格局、竞争对象动态和热点方向，帮助快速判断行业变化与市场机会。",
    implications: [
      "关注竞争格局变化对普华市场空间的影响。",
      "识别热点方向是否转化为真实市场机会。",
      "避免把一般新闻热度误判为市场信号。"
    ],
    tags: ["市场", "竞争格局", "热点方向", "机会判断"]
  },
  sales: {
    slug: "sales",
    title: "营销/销售专题",
    subtitle: "机会线索、客户动态与销售切入点",
    summary: "聚焦哪些客户和合作动态更接近项目机会，帮助销售和市场团队快速判断跟进优先级。",
    implications: [
      "优先识别真实项目线索和可跟进客户。",
      "关注合作公告背后的销售进入点。",
      "弱化纯品牌传播，不让它稀释销售判断。"
    ],
    tags: ["销售", "客户", "项目", "合作"]
  },
  product: {
    slug: "product",
    title: "产品专题",
    subtitle: "产品布局、方案包装与能力竞争",
    summary: "聚焦产品页、方案页、案例页和产品组合变化，用于判断产品竞争与差异化空间。",
    implications: [
      "识别竞争对手产品组合和方案包装方式。",
      "观察哪些能力正在变成标配。",
      "为普华产品路线和包装策略提供输入。"
    ],
    tags: ["产品", "方案", "案例", "能力竞争"]
  },
  technology: {
    slug: "technology",
    title: "技术专题",
    subtitle: "技术路线、平台能力与标准演进",
    summary: "聚焦标准、平台能力和技术路线变化，用于判断哪些能力对普华中长期建设最关键。",
    implications: [
      "关注标准和平台能力变化对普华的门槛影响。",
      "识别技术热点背后的真实平台约束。",
      "避免把纯技术传播当成商业洞察结论。"
    ],
    tags: ["技术路线", "平台", "标准", "能力建设"]
  },
  ecosystem: {
    slug: "ecosystem",
    title: "生态专题",
    subtitle: "生态合作、伙伴关系与平台绑定",
    summary: "聚焦生态合作与伙伴关系变化，帮助判断谁在形成平台中心、普华应如何合作或防守。",
    implications: [
      "识别新的生态中心和平台绑定关系。",
      "观察哪些合作关系会改变普华位置。",
      "把生态信息转成合作与防守动作。"
    ],
    tags: ["生态", "合作", "伙伴关系", "平台绑定"]
  },
  customer: {
    slug: "customer",
    title: "客户专题",
    subtitle: "客户需求、主机厂信号与项目落地",
    summary: "围绕客户需求和主机厂动态组织内容，用于判断需求牵引和项目落地信号。",
    implications: [
      "优先看需求和项目，不看泛品牌传播。",
      "识别客户采购和合作链条变化。",
      "把客户信号转成普华行动建议。"
    ],
    tags: ["客户", "主机厂", "需求牵引", "项目落地"]
  }
};

function pickTopicItems(items: DashboardProps["featuredInsights"], tags: string[]) {
  const normalizedTags = tags.map((tag) => tag.toLowerCase());
  const matched = items.filter((item) => {
    const haystack = `${item.company_name} ${item.title} ${item.summary} ${item.category} ${item.insight_type}`.toLowerCase();
    return normalizedTags.some((tag) => haystack.includes(tag));
  });
  return (matched.length ? matched : items).slice(0, 6);
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const topicParam = context.params?.topic;
  if (typeof topicParam !== "string" || !(topicParam in TOPICS)) {
    return { notFound: true };
  }

  const topic = TOPICS[topicParam as TopicSlug];
  const dashboard = getExecutiveDashboardData();
  const featuredItems = pickTopicItems(dashboard.featuredInsights, topic.tags);
  const featuredKeywords = dashboard.topKeywords.filter((item) => topic.tags.some((tag) => item.keyword.includes(tag))).slice(0, 8);

  return {
    props: {
      topic,
      featuredItems,
      featuredKeywords: featuredKeywords.length ? featuredKeywords : dashboard.topKeywords.slice(0, 8)
    }
  };
};

export default function TopicPage({ topic, featuredItems, featuredKeywords }: Props) {
  const insightItems = featuredItems.map(toInsightEntryViewModel);
  const completeItems = insightItems.filter(isCompleteFrontstageInsight);
  const supportedItems = completeItems.filter(
    (item) => item.supports_judgment && isStrongEvidencePageKind(item.page_kind)
  );
  const visibleDetailItems = completeItems.filter((item) => item.page_kind !== "list_page" && item.page_kind !== "homepage");
  const keySignals = (supportedItems.length ? supportedItems : visibleDetailItems).slice(0, 4);
  const evidenceItems = visibleDetailItems.slice(0, 6);
  const evidenceInsufficient = supportedItems.length < 2;

  return (
    <>
      <Head>
        <title>{topic.title} | Biz Insight MVP</title>
      </Head>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="rounded-[2rem] border border-white/60 bg-white/85 p-8 shadow-panel backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-4xl">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-moss">Topic Detail</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight text-ink md:text-5xl">{topic.title}</h1>
              <p className="mt-4 text-lg font-medium text-slate-700">{topic.subtitle}</p>
              <p className="mt-4 text-sm leading-7 text-slate-600">{topic.summary}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/topics" className="rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700">
                返回专题入口
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-full bg-ember px-5 py-3 text-sm font-semibold text-white"
              >
                导出专题PDF
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-panel backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-moss">Topic Summary</p>
          <h2 className="mt-2 text-3xl font-semibold text-ink">本专题摘要</h2>
          <p className="mt-4 max-w-4xl text-sm leading-8 text-slate-700">{topic.summary}</p>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-panel backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-moss">Signals</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">重点动态表</h2>
            {evidenceInsufficient ? (
              <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
                当前证据不足以下强判断。
              </div>
            ) : null}
            {keySignals.length === 0 ? (
              <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
                当前没有字段完整、可核验的结构化资讯条目，专题主展示区暂不显示内容。
              </div>
            ) : (
              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-sand/60 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">公司</th>
                      <th className="px-4 py-3">原文标题</th>
                      <th className="px-4 py-3">摘要</th>
                      <th className="px-4 py-3">来源网站</th>
                      <th className="px-4 py-3">page_kind</th>
                      <th className="px-4 py-3">发布时间</th>
                      <th className="px-4 py-3">抓取时间</th>
                      <th className="px-4 py-3">证据强度</th>
                      <th className="px-4 py-3">证据状态</th>
                      <th className="px-4 py-3">一句话判断</th>
                      <th className="px-4 py-3">是否进报告</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {keySignals.map((item) => (
                      <tr key={`${item.source_url}-${item.fetched_at}`}>
                        <td className="px-4 py-4 align-top">
                          <div className="font-semibold text-ink">{item.company_name}</div>
                          <div className="mt-1 text-xs text-slate-500">{item.company_type}</div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <a href={item.source_url} target="_blank" rel="noreferrer" className="font-semibold text-ink underline decoration-slate-300 underline-offset-4">
                            {item.page_title}
                          </a>
                          <div className="mt-2">
                            <a
                              href={item.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                            >
                              查看原文
                            </a>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.summary}</td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.source_domain}</td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.page_kind}</td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.published_at || "待补"}</td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.fetched_at ? formatShanghaiDateTime(item.fetched_at) : "待确认"}</td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.evidence_strength}</td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.supports_judgment ? "可支撑判断" : "待补强"}</td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.insight_judgment}</td>
                        <td className="px-4 py-4 align-top text-slate-700">{item.should_enter_report ? "建议进入" : "暂不进入"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-6">
            <section className="rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-panel backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-moss">Themes</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">主题 / 标签 / 趋势</h2>
              <div className="mt-5 flex flex-wrap gap-3">
                {featuredKeywords.map((item) => (
                  <span key={item.keyword} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
                    {item.keyword}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-panel backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-moss">Implications</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">对普华启示</h2>
              <div className="mt-5 space-y-3">
                {topic.implications.map((item, index) => (
                  <div key={item} className="rounded-3xl bg-sand/50 p-4 text-sm leading-7 text-slate-700">
                    {index + 1}. {item}
                  </div>
                ))}
              </div>
            </section>
          </section>
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-panel backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-moss">Evidence</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">关键证据</h2>
          {evidenceInsufficient ? (
            <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
              当前证据不足以下强判断。
            </div>
          ) : null}
          {evidenceItems.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
              当前没有字段完整的结构化证据条目，暂不展示专题证据区。
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {evidenceItems.map((item) => (
                <article key={`${item.source_url}-${item.fetched_at}`} className="rounded-3xl bg-sand/50 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                    <span>{item.company_name}</span>
                    <span>{item.page_section}</span>
                    <span>{item.source_domain}</span>
                    <span>{item.page_kind}</span>
                    <span>{item.evidence_strength}证据</span>
                    <span>{item.supports_judgment ? "可支撑判断" : "待补强"}</span>
                    <span>{item.published_at ? `发布时间 ${item.published_at}` : "发布时间待补"}</span>
                    <span>{item.fetched_at ? `抓取 ${formatShanghaiDateTime(item.fetched_at)}` : "未记录抓取时间"}</span>
                  </div>
                  <a href={item.source_url} target="_blank" rel="noreferrer" className="mt-2 block text-base font-semibold text-ink underline decoration-slate-300 underline-offset-4">
                    {item.page_title}
                  </a>
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
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">判断—证据—原文</p>
                    <p className="mt-2">
                      当前判断由「{item.page_title}」支撑，原文来源为 {item.source_domain}，
                      证据强度为 {item.evidence_strength}。
                    </p>
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
      </main>
    </>
  );
}
