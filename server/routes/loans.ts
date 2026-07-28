import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { loans } from "../db/schema";
import {
  createLoanSchema,
  updateLoanSchema,
  listLoansQuerySchema,
} from "../../shared/schemas/loans";
import type { PaginationQuery } from "../../shared/schemas/common";
import { validateBody, validateQuery } from "../middleware/validate";
import { notFound } from "../lib/errors";
import { cursorCondition, decodeCursor, encodeCursor } from "../lib/pagination";
import { computeLoanAmortization } from "../../shared/amortization";

export const loansRouter = Router();

function withComputed<T extends typeof loans.$inferSelect>(loan: T) {
  const computed = computeLoanAmortization({
    principal: Number(loan.principal),
    apr: Number(loan.apr),
    termMonths: loan.termMonths,
    monthlyPayment: Number(loan.monthlyPayment),
    startDate: loan.startDate,
  });
  return { ...loan, ...computed };
}

loansRouter.get("/", validateQuery(listLoansQuerySchema), async (req, res) => {
  const query = req.validatedQuery as PaginationQuery;
  const cursor = decodeCursor(query.cursor);

  const conditions = [eq(loans.userId, req.user!.id)];
  const cursorClause = cursorCondition(loans.createdAt, loans.id, cursor);
  if (cursorClause) conditions.push(cursorClause);

  const rows = await req.db
    .select()
    .from(loans)
    .where(and(...conditions))
    .orderBy(desc(loans.createdAt), desc(loans.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const data = hasMore ? rows.slice(0, query.limit) : rows;
  const last = data.at(-1);
  const nextCursor =
    hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

  res.json({ data: data.map(withComputed), pagination: { nextCursor, limit: query.limit } });
});

loansRouter.get("/:id", async (req, res) => {
  const [row] = await req.db
    .select()
    .from(loans)
    .where(and(eq(loans.id, req.params.id as string), eq(loans.userId, req.user!.id)));
  if (!row) {
    notFound(res);
    return;
  }
  res.json({ data: withComputed(row) });
});

loansRouter.post("/", validateBody(createLoanSchema), async (req, res) => {
  const [row] = await req.db
    .insert(loans)
    .values({
      ...req.body,
      principal: String(req.body.principal),
      apr: String(req.body.apr),
      monthlyPayment: String(req.body.monthlyPayment),
      userId: req.user!.id,
    })
    .returning();
  res.status(201).json({ data: withComputed(row) });
});

loansRouter.patch("/:id", validateBody(updateLoanSchema), async (req, res) => {
  const updates = { ...req.body } as Record<string, unknown>;
  if (typeof updates.principal === "number") updates.principal = String(updates.principal);
  if (typeof updates.apr === "number") updates.apr = String(updates.apr);
  if (typeof updates.monthlyPayment === "number") updates.monthlyPayment = String(updates.monthlyPayment);
  updates.updatedAt = new Date();

  const [row] = await req.db
    .update(loans)
    .set(updates)
    .where(and(eq(loans.id, req.params.id as string), eq(loans.userId, req.user!.id)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.json({ data: withComputed(row) });
});

loansRouter.delete("/:id", async (req, res) => {
  const [row] = await req.db
    .delete(loans)
    .where(and(eq(loans.id, req.params.id as string), eq(loans.userId, req.user!.id)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.status(204).send();
});
