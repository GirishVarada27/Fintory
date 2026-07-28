import { api, type ItemResponse } from "./client";

export interface RecurringExpense {
  id: string;
  userId: string;
  vendor: string;
  categoryId: string | null;
  averageAmount: string;
  currency: string;
  cadenceDays: number;
  lastSeenDate: string;
  status: "pending" | "confirmed" | "dismissed";
  createdAt: string;
  updatedAt: string;
}

export const listRecurringExpenses = () => api.get<{ data: RecurringExpense[] }>("/recurring-expenses");
export const updateRecurringExpenseStatus = (id: string, status: "confirmed" | "dismissed") =>
  api.patch<ItemResponse<RecurringExpense>>(`/recurring-expenses/${id}/status`, { status });
