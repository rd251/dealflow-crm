import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const partnerId = url.searchParams.get("partner_id");

    if (!partnerId) {
      return new Response(JSON.stringify({ error: "partner_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("DEALBUILDER_API_KEY")?.trim();
    if (!apiKey) {
      return new Response(JSON.stringify({ documents: [], error: "DEALBUILDER_API_KEY not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch documents from DealBuilder using partner_id as CRMid
    const allDocuments: Array<{
      id: string;
      title: string;
      status: string;
      sentAt: string | null;
      signedAt: string | null;
      appUrl: string | null;
      downloadUrl: string | null;
    }> = [];

    try {
      const res = await fetch(
        `https://api.dealbuilder.no/v1/Documents?CRMid=${encodeURIComponent(partnerId)}`,
        {
          headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        }
      );

      if (res.ok) {
        const data = await res.json();
        const docs = Array.isArray(data) ? data : data.documents || data.data || [];

        for (const doc of docs) {
          const rawStatus = doc.status || "Ukjent";
          // Map DealBuilder statuses to Norwegian
          let status = rawStatus;
          if (/sign/i.test(rawStatus)) status = "Signert";
          else if (/open/i.test(rawStatus)) status = "Åpnet";
          else if (/sent|pending/i.test(rawStatus)) status = "Sendt";
          else if (/expir/i.test(rawStatus)) status = "Utløpt";

          allDocuments.push({
            id: doc.id || doc.documentId || crypto.randomUUID(),
            title: doc.title || doc.name || "Samarbeidsavtale",
            status,
            sentAt: doc.sentAt || doc.createdAt || doc.created_at || null,
            signedAt: doc.signedAt || doc.signed_at || null,
            appUrl: doc.appUrl || doc.app_url || null,
            downloadUrl: doc.uploadedDocumentUrl || doc.uploaded_document_url || doc.downloadUrl || null,
          });
        }
      }
    } catch {
      // Ignore fetch errors
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
