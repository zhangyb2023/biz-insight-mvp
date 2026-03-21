import Head from "next/head";
import type { GetServerSideProps } from "next";

import { getTableColumns, getTableRows, parseIncludeInactive } from "@/lib/db/repository";

type Props = {
  table: string;
  includeInactive: boolean;
  columns: ReturnType<typeof getTableColumns>;
  rows: ReturnType<typeof getTableRows>;
};

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const table = String(context.params?.table || "");
  const includeInactive = parseIncludeInactive(context.query.includeInactive);
  return {
    props: {
      table,
      includeInactive,
      columns: getTableColumns(table),
      rows: getTableRows(table, 100, { includeInactive })
    }
  };
};

export default function DataTablePage({ table, includeInactive, columns, rows }: Props) {
  return (
    <>
      <Head>
        <title>{table} | Data Explorer</title>
      </Head>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-moss">Data Explorer</p>
            <h1 className="mt-2 text-4xl font-semibold text-ink">{table}</h1>
            <p className="mt-2 text-sm text-slate-600">
              当前模式：{includeInactive ? "显示历史数据" : "仅当前 active 公司"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={`/data/${table}`}
              className={`inline-flex rounded-full px-5 py-3 text-sm font-semibold ${
                includeInactive ? "border border-slate-200 bg-white text-slate-700" : "bg-moss text-white"
              }`}
            >
              仅当前 active 公司
            </a>
            <a
              href={`/data/${table}?includeInactive=true`}
              className={`inline-flex rounded-full px-5 py-3 text-sm font-semibold ${
                includeInactive ? "bg-ember text-white" : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              显示历史数据
            </a>
            <a href="/data" className="inline-flex rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
              返回表列表
            </a>
          </div>
        </div>
        <section className="mt-8 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  {columns.map((column) => (
                    <th key={column.name} className="px-3 py-2">{column.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    {columns.map((column) => (
                      <td key={column.name} className="max-w-sm px-3 py-3 align-top">
                        <pre className="whitespace-pre-wrap break-words text-xs text-slate-700">
                          {typeof row[column.name] === "string" ? String(row[column.name]) : JSON.stringify(row[column.name], null, 2)}
                        </pre>
                      </td>
                    ))}
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
