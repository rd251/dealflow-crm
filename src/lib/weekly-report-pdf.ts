import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type C3 = [number, number, number];
const BRAND_RED: C3 = [218, 41, 28];
const BRAND_DARK: C3 = [80, 0, 0];
const LIGHT_BG: C3 = [248, 247, 245];
const WHITE: C3 = [255, 255, 255];
const GREEN: C3 = [22, 163, 74];
const AMBER: C3 = [245, 158, 11];
const GRAY: C3 = [120, 120, 120];
const LIGHT_GRAY: C3 = [230, 228, 225];
const BLUE: C3 = [59, 130, 246];

interface ReportData {
  generatedAt: string;
  periodLabel: string;
  snapshot: {
    totalPipeline: number;
    pipelineEndring: number | null;
    vunnetVerdi: number;
    taptVerdi: number;
    winRate: number | null;
  };
  wonDeals: { selskap: string; verdi: number | null; ansvarlig: string | null }[];
  lostDeals: { selskap: string; verdi: number | null; tapsaarsak: string | null }[];
  stageBreakdown: { stage: string; totalVerdi: number; antall: number }[];
  nearClosing: { selskap: string; verdi: number | null; sistAktivitet: string | null }[];
  kundeSnapshot: {
    antallLive: number;
    antallIkkeLive: number;
    snittDagerTilGoLive: number | null;
    antallPause: number;
    antallChurn: number;
  };
  gaattLive: { selskap: string; dagerFraVunnet: number | null }[];
  ikkeLive: { selskap: string; dagerSidenVunnet: number | null; advarsel: boolean }[];
  planlagtGoLive: { selskap: string; planlagtDato: string }[];
  pauseChurn: { selskap: string; status: string; aarsak: string | null }[];
  innsikt: string[];
}

const nok = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("no-NO") + " kr" : "–";

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("no-NO", { day: "numeric", month: "long", year: "numeric" });
};

// ── LOGO as embedded PNG from logo-white.svg ──
const LOGO_PNG = "data:image/png;base64,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";

function drawLogo(doc: jsPDF, x: number, y: number) {
  // Logo image: 415x80 original, scale to ~45mm wide for better visibility
  const logoW = 45;
  const logoH = (80 / 415) * logoW;
  doc.addImage(LOGO_PNG, "PNG", x - logoW, y - logoH / 2, logoW, logoH);
}

// ── MINI BAR CHART drawn with shapes ──
function drawBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  data: { label: string; value: number; color: C3 }[]
) {
  if (data.length === 0) return;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.min((w - (data.length - 1) * 3) / data.length, 18);
  const totalBarsW = data.length * barW + (data.length - 1) * 3;
  const startX = x + (w - totalBarsW) / 2;

  // Subtle grid lines
  for (let i = 0; i <= 4; i++) {
    const gy = y + h - (h * i) / 4;
    doc.setDrawColor(235, 235, 235);
    doc.setLineWidth(0.15);
    doc.line(x, gy, x + w, gy);
  }

  data.forEach((d, i) => {
    const barH = (d.value / maxVal) * (h - 12);
    const bx = startX + i * (barW + 3);
    const by = y + h - barH;

    // Bar with rounded top
    doc.setFillColor(...d.color);
    doc.roundedRect(bx, by, barW, barH, 1.5, 1.5, "F");

    // Value on top
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...d.color);
    const valText = d.value >= 1000 ? `${Math.round(d.value / 1000)}k` : `${d.value}`;
    doc.text(valText, bx + barW / 2, by - 2, { align: "center" });

    // Label below
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    const shortLabel = d.label.length > 10 ? d.label.substring(0, 9) + ".." : d.label;
    doc.text(shortLabel, bx + barW / 2, y + h + 4, { align: "center" });
  });
}

