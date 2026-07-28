import { Router } from "express";
import { z } from "zod";
import { validateQuery } from "../middleware/validate";
import { computeDashboardSummary } from "../lib/dashboardSummary";

export const dashboardRouter = Router();

const summaryQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM")
    .optional(),
});

dashboardRouter.get("/summary", validateQuery(summaryQuerySchema), async (req, res) => {
  const { month } = req.validatedQuery as z.infer<typeof summaryQuerySchema>;
  const data = await computeDashboardSummary(req.db, req.user!.id, month);
  res.json({ data });
});
