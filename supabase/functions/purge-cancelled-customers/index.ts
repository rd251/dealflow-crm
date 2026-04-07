import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find all cancelled customers
    const { data: cancelled, error: fetchErr } = await supabase
      .from("selskaper")
      .select("id, firmanavn, kansellert_dato")
      .eq("kundestatus", "Kansellert");

    if (fetchErr) throw fetchErr;

    if (!cancelled || cancelled.length === 0) {
      console.log("No cancelled customers to purge");
      return new Response(
        JSON.stringify({ purged: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Reset them to "Ikke kunde" so they disappear from Kundeforhold
    const ids = cancelled.map((c) => c.id);

    const { error: updateErr } = await supabase
      .from("selskaper")
      .update({
        kundestatus: "Ikke kunde",
        mrr: 0,
        arr: 0,
        live_status: false,
        kundetilstand: null,
        onboarding_status: null,
      })
      .in("id", ids);

    if (updateErr) throw updateErr;

    console.log(`Purged ${ids.length} cancelled customers: ${cancelled.map(c => c.firmanavn).join(", ")}`);

    return new Response(
      JSON.stringify({ purged: ids.length, companies: cancelled.map(c => c.firmanavn) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error("Purge cancelled customers error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
