// Approximate hex values of the Tailwind shades used in the app's UI, kept
// in one place so the PDF report visually matches the product instead of
// drifting into its own palette.
export const COLORS = {
  fuchsia: "#d946ef",
  violet: "#8b5cf6",
  cyan: "#06b6d4",
  emerald: "#10b981",
  rose: "#f43f5e",
  amber: "#f59e0b",
  slate900: "#0f172a",
  slate700: "#334155",
  slate500: "#64748b",
  slate300: "#cbd5e1",
  slate100: "#f1f5f9",
  white: "#ffffff",
} as const;

const CHART_PALETTE = [COLORS.fuchsia, COLORS.violet, COLORS.cyan, COLORS.emerald, COLORS.amber, COLORS.rose];

function hex(component: number): string {
  return Math.round(component).toString(16).padStart(2, "0");
}

function interpolateColor(from: string, to: string, t: number): string {
  const a = [1, 3, 5].map((i) => parseInt(from.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16));
  const mixed = a.map((v, i) => v + (b[i] - v) * t);
  return `#${hex(mixed[0])}${hex(mixed[1])}${hex(mixed[2])}`;
}

// pdfkit has no native gradient fill for arbitrary shapes without its
// canvas-style gradient objects being wired up per-shape, which is fiddlier
// than it's worth here — slicing the band into narrow strips and
// interpolating between stops reads as a smooth gradient at print/screen
// resolution and works with the same rect-fill API as everything else.
function drawGradientBand(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, stops: string[]) {
  const strips = 60;
  const stripWidth = w / strips;
  for (let i = 0; i < strips; i++) {
    const t = i / (strips - 1);
    const segment = t * (stops.length - 1);
    const idx = Math.min(Math.floor(segment), stops.length - 2);
    const localT = segment - idx;
    const color = interpolateColor(stops[idx], stops[idx + 1], localT);
    doc.rect(x + i * stripWidth, y, stripWidth + 1, h).fill(color);
  }
}

export function drawHeader(
  doc: PDFKit.PDFDocument,
  opts: { month: string; generatedAt: string; pageWidth: number; marginX: number },
) {
  const bandHeight = 92;
  drawGradientBand(doc, 0, 0, doc.page.width, bandHeight, [COLORS.fuchsia, COLORS.violet, COLORS.cyan]);

  doc
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(24)
    .text("Fintory", opts.marginX, 26, { continued: false });
  doc.font("Helvetica").fontSize(12).text("Monthly Financial Report", opts.marginX, 54);

  const rightText = `${opts.month}`;
  doc.font("Helvetica-Bold").fontSize(14).text(rightText, opts.marginX, 26, { width: opts.pageWidth, align: "right" });
  doc
    .font("Helvetica")
    .fontSize(9)
    .text(`Generated ${opts.generatedAt}`, opts.marginX, 46, { width: opts.pageWidth, align: "right" });

  doc.fillColor(COLORS.slate900);
  doc.y = bandHeight + 24;
}

export function drawSectionTitle(doc: PDFKit.PDFDocument, x: number, title: string) {
  doc.font("Helvetica-Bold").fontSize(13).fillColor(COLORS.slate900).text(title, x, doc.y);
  doc.moveDown(0.4);
}

export interface SummaryCard {
  label: string;
  value: string;
  accent: string;
}

export function drawSummaryCards(doc: PDFKit.PDFDocument, x: number, width: number, cards: SummaryCard[]) {
  const gap = 16;
  const cardWidth = (width - gap * (cards.length - 1)) / cards.length;
  const cardHeight = 68;
  const y = doc.y;

  cards.forEach((card, i) => {
    const cx = x + i * (cardWidth + gap);
    doc.roundedRect(cx, y, cardWidth, cardHeight, 8).fill(COLORS.slate100);
    doc.roundedRect(cx, y, 4, cardHeight, 2).fill(card.accent);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.slate500)
      .text(card.label.toUpperCase(), cx + 16, y + 14, { width: cardWidth - 28 });
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(COLORS.slate900)
      .text(card.value, cx + 16, y + 32, { width: cardWidth - 28 });
  });

  doc.y = y + cardHeight + 20;
}

export interface InsightRow {
  message: string;
  direction: "up" | "down";
}

