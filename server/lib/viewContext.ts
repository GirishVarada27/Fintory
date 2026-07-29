import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { accountShares } from "../db/schema";

export interface ViewContext {
  ownerId: string;
  canEdit: boolean;
}

// Resolves which user's data this request should operate on: the caller's
// own (default), or — if `?ownerId=` is given and an accepted share from
// that owner to the caller exists — the owner's, with canEdit reflecting the
// share's permission. Sends 403 and returns null if no such share exists.
// This is an app-level check on top of the RLS extension in schema.ts
// (categories/expenses/loans/savings_accounts/assets/budgets all carry
// matching *_shared_select_policy / *_shared_write_policy policies), not a
// substitute for it — RLS still enforces this regardless of what the app
// layer intends.
export async function resolveViewContext(req: Request, res: Response): Promise<ViewContext | null> {
  const ownerIdParam = typeof req.query.ownerId === "string" ? req.query.ownerId : undefined;
  if (!ownerIdParam || ownerIdParam === req.user!.id) {
    return { ownerId: req.user!.id, canEdit: true };
  }

  const [share] = await req.db
    .select({ permission: accountShares.permission })
    .from(accountShares)
    .where(
      and(
        eq(accountShares.ownerUserId, ownerIdParam),
        eq(accountShares.sharedWithUserId, req.user!.id),
        eq(accountShares.status, "accepted"),
      ),
    );

  if (!share) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You don't have access to this account's data" } });
    return null;
  }

  return { ownerId: ownerIdParam, canEdit: share.permission === "edit" };
}
