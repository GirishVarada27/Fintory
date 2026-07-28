import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { linkedAccounts, linkedTransactions, expenses } from "../db/schema";
import type * as schema from "../db/schema";
import { getPlaidClient, isPlaidConfigured } from "../lib/plaidClient";
import { decrypt } from "../lib/encryption";
import { findDuplicateExpense, type ExistingExpenseForDedupe } from "../lib/dedupe";

// Runs inside a per-user RLS transaction (see runAsUser). Pulls new
// transactions for every linked account via Plaid's cursor-based sync,
// either matching each one against an existing manually-entered expense
// (no new row created) or creating a new expense tagged source: "linked".
export async function syncPlaidTransactionsForUser(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
): Promise<void> {
  if (!isPlaidConfigured()) return;

  const accounts = await tx.select().from(linkedAccounts).where(eq(linkedAccounts.userId, userId));
  if (accounts.length === 0) return;

  const client = getPlaidClient();
  const existingExpenses: ExistingExpenseForDedupe[] = await tx
    .select({
      id: expenses.id,
      vendor: expenses.vendor,
      amount: expenses.amount,
      currency: expenses.currency,
      date: expenses.date,
    })
    .from(expenses)
    .where(eq(expenses.userId, userId));

  for (const account of accounts) {
    const accessToken = decrypt(account.encryptedAccessToken);
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await client.transactionsSync({ access_token: accessToken, cursor });
      const { added, next_cursor, has_more } = response.data;

      for (const txn of added) {
        const currency = txn.iso_currency_code ?? "USD";
        // Plaid: positive amount = money out of the account (a spend),
        // negative = money in (refund, direct deposit, payment) — already
        // matches our "amount is always positive spend" schema as-is, no
        // sign flip needed. Skip anything that isn't a positive spend.
        const amount = txn.amount;
        if (amount <= 0) continue;

        const vendor = txn.merchant_name ?? txn.name;
        const candidate = { vendor, amount, currency, date: txn.date };
        const duplicate = findDuplicateExpense(candidate, existingExpenses);

        let expenseId: string;
        let dedupeStatus: "created" | "matched_existing";
        if (duplicate) {
          expenseId = duplicate.id;
          dedupeStatus = "matched_existing";
        } else {
          const [created] = await tx
            .insert(expenses)
            .values({
              userId,
              amount: String(amount),
              currency,
              vendor,
              date: txn.date,
              source: "linked",
            })
            .returning();
          expenseId = created.id;
          dedupeStatus = "created";
          existingExpenses.push({ id: created.id, vendor, amount: String(amount), currency, date: txn.date });
        }

        await tx
          .insert(linkedTransactions)
          .values({
            userId,
            linkedAccountId: account.id,
            plaidTransactionId: txn.transaction_id,
            amount: String(amount),
            currency,
            vendor,
            date: txn.date,
            pending: txn.pending,
            expenseId,
            dedupeStatus,
          })
          .onConflictDoNothing({ target: linkedTransactions.plaidTransactionId });
      }

      cursor = next_cursor;
      hasMore = has_more;
    }
  }
}
