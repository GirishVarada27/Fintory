import type { CategorySpendRow } from "./categorySpend";

export interface BudgetSpendInfo {
  spentToDate: number;
  percentUsed: number;
}

// Pure aggregation over already-fetched spend rows (see getCategorySpend) so
// callers with multiple budgets can fetch the month's spend once and reuse it
// instead of re-querying per budget.
export function budgetSpendFromRows(
  spendRows: CategorySpendRow[],
  categoryId: string,
  currency: string,
  monthlyLimit: number,
): BudgetSpendInfo {
  const spentToDate = spendRows
    .filter((r) => r.categoryId === categoryId && r.currency === currency)
    .reduce((sum, r) => sum + r.amount, 0);
  const percentUsed = monthlyLimit > 0 ? (spentToDate / monthlyLimit) * 100 : 0;
  return { spentToDate, percentUsed };
}
