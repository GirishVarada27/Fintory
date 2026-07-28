import cron from "node-cron";
import { db } from "../db/index";
import { user } from "../db/schema";
import { runAsUser } from "../lib/runAsUser";
import { fetchTodaysFxRates } from "./fetchFxRates";
import { detectRecurringForUser } from "./detectRecurring";
import { checkBudgetThresholdsForUser } from "./checkBudgets";
import { checkLoanRemindersForUser } from "./loanReminders";
import { syncPlaidTransactionsForUser } from "./syncPlaidTransactions";

async function getAllUserIds(): Promise<string[]> {
  const rows = await db.select({ id: user.id }).from(user);
  return rows.map((r) => r.id);
}

async function runPerUserJobs(): Promise<void> {
  const userIds = await getAllUserIds();
  for (const userId of userIds) {
    try {
      await runAsUser(userId, (tx) => detectRecurringForUser(tx, userId));
    } catch (err) {
      console.error(`[jobs] detectRecurring failed for user ${userId}`, err);
    }
    try {
      await runAsUser(userId, (tx) => checkBudgetThresholdsForUser(tx, userId));
    } catch (err) {
      console.error(`[jobs] checkBudgetThresholds failed for user ${userId}`, err);
    }
    try {
      await runAsUser(userId, (tx) => checkLoanRemindersForUser(tx, userId));
    } catch (err) {
      console.error(`[jobs] checkLoanReminders failed for user ${userId}`, err);
    }
    try {
      await runAsUser(userId, (tx) => syncPlaidTransactionsForUser(tx, userId));
    } catch (err) {
      console.error(`[jobs] syncPlaidTransactions failed for user ${userId}`, err);
    }
  }
}

// No BullMQ/Redis (deliberately deferred — see Stage 2 decisions): these are
// in-process cron timers, so scheduled work only runs while the single
// Express process is up and is lost across restarts until the next tick.
// Fine at this app's scale; would need a real queue if that stops being true.
export function startScheduledJobs(): void {
  fetchTodaysFxRates().catch((err: unknown) => console.error("[jobs] initial fx fetch failed", err));
  runPerUserJobs().catch((err: unknown) => console.error("[jobs] initial per-user jobs failed", err));

  cron.schedule("0 1 * * *", () => {
    fetchTodaysFxRates().catch((err: unknown) => console.error("[jobs] scheduled fx fetch failed", err));
  });

  cron.schedule("0 2 * * *", () => {
    runPerUserJobs().catch((err: unknown) => console.error("[jobs] scheduled per-user jobs failed", err));
  });
}
