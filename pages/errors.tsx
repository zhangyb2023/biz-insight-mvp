import Head from "next/head";
import type { GetServerSideProps } from "next";

import { getErrorCenterItems } from "@/lib/db/repository";

type Props = {
  items: ReturnType<typeof getErrorCenterItems>;
};

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  return {
    props: {
      items: getErrorCenterItems()
    }
  };
};

export default function ErrorsPage({ items }: Props) {
  return (
    <>
      <Head>
        <title>Error Center | Biz Insight MVP</title>
      </Head>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-moss">Error Center</p>
            <h1 className="mt-2 text-4xl font-semibold text-ink">错误中心</h1>
          </div>
          <a href="/" className="inline-flex rounded-full bg-moss px-5 py-3 text-sm font-semibold text-white">
            返回控制台
          </a>
        </div>

        <section className="mt-8 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-3 py-2">时间</th>
                  <th className="px-3 py-2">任务 ID</th>
                  <th className="px-3 py-2">公司</th>
                  <th className="px-3 py-2">URL</th>
                  <th className="px-3 py-2">失败步骤</th>
                  <th className="px-3 py-2">错误详情</th>
                  <th className="px-3 py-2">重试</th>
                  <th className="px-3 py-2">最近成功</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-3">{item.end_time || "-"}</td>
                    <td className="px-3 py-3">{item.job_id}</td>
                    <td className="px-3 py-3">{item.company_id || "-"}</td>
                    <td className="px-3 py-3 max-w-md break-all">{item.source_url || "-"}</td>
                    <td className="px-3 py-3">{item.step_name}</td>
                    <td className="px-3 py-3 max-w-xl break-words text-red-600">{item.error_message || "-"}</td>
                    <td className="px-3 py-3">{item.retry_count}</td>
                    <td className="px-3 py-3">{item.last_success_at || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
