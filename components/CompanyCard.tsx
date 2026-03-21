import Link from "next/link";

type Props = {
  company: {
    id: string;
    name: string;
    website: string;
    keywords: string[];
  };
};

export function CompanyCard({ company }: Props) {
  return (
    <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">{company.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{company.website}</p>
        </div>
        <Link className="rounded-full bg-moss px-4 py-2 text-sm font-medium text-white" href={`/company/${company.id}`}>
          查看详情
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {company.keywords.map((keyword) => (
          <span key={keyword} className="rounded-full bg-mint px-3 py-1 text-xs font-medium text-ink">
            {keyword}
          </span>
        ))}
      </div>
    </div>
  );
}
