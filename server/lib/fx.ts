import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { fxRatesHistory } from "../db/schema";
import type * as schema from "../db/schema";
import { convertAmount, type RateSnapshot } from "../../shared/currency";

const FIXER_BASE_URL = "https://data.fixer.io/api";
// Fixer's free/basic plan only returns EUR-based rates (a custom `base` param
// gets rejected with a "base_currency_access_restricted" error) — conversion
// between any two currencies pivots through this via shared/currency.ts.
const FIXER_BASE_CURRENCY = "EUR";

type FixerResponse =
  | { success: true; base: string; rates: Record<string, number> }
  | { success: false; error: { code: number; type: string } };

function requireApiKey(): string {
  const key = process.env.FIXER_API_KEY;
  if (!key) throw new Error("FIXER_API_KEY is not set");
  return key;
}

async function fetchFixerEndpoint(path: string): Promise<FixerResponse> {
  const res = await fetch(`${FIXER_BASE_URL}/${path}?access_key=${requireApiKey()}`);
  return (await res.json()) as FixerResponse;
}

// The historical endpoint rejects "today" (and anything past Fixer's latest
// published date) with an invalid_date error — their publishing clock can lag
// or lead ours by up to a day. Falling back to /latest covers that case; the
// cache is still keyed by our own requested `date`, not whatever date Fixer
// reports back, so later lookups for "today" stay a cache hit regardless.
async function fetchRatesFromFixer(date: string): Promise<RateSnapshot> {
  let body = await fetchFixerEndpoint(date);

  if (!body.success && body.error.type === "invalid_date") {
    body = await fetchFixerEndpoint("latest");
  }

  if (!body.success) {
    throw new Error(`Fixer API error fetching rates for ${date}: ${body.error.type} (code ${body.error.code})`);
  }
  return { base: body.base, rates: body.rates };
}

// This table has no RLS (global reference data) so any transaction-scoped
// client works here, request-scoped or job-scoped alike.
export async function getRatesForDate(
  database: NodePgDatabase<typeof schema>,
  date: string,
): Promise<RateSnapshot> {
  const [existing] = await database
    .select()
    .from(fxRatesHistory)
    .where(and(eq(fxRatesHistory.date, date), eq(fxRatesHistory.baseCurrency, FIXER_BASE_CURRENCY)));

  if (existing) {
    return { base: existing.baseCurrency, rates: existing.rates };
  }

  const snapshot = await fetchRatesFromFixer(date);

  await database
    .insert(fxRatesHistory)
    .values({ date, baseCurrency: snapshot.base, rates: snapshot.rates })
    .onConflictDoUpdate({
      target: [fxRatesHistory.date, fxRatesHistory.baseCurrency],
      set: { rates: snapshot.rates },
    });

  return snapshot;
}

export async function convertOnDate(
  database: NodePgDatabase<typeof schema>,
  amount: number,
  from: string,
  to: string,
  date: string,
): Promise<number> {
  if (from === to) return amount;
  const snapshot = await getRatesForDate(database, date);
  return convertAmount(amount, from, to, snapshot);
}
