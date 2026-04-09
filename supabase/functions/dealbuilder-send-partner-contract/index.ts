import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const BodySchema = z.object({
  partner_id: z.string().uuid(),
  firmanavn: z.string().min(1),
  orgnr: z.string().optional().default(""),
  adresse: z.string(),
  kontaktperson: z.string().min(1),
  telefon: z.string().optional().default(""),
  e_post: z.string().email(),
  sender_email: z.string().email(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = parsed.data;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const DEALBUILDER_API_KEY = Deno.env.get("DEALBUILDER_API_KEY")?.trim();

    if (!DEALBUILDER_API_KEY) {
      throw new Error("DEALBUILDER_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Download the partner contract PDF template from storage
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from("contract-pdfs")
      .download("templates/samarbeidsavtale-partner.pdf");

    if (downloadError || !pdfData) {
      throw new Error(`Failed to download partner contract template: ${downloadError?.message}`);
    }

    const pdfBytes = new Uint8Array(await pdfData.arrayBuffer());

    // 2. Upload PDF to DealBuilder
    const pdfFileName = `samarbeidsavtale-${data.firmanavn.replace(/\s+/g, "-")}.pdf`;
    const formData = new FormData();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    formData.append("files", blob, pdfFileName);

    console.log("Uploading partner contract PDF to DealBuilder...");

    const uploadRes = await fetch("https://api.dealbuilder.io/v1/uploads", {
      method: "POST",
      headers: { "x-api-key": DEALBUILDER_API_KEY },
      body: formData,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("DealBuilder Upload error", { status: uploadRes.status, body: errText });
      throw new Error(`DealBuilder Upload failed (${uploadRes.status}): ${errText}`);
    }

    const uploadResult = await uploadRes.json();
    const uploadedPdfUrl = uploadResult.fileUrls?.[0] || uploadResult.url || uploadResult.fileUrl || uploadResult.path || uploadResult.urls?.[0] || uploadResult.files?.[0]?.url;

    console.log("DealBuilder upload result:", JSON.stringify(uploadResult));

    if (!uploadedPdfUrl) {
      throw new Error(`DealBuilder Upload returned no URL: ${JSON.stringify(uploadResult)}`);
    }

    // 3. Store a copy in Supabase Storage
    const fileName = `partner/${data.partner_id}/${Date.now()}-${pdfFileName}`;
    await supabase.storage
      .from("contract-pdfs")
      .upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: false });

    // 4. Send for signing via DealBuilder Documents API
    const dealBuilderPayload = {
      mode: "SendByEmail",
      templateId: "73bebc18-b668-4266-b323-3797b3e7ceab",
      uploadedPdfUrl,
      title: `Samarbeidsavtale – Snakk Teknologi AS & ${data.firmanavn}`,
      creatorEmail: data.sender_email,
      senderEmail: data.sender_email,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      externalSignatories: [{
        name: data.kontaktperson,
        email: data.e_post,
        ...(data.telefon?.replace(/\s/g, "").length >= 8 ? { phoneNumber: data.telefon.replace(/\s/g, "") } : {}),
        companyName: data.firmanavn,
        ...(data.orgnr?.trim() ? { companyOrgNumber: data.orgnr.trim() } : {}),
      }],
      customFieldValues: [
        { id: "CRMid", value: data.partner_id },
      ],
    };

    console.log("Calling DealBuilder Documents API for partner contract...");

    const dbRes = await fetch("https://api.dealbuilder.io/v1/Documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": DEALBUILDER_API_KEY,
      },
      body: JSON.stringify(dealBuilderPayload),
    });

    if (!dbRes.ok) {
      const errText = await dbRes.text();
      console.error("DealBuilder API error", { status: dbRes.status, body: errText });
      throw new Error(`DealBuilder API failed (${dbRes.status}): ${errText}`);
    }

    const dbResult = await dbRes.json();
    const dokumentId = dbResult.id || dbResult.documentId || null;

    // 5. Log activity
    await supabase.from("aktiviteter").insert({
      type: "Notat",
      beskrivelse: `Samarbeidsavtale sendt til ${data.kontaktperson} (${data.e_post})`,
      dato: new Date().toISOString(),
      partner_id: data.partner_id,
      tittel: `Samarbeidsavtale sendt: ${data.firmanavn}`,
    });

    // 6. Update partner sist_aktivitet
    await supabase.from("partnere").update({
      sist_aktivitet: new Date().toISOString().split("T")[0],
    }).eq("id", data.partner_id);

    return new Response(JSON.stringify({ success: true, dokumentId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Send partner contract error:", err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
