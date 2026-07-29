import { Router } from "express";
import { z } from "zod";
import { validateQuery } from "../middleware/validate";
import { computeDashboardSummary } from "../lib/dashboardSummary";
import { computeDashboardHistory } from "../lib/dashboardHistory";
import { resolveViewContext } from "../lib/viewContext";

export const dashboardRouter = Router();

const summaryQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM")
    .optional(),
});

dashboardRouter.get("/summary", validateQuery(summaryQuerySchema), async (req, res) => {
  const view = await resolveViewContext(req, res);
  if (!view) return;
  const { month } = req.validatedQuery as z.infer<typeof summaryQuerySchema>;
  const data = await computeDashboardSummary(req.db, view.ownerId, month);
  res.json({ data });
});

const historyQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

dashboardRouter.get("/history", validateQuery(historyQuerySchema), async (req, res) => {
  const view = await resolveViewContext(req, res);
  if (!view) return;
  const { year } = req.validatedQuery as z.infer<typeof historyQuerySchema>;
  const data = await computeDashboardHistory(req.db, view.ownerId, year ?? new Date().getFullYear());
  res.json({ data });
});
