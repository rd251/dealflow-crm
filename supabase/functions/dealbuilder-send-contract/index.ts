import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const BodySchema = z.object({
  salgsmulighet_id: z.string().uuid(),
  firmanavn: z.string().min(1),
  orgnr: z.string(),
  adresse: z.string(),
  kontaktperson: z.string(),
  telefon: z.string(),
  e_post: z.string().email(),
  valgt_pakke: z.string(),
  pakke_pris: z.number(),
  minutter: z.string(),
  sender_email: z.string().email(),
  sla: z.number().nullable().optional(),
  oppstartskostnad: z.number().nullable().optional(),
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

    // 1. Generate PDF
    const pdfRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-contract-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        firmanavn: data.firmanavn,
        orgnr: data.orgnr,
        adresse: data.adresse,
        kontaktperson: data.kontaktperson,
        telefon: data.telefon,
        e_post: data.e_post,
        valgt_pakke: data.valgt_pakke,
        pakke_pris: data.pakke_pris,
        minutter: data.minutter,
        sla: data.sla ?? null,
        oppstartskostnad: data.oppstartskostnad ?? null,
      }),
    });

    if (!pdfRes.ok) {
      const errText = await pdfRes.text();
      throw new Error(`PDF generation failed: ${errText}`);
    }

    const pdfBuffer = await pdfRes.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfBuffer);

    // 2. Upload PDF to DealBuilder via their upload endpoint
    const pdfFileName = `kontrakt-${data.firmanavn.replace(/\s+/g, "-")}.pdf`;

    const formData = new FormData();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    formData.append("files", blob, pdfFileName);

    console.log("Uploading PDF to DealBuilder...");

    const uploadRes = await fetch("https://api.dealbuilder.io/v1/uploads", {
      method: "POST",
      headers: {
        "x-api-key": DEALBUILDER_API_KEY,
      },
      body: formData,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("DealBuilder Upload error", {
        status: uploadRes.status,
        body: errText,
      });
      throw new Error(`DealBuilder Upload failed (${uploadRes.status}): ${errText}`);
    }

    const uploadResult = await uploadRes.json();
    const uploadedPdfUrl = uploadResult.url || uploadResult.fileUrl || uploadResult.path || uploadResult.urls?.[0] || uploadResult.files?.[0]?.url;

    console.log("DealBuilder upload result:", JSON.stringify(uploadResult));

    if (!uploadedPdfUrl) {
      throw new Error(`DealBuilder Upload returned no URL: ${JSON.stringify(uploadResult)}`);
    }

    // 3. Also store in Supabase Storage for our records
    const fileName = `${data.salgsmulighet_id}/${Date.now()}-${pdfFileName}`;
    await supabase.storage
      .from("contract-pdfs")
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    // 4. Send for signing via DealBuilder Documents API
    const dealBuilderPayload = {
      mode: "SendByEmail",
      templateId: "73bebc18-b668-4266-b323-3797b3e7ceab",
      uploadedPdfUrl,
      title: `Avtale om bruk av Snakk Teknologi AS - ${data.firmanavn}`,
      creatorEmail: data.sender_email,
      senderEmail: data.sender_email,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      externalSignatories: [{
        name: data.kontaktperson,
        email: data.e_post,
        phoneNumber: data.telefon,
        companyName: data.firmanavn,
        companyOrgNumber: data.orgnr,
      }],
      customFieldValues: [
        { id: "CRMid", value: data.salgsmulighet_id },
      ],
    };

    console.log("Calling DealBuilder Documents API with uploaded PDF URL:", uploadedPdfUrl);

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
      console.error("DealBuilder API error", {
        status: dbRes.status,
        statusText: dbRes.statusText,
        responseBody: errText,
      });
      throw new Error(`DealBuilder API failed (${dbRes.status}): ${errText}`);
    }

    const dbResult = await dbRes.json();
    const dokumentId = dbResult.id || dbResult.documentId || null;

    // 5. Update salgsmulighet
    const updateData: Record<string, unknown> = {
      kontrakt_status: "Sendt",
      status: "Kontrakt sendt",
      sist_aktivitet: new Date().toISOString().split("T")[0],
    };
    if (dokumentId) {
      updateData.dealbuilder_dokument_id = dokumentId;
    }

    const { error: updateError } = await supabase
      .from("salgsmuligheter")
      .update(updateData)
      .eq("id", data.salgsmulighet_id);

    if (updateError) {
      console.error("Failed to update salgsmulighet:", updateError);
    }

    // 6. Log activity
    await supabase.from("aktiviteter").insert({
      type: "Notat",
      beskrivelse: `Kontrakt sendt til ${data.kontaktperson} (${data.e_post}) — ${data.valgt_pakke}`,
      dato: new Date().toISOString(),
      salgsmulighet_id: data.salgsmulighet_id,
      tittel: `Kontrakt sendt: ${data.firmanavn}`,
    });

    return new Response(JSON.stringify({
      success: true,
      dokumentId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Send contract error:", err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
