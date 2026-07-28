import { describe, expect, it } from "vitest";
import { budgetSpendFromRows } from "./budgetStatus";
import type { CategorySpendRow } from "./categorySpend";

describe("budgetSpendFromRows", () => {
  const categoryId = "11111111-1111-1111-1111-111111111111";
  const otherCategoryId = "22222222-2222-2222-2222-222222222222";

  const rows: CategorySpendRow[] = [
    { categoryId, currency: "USD", amount: 40 },
    { categoryId, currency: "USD", amount: 35 },
    { categoryId, currency: "EUR", amount: 100 }, // different currency, must not count
    { categoryId: otherCategoryId, currency: "USD", amount: 999 }, // different category, must not count
    { categoryId: null, currency: "USD", amount: 500 }, // uncategorized, must not count
  ];

  it("sums only rows matching both the category and currency", () => {
    const { spentToDate } = budgetSpendFromRows(rows, categoryId, "USD", 100);
    expect(spentToDate).toBe(75);
  });

  it("computes percentUsed relative to the monthly limit", () => {
    const { percentUsed } = budgetSpendFromRows(rows, categoryId, "USD", 100);
    expect(percentUsed).toBe(75);
  });

  it("can exceed 100% when spend is over the limit", () => {
    const { percentUsed } = budgetSpendFromRows(rows, categoryId, "USD", 50);
    expect(percentUsed).toBe(150);
  });

  it("returns 0% when there is no matching spend at all", () => {
    const { spentToDate, percentUsed } = budgetSpendFromRows(rows, otherCategoryId, "EUR", 100);
    expect(spentToDate).toBe(0);
    expect(percentUsed).toBe(0);
  });

  it("does not divide by zero when monthlyLimit is 0", () => {
    const { percentUsed } = budgetSpendFromRows(rows, categoryId, "USD", 0);
    expect(percentUsed).toBe(0);
  });
});
