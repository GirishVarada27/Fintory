import { z } from "zod";
import { currencyCode, moneyNonNegative, paginationQuerySchema } from "./common";

export const createSavingsAccountSchema = z.object({
  name: z.string().min(1).max(200),
  institution: z.string().max(200).optional(),
  type: z.string().max(50).optional(),
  currency: currencyCode,
  balance: moneyNonNegative.default(0),
  targetAmount: moneyNonNegative.optional(),
  apy: z.coerce.number().min(0).max(100).optional(),
  monthlyContribution: moneyNonNegative.optional(),
});

export const updateSavingsAccountSchema = createSavingsAccountSchema.partial();

export const listSavingsAccountsQuerySchema = paginationQuerySchema;

export type CreateSavingsAccountInput = z.infer<typeof createSavingsAccountSchema>;
export type UpdateSavingsAccountInput = z.infer<typeof updateSavingsAccountSchema>;
