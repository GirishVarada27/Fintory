import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getDashboardSummary,
  getDashboardHistory,
  type DashboardSummary,
  type DashboardHistory,
  type CategoryTotal,
} from "../api/dashboard";
import { cardClass, secondaryButtonClass } from "../lib/ui";
import { formatMoney } from "../../../shared/currency";

// Matches the brand gradient used across the app (NavBar wordmark, buttons,
// PDF report) so charts read as part of the same product, not a bolted-on
// widget with its own palette.
const CHART_COLORS = ["#d946ef", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e"];
const EMERALD = "#10b981";
const ROSE = "#f43f5e";
const VIOLET = "#8b5cf6";
const FUCHSIA = "#d946ef";

function monthLabel(monthStr: string): string {
  const [, month] = monthStr.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[Number(month) - 1] ?? monthStr;
}

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function TrendTooltip({
  active,
  payload,
  label,
  currency,
  formatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  currency?: string;
  formatter?: (value: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const format = formatter ?? ((v: number) => formatMoney(v, currency ?? "USD"));
  return (
    <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-slate-900">
      <p className="mb-1 font-semibold text-slate-900 dark:text-white">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {format(entry.value)}
        </p>
      ))}
    </div>
  );
}

function DonutCard({
  title,
  data,
  currency,
  total,
  showPercentage,
}: {
  title: string;
  data: CategoryTotal[];
  currency: string;
  total: number;
  showPercentage: boolean;
}) {
  const chartData = data.map((d) => ({ name: d.categoryName, value: Number(d.total) }));
  return (
    <div className={cardClass}>
      <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      {chartData.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">No data yet.</p>
      ) : (
        <div className="relative">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                {chartData.map((entry, i) => (
                  <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip content={<TrendTooltip currency={currency} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{formatMoney(total, currency)}</p>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
            {chartData.map((entry, i) => (
              <li key={entry.name} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    aria-hidden="true"
                  />
                  {entry.name}
                </span>
                <span>
                  {showPercentage
                    ? `${total > 0 ? Math.round((entry.value / total) * 100) : 0}%`
                    : `${formatMoney(entry.value, currency)} (${total > 0 ? Math.round((entry.value / total) * 100) : 0}%)`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [history, setHistory] = useState<DashboardHistory | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [showPercentage, setShowPercentage] = useState(false);

  useEffect(() => {
    getDashboardSummary().then((res) => {
      setSummary(res.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    getDashboardHistory(selectedYear).then((res) => setHistory(res.data));
  }, [selectedYear]);

  if (loading) return <p className="text-slate-600 dark:text-slate-400">Loading…</p>;
  if (!summary) return null;

  const { converted } = summary;
  const currency = converted.currency;

  const nativeSummary =
    summary.byCurrency.find((c) => c.currency === currency) ?? summary.byCurrency[0] ?? null;
  const expenseCategoryData = (nativeSummary?.categoryBreakdown ?? [])
    .slice()
    .sort((a, b) => Number(b.total) - Number(a.total))
    .map((c) => ({ categoryName: c.categoryName, total: Number(c.total) }));
  const expenseCategoryTotal = expenseCategoryData.reduce((sum, c) => sum + c.total, 0);
  const expenseChartData = expenseCategoryData.map((c) => ({
    categoryName: c.categoryName,
    value: showPercentage ? (expenseCategoryTotal > 0 ? (c.total / expenseCategoryTotal) * 100 : 0) : c.total,
  }));
  const expenseValueFormatter = showPercentage
    ? (v: number) => `${Math.round(v)}%`
    : (v: number) => formatMoney(v, nativeSummary?.currency ?? currency);

  const assetsTotal = summary.assetsByType.reduce((sum, a) => sum + Number(a.total), 0);
  const liabilitiesTotal = summary.liabilitiesByType.reduce((sum, l) => sum + Number(l.total), 0);

  // The API returns amounts as decimal strings (precision-safe over the
  // wire); recharts needs actual numbers or its scales silently treat them
  // as categorical and render nothing.
  const historyChartData =
    history?.points.map((p) => ({
      month: monthLabel(p.month),
      income: Number(p.income),
      expenses: Number(p.expenses),
      cashFlow: Number(p.cashFlow),
      netWorth: Number(p.netWorth),
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{summary.month}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/v1/export/report.pdf?month=${summary.month}`} className={secondaryButtonClass}>
            Export PDF report
          </a>
          <a
            href={`/api/v1/export/report.pdf?month=${summary.month}&format=percentage`}
            className={secondaryButtonClass}
          >
            Export PDF report (%)
          </a>
        </div>
      </div>

      {converted.unavailable ? (
        <div className={cardClass}>
          <p className="text-sm text-amber-600 dark:text-amber-400">{converted.note}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className={cardClass}>
            <span aria-hidden="true" className="text-xl">
              💰
            </span>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Net Worth</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{formatMoney(converted.netWorth, currency)}</p>
          </div>
          <div className={cardClass}>
            <span aria-hidden="true" className="text-xl">
              💵
            </span>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Income</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {formatMoney(converted.monthTotalIncome, currency)}
            </p>
          </div>
          <div className={cardClass}>
            <span aria-hidden="true" className="text-xl">
              💳
            </span>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Expenses</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {formatMoney(converted.monthTotalSpend, currency)}
            </p>
          </div>
          <div className={cardClass}>
            <span aria-hidden="true" className="text-xl">
              🏦
            </span>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Savings</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {formatMoney(converted.savingsTotal, currency)}
            </p>
          </div>
        </div>
      )}

      {summary.insights.length > 0 && (
        <div className={cardClass}>
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Insights</h2>
          <ul className="space-y-2">
            {summary.insights.map((insight) => (
              <li
                key={`${insight.currency}-${insight.categoryName}`}
                className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
              >
                <span aria-hidden="true">{insight.direction === "up" ? "📈" : "📉"}</span>
                <span>{insight.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {history && history.availableYears.length > 0 && (
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
            Yearly trends
          </h2>
          <div className="flex gap-1">
            {history.availableYears.map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                aria-pressed={year === selectedYear}
                className={
                  year === selectedYear
                    ? "rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-500 px-3 py-1 text-xs font-semibold text-white"
                    : "rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-black/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
                }
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      )}

      {history && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className={cardClass}>
            <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Net Worth by Month</h2>
            {history.unavailable ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Currency conversion is temporarily unavailable, so this trend can't be shown right now.
              </p>
            ) : history.points.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">No data for {selectedYear} yet.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={historyChartData}>
                    <defs>
                      <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={FUCHSIA} stopOpacity={0.5} />
                        <stop offset="95%" stopColor={FUCHSIA} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="text-slate-200 dark:text-white/10" stroke="currentColor" />
                    <XAxis dataKey="month" className="text-slate-500" stroke="currentColor" fontSize={12} />
                    <YAxis
                      className="text-slate-500"
                      stroke="currentColor"
                      fontSize={12}
                      tickFormatter={formatCompact}
                    />
                    <Tooltip content={<TrendTooltip currency={history.currency} />} />
                    <Area
                      type="monotone"
                      dataKey="netWorth"
                      name="Net Worth"
                      stroke={FUCHSIA}
                      strokeWidth={2}
                      fill="url(#netWorthGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="mt-2 text-xs text-slate-500">
                  Loan balances reflect real month-by-month amortization; assets and savings are shown at their
                  current value across every month since Fintory doesn't keep a historical balance ledger.
                </p>
              </>
            )}
          </div>

          <div className={cardClass}>
            <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
              Income, Expenses &amp; Cash Flow
            </h2>
            {history.unavailable ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Currency conversion is temporarily unavailable, so this trend can't be shown right now.
              </p>
            ) : history.points.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">No data for {selectedYear} yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={historyChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="text-slate-200 dark:text-white/10" stroke="currentColor" />
                  <XAxis dataKey="month" className="text-slate-500" stroke="currentColor" fontSize={12} />
                  <YAxis className="text-slate-500" stroke="currentColor" fontSize={12} tickFormatter={formatCompact} />
                  <Tooltip content={<TrendTooltip currency={history.currency} />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" name="Income" fill={EMERALD} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill={ROSE} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="cashFlow" name="Cash Flow" stroke={VIOLET} strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          Assets, Liabilities &amp; Expenses
        </h2>
        <button
          onClick={() => setShowPercentage((v) => !v)}
          aria-pressed={showPercentage}
          className={secondaryButtonClass}
        >
          {showPercentage ? "Show as amount" : "Show as %"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DonutCard
          title="Assets by Category"
          data={summary.assetsByType}
          currency={currency}
          total={assetsTotal}
          showPercentage={showPercentage}
        />
        <DonutCard
          title="Liabilities by Category"
          data={summary.liabilitiesByType}
          currency={currency}
          total={liabilitiesTotal}
          showPercentage={showPercentage}
        />
        <div className={cardClass}>
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Expenses by Category</h2>
          {expenseChartData.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">No expenses recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={expenseChartData} layout="vertical" margin={{ left: 8, right: 40 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="categoryName"
                  width={90}
                  className="text-slate-600 dark:text-slate-400"
                  stroke="currentColor"
                  fontSize={12}
                />
                <Tooltip content={<TrendTooltip formatter={expenseValueFormatter} />} />
                <Bar dataKey="value" name="Amount" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {expenseChartData.map((entry, i) => (
                    <Cell key={entry.categoryName} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    className="fill-slate-700 dark:fill-slate-300"
                    fontSize={11}
                    formatter={(v: string | number | boolean | null | undefined) =>
                      expenseValueFormatter(Number(v ?? 0))
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
