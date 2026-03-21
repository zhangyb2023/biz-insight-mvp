import Head from "next/head";
import type { GetServerSideProps } from "next";

import { FixSourceButton } from "@/components/FixSourceButton";
import { formatShanghaiDateTime } from "@/lib/format";
import { evaluateSourceResult } from "@/lib/evaluation";
import { getSourceExportData, loadCompanies, syncCompanies } from "@/lib/db/repository";
import { getDb } from "@/lib/db/sqlite";

type Props = {
  found: boolean;
  data?: {
    registry: ReturnType<typeof getSourceExportData> extends infer T ? T extends { registry: infer R } ? R : never : never;
    company: { id: string; name: string } | null;
    source: Record<string, unknown> | null;
    document: Record<string, unknown> | null;
    latestLlmRun: Record<string, unknown> | null;
    latestVersion: Record<string, unknown> | null;
  };
};

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  syncCompanies(loadCompanies());
  const id = Number(context.params?.id);
  if (!Number.isFinite(id)) {
    return { props: { found: false } };
  }

  const data = getSourceExportData(id);
  if (!data) {
    return { props: { found: false } };
  }

  const db = getDb();
  const latestLlmRun = data.document
    ? (db.prepare(`
        SELECT *
        FROM llm_runs
        WHERE document_id = ?
        ORDER BY id DESC
        LIMIT 1
      `).get((data.document as { id: number }).id) as Record<string, unknown> | undefined)
    : undefined;
  const latestVersion = data.source
    ? (db.prepare(`
        SELECT *
        FROM source_versions
        WHERE source_id = ?
        ORDER BY id DESC
        LIMIT 1
      `).get((data.source as { id: number }).id) as Record<string, unknown> | undefined)
    : undefined;

  return {
    props: {
      found: true,
      data: {
        registry: data.registry,
        company: data.company ? { id: data.company.id, name: data.company.name } : null,
        source: data.source ? { ...data.source } : null,
        document: data.document ? { ...data.document } : null,
        latestLlmRun: latestLlmRun ?? null,
        latestVersion: latestVersion ?? null
      }
    }
  };
};

