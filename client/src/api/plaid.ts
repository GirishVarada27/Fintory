import { api } from "./client";

export interface LinkedAccount {
  id: string;
  institutionName: string;
  accountName: string;
  accountType: string | null;
  mask: string | null;
  createdAt: string;
}

export const createLinkToken = () => api.post<{ data: { linkToken: string } }>("/plaid/link-token", {});
export const exchangePublicToken = (publicToken: string, institutionName: string) =>
  api.post<{ data: LinkedAccount[] }>("/plaid/exchange-token", { publicToken, institutionName });
export const listLinkedAccounts = () =>
  api.get<{ data: LinkedAccount[]; configured: boolean }>("/plaid/accounts");
export const unlinkAccount = (id: string) => api.del<void>(`/plaid/accounts/${id}`);
