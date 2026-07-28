import { useEffect, useState } from "react";
import { getDashboardSummary, type DashboardSummary } from "../api/dashboard";
import { cardClass, secondaryButtonClass } from "../lib/ui";

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardSummary().then((res) => {
      setSummary(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="text-slate-400">Loading…</p>;
  if (!summary) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400">{summary.month}</p>
        </div>
        <a href={`/api/v1/export/report.pdf?month=${summary.month}`} className={secondaryButtonClass}>
          Export PDF report
        </a>
      </div>

      <div className={cardClass}>
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">Converted total</h2>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
            {summary.converted.currency}
          </span>
        </div>
        {summary.converted.unavailable ? (
          <p className="text-sm text-amber-400">{summary.converted.note}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-gradient-to-br from-fuchsia-500/10 to-violet-500/10 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">This month's spend</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {summary.converted.monthTotalSpend} {summary.converted.currency}
                </p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Net worth</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {summary.converted.netWorth} {summary.converted.currency}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">{summary.converted.note}</p>
          </>
        )}
      </div>

      {summary.byCurrency.length === 0 ? (
        <p className="text-slate-400">Add some expenses, savings, or assets to see your dashboard.</p>
      ) : (
        <div>
          <h2 className="mb-3 text-sm uppercase tracking-wide text-slate-500">Native per-currency breakdown</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {summary.byCurrency.map((c) => (
              <div key={c.currency} className={cardClass}>
                <h3 className="mb-4 text-lg font-semibold text-white">{c.currency}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-gradient-to-br from-fuchsia-500/10 to-violet-500/10 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">This month's spend</p>
                    <p className="mt-1 text-2xl font-bold text-white">
                      {c.monthTotalSpend} {c.currency}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Net worth</p>
                    <p className="mt-1 text-2xl font-bold text-white">
                      {c.netWorth} {c.currency}
                    </p>
                  </div>
                </div>
                {c.categoryBreakdown.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Category breakdown</p>
                    <ul className="space-y-1 text-sm text-slate-300">
                      {c.categoryBreakdown
                        .slice()
                        .sort((a, b) => Number(b.total) - Number(a.total))
                        .map((cat) => (
                          <li key={cat.categoryName} className="flex justify-between">
                            <span>{cat.categoryName}</span>
                            <span>
                              {cat.total} {c.currency}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
