import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      activities, selskapNavn, smNavn, smStatus, smNesteSteg,
      meetingTitle, meetingDate, selskapInnsikt,
      kontakter, emails, meetingNotes, smForventetMrr, smLukkedato,
      selskapMrr, selskapKundestatus,
    } = await req.json();

    const hasActivities = activities && Array.isArray(activities) && activities.length > 0;
    const hasContext = selskapNavn || smNavn || meetingTitle;

    if (!hasActivities && !hasContext) {
      return new Response(
        JSON.stringify({ summary: "Ingen aktiviteter å oppsummere.", nextAction: "Planlegg første kontakt." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing API key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const activityList = hasActivities
      ? activities
          .map((a: any) => {
            let line = `- ${a.type} (${a.dato}): ${a.tittel || a.beskrivelse || "Ingen tittel"}`;
            if (a.moetenotater) line += `\n  Notater: ${a.moetenotater.slice(0, 400)}`;
            return line;
          })
          .join("\n")
      : "Ingen tidligere aktiviteter registrert.";

    // Build email context
    let emailContext = "";
    if (emails && Array.isArray(emails) && emails.length > 0) {
      emailContext = `\nSiste e-postkorrespondanse (${emails.length} stk):\n`;
      for (const e of emails.slice(0, 8)) {
        emailContext += `- ${e.dato?.slice(0, 10) || ""} ${e.tittel || ""}: ${(e.beskrivelse || "").slice(0, 300)}\n`;
      }
    }

    // Build contact context
    let contactContext = "";
    if (kontakter && Array.isArray(kontakter) && kontakter.length > 0) {
      contactContext = `\nKontaktpersoner hos selskapet:\n`;
      for (const k of kontakter.slice(0, 5)) {
        contactContext += `- ${k.navn}${k.rolle ? ` (${k.rolle})` : ""}${k.e_post ? ` – ${k.e_post}` : ""}${k.telefon ? ` – ${k.telefon}` : ""}\n`;
      }
    }

    // Build meeting notes context
    let prevMeetingNotes = "";
    if (meetingNotes && Array.isArray(meetingNotes) && meetingNotes.length > 0) {
      prevMeetingNotes = `\nTidligere møtenotater:\n`;
      for (const mn of meetingNotes.slice(0, 3)) {
        prevMeetingNotes += `- ${mn.dato?.slice(0, 10) || ""} "${mn.tittel || "Møte"}": ${(mn.moetenotater || "").slice(0, 500)}\n`;
      }
    }

    const context = [
      meetingTitle ? `Møtetittel: ${meetingTitle}` : "",
      meetingDate ? `Møtedato: ${meetingDate}` : "",
      selskapNavn ? `Selskap: ${selskapNavn}` : "",
      selskapKundestatus ? `Kundestatus: ${selskapKundestatus}` : "",
      selskapMrr ? `Nåværende MRR: ${selskapMrr} kr` : "",
      smNavn ? `Salgsmulighet: ${smNavn}` : "",
      smStatus ? `Status: ${smStatus}` : "",
      smNesteSteg ? `Neste steg: ${smNesteSteg}` : "",
      smForventetMrr ? `Forventet MRR: ${smForventetMrr} kr` : "",
      smLukkedato ? `Forventet lukkedato: ${smLukkedato}` : "",
      selskapInnsikt?.bransje ? `Bransje: ${selskapInnsikt.bransje}` : "",
      selskapInnsikt?.beskrivelse ? `Om selskapet: ${selskapInnsikt.beskrivelse}` : "",
      selskapInnsikt?.stoerrelse ? `Selskapsstørrelse: ${selskapInnsikt.stoerrelse}` : "",
      selskapInnsikt?.estimert_ansatte ? `Estimert ansatte: ${selskapInnsikt.estimert_ansatte}` : "",
      selskapInnsikt?.estimert_omsetning && selskapInnsikt.estimert_omsetning !== "Ukjent" ? `Estimert omsetning: ${selskapInnsikt.estimert_omsetning}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const today = new Date().toISOString().split("T")[0];

    const prompt = `Du er en senior salgsrådgiver for et norsk SaaS-selskap (Snakk CRM). Dagens dato er ${today}.

VIKTIG: Hvis møtedatoen er i fremtiden (etter ${today}), har møtet IKKE skjedd ennå. Bruk fremtidsform ("skal ha", "planlagt", "kommende"). Hvis møtedatoen er i fortiden, bruk fortidsform.

Basert på ALL informasjonen nedenfor, gi en grundig forberedelse til møtet:

1. **Oppsummering** (3-5 setninger): Hva er konteksten rundt dette møtet? Hva har skjedd med kunden så langt? Hva er viktige signaler fra e-poster og tidligere møtenotater?

2. **Anbefalt handling** (én konkret, prioritert handling for dette møtet, f.eks. "Forbered demo av integrasjonsmodulen", "Ta opp prisforslaget fra forrige møte", "Avklar beslutningsprosessen")

3. **Samtalepunkter** (3-5 konkrete punkter å ta opp i møtet basert på historikk og e-poster)

Kontekst:
${context}
${contactContext}
${emailContext}
${prevMeetingNotes}

Siste aktiviteter:
${activityList}

Svar som JSON med feltene:
- "summary" (string): Oppsummering
- "nextAction" (string): Anbefalt handling
- "talkingPoints" (array av strings): Samtalepunkter
Kun JSON, ingen annen tekst.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Du svarer alltid på norsk og kun med gyldig JSON." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("AI API error:", errText);
      return new Response(
        JSON.stringify({ summary: "Kunne ikke generere oppsummering.", nextAction: "Se over aktivitetene manuelt.", talkingPoints: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { summary: content, nextAction: "Se over aktivitetene manuelt.", talkingPoints: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
