import { Router } from "express";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { income } from "../db/schema";
import { createIncomeSchema, updateIncomeSchema, listIncomeQuerySchema } from "../../shared/schemas/income";
import { validateBody, validateQuery } from "../middleware/validate";
import { notFound, sendError } from "../lib/errors";
import { cursorCondition, decodeCursor, encodeCursor } from "../lib/pagination";
import { writeAuditLog } from "../lib/auditLog";
import { resolveViewContext } from "../lib/viewContext";
import type { ListIncomeQuery } from "../../shared/schemas/income";

export const incomeRouter = Router();

incomeRouter.get("/", validateQuery(listIncomeQuerySchema), async (req, res) => {
  const view = await resolveViewContext(req, res);
  if (!view) return;
  const query = req.validatedQuery as ListIncomeQuery;
  const cursor = decodeCursor(query.cursor);

  const conditions = [eq(income.userId, view.ownerId)];
  if (query.from) conditions.push(gte(income.date, query.from));
  if (query.to) conditions.push(lte(income.date, query.to));
  if (query.currency) conditions.push(eq(income.currency, query.currency));
  const cursorClause = cursorCondition(income.createdAt, income.id, cursor);
  if (cursorClause) conditions.push(cursorClause);

  const rows = await req.db
    .select()
    .from(income)
    .where(and(...conditions))
    .orderBy(desc(income.createdAt), desc(income.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const data = hasMore ? rows.slice(0, query.limit) : rows;
  const last = data.at(-1);
  const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

  res.json({ data, pagination: { nextCursor, limit: query.limit } });
});

incomeRouter.post("/", validateBody(createIncomeSchema), async (req, res) => {
  const view = await resolveViewContext(req, res);
  if (!view) return;
  if (!view.canEdit) {
    sendError(res, 403, "FORBIDDEN", "You only have view access to this account");
    return;
  }

  const [row] = await req.db
    .insert(income)
    .values({ ...req.body, amount: String(req.body.amount), userId: view.ownerId })
    .returning();

  await writeAuditLog(req.db, view.ownerId, "income", row.id, "create", null, row);

  res.status(201).json({ data: row });
});

incomeRouter.patch("/:id", validateBody(updateIncomeSchema), async (req, res) => {
  const view = await resolveViewContext(req, res);
  if (!view) return;
  if (!view.canEdit) {
    sendError(res, 403, "FORBIDDEN", "You only have view access to this account");
    return;
  }

  const incomeId = req.params.id as string;
  const updates = { ...req.body } as Record<string, unknown>;
  if (typeof updates.amount === "number") updates.amount = String(updates.amount);
  updates.updatedAt = new Date();

  const [existing] = await req.db
    .select()
    .from(income)
    .where(and(eq(income.id, incomeId), eq(income.userId, view.ownerId)));
  if (!existing) {
    notFound(res);
    return;
  }

  const [row] = await req.db
    .update(income)
    .set(updates)
    .where(and(eq(income.id, incomeId), eq(income.userId, view.ownerId)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }

  await writeAuditLog(req.db, view.ownerId, "income", row.id, "update", existing, row);

  res.json({ data: row });
});

incomeRouter.delete("/:id", async (req, res) => {
  const view = await resolveViewContext(req, res);
  if (!view) return;
  if (!view.canEdit) {
    sendError(res, 403, "FORBIDDEN", "You only have view access to this account");
    return;
  }

  const [row] = await req.db
    .delete(income)
    .where(and(eq(income.id, req.params.id as string), eq(income.userId, view.ownerId)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }

  await writeAuditLog(req.db, view.ownerId, "income", row.id, "delete", row, null);

  res.status(204).send();
});
