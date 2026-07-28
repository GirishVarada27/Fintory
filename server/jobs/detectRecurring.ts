import { and, eq, gte } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { expenses, recurringExpenses } from "../db/schema";
import type * as schema from "../db/schema";

const LOOKBACK_DAYS = 180;
const MIN_OCCURRENCES = 3;
const MIN_CADENCE_DAYS = 5;
const MAX_CADENCE_DAYS = 40;
const MAX_CADENCE_STDDEV_RATIO = 0.25;
const MAX_AMOUNT_STDDEV_RATIO = 0.15;

interface ExpenseRow {
  vendor: string;
  currency: string;
  amount: string;
  date: string;
  categoryId: string | null;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function pickMostCommonCategory(rows: ExpenseRow[]): string | null {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.categoryId) continue;
    counts.set(r.categoryId, (counts.get(r.categoryId) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

// Flags (vendor, currency) groups as likely subscriptions when they occur at
// least 3 times in the lookback window with a consistent cadence (5-40 day
// average gap, low variance) and a similar amount each time. Re-running this
// never resets an already confirmed/dismissed row's status — only a brand
// new (vendor, currency) pairing is inserted as "pending".
export async function detectRecurringForUser(tx: NodePgDatabase<typeof schema>, userId: string): Promise<void> {
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);
  const sinceStr = since.toISOString().slice(0, 10);

  const rows: ExpenseRow[] = await tx
    .select({
      vendor: expenses.vendor,
      currency: expenses.currency,
      amount: expenses.amount,
      date: expenses.date,
      categoryId: expenses.categoryId,
    })
    .from(expenses)
    .where(and(eq(expenses.userId, userId), gte(expenses.date, sinceStr)));

  const groups = new Map<string, ExpenseRow[]>();
  for (const row of rows) {
    const key = `${row.vendor}::${row.currency}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    if (group.length < MIN_OCCURRENCES) continue;

    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / 86_400_000;
      gaps.push(days);
    }

    const meanGap = mean(gaps);
    if (meanGap < MIN_CADENCE_DAYS || meanGap > MAX_CADENCE_DAYS) continue;
    if (stddev(gaps, meanGap) > meanGap * MAX_CADENCE_STDDEV_RATIO) continue;

    const amounts = sorted.map((r) => Number(r.amount));
    const meanAmount = mean(amounts);
    if (meanAmount > 0 && stddev(amounts, meanAmount) / meanAmount > MAX_AMOUNT_STDDEV_RATIO) continue;

    const { vendor, currency } = sorted[0];
    const lastSeenDate = sorted[sorted.length - 1].date;
    const categoryId = pickMostCommonCategory(sorted);

    const [existing] = await tx
      .select()
      .from(recurringExpenses)
      .where(
        and(
          eq(recurringExpenses.userId, userId),
          eq(recurringExpenses.vendor, vendor),
          eq(recurringExpenses.currency, currency),
        ),
      );

    if (existing) {
      await tx
        .update(recurringExpenses)
        .set({
          averageAmount: meanAmount.toFixed(2),
          cadenceDays: Math.round(meanGap),
          lastSeenDate,
          categoryId: categoryId ?? existing.categoryId,
          updatedAt: new Date(),
        })
        .where(eq(recurringExpenses.id, existing.id));
    } else {
      await tx.insert(recurringExpenses).values({
        userId,
        vendor,
        currency,
        averageAmount: meanAmount.toFixed(2),
        cadenceDays: Math.round(meanGap),
        lastSeenDate,
        categoryId,
        status: "pending",
      });
    }
  }
}
