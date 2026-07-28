import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { expenses } from "../db/schema";
import { validateQuery } from "../middleware/validate";
import { isoDate, currencyCode } from "../../shared/schemas/common";
import { formatMoney } from "../../shared/currency";
import { computeDashboardSummary } from "../lib/dashboardSummary";

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
});

exportRouter.get("/report.pdf", validateQuery(reportQuerySchema), async (req, res) => {
  const { month } = req.validatedQuery as z.infer<typeof reportQuerySchema>;
  const summary = await computeDashboardSummary(req.db, req.user!.id, month);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="fintory-report-${summary.month}.pdf"`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  doc.fontSize(20).text("Fintory Monthly Report", { align: "left" });
  doc.fontSize(12).fillColor("#666").text(summary.month).fillColor("#000");
  doc.moveDown();

  doc.fontSize(14).text(`Converted total (${summary.converted.currency})`);
  doc.fontSize(11);
  if (summary.converted.unavailable) {
    doc.fillColor("#a33").text(summary.converted.note).fillColor("#000");
  } else {
    doc.text(`Spend this month: ${formatMoney(summary.converted.monthTotalSpend, summary.converted.currency)}`);
    doc.text(`Net worth: ${formatMoney(summary.converted.netWorth, summary.converted.currency)}`);
    doc.fillColor("#666").text(summary.converted.note).fillColor("#000");
  }
  doc.moveDown();

  for (const currencySummary of summary.byCurrency) {
    doc.fontSize(14).text(`${currencySummary.currency} (native)`);
    doc.fontSize(11);
    doc.text(`Spend this month: ${formatMoney(currencySummary.monthTotalSpend, currencySummary.currency)}`);
    doc.text(`Net worth: ${formatMoney(currencySummary.netWorth, currencySummary.currency)}`);
    if (currencySummary.categoryBreakdown.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(12).text("Category breakdown:");
      doc.fontSize(11);
      for (const cat of currencySummary.categoryBreakdown) {
        doc.text(`  ${cat.categoryName}: ${formatMoney(cat.total, currencySummary.currency)}`);
      }
    }
    doc.moveDown();
  }

  doc.end();
});
