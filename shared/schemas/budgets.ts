import { z } from "zod";
import { currencyCode, money, paginationQuerySchema } from "./common";

export const createBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  monthlyLimit: money,
  currency: currencyCode,
  alertThresholdPct: z.coerce.number().min(1).max(100).default(80),
});

export const updateBudgetSchema = createBudgetSchema.partial();

export const listBudgetsQuerySchema = paginationQuerySchema;

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
