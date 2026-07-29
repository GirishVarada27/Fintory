import { and, eq, gte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { expenses, notifications } from "../db/schema";
import type * as schema from "../db/schema";
import { detectDuplicates, detectUnusualAmounts } from "../lib/anomalyDetection";

const LOOKBACK_DAYS = 180;

async function alreadyNotified(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
  matchPayload: Record<string, unknown>,
): Promise<boolean> {
  const [existing] = await tx
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.type, "anomaly_detected"),
        sql`${notifications.payload} @> ${JSON.stringify(matchPayload)}::jsonb`,
      ),
    );
  return Boolean(existing);
}

// Runs inside a per-user RLS transaction (see runAsUser). Creates at most one
// "anomaly_detected" notification per distinct anomaly (a duplicate group is
// keyed by its sorted expense IDs; an unusual-amount flag is keyed by the
// specific expense), so re-running this never spams duplicate alerts.
export async function detectAnomaliesForUser(tx: NodePgDatabase<typeof schema>, userId: string): Promise<void> {
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);
  const sinceStr = since.toISOString().slice(0, 10);

  const recentExpenses = await tx
    .select({
      id: expenses.id,
      vendor: expenses.vendor,
      amount: expenses.amount,
      currency: expenses.currency,
      date: expenses.date,
    })
    .from(expenses)
    .where(and(eq(expenses.userId, userId), gte(expenses.date, sinceStr)));

  if (recentExpenses.length === 0) return;

  for (const dup of detectDuplicates(recentExpenses)) {
    const expenseIdsKey = [...dup.expenseIds].sort().join(",");
    if (await alreadyNotified(tx, userId, { anomalyType: "duplicate", expenseIdsKey })) continue;

    await tx.insert(notifications).values({
      userId,
      type: "anomaly_detected",
      payload: {
        anomalyType: "duplicate",
        expenseIdsKey,
        expenseIds: dup.expenseIds,
        vendor: dup.vendor,
        amount: dup.amount,
        currency: dup.currency,
        date: dup.date,
      },
    });
  }

  for (const anomaly of detectUnusualAmounts(recentExpenses)) {
    if (await alreadyNotified(tx, userId, { anomalyType: "unusual_amount", expenseId: anomaly.expenseId })) continue;

    await tx.insert(notifications).values({
      userId,
      type: "anomaly_detected",
      payload: {
        anomalyType: "unusual_amount",
        expenseId: anomaly.expenseId,
        vendor: anomaly.vendor,
        amount: anomaly.amount,
        currency: anomaly.currency,
        date: anomaly.date,
        typicalAmount: anomaly.typicalAmount,
      },
    });
  }
}
