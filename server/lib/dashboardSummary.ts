import { and, eq, gte, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { assets, categories, expenses, loans, savingsAccounts, user as userTable } from "../db/schema";
import type * as schema from "../db/schema";
import { computeLoanAmortization } from "../../shared/amortization";
import { getCategorySpend, type CategorySpendRow } from "./categorySpend";
import { monthRange, previousMonthOf } from "./dateRange";
import { convertOnDate } from "./fx";
import { computeSpendingInsights, type SpendingInsight } from "./insights";

export interface CategoryTotal {
  categoryName: string;
  total: string;
}

export interface CurrencySummary {
  currency: string;
  monthTotalSpend: string;
  categoryBreakdown: CategoryTotal[];
  netWorth: string;
}

function buildCategoryBreakdown(
  spendRows: CategorySpendRow[],
  currency: string,
  categoryNameById: Map<string, string>,
): CategoryTotal[] {
  const breakdownMap = new Map<string, number>();
  for (const r of spendRows.filter((row) => row.currency === currency)) {
    const key = r.categoryId ? (categoryNameById.get(r.categoryId) ?? "Uncategorized") : "Uncategorized";
    breakdownMap.set(key, (breakdownMap.get(key) ?? 0) + r.amount);
  }
  return Array.from(breakdownMap.entries()).map(([categoryName, total]) => ({
    categoryName,
    total: total.toFixed(2),
  }));
}

export interface ConvertedSummary {
  currency: string;
  monthTotalSpend: string;
  netWorth: string;
  note: string;
  unavailable: boolean;
}

export interface DashboardSummaryData {
  month: string;
  byCurrency: CurrencySummary[];
  converted: ConvertedSummary;
  insights: SpendingInsight[];
}

function outstandingPrincipalOf(loan: {
  principal: string;
  apr: string;
  termMonths: number;
  monthlyPayment: string;
  startDate: string;
}): number {
  return computeLoanAmortization({
    principal: Number(loan.principal),
    apr: Number(loan.apr),
    termMonths: loan.termMonths,
    monthlyPayment: Number(loan.monthlyPayment),
    startDate: loan.startDate,
  }).outstandingPrincipal;
}

export async function computeDashboardSummary(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
  monthParam: string | undefined,
): Promise<DashboardSummaryData> {
  const { start, end, month } = monthRange(monthParam);

  // Sequential, not Promise.all: these all share one transaction-scoped
  // connection, which can't actually run queries concurrently anyway — doing
  // so trips node-postgres's "query already in progress" deprecation warning.
  const spendRows = await getCategorySpend(tx, userId, start, end);
  const prevRange = monthRange(previousMonthOf(month));
  const prevSpendRows = await getCategorySpend(tx, userId, prevRange.start, prevRange.end);
  const allCategories = await tx.select().from(categories);
  const allAssets = await tx.select().from(assets).where(eq(assets.userId, userId));
  const allSavings = await tx.select().from(savingsAccounts).where(eq(savingsAccounts.userId, userId));
  const allLoans = await tx.select().from(loans).where(eq(loans.userId, userId));
  const [userRow] = await tx
    .select({ defaultDisplayCurrency: userTable.defaultDisplayCurrency })
    .from(userTable)
    .where(eq(userTable.id, userId));
  // Raw (not category-split) rows for converted-total purposes: a split
  // expense's parent amount is still the true total spent that day.
  const monthExpenseDates = await tx
    .select({ date: expenses.date, currency: expenses.currency, amount: expenses.amount })
    .from(expenses)
    .where(and(eq(expenses.userId, userId), gte(expenses.date, start), lt(expenses.date, end)));

  const categoryNameById = new Map(allCategories.map((c) => [c.id, c.name]));

  const currencies = new Set<string>([
    ...spendRows.map((r) => r.currency),
    ...allAssets.map((a) => a.currency),
    ...allSavings.map((s) => s.currency),
    ...allLoans.map((l) => l.currency),
  ]);

  const byCurrency: CurrencySummary[] = Array.from(currencies).map((currency) => {
    const currencySpend = spendRows.filter((r) => r.currency === currency);
    const monthTotalSpend = currencySpend.reduce((sum, r) => sum + r.amount, 0);
    const categoryBreakdown = buildCategoryBreakdown(spendRows, currency, categoryNameById);

    const assetsTotal = allAssets
      .filter((a) => a.currency === currency)
      .reduce((sum, a) => sum + Number(a.currentValue), 0);
    const savingsTotal = allSavings
      .filter((s) => s.currency === currency)
      .reduce((sum, s) => sum + Number(s.balance), 0);
    const loansOutstanding = allLoans
      .filter((l) => l.currency === currency)
      .reduce((sum, l) => sum + outstandingPrincipalOf(l), 0);

    return {
      currency,
      monthTotalSpend: monthTotalSpend.toFixed(2),
      categoryBreakdown,
      netWorth: (assetsTotal + savingsTotal - loansOutstanding).toFixed(2),
    };
  });

  const insights: SpendingInsight[] = Array.from(currencies)
    .flatMap((currency) =>
      computeSpendingInsights(
        buildCategoryBreakdown(spendRows, currency, categoryNameById),
        buildCategoryBreakdown(prevSpendRows, currency, categoryNameById),
        currency,
      ),
    )
    .sort((a, b) => b.percentChange - a.percentChange)
    .slice(0, 5);

  const displayCurrency = userRow?.defaultDisplayCurrency ?? "USD";
  const todayStr = new Date().toISOString().slice(0, 10);

  let convertedSpend = 0;
  let convertedNetWorth = 0;
  let conversionFailed = false;

  try {
    for (const e of monthExpenseDates) {
      convertedSpend += await convertOnDate(tx, Number(e.amount), e.currency, displayCurrency, e.date);
    }
    for (const a of allAssets) {
      convertedNetWorth += await convertOnDate(tx, Number(a.currentValue), a.currency, displayCurrency, todayStr);
    }
    for (const s of allSavings) {
      convertedNetWorth += await convertOnDate(tx, Number(s.balance), s.currency, displayCurrency, todayStr);
    }
    for (const l of allLoans) {
      convertedNetWorth -= await convertOnDate(tx, outstandingPrincipalOf(l), l.currency, displayCurrency, todayStr);
    }
  } catch (err) {
    console.error("[dashboard] currency conversion failed", err);
    conversionFailed = true;
  }

  const converted: ConvertedSummary = {
    currency: displayCurrency,
    monthTotalSpend: conversionFailed ? "0.00" : convertedSpend.toFixed(2),
    netWorth: conversionFailed ? "0.00" : convertedNetWorth.toFixed(2),
    note: conversionFailed
      ? "Currency conversion is temporarily unavailable — showing native per-currency totals only below."
      : `Converted into ${displayCurrency} using each amount's historical exchange rate for its date.`,
    unavailable: conversionFailed,
  };

  return { month, byCurrency, converted, insights };
}
