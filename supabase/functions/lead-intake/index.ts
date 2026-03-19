import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const kilde = body.kilde || body.source || "Nettside";
    const use_case = String(body.use_case || "").trim();
    const rolle_i_firma = String(body.rolle_i_firma || body.rolle || "").trim();

    if (!firmanavn && !kontaktperson && !e_post) {
      return new Response(
        JSON.stringify({ error: "Minst ett av feltene firmanavn, kontaktperson eller e_post er påkrevd" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate kilde against enum
    const validKilder = ["Nettside", "LinkedIn", "Partner", "Referanse", "Kald outbound", "E-post", "Telefon", "Annet"];
    const safeKilde = validKilder.includes(kilde) ? kilde : "Nettside";

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
    }).select("id, firmanavn, kontaktperson, e_post, status").single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(
        JSON.stringify({ error: "Kunne ikke opprette lead", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
