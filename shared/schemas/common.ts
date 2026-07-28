import { z } from "zod";

export const currencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, "Must be a 3-letter ISO 4217 currency code");

export const money = z.coerce.number().positive().finite();
export const moneyNonNegative = z.coerce.number().nonnegative().finite();

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
