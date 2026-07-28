import { Router } from "express";
import { and, arrayContains, asc, desc, eq, gt, gte, ilike, lt, lte, or } from "drizzle-orm";
import { expenses, expenseSplits } from "../db/schema";
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuerySchema,
  type ListExpensesQuery,
} from "../../shared/schemas/expenses";
import { validateBody, validateQuery } from "../middleware/validate";
import { notFound, validationError } from "../lib/errors";
import { encodeCursor as encodeSimpleCursor, decodeCursor as decodeSimpleCursor } from "../lib/pagination";

export const expensesRouter = Router();

type SortBy = "date" | "amount" | "vendor" | "createdAt";
type SortDir = "asc" | "desc";
type KeysetCursor = { sortValue: string; id: string };

function decodeCursor(raw: string | undefined): KeysetCursor | null {
  return decodeSimpleCursor(raw) as KeysetCursor | null;
}

function encodeCursor(cursor: KeysetCursor): string {
  return encodeSimpleCursor(cursor as unknown as { createdAt: string; id: string });
}

// Each branch compares against a column of matching TS type (string for
// date/amount/vendor, Date for createdAt) — kept concrete rather than
// generic since this is the only endpoint that needs sort flexibility.
function buildOrderAndCursor(sortBy: SortBy, sortDir: SortDir, cursor: KeysetCursor | null) {
  const dir = sortDir === "asc" ? asc : desc;
  const cmp = sortDir === "asc" ? gt : lt;

  if (sortBy === "createdAt") {
    const cursorDate = cursor ? new Date(cursor.sortValue) : null;
    return {
      order: [dir(expenses.createdAt), dir(expenses.id)],
      cursorClause:
        cursor && cursorDate
          ? or(cmp(expenses.createdAt, cursorDate), and(eq(expenses.createdAt, cursorDate), cmp(expenses.id, cursor.id)))
          : undefined,
    };
  }

  const column = sortBy === "date" ? expenses.date : sortBy === "amount" ? expenses.amount : expenses.vendor;
  return {
    order: [dir(column), dir(expenses.id)],
    cursorClause: cursor
      ? or(cmp(column, cursor.sortValue), and(eq(column, cursor.sortValue), cmp(expenses.id, cursor.id)))
      : undefined,
  };
}

function extractSortValue(row: typeof expenses.$inferSelect, sortBy: SortBy): string {
  if (sortBy === "date") return row.date;
  if (sortBy === "amount") return row.amount;
  if (sortBy === "vendor") return row.vendor;
  return row.createdAt.toISOString();
}

expensesRouter.get("/", validateQuery(listExpensesQuerySchema), async (req, res) => {
  const query = req.validatedQuery as ListExpensesQuery;
  const cursor = decodeCursor(query.cursor);

  const conditions = [eq(expenses.userId, req.user!.id)];
  if (query.categoryId) conditions.push(eq(expenses.categoryId, query.categoryId));
  if (query.from) conditions.push(gte(expenses.date, query.from));
  if (query.to) conditions.push(lte(expenses.date, query.to));
  if (query.vendor) conditions.push(ilike(expenses.vendor, `%${query.vendor}%`));
  if (query.currency) conditions.push(eq(expenses.currency, query.currency));
  if (query.minAmount !== undefined) conditions.push(gte(expenses.amount, String(query.minAmount)));
  if (query.maxAmount !== undefined) conditions.push(lte(expenses.amount, String(query.maxAmount)));
  if (query.tag) conditions.push(arrayContains(expenses.tags, [query.tag]));

  const { order, cursorClause } = buildOrderAndCursor(query.sortBy, query.sortDir, cursor);
  if (cursorClause) conditions.push(cursorClause);

  const rows = await req.db
    .select()
    .from(expenses)
    .where(and(...conditions))
    .orderBy(...order)
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const data = hasMore ? rows.slice(0, query.limit) : rows;
  const last = data.at(-1);
  const nextCursor =
    hasMore && last ? encodeCursor({ sortValue: extractSortValue(last, query.sortBy), id: last.id }) : null;

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
  const splits = await req.db
    .select()
    .from(expenseSplits)
    .where(eq(expenseSplits.expenseId, row.id));
  res.json({ data: { ...row, splits } });
});

expensesRouter.post("/", validateBody(createExpenseSchema), async (req, res) => {
  const { splits, ...expenseFields } = req.body;

  const [row] = await req.db
    .insert(expenses)
    .values({
      ...expenseFields,
      amount: String(expenseFields.amount),
      userId: req.user!.id,
    })
    .returning();

  let createdSplits: (typeof expenseSplits.$inferSelect)[] = [];
  if (splits && splits.length > 0) {
    createdSplits = await req.db
      .insert(expenseSplits)
      .values(
        splits.map((s: { categoryId?: string | null; amount: number }) => ({
          userId: req.user!.id,
          expenseId: row.id,
          categoryId: s.categoryId ?? null,
          amount: String(s.amount),
        })),
      )
      .returning();
  }

  res.status(201).json({ data: { ...row, splits: createdSplits } });
});

expensesRouter.patch("/:id", validateBody(updateExpenseSchema), async (req, res) => {
  const expenseId = req.params.id as string;
  const { splits, ...bodyFields } = req.body;
  const updates = { ...bodyFields } as Record<string, unknown>;
  if (typeof updates.amount === "number") updates.amount = String(updates.amount);
  updates.updatedAt = new Date();

  if (splits && splits.length > 0) {
    const effectiveAmount =
      typeof req.body.amount === "number"
        ? req.body.amount
        : await (async () => {
            const [existing] = await req.db
              .select({ amount: expenses.amount })
              .from(expenses)
              .where(and(eq(expenses.id, expenseId), eq(expenses.userId, req.user!.id)));
            return existing ? Number(existing.amount) : undefined;
          })();

    if (effectiveAmount === undefined) {
      notFound(res);
      return;
    }
    const sum = splits.reduce((s: number, x: { amount: number }) => s + x.amount, 0);
    if (Math.abs(sum - effectiveAmount) >= 0.01) {
      validationError(res, "Split amounts must add up to the total expense amount");
      return;
    }
  }

  const [row] = await req.db
    .update(expenses)
    .set(updates)
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, req.user!.id)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }

  let resultSplits: (typeof expenseSplits.$inferSelect)[] = [];
  if (splits !== undefined) {
    await req.db.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
    if (splits && splits.length > 0) {
      resultSplits = await req.db
        .insert(expenseSplits)
        .values(
          splits.map((s: { categoryId?: string | null; amount: number }) => ({
            userId: req.user!.id,
            expenseId,
            categoryId: s.categoryId ?? null,
            amount: String(s.amount),
          })),
        )
        .returning();
    }
  } else {
    resultSplits = await req.db.select().from(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
  }

  res.json({ data: { ...row, splits: resultSplits } });
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
