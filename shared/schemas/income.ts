import { z } from "zod";
import { currencyCode, money, isoDate, paginationQuerySchema } from "./common";

const baseIncomeFields = {
  amount: money,
  currency: currencyCode,
  source: z.string().min(1).max(200),
  date: isoDate,
  notes: z.string().max(2000).optional(),
};

export const createIncomeSchema = z.object(baseIncomeFields);
export const updateIncomeSchema = z.object(baseIncomeFields).partial();

export const listIncomeQuerySchema = paginationQuerySchema.extend({
  from: isoDate.optional(),
  to: isoDate.optional(),
  currency: currencyCode.optional(),
});

export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;
export type UpdateIncomeInput = z.infer<typeof updateIncomeSchema>;
export type ListIncomeQuery = z.infer<typeof listIncomeQuerySchema>;
