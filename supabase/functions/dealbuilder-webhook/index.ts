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
      .select("id, navn, selskap_id, forventet_mrr, oppstartskostnad, ansvarlig, kontaktperson, e_post")
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

    // If signed: update company to Pilot, create project, log activity
    if (logActivity && deal.selskap_id) {
      const today = new Date().toISOString().split("T")[0];
      const mrr = Number(deal.forventet_mrr) || 0;

      // Update selskap to "Pilot" (Kundeforhold)
      await supabase.from("selskaper").update({
        kundestatus: "Pilot",
        live_status: false,
        onboarding_status: "Ikke startet",
        mrr: mrr,
        arr: mrr * 12,
        oppstartskostnad: Number(deal.oppstartskostnad) || 0,
        sist_aktivitet: today,
        lukkedato: today,
      }).eq("id", deal.selskap_id);

      // Create onboarding project
      const { data: newProject } = await supabase.from("prosjekter").insert({
        prosjektnavn: deal.navn,
        selskap_id: deal.selskap_id,
        salgsmulighet_id: CRMid,
        ansvarlig: deal.ansvarlig || "",
        status: "Ny",
        startdato: today,
        oppstartskostnad: Number(deal.oppstartskostnad) || 0,
      }).select("id").maybeSingle();

      // Log activity
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

      // Send welcome email to customer
      const recipientEmail = deal.e_post;
      if (recipientEmail) {
        // Get company name for the email
        const { data: selskap } = await supabase
          .from("selskaper")
          .select("firmanavn")
          .eq("id", deal.selskap_id)
          .maybeSingle();

        // Get ansvarlig profile for email
        const { data: ansvarligProfile } = deal.ansvarlig
          ? await supabase.from("profiles").select("email").eq("display_name", deal.ansvarlig).maybeSingle()
          : { data: null };

        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "welcome-customer",
            recipientEmail,
            idempotencyKey: `welcome-customer-${CRMid}`,
            templateData: {
              firmanavn: selskap?.firmanavn || deal.navn,
              kontaktperson: deal.kontaktperson || undefined,
              ansvarlig: deal.ansvarlig || undefined,
              ansvarlig_epost: ansvarligProfile?.email || undefined,
              prosjekt_id: newProject?.id || undefined,
            },
          },
        });
      }
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