export function drawInsights(doc: PDFKit.PDFDocument, x: number, width: number, insights: InsightRow[]) {
  if (insights.length === 0) return;
  drawSectionTitle(doc, x, "Insights");

  const boxTop = doc.y;
  const rowHeight = 20;
  const boxHeight = insights.length * rowHeight + 16;
  doc.roundedRect(x, boxTop, width, boxHeight, 8).fill(COLORS.slate100);

  let y = boxTop + 10;
  for (const insight of insights) {
    const color = insight.direction === "up" ? COLORS.rose : COLORS.emerald;
    // Small triangle marker instead of relying on an emoji glyph, which
    // isn't reliably present in PDFKit's built-in Helvetica font metrics.
    const cx = x + 16;
    const cy = y + 7;
    if (insight.direction === "up") {
      doc.polygon([cx, cy + 5], [cx + 5, cy - 5], [cx + 10, cy + 5]).fill(color);
    } else {
      doc.polygon([cx, cy - 5], [cx + 5, cy + 5], [cx + 10, cy - 5]).fill(color);
    }
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.slate700)
      .text(insight.message, x + 34, y, { width: width - 50 });
    y += rowHeight;
  }

  doc.y = boxTop + boxHeight + 20;
}

export interface BarChartRow {
  label: string;
  value: number;
}

export function drawBarChart(
  doc: PDFKit.PDFDocument,
  x: number,
  width: number,
  rows: BarChartRow[],
  formatValue: (n: number) => string,
) {
  if (rows.length === 0) return;
  const sorted = [...rows].sort((a, b) => b.value - a.value).slice(0, 8);
  const max = Math.max(...sorted.map((r) => r.value), 1);
  const labelWidth = 120;
  const valueWidth = 80;
  const barAreaWidth = width - labelWidth - valueWidth;
  const rowHeight = 22;

  let y = doc.y;
  sorted.forEach((row, i) => {
    const barWidth = Math.max(2, (row.value / max) * barAreaWidth);
    const color = CHART_PALETTE[i % CHART_PALETTE.length];

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.slate700)
      .text(row.label, x, y + 5, { width: labelWidth - 8, ellipsis: true });

    doc.roundedRect(x + labelWidth, y + 3, barAreaWidth, 12, 3).fill(COLORS.slate100);
    doc.roundedRect(x + labelWidth, y + 3, barWidth, 12, 3).fill(color);

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(COLORS.slate900)
      .text(formatValue(row.value), x + labelWidth + barAreaWidth + 8, y + 5, { width: valueWidth - 8 });

    y += rowHeight;
  });

  doc.y = y + 12;
}

export interface TableColumn {
  header: string;
  width: number;
  align?: "left" | "right";
}

export function drawTable(
  doc: PDFKit.PDFDocument,
  x: number,
  columns: TableColumn[],
  rows: string[][],
  opts: { boldLastRow?: boolean } = {},
) {
  const rowHeight = 22;
  const headerHeight = 24;
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);
  let y = doc.y;

  doc.roundedRect(x, y, tableWidth, headerHeight, 4).fill(COLORS.slate900);
  let cx = x;
  columns.forEach((col) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(COLORS.white)
      .text(col.header.toUpperCase(), cx + 8, y + 7, { width: col.width - 16, align: col.align ?? "left" });
    cx += col.width;
  });
  y += headerHeight;

  rows.forEach((row, i) => {
    const isLast = opts.boldLastRow && i === rows.length - 1;
    if (i % 2 === 1 && !isLast) {
      doc.rect(x, y, tableWidth, rowHeight).fill(COLORS.slate100);
    }
    if (isLast) {
      doc.rect(x, y, tableWidth, rowHeight).fill(COLORS.slate100);
      doc
        .moveTo(x, y)
        .lineTo(x + tableWidth, y)
        .strokeColor(COLORS.slate300)
        .lineWidth(1)
        .stroke();
    }
    cx = x;
    row.forEach((cell, colIdx) => {
      const col = columns[colIdx];
      doc
        .font(isLast ? "Helvetica-Bold" : "Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.slate900)
        .text(cell, cx + 8, y + 6, { width: col.width - 16, align: col.align ?? "left" });
      cx += col.width;
    });
    y += rowHeight;
  });

  doc.y = y + 16;
}

export function drawFooter(doc: PDFKit.PDFDocument, marginX: number) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - 40;
    // Writing this close to the bottom edge is inside pdfkit's bottom
    // margin, which makes .text() think the content overflows and silently
    // starts a new page — zero the margin just for these calls so it treats
    // the full page height as fair game instead of auto-paginating.
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .moveTo(marginX, y)
      .lineTo(doc.page.width - marginX, y)
      .strokeColor(COLORS.slate300)
      .lineWidth(0.5)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLORS.slate500)
      .text("Fintory — this report is for your own reference and is not financial advice.", marginX, y + 8, {
        width: doc.page.width - marginX * 2 - 60,
        lineBreak: false,
      })
      .text(`${i + 1} / ${range.count}`, doc.page.width - marginX - 60, y + 8, {
        width: 60,
        align: "right",
        lineBreak: false,
      });
    doc.page.margins.bottom = originalBottomMargin;
  }
}

export function ensureSpace(doc: PDFKit.PDFDocument, needed: number, marginBottom: number) {
  if (doc.y + needed > doc.page.height - marginBottom) {
    doc.addPage();
  }
}
