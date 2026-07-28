import { describe, expect, it } from "vitest";
import { computeLoanAmortization } from "./amortization";

function standardMonthlyPayment(principal: number, apr: number, termMonths: number): number {
  const r = apr / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - (1 + r) ** -termMonths);
}

describe("computeLoanAmortization", () => {
  const startDate = "2025-01-01";

  it("at the start date, outstanding equals principal and months remaining equals the term", () => {
    const principal = 10000;
    const apr = 6;
    const termMonths = 12;
    const monthlyPayment = standardMonthlyPayment(principal, apr, termMonths);

    const result = computeLoanAmortization({
      principal,
      apr,
      termMonths,
      monthlyPayment,
      startDate,
      asOf: startDate,
    });

    expect(result.monthsElapsed).toBe(0);
    expect(result.outstandingPrincipal).toBeCloseTo(principal, 2);
    expect(result.monthsRemaining).toBe(termMonths);
    expect(result.isPaidOff).toBe(false);
  });

  it("is fully paid off once the full term has elapsed with a correctly sized payment", () => {
    const principal = 10000;
    const apr = 6;
    const termMonths = 12;
    const monthlyPayment = standardMonthlyPayment(principal, apr, termMonths);

    const result = computeLoanAmortization({
      principal,
      apr,
      termMonths,
      monthlyPayment,
      startDate,
      asOf: "2026-01-01",
    });

    expect(result.monthsElapsed).toBe(termMonths);
    expect(result.outstandingPrincipal).toBeCloseTo(0, 1);
    expect(result.monthsRemaining).toBe(0);
    expect(result.isPaidOff).toBe(true);
  });

  it("outstanding principal decreases monotonically over the term", () => {
    const principal = 10000;
    const apr = 6;
    const termMonths = 12;
    const monthlyPayment = standardMonthlyPayment(principal, apr, termMonths);
    const checkpoints = ["2025-01-01", "2025-04-01", "2025-07-01", "2025-10-01", "2026-01-01"];

    const balances = checkpoints.map(
      (asOf) => computeLoanAmortization({ principal, apr, termMonths, monthlyPayment, startDate, asOf })
        .outstandingPrincipal,
    );

    for (let i = 1; i < balances.length; i++) {
      expect(balances[i]).toBeLessThanOrEqual(balances[i - 1]);
    }
  });

  it("handles 0% APR as straight-line principal paydown", () => {
    const result = computeLoanAmortization({
      principal: 1200,
      apr: 0,
      termMonths: 12,
      monthlyPayment: 100,
      startDate,
      asOf: "2025-07-01", // 6 whole months after Jan 1
    });

    expect(result.outstandingPrincipal).toBeCloseTo(600, 2);
    expect(result.monthsRemaining).toBe(6);
    expect(result.isPaidOff).toBe(false);
  });

  it("flags non-amortizing loans where the payment doesn't cover accruing interest", () => {
    const result = computeLoanAmortization({
      principal: 10000,
      apr: 36, // 3%/month
      termMonths: 60,
      monthlyPayment: 50, // well under the ~300/mo interest-only payment
      startDate,
      asOf: "2025-06-01",
    });

    expect(result.isNonAmortizing).toBe(true);
    expect(result.isPaidOff).toBe(false);
    expect(result.monthsRemaining).toBeGreaterThan(0);
  });

  it("is not affected by the server's local timezone (date-only strings are UTC-anchored)", () => {
    // Regression test: wholeMonthsBetween must use UTC getters. Using local
    // getters on a Date parsed from a "YYYY-MM-DD" string (always UTC
    // midnight) would shift results depending on the machine's timezone.
    const result = computeLoanAmortization({
      principal: 1200,
      apr: 0,
      termMonths: 12,
      monthlyPayment: 100,
      startDate: "2025-01-01",
      asOf: "2025-02-01",
    });

    expect(result.monthsElapsed).toBe(1);
  });
});
