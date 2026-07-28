import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { recurringExpenses } from "../db/schema";
import { validateBody } from "../middleware/validate";
import { notFound } from "../lib/errors";

export const recurringExpensesRouter = Router();

recurringExpensesRouter.get("/", async (req, res) => {
  const rows = await req.db
    .select()
    .from(recurringExpenses)
    .where(eq(recurringExpenses.userId, req.user!.id))
    .orderBy(desc(recurringExpenses.lastSeenDate));
  res.json({ data: rows });
});

const updateStatusSchema = z.object({ status: z.enum(["confirmed", "dismissed"]) });

recurringExpensesRouter.patch("/:id/status", validateBody(updateStatusSchema), async (req, res) => {
  const [row] = await req.db
    .update(recurringExpenses)
    .set({ status: req.body.status, updatedAt: new Date() })
    .where(and(eq(recurringExpenses.id, req.params.id as string), eq(recurringExpenses.userId, req.user!.id)))
    .returning();
  if (!row) {
    notFound(res);
    return;
  }
  res.json({ data: row });
});
