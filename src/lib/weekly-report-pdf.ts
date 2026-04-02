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

  // ── HEADER ──
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pageW, 42, "F");

  // Red accent line
  doc.setFillColor(...BRAND_RED);
  doc.rect(0, 42, pageW, 2.5, "F");

  doc.setTextColor(...WHITE);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Ukentlig Salgsrapport", marginL, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 200);
  doc.text(`${data.periodLabel}  •  Generert ${formatDate(data.generatedAt)}`, marginL, 30);

  // Snakk logo text
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text("SNAKK", pageW - marginR, 20, { align: "right" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 180);
  doc.text("CRM", pageW - marginR, 26, { align: "right" });

  y = 54;

  // ══════ 1. SNAPSHOT ══════
  const snapBoxH = 32;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(marginL, y, contentW, snapBoxH, 3, 3, "F");

  const snapCols = 5;
  const colW = contentW / snapCols;
  const snapItems = [
    { label: "PIPELINE", value: nok(data.snapshot.totalPipeline), color: BRAND_DARK, sub: data.snapshot.pipelineEndring != null ? `${data.snapshot.pipelineEndring > 0 ? "↑" : "↓"} ${Math.abs(data.snapshot.pipelineEndring)}%` : null, subColor: data.snapshot.pipelineEndring != null ? (data.snapshot.pipelineEndring > 0 ? GREEN : BRAND_RED) : GRAY },
    { label: "VUNNET", value: nok(data.snapshot.vunnetVerdi), color: GREEN, sub: null, subColor: GRAY },
    { label: "TAPT", value: nok(data.snapshot.taptVerdi), color: BRAND_RED, sub: null, subColor: GRAY },
    { label: "WIN RATE", value: data.snapshot.winRate != null ? `${data.snapshot.winRate}%` : "–", color: BRAND_DARK, sub: null, subColor: GRAY },
    { label: "DEALS", value: `${data.wonDeals.length + data.lostDeals.length}`, color: BRAND_DARK, sub: `${data.wonDeals.length}W / ${data.lostDeals.length}T`, subColor: GRAY },
  ];

  snapItems.forEach((item, i) => {
    const cx = marginL + colW * i + colW / 2;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text(item.label, cx, y + 10, { align: "center" });

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(item.color as [number, number, number]));
    doc.text(item.value, cx, y + 19, { align: "center" });

    if (item.sub) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...(item.subColor as [number, number, number]));
      doc.text(item.sub, cx, y + 25, { align: "center" });
    }
  });

  y += snapBoxH + 10;

  // ══════ SECTION HELPER ══════
  const drawSectionHeader = (title: string, icon: string) => {
    checkPageBreak(20);
    // Thin red line
    doc.setDrawColor(...BRAND_RED);
    doc.setLineWidth(0.5);
    doc.line(marginL, y, marginL + contentW, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_DARK);
    doc.text(`${icon}  ${title}`, marginL, y);
    y += 6;
  };

  // ══════ 2. VUNNET ══════
  if (data.wonDeals.length > 0) {
    drawSectionHeader(`VUNNET (${data.wonDeals.length})`, "🏆");
    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["Selskap", "Verdi/mnd", "Ansvarlig"]],
      body: data.wonDeals.map((d) => [d.selskap, nok(d.verdi), d.ansvarlig || "–"]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3, textColor: BRAND_DARK as unknown as number[] },
      headStyles: { fillColor: [240, 253, 244] as unknown as number[], textColor: GREEN as unknown as number[], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [252, 252, 250] as unknown as number[] },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ══════ 3. TAPT ══════
  if (data.lostDeals.length > 0) {
    drawSectionHeader(`TAPT (${data.lostDeals.length})`, "❌");
    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["Selskap", "Verdi/mnd", "Tapsårsak"]],
      body: data.lostDeals.map((d) => [d.selskap, nok(d.verdi), d.tapsaarsak || "–"]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3, textColor: BRAND_DARK as unknown as number[] },
      headStyles: { fillColor: [254, 242, 242] as unknown as number[], textColor: BRAND_RED as unknown as number[], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [252, 252, 250] as unknown as number[] },
      columnStyles: { 1: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ══════ 4. PIPELINE PER STAGE ══════
  if (data.stageBreakdown.length > 0) {
    drawSectionHeader("PIPELINE PER STAGE", "📈");
    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["Stage", "Antall", "Total verdi/mnd"]],
      body: data.stageBreakdown.map((s) => [s.stage, `${s.antall}`, nok(s.totalVerdi)]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3, textColor: BRAND_DARK as unknown as number[] },
      headStyles: { fillColor: LIGHT_BG as unknown as number[], textColor: BRAND_DARK as unknown as number[], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [252, 252, 250] as unknown as number[] },
      columnStyles: { 1: { halign: "center" }, 2: { halign: "right", fontStyle: "bold" } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ══════ 5. NÆR CLOSING ══════
  if (data.nearClosing.length > 0) {
    drawSectionHeader(`NÆR CLOSING (${data.nearClosing.length})`, "🔥");
    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["Selskap", "Verdi/mnd", "Siste aktivitet"]],
      body: data.nearClosing.map((d) => [d.selskap, nok(d.verdi), d.sistAktivitet ? formatDate(d.sistAktivitet) : "–"]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3, textColor: BRAND_DARK as unknown as number[] },
      headStyles: { fillColor: [255, 247, 237] as unknown as number[], textColor: AMBER as unknown as number[], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [252, 252, 250] as unknown as number[] },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ══════ 6. INNSIKT ══════
  if (data.innsikt.length > 0) {
    drawSectionHeader("INNSIKT", "🤖");
    checkPageBreak(data.innsikt.length * 7 + 10);
    doc.setFillColor(...LIGHT_BG);
    const innsiktH = data.innsikt.length * 6.5 + 8;
    doc.roundedRect(marginL, y, contentW, innsiktH, 2, 2, "F");
    // Left red accent
    doc.setFillColor(...BRAND_RED);
    doc.rect(marginL, y, 1.5, innsiktH, "F");

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND_DARK);
    data.innsikt.forEach((item, i) => {
      doc.text(`💡  ${item}`, marginL + 6, y + 6 + i * 6.5);
    });
    y += innsiktH + 10;
  }

  // ══════ NEW PAGE: KUNDER & GO-LIVE ══════
  doc.addPage();
  y = 0;

  // Header bar
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setFillColor(...BRAND_RED);
  doc.rect(0, 30, pageW, 2, "F");

  doc.setTextColor(...WHITE);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Kunder & Go-live", marginL, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 180);
  doc.text("SNAKK CRM", pageW - marginR, 18, { align: "right" });

  y = 42;

  // ══════ 8. KUNDE SNAPSHOT ══════
  const ks = data.kundeSnapshot;
  const kSnapH = 24;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(marginL, y, contentW, kSnapH, 3, 3, "F");

  const kItems = [
    { label: "LIVE", value: `${ks.antallLive}`, color: GREEN },
    { label: "IKKE LIVE", value: `${ks.antallIkkeLive}`, color: AMBER },
    { label: "SNITT → LIVE", value: ks.snittDagerTilGoLive != null ? `${ks.snittDagerTilGoLive}d` : "–", color: BRAND_DARK },
    { label: "PAUSE", value: `${ks.antallPause}`, color: AMBER },
    { label: "CHURN", value: `${ks.antallChurn}`, color: BRAND_RED },
  ];

  const kColW = contentW / kItems.length;
  kItems.forEach((item, i) => {
    const cx = marginL + kColW * i + kColW / 2;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text(item.label, cx, y + 9, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(item.color as [number, number, number]));
    doc.text(item.value, cx, y + 18, { align: "center" });
  });

  y += kSnapH + 10;

  // ══════ 9. GÅTT LIVE DENNE UKEN ══════
  if (data.gaattLive.length > 0) {
    drawSectionHeader(`GÅTT LIVE DENNE UKEN (${data.gaattLive.length})`, "🎉");
    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["Selskap", "Dager fra vunnet → live"]],
      body: data.gaattLive.map((d) => [d.selskap, d.dagerFraVunnet != null ? `${d.dagerFraVunnet} dager` : "–"]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3, textColor: BRAND_DARK as unknown as number[] },
      headStyles: { fillColor: [240, 253, 244] as unknown as number[], textColor: GREEN as unknown as number[], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [252, 252, 250] as unknown as number[] },
      columnStyles: { 1: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ══════ 10. IKKE LIVE ══════
  if (data.ikkeLive.length > 0) {
    drawSectionHeader(`IKKE LIVE ENNÅ (${data.ikkeLive.length})`, "⏳");
    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["Selskap", "Dager siden vunnet", ""]],
      body: data.ikkeLive.map((d) => [d.selskap, d.dagerSidenVunnet != null ? `${d.dagerSidenVunnet} dager` : "–", d.advarsel ? "⚠️" : ""]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3, textColor: BRAND_DARK as unknown as number[] },
      headStyles: { fillColor: [255, 251, 235] as unknown as number[], textColor: AMBER as unknown as number[], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [252, 252, 250] as unknown as number[] },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "center", cellWidth: 12 } },
      didParseCell: (hookData: any) => {
        if (hookData.section === "body" && hookData.row.raw[2] === "⚠️") {
          hookData.cell.styles.textColor = AMBER as unknown as number[];
          hookData.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ══════ 11. PLANLAGT GO-LIVE ══════
  if (data.planlagtGoLive.length > 0) {
    drawSectionHeader(`PLANLAGT GO-LIVE (${data.planlagtGoLive.length})`, "📅");
    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["Selskap", "Planlagt dato"]],
      body: data.planlagtGoLive.map((d) => [d.selskap, formatDate(d.planlagtDato)]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3, textColor: BRAND_DARK as unknown as number[] },
      headStyles: { fillColor: LIGHT_BG as unknown as number[], textColor: BRAND_DARK as unknown as number[], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [252, 252, 250] as unknown as number[] },
      columnStyles: { 1: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ══════ 12. PAUSE / CHURN ══════
  if (data.pauseChurn.length > 0) {
    drawSectionHeader(`PAUSE / CHURN (${data.pauseChurn.length})`, "⛔");
    autoTable(doc, {
      startY: y,
      margin: { left: marginL, right: marginR },
      head: [["Selskap", "Status", "Årsak"]],
      body: data.pauseChurn.map((d) => [d.selskap, d.status, d.aarsak || "–"]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3, textColor: BRAND_DARK as unknown as number[] },
      headStyles: { fillColor: [254, 242, 242] as unknown as number[], textColor: BRAND_RED as unknown as number[], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [252, 252, 250] as unknown as number[] },
      didParseCell: (hookData: any) => {
        if (hookData.section === "body" && hookData.column.index === 1) {
          hookData.cell.styles.textColor = hookData.cell.raw === "Kansellert" ? (BRAND_RED as unknown as number[]) : (AMBER as unknown as number[]);
          hookData.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ══════ FOOTER on each page ══════
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Bottom line
    doc.setDrawColor(...LIGHT_GRAY);
    doc.setLineWidth(0.3);
    doc.line(marginL, pageH - 12, pageW - marginR, pageH - 12);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text("Snakk CRM  •  Ukentlig Salgsrapport", marginL, pageH - 8);
    doc.text(`Side ${i} av ${totalPages}`, pageW - marginR, pageH - 8, { align: "right" });
  }

  return doc;
}
