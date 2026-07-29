import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { validateBody } from "../middleware/validate";
import { chatRequestSchema, type ChatRequest } from "../../shared/schemas/assistant";
import { resolveViewContext } from "../lib/viewContext";
import { groqChat, isGroqConfigured, type GroqMessage } from "../lib/groq";
import { ASSISTANT_TOOLS, executeAssistantTool } from "../lib/assistantTools";

export const assistantRouter = Router();

// Each round trips an external API call — cheap for the user, but still a
// real per-request cost, so rate-limited the same way receipt scanning is.
const chatRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? "unknown"),
});

// Caps how many tool-call <-> tool-result round trips a single question can
// take before giving up, so a confused model can't loop forever.
const MAX_TOOL_ROUNDS = 5;

function systemPrompt(today: string): string {
  return (
    "You are Fintory's financial assistant. Answer the user's questions about their own finances using the " +
    "tools available — always call a tool to get exact numbers rather than estimating from memory, since you " +
    "have no built-in knowledge of their data. Amounts may exist in multiple currencies (USD, AED, INR, etc.); " +
    "report each with its currency rather than mixing them into one number or assuming an exchange rate. Several " +
    "tools require an explicit date range — if the user's question doesn't specify one, pick a sensible default " +
    "(e.g. all available history, or the current month/year) and always state in your answer which period you " +
    "used, so the number isn't presented as if its scope were obvious. When " +
    "asked to project or estimate future spending from historical patterns, check how many years of relevant " +
    "history the tools actually returned — with only one or two data points, say so explicitly rather than " +
    "presenting a guess as a reliable forecast. When a historical tool returns multiple years, compute and state " +
    "the average across all of them (mentioning the individual years too) rather than quoting just one year's " +
    "figure as if it were typical. If a tool returns no data or an empty result, do not call it " +
    "again with the same arguments — that means the data genuinely doesn't exist; just tell the user that " +
    `directly instead of retrying. Today's date is ${today}. Keep answers concise and concrete.`
  );
}

assistantRouter.post("/chat", chatRateLimit, validateBody(chatRequestSchema), async (req, res) => {
  if (!isGroqConfigured()) {
    res.status(503).json({
      error: { code: "NOT_CONFIGURED", message: "The assistant isn't set up yet — no Groq API key configured." },
    });
    return;
  }

  const view = await resolveViewContext(req, res);
  if (!view) return;

  const { message, history } = req.body as ChatRequest;
  const today = new Date().toISOString().slice(0, 10);

  const messages: GroqMessage[] = [
    { role: "system", content: systemPrompt(today) },
    ...history.map((h): GroqMessage => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  // Detects a model re-issuing the exact same tool call after already
  // seeing its (empty or unhelpful) result — smaller open-weight models
  // will sometimes retry identically instead of accepting the answer,
  // otherwise burning through MAX_TOOL_ROUNDS and returning nothing.
  const seenCalls = new Set<string>();

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const reply = await groqChat(messages, ASSISTANT_TOOLS);
      messages.push(reply);

      if (!reply.tool_calls || reply.tool_calls.length === 0) {
        res.json({ data: { reply: reply.content ?? "" } });
        return;
      }

      for (const call of reply.tool_calls) {
        const args: Record<string, unknown> = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        const signature = `${call.function.name}:${JSON.stringify(args)}`;

        let result: unknown;
        if (seenCalls.has(signature)) {
          result = { note: "You already called this exact tool with these exact arguments — the result hasn't changed. Answer the user directly instead of calling it again." };
        } else {
          seenCalls.add(signature);
          try {
            result = await executeAssistantTool(req.db, view.ownerId, call.function.name, args);
          } catch (err) {
            result = { error: err instanceof Error ? err.message : "Tool execution failed" };
          }
        }

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(result),
        });
      }
    }

    // Give up on further tool calls and force a text answer from whatever
    // was actually gathered, rather than surfacing a bare error — the user
    // still gets a real (if possibly partial) response.
    const finalReply = await groqChat(messages);
    res.json({ data: { reply: finalReply.content ?? "I wasn't able to fully answer that — try rephrasing it." } });
  } catch (err) {
    console.error("[assistant] chat failed", err);
    res.status(502).json({ error: { code: "ASSISTANT_ERROR", message: "The assistant is temporarily unavailable." } });
  }
});
