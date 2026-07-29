import { describe, expect, it } from "vitest";
import { computeSpendingInsights } from "./insights";

describe("computeSpendingInsights", () => {
  it("flags a notable increase", () => {
    const insights = computeSpendingInsights(
      [{ categoryName: "Dining", total: "120.00" }],
      [{ categoryName: "Dining", total: "100.00" }],
      "USD",
    );
    expect(insights).toHaveLength(1);
    expect(insights[0].direction).toBe("up");
    expect(insights[0].percentChange).toBe(20);
    expect(insights[0].message).toContain("20% more on Dining");
  });

  it("flags a notable decrease", () => {
    const insights = computeSpendingInsights(
      [{ categoryName: "Groceries", total: "80.00" }],
      [{ categoryName: "Groceries", total: "100.00" }],
      "USD",
    );
    expect(insights[0].direction).toBe("down");
    expect(insights[0].percentChange).toBe(20);
    expect(insights[0].message).toContain("20% less on Groceries");
  });

  it("ignores changes below the notability threshold", () => {
    const insights = computeSpendingInsights(
      [{ categoryName: "Dining", total: "105.00" }],
      [{ categoryName: "Dining", total: "100.00" }],
      "USD",
    );
    expect(insights).toHaveLength(0);
  });

  it("ignores a category with no prior-month baseline", () => {
    const insights = computeSpendingInsights([{ categoryName: "Travel", total: "500.00" }], [], "USD");
    expect(insights).toHaveLength(0);
  });

  it("caps results and sorts by magnitude of change", () => {
    const current = [
      { categoryName: "A", total: "150" },
      { categoryName: "B", total: "200" },
      { categoryName: "C", total: "50" },
    ];
    const previous = [
      { categoryName: "A", total: "100" }, // +50%
      { categoryName: "B", total: "100" }, // +100%
      { categoryName: "C", total: "100" }, // -50%
    ];
    const insights = computeSpendingInsights(current, previous, "USD");
    expect(insights[0].categoryName).toBe("B");
    expect(insights[0].percentChange).toBe(100);
  });
});
