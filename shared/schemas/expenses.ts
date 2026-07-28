import { z } from "zod";
import { currencyCode, money, isoDate, paginationQuerySchema } from "./common";

export const expenseSourceEnum = z.enum(["manual", "scanned"]);

export const expenseSplitSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  amount: money,
});

const baseExpenseFields = {
  amount: money,
  currency: currencyCode,
  categoryId: z.string().uuid().optional(),
  vendor: z.string().min(1).max(200),
  date: isoDate,
  source: expenseSourceEnum.default("manual"),
  receiptUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  // undefined = leave splits untouched (updates only); null = clear all
  // splits back to a single category; array of >=2 = set these splits.
  splits: z.array(expenseSplitSchema).min(2).optional().nullable(),
};

function splitsSumMatchesAmount(data: { amount: number; splits?: { amount: number }[] | null }) {
  if (!data.splits) return true;
  const sum = data.splits.reduce((s, x) => s + x.amount, 0);
  return Math.abs(sum - data.amount) < 0.01;
}

export const createExpenseSchema = z
  .object(baseExpenseFields)
  .refine(splitsSumMatchesAmount, {
    message: "Split amounts must add up to the total expense amount",
    path: ["splits"],
  });

export const updateExpenseSchema = z.object(baseExpenseFields).partial();

export const listExpensesQuerySchema = paginationQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  vendor: z.string().optional(),
  currency: currencyCode.optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  tag: z.string().optional(),
  sortBy: z.enum(["date", "amount", "vendor", "createdAt"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
