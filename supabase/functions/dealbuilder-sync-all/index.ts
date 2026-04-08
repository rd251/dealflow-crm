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

    // Verify JWT
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

    // 1. Fetch all DealBuilder documents
    const dbRes = await fetch(
      "https://api.dealbuilder.app/v1/Documents?PageSize=1000",
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

    // 2. Load CRM data for matching
    const { data: kontakter } = await supabase
      .from("kontakter")
      .select("id, e_post, selskap_id");

    const { data: selskaper } = await supabase
      .from("selskaper")
      .select("id, firmanavn");

    // Build lookup maps
    const emailToSelskap = new Map<string, string>();
    for (const k of kontakter || []) {
      if (k.e_post && k.selskap_id) {
        emailToSelskap.set(k.e_post.toLowerCase().trim(), k.selskap_id);
      }
    }

    const nameToSelskap = new Map<string, string>();
    for (const s of selskaper || []) {
      if (s.firmanavn) {
        nameToSelskap.set(s.firmanavn.toLowerCase().trim(), s.id);
      }
    }

    // 3. Check existing dealbuilder docs to avoid duplicates
    const { data: existing } = await supabase
      .from("selskap_dokumenter")
      .select("dealbuilder_dokument_id")
      .not("dealbuilder_dokument_id", "is", null);

    const existingIds = new Set(
      (existing || []).map((e: any) => e.dealbuilder_dokument_id)
    );

    // 4. Process each document
    let matched = 0;
    const unmatched: any[] = [];

    for (const doc of docList) {
      const docId = String(doc.id);

      // Skip already synced
      if (existingIds.has(docId)) continue;

      // Try to match
      const signatories = doc.externalSignatories || [];
      const firstSig = signatories[0] || {};
      const sigEmail = (firstSig.email || "").toLowerCase().trim();
      const sigCompany = (firstSig.companyName || "").toLowerCase().trim();

      let selskapId: string | null = null;

      // Match by email
      if (sigEmail && emailToSelskap.has(sigEmail)) {
        selskapId = emailToSelskap.get(sigEmail)!;
      }

      // Match by company name
      if (!selskapId && sigCompany && nameToSelskap.has(sigCompany)) {
        selskapId = nameToSelskap.get(sigCompany)!;
      }

      const statusMap: Record<string, string> = {
        Draft: "Ikke sendt",
        Sent: "Sendt",
        Opened: "Åpnet",
        Signed: "Signert",
        Expired: "Utløpt",
        Completed: "Signert",
      };

      const mappedStatus = statusMap[doc.status] || doc.status || "Ukjent";

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

        if (!insertErr) {
          matched++;
        }
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
        matched,
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
