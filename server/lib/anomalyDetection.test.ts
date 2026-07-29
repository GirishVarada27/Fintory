import { describe, expect, it } from "vitest";
import { detectDuplicates, detectUnusualAmounts, type ExpenseForAnomalyCheck } from "./anomalyDetection";

describe("detectDuplicates", () => {
  it("flags two expenses with the same normalized vendor, amount, currency, and date", () => {
    // Exact match (case/punctuation-insensitive), not fuzzy matching like
    // dedupe.ts — a genuine duplicate submission has the identical vendor
    // string, unlike a bank-sync vs. manual-entry name variant.
    const expenses: ExpenseForAnomalyCheck[] = [
      { id: "1", vendor: "Starbucks", amount: "5.50", currency: "USD", date: "2026-07-10" },
      { id: "2", vendor: "STARBUCKS", amount: "5.50", currency: "USD", date: "2026-07-10" },
    ];
    const dupes = detectDuplicates(expenses);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].expenseIds.sort()).toEqual(["1", "2"]);
  });

  it("does not flag a single occurrence", () => {
    const expenses: ExpenseForAnomalyCheck[] = [
      { id: "1", vendor: "Starbucks", amount: "5.50", currency: "USD", date: "2026-07-10" },
    ];
    expect(detectDuplicates(expenses)).toHaveLength(0);
  });

  it("does not flag the same vendor/amount on a different day", () => {
    const expenses: ExpenseForAnomalyCheck[] = [
      { id: "1", vendor: "Starbucks", amount: "5.50", currency: "USD", date: "2026-07-10" },
      { id: "2", vendor: "Starbucks", amount: "5.50", currency: "USD", date: "2026-07-11" },
    ];
    expect(detectDuplicates(expenses)).toHaveLength(0);
  });

  it("does not flag matching amount/date but a different currency", () => {
    const expenses: ExpenseForAnomalyCheck[] = [
      { id: "1", vendor: "Starbucks", amount: "5.50", currency: "USD", date: "2026-07-10" },
      { id: "2", vendor: "Starbucks", amount: "5.50", currency: "EUR", date: "2026-07-10" },
    ];
    expect(detectDuplicates(expenses)).toHaveLength(0);
  });
});

describe("detectUnusualAmounts", () => {
  function makeHistory(amounts: number[], startDate = "2026-01-01"): ExpenseForAnomalyCheck[] {
    return amounts.map((amount, i) => {
      const d = new Date(startDate);
      d.setUTCDate(d.getUTCDate() + i * 7);
      return {
        id: `e${i}`,
        vendor: "Netflix",
        amount: amount.toFixed(2),
        currency: "USD",
        date: d.toISOString().slice(0, 10),
      };
    });
  }

  it("flags a charge far outside the vendor's typical range", () => {
    const expenses = makeHistory([15, 15, 15, 15, 300]);
    const anomalies = detectUnusualAmounts(expenses);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].expenseId).toBe("e4");
    expect(anomalies[0].typicalAmount).toBe("15.00");
  });

  it("does not flag a charge within the typical range", () => {
    const expenses = makeHistory([15, 14.5, 15.5, 15, 15.2]);
    expect(detectUnusualAmounts(expenses)).toHaveLength(0);
  });

  it("does not flag without enough history to establish a baseline", () => {
    const expenses = makeHistory([15, 15, 300]);
    expect(detectUnusualAmounts(expenses)).toHaveLength(0);
  });

  it("does not flag when the vendor's amounts have always been identical (zero variance)", () => {
    const expenses = makeHistory([15, 15, 15, 15, 15]);
    expect(detectUnusualAmounts(expenses)).toHaveLength(0);
  });
});
