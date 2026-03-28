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
    const { activities, selskapNavn, smNavn, smStatus, smNesteSteg, meetingTitle } = await req.json();

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
          .map((a: any) => `- ${a.type} (${a.dato}): ${a.tittel || a.beskrivelse || "Ingen tittel"}`)
          .join("\n")
      : "Ingen tidligere aktiviteter registrert.";

    const context = [
      meetingTitle ? `Møtetittel: ${meetingTitle}` : "",
      selskapNavn ? `Selskap: ${selskapNavn}` : "",
      smNavn ? `Salgsmulighet: ${smNavn}` : "",
      smStatus ? `Status: ${smStatus}` : "",
      smNesteSteg ? `Neste steg: ${smNesteSteg}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `Du er en CRM-assistent for et norsk SaaS-selskap. Basert på informasjonen nedenfor, gi:
1. En kort oppsummering (2-3 setninger) av hva som har skjedd med denne kunden/muligheten, eller hva møtet handler om
2. Én konkret anbefalt neste handling (f.eks. "Send tilbud", "Book oppfølgingsmøte", "Ring for å avklare innvendinger", "Forbered agenda")

Kontekst:
${context}

Siste aktiviteter:
${activityList}

Svar som JSON med feltene "summary" (string) og "nextAction" (string). Kun JSON, ingen annen tekst.`;

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
        JSON.stringify({ summary: "Kunne ikke generere oppsummering.", nextAction: "Se over aktivitetene manuelt." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { summary: content, nextAction: "Se over aktivitetene manuelt." };
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
