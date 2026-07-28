import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { loans, notifications, user as userTable } from "../db/schema";
import type * as schema from "../db/schema";
import { computeLoanAmortization } from "../../shared/amortization";
import { sendEmail } from "../lib/email";

const REMINDER_WINDOW_DAYS = 3;

// Adds `months` to a "YYYY-MM-DD" date using UTC components throughout (same
// reasoning as shared/amortization.ts), clamping to the last day of the
// target month when the original day doesn't exist there (e.g. Jan 31 + 1
// month -> Feb 28, not a rolled-over Mar 3).
function addMonthsUtc(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  const day = d.getUTCDate();
  const targetMonthIndex = d.getUTCMonth() + months;
  const result = new Date(Date.UTC(d.getUTCFullYear(), targetMonthIndex, day));
  const expectedMonth = ((targetMonthIndex % 12) + 12) % 12;
  if (result.getUTCMonth() !== expectedMonth) {
    result.setUTCDate(0);
  }
  return result.toISOString().slice(0, 10);
}

// Runs inside a per-user RLS transaction (see runAsUser). Creates at most one
// "loan_reminder" notification per loan per due date.
export async function checkLoanRemindersForUser(tx: NodePgDatabase<typeof schema>, userId: string): Promise<void> {
  const userLoans = await tx.select().from(loans).where(eq(loans.userId, userId));
  if (userLoans.length === 0) return;

  const [userRow] = await tx.select({ email: userTable.email }).from(userTable).where(eq(userTable.id, userId));
  const todayMs = new Date(new Date().toISOString().slice(0, 10)).getTime();

  for (const loan of userLoans) {
    const computed = computeLoanAmortization({
      principal: Number(loan.principal),
      apr: Number(loan.apr),
      termMonths: loan.termMonths,
      monthlyPayment: Number(loan.monthlyPayment),
      startDate: loan.startDate,
    });
    if (computed.isPaidOff) continue;

    const nextDueDate = addMonthsUtc(loan.startDate, computed.monthsElapsed + 1);
    const daysUntilDue = (new Date(nextDueDate).getTime() - todayMs) / 86_400_000;
    if (daysUntilDue < 0 || daysUntilDue > REMINDER_WINDOW_DAYS) continue;

    const [existing] = await tx
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, "loan_reminder"),
          sql`${notifications.payload} @> ${JSON.stringify({ loanId: loan.id, dueDate: nextDueDate })}::jsonb`,
        ),
      );
    if (existing) continue;

    const payload = {
      loanId: loan.id,
      lender: loan.lender,
      dueDate: nextDueDate,
      monthlyPayment: loan.monthlyPayment,
      currency: loan.currency,
    };
    const [notification] = await tx
      .insert(notifications)
      .values({ userId, type: "loan_reminder", payload })
      .returning();

    if (userRow && notification) {
      await sendEmail({
        to: userRow.email,
        subject: `Upcoming payment: ${loan.lender}`,
        body: `Your ${loan.monthlyPayment} ${loan.currency} payment to ${loan.lender} is due on ${nextDueDate}.`,
      });
      await tx.update(notifications).set({ sentAt: new Date() }).where(eq(notifications.id, notification.id));
    }
  }
}
