import { api, type ItemResponse, type ListResponse } from "./client";
import type { CreateIncomeInput, UpdateIncomeInput } from "../../../shared/schemas/income";

export interface Income {
  id: string;
  userId: string;
  amount: string;
  currency: string;
  source: string;
  date: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function listIncome(params: { cursor?: string; limit?: number } = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) qs.set(key, String(value));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<ListResponse<Income>>(`/income${suffix}`);
}

export const createIncome = (input: CreateIncomeInput) => api.post<ItemResponse<Income>>("/income", input);
export const updateIncome = (id: string, input: UpdateIncomeInput) =>
  api.patch<ItemResponse<Income>>(`/income/${id}`, input);
export const deleteIncome = (id: string) => api.del<void>(`/income/${id}`);
