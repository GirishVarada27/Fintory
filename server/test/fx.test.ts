import { afterAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "../db/index";
import { fxRatesHistory } from "../db/schema";
import { getRatesForDate } from "../lib/fx";

// Self-contained regardless of whether env vars are inherited from
// globalSetup's dotenv load — every network call in this file is mocked, so
// the actual key value never matters and no real Fixer quota is spent.
process.env.FIXER_API_KEY ||= "test-key";

const TEST_DATES = ["2020-06-15", "2020-06-16", "2020-06-17"];

async function cleanup() {
  for (const date of TEST_DATES) {
    await db.delete(fxRatesHistory).where(eq(fxRatesHistory.date, date));
  }
}

describe("getRatesForDate", () => {
  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  it("fetches from the provider on a cache miss and stores the result", async () => {
    const [date] = TEST_DATES;
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ success: true, base: "EUR", date, rates: { USD: 1.1, GBP: 0.85 } }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await getRatesForDate(db, date);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(snapshot.base).toBe("EUR");
    expect(snapshot.rates.USD).toBe(1.1);

    vi.unstubAllGlobals();
  });

  it("hits the cache on a second lookup for the same date, without calling the provider again", async () => {
    const [date] = TEST_DATES;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await getRatesForDate(db, date);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(snapshot.rates.USD).toBe(1.1);

    vi.unstubAllGlobals();
  });

  it("falls back to /latest when the historical endpoint reports invalid_date", async () => {
    const date = TEST_DATES[1];
    let callCount = 0;
    const fetchMock = vi.fn(async (url: string) => {
      callCount++;
      if (url.includes(`/api/${date}?`)) {
        return { json: async () => ({ success: false, error: { code: 302, type: "invalid_date" } }) };
      }
      return { json: async () => ({ success: true, base: "EUR", date, rates: { USD: 1.2 } }) };
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await getRatesForDate(db, date);

    expect(callCount).toBe(2);
    expect(snapshot.rates.USD).toBe(1.2);

    vi.unstubAllGlobals();
  });

  it("throws when the provider returns a non-invalid_date error", async () => {
    const date = TEST_DATES[2];
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ success: false, error: { code: 106, type: "rate_limit_reached" } }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRatesForDate(db, date)).rejects.toThrow(/rate_limit_reached/);

    vi.unstubAllGlobals();
  });
});
