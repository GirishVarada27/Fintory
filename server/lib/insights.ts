export interface CategoryTotal {
  categoryName: string;
  total: string;
}

export interface SpendingInsight {
  message: string;
  categoryName: string;
  currency: string;
  percentChange: number;
  direction: "up" | "down";
}

const NOTABLE_CHANGE_THRESHOLD_PCT = 15;
const MAX_INSIGHTS = 5;

// Compares this month's category totals against last month's for one
// currency, surfacing only notable swings (>=15%) and skipping categories
// with no prior-month baseline (a brand-new category isn't "up infinity%").
export function computeSpendingInsights(
  currentBreakdown: CategoryTotal[],
  previousBreakdown: CategoryTotal[],
  currency: string,
): SpendingInsight[] {
  const prevMap = new Map(previousBreakdown.map((b) => [b.categoryName, Number(b.total)]));
  const insights: SpendingInsight[] = [];

  for (const cat of currentBreakdown) {
    const current = Number(cat.total);
    const previous = prevMap.get(cat.categoryName);
    if (!previous) continue;

    const percentChange = ((current - previous) / previous) * 100;
    if (Math.abs(percentChange) < NOTABLE_CHANGE_THRESHOLD_PCT) continue;

    const direction: "up" | "down" = percentChange > 0 ? "up" : "down";
    const roundedPct = Math.round(Math.abs(percentChange));
    insights.push({
      categoryName: cat.categoryName,
      currency,
      percentChange: roundedPct,
      direction,
      message: `You spent ${roundedPct}% ${direction === "up" ? "more" : "less"} on ${cat.categoryName} this month than last month.`,
    });
  }

  return insights.sort((a, b) => b.percentChange - a.percentChange).slice(0, MAX_INSIGHTS);
}
