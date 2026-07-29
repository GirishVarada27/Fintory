import { api } from "./client";

export interface Share {
  id: string;
  ownerUserId: string;
  sharedWithUserId: string;
  permission: "view" | "edit";
  status: "pending" | "accepted";
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
  shareeName: string;
  shareeEmail: string;
}

export interface SharesResponse {
  data: { sent: Share[]; received: Share[] };
}

export const listShares = () => api.get<SharesResponse>("/shares");
export const inviteShare = (email: string, permission: "view" | "edit") =>
  api.post<{ data: Share }>("/shares", { email, permission });
export const acceptShare = (id: string) => api.patch<{ data: Share }>(`/shares/${id}/accept`, {});
export const updateSharePermission = (id: string, permission: "view" | "edit") =>
  api.patch<{ data: Share }>(`/shares/${id}`, { permission });
export const revokeShare = (id: string) => api.del<void>(`/shares/${id}`);
