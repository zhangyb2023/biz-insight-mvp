import Head from "next/head";
import { useEffect, useMemo, useState } from "react";

type TraceRow = {
  id: number;
  provider: string;
  prompt_version: string;
  model_name: string;
  status: string;
  fallback_used: boolean;
  retry_count: number;
  duration_ms: number;
  error_message: string;
  llm_confidence: number | null;
  created_at: string;
  company_id: string | null;
  doc_url: string | null;
  doc_title: string | null;
  insight_summary: string | null;
  insight_confidence: number | null;
  insight_category: string | null;
  item_count: number;
  input_payload: unknown;
  parsed_json: unknown;
  raw_response: string;
};

const DEFAULT_SYSTEM_PROMPT = "你是汽车电子基础软件行业的商业洞察分析专家。请只基于输入数据进行判断，不编造事实，输出结构化中文结论。";
const DEFAULT_USER_PROMPT = [
  "请基于输入数据生成一条商业洞察。",
  "要求：",
  "1. 说明核心事件",
  "2. 说明为什么重要",
  "3. 说明对普华的可能影响",
  "4. 给出一个具体跟进行动",
  "5. 如果证据不足，请明确说明边界"
].join("\n");

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function formatDate(value: string) {
  if (!value) return "未知";
  try {
    return new Date(value).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return value;
  }
}

function statusClass(status: string, fallbackUsed: boolean) {
  if (fallbackUsed) return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "success") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "failed") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

