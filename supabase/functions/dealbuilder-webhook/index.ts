import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // For GET requests, return a simple health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ received: true, status: "active" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { event, CRMid, document_id, signer_name } = body;

    // If no event/CRMid, just acknowledge receipt
    if (!event || !CRMid) {
      return new Response(JSON.stringify({ received: true, warning: "Missing event or CRMid" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find salgsmulighet by ID (CRMid)
    const { data: deal, error: findError } = await supabase
      .from("salgsmuligheter")
      .select("id, navn, selskap_id, forventet_mrr, oppstartskostnad, ansvarlig")
      .eq("id", CRMid)
      .maybeSingle();

    if (findError || !deal) {
      return new Response(JSON.stringify({ received: true, error: "Deal not found", CRMid }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updateData: Record<string, unknown> = {};
    let logActivity = false;
    let activityDescription = "";

    switch (event) {
      case "document_signed":
        updateData.kontrakt_status = "Signert";
        updateData.kontrakt_signert_dato = new Date().toISOString();
        updateData.status = "Vunnet";
        updateData.vunnet_dato = new Date().toISOString().split("T")[0];
        if (document_id) updateData.dealbuilder_dokument_id = document_id;
        logActivity = true;
        activityDescription = `Kontrakt signert av ${signer_name || "ukjent"}`;
        break;

      case "document_opened":
        updateData.kontrakt_status = "Åpnet";
        if (document_id) updateData.dealbuilder_dokument_id = document_id;
        break;

      case "document_expired":
        updateData.kontrakt_status = "Utløpt";
        break;

      default:
        return new Response(JSON.stringify({ received: true, warning: "Unknown event", event }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Update salgsmulighet
    const { error: updateError } = await supabase
      .from("salgsmuligheter")
      .update(updateData)
      .eq("id", CRMid);

    if (updateError) {
      return new Response(JSON.stringify({ received: true, error: "Update failed", details: updateError.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log activity if signed
    if (logActivity) {
      await supabase.from("aktiviteter").insert({
        type: "Notat",
        beskrivelse: activityDescription,
        tittel: "Kontrakt signert",
        salgsmulighet_id: CRMid,
        selskap_id: deal.selskap_id,
        aktivitet_kilde: "dealbuilder",
        dato: new Date().toISOString(),
      });

      await supabase.from("crm_changelog").insert({
        event_type: "updated",
        entity_type: "salgsmulighet",
        entity_id: CRMid,
        entity_name: deal.navn,
        field_name: "kontrakt_status",
        old_value: null,
        new_value: "Signert",
      });
    }

    return new Response(JSON.stringify({ received: true, event, CRMid }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ received: true, error: "Invalid request", details: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
