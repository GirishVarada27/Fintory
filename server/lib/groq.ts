// Groq exposes an OpenAI-compatible Chat Completions API, so this talks to it
// with a plain fetch (same style as the Gemini call in receiptExtraction.ts)
// rather than pulling in an SDK for one endpoint.
const GROQ_MODEL = "llama-3.3-70b-versatile";

export interface GroqToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface GroqMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface GroqTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface GroqChatResponse {
  choices: { message: GroqMessage; finish_reason: string }[];
  error?: { message: string };
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

export async function groqChat(messages: GroqMessage[], tools?: GroqTool[]): Promise<GroqMessage> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      ...(tools && tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
      temperature: 0.2,
    }),
  });

  const body = (await res.json()) as GroqChatResponse;
  if (!res.ok) {
    throw new Error(`Groq API error (${res.status}): ${body.error?.message ?? res.statusText}`);
  }

  const message = body.choices[0]?.message;
  if (!message) {
    throw new Error("Groq response had no message");
  }
  return message;
}
