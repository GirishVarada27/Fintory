const GEMINI_MODEL = "gemini-2.0-flash";

export interface ReceiptExtraction {
  vendor: string;
  amount: number;
  currency: string;
  date: string;
  categorySuggestion: string | null;
}

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    vendor: { type: "string" },
    amount: { type: "number" },
    currency: { type: "string", description: "3-letter ISO 4217 code" },
    date: { type: "string", description: "YYYY-MM-DD" },
    categorySuggestion: { type: "string", nullable: true },
  },
  required: ["vendor", "amount", "currency", "date"],
};

function requireApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

// Deliberately not the Claude API the doc names — the user chose Gemini's
// free tier for this call instead (see Stage 3 kickoff decisions) since it
// covers the same "photo -> structured JSON" job at zero cost.
export async function extractReceiptData(imageBuffer: Buffer, mimeType: string): Promise<ReceiptExtraction> {
  const key = requireApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: "Extract the vendor name, total amount, currency (3-letter ISO 4217 code), transaction date (YYYY-MM-DD), and a one-word spending category suggestion from this receipt photo. Respond with only the requested JSON.",
            },
            { inline_data: { mime_type: mimeType, data: imageBuffer.toString("base64") } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: EXTRACTION_SCHEMA,
      },
    }),
  });

  const body = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    throw new Error(`Gemini API error: ${body.error?.message ?? res.statusText}`);
  }

  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini response did not include extraction text");
  }

  const parsed: Record<string, unknown> = JSON.parse(text);
  return {
    vendor: String(parsed.vendor ?? ""),
    amount: Number(parsed.amount ?? 0),
    currency: String(parsed.currency ?? "USD").toUpperCase(),
    date: String(parsed.date ?? new Date().toISOString().slice(0, 10)),
    categorySuggestion: parsed.categorySuggestion ? String(parsed.categorySuggestion) : null,
  };
}
