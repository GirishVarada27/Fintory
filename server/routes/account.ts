import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth";
import {
  categories,
  expenses,
  expenseSplits,
  loans,
  savingsAccounts,
  assets,
  budgets,
  notifications,
  recurringExpenses,
  linkedAccounts,
  linkedTransactions,
  auditLog,
  user as userTable,
} from "../db/schema";
import { validateBody } from "../middleware/validate";

export const accountRouter = Router();

accountRouter.get("/export", async (req, res) => {
  const userId = req.user!.id;

  // Sequential, not Promise.all — these all share one transaction-scoped
  // connection (see dashboardSummary.ts for why that matters).
  const [profile] = await req.db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      defaultDisplayCurrency: userTable.defaultDisplayCurrency,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .where(eq(userTable.id, userId));
  const ownCategories = await req.db.select().from(categories).where(eq(categories.userId, userId));
  const myExpenses = await req.db.select().from(expenses).where(eq(expenses.userId, userId));
  const mySplits = await req.db.select().from(expenseSplits).where(eq(expenseSplits.userId, userId));
  const myLoans = await req.db.select().from(loans).where(eq(loans.userId, userId));
  const mySavings = await req.db.select().from(savingsAccounts).where(eq(savingsAccounts.userId, userId));
  const myAssets = await req.db.select().from(assets).where(eq(assets.userId, userId));
  const myBudgets = await req.db.select().from(budgets).where(eq(budgets.userId, userId));
  const myNotifications = await req.db.select().from(notifications).where(eq(notifications.userId, userId));
  const myRecurring = await req.db.select().from(recurringExpenses).where(eq(recurringExpenses.userId, userId));
  // Never include the encrypted Plaid access token, even in the owning
  // user's own data export.
  const myLinkedAccounts = await req.db
    .select({
      id: linkedAccounts.id,
      institutionName: linkedAccounts.institutionName,
      accountName: linkedAccounts.accountName,
      accountType: linkedAccounts.accountType,
      mask: linkedAccounts.mask,
      createdAt: linkedAccounts.createdAt,
    })
    .from(linkedAccounts)
    .where(eq(linkedAccounts.userId, userId));
  const myLinkedTransactions = await req.db
    .select()
    .from(linkedTransactions)
    .where(eq(linkedTransactions.userId, userId));
  const myAuditLog = await req.db.select().from(auditLog).where(eq(auditLog.userId, userId));

  const exportData = {
    exportedAt: new Date().toISOString(),
    profile,
    categories: ownCategories,
    expenses: myExpenses,
    expenseSplits: mySplits,
    loans: myLoans,
    savingsAccounts: mySavings,
    assets: myAssets,
    budgets: myBudgets,
    notifications: myNotifications,
    recurringExpenses: myRecurring,
    linkedAccounts: myLinkedAccounts,
    linkedTransactions: myLinkedTransactions,
    auditLog: myAuditLog,
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="fintory-data-export.json"');
  res.json(exportData);
});

const deleteAccountSchema = z.object({
  confirmation: z.literal("DELETE MY ACCOUNT"),
});

// Hard delete (per the user's explicit choice, not an anonymization policy):
// every owned row cascades away via FK ON DELETE CASCADE. The WHERE clause
// scoping to req.user!.id is the only protection here — the `user` table
// itself has no RLS (Better Auth's own table; see schema.ts).
//
// Sign out through Better Auth's own endpoint *before* deleting the row:
// session.cookieCache means a session can still validate for up to its
// maxAge purely from the signed cookie, independent of the DB row — without
// this, the browser that just "deleted" its account keeps working against
// the (now-empty) API for several minutes. asResponse:true gets us the
// Set-Cookie header that actually clears both the session and cache cookies.
accountRouter.delete("/", validateBody(deleteAccountSchema), async (req, res) => {
  const signOutResponse = await auth.api.signOut({
    headers: fromNodeHeaders(req.headers),
    asResponse: true,
  });
  const cookies = signOutResponse.headers.getSetCookie();
  if (cookies.length > 0) {
    res.setHeader("Set-Cookie", cookies);
  }

  await req.db.delete(userTable).where(eq(userTable.id, req.user!.id));
  res.status(204).send();
});
