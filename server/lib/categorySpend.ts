import { and, eq, gte, lt, notExists } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { expenses, expenseSplits } from "../db/schema";
import type * as schema from "../db/schema";

export interface CategorySpendRow {
  categoryId: string | null;
  currency: string;
  amount: number;
}

// Per-category, per-currency spend for a [from, to) date range. An expense
// with recorded splits is represented ONLY by its split rows (never also by
// its own categoryId) so amounts aren't double-counted; an expense with no
// splits is represented by its own categoryId as before. Used by both budget
// spend-to-date checks and the dashboard category breakdown so the two never
// disagree about what "spend in category X" means.
export async function getCategorySpend(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
  from: string,
  to: string,
): Promise<CategorySpendRow[]> {
  const unsplit = await tx
    .select({ categoryId: expenses.categoryId, currency: expenses.currency, amount: expenses.amount })
    .from(expenses)
    .where(
      and(
        eq(expenses.userId, userId),
        gte(expenses.date, from),
        lt(expenses.date, to),
        notExists(tx.select().from(expenseSplits).where(eq(expenseSplits.expenseId, expenses.id))),
      ),
    );

  const split = await tx
    .select({ categoryId: expenseSplits.categoryId, currency: expenses.currency, amount: expenseSplits.amount })
    .from(expenseSplits)
    .innerJoin(expenses, eq(expenseSplits.expenseId, expenses.id))
    .where(and(eq(expenseSplits.userId, userId), gte(expenses.date, from), lt(expenses.date, to)));

  return [
    ...unsplit.map((r) => ({ categoryId: r.categoryId, currency: r.currency, amount: Number(r.amount) })),
    ...split.map((r) => ({ categoryId: r.categoryId, currency: r.currency, amount: Number(r.amount) })),
  ];
}
