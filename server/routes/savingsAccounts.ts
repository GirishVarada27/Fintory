import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { savingsAccounts } from "../db/schema";
import {
  createSavingsAccountSchema,
  updateSavingsAccountSchema,
  listSavingsAccountsQuerySchema,
} from "../../shared/schemas/savingsAccounts";
import type { PaginationQuery } from "../../shared/schemas/common";
import { validateBody, validateQuery } from "../middleware/validate";
import { notFound } from "../lib/errors";
import { cursorCondition, decodeCursor, encodeCursor } from "../lib/pagination";

export const savingsAccountsRouter = Router();

const MONEY_FIELDS = ["balance", "targetAmount", "apy", "monthlyContribution"] as const;

function stringifyMoney<T extends Record<string, unknown>>(body: T): T {
  const out = { ...body };
  for (const field of MONEY_FIELDS) {
    const value = out[field as keyof T];
    if (typeof value === "number") {
      (out as Record<string, unknown>)[field] = String(value);
    }
  }
  return out;
}

savingsAccountsRouter.get("/", validateQuery(listSavingsAccountsQuerySchema), async (req, res) => {
  const query = req.validatedQuery as PaginationQuery;
  const cursor = decodeCursor(query.cursor);

  const conditions = [eq(savingsAccounts.userId, req.user!.id)];
  const cursorClause = cursorCondition(savingsAccounts.createdAt, savingsAccounts.id, cursor);
  if (cursorClause) conditions.push(cursorClause);

  const rows = await req.db
    .select()
    .from(savingsAccounts)
    .where(and(...conditions))
    .orderBy(desc(savingsAccounts.createdAt), desc(savingsAccounts.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const data = hasMore ? rows.slice(0, query.limit) : rows;
  const last = data.at(-1);
  const nextCursor =
    hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

  res.json({ data, pagination: { nextCursor, limit: query.limit } });
});

savingsAccountsRouter.get("/:id", async (req, res) => {
  const [row] = await req.db
    .select()
    .from(savingsAccounts)
    .where(and(eq(savingsAccounts.id, req.params.id as string), eq(savingsAccounts.userId, req.user!.id)));
  if (!row) {
    notFound(res);
    return;
  }
  res.json({ data: row });
});

savingsAccountsRouter.post("/", validateBody(createSavingsAccountSchema), async (req, res) => {
  const [row] = await req.db
    .insert(savingsAccounts)
    .values({ ...stringifyMoney(req.body), userId: req.user!.id })
    .returning();
  res.status(201).json({ data: row });
});

savingsAccountsRouter.patch("/:id", validateBody(updateSavingsAccountSchema), async (req, res) => {
  const updates = { ...stringifyMoney(req.body), updatedAt: new Date() };
  const [row] = await req.db
    .update(savingsAccounts)
    .set(updates)
    .where(and(eq(savingsAccounts.id, req.params.id as string), eq(savingsAccounts.userId, req.user!.id)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.json({ data: row });
});

savingsAccountsRouter.delete("/:id", async (req, res) => {
  const [row] = await req.db
    .delete(savingsAccounts)
    .where(and(eq(savingsAccounts.id, req.params.id as string), eq(savingsAccounts.userId, req.user!.id)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.status(204).send();
});
