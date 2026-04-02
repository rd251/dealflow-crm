import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type C3 = [number, number, number];
const BRAND_RED: C3 = [218, 41, 28];
const BRAND_DARK: C3 = [26, 25, 23];
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

// ── LOGO as embedded PNG (white text "SNAKK") ──
// We'll draw the logo text manually with nice styling instead of embedding the SVG

function drawLogo(doc: jsPDF, x: number, y: number) {
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text("SNAKK", x, y, { align: "right" });
  // Red dot accent
  doc.setFillColor(...BRAND_RED);
  doc.circle(x - 42, y - 4.5, 1.8, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 180);
  doc.text("CRM", x, y + 5, { align: "right" });
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
