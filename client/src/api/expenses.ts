import { api, type ItemResponse, type ListResponse } from "./client";
import type { CreateExpenseInput, UpdateExpenseInput } from "../../../shared/schemas/expenses";

export interface Expense {
  id: string;
  userId: string;
  amount: string;
  currency: string;
  categoryId: string | null;
  vendor: string;
  date: string;
  source: "manual" | "scanned";
  receiptUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListExpensesParams {
  cursor?: string;
  limit?: number;
  categoryId?: string;
  from?: string;
  to?: string;
  vendor?: string;
}

export function listExpenses(params: ListExpensesParams = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) qs.set(key, String(value));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<ListResponse<Expense>>(`/expenses${suffix}`);
}

export const getExpense = (id: string) => api.get<ItemResponse<Expense>>(`/expenses/${id}`);
export const createExpense = (input: CreateExpenseInput) =>
  api.post<ItemResponse<Expense>>("/expenses", input);
export const updateExpense = (id: string, input: UpdateExpenseInput) =>
  api.patch<ItemResponse<Expense>>(`/expenses/${id}`, input);
export const deleteExpense = (id: string) => api.del<void>(`/expenses/${id}`);
