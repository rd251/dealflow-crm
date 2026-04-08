import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

// PDF generation using jsPDF
import jsPDF from "npm:jspdf@2";

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
});

const PAKKER_TABLE = [
  { navn: "Chatbot + 100 min", pris: 990, minutter: "100 min" },
  { navn: "Starter", pris: 2500, minutter: "500 min" },
  { navn: "Vekst", pris: 7500, minutter: "1 500 min" },
  { navn: "Pro", pris: 12500, minutter: "2 500 min" },
  { navn: "800 min", pris: 4000, minutter: "800 min" },
  { navn: "Team", pris: 15000, minutter: "3 000 min" },
  { navn: "Bedrift", pris: 30000, minutter: "6 000 min" },
];

function nok(n: number) {
  return n.toLocaleString("nb-NO") + " kr";
}

function today() {
  return new Date().toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
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

    // ---- HEADER ----
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 53, 69); // brand red
    doc.text("SNAKK", margin, y);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("TEKNOLOGI AS", margin + 35, y);
    y += 12;

    doc.setDrawColor(220, 53, 69);
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

    // Leverandør
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Leverandør:", margin, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    doc.text("Snakk Teknologi AS", margin + 5, y); y += 4;
    doc.text("Org.nr.: 835 505 812", margin + 5, y); y += 4;
    doc.text("Sørkedalsveien 6, 0369 Oslo", margin + 5, y); y += 7;

    // Kunde
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

    // ---- SECTION: Pris og betalingsmodell ----
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("4. Pris og betalingsmodell", margin, y); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Kunden betaler en fast månedlig pris avhengig av valgt pakke:", margin, y);
    y += 7;

    // Price table
    const colX = [margin, margin + 60, margin + 100, margin + 140];
    const rowH = 7;

    // Header row
    doc.setFillColor(220, 53, 69);
    doc.rect(margin, y - 4, contentW, rowH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("Pakke", colX[0] + 2, y);
    doc.text("Pris/mnd", colX[1] + 2, y);
    doc.text("Minutter", colX[2] + 2, y);
    doc.text("Valgt", colX[3] + 2, y);
    y += rowH;

    // Data rows
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

    // Table border
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y - 4 - rowH * (PAKKER_TABLE.length + 1), contentW, rowH * (PAKKER_TABLE.length + 1));

    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text(`Valgt pakke: ${data.valgt_pakke} — ${nok(data.pakke_pris)}/mnd`, margin, y);
    doc.setFont("helvetica", "normal");
    y += 4;
    doc.text(`Inkluderte ringeminutter: ${data.minutter}`, margin, y);
    y += 10;

    // ---- Remaining sections ----
    const sections = [
      {
        title: "5. Vilkår",
        text: "Betaling skjer månedlig forskuddsvis. Første betaling skjer ved avtaleinngåelse. Ved forsinket betaling påløper forsinkelsesrente iht. forsinkelsesrenteloven."
      },
      {
        title: "6. Avtaleperiode",
        text: `Avtalen trer i kraft fra ${today()} og løper i 12 måneder. Etter bindingsperioden forlenges avtalen automatisk med 1 måned av gangen.`
      },
      {
        title: "7. Oppsigelse",
        text: "Avtalen kan sies opp med 3 måneders skriftlig varsel etter utløp av bindingsperioden. Oppsigelse sendes til support@snakk.ai."
      },
      {
        title: "8. Support",
        text: "Snakk tilbyr support via e-post (support@snakk.ai) og telefon i normal arbeidstid (09:00–16:00, man–fre). Responstid er innenfor 24 timer på hverdager."
      },
      {
        title: "9. Konfidensialitet",
        text: "Begge parter forplikter seg til å behandle konfidensiell informasjon mottatt fra den andre parten med fortrolighet, og ikke dele denne med tredjepart uten skriftlig samtykke."
      },
      {
        title: "10. Markedsføring",
        text: "Snakk forbeholder seg retten til å benytte kundens navn og logo i sin markedsføring og referanseliste, med mindre kunden skriftlig reserverer seg mot dette."
      },
      {
        title: "11. Personvern",
        text: "Snakk behandler personopplysninger i samsvar med gjeldende personvernlovgivning (GDPR). En separat databehandleravtale inngås som vedlegg til denne avtalen."
      },
      {
        title: "12. Tvister",
        text: "Eventuelle tvister som oppstår i forbindelse med denne avtalen skal forsøkes løst gjennom forhandlinger. Dersom partene ikke kommer til enighet, skal tvisten avgjøres ved Oslo tingrett."
      },
    ];

    for (const section of sections) {
      // Check if we need a new page
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(section.title, margin, y); y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      const lines = doc.splitTextToSize(section.text, contentW);
      doc.text(lines, margin, y);
      y += lines.length * 4 + 6;
    }

    // ---- SIGNATURE AREA ----
    if (y > 230) { doc.addPage(); y = 20; }
    y += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, W - margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Signatur", margin, y); y += 8;

    // Two columns for signatures
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

    // ---- FOOTER ----
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("Snakk Teknologi AS — Sørkedalsveien 6, 0369 Oslo — Org.nr.: 835 505 812", W / 2, 290, { align: "center" });
      doc.text(`Side ${p} av ${pageCount}`, W / 2, 294, { align: "center" });
    }

    // Output as arraybuffer
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
