import { api } from "./client";

export const deleteAccount = (confirmation: string) => api.del<void>("/account", { confirmation });