// ── DONUT CHART drawn with arcs ──
function drawDonutChart(
  doc: jsPDF,
  cx: number,
  cy: number,
  r: number,
  segments: { value: number; color: C3; label: string }[]
) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return;

  let startAngle = -Math.PI / 2;
  const innerR = r * 0.55;

  segments.forEach((seg) => {
    const sweep = (seg.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sweep;

    // Draw filled arc using small polygon segments
    doc.setFillColor(...seg.color);
    const points: [number, number][] = [];
    const steps = Math.max(Math.ceil(sweep / 0.05), 8);

    // Outer arc
    for (let i = 0; i <= steps; i++) {
      const a = startAngle + (sweep * i) / steps;
      points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    // Inner arc (reversed)
    for (let i = steps; i >= 0; i--) {
      const a = startAngle + (sweep * i) / steps;
      points.push([cx + innerR * Math.cos(a), cy + innerR * Math.sin(a)]);
    }

    // Draw as filled polygon
    if (points.length > 2) {
      doc.setFillColor(...seg.color);
      // Use lines to create the shape
      const [first, ...rest] = points;
      doc.moveTo(first[0], first[1]);
      rest.forEach((p) => doc.lineTo(p[0], p[1]));
      doc.lineTo(first[0], first[1]);
      (doc as any).internal.out("f");
    }

    startAngle = endAngle;
  });

  // Center white circle (donut hole)
  doc.setFillColor(...WHITE);
  doc.circle(cx, cy, innerR - 0.5, "F");

  // Center text
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_DARK);
  doc.text(`${total}`, cx, cy + 1, { align: "center" });
  doc.setFontSize(5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text("deals", cx, cy + 5, { align: "center" });

  // Legend
  let ly = cy + r + 8;
  segments.forEach((seg) => {
    doc.setFillColor(...seg.color);
    doc.circle(cx - 12, ly - 1, 1.5, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND_DARK);
    doc.text(`${seg.label} (${seg.value})`, cx - 8, ly);
    ly += 5;
  });
}

export function generateWeeklyReportPDF(data: ReportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 20;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;
  let y = 0;

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageH - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // ══════════════════════════════════════════
  // PAGE 1 HEADER
  // ══════════════════════════════════════════
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pageW, 44, "F");
  doc.setFillColor(...BRAND_RED);
  doc.rect(0, 44, pageW, 2.5, "F");

  doc.setTextColor(...WHITE);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Ukentlig Salgsrapport", marginL, 22);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 200);
  doc.text(`${data.periodLabel}  |  Generert ${formatDate(data.generatedAt)}`, marginL, 32);

  drawLogo(doc, pageW - marginR, 22);

  y = 56;

  // ══════════════════════════════════════════
  // 1. KPI SNAPSHOT CARDS
  // ══════════════════════════════════════════
  const snapBoxH = 34;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(marginL, y, contentW, snapBoxH, 4, 4, "F");

  const snapCols = 5;
  const colW = contentW / snapCols;
  const snapItems = [
    { label: "PIPELINE", value: nok(data.snapshot.totalPipeline), color: BRAND_DARK, sub: data.snapshot.pipelineEndring != null ? `${data.snapshot.pipelineEndring > 0 ? "+" : ""}${data.snapshot.pipelineEndring}%` : null, subColor: data.snapshot.pipelineEndring != null ? (data.snapshot.pipelineEndring > 0 ? GREEN : BRAND_RED) : GRAY },
    { label: "VUNNET", value: nok(data.snapshot.vunnetVerdi), color: GREEN, sub: null, subColor: GRAY },
    { label: "TAPT", value: nok(data.snapshot.taptVerdi), color: BRAND_RED, sub: null, subColor: GRAY },
    { label: "WIN RATE", value: data.snapshot.winRate != null ? `${data.snapshot.winRate}%` : "–", color: BRAND_DARK, sub: null, subColor: GRAY },
    { label: "DEALS", value: `${data.wonDeals.length + data.lostDeals.length}`, color: BRAND_DARK, sub: `${data.wonDeals.length}V / ${data.lostDeals.length}T`, subColor: GRAY },
  ];

  snapItems.forEach((item, i) => {
    const cx = marginL + colW * i + colW / 2;

    // Vertical separator
    if (i > 0) {
      doc.setDrawColor(...LIGHT_GRAY);
      doc.setLineWidth(0.3);
      doc.line(marginL + colW * i, y + 8, marginL + colW * i, y + snapBoxH - 8);
    }

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text(item.label, cx, y + 11, { align: "center" });

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(item.color as C3));
    doc.text(item.value, cx, y + 20, { align: "center" });

    if (item.sub) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...(item.subColor as C3));
      doc.text(item.sub, cx, y + 27, { align: "center" });
    }
  });

  y += snapBoxH + 12;

  // ══════════════════════════════════════════
  // 2. CHARTS ROW — Pipeline bar chart + Win/Loss donut
  // ══════════════════════════════════════════
  if (data.stageBreakdown.length > 0 || data.wonDeals.length + data.lostDeals.length > 0) {
    checkPageBreak(65);

    const chartH = 50;
    const chartGap = 10;
    const barChartW = contentW * 0.6;
    const donutW = contentW - barChartW - chartGap;

    // Bar chart card
    doc.setFillColor(...WHITE);
    doc.setDrawColor(240, 240, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginL, y, barChartW, chartH + 14, 3, 3, "FD");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_DARK);
    doc.text("Pipeline per stage", marginL + 6, y + 8);

    const stageColors: C3[] = [
      [59, 130, 246],   // blue
      [99, 102, 241],   // indigo
      [168, 85, 247],   // purple
      [236, 72, 153],   // pink
      [245, 158, 11],   // amber
      [22, 163, 74],    // green
      BRAND_RED,
      BRAND_DARK,
      GRAY,
      BLUE,
    ];

    if (data.stageBreakdown.length > 0) {
      const barData = data.stageBreakdown.map((s, i) => ({
        label: s.stage,
        value: s.totalVerdi,
        color: stageColors[i % stageColors.length],
      }));
      drawBarChart(doc, marginL + 4, y + 12, barChartW - 8, chartH - 4, barData);
    }

    // Donut chart card
    const donutX = marginL + barChartW + chartGap;
    doc.setFillColor(...WHITE);
    doc.setDrawColor(240, 240, 240);
    doc.roundedRect(donutX, y, donutW, chartH + 14, 3, 3, "FD");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_DARK);
    doc.text("Vunnet / Tapt", donutX + 6, y + 8);

    const wonCount = data.wonDeals.length;
    const lostCount = data.lostDeals.length;
    if (wonCount + lostCount > 0) {
      drawDonutChart(
        doc,
        donutX + donutW / 2,
        y + 30,
        13,
        [
          { value: wonCount, color: GREEN, label: "Vunnet" },
          { value: lostCount, color: BRAND_RED, label: "Tapt" },
        ]
      );
    }

    y += chartH + 14 + 10;
  }

  // ══════════════════════════════════════════
  // SECTION HELPER
  // ══════════════════════════════════════════
  const drawSectionHeader = (title: string) => {
    checkPageBreak(20);
    doc.setDrawColor(...BRAND_RED);
    doc.setLineWidth(0.6);
    doc.line(marginL, y, marginL + contentW, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_DARK);
    doc.text(title.toUpperCase(), marginL, y);
    y += 6;
  };

  // ══════════════════════════════════════════
  // 3. VUNNET
  // ══════════════════════════════════════════
  if (data.wonDeals.length > 0) {
    drawSectionHeader(`Vunnet (${data.wonDeals.length})`);
    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["Selskap", "Verdi/mnd", "Ansvarlig"]],
      body: data.wonDeals.map((d) => [d.selskap, nok(d.verdi), d.ansvarlig || "–"]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3, textColor: BRAND_DARK },
      headStyles: { fillColor: [240, 253, 244] as C3, textColor: GREEN, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [252, 252, 250] as C3 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ══════════════════════════════════════════
  // 4. TAPT
  // ══════════════════════════════════════════
  if (data.lostDeals.length > 0) {
    drawSectionHeader(`Tapt (${data.lostDeals.length})`);
    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["Selskap", "Verdi/mnd", "Tapsaarsak"]],
      body: data.lostDeals.map((d) => [d.selskap, nok(d.verdi), d.tapsaarsak || "–"]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3, textColor: BRAND_DARK },
      headStyles: { fillColor: [254, 242, 242] as C3, textColor: BRAND_RED, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [252, 252, 250] as C3 },
      columnStyles: { 1: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ══════════════════════════════════════════
  // 5. PIPELINE PER STAGE (table)
  // ══════════════════════════════════════════
  if (data.stageBreakdown.length > 0) {
    drawSectionHeader("Pipeline per stage");
    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["Stage", "Antall", "Total verdi/mnd"]],
      body: data.stageBreakdown.map((s) => [s.stage, `${s.antall}`, nok(s.totalVerdi)]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3, textColor: BRAND_DARK },
      headStyles: { fillColor: LIGHT_BG, textColor: BRAND_DARK, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [252, 252, 250] as C3 },
      columnStyles: { 1: { halign: "center" }, 2: { halign: "right", fontStyle: "bold" } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ══════════════════════════════════════════
  // 6. NAER CLOSING
  // ══════════════════════════════════════════
  if (data.nearClosing.length > 0) {
    drawSectionHeader(`Naer closing (${data.nearClosing.length})`);
    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["Selskap", "Verdi/mnd", "Siste aktivitet"]],
      body: data.nearClosing.map((d) => [d.selskap, nok(d.verdi), d.sistAktivitet ? formatDate(d.sistAktivitet) : "–"]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3, textColor: BRAND_DARK },
      headStyles: { fillColor: [255, 247, 237] as C3, textColor: AMBER, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [252, 252, 250] as C3 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ══════════════════════════════════════════
  // 7. INNSIKT
  // ══════════════════════════════════════════
  if (data.innsikt.length > 0) {
    drawSectionHeader("AI-innsikt");
    checkPageBreak(data.innsikt.length * 7 + 10);
    doc.setFillColor(...LIGHT_BG);
    const innsiktH = data.innsikt.length * 6.5 + 8;
    doc.roundedRect(marginL, y, contentW, innsiktH, 2, 2, "F");
    // Left red accent bar
    doc.setFillColor(...BRAND_RED);
    doc.rect(marginL, y, 1.5, innsiktH, "F");

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND_DARK);
    data.innsikt.forEach((item, i) => {
      doc.text(`>  ${item}`, marginL + 6, y + 6 + i * 6.5);
    });
    y += innsiktH + 10;
  }

  // ══════════════════════════════════════════
  // PAGE 2: KUNDER & GO-LIVE
  // ══════════════════════════════════════════
  doc.addPage();
  y = 0;

  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pageW, 32, "F");
  doc.setFillColor(...BRAND_RED);
  doc.rect(0, 32, pageW, 2, "F");

  doc.setTextColor(...WHITE);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Kunder & Go-live", marginL, 20);

  drawLogo(doc, pageW - marginR, 18);

  y = 44;

  // ── KUNDE SNAPSHOT ──
  const ks = data.kundeSnapshot;
  const kSnapH = 26;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(marginL, y, contentW, kSnapH, 4, 4, "F");

  const kItems = [
    { label: "LIVE", value: `${ks.antallLive}`, color: GREEN },
    { label: "IKKE LIVE", value: `${ks.antallIkkeLive}`, color: AMBER },
    { label: "SNITT TIL LIVE", value: ks.snittDagerTilGoLive != null ? `${ks.snittDagerTilGoLive}d` : "–", color: BRAND_DARK },
    { label: "PAUSE", value: `${ks.antallPause}`, color: AMBER },
    { label: "CHURN", value: `${ks.antallChurn}`, color: BRAND_RED },
  ];

  const kColW = contentW / kItems.length;
  kItems.forEach((item, i) => {
    const cx = marginL + kColW * i + kColW / 2;
    if (i > 0) {
      doc.setDrawColor(...LIGHT_GRAY);
      doc.setLineWidth(0.3);
      doc.line(marginL + kColW * i, y + 6, marginL + kColW * i, y + kSnapH - 6);
    }
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text(item.label, cx, y + 10, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(item.color as C3));
    doc.text(item.value, cx, y + 20, { align: "center" });
  });

  y += kSnapH + 10;

  // ── GAATT LIVE DENNE UKEN ──
  if (data.gaattLive.length > 0) {
    drawSectionHeader(`Gaatt live denne uken (${data.gaattLive.length})`);
    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["Selskap", "Dager fra vunnet til live"]],
      body: data.gaattLive.map((d) => [d.selskap, d.dagerFraVunnet != null ? `${d.dagerFraVunnet} dager` : "–"]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3, textColor: BRAND_DARK },
      headStyles: { fillColor: [240, 253, 244] as C3, textColor: GREEN, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [252, 252, 250] as C3 },
      columnStyles: { 1: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── IKKE LIVE ──
  if (data.ikkeLive.length > 0) {
    drawSectionHeader(`Ikke live ennaa (${data.ikkeLive.length})`);
    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["Selskap", "Dager siden vunnet", ""]],
      body: data.ikkeLive.map((d) => [d.selskap, d.dagerSidenVunnet != null ? `${d.dagerSidenVunnet} dager` : "–", d.advarsel ? "!" : ""]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3, textColor: BRAND_DARK },
      headStyles: { fillColor: [255, 251, 235] as C3, textColor: AMBER, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [252, 252, 250] as C3 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "center", cellWidth: 12 } },
      didParseCell: (hookData: any) => {
        if (hookData.section === "body" && hookData.row.raw[2] === "!") {
          hookData.cell.styles.textColor = AMBER;
          hookData.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── PLANLAGT GO-LIVE ──
  if (data.planlagtGoLive.length > 0) {
    drawSectionHeader(`Planlagt go-live (${data.planlagtGoLive.length})`);
    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["Selskap", "Planlagt dato"]],
      body: data.planlagtGoLive.map((d) => [d.selskap, formatDate(d.planlagtDato)]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3, textColor: BRAND_DARK },
      headStyles: { fillColor: LIGHT_BG, textColor: BRAND_DARK, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [252, 252, 250] as C3 },
      columnStyles: { 1: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── PAUSE / CHURN ──
  if (data.pauseChurn.length > 0) {
    drawSectionHeader(`Pause / Churn (${data.pauseChurn.length})`);
    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["Selskap", "Status", "Aarsak"]],
      body: data.pauseChurn.map((d) => [d.selskap, d.status, d.aarsak || "–"]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3, textColor: BRAND_DARK },
      headStyles: { fillColor: [254, 242, 242] as C3, textColor: BRAND_RED, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [252, 252, 250] as C3 },
      didParseCell: (hookData: any) => {
        if (hookData.section === "body" && hookData.column.index === 1) {
          hookData.cell.styles.textColor = hookData.cell.raw === "Kansellert" ? BRAND_RED : AMBER;
          hookData.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ══════════════════════════════════════════
  // FOOTER on each page
  // ══════════════════════════════════════════
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LIGHT_GRAY);
    doc.setLineWidth(0.3);
    doc.line(marginL, pageH - 12, pageW - marginR, pageH - 12);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text("Snakk CRM  |  Ukentlig Salgsrapport", marginL, pageH - 8);
    doc.text(`Side ${i} av ${totalPages}`, pageW - marginR, pageH - 8, { align: "right" });
  }

  return doc;
}
