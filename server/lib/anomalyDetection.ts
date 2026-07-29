export interface ExpenseForAnomalyCheck {
  id: string;
  vendor: string;
  amount: string;
  currency: string;
  date: string;
}

export interface DuplicateAnomaly {
  type: "duplicate";
  expenseIds: string[];
  vendor: string;
  amount: string;
  currency: string;
  date: string;
}

export interface UnusualAmountAnomaly {
  type: "unusual_amount";
  expenseId: string;
  vendor: string;
  amount: string;
  currency: string;
  date: string;
  typicalAmount: string;
}

export type Anomaly = DuplicateAnomaly | UnusualAmountAnomaly;

function normalizeVendor(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Same vendor (normalized), amount, currency, and calendar day — the classic
// "submitted twice" pattern (manual entry duplicated, or a sync + manual
// entry that the vendor-name normalization in dedupe.ts didn't quite match).
export function detectDuplicates(expenses: ExpenseForAnomalyCheck[]): DuplicateAnomaly[] {
  const groups = new Map<string, ExpenseForAnomalyCheck[]>();
  for (const e of expenses) {
    const key = `${normalizeVendor(e.vendor)}::${e.amount}::${e.currency}::${e.date}`;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }

  const anomalies: DuplicateAnomaly[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    anomalies.push({
      type: "duplicate",
      expenseIds: group.map((e) => e.id),
      vendor: group[0].vendor,
      amount: group[0].amount,
      currency: group[0].currency,
      date: group[0].date,
    });
  }
  return anomalies;
}

const MIN_BASELINE_SIZE = 3;
const UNUSUAL_STDDEV_MULTIPLIER = 2.5;

// Flags the most recent charge from a vendor as unusual when it's far outside
// that vendor's own typical range for this user (requires at least a few
// prior charges to establish a baseline — no baseline, no verdict).
export function detectUnusualAmounts(expenses: ExpenseForAnomalyCheck[]): UnusualAmountAnomaly[] {
  const groups = new Map<string, ExpenseForAnomalyCheck[]>();
  for (const e of expenses) {
    const key = `${normalizeVendor(e.vendor)}::${e.currency}`;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }

  const anomalies: UnusualAmountAnomaly[] = [];
  for (const group of groups.values()) {
    if (group.length < MIN_BASELINE_SIZE + 1) continue;

    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    const candidate = sorted[sorted.length - 1];
    const baseline = sorted.slice(0, -1).map((e) => Number(e.amount));

    const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
    const variance = baseline.reduce((sum, v) => sum + (v - mean) ** 2, 0) / baseline.length;
    const stddev = Math.sqrt(variance);
    const candidateAmount = Number(candidate.amount);

    // A perfectly consistent baseline (stddev 0) means ANY deviation is
    // notable — there's no "normal" variance to measure the jump against.
    const isUnusual = stddev === 0 ? candidateAmount !== mean : Math.abs(candidateAmount - mean) > stddev * UNUSUAL_STDDEV_MULTIPLIER;

    if (isUnusual) {
      anomalies.push({
        type: "unusual_amount",
        expenseId: candidate.id,
        vendor: candidate.vendor,
        amount: candidate.amount,
        currency: candidate.currency,
        date: candidate.date,
        typicalAmount: mean.toFixed(2),
      });
    }
  }
  return anomalies;
}
