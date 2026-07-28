import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { budgets } from "../db/schema";
import { createBudgetSchema, updateBudgetSchema } from "../../shared/schemas/budgets";
import { validateBody } from "../middleware/validate";
import { notFound } from "../lib/errors";
import { getCategorySpend } from "../lib/categorySpend";
import { budgetSpendFromRows } from "../lib/budgetStatus";
import { monthRange } from "../lib/dateRange";

export const budgetsRouter = Router();

budgetsRouter.get("/", async (req, res) => {
  const userId = req.user!.id;
  const rows = await req.db.select().from(budgets).where(eq(budgets.userId, userId));

  const { start, end } = monthRange();
  const spendRows = await getCategorySpend(req.db, userId, start, end);

  const data = rows.map((b) => ({
    ...b,
    ...budgetSpendFromRows(spendRows, b.categoryId, b.currency, Number(b.monthlyLimit)),
  }));

  res.json({ data });
});

budgetsRouter.post("/", validateBody(createBudgetSchema), async (req, res) => {
  const [row] = await req.db
    .insert(budgets)
    .values({
      ...req.body,
      monthlyLimit: String(req.body.monthlyLimit),
      alertThresholdPct: String(req.body.alertThresholdPct),
      userId: req.user!.id,
    })
    .returning();
  res.status(201).json({ data: row });
});

budgetsRouter.patch("/:id", validateBody(updateBudgetSchema), async (req, res) => {
  const updates = { ...req.body } as Record<string, unknown>;
  if (typeof updates.monthlyLimit === "number") updates.monthlyLimit = String(updates.monthlyLimit);
  if (typeof updates.alertThresholdPct === "number") updates.alertThresholdPct = String(updates.alertThresholdPct);
  updates.updatedAt = new Date();

  const [row] = await req.db
    .update(budgets)
    .set(updates)
    .where(and(eq(budgets.id, req.params.id as string), eq(budgets.userId, req.user!.id)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.json({ data: row });
});

budgetsRouter.delete("/:id", async (req, res) => {
  const [row] = await req.db
    .delete(budgets)
    .where(and(eq(budgets.id, req.params.id as string), eq(budgets.userId, req.user!.id)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.status(204).send();
});
