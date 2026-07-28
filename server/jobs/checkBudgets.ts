import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { budgets, categories, notifications, user as userTable } from "../db/schema";
import type * as schema from "../db/schema";
import { getCategorySpend } from "../lib/categorySpend";
import { budgetSpendFromRows } from "../lib/budgetStatus";
import { monthRange } from "../lib/dateRange";
import { sendEmail } from "../lib/email";

// Runs inside a per-user RLS transaction (see runAsUser). Creates at most one
// "budget_threshold" notification per budget per month — re-running this job
// (e.g. on every server boot) must not spam duplicate alerts.
export async function checkBudgetThresholdsForUser(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
): Promise<void> {
  const { start, end, month } = monthRange();
  const userBudgets = await tx.select().from(budgets).where(eq(budgets.userId, userId));
  if (userBudgets.length === 0) return;

  // Sequential, not Promise.all — see dashboardSummary.ts for why.
  const spendRows = await getCategorySpend(tx, userId, start, end);
  const allCategories = await tx.select().from(categories);
  const [userRow] = await tx.select({ email: userTable.email }).from(userTable).where(eq(userTable.id, userId));
  const categoryNameById = new Map(allCategories.map((c) => [c.id, c.name]));

  for (const budget of userBudgets) {
    const { spentToDate, percentUsed } = budgetSpendFromRows(
      spendRows,
      budget.categoryId,
      budget.currency,
      Number(budget.monthlyLimit),
    );
    if (percentUsed < Number(budget.alertThresholdPct)) continue;

    const [existing] = await tx
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, "budget_threshold"),
          sql`${notifications.payload} @> ${JSON.stringify({ budgetId: budget.id, month })}::jsonb`,
        ),
      );
    if (existing) continue;

    const categoryName = categoryNameById.get(budget.categoryId) ?? "Uncategorized";
    const roundedPercent = Math.round(percentUsed);
    const payload = {
      budgetId: budget.id,
      categoryName,
      month,
      spentToDate: spentToDate.toFixed(2),
      monthlyLimit: budget.monthlyLimit,
      currency: budget.currency,
      percentUsed: roundedPercent,
    };

    const [notification] = await tx.insert(notifications).values({ userId, type: "budget_threshold", payload }).returning();

    if (userRow && notification) {
      await sendEmail({
        to: userRow.email,
        subject: `Budget alert: ${categoryName} is at ${roundedPercent}%`,
        body: `You've spent ${spentToDate.toFixed(2)} ${budget.currency} of your ${budget.monthlyLimit} ${budget.currency} ${categoryName} budget for ${month}.`,
      });
      await tx.update(notifications).set({ sentAt: new Date() }).where(eq(notifications.id, notification.id));
    }
  }
}
