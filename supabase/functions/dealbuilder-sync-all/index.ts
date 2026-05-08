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
      { headers: { Authorization: `Bearer ${dealBuilderKey}` } }
    );

    if (!dbRes.ok) {
      const errText = await dbRes.text();
      return new Response(
        JSON.stringify({ error: "DealBuilder API error", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dbData = await dbRes.json();
    const documents = dbData.data || dbData.items || dbData || [];
    const docList = Array.isArray(documents) ? documents : [];

    const statusMap: Record<string, string> = {
      Draft: "Ikke sendt",
      Sent: "Sendt",
      Opened: "Åpnet",
      Signed: "Signert",
      Expired: "Utløpt",
      Completed: "Signert",
    };

    // 2. Last inn salgsmuligheter med dealbuilder_dokument_id
    const { data: salgsmuligheter } = await supabase
      .from("salgsmuligheter")
      .select("id, navn, selskap_id, dealbuilder_dokument_id, kontrakt_status, kontrakt_signert_dato, status, forventet_mrr, oppstartskostnad")
      .not("dealbuilder_dokument_id", "is", null);

    const salgsByDocId = new Map<string, any>();
    for (const s of salgsmuligheter || []) {
      if (s.dealbuilder_dokument_id) salgsByDocId.set(String(s.dealbuilder_dokument_id), s);
    }

    // 3. Last inn for matching av nye dokumenter
    const { data: kontakter } = await supabase
      .from("kontakter")
      .select("id, e_post, selskap_id");
    const { data: selskaper } = await supabase
      .from("selskaper")
      .select("id, firmanavn");

    const emailToSelskap = new Map<string, string>();
    for (const k of kontakter || []) {
      if (k.e_post && k.selskap_id) emailToSelskap.set(k.e_post.toLowerCase().trim(), k.selskap_id);
    }
    const nameToSelskap = new Map<string, string>();
    for (const s of selskaper || []) {
      if (s.firmanavn) nameToSelskap.set(s.firmanavn.toLowerCase().trim(), s.id);
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

      // Oppdater salgsmulighet hvis koblet
      const sm = salgsByDocId.get(docId);
      if (sm) {
        const updates: any = {};
        if (sm.kontrakt_status !== mappedStatus) updates.kontrakt_status = mappedStatus;
        if (mappedStatus === "Signert") {
          if (!sm.kontrakt_signert_dato && signedAt) {
            updates.kontrakt_signert_dato = signedAt;
          } else if (!sm.kontrakt_signert_dato && !signedAt) {
            updates.kontrakt_signert_dato = new Date().toISOString();
          }
        }
        if (Object.keys(updates).length > 0) {
          const { error: upErr } = await supabase
            .from("salgsmuligheter")
            .update(updates)
            .eq("id", sm.id);
          if (!upErr) {
            salgsUpdated++;
            salgsChanges.push({ id: sm.id, navn: sm.navn, fra: sm.kontrakt_status, til: mappedStatus, signert: updates.kontrakt_signert_dato || sm.kontrakt_signert_dato });
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

      // Match nytt dokument til selskap
      const signatories = doc.externalSignatories || [];
      const firstSig = signatories[0] || {};
      const sigEmail = (firstSig.email || "").toLowerCase().trim();
      const sigCompany = (firstSig.companyName || "").toLowerCase().trim();

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
          signatoryCompany: firstSig.companyName || null,
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
