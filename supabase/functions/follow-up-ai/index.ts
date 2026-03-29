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
    const { type, navn, kontaktperson, selskapNavn, sistAktivitetType, anbefalHandling, hoursInactive, entityType } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing API key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const typeDesc: Record<string, string> = {
      lead_stale: "Lead som ikke har blitt fulgt opp",
      sm_stale: "Salgsmulighet uten nylig aktivitet",
      post_meeting: "Møte gjennomført uten oppfølging etterpå",
      email_no_reply: "E-post sendt uten svar",
    };

    const daysInactive = Math.floor(hoursInactive / 24);

    const prompt = `Du er en norsk salgsassistent. Generer en kort, profesjonell oppfølgingsmelding.

Kontekst:
- Kontaktperson/mulighet: ${navn}
- Selskap: ${selskapNavn}
- Situasjon: ${typeDesc[type] || "Trenger oppfølging"}
- Siste aktivitet: ${sistAktivitetType || "Ukjent"} (${daysInactive} dager siden)
- Anbefalt handling: ${anbefalHandling}
- Type: ${entityType === "lead" ? "Lead" : "Salgsmulighet"}

Skriv en kort, vennlig og profesjonell e-post/melding på norsk (3-5 setninger). 
Ikke bruk for formelle hilsener. Vær direkte men høflig.
Referer til siste kontakt naturlig. Avslutt med et konkret forslag til neste steg.

Svar KUN med selve meldingsteksten, ingen JSON eller annen formatering.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Du er en norsk salgsassistent som skriver korte, profesjonelle oppfølgingsmeldinger." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      console.error("AI API error:", await res.text());
      return new Response(
        JSON.stringify({ message: "Kunne ikke generere melding. Prøv igjen." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const message = data.choices?.[0]?.message?.content || "Kunne ikke generere melding.";

    return new Response(JSON.stringify({ message }), {
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
