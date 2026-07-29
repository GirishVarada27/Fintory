import { and, eq, gte, lte } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { assets, categories, expenses, income as incomeTable, loans, savingsAccounts } from "../db/schema";
import type * as schema from "../db/schema";
import { computeLoanAmortization } from "../../shared/amortization";
import { getCategorySpend } from "./categorySpend";
import type { GroqTool } from "./groq";

// Every tool below deliberately stays in each transaction's *native*
// currencies — no FX conversion. The assistant answers real questions with
// exact numbers; pivoting everything through Fixer would tie chat answers to
// the same free-tier rate limit that already breaks the dashboard's trend
// charts under heavy multi-currency use, for no benefit here (the model can
// present "$45 and AED 120" just fine without collapsing it to one number).

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const ALL_TIME_FROM = "2000-01-01";

// Resolved into the actual tool result (not left implicit) so the model can
// truthfully state which period an unqualified question was answered over,
// instead of guessing or omitting it.
function resolveRange(args: Record<string, unknown>): { from: string; to: string } {
  const from = args.from ? String(args.from) : ALL_TIME_FROM;
  const to = args.to ? String(args.to) : new Date().toISOString().slice(0, 10);
  return { from, to };
}

function groupByCurrency<T extends { currency: string; amount: number }>(rows: T[]): Record<string, string> {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.amount);
  return Object.fromEntries(Array.from(totals.entries()).map(([currency, total]) => [currency, total.toFixed(2)]));
}

export const ASSISTANT_TOOLS: GroqTool[] = [
  {
    type: "function",
    function: {
      name: "get_expenses",
      description:
        "List individual expense transactions in a date range (inclusive), optionally filtered by currency. Use this for questions about specific dates or short periods, e.g. 'how much did I spend on Dec 25 2025'. Omit from/to to search all recorded history.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Start date, YYYY-MM-DD, inclusive. Omit for no lower bound." },
          to: { type: "string", description: "End date, YYYY-MM-DD, inclusive. Omit for no upper bound." },
          currency: { type: "string", description: "Optional 3-letter currency code to filter to" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_income",
      description:
        "List individual income entries in a date range (inclusive), optionally filtered by currency. Omit from/to to search all recorded history.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Start date, YYYY-MM-DD, inclusive. Omit for no lower bound." },
          to: { type: "string", description: "End date, YYYY-MM-DD, inclusive. Omit for no upper bound." },
          currency: { type: "string", description: "Optional 3-letter currency code to filter to" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_category_breakdown",
      description:
        "Total spend per category per currency over a date range (inclusive). Use for questions like 'what did I spend the most on' or 'how much on groceries this year'. Omit from/to to cover all recorded history — state which range you used in your answer either way.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Start date, YYYY-MM-DD, inclusive. Omit for no lower bound." },
          to: { type: "string", description: "End date, YYYY-MM-DD, inclusive. Omit for no upper bound." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_net_worth",
      description:
        "Returns netWorthByCurrency (already computed: assets + savings - outstanding loan balance, per currency) plus the underlying assets/savings/loans list. Use netWorthByCurrency directly in your answer rather than re-deriving it from the line items yourself.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_historical_period_spending",
      description:
        "Total spend per currency for the same month-day range (e.g. Dec 20 - Dec 31) in every past year that has data. Use this for seasonal/recurring-period questions like 'what do I usually spend during the Christmas holidays' — always check how many years of data came back before presenting a confident forecast; with only one prior year, say so explicitly instead of stating a number as if it were a reliable average.",
      parameters: {
        type: "object",
        properties: {
          monthDayStart: { type: "string", description: "MM-DD, e.g. '12-20'" },
          monthDayEnd: { type: "string", description: "MM-DD, e.g. '12-31'" },
        },
        required: ["monthDayStart", "monthDayEnd"],
      },
    },
  },
];

