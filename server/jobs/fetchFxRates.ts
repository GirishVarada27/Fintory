import { db } from "../db/index";
import { getRatesForDate } from "../lib/fx";

function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Proactively caches today's rate so same-day expense conversions don't pay
// the Fixer round-trip latency on the first request of the day. Historical
// backfill for past dates still happens lazily via getRatesForDate on demand.
export async function fetchTodaysFxRates(): Promise<void> {
  const date = todayUtcDateString();
  try {
    await getRatesForDate(db, date);
    console.log(`[fx] cached rates for ${date}`);
  } catch (err) {
    console.error(`[fx] failed to fetch rates for ${date}`, err);
  }
}
