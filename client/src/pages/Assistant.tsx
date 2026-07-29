import { useEffect, useRef, useState, type FormEvent } from "react";
import { sendChatMessage, type ChatMessage } from "../api/assistant";
import { ApiError } from "../api/client";
import { cardClass, inputClass, primaryButtonClass } from "../lib/ui";

const SUGGESTIONS = [
  "How much did I spend last month?",
  "What category do I spend the most on?",
  "What's my current net worth?",
];

export default function Assistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setError(null);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await sendChatMessage(text, messages.slice(-20));
      setMessages([...nextMessages, { role: "assistant", content: res.data.reply }]);
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_CONFIGURED") {
        setError("The assistant isn't set up yet — ask the site owner to add a Groq API key.");
      } else {
        setError(err instanceof Error ? err.message : "The assistant is temporarily unavailable.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Assistant</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Ask about your spending, income, or net worth — answers are computed from your real data, not guessed.
        </p>
      </div>

      <div className={`flex-1 space-y-3 overflow-y-auto ${cardClass}`}>
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-slate-500">Try asking:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full bg-black/5 px-3 py-1.5 text-xs text-slate-700 hover:bg-black/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] rounded-2xl rounded-br-sm bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-4 py-2 text-sm text-white"
                  : "max-w-[80%] rounded-2xl rounded-bl-sm bg-black/5 px-4 py-2 text-sm text-slate-800 dark:bg-white/10 dark:text-slate-200"
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-black/5 px-4 py-2 text-sm text-slate-500 dark:bg-white/10">
              Thinking…
            </div>
          </div>
        )}
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="assistant-input" className="sr-only">
          Ask the assistant a question
        </label>
        <input
          id="assistant-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your finances…"
          className={inputClass}
        />
        <button type="submit" disabled={loading || !input.trim()} className={primaryButtonClass}>
          Send
        </button>
      </form>
    </div>
  );
}