export default function SourceExplainPage(props: Props) {
  if (!props.found || !props.data || !props.data.document) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-sm text-slate-600">未找到这条来源的解释结果。</p>
      </main>
    );
  }

  const document = props.data.document as Record<string, unknown>;
  const llm = (props.data.latestLlmRun ?? {}) as Record<string, unknown>;
  const version = (props.data.latestVersion ?? {}) as Record<string, unknown>;
  const extractedItems = parseJson<Array<{ title?: string; summary?: string; date?: string }>>(
    typeof document.extracted_items === "string" ? String(document.extracted_items) : JSON.stringify(document.extracted_items ?? []),
    []
  );
  const matchedKeywords = Array.isArray(document.matched_keywords)
    ? (document.matched_keywords as string[])
    : String(document.matched_keywords ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const evaluation = evaluateSourceResult({
    url: props.data.registry.url,
    urlType: String(props.data.registry.url_type ?? "general"),
    cleanText: String(document.clean_text ?? ""),
    matchedKeywords,
    extractedItemsCount: extractedItems.length,
    llmStatus: String(llm.status ?? "failed"),
    llmProvider: String(llm.provider ?? ""),
    fallbackUsed: Boolean(llm.fallback_used),
    summary: String(document.summary ?? ""),
    category: String(document.category ?? ""),
    sourceExists: !!props.data.source
  });

  return (
    <>
      <Head>
        <title>结果解释 | Biz Insight MVP</title>
      </Head>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-moss">Explanation</p>
            <h1 className="mt-2 text-4xl font-semibold text-ink">结果解释页</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              这页不是数据库平铺，而是按“最终结论 → 关键证据 → 技术过程”来解释这条网址为什么得到现在的结果。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={`/api/export/source/${props.data.registry.id}`} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
              导出当前 Excel
            </a>
            <a href="/workbench" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
              返回工作台
            </a>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-emerald-700">抓取结论</p>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl bg-white p-5">
              <p className="text-sm text-slate-500">公司 / 来源</p>
              <p className="mt-2 text-lg font-semibold text-ink">{props.data.company?.name ?? props.data.registry.company_id}</p>
              <p className="mt-2 break-all text-sm text-slate-600">{props.data.registry.url}</p>
            </div>
            <div className="rounded-2xl bg-white p-5">
              <p className="text-sm text-slate-500">总评结果</p>
              <p className="mt-2 text-lg font-semibold text-ink">{evaluation.finalVerdict}</p>
              <p className="mt-2 text-sm text-slate-600">总分：{evaluation.totalScore}</p>
            </div>
            <div className="rounded-2xl bg-white p-5">
              <p className="text-sm text-slate-500">推荐抓取模式</p>
              <p className="mt-2 text-lg font-semibold text-ink">{evaluation.crawlMode}</p>
              <p className="mt-2 text-sm text-slate-600">{evaluation.recommendedAction}</p>
            </div>
            <div className="rounded-2xl bg-white p-5">
              <p className="text-sm text-slate-500">最终分类</p>
              <p className="mt-2 text-lg font-semibold text-ink">{String(document.category ?? "未分类")} / {String(document.insight_type ?? "未标注")}</p>
              <p className="mt-2 text-sm text-slate-600">置信度：{String(document.confidence ?? "") || "未提供"}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-white p-5">
            <p className="text-sm text-slate-500">最终摘要 / 固定理由</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{String(document.summary ?? "暂无摘要")}</p>
            <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-900">{evaluation.fixedReason}</p>
            <div className="mt-4">
              <FixSourceButton
                sourceId={props.data.registry.id}
                crawlMode={evaluation.crawlMode}
                evaluationStatus={evaluation.status}
                evaluationScore={evaluation.totalScore}
                evaluationReason={evaluation.finalVerdict}
                fixedReason={evaluation.fixedReason}
                initialFixed={Boolean((props.data.registry as Record<string, unknown>).is_fixed)}
              />
              <p className="mt-3 text-xs leading-6 text-slate-500">
                固定建议标准：总分建议达到 85 分以上，且 page_fetch、clean_text、llm_analysis 这几个关键环节不能太低。
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-ink">工作流评分</h2>
          <div className="mt-5 space-y-4">
            {evaluation.steps.map((step) => (
              <article key={step.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{step.label}</p>
                    <p className="mt-1 text-sm text-slate-600">工具：{step.tool}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${step.passed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {step.score} 分
                  </span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">预计输入 / 输出</p>
                    <p className="mt-2 text-sm text-slate-700">{step.input} → {step.output}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">成功与否 / 原因</p>
                    <p className="mt-2 text-sm text-slate-700">{step.reason}</p>
                  </div>
                </div>
                {step.suggestion ? (
                  <p className="mt-3 text-sm leading-7 text-slate-600">改进建议：{step.suggestion}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-ink">关键证据</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-ink">关键词命中</p>
              <p className="mt-2 text-sm text-slate-600">来自关键词匹配步骤，会影响 LLM 理解，但不是唯一依据。</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {matchedKeywords.length ? matchedKeywords.map((keyword) => (
                  <span key={keyword} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{keyword}</span>
                )) : <span className="text-sm text-slate-500">没有命中关键词</span>}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-ink">结构化条目</p>
              <p className="mt-2 text-sm text-slate-600">来自列表提取步骤，后续适合做新闻流、卡片和时间线。</p>
              <p className="mt-3 text-2xl font-semibold text-ink">{extractedItems.length}</p>
              <p className="text-xs text-slate-500">条</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-ink">正文长度</p>
              <p className="mt-2 text-sm text-slate-600">来自正文清洗步骤，长度不是质量本身，但可帮助判断有没有抓空。</p>
              <p className="mt-3 text-2xl font-semibold text-ink">{String(document.clean_text ?? "").length}</p>
              <p className="text-xs text-slate-500">字符</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-ink">关键条目预览</p>
            <div className="mt-3 space-y-3">
              {extractedItems.slice(0, 5).map((item, index) => (
                <div key={`${item.title || "item"}-${index}`} className="rounded-2xl bg-white p-4">
                  <p className="text-sm font-semibold text-ink">{item.title || "未提取标题"}</p>
                  {item.summary ? <p className="mt-2 text-sm text-slate-600">{item.summary}</p> : null}
                  {item.date ? <p className="mt-2 text-xs text-slate-500">{item.date}</p> : null}
                </div>
              ))}
              {!extractedItems.length ? <p className="text-sm text-slate-500">这条来源没有抽出结构化条目，说明它更像详情页，或当前提取规则还不够强。</p> : null}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-ink">因果关系</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[
              {
                title: "clean_text",
                from: "正文清洗",
                affects: "给 LLM 做摘要和分类；也是后续前台详情页的基础正文。",
                risk: "如果这里抓偏，后面分类再成功也只是对错误内容做正确理解。"
              },
              {
                title: "extracted_items",
                from: "列表提取",
                affects: "做新闻条目、卡片、时间线和推送列表。",
                risk: "如果这里为空或混入按钮词，前台列表就会不准。"
              },
              {
                title: "matched_keywords",
                from: "关键词匹配",
                affects: "帮助 LLM 更快理解主题，是辅助信号。",
                risk: "关键词不是唯一核心，配错会误导，但没有关键词系统也能靠语义工作。"
              },
              {
                title: "summary / category",
                from: "LLM 分析",
                affects: "决定最终如何进入商业洞察前台、推送和导出。",
                risk: "如果这里不对，先回头检查 clean_text 和 extracted_items，再看模型。"
              }
            ].map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="mt-2 text-sm text-slate-600">来自：{item.from}</p>
                <p className="mt-2 text-sm text-slate-600">影响：{item.affects}</p>
                <p className="mt-2 text-sm text-slate-600">出错后果：{item.risk}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-ink">技术过程</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-ink">最新 LLM 运行</p>
              <p className="mt-2 text-sm text-slate-600">Provider：{String(llm.provider ?? "未记录")}</p>
              <p className="mt-2 text-sm text-slate-600">Model：{String(llm.model_name ?? "未记录")}</p>
              <p className="mt-2 text-sm text-slate-600">Status：{String(llm.status ?? "未记录")}</p>
              <p className="mt-2 text-sm text-slate-600">Fallback：{String(llm.fallback_used ?? "未记录")}</p>
              <p className="mt-2 text-sm text-slate-600">运行时间：{String(llm.duration_ms ?? "未记录")} ms</p>
              <p className="mt-2 text-sm text-slate-600">生成时间：{llm.created_at ? formatShanghaiDateTime(String(llm.created_at)) : "未记录"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-ink">最新页面版本</p>
              <p className="mt-2 text-sm text-slate-600">来自缓存：{String(version.from_cache ?? "未记录")}</p>
              <p className="mt-2 text-sm text-slate-600">本次是否变化：{String(version.is_changed ?? "未记录")}</p>
              <p className="mt-2 text-sm text-slate-600">最近检查：{version.last_checked_at ? formatShanghaiDateTime(String(version.last_checked_at)) : "未记录"}</p>
              <p className="mt-2 text-sm text-slate-600">最近抓取：{version.last_fetched_at ? formatShanghaiDateTime(String(version.last_fetched_at)) : "未记录"}</p>
              <p className="mt-2 text-sm text-slate-600">最近变化：{version.last_changed_at ? formatShanghaiDateTime(String(version.last_changed_at)) : "未记录"}</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-ink">下一步建议动作</p>
            <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
              <li>{evaluation.recommendedAction}</li>
              <li>如果总分未达标，优先盯着工作流评分里最低的那一步看。</li>
              <li>如果页面本身失效或抓偏，不要先怪 LLM，先换来源或修清洗。</li>
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
