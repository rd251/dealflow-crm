import { createClient } from "npm:@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dealBuilderKey = Deno.env.get("DEALBUILDER_API_KEY");

    if (!dealBuilderKey) {
      return new Response(
        JSON.stringify({ error: "DEALBUILDER_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Hent alle DealBuilder-dokumenter
    const dbRes = await fetch(
      "https://api.dealbuilder.io/v1/Documents?PageSize=1000",
      { headers: { "x-api-key": dealBuilderKey } }
    );

    if (!dbRes.ok) {
      const errText = await dbRes.text();
      return new Response(
        JSON.stringify({ error: "DealBuilder API error", detail: errText, status: dbRes.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dbData = await dbRes.json();
    const documents = dbData?.data?.items || dbData?.data || dbData?.items || dbData || [];
    const docList = Array.isArray(documents) ? documents : [];

    const statusMap: Record<string, string> = {
      Draft: "Ikke sendt",
      Sent: "Sendt",
      Opened: "Åpnet",
      Signed: "Signert",
      Accepted: "Signert",
      Expired: "Utløpt",
      Completed: "Signert",
      Revoked: "Tilbakekalt",
      Declined: "Avvist",
    };

    // 2. Last inn ALLE salgsmuligheter (for matching både via doc_id og selskap)
    const { data: allSalgs } = await supabase
      .from("salgsmuligheter")
      .select("id, navn, selskap_id, dealbuilder_dokument_id, kontrakt_status, kontrakt_signert_dato, status, forventet_mrr, oppstartskostnad, ansvarlig, kontaktperson, e_post, created_at")
      .order("created_at", { ascending: false });

    const salgsByDocId = new Map<string, any>();
    const openDealsBySelskap = new Map<string, any>();
    for (const s of allSalgs || []) {
      if (s.dealbuilder_dokument_id) salgsByDocId.set(String(s.dealbuilder_dokument_id), s);
      if (s.selskap_id && s.status !== "Vunnet" && s.status !== "Tapt" && !openDealsBySelskap.has(s.selskap_id)) {
        openDealsBySelskap.set(s.selskap_id, s);
      }
    }

    // 3. Last inn for matching av nye dokumenter
    const { data: kontakter } = await supabase
      .from("kontakter")
      .select("id, e_post, selskap_id");
    const { data: selskaper } = await supabase
      .from("selskaper")
      .select("id, firmanavn");
    const { data: partnere } = await supabase
      .from("partnere")
      .select("id, partnernavn, e_post, selskap_id");

    const emailToSelskap = new Map<string, string>();
    for (const k of kontakter || []) {
      if (k.e_post && k.selskap_id) emailToSelskap.set(k.e_post.toLowerCase().trim(), k.selskap_id);
    }
    const nameToSelskap = new Map<string, string>();
    for (const s of selskaper || []) {
      if (s.firmanavn) nameToSelskap.set(s.firmanavn.toLowerCase().trim(), s.id);
    }
    const partnerNames = new Set<string>();
    const partnerEmails = new Set<string>();
    const partnerSelskapIds = new Set<string>();
    for (const p of partnere || []) {
      if (p.partnernavn) partnerNames.add(p.partnernavn.toLowerCase().trim());
      if (p.e_post) partnerEmails.add(p.e_post.toLowerCase().trim());
      if (p.selskap_id) partnerSelskapIds.add(p.selskap_id);
    }

    const { data: existing } = await supabase
      .from("selskap_dokumenter")
      .select("id, dealbuilder_dokument_id, status")
      .not("dealbuilder_dokument_id", "is", null);
    const existingByDocId = new Map<string, any>();
    for (const e of existing || []) {
      if (e.dealbuilder_dokument_id) existingByDocId.set(String(e.dealbuilder_dokument_id), e);
    }

    let docsInserted = 0;
    let docsUpdated = 0;
    let salgsUpdated = 0;
    const salgsChanges: any[] = [];
    const unmatched: any[] = [];

    for (const doc of docList) {
      const docId = String(doc.id);
      const mappedStatus = statusMap[doc.status] || doc.status || "Ukjent";
      const signedAt = doc.signedDate || doc.completedDate || doc.signedAt || null;

      // Finn signatar tidlig (brukes både til matching og dokumentopprettelse)
      const parties = doc.parties || doc.externalSignatories || [];
      const extSig = parties.find((p: any) => (p.roles || []).includes("ExternalSignatory")) || parties[0] || {};
      const sigEmail = (extSig.email || "").toLowerCase().trim();
      const sigCompany = (extSig.companyName || "").toLowerCase().trim();

      // Avgjør om dette er en partneravtale — skal IKKE markere salgsmulighet som Vunnet
      const title = String(doc.title || "").toLowerCase();
      const isPartnerDoc =
        title.includes("samarbeid") ||
        title.includes("partner") ||
        (sigEmail && partnerEmails.has(sigEmail)) ||
        (sigCompany && partnerNames.has(sigCompany));

      // Finn matchende salgsmulighet: først via doc_id, ellers via selskap (kun for signerte kundekontrakter)
      let sm = salgsByDocId.get(docId);
      let matchedViaSelskap = false;
      if (!sm && mappedStatus === "Signert" && !isPartnerDoc) {
        let selskapId: string | null = null;
        if (sigEmail && emailToSelskap.has(sigEmail)) selskapId = emailToSelskap.get(sigEmail)!;
        if (!selskapId && sigCompany && nameToSelskap.has(sigCompany)) selskapId = nameToSelskap.get(sigCompany)!;
        if (selskapId && !partnerSelskapIds.has(selskapId) && openDealsBySelskap.has(selskapId)) {
          sm = openDealsBySelskap.get(selskapId);
          matchedViaSelskap = true;
        }
      }

      if (sm) {
        const updates: any = {};
        if (matchedViaSelskap) updates.dealbuilder_dokument_id = docId;
        if (sm.kontrakt_status !== mappedStatus) updates.kontrakt_status = mappedStatus;
        if (mappedStatus === "Signert") {
          if (!sm.kontrakt_signert_dato) {
            updates.kontrakt_signert_dato = signedAt || new Date().toISOString();
          }
          // Full "Vunnet"-flyt hvis ikke allerede vunnet
          if (sm.status !== "Vunnet") {
            updates.status = "Vunnet";
            updates.vunnet_dato = (updates.kontrakt_signert_dato || new Date().toISOString()).split("T")[0];
          }
        }
        if (Object.keys(updates).length > 0) {
          const { error: upErr } = await supabase
            .from("salgsmuligheter")
            .update(updates)
            .eq("id", sm.id);
          if (!upErr) {
            salgsUpdated++;
            salgsChanges.push({ id: sm.id, navn: sm.navn, fra: sm.kontrakt_status, til: mappedStatus, signert: updates.kontrakt_signert_dato || sm.kontrakt_signert_dato, vunnet: updates.status === "Vunnet" });
          }

          // Hvis vi nettopp markerte som Vunnet: oppdater selskap + opprett prosjekt + aktivitet + changelog
          if (!upErr && updates.status === "Vunnet" && sm.selskap_id) {
            const today = new Date().toISOString().split("T")[0];
            const mrr = Number(sm.forventet_mrr) || 0;

            await supabase.from("selskaper").update({
              kundestatus: "Pilot",
              live_status: false,
              onboarding_status: "Ikke startet",
              mrr,
              arr: mrr * 12,
              oppstartskostnad: Number(sm.oppstartskostnad) || 0,
              sist_aktivitet: today,
              lukkedato: today,
            }).eq("id", sm.selskap_id);

            // Unngå duplikat prosjekt
            const { data: existingProj } = await supabase
              .from("prosjekter").select("id").eq("salgsmulighet_id", sm.id).maybeSingle();
            if (!existingProj) {
              await supabase.from("prosjekter").insert({
                prosjektnavn: sm.navn,
                selskap_id: sm.selskap_id,
                salgsmulighet_id: sm.id,
                ansvarlig: sm.ansvarlig || "",
                status: "Ny",
                startdato: today,
                oppstartskostnad: Number(sm.oppstartskostnad) || 0,
              });
            }

            await supabase.from("aktiviteter").insert({
              type: "Notat",
              tittel: "Kontrakt signert",
              beskrivelse: `Kontrakt signert via DealBuilder (sync) — ${sigEmail || sigCompany || "ukjent signatar"}`,
              salgsmulighet_id: sm.id,
              selskap_id: sm.selskap_id,
              aktivitet_kilde: "dealbuilder",
              dato: new Date().toISOString(),
            });

            await supabase.from("crm_changelog").insert({
              event_type: "updated",
              entity_type: "salgsmulighet",
              entity_id: sm.id,
              entity_name: sm.navn,
              field_name: "kontrakt_status",
              old_value: sm.kontrakt_status,
              new_value: "Signert",
            });
          }
        }
      }

      // Oppdater eller insert i selskap_dokumenter
      const existingDoc = existingByDocId.get(docId);
      if (existingDoc) {
        if (existingDoc.status !== mappedStatus) {
          const { error: upErr } = await supabase
            .from("selskap_dokumenter")
            .update({ status: mappedStatus })
            .eq("id", existingDoc.id);
          if (!upErr) docsUpdated++;
        }
        continue;
      }

      let selskapId: string | null = sm?.selskap_id || null;
      if (!selskapId && sigEmail && emailToSelskap.has(sigEmail)) selskapId = emailToSelskap.get(sigEmail)!;
      if (!selskapId && sigCompany && nameToSelskap.has(sigCompany)) selskapId = nameToSelskap.get(sigCompany)!;

      if (selskapId) {
        const { error: insertErr } = await supabase
          .from("selskap_dokumenter")
          .insert({
            selskap_id: selskapId,
            dealbuilder_dokument_id: docId,
            tittel: doc.title || "Uten tittel",
            fil_navn: doc.title || "DealBuilder-kontrakt",
            fil_sti: "",
            fil_type: "dealbuilder",
            status: mappedStatus,
            opprettet_dato: doc.createdDate || new Date().toISOString(),
            kilde: "dealbuilder",
            opplastet_av: "DealBuilder",
          });
        if (!insertErr) docsInserted++;
      } else {
        unmatched.push({
          id: docId,
          title: doc.title,
          status: mappedStatus,
          createdDate: doc.createdDate,
          signatoryEmail: sigEmail || null,
          signatoryCompany: extSig.companyName || null,
        });
      }
    }

    return new Response(
      JSON.stringify({
        total: docList.length,
        docsInserted,
        docsUpdated,
        salgsUpdated,
        salgsChanges,
        unmatched: unmatched.length,
        unmatchedDocuments: unmatched,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
