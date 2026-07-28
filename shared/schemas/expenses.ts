import { z } from "zod";
import { currencyCode, money, isoDate, paginationQuerySchema } from "./common";

export const expenseSourceEnum = z.enum(["manual", "scanned"]);

export const createExpenseSchema = z.object({
  amount: money,
  currency: currencyCode,
  categoryId: z.string().uuid().optional(),
  vendor: z.string().min(1).max(200),
  date: isoDate,
  source: expenseSourceEnum.default("manual"),
  receiptUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const listExpensesQuerySchema = paginationQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  vendor: z.string().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
