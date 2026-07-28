import { z } from "zod";
import { currencyCode, money, isoDate, paginationQuerySchema } from "./common";

export const createLoanSchema = z.object({
  lender: z.string().min(1).max(200),
  type: z.string().max(50).optional(),
  principal: money,
  currency: currencyCode,
  apr: z.coerce.number().min(0).max(100),
  termMonths: z.coerce.number().int().positive(),
  monthlyPayment: money,
  startDate: isoDate,
});

export const updateLoanSchema = createLoanSchema.partial();

export const listLoansQuerySchema = paginationQuerySchema;

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;
