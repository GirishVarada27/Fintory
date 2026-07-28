import { describe, expect, it } from "vitest";
import { convertAmount, formatMoney, type RateSnapshot } from "./currency";

describe("convertAmount", () => {
  const snapshot: RateSnapshot = {
    base: "EUR",
    rates: { EUR: 1, USD: 1.1, GBP: 0.85 },
  };

  it("returns the amount unchanged when from and to are the same currency", () => {
    expect(convertAmount(100, "USD", "USD", snapshot)).toBe(100);
  });

  it("converts from the base currency directly", () => {
    expect(convertAmount(100, "EUR", "USD", snapshot)).toBeCloseTo(110, 5);
  });

  it("converts into the base currency directly", () => {
    expect(convertAmount(110, "USD", "EUR", snapshot)).toBeCloseTo(100, 5);
  });

  it("pivots through the base currency between two non-base currencies", () => {
    // 110 USD -> 100 EUR -> 85 GBP
    expect(convertAmount(110, "USD", "GBP", snapshot)).toBeCloseTo(85, 5);
  });

  it("round-trips within floating point tolerance", () => {
    const converted = convertAmount(100, "USD", "GBP", snapshot);
    const back = convertAmount(converted, "GBP", "USD", snapshot);
    expect(back).toBeCloseTo(100, 5);
  });

  it("throws for a currency missing from the rate snapshot", () => {
    expect(() => convertAmount(100, "USD", "JPY", snapshot)).toThrow(/No exchange rate/);
  });
});

describe("formatMoney", () => {
  it("formats a numeric amount with the currency symbol", () => {
    expect(formatMoney(1234.5, "USD")).toMatch(/1,234\.50/);
  });

  it("formats a string amount the same as a numeric one", () => {
    expect(formatMoney("1234.50", "USD")).toBe(formatMoney(1234.5, "USD"));
  });

  it("falls back to a plain 'amount CODE' string for an invalid currency code", () => {
    expect(formatMoney(10, "NOTREAL")).toBe("10.00 NOTREAL");
  });
});
