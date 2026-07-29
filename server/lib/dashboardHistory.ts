import { and, eq, gte, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { assets, expenses, income as incomeTable, loans, savingsAccounts, user as userTable } from "../db/schema";
import type * as schema from "../db/schema";
import { computeLoanAmortization } from "../../shared/amortization";
import { convertOnDate } from "./fx";

export interface MonthlyHistoryPoint {
  month: string; // YYYY-MM
  income: string;
  expenses: string;
  cashFlow: string;
  netWorth: string;
}

export interface DashboardHistoryData {
  year: number;
  currency: string;
  points: MonthlyHistoryPoint[];
  availableYears: number[];
  unavailable: boolean;
}

// Last calendar day of `month` (1-12) in `year`, as YYYY-MM-DD.
function monthEndDate(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Net worth has no historical ledger in this app — assets/savings only ever
// store a *current* value, never a snapshot history. So for past months this
// reconstructs net worth as: today's asset/savings values (held flat across
// every month, since we have nothing else) minus each loan's *actual*
// outstanding balance as of that month's end (loans DO support this exactly,
// via computeLoanAmortization's `asOf`). The loan paydown curve is real; the
// asset/savings level is a flat approximation — callers should caveat this
// in the UI rather than present it as a fully historical net worth.
export async function computeDashboardHistory(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
  year: number,
): Promise<DashboardHistoryData> {
  const [userRow] = await tx
    .select({ defaultDisplayCurrency: userTable.defaultDisplayCurrency })
    .from(userTable)
    .where(eq(userTable.id, userId));
  const displayCurrency = userRow?.defaultDisplayCurrency ?? "USD";

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;

  // Sequential, not Promise.all: these share one transaction-scoped connection.
  const yearExpenses = await tx
    .select({ date: expenses.date, currency: expenses.currency, amount: expenses.amount })
    .from(expenses)
    .where(and(eq(expenses.userId, userId), gte(expenses.date, yearStart), lt(expenses.date, yearEnd)));
  const yearIncome = await tx
    .select({ date: incomeTable.date, currency: incomeTable.currency, amount: incomeTable.amount })
    .from(incomeTable)
    .where(and(eq(incomeTable.userId, userId), gte(incomeTable.date, yearStart), lt(incomeTable.date, yearEnd)));
  const allAssets = await tx.select().from(assets).where(eq(assets.userId, userId));
  const allSavings = await tx.select().from(savingsAccounts).where(eq(savingsAccounts.userId, userId));
  const allLoans = await tx.select().from(loans).where(eq(loans.userId, userId));
  const [earliestExpense] = await tx
    .select({ date: expenses.date })
    .from(expenses)
    .where(eq(expenses.userId, userId))
    .orderBy(expenses.date)
    .limit(1);
  const [earliestIncome] = await tx
    .select({ date: incomeTable.date })
    .from(incomeTable)
    .where(eq(incomeTable.userId, userId))
    .orderBy(incomeTable.date)
    .limit(1);

  const now = new Date();
  const currentYear = now.getFullYear();
  const earliestYear = Math.min(
    ...[earliestExpense?.date, earliestIncome?.date]
      .filter((d): d is string => Boolean(d))
      .map((d) => Number(d.slice(0, 4))),
    currentYear,
  );
  const availableYears: number[] = [];
  for (let y = currentYear; y >= earliestYear; y--) availableYears.push(y);

  const lastMonth = year === currentYear ? now.getMonth() + 1 : 12;
  const points: MonthlyHistoryPoint[] = [];
  let conversionFailed = false;

  try {
    for (let m = 1; m <= lastMonth; m++) {
      const monthStr = `${year}-${String(m).padStart(2, "0")}`;
      const asOf = monthEndDate(year, m);

      let monthIncome = 0;
      for (const row of yearIncome.filter((r) => r.date.startsWith(monthStr))) {
        monthIncome += await convertOnDate(tx, Number(row.amount), row.currency, displayCurrency, row.date);
      }

      let monthExpenses = 0;
      for (const row of yearExpenses.filter((r) => r.date.startsWith(monthStr))) {
        monthExpenses += await convertOnDate(tx, Number(row.amount), row.currency, displayCurrency, row.date);
      }

      let netWorth = 0;
      for (const a of allAssets) {
        netWorth += await convertOnDate(tx, Number(a.currentValue), a.currency, displayCurrency, asOf);
      }
      for (const s of allSavings) {
        netWorth += await convertOnDate(tx, Number(s.balance), s.currency, displayCurrency, asOf);
      }
      for (const l of allLoans) {
        const outstanding = computeLoanAmortization({
          principal: Number(l.principal),
          apr: Number(l.apr),
          termMonths: l.termMonths,
          monthlyPayment: Number(l.monthlyPayment),
          startDate: l.startDate,
          asOf,
        }).outstandingPrincipal;
        netWorth -= await convertOnDate(tx, outstanding, l.currency, displayCurrency, asOf);
      }

      points.push({
        month: monthStr,
        income: monthIncome.toFixed(2),
        expenses: monthExpenses.toFixed(2),
        cashFlow: (monthIncome - monthExpenses).toFixed(2),
        netWorth: netWorth.toFixed(2),
      });
    }
  } catch (err) {
    console.error("[dashboard] history currency conversion failed", err);
    conversionFailed = true;
  }

  return {
    year,
    currency: displayCurrency,
    points: conversionFailed ? [] : points,
    availableYears,
    unavailable: conversionFailed,
  };
}
