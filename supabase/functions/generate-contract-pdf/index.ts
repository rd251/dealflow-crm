import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { jsPDF } from "npm:jspdf@2";

const BodySchema = z.object({
  firmanavn: z.string().min(1),
  orgnr: z.string(),
  adresse: z.string(),
  kontaktperson: z.string(),
  telefon: z.string(),
  e_post: z.string(),
  valgt_pakke: z.string(),
  pakke_pris: z.number(),
  minutter: z.string(),
  sla: z.number().nullable().optional(),
  oppstartskostnad: z.number().nullable().optional(),
  konsulent_timepris: z.number().nullable().optional(),
});

const PAKKER_TABLE = [
  { navn: "Chatbot + 100 min", pris: 990, minutter: "100 min" },
  { navn: "Starter", pris: 2500, minutter: "500 min" },
  { navn: "800 min", pris: 4000, minutter: "800 min" },
  { navn: "Vekst", pris: 7500, minutter: "1 500 min" },
  { navn: "Pro", pris: 12500, minutter: "2 500 min" },
  { navn: "Team", pris: 15000, minutter: "3 000 min" },
  { navn: "Bedrift", pris: 30000, minutter: "6 000 min" },
];

function nok(n: number) {
  return n.toLocaleString("nb-NO") + " kr";
}

