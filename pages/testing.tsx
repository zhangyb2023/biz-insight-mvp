import Head from "next/head";

const testSections = [
  {
    title: "1. 新增来源网址",
    page: "/sources",
    steps: [
      "选择公司",
      "填入目标网址",
      "选择 URL 类型",
      "可选填关键词、TTL、是否允许缓存",
      "点击“新增来源”"
    ],
    expected: [
      "新增成功后，网址出现在来源列表里",
      "如果网址已存在，会提示已存在，不会静默失败",
      "如果以前删过同一个网址，会自动恢复"
    ]
  },
  {
    title: "2. 单 URL 测试",
    page: "/sources",
    steps: [
      "在来源列表找到目标网址",
      "点击“测试”",
      "如需跳过缓存，点击“强刷”"
    ],
    expected: [
      "页面下方会出现测试结果面板",
      "能看到 clean_text、关键词命中、extracted_items、LLM 输出",
      "能区分缓存命中和实时抓取"
    ]
  },
  {
    title: "3. Excel 导出",
    page: "/sources",
    steps: [
      "在来源列表点击“Excel”",
      "浏览器应下载单来源导出文件"
    ],
    expected: [
      "导出包含 source_registry、source、document、extracted_items",
      "如果这个网址还没有正式入库，至少会导出 source_registry"
    ]
  },
  {
    title: "4. 触发任务并查看 Job Center",
    page: "/",
    steps: [
      "首页点手动刷新抓取",
      "刷新完成后打开 /jobs",
      "查看任务详情 /jobs/[id]"
    ],
    expected: [
      "能看到任务统计、任务状态、URL 数、失败数、缓存命中数",
      "任务详情里能展开到具体步骤"
    ]
  },
  {
    title: "5. 工作流与 I/O 查看",
    page: "/jobs",
    steps: [
      "进入某个任务详情",
      "点击步骤进入 Trace",
      "再进入 I/O Inspector"
    ],
    expected: [
      "能看到 input_json、output_json、error、fallback、模块名",
      "LLM 步骤能看到 raw_response 和 parsed_json"
    ]
  },
  {
    title: "6. 流程总览图",
    page: "/workflow-map",
    steps: [
      "打开流程总览页",
      "先看系统总流程图",
      "再看 10 步工作流和六大流程卡"
    ],
    expected: [
      "能直观看到各个节点与方向",
      "能看到 Mermaid 对应源码和真实模块位置"
    ]
  }
];

export default function TestingPage() {
  return (
    <>
      <Head>
        <title>Testing Guide | Biz Insight MVP</title>
      </Head>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-moss">Testing Guide</p>
            <h1 className="mt-2 text-4xl font-semibold text-ink">功能测试页</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              这个页面是给非技术用户的操作指南。每个功能都告诉你去哪个页面、点什么、预期看到什么结果。
            </p>
          </div>
          <a href="/" className="inline-flex rounded-full bg-moss px-5 py-3 text-sm font-semibold text-white">
            返回控制台
          </a>
        </div>

        <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm leading-6 text-amber-900">
            网页后台可调项：新增/删除网址、启用停用、缓存 TTL、单 URL 测试、强刷、导出 Excel。
            <br />
            必须改代码的项：新增流程步骤、改抽取算法、改数据库结构、改模型 provider、改工作流顺序。
          </p>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {testSections.map((section) => (
            <article key={section.title} className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">{section.title}</h2>
                <a href={section.page} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  打开页面
                </a>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-500">操作步骤</p>
                <ol className="mt-2 space-y-2 text-sm text-slate-700">
                  {section.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-500">预期结果</p>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {section.expected.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
