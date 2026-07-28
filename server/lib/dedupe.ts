export interface DedupeCandidate {
  vendor: string;
  amount: number;
  currency: string;
  date: string;
}

export interface ExistingExpenseForDedupe {
  id: string;
  vendor: string;
  amount: string;
  currency: string;
  date: string;
}

const AMOUNT_TOLERANCE = 0.01;
const DATE_WINDOW_DAYS = 2;

function normalizeVendor(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
}

// True when `candidate` (a transaction pulled in via bank sync) looks like
// the same real-world purchase as `existing` (an already-recorded expense,
// typically entered manually before the bank sync caught up to it) — same
// currency, amount within a cent, date within a couple of days, and a vendor
// name that's a substring match either direction once normalized (handles
// "Trader Joe's #123" vs. "TRADER JOES 123 SAN FRANCISCO").
export function isLikelyDuplicate(candidate: DedupeCandidate, existing: ExistingExpenseForDedupe): boolean {
  if (candidate.currency !== existing.currency) return false;
  if (Math.abs(candidate.amount - Number(existing.amount)) > AMOUNT_TOLERANCE) return false;
  if (daysBetween(candidate.date, existing.date) > DATE_WINDOW_DAYS) return false;

  const a = normalizeVendor(candidate.vendor);
  const b = normalizeVendor(existing.vendor);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

export function findDuplicateExpense(
  candidate: DedupeCandidate,
  existingExpenses: ExistingExpenseForDedupe[],
): ExistingExpenseForDedupe | null {
  return existingExpenses.find((e) => isLikelyDuplicate(candidate, e)) ?? null;
}