function today() {
  return new Date().toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Snakk logo as base64 PNG
const LOGO_BASE64 = "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";

function addLogoHeader(doc: any, margin: number, y: number): number {
  // Add PNG logo image (approximately 50mm wide, proportional height ~9.6mm based on 414x79 aspect ratio)
  const logoW = 50;
  const logoH = logoW * (79.58 / 414.542); // maintain aspect ratio
  try {
    doc.addImage(LOGO_BASE64, "PNG", margin, y - logoH + 2, logoW, logoH);
  } catch (_e) {
    // Fallback to text if image fails
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(218, 41, 28);
    doc.text("SNAKK", margin, y);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("TEKNOLOGI AS", margin + 35, y);
  }
  return y + 4;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = parsed.data;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210;
    const margin = 20;
    const contentW = W - margin * 2;
    let y = 20;

    // ---- HEADER with logo ----
    y = addLogoHeader(doc, margin, y);
    y += 4;

    doc.setDrawColor(218, 41, 28);
    doc.setLineWidth(0.5);
    doc.line(margin, y, W - margin, y);
    y += 10;

    // ---- TITLE ----
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Avtale om bruk av Snakk Teknologi AS", margin, y);
    y += 10;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Dato: ${today()}`, margin, y);
    y += 10;

    // ---- PARTIES ----
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("1. Avtaleparter", margin, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Leverandør:", margin, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    doc.text("Snakk Teknologi AS", margin + 5, y); y += 4;
    doc.text("Org.nr.: 835 505 812", margin + 5, y); y += 4;
    doc.text("Sørkedalsveien 6, 0369 Oslo", margin + 5, y); y += 7;

    doc.setFont("helvetica", "bold");
    doc.text("Kunde:", margin, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    doc.text(data.firmanavn, margin + 5, y); y += 4;
    doc.text(`Org.nr.: ${data.orgnr}`, margin + 5, y); y += 4;
    doc.text(data.adresse, margin + 5, y); y += 4;
    doc.text(`Kontaktperson: ${data.kontaktperson} — ${data.telefon}`, margin + 5, y); y += 4;
    if (data.e_post) {
      doc.text(`E-post: ${data.e_post}`, margin + 5, y); y += 4;
    }
    y += 6;

    // ---- SECTION: Formål ----
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("2. Formål", margin, y); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const formaal = "Denne avtalen regulerer levering og bruk av Snakk sin AI-drevne telefonassistent og tilhørende tjenester. Tjenesten gir kunden tilgang til en intelligent telefonsvarer som håndterer innkommende og utgående samtaler.";
    const formaalLines = doc.splitTextToSize(formaal, contentW);
    doc.text(formaalLines, margin, y);
    y += formaalLines.length * 4 + 6;

    // ---- SECTION: Tjenesten ----
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("3. Tjenesten", margin, y); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const tjenesten = "Snakk leverer en AI-basert telefonassistent som kan svare på spørsmål, ta imot bestillinger, booke møter og utføre andre oppgaver over telefon på vegne av kunden. Tjenesten inkluderer oppsett, konfigurasjon og løpende drift.";
    const tjenesteLines = doc.splitTextToSize(tjenesten, contentW);
    doc.text(tjenesteLines, margin, y);
    y += tjenesteLines.length * 4 + 6;

    // ---- Helper: check page break ----
    function checkPage(needed = 20) {
      if (y > 270 - needed) { doc.addPage(); y = 20; }
    }

    // ---- SECTION 3: Pris og betalingsmodell ----
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("3. Pris og betalingsmodell", margin, y); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Kunden betaler en fast månedlig pris avhengig av valgt pakke:", margin, y);
    y += 7;

    const colX = [margin, margin + 60, margin + 100, margin + 140];
    const rowH = 7;

    doc.setFillColor(218, 41, 28);
    doc.rect(margin, y - 4, contentW, rowH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("Pakke", colX[0] + 2, y);
    doc.text("Pris/mnd", colX[1] + 2, y);
    doc.text("Minutter", colX[2] + 2, y);
    doc.text("Valgt", colX[3] + 2, y);
    y += rowH;

    doc.setTextColor(30, 30, 30);
    for (let i = 0; i < PAKKER_TABLE.length; i++) {
      const p = PAKKER_TABLE[i];
      const isSelected = p.navn === data.valgt_pakke;
      if (isSelected) {
        doc.setFillColor(255, 235, 238);
        doc.rect(margin, y - 4, contentW, rowH, "F");
        doc.setFont("helvetica", "bold");
      } else {
        if (i % 2 === 0) {
          doc.setFillColor(248, 248, 248);
          doc.rect(margin, y - 4, contentW, rowH, "F");
        }
        doc.setFont("helvetica", "normal");
      }
      doc.text(p.navn, colX[0] + 2, y);
      doc.text(nok(p.pris), colX[1] + 2, y);
      doc.text(p.minutter, colX[2] + 2, y);
      doc.text(isSelected ? "✓" : "", colX[3] + 2, y);
      y += rowH;
      if (isSelected) doc.setFont("helvetica", "normal");
    }

    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y - 4 - rowH * (PAKKER_TABLE.length + 1), contentW, rowH * (PAKKER_TABLE.length + 1));

    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text(`Valgt pakke: ${data.valgt_pakke} — ${nok(data.pakke_pris)}/mnd`, margin, y);
    doc.setFont("helvetica", "normal");
    y += 4;
    doc.text(`Inkluderte ringeminutter: ${data.minutter}`, margin, y);
    y += 5;
    if (data.oppstartskostnad) {
      doc.text(`Oppstartskostnad: ${nok(data.oppstartskostnad)} (engangsbeløp)`, margin, y);
      y += 5;
    }
    y += 4;

    // Betalingsvilkår bullet list
    doc.setFont("helvetica", "bold");
    doc.text("Betalingsvilkår:", margin, y); y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const betalingsvilkaar = [
      "Faktureres forskuddsvis per måned, med forfallsdato den 15. i hver måned",
      "Ved oppstart faktureres både gjenværende del av inneværende måned og hele påfølgende måned",
      "Tjenesten aktiveres først når betaling er mottatt",
      "Minutter gjelder kun for den aktuelle kalendermåneden og bortfaller ved månedsslutt",
      "Ubenyttede minutter overføres ikke",
      "Bruk utover inkludert volum faktureres i etterkant",
      "Betalingsintervaller kan etter avtale endres til kvartalsvis, halvårlig eller årlig fakturering",
    ];
    for (const item of betalingsvilkaar) {
      checkPage(8);
      const wrapped = doc.splitTextToSize(item, contentW - 6);
      doc.text("•", margin, y);
      doc.text(wrapped, margin + 5, y);
      y += wrapped.length * 4 + 2;
    }
    y += 4;

    // ---- SECTION 4: Endring av abonnement ----
    checkPage(20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("4. Endring av abonnement", margin, y); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const s4 = doc.splitTextToSize("Kunden kan oppgradere abonnementsnivå ved skriftlig forespørsel. Endringer trer i kraft fra neste faktureringsperiode, eller etter avtale.", contentW);
    doc.text(s4, margin, y); y += s4.length * 4 + 6;

    // ---- SECTION 5: Avtaleperiode ----
    checkPage(20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("5. Avtaleperiode", margin, y); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text("• Avtalen gjelder fra aktivering (kontrakt er signert)", margin, y); y += 5;
    doc.text("• Bindingstid: Ingen", margin, y); y += 8;

    // ---- SECTION 6: Oppsigelse ----
    checkPage(20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("6. Oppsigelse", margin, y); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text("• Oppsigelsestid: 60 dager, oppsigelse gjelder fra den 1. påfølgende måned", margin, y); y += 5;
    doc.text("• Oppsigelse skal være skriftlig", margin, y); y += 8;

    // ---- SECTION 7: Konsulenttjenester ----
    checkPage(30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("7. Konsulenttjenester", margin, y); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const konsulent = [
      "Bistand til oppsett eller utvikling faktureres separat — Pris: avtales med en av våre integrasjonspartnere",
      "Bistand til utvidet funksjonalitet faktureres separat — Pris: avtales med en av våre integrasjonspartnere",
      "Hjelp til API-koblinger eller videreutvikling faktureres separat — Pris: avtales med en av våre integrasjonspartnere",
    ];
    for (const item of konsulent) {
      checkPage(8);
      const wrapped = doc.splitTextToSize(item, contentW - 6);
      doc.text("•", margin, y);
      doc.text(wrapped, margin + 5, y);
      y += wrapped.length * 4 + 2;
    }
    y += 4;

    // ---- SECTION 8: Support ----
    checkPage(30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("8. Support", margin, y); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const supportItems = [
      "Henvendelser besvares normalt innen 48 timer på virkedager",
      "Gjelder veiledning, feilsøking og generelle spørsmål knyttet til plattformen",
      "Support leveres via e-post",
      data.sla
        ? `SLA: Avtalt SLA på ${nok(data.sla)}/mnd — utvidet support inkludert`
        : "SLA: Utvidet SLA eller prioritert support kan avtales særskilt og prises basert på kundens behov",
    ];
    for (const item of supportItems) {
      checkPage(8);
      const wrapped = doc.splitTextToSize(item, contentW - 6);
      doc.text("•", margin, y);
      doc.text(wrapped, margin + 5, y);
      y += wrapped.length * 4 + 2;
    }
    y += 4;

    // ---- SECTION 9: Konfidensialitet ----
    checkPage(20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("9. Konfidensialitet", margin, y); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const s9 = doc.splitTextToSize("Begge parter forplikter seg til å behandle all informasjon knyttet til samarbeidet konfidensielt.", contentW);
    doc.text(s9, margin, y); y += s9.length * 4 + 6;

    // ---- SECTION 10: Markedsføring ----
    checkPage(20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("10. Markedsføring", margin, y); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const s10 = doc.splitTextToSize("Leverandøren kan benytte Kunden som referanse i markedsføring, med mindre annet er avtalt skriftlig.", contentW);
    doc.text(s10, margin, y); y += s10.length * 4 + 6;

    // ---- SECTION 11: Personvern og vilkår ----
    checkPage(20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("11. Personvern og vilkår", margin, y); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text("Følgende dokumenter gjelder som en del av avtalen:", margin, y); y += 5;
    doc.setTextColor(0, 0, 200);
    doc.text("• https://www.snakk.ai/vilkar", margin, y); y += 5;
    doc.text("• https://www.snakk.ai/personvern", margin, y); y += 8;
    doc.setTextColor(80, 80, 80);

    // ---- SECTION 12: Tvister ----
    checkPage(20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("12. Tvister", margin, y); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const s12 = doc.splitTextToSize("Tvister søkes løst i minnelighet. Dersom dette ikke lykkes, avgjøres saken etter norsk rett, med Oslo tingrett som verneting.", contentW);
    doc.text(s12, margin, y); y += s12.length * 4 + 6;

    // ---- SIGNATURE AREA ----
    checkPage(50);
    y += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, W - margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Signatur", margin, y); y += 8;

    const col1 = margin;
    const col2 = W / 2 + 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    doc.text("For Snakk Teknologi AS:", col1, y);
    doc.text(`For ${data.firmanavn}:`, col2, y);
    y += 20;

    doc.line(col1, y, col1 + 60, y);
    doc.line(col2, y, col2 + 60, y);
    y += 5;
    doc.text("Dato / Signatur", col1, y);
    doc.text("Dato / Signatur", col2, y);

    // ---- FOOTER: "Side X av Y" on every page, logo on last page ----
    const pageCount = doc.getNumberOfPages();
    const footerLogoW = 25;
    const footerLogoH = footerLogoW * (79.58 / 414.542);
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("Snakk Teknologi AS — Sørkedalsveien 6, 0369 Oslo — Org.nr.: 835 505 812", W / 2, 290, { align: "center" });
      doc.text(`Side ${p} av ${pageCount}`, W / 2, 294, { align: "center" });
      // Logo only on last page
      if (p === pageCount) {
        try {
          doc.addImage(LOGO_BASE64, "PNG", W / 2 - footerLogoW / 2, 278, footerLogoW, footerLogoH);
        } catch (_e) { /* skip */ }
      }
    }

    const pdfOutput = doc.output("arraybuffer");

    return new Response(new Uint8Array(pdfOutput), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="kontrakt-${data.firmanavn.replace(/\s+/g, "-")}.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
