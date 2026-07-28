import { describe, expect, it } from "vitest";
import { isLikelyDuplicate, findDuplicateExpense, type ExistingExpenseForDedupe } from "./dedupe";

describe("isLikelyDuplicate", () => {
  const existing: ExistingExpenseForDedupe = {
    id: "existing-1",
    vendor: "McDonalds",
    amount: "12.00",
    currency: "USD",
    date: "2026-07-10",
  };

  it("matches an exact vendor/amount/date/currency", () => {
    expect(isLikelyDuplicate({ vendor: "McDonalds", amount: 12, currency: "USD", date: "2026-07-10" }, existing)).toBe(
      true,
    );
  });

  it("matches vendor names that differ only in punctuation/case (bank-formatted vs. manually-typed)", () => {
    expect(
      isLikelyDuplicate({ vendor: "MCDONALD'S #4471", amount: 12, currency: "USD", date: "2026-07-10" }, existing),
    ).toBe(true);
  });

  it("matches when the date is a day or two off (posting delay)", () => {
    expect(isLikelyDuplicate({ vendor: "McDonalds", amount: 12, currency: "USD", date: "2026-07-12" }, existing)).toBe(
      true,
    );
  });

  it("matches when the amount is off by a fraction of a cent (float rounding)", () => {
    expect(
      isLikelyDuplicate({ vendor: "McDonalds", amount: 12.004, currency: "USD", date: "2026-07-10" }, existing),
    ).toBe(true);
  });

  it("rejects a different currency even if everything else matches", () => {
    expect(isLikelyDuplicate({ vendor: "McDonalds", amount: 12, currency: "EUR", date: "2026-07-10" }, existing)).toBe(
      false,
    );
  });

  it("rejects an amount that's meaningfully different", () => {
    expect(isLikelyDuplicate({ vendor: "McDonalds", amount: 15, currency: "USD", date: "2026-07-10" }, existing)).toBe(
      false,
    );
  });

  it("rejects a date more than a couple of days apart", () => {
    expect(isLikelyDuplicate({ vendor: "McDonalds", amount: 12, currency: "USD", date: "2026-07-20" }, existing)).toBe(
      false,
    );
  });

  it("rejects an unrelated vendor name", () => {
    expect(isLikelyDuplicate({ vendor: "Starbucks", amount: 12, currency: "USD", date: "2026-07-10" }, existing)).toBe(
      false,
    );
  });
});

describe("findDuplicateExpense", () => {
  const candidates: ExistingExpenseForDedupe[] = [
    { id: "1", vendor: "Starbucks", amount: "4.33", currency: "USD", date: "2026-07-10" },
    { id: "2", vendor: "McDonalds", amount: "12.00", currency: "USD", date: "2026-07-10" },
    { id: "3", vendor: "Uber", amount: "6.33", currency: "USD", date: "2026-07-26" },
  ];

  it("returns the matching existing expense when one exists", () => {
    const match = findDuplicateExpense(
      { vendor: "MCDONALD'S", amount: 12, currency: "USD", date: "2026-07-10" },
      candidates,
    );
    expect(match?.id).toBe("2");
  });

  it("returns null when nothing matches", () => {
    const match = findDuplicateExpense(
      { vendor: "Trader Joes", amount: 55, currency: "USD", date: "2026-07-10" },
      candidates,
    );
    expect(match).toBeNull();
  });
});
