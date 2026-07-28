import { api, type ItemResponse, type ListResponse } from "./client";
import type { CreateAssetInput, UpdateAssetInput } from "../../../shared/schemas/assets";

export interface Asset {
  id: string;
  userId: string;
  name: string;
  type: string | null;
  currency: string;
  currentValue: string;
  purchasePrice: string | null;
  purchaseDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export function listAssets(params: { cursor?: string; limit?: number } = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) qs.set(key, String(value));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<ListResponse<Asset>>(`/assets${suffix}`);
}

export const getAsset = (id: string) => api.get<ItemResponse<Asset>>(`/assets/${id}`);
export const createAsset = (input: CreateAssetInput) => api.post<ItemResponse<Asset>>("/assets", input);
export const updateAsset = (id: string, input: UpdateAssetInput) =>
  api.patch<ItemResponse<Asset>>(`/assets/${id}`, input);
export const deleteAsset = (id: string) => api.del<void>(`/assets/${id}`);