export default function LlmTracePage() {
  const [rows, setRows] = useState<TraceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [limit, setLimit] = useState(20);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [userPrompt, setUserPrompt] = useState(DEFAULT_USER_PROMPT);
  const [testInput, setTestInput] = useState("{}");
  const [temperature, setTemperature] = useState(0.2);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    raw_response: string;
    model_name: string;
    duration_ms: number;
    usage?: unknown;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/db/llm-trace?limit=${limit}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.rows)) {
          setRows(data.rows);
        } else {
          setRows([]);
          setError(data.error || "LLM trace 数据格式异常");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "读取 LLM trace 失败");
      })
      .finally(() => setLoading(false));
  }, [limit]);

  const summary = useMemo(() => {
    const total = rows.length;
    const fallback = rows.filter((row) => row.fallback_used).length;
    const failed = rows.filter((row) => row.status === "failed").length;
    const avgDuration = total
      ? Math.round(rows.reduce((sum, row) => sum + (row.duration_ms || 0), 0) / total)
      : 0;
    return { total, fallback, failed, avgDuration };
  }, [rows]);

  function loadTraceIntoTester(row: TraceRow) {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setUserPrompt(DEFAULT_USER_PROMPT);
    setTestInput(formatJson(row.input_payload));
    setTestResult(null);
    setTestError(null);
    setExpandedId(row.id);
  }

  async function runTest() {
    setTesting(true);
    setTestError(null);
    setTestResult(null);

    let parsedInput: unknown;
    try {
      parsedInput = JSON.parse(testInput || "{}");
    } catch {
      setTesting(false);
      setTestError("输入 Payload 不是合法 JSON");
      return;
    }

    try {
      const response = await fetch("/api/llm/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt,
          userPrompt,
          inputPayload: parsedInput,
          temperature
        })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "测试调用失败");
      }
      setTestResult({
        raw_response: data.raw_response || "",
        model_name: data.model_name || "",
        duration_ms: data.duration_ms || 0,
        usage: data.usage
      });
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "测试调用失败");
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <Head>
        <title>LLM 白盒调试 | Biz Insight</title>
      </Head>
      <main className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-4">
              <a href="/" className="text-sm text-slate-500 hover:text-slate-700">返回首页</a>
              <div>
                <h1 className="text-xl font-semibold text-ink">LLM 白盒调试</h1>
                <p className="text-sm text-slate-500">查看模型调用记录，也可以基于历史输入试跑提示词；测试结果不会写入数据库</p>
              </div>
            </div>
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="rounded border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value={10}>最近 10 条</option>
              <option value={20}>最近 20 条</option>
              <option value={50}>最近 50 条</option>
            </select>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-6 py-6">
          <section className="mb-6 rounded-lg border border-indigo-200 bg-white p-4">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-ink">提示词测试区</h2>
                <p className="mt-1 text-xs text-slate-500">
                  用法：先从下方历史记录点“载入测试区”，再改提示词并试跑。这里只调用模型，不覆盖正式报告。
                </p>
              </div>
              <button
                onClick={runTest}
                disabled={testing}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {testing ? "测试中..." : "试跑提示词"}
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">System Prompt</label>
                <textarea
                  value={systemPrompt}
                  onChange={(event) => setSystemPrompt(event.target.value)}
                  className="h-40 w-full rounded border border-slate-200 p-3 text-xs focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">User Prompt</label>
                <textarea
                  value={userPrompt}
                  onChange={(event) => setUserPrompt(event.target.value)}
                  className="h-40 w-full rounded border border-slate-200 p-3 text-xs focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-500">输入 Payload JSON</label>
                  <label className="text-xs text-slate-500">
                    温度
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={temperature}
                      onChange={(event) => setTemperature(Number(event.target.value))}
                      className="ml-2 w-16 rounded border border-slate-200 px-2 py-1"
                    />
                  </label>
                </div>
                <textarea
                  value={testInput}
                  onChange={(event) => setTestInput(event.target.value)}
                  className="h-40 w-full rounded border border-slate-200 p-3 font-mono text-xs focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>

            {testError && (
              <div className="mt-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {testError}
              </div>
            )}

            {testResult && (
              <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>模型：{testResult.model_name}</span>
                  <span>耗时：{testResult.duration_ms} ms</span>
                  {testResult.usage ? <span>Usage：{formatJson(testResult.usage)}</span> : null}
                </div>
                <pre className="max-h-80 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
                  {testResult.raw_response || "无输出"}
                </pre>
              </div>
            )}
          </section>

          <section className="mb-6 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">记录数</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{summary.total}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Fallback</p>
              <p className="mt-1 text-2xl font-semibold text-amber-600">{summary.fallback}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">失败</p>
              <p className="mt-1 text-2xl font-semibold text-rose-600">{summary.failed}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">平均耗时</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{summary.avgDuration} ms</p>
            </div>
          </section>

          {loading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              正在读取 LLM 调用记录...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              暂无 LLM 调用记录。
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((row) => {
                const expanded = expandedId === row.id;
                return (
                  <article key={row.id} className="rounded-lg border border-slate-200 bg-white">
                    <button
                      onClick={() => setExpandedId(expanded ? null : row.id)}
                      className="flex w-full items-start justify-between gap-4 p-4 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded border px-2 py-0.5 text-xs ${statusClass(row.status, row.fallback_used)}`}>
                            {row.fallback_used ? "fallback" : row.status}
                          </span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {row.provider || "unknown"} / {row.model_name}
                          </span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {row.prompt_version}
                          </span>
                          <span className="text-xs text-slate-400">{formatDate(row.created_at)}</span>
                        </div>
                        <h2 className="truncate text-sm font-semibold text-ink">
                          {row.doc_title || row.insight_summary || "未关联文档"}
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          公司：{row.company_id || "未知"} · 输入条目：{row.item_count} · 重试：{row.retry_count} · 耗时：{row.duration_ms} ms
                        </p>
                        {row.error_message && (
                          <p className="mt-2 text-xs text-rose-600">错误：{row.error_message}</p>
                        )}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            loadTraceIntoTester(row);
                          }}
                          className="mt-3 rounded border border-indigo-200 px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-50"
                        >
                          载入测试区
                        </button>
                      </div>
                      <span className="text-sm text-slate-400">{expanded ? "收起" : "展开"}</span>
                    </button>

                    {expanded && (
                      <div className="border-t border-slate-100 p-4">
                        {row.doc_url && (
                          <a href={row.doc_url} target="_blank" rel="noopener noreferrer" className="mb-4 inline-flex text-sm text-moss hover:underline">
                            查看原文 ↗
                          </a>
                        )}
                        <div className="grid gap-4 lg:grid-cols-3">
                          <div>
                            <h3 className="mb-2 text-xs font-semibold text-slate-500">输入 Payload</h3>
                            <pre className="max-h-96 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
                              {formatJson(row.input_payload)}
                            </pre>
                          </div>
                          <div>
                            <h3 className="mb-2 text-xs font-semibold text-slate-500">解析 JSON</h3>
                            <pre className="max-h-96 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
                              {formatJson(row.parsed_json)}
                            </pre>
                          </div>
                          <div>
                            <h3 className="mb-2 text-xs font-semibold text-slate-500">原始输出</h3>
                            <pre className="max-h-96 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
                              {row.raw_response || "无原始输出"}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
