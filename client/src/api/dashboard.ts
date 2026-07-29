import { api } from "./client";

export interface CurrencySummary {
  currency: string;
  monthTotalSpend: string;
  categoryBreakdown: { categoryName: string; total: string }[];
  netWorth: string;
}

export interface ConvertedSummary {
  currency: string;
  monthTotalSpend: string;
  netWorth: string;
  note: string;
  unavailable: boolean;
}

export interface SpendingInsight {
  message: string;
  categoryName: string;
  currency: string;
  percentChange: number;
  direction: "up" | "down";
}

export interface DashboardSummary {
  month: string;
  byCurrency: CurrencySummary[];
  converted: ConvertedSummary;
  insights: SpendingInsight[];
}

export const getDashboardSummary = (month?: string) =>
  api.get<{ data: DashboardSummary }>(`/dashboard/summary${month ? `?month=${month}` : ""}`);
