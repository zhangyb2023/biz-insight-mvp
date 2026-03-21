import Head from "next/head";
import type { GetServerSideProps } from "next";
import { useEffect, useState, useMemo } from "react";

type ConsumptionItem = {
  company_id: string;
  company_name: string;
  url: string;
  title: string;
  source_domain: string;
  source_type: string;
  quality_score: number;
  is_high_value: boolean;
  is_noise: boolean;
  noise_reason: string;
  quality_reason: string;
  matched_rules: string[];
};

type Props = {
  initialItems: ConsumptionItem[];
};

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const { listConsumptionItems } = await import("@/lib/db/repository");
  const items = listConsumptionItems({ limit: 500 });
  
  return {
    props: {
      initialItems: items as unknown as ConsumptionItem[]
    }
  };
};

export default function QualityDebugPage({ initialItems }: Props) {
  const [items, setItems] = useState<ConsumptionItem[]>(initialItems);

  const stats = useMemo(() => {
    const total = items.length;
    const highValueCount = items.filter(i => i.is_high_value).length;
    const noiseCount = items.filter(i => i.is_noise).length;
    const avgScore = total > 0 ? Math.round(items.reduce((sum, i) => sum + (i.quality_score || 0), 0) / total) : 0;

    const sourceTypeDist: Record<string, number> = {};
    items.forEach(item => {
      const t = item.source_type || "unknown";
      sourceTypeDist[t] = (sourceTypeDist[t] || 0) + 1;
    });

    const domainScores: Record<string, { total: number; count: number; noise: number }> = {};
    items.forEach(item => {
      const domain = item.source_domain || "unknown";
      if (!domainScores[domain]) {
        domainScores[domain] = { total: 0, count: 0, noise: 0 };
      }
      domainScores[domain].total += item.quality_score || 0;
      domainScores[domain].count += 1;
      if (item.is_noise) domainScores[domain].noise += 1;
    });

    const domainList = Object.entries(domainScores)
      .map(([domain, data]) => ({
        domain,
        avgScore: Math.round(data.total / data.count),
        count: data.count,
        noiseCount: data.noise
      }))
      .sort((a, b) => a.avgScore - b.avgScore);

    const highValueItems = items.filter(i => i.is_high_value).slice(0, 5);
    const noiseItems = items.filter(i => i.is_noise).slice(0, 5);

    return {
      total,
      highValueCount,
      noiseCount,
      avgScore,
      sourceTypeDist,
      domainList,
      highValueItems,
      noiseItems
    };
  }, [items]);

  return (
    <>
      <Head>
        <title>质量调试视图 - Quality Debug</title>
      </Head>
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-6 text-2xl font-bold text-slate-800">质量调试视图</h1>

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
            <div className="rounded-lg bg-white p-4 shadow">
              <div className="text-sm text-slate-500">总条数</div>
              <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <div className="text-sm text-slate-500">高价值</div>
              <div className="text-2xl font-bold text-green-600">
                {stats.highValueCount}
                <span className="ml-2 text-sm font-normal text-slate-400">
                  ({stats.total > 0 ? Math.round(stats.highValueCount / stats.total * 100) : 0}%)
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <div className="text-sm text-slate-500">噪音</div>
              <div className="text-2xl font-bold text-red-600">
                {stats.noiseCount}
                <span className="ml-2 text-sm font-normal text-slate-400">
                  ({stats.total > 0 ? Math.round(stats.noiseCount / stats.total * 100) : 0}%)
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <div className="text-sm text-slate-500">平均分</div>
              <div className="text-2xl font-bold text-blue-600">{stats.avgScore}</div>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <div className="text-sm text-slate-500">数据来源</div>
              <div className="text-2xl font-bold text-slate-800">{Object.keys(stats.sourceTypeDist).length}</div>
            </div>
          </div>

          <div className="mb-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-lg bg-white p-4 shadow">
              <h2 className="mb-3 text-lg font-semibold text-slate-700">source_type 分布</h2>
              <div className="space-y-1">
                {Object.entries(stats.sourceTypeDist)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="flex justify-between text-sm">
                      <span className="text-slate-600">{type}</span>
                      <span className="font-medium text-slate-800">{count}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow">
              <h2 className="mb-3 text-lg font-semibold text-slate-700">低质量来源域名 (Top 10)</h2>
              <div className="space-y-1">
                {stats.domainList.slice(0, 10).map((d) => (
                  <div key={d.domain} className="flex justify-between text-sm">
                    <span className="text-slate-600 truncate" title={d.domain}>{d.domain}</span>
                    <div className="flex gap-3">
                      <span className="text-slate-400">{d.count}条</span>
                      <span className={d.avgScore < 40 ? "text-red-500" : d.avgScore < 60 ? "text-yellow-500" : "text-green-500"}>
                        {d.avgScore}分
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg bg-white p-4 shadow">
              <h2 className="mb-3 text-lg font-semibold text-green-700">高价值数据预览 (Top 5)</h2>
              {stats.highValueItems.length > 0 ? (
                <div className="space-y-2">
                  {stats.highValueItems.map((item, idx) => (
                    <div key={idx} className="rounded bg-green-50 p-2 text-sm">
                      <div className="truncate font-medium text-slate-700" title={item.title}>{item.title}</div>
                      <div className="mt-1 flex gap-2 text-xs text-slate-500">
                        <span>{item.source_type}</span>
                        <span>{item.quality_score}分</span>
                        <span className="truncate">{item.source_domain}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-400">无高价值数据</div>
              )}
            </div>

            <div className="rounded-lg bg-white p-4 shadow">
              <h2 className="mb-3 text-lg font-semibold text-red-700">噪音数据预览 (Top 5)</h2>
              {stats.noiseItems.length > 0 ? (
                <div className="space-y-2">
                  {stats.noiseItems.map((item, idx) => (
                    <div key={idx} className="rounded bg-red-50 p-2 text-sm">
                      <div className="truncate font-medium text-slate-700" title={item.title}>{item.title}</div>
                      <div className="mt-1 flex gap-2 text-xs text-slate-500">
                        <span>{item.source_type}</span>
                        <span>{item.noise_reason || "噪音"}</span>
                        <span className="truncate">{item.source_domain}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-400">无噪音数据</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