export async function executeAssistantTool(
  tx: NodePgDatabase<typeof schema>,
  ownerId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "get_expenses": {
      const { from, to } = resolveRange(args);
      const currency = args.currency ? String(args.currency).toUpperCase() : undefined;
      const conditions = [eq(expenses.userId, ownerId), gte(expenses.date, from), lte(expenses.date, to)];
      if (currency) conditions.push(eq(expenses.currency, currency));
      // No row limit here: totals must reflect every matching row, not a
      // truncated page of them — an "all time" query can span hundreds of
      // rows and a silently-capped sum would just be a wrong number handed
      // to the model as if it were complete. Only the displayed item list
      // (not the totals) is capped, and that's stated explicitly below.
      const rows = await tx
        .select({
          date: expenses.date,
          vendor: expenses.vendor,
          amount: expenses.amount,
          currency: expenses.currency,
        })
        .from(expenses)
        .where(and(...conditions));
      const ITEM_DISPLAY_CAP = 50;
      return {
        rangeUsed: { from, to },
        count: rows.length,
        totalsByCurrency: groupByCurrency(rows.map((r) => ({ currency: r.currency, amount: Number(r.amount) }))),
        items: rows.slice(0, ITEM_DISPLAY_CAP),
        itemsTruncated: rows.length > ITEM_DISPLAY_CAP,
      };
    }

    case "get_income": {
      const { from, to } = resolveRange(args);
      const currency = args.currency ? String(args.currency).toUpperCase() : undefined;
      const conditions = [eq(incomeTable.userId, ownerId), gte(incomeTable.date, from), lte(incomeTable.date, to)];
      if (currency) conditions.push(eq(incomeTable.currency, currency));
      const rows = await tx
        .select({
          date: incomeTable.date,
          source: incomeTable.source,
          amount: incomeTable.amount,
          currency: incomeTable.currency,
        })
        .from(incomeTable)
        .where(and(...conditions));
      const ITEM_DISPLAY_CAP = 50;
      return {
        rangeUsed: { from, to },
        count: rows.length,
        totalsByCurrency: groupByCurrency(rows.map((r) => ({ currency: r.currency, amount: Number(r.amount) }))),
        items: rows.slice(0, ITEM_DISPLAY_CAP),
        itemsTruncated: rows.length > ITEM_DISPLAY_CAP,
      };
    }

    case "get_category_breakdown": {
      const { from, to } = resolveRange(args);
      const spendRows = await getCategorySpend(tx, ownerId, from, addDays(to, 1));
      const allCategories = await tx.select().from(categories);
      const nameById = new Map(allCategories.map((c) => [c.id, c.name]));
      const totals = new Map<string, number>();
      for (const row of spendRows) {
        const key = `${row.categoryId ? (nameById.get(row.categoryId) ?? "Uncategorized") : "Uncategorized"}|${row.currency}`;
        totals.set(key, (totals.get(key) ?? 0) + row.amount);
      }
      return {
        rangeUsed: { from, to },
        breakdown: Array.from(totals.entries()).map(([key, total]) => {
          const [categoryName, currency] = key.split("|");
          return { categoryName, currency, total: total.toFixed(2) };
        }),
      };
    }

    case "get_net_worth": {
      const allAssets = await tx.select().from(assets).where(eq(assets.userId, ownerId));
      const allSavings = await tx.select().from(savingsAccounts).where(eq(savingsAccounts.userId, ownerId));
      const allLoans = await tx.select().from(loans).where(eq(loans.userId, ownerId));
      const loansWithOutstanding = allLoans.map((l) => ({
        lender: l.lender,
        type: l.type,
        currency: l.currency,
        outstandingPrincipal: computeLoanAmortization({
          principal: Number(l.principal),
          apr: Number(l.apr),
          termMonths: l.termMonths,
          monthlyPayment: Number(l.monthlyPayment),
          startDate: l.startDate,
        }).outstandingPrincipal,
      }));

      // Net worth per currency is computed here, not left for the model to
      // add up — arithmetic on real financial figures should be exact code,
      // not language-model inference, even though the model is capable of
      // simple addition most of the time.
      const netWorthByCurrency = new Map<string, number>();
      for (const a of allAssets) netWorthByCurrency.set(a.currency, (netWorthByCurrency.get(a.currency) ?? 0) + Number(a.currentValue));
      for (const s of allSavings) netWorthByCurrency.set(s.currency, (netWorthByCurrency.get(s.currency) ?? 0) + Number(s.balance));
      for (const l of loansWithOutstanding) netWorthByCurrency.set(l.currency, (netWorthByCurrency.get(l.currency) ?? 0) - l.outstandingPrincipal);

      return {
        netWorthByCurrency: Object.fromEntries(
          Array.from(netWorthByCurrency.entries()).map(([currency, total]) => [currency, total.toFixed(2)]),
        ),
        assets: allAssets.map((a) => ({ name: a.name, type: a.type, currency: a.currency, value: a.currentValue })),
        savings: allSavings.map((s) => ({ name: s.name, currency: s.currency, balance: s.balance })),
        loans: loansWithOutstanding.map((l) => ({ ...l, outstandingPrincipal: l.outstandingPrincipal.toFixed(2) })),
      };
    }

    case "get_historical_period_spending": {
      const monthDayStart = String(args.monthDayStart);
      const monthDayEnd = String(args.monthDayEnd);
      const allExpenses = await tx
        .select({ date: expenses.date, amount: expenses.amount, currency: expenses.currency })
        .from(expenses)
        .where(eq(expenses.userId, ownerId));

      const byYear = new Map<number, { currency: string; amount: number }[]>();
      for (const row of allExpenses) {
        const [yearStr, ...rest] = row.date.split("-");
        const monthDay = rest.join("-");
        if (monthDay < monthDayStart || monthDay > monthDayEnd) continue;
        const year = Number(yearStr);
        const list = byYear.get(year) ?? [];
        list.push({ currency: row.currency, amount: Number(row.amount) });
        byYear.set(year, list);
      }

      const years = Array.from(byYear.keys()).sort();
      return {
        yearsOfDataFound: years.length,
        byYear: years.map((year) => ({ year, totalsByCurrency: groupByCurrency(byYear.get(year)!) })),
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
