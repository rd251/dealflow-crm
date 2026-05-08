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
    const event = body.event || body.eventType || body.type;
    const document_id = body.document_id || body.documentId || body.id;
    const signer_name = body.signer_name || body.signerName;
    const signer_email = (body.signer_email || body.signerEmail || body.email || "").toLowerCase().trim();
    const signer_company = (body.signer_company || body.companyName || "").toLowerCase().trim();
    let CRMid: string | null = body.CRMid || body.crmId || body.crm_id || null;

    if (!event) {
      return new Response(JSON.stringify({ received: true, warning: "Missing event" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fallback 1: match by stored dealbuilder_dokument_id
    if (!CRMid && document_id) {
      const { data: byDoc } = await supabase
        .from("salgsmuligheter").select("id").eq("dealbuilder_dokument_id", String(document_id)).maybeSingle();
      if (byDoc) CRMid = byDoc.id;
      if (!CRMid) {
        const { data: pByDoc } = await supabase
          .from("partnere").select("id").eq("dealbuilder_dokument_id", String(document_id)).maybeSingle();
        if (pByDoc) CRMid = pByDoc.id;
      }
    }

    // Fallback 2: match by signer email/company → selskap → nyeste deal med "Sendt"
    if (!CRMid && (signer_email || signer_company)) {
      let selskapId: string | null = null;
      if (signer_email) {
        const { data: k } = await supabase.from("kontakter")
          .select("selskap_id").ilike("e_post", signer_email).not("selskap_id", "is", null).limit(1).maybeSingle();
        if (k) selskapId = k.selskap_id;
      }
      if (!selskapId && signer_company) {
        const { data: s } = await supabase.from("selskaper")
          .select("id").ilike("firmanavn", signer_company).limit(1).maybeSingle();
        if (s) selskapId = s.id;
      }
      if (selskapId) {
        const { data: latestDeal } = await supabase.from("salgsmuligheter")
          .select("id").eq("selskap_id", selskapId).in("kontrakt_status", ["Sendt", "Åpnet"])
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (latestDeal) CRMid = latestDeal.id;
      }
    }

    if (!CRMid) {
      return new Response(JSON.stringify({ received: true, warning: "Could not match to CRM entity", document_id, signer_email }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // First try salgsmulighet
    const { data: deal, error: findError } = await supabase
      .from("salgsmuligheter")
      .select("id, navn, selskap_id, forventet_mrr, oppstartskostnad, ansvarlig, kontaktperson, e_post")
      .eq("id", CRMid)
      .maybeSingle();

    // If not a deal, check if it's a partner
    const { data: partner } = !deal ? await supabase
      .from("partnere")
      .select("id, partnernavn, kontaktperson, e_post, selskap_id")
      .eq("id", CRMid)
      .maybeSingle() : { data: null };

    if (!deal && !partner) {
      return new Response(JSON.stringify({ received: true, error: "Entity not found", CRMid }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- PARTNER flow ---
    if (partner) {
      switch (event) {
        case "document_signed": {
          await supabase.from("partnere").update({
            partnerstatus: "Aktiv",
            pipeline_status: "Aktiv partner",
            sist_aktivitet: new Date().toISOString().split("T")[0],
          }).eq("id", CRMid);

          await supabase.from("aktiviteter").insert({
            type: "Notat",
            beskrivelse: `Samarbeidsavtale signert av ${signer_name || partner.kontaktperson || "ukjent"}`,
            tittel: "Samarbeidsavtale signert",
            partner_id: CRMid,
            selskap_id: partner.selskap_id || null,
            aktivitet_kilde: "dealbuilder",
            dato: new Date().toISOString(),
          });

          await supabase.from("crm_changelog").insert({
            event_type: "updated",
            entity_type: "partner",
            entity_id: CRMid,
            entity_name: partner.partnernavn,
            field_name: "partnerstatus",
            old_value: null,
            new_value: "Aktiv",
          });
          break;
        }
        case "document_opened":
        case "document_expired":
          // No status change needed for partners on these events
          break;
        default:
          break;
      }

      return new Response(JSON.stringify({ received: true, event, CRMid, entity: "partner" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- DEAL flow (existing logic) ---
    if (findError) {
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

    if (logActivity && deal!.selskap_id) {
      const today = new Date().toISOString().split("T")[0];
      const mrr = Number(deal!.forventet_mrr) || 0;

      await supabase.from("selskaper").update({
        kundestatus: "Pilot",
        live_status: false,
        onboarding_status: "Ikke startet",
        mrr: mrr,
        arr: mrr * 12,
        oppstartskostnad: Number(deal!.oppstartskostnad) || 0,
        sist_aktivitet: today,
        lukkedato: today,
      }).eq("id", deal!.selskap_id);

      const { data: newProject } = await supabase.from("prosjekter").insert({
        prosjektnavn: deal!.navn,
        selskap_id: deal!.selskap_id,
        salgsmulighet_id: CRMid,
        ansvarlig: deal!.ansvarlig || "",
        status: "Ny",
        startdato: today,
        oppstartskostnad: Number(deal!.oppstartskostnad) || 0,
      }).select("id").maybeSingle();

      await supabase.from("aktiviteter").insert({
        type: "Notat",
        beskrivelse: activityDescription,
        tittel: "Kontrakt signert",
        salgsmulighet_id: CRMid,
        selskap_id: deal!.selskap_id,
        aktivitet_kilde: "dealbuilder",
        dato: new Date().toISOString(),
      });

      await supabase.from("crm_changelog").insert({
        event_type: "updated",
        entity_type: "salgsmulighet",
        entity_id: CRMid,
        entity_name: deal!.navn,
        field_name: "kontrakt_status",
        old_value: null,
        new_value: "Signert",
      });

      const recipientEmail = deal!.e_post;
      if (recipientEmail) {
        const { data: selskap } = await supabase
          .from("selskaper")
          .select("firmanavn")
          .eq("id", deal!.selskap_id)
          .maybeSingle();

        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "welcome-customer",
            recipientEmail,
            idempotencyKey: `welcome-customer-${CRMid}`,
            templateData: {
              firmanavn: selskap?.firmanavn || deal!.navn,
              kontaktperson: deal!.kontaktperson || undefined,
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
