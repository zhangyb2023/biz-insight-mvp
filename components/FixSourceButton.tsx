"use client";

import { useState } from "react";

type Props = {
  sourceId: number;
  crawlMode: string;
  evaluationStatus: string;
  evaluationScore: number;
  evaluationReason: string;
  fixedReason: string;
  initialFixed: boolean;
};

export function FixSourceButton(props: Props) {
  const [isFixed, setIsFixed] = useState(props.initialFixed);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function toggleFixed(next: boolean) {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/sources/${props.sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crawlMode: props.crawlMode,
          evaluationStatus: props.evaluationStatus,
          evaluationScore: props.evaluationScore,
          evaluationReason: props.evaluationReason,
          fixedReason: props.fixedReason,
          isFixed: next
        })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setMessage(`操作失败：${data.error || data.message || "未知错误"}`);
        return;
      }
      setIsFixed(next);
      setMessage(next ? "已固定为当前抓取模式。" : "已取消固定。");
    } catch (error) {
      setMessage(`操作失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={loading}
        onClick={() => toggleFixed(!isFixed)}
        className={`rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60 ${
          isFixed
            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border border-slate-200 bg-white text-slate-700"
        }`}
      >
        {loading ? "提交中..." : isFixed ? "取消固定" : "固定为当前模式"}
      </button>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isFixed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
        {isFixed ? "已固定" : "未固定"}
      </span>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
