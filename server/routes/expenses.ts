import { Router } from "express";
import { and, desc, eq, gte, ilike, lte } from "drizzle-orm";
import { expenses } from "../db/schema";
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuerySchema,
  type ListExpensesQuery,
} from "../../shared/schemas/expenses";
import { validateBody, validateQuery } from "../middleware/validate";
import { notFound } from "../lib/errors";
import { cursorCondition, decodeCursor, encodeCursor } from "../lib/pagination";

export const expensesRouter = Router();

expensesRouter.get("/", validateQuery(listExpensesQuerySchema), async (req, res) => {
  const query = req.validatedQuery as ListExpensesQuery;
  const cursor = decodeCursor(query.cursor);

  const conditions = [eq(expenses.userId, req.user!.id)];
  if (query.categoryId) conditions.push(eq(expenses.categoryId, query.categoryId));
  if (query.from) conditions.push(gte(expenses.date, query.from));
  if (query.to) conditions.push(lte(expenses.date, query.to));
  if (query.vendor) conditions.push(ilike(expenses.vendor, `%${query.vendor}%`));
  const cursorClause = cursorCondition(expenses.createdAt, expenses.id, cursor);
  if (cursorClause) conditions.push(cursorClause);

  const rows = await req.db
    .select()
    .from(expenses)
    .where(and(...conditions))
    .orderBy(desc(expenses.createdAt), desc(expenses.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const data = hasMore ? rows.slice(0, query.limit) : rows;
  const last = data.at(-1);
  const nextCursor =
    hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

  res.json({ data, pagination: { nextCursor, limit: query.limit } });
});

expensesRouter.get("/:id", async (req, res) => {
  const [row] = await req.db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, req.params.id as string), eq(expenses.userId, req.user!.id)));
  if (!row) {
    notFound(res);
    return;
  }
  res.json({ data: row });
});

expensesRouter.post("/", validateBody(createExpenseSchema), async (req, res) => {
  const [row] = await req.db
    .insert(expenses)
    .values({
      ...req.body,
      amount: String(req.body.amount),
      userId: req.user!.id,
    })
    .returning();
  res.status(201).json({ data: row });
});

expensesRouter.patch("/:id", validateBody(updateExpenseSchema), async (req, res) => {
  const updates = { ...req.body } as Record<string, unknown>;
  if (typeof updates.amount === "number") updates.amount = String(updates.amount);
  updates.updatedAt = new Date();

  const [row] = await req.db
    .update(expenses)
    .set(updates)
    .where(and(eq(expenses.id, req.params.id as string), eq(expenses.userId, req.user!.id)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.json({ data: row });
});

expensesRouter.delete("/:id", async (req, res) => {
  const [row] = await req.db
    .delete(expenses)
    .where(and(eq(expenses.id, req.params.id as string), eq(expenses.userId, req.user!.id)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.status(204).send();
});
