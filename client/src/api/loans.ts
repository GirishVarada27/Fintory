import { api, type ItemResponse, type ListResponse } from "./client";
import type { CreateLoanInput, UpdateLoanInput } from "../../../shared/schemas/loans";

export interface Loan {
  id: string;
  userId: string;
  lender: string;
  type: string | null;
  principal: string;
  currency: string;
  apr: string;
  termMonths: number;
  monthlyPayment: string;
  startDate: string;
  createdAt: string;
  updatedAt: string;
  // Computed server-side from amortization math — never stored.
  monthsElapsed: number;
  outstandingPrincipal: number;
  monthsRemaining: number;
  isPaidOff: boolean;
  isNonAmortizing: boolean;
}

export function listLoans(params: { cursor?: string; limit?: number } = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) qs.set(key, String(value));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api.get<ListResponse<Loan>>(`/loans${suffix}`);
}

export const getLoan = (id: string) => api.get<ItemResponse<Loan>>(`/loans/${id}`);
export const createLoan = (input: CreateLoanInput) => api.post<ItemResponse<Loan>>("/loans", input);
export const updateLoan = (id: string, input: UpdateLoanInput) =>
  api.patch<ItemResponse<Loan>>(`/loans/${id}`, input);
export const deleteLoan = (id: string) => api.del<void>(`/loans/${id}`);
