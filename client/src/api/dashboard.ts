import { api } from "./client";

export interface CurrencySummary {
  currency: string;
  monthTotalSpend: string;
  categoryBreakdown: { categoryName: string; total: string }[];
  netWorth: string;
}

export interface DashboardSummary {
  month: string;
  byCurrency: CurrencySummary[];
}

export const getDashboardSummary = (month?: string) =>
  api.get<{ data: DashboardSummary }>(`/dashboard/summary${month ? `?month=${month}` : ""}`);
