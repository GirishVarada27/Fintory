import { api, type ItemResponse, type ListResponse } from "./client";
import type {
  CreateSavingsAccountInput,
  UpdateSavingsAccountInput,
} from "../../../shared/schemas/savingsAccounts";

export interface SavingsAccount {
  id: string;
  userId: string;
  name: string;
  institution: string | null;
  type: string | null;
  currency: string;
  balance: string;
  targetAmount: string | null;
  apy: string | null;
  monthlyContribution: string | null;
  createdAt: string;
  updatedAt: string;
}

export function listSavingsAccounts(params: { cursor?: string; limit?: number } = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) qs.set(key, String(value));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<ListResponse<SavingsAccount>>(`/savings-accounts${suffix}`);
}

export const getSavingsAccount = (id: string) =>
  api.get<ItemResponse<SavingsAccount>>(`/savings-accounts/${id}`);
export const createSavingsAccount = (input: CreateSavingsAccountInput) =>
  api.post<ItemResponse<SavingsAccount>>("/savings-accounts", input);
export const updateSavingsAccount = (id: string, input: UpdateSavingsAccountInput) =>
  api.patch<ItemResponse<SavingsAccount>>(`/savings-accounts/${id}`, input);
export const deleteSavingsAccount = (id: string) => api.del<void>(`/savings-accounts/${id}`);
