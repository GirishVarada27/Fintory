import { api } from "./client";

export interface CategoryTotal {
  categoryName: string;
  total: string;
}

export interface CurrencySummary {
  currency: string;
  monthTotalSpend: string;
  categoryBreakdown: CategoryTotal[];
  netWorth: string;
}

export interface ConvertedSummary {
  currency: string;
  monthTotalSpend: string;
  monthTotalIncome: string;
  cashFlow: string;
  netWorth: string;
  savingsTotal: string;
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
  assetsByType: CategoryTotal[];
  liabilitiesByType: CategoryTotal[];
}

export const getDashboardSummary = (month?: string) =>
  api.get<{ data: DashboardSummary }>(`/dashboard/summary${month ? `?month=${month}` : ""}`);

export interface MonthlyHistoryPoint {
  month: string;
  income: string;
  expenses: string;
  cashFlow: string;
  netWorth: string;
}

export interface DashboardHistory {
  year: number;
  currency: string;
  points: MonthlyHistoryPoint[];
  availableYears: number[];
  unavailable: boolean;
}

export const getDashboardHistory = (year?: number) =>
  api.get<{ data: DashboardHistory }>(`/dashboard/history${year ? `?year=${year}` : ""}`);
