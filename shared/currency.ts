export type RatesTable = Record<string, number>;

export interface RateSnapshot {
  base: string;
  rates: RatesTable;
}

export function formatMoney(amount: number | string, currency: string): string {
  const numeric = typeof amount === "string" ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${currency}`;
  }
}

function requireRate(rates: RatesTable, currency: string): number {
  const rate = rates[currency];
  if (rate === undefined) {
    throw new Error(`No exchange rate available for currency "${currency}"`);
  }
  return rate;
}

// Pivots through the snapshot's base currency (e.g. Fixer's rates are always
// EUR-based on the free/basic plan) rather than requiring a direct from->to
// rate, since a single base-currency table can convert between any pair.
export function convertAmount(amount: number, from: string, to: string, snapshot: RateSnapshot): number {
  if (from === to) return amount;
  const { base, rates } = snapshot;

  const amountInBase = from === base ? amount : amount / requireRate(rates, from);
  return to === base ? amountInBase : amountInBase * requireRate(rates, to);
}
