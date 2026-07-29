import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { expenses } from "../db/schema";
import { validateQuery } from "../middleware/validate";
import { isoDate, currencyCode } from "../../shared/schemas/common";
import { formatMoney } from "../../shared/currency";
import { computeDashboardSummary } from "../lib/dashboardSummary";
import {
  COLORS,
  drawBarChart,
  drawFooter,
  drawHeader,
  drawInsights,
  drawSectionTitle,
  drawSummaryCards,
  drawTable,
  ensureSpace,
} from "../lib/pdfReport";

export const exportRouter = Router();

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const csvQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  categoryId: z.string().uuid().optional(),
  currency: currencyCode.optional(),
});

exportRouter.get("/expenses.csv", validateQuery(csvQuerySchema), async (req, res) => {
  const query = req.validatedQuery as z.infer<typeof csvQuerySchema>;
  const conditions = [eq(expenses.userId, req.user!.id)];
  if (query.from) conditions.push(gte(expenses.date, query.from));
  if (query.to) conditions.push(lte(expenses.date, query.to));
  if (query.categoryId) conditions.push(eq(expenses.categoryId, query.categoryId));
  if (query.currency) conditions.push(eq(expenses.currency, query.currency));

  const rows = await req.db
    .select()
    .from(expenses)
    .where(and(...conditions))
    .orderBy(desc(expenses.date))
    .limit(10000);

  const header = ["date", "vendor", "amount", "currency", "source", "tags", "notes"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.date,
        csvEscape(r.vendor),
        r.amount,
        r.currency,
        r.source,
        csvEscape(r.tags.join("; ")),
        csvEscape(r.notes ?? ""),
      ].join(","),
    );
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="expenses.csv"');
  res.send(lines.join("\n"));
});

const reportQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM")
    .optional(),
  format: z.enum(["currency", "percentage"]).default("currency"),
});

exportRouter.get("/report.pdf", validateQuery(reportQuerySchema), async (req, res) => {
  const { month, format } = req.validatedQuery as z.infer<typeof reportQuerySchema>;
  const isPercentage = format === "percentage";
  const summary = await computeDashboardSummary(req.db, req.user!.id, month);

  res.setHeader("Content-Type", "application/pdf");
  const filenameSuffix = isPercentage ? "-percentage" : "";
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="fintory-report-${summary.month}${filenameSuffix}.pdf"`,
  );

  const doc = new PDFDocument({ margin: 50, bufferPages: true });
  doc.pipe(res);

  const marginX = 50;
  const contentWidth = doc.page.width - marginX * 2;
  const generatedAt = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

  drawHeader(doc, { month: summary.month, generatedAt, pageWidth: contentWidth, marginX });

  if (summary.converted.unavailable) {
    const boxTop = doc.y;
    doc.roundedRect(marginX, boxTop, contentWidth, 40, 6).fill(COLORS.slate100);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.rose)
      .text(summary.converted.note, marginX + 14, boxTop + 14, { width: contentWidth - 28 });
    doc.y = boxTop + 56;
  } else {
    drawSummaryCards(doc, marginX, contentWidth, [
      {
        label: `This month's spend (${summary.converted.currency})`,
        value: formatMoney(summary.converted.monthTotalSpend, summary.converted.currency),
        accent: COLORS.fuchsia,
      },
      {
        label: `Net worth (${summary.converted.currency})`,
        value: formatMoney(summary.converted.netWorth, summary.converted.currency),
        accent: COLORS.cyan,
      },
    ]);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLORS.slate500)
      .text(summary.converted.note, marginX, doc.y - 8, { width: contentWidth });
    doc.y += 14;
  }

  drawInsights(
    doc,
    marginX,
    contentWidth,
    summary.insights.map((insight) => ({ message: insight.message, direction: insight.direction })),
  );

  for (const currencySummary of summary.byCurrency) {
    ensureSpace(doc, 220, 60);
    const sectionSuffix = isPercentage ? " (% of spend)" : "";
    drawSectionTitle(doc, marginX, `${currencySummary.currency} — Category Breakdown${sectionSuffix}`);

    if (currencySummary.categoryBreakdown.length > 0) {
      const categoryTotal = currencySummary.categoryBreakdown.reduce((sum, c) => sum + Number(c.total), 0);
      const formatValue = isPercentage
        ? (n: number) => `${categoryTotal > 0 ? Math.round((n / categoryTotal) * 100) : 0}%`
        : (n: number) => formatMoney(n, currencySummary.currency);

      drawBarChart(
        doc,
        marginX,
        contentWidth,
        currencySummary.categoryBreakdown.map((c) => ({ label: c.categoryName, value: Number(c.total) })),
        formatValue,
      );

      ensureSpace(doc, currencySummary.categoryBreakdown.length * 22 + 60, 60);
      drawTable(
        doc,
        marginX,
        [
          { header: "Category", width: contentWidth - 140 },
          { header: isPercentage ? "% of Spend" : "Amount", width: 140, align: "right" },
        ],
        [
          ...currencySummary.categoryBreakdown
            .slice()
            .sort((a, b) => Number(b.total) - Number(a.total))
            .map((c) => [c.categoryName, formatValue(Number(c.total))]),
          [
            "Total spend this month",
            isPercentage ? "100%" : formatMoney(currencySummary.monthTotalSpend, currencySummary.currency),
          ],
        ],
        { boldLastRow: true },
      );
    } else {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(COLORS.slate500)
        .text("No expenses recorded in this currency for this month.", marginX, doc.y);
      doc.y += 20;
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLORS.slate700)
      .text(`Net worth: ${formatMoney(currencySummary.netWorth, currencySummary.currency)}`, marginX, doc.y);
    doc.y += 28;
  }

  drawFooter(doc, marginX);
  doc.end();
});
