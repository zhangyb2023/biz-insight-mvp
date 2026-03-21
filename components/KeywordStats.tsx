type Props = {
  items: Array<{ keyword: string; count: number }>;
};

export function KeywordStats({ items }: Props) {
  return (
    <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel backdrop-blur">
      <h2 className="text-lg font-semibold text-ink">热门关键词</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.keyword} className="flex items-center justify-between rounded-2xl bg-sand px-4 py-3">
            <span className="font-medium text-ink">{item.keyword}</span>
            <span className="text-sm text-slate-500">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
