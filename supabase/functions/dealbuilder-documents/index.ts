import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const selskapId = url.searchParams.get("selskap_id");

    if (!selskapId) {
      return new Response(JSON.stringify({ error: "selskap_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all salgsmuligheter for this selskap to use as CRMids
    const { data: deals, error: dealsError } = await supabase
      .from("salgsmuligheter")
      .select("id, navn, kontrakt_status, dealbuilder_dokument_id")
      .eq("selskap_id", selskapId);

    if (dealsError) {
      return new Response(JSON.stringify({ error: "Failed to fetch deals", details: dealsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("DEALBUILDER_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ documents: [], error: "DEALBUILDER_API_KEY not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch documents from DealBuilder for each deal
    const allDocuments: Array<{
      id: string;
      title: string;
      status: string;
      sentAt: string | null;
      signedAt: string | null;
      appUrl: string | null;
      downloadUrl: string | null;
      dealName: string;
      dealId: string;
    }> = [];

    for (const deal of (deals || [])) {
      try {
        const res = await fetch(
          `https://api.dealbuilder.no/v1/Documents?CRMid=${encodeURIComponent(deal.id)}`,
          {
            headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
          }
        );

        if (!res.ok) continue;

        const data = await res.json();
        const docs = Array.isArray(data) ? data : data.documents || data.data || [];

        for (const doc of docs) {
          allDocuments.push({
            id: doc.id || doc.documentId || crypto.randomUUID(),
            title: doc.title || doc.name || "Dokument",
            status: doc.status || deal.kontrakt_status || "Ukjent",
            sentAt: doc.sentAt || doc.createdAt || doc.created_at || null,
            signedAt: doc.signedAt || doc.signed_at || null,
            appUrl: doc.appUrl || doc.app_url || null,
            downloadUrl: doc.uploadedDocumentUrl || doc.uploaded_document_url || doc.downloadUrl || null,
            dealName: deal.navn,
            dealId: deal.id,
          });
        }
      } catch {
        // Skip failed requests for individual deals
      }
    }

    // Sort newest first
    allDocuments.sort((a, b) => {
      const dateA = a.signedAt || a.sentAt || "";
      const dateB = b.signedAt || b.sentAt || "";
      return dateB.localeCompare(dateA);
    });

    return new Response(JSON.stringify({ documents: allDocuments }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
