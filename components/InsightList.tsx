type InsightItem = {
  title: string;
  company_name?: string;
  fetch_date?: string;
  url: string;
  summary?: string;
  insight_type?: string;
  category?: string;
  insight_event_type?: string;
  insight_importance_level?: "" | "high" | "medium" | "low";
  insight_evidence_strength?: number | null;
  insight_confidence?: number | null;
  insight_statement?: string;
  insight_why_it_matters?: string;
  insight_next_action?: string;
  insight_to_phua_relation?: string[];
  insight_topic_tags?: string[];
  insight_supporting_facts?: string[];
  insight_risk_note?: string;
  insight_updated_at?: string | null;
};

type Props = {
  items: InsightItem[];
};

export function InsightList({ items }: Props) {
  return (
    <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel backdrop-blur">
      <h2 className="text-lg font-semibold text-ink">最新洞察</h2>
      <div className="mt-4 space-y-4">
        {items.map((item) => (
          <article key={`${item.url}-${item.fetch_date ?? ""}`} className="rounded-2xl border border-slate-100 bg-white px-4 py-4">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              {item.company_name ? <span>{item.company_name}</span> : null}
              {item.insight_type ? <span>{item.insight_type}</span> : null}
              {item.category ? <span>{item.category}</span> : null}
              {item.fetch_date ? <span>{item.fetch_date}</span> : null}
            </div>
            <h3 className="mt-2 text-base font-semibold text-ink">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary || "待生成摘要"}</p>
            <a className="mt-3 inline-flex text-sm font-medium" href={item.url} target="_blank" rel="noreferrer">
              原文链接
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}
