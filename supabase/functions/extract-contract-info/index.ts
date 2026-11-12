// Leser en opplastet kontrakt-PDF (selskap_dokumenter) med Gemini og lagrer uttrekket på dokumentraden.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import {
  generateChatCompletion,
  GatewayError,
  PaymentRequiredError,
  RateLimitError,
  PermissionDeniedError,
} from "npm:@lovable.dev/ai-gateway";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { normaliserUttrekk, UTTREKK_INSTRUKS, UTTREKK_SKJEMA } from "../_shared/kontrakt-uttrekk.ts";

const MODELL = "google/gemini-3.8-flash";
const MAKS_BYTES = 10 * 1024 * 1024;

const BodySchema = z.object({ dokument_id: z.string().uuid() });

const svar = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return svar({ error: "Kun POST er støttet" }, 405);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Kun innloggede Snakk-ansatte
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user || !(user.email ?? "").toLowerCase().endsWith("@snakk.ai")) {
      return svar({ error: "Du må være logget inn med en @snakk.ai-konto." }, 401);
    }
    const { data: intern } = await supabase.rpc("er_intern", { _user_id: user.id });
    if (!intern) return svar({ error: "Du har ikke tilgang til CRM-et." }, 403);

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return svar({ error: "Ugyldig dokument-ID." }, 400);

    const { data: dok, error: dokErr } = await supabase
      .from("selskap_dokumenter")
      .select("id, fil_navn, fil_type, fil_sti")
      .eq("id", parsed.data.dokument_id)
      .maybeSingle();
    if (dokErr || !dok) return svar({ error: "Fant ikke dokumentet." }, 404);
    if ((dok.fil_type || "").toLowerCase() !== "pdf" || !dok.fil_sti) {
      return svar({ error: "Kun PDF-filer kan leses med AI." }, 400);
    }

    const { data: fil, error: filErr } = await supabase.storage.from("company-documents").download(dok.fil_sti);
    if (filErr || !fil) return svar({ error: "Kunne ikke hente PDF-filen fra lagringen." }, 404);
    if (fil.size > MAKS_BYTES) return svar({ error: "PDF-en er større enn 10 MB og kan ikke leses med AI." }, 413);

    const bytes = new Uint8Array(await fil.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      return svar({ error: "Filen ser ikke ut til å være en gyldig PDF." }, 400);
    }

    let raa: unknown;
    try {
      const res = await generateChatCompletion({
        model: MODELL,
        temperature: 0,
        messages: [
          { role: "system", content: UTTREKK_INSTRUKS },
          {
            role: "user",
            content: [
              { type: "text", text: `Hent ut kontraktsinformasjonen fra vedlagt kontrakt («${dok.fil_navn}»).` },
              { type: "file", file: { filename: dok.fil_navn || "kontrakt.pdf", file_data: `data:application/pdf;base64,${encodeBase64(bytes)}` } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "kontraktsinfo", strict: true, schema: UTTREKK_SKJEMA as unknown as Record<string, unknown> },
        },
      });
      const innhold = res.choices?.[0]?.message?.content;
      const tekst = typeof innhold === "string" ? innhold : "";
      if (!tekst) return svar({ error: "AI-en ga ikke noe svar. Prøv igjen." }, 502);
      raa = JSON.parse(tekst.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch (e) {
      if (e instanceof PaymentRequiredError) return svar({ error: "AI-kredittene er brukt opp. Fyll på i arbeidsområdet og prøv igjen." }, 402);
      if (e instanceof RateLimitError) return svar({ error: "AI-tjenesten er travel akkurat nå. Vent litt og prøv igjen." }, 429);
      if (e instanceof PermissionDeniedError) return svar({ error: "AI-modellen er ikke tilgjengelig for arbeidsområdet." }, 403);
      if (e instanceof GatewayError) {
        console.error("extract-contract-info gateway", e.code, e.httpStatus, e.message, JSON.stringify(e.ids ?? {}));
        return svar({ error: "AI-lesingen feilet. Prøv igjen om litt." }, 502);
      }
      if (e instanceof SyntaxError) return svar({ error: "AI-svaret kunne ikke tolkes. Prøv igjen." }, 502);
      throw e;
    }

    const uttrekk = normaliserUttrekk(raa);
    const naa = new Date().toISOString();
    const { error: lagreErr } = await supabase
      .from("selskap_dokumenter")
      .update({ ai_uttrekk: { ...uttrekk, modell: MODELL }, ai_uttrukket_dato: naa })
      .eq("id", dok.id);
    if (lagreErr) console.error("Kunne ikke lagre uttrekk", lagreErr);

    return svar({ uttrekk, ai_uttrukket_dato: naa });
  } catch (err) {
    console.error("extract-contract-info error", err);
    return svar({ error: "Noe gikk galt under lesing av kontrakten." }, 500);
  }
});
