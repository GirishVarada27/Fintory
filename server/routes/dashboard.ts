import { Router } from "express";
import { z } from "zod";
import { and, eq, gte, lt } from "drizzle-orm";
import { assets, categories, expenses, loans, savingsAccounts } from "../db/schema";
import { computeLoanAmortization } from "../../shared/amortization";
import { validateQuery } from "../middleware/validate";

export const dashboardRouter = Router();

const summaryQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM")
    .optional(),
});

function monthRange(monthStr?: string) {
  const now = new Date();
  const [year, month] = monthStr ? monthStr.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonthDate = new Date(year, month, 1);
  const end = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end, month: `${year}-${String(month).padStart(2, "0")}` };
}

dashboardRouter.get("/summary", validateQuery(summaryQuerySchema), async (req, res) => {
  const { month: monthParam } = req.validatedQuery as z.infer<typeof summaryQuerySchema>;
  const { start, end, month } = monthRange(monthParam);
  const userId = req.user!.id;

  const [monthExpenses, allCategories, allAssets, allSavings, allLoans] = await Promise.all([
    req.db
      .select({ currency: expenses.currency, categoryId: expenses.categoryId, amount: expenses.amount })
      .from(expenses)
      .where(and(eq(expenses.userId, userId), gte(expenses.date, start), lt(expenses.date, end))),
    req.db.select().from(categories),
    req.db.select().from(assets).where(eq(assets.userId, userId)),
    req.db.select().from(savingsAccounts).where(eq(savingsAccounts.userId, userId)),
    req.db.select().from(loans).where(eq(loans.userId, userId)),
  ]);

  const categoryNameById = new Map(allCategories.map((c) => [c.id, c.name]));

  const currencies = new Set<string>([
    ...monthExpenses.map((e) => e.currency),
    ...allAssets.map((a) => a.currency),
    ...allSavings.map((s) => s.currency),
    ...allLoans.map((l) => l.currency),
  ]);

  const byCurrency = Array.from(currencies).map((currency) => {
    const currencyExpenses = monthExpenses.filter((e) => e.currency === currency);
    const monthTotalSpend = currencyExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const breakdownMap = new Map<string, number>();
    for (const e of currencyExpenses) {
      const key = e.categoryId ? (categoryNameById.get(e.categoryId) ?? "Uncategorized") : "Uncategorized";
      breakdownMap.set(key, (breakdownMap.get(key) ?? 0) + Number(e.amount));
    }
    const categoryBreakdown = Array.from(breakdownMap.entries()).map(([categoryName, total]) => ({
      categoryName,
      total: total.toFixed(2),
    }));

    const assetsTotal = allAssets
      .filter((a) => a.currency === currency)
      .reduce((sum, a) => sum + Number(a.currentValue), 0);
    const savingsTotal = allSavings
      .filter((s) => s.currency === currency)
      .reduce((sum, s) => sum + Number(s.balance), 0);
    const loansOutstanding = allLoans
      .filter((l) => l.currency === currency)
      .reduce((sum, l) => {
        const { outstandingPrincipal } = computeLoanAmortization({
          principal: Number(l.principal),
          apr: Number(l.apr),
          termMonths: l.termMonths,
          monthlyPayment: Number(l.monthlyPayment),
          startDate: l.startDate,
        });
        return sum + outstandingPrincipal;
      }, 0);

    return {
      currency,
      monthTotalSpend: monthTotalSpend.toFixed(2),
      categoryBreakdown,
      netWorth: (assetsTotal + savingsTotal - loansOutstanding).toFixed(2),
    };
  });

  res.json({ data: { month, byCurrency } });
});
