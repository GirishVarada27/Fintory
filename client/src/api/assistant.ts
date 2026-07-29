import { api } from "./client";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const sendChatMessage = (message: string, history: ChatMessage[]) =>
  api.post<{ data: { reply: string } }>("/assistant/chat", { message, history });
