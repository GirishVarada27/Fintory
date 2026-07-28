import { z } from "zod";
import { currencyCode, money, isoDate, paginationQuerySchema } from "./common";

export const createAssetSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().max(50).optional(),
  currency: currencyCode,
  currentValue: money,
  purchasePrice: money.optional(),
  purchaseDate: isoDate.optional(),
});

export const updateAssetSchema = createAssetSchema.partial();

export const listAssetsQuerySchema = paginationQuerySchema;

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
