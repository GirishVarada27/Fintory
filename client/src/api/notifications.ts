import { api, type ItemResponse } from "./client";

export interface Notification {
  id: string;
  userId: string;
  type: "budget_threshold" | "recurring_detected" | "loan_reminder";
  payload: Record<string, string | number>;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
}

export const listNotifications = () => api.get<{ data: Notification[] }>("/notifications");
export const markNotificationRead = (id: string) =>
  api.patch<ItemResponse<Notification>>(`/notifications/${id}/read`, {});
