import Head from "next/head";

const topics = [
  { slug: "market", title: "市场", description: "观察行业结构、竞争格局和重点市场信号。" },
  { slug: "sales", title: "营销/销售", description: "聚焦销售机会、客户动态和项目进入点。" },
  { slug: "product", title: "产品", description: "跟踪产品布局、方案包装和竞争变化。" },
  { slug: "technology", title: "技术", description: "聚焦平台能力、标准演进和技术路线。" },
  { slug: "ecosystem", title: "生态", description: "观察生态合作、伙伴关系和平台绑定。" },
  { slug: "customer", title: "客户", description: "围绕客户需求、主机厂和项目落地信号。" }
] as const;

export default function TopicsIndexPage() {
  return (
    <>
      <Head>
        <title>专题视角 | Biz Insight MVP</title>
      </Head>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="rounded-[2rem] border border-white/60 bg-white/85 p-8 shadow-panel backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-4xl">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-moss">Topic View</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight text-ink md:text-5xl">专题视角</h1>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                按专题而不是按角色组织内容。每个专题页结构统一：本专题摘要、重点公司、重点动态、主题/标签/趋势、对普华启示、导出专题 PDF。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/" className="rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700">
                返回首页
              </a>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {topics.map((topic) => (
            <a key={topic.slug} href={`/topics/${topic.slug}`} className="rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-panel backdrop-blur transition hover:bg-white">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-moss">专题入口</p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">{topic.title}专题</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{topic.description}</p>
              <span className="mt-5 inline-flex text-sm font-semibold text-moss">进入专题</span>
            </a>
          ))}
        </section>
      </main>
    </>
  );
}
