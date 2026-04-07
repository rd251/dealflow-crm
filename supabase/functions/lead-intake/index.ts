import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const validKilder = [
  "Nettside", "LinkedIn", "Partner", "Referanse", "Kald outbound",
  "E-post", "Telefon", "Annet", "Organisk", "Facebook ads",
  "Instantly kald e-post", "Google ads", "Kasoleads",
];

async function detectKildeFromNotes(notater: string): Promise<string | null> {
  if (!notater || notater.length < 3) return null;

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.warn("LOVABLE_API_KEY not set, skipping AI kilde detection");
    return null;
  }

  try {
    const res = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        temperature: 0,
        max_tokens: 50,
        messages: [
          {
            role: "system",
            content: `Du analyserer notater fra innkommende leads for å bestemme hvilken kilde leadet kom fra.
Gyldige kilder: ${validKilder.join(", ")}

Regler:
- "Instantly" eller "kampanje" i teksten → "Instantly kald e-post"
- "LinkedIn" i teksten → "LinkedIn"
- "Facebook" eller "Meta" i teksten → "Facebook ads"
- "Google" og "ads" i teksten → "Google ads"
- "partner" i teksten → "Partner"
- "referanse" eller "anbefalt" i teksten → "Referanse"
- "Kasoleads" i teksten → "Kasoleads"
- "kald" og ("e-post" eller "epost" eller "mail") men IKKE "Instantly" → "Kald outbound"
- "organisk" i teksten → "Organisk"
- "nettside" eller "kontaktskjema" eller "website" → "Nettside"
- Hvis usikker → svar "Annet"

Svar KUN med kildenavnet, ingenting annet.`,
          },
          { role: "user", content: notater },
        ],
      }),
    });

    if (!res.ok) {
      console.error("AI kilde detection failed:", res.status);
      return null;
    }

    const data = await res.json();
    const detected = data.choices?.[0]?.message?.content?.trim();
    if (detected && validKilder.includes(detected)) {
      return detected;
    }
    console.log("AI returned non-matching kilde:", detected);
    return null;
  } catch (err) {
    console.error("AI kilde detection error:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    // Map from website form fields to leads table
    const firmanavn = String(body.firmanavn || body.company || body.firma || "").trim();
    const kontaktperson = String(body.kontaktperson || body.navn || body.name || "").trim();
    const e_post = String(body.e_post || body.epost || body.email || "").trim();
    const telefon = String(body.telefon || body.phone || body.telefonnummer || "").trim();
    const notater = String(body.notater || body.melding || body.message || body.notes || "").trim();
    const eksplisittKilde = body.kilde || body.source || "";
    const use_case = String(body.use_case || "").trim();
    const rolle_i_firma = String(body.rolle_i_firma || body.rolle || "").trim();

    if (!firmanavn && !kontaktperson && !e_post) {
      return new Response(
        JSON.stringify({ error: "Minst ett av feltene firmanavn, kontaktperson eller e_post er påkrevd" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine kilde: explicit > AI-detected from notes > default "Nettside"
    let safeKilde = "Nettside";
    if (eksplisittKilde && validKilder.includes(eksplisittKilde)) {
      safeKilde = eksplisittKilde;
    } else if (notater) {
      const aiKilde = await detectKildeFromNotes(notater);
      if (aiKilde) {
        safeKilde = aiKilde;
        console.log(`AI detected kilde: "${aiKilde}" from notes`);
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase.from("leads").insert({
      firmanavn: firmanavn || kontaktperson || "Ukjent",
      kontaktperson,
      e_post,
      telefon,
      notater,
      kilde: safeKilde,
      status: "Ny",
      opprettet_dato: today,
      sist_aktivitet: today,
      use_case,
      rolle_i_firma,
    }).select("id, firmanavn, kontaktperson, e_post, status, kilde").single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(
        JSON.stringify({ error: "Kunne ikke opprette lead", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fire-and-forget: trigger company enrichment in background
    const enrichDomain = e_post ? e_post.split("@")[1] || "" : "";
    const enrichFirma = data.firmanavn || firmanavn;
    if (enrichDomain || enrichFirma) {
      const enrichUrl = `${supabaseUrl}/functions/v1/company-enrich`;
      fetch(enrichUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ domene: enrichDomain, firmanavn: enrichFirma }),
      }).catch((err) => console.error("Enrichment trigger failed:", err));
    }

    return new Response(
      JSON.stringify({ success: true, lead: data }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Lead intake error:", e);
    return new Response(
      JSON.stringify({ error: "Ugyldig forespørsel" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
