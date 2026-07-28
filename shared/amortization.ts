export interface LoanAmortizationInput {
  principal: number;
  apr: number; // percentage, e.g. 5.25 for 5.25%
  termMonths: number;
  monthlyPayment: number;
  startDate: string | Date;
  asOf?: string | Date; // defaults to now; exposed for deterministic testing
}

export interface LoanAmortizationResult {
  monthsElapsed: number;
  outstandingPrincipal: number;
  monthsRemaining: number;
  isPaidOff: boolean;
  // true when the payment doesn't even cover accruing interest (negative
  // amortization) — the balance would never reach zero at this payment.
  isNonAmortizing: boolean;
}

// UTC getters, not local ones: startDate/asOf are date-only strings ("YYYY-MM-DD"),
// which JS parses as UTC midnight. Reading them back with local-timezone getters
// would shift the effective day (and sometimes month) depending on the server's
// timezone offset, making this non-deterministic across environments.
function wholeMonthsBetween(start: Date, end: Date): number {
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeLoanAmortization(input: LoanAmortizationInput): LoanAmortizationResult {
  const { principal, termMonths: n, monthlyPayment: M } = input;
  const r = input.apr / 100 / 12;
  const start = new Date(input.startDate);
  const asOf = input.asOf ? new Date(input.asOf) : new Date();
  const k = Math.min(wholeMonthsBetween(start, asOf), n);

  let balance = r === 0 ? principal - M * k : principal * (1 + r) ** k - M * (((1 + r) ** k - 1) / r);
  balance = Math.max(0, balance);

  if (balance === 0) {
    return {
      monthsElapsed: k,
      outstandingPrincipal: 0,
      monthsRemaining: 0,
      isPaidOff: true,
      isNonAmortizing: false,
    };
  }

  let monthsRemaining: number;
  let isNonAmortizing = false;

  if (r === 0) {
    monthsRemaining = M > 0 ? Math.ceil(balance / M) : n - k;
  } else {
    const x = 1 - (r * balance) / M;
    if (x <= 0) {
      isNonAmortizing = true;
      monthsRemaining = n - k;
    } else {
      monthsRemaining = Math.ceil(-Math.log(x) / Math.log(1 + r));
    }
  }

  monthsRemaining = Math.min(Math.max(monthsRemaining, 0), Math.max(n - k, 0));

  return {
    monthsElapsed: k,
    outstandingPrincipal: round2(balance),
    monthsRemaining,
    isPaidOff: false,
    isNonAmortizing,
  };
}
