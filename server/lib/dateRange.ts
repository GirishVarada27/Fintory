export interface MonthRange {
  start: string;
  end: string;
  month: string;
}

// [start, end) as plain date strings for a given "YYYY-MM", defaulting to
// the server's current local month when omitted.
export function monthRange(monthStr?: string): MonthRange {
  const now = new Date();
  const [year, month] = monthStr ? monthStr.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonthDate = new Date(year, month, 1);
  const end = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end, month: `${year}-${String(month).padStart(2, "0")}` };
}
