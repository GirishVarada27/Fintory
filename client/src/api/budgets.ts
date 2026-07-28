import { api, type ItemResponse } from "./client";
import type { CreateBudgetInput, UpdateBudgetInput } from "../../../shared/schemas/budgets";

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  monthlyLimit: string;
  currency: string;
  alertThresholdPct: string;
  createdAt: string;
  updatedAt: string;
  spentToDate: number;
  percentUsed: number;
}

export const listBudgets = () => api.get<{ data: Budget[] }>("/budgets");
export const createBudget = (input: CreateBudgetInput) => api.post<ItemResponse<Budget>>("/budgets", input);
export const updateBudget = (id: string, input: UpdateBudgetInput) =>
  api.patch<ItemResponse<Budget>>(`/budgets/${id}`, input);
export const deleteBudget = (id: string) => api.del<void>(`/budgets/${id}`);
