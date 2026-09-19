// Sender én fokusert oppfølgingspåminnelse per person som ikke har svart.
// Kjøres av cron kl. 06:00 UTC.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = "https://snakk-ai-crm.lovable.app";

/** Terskler – speiler src/lib/nudge-rules.ts */
const NUDGE_DAGER_STANDARD = 3;
const NUDGE_MAKS_PER_DAG = 5;

const dagerSiden = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

function dyplenke(rad: Record<string, any>): { lenke: string; tekst: string } {
  if (rad.salgsmulighet_id) return { lenke: `${APP_URL}/salgsmuligheter?id=${rad.salgsmulighet_id}`, tekst: "Åpne salgsmuligheten" };
  if (rad.lead_id) return { lenke: `${APP_URL}/leads?id=${rad.lead_id}`, tekst: "Åpne leadet" };
  if (rad.kontakt_id) return { lenke: `${APP_URL}/kontakter?id=${rad.kontakt_id}`, tekst: "Åpne kontakten" };
  if (rad.selskap_id) return { lenke: `${APP_URL}/selskaper/${rad.selskap_id}`, tekst: "Åpne selskapet" };
  return { lenke: `${APP_URL}/relasjoner`, tekst: "Åpne relasjoner" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: profiler } = await supabase
      .from("profiles")
      .select("user_id, email, display_name, signatur_navn, signatur_tittel, signatur_selskap, nudge_aktiv, nudge_dager");

    let sendt = 0;
    const detaljer: Array<Record<string, unknown>> = [];

    for (const p of (profiler ?? []) as any[]) {
      if (p.nudge_aktiv === false || !p.email) continue;
      const terskel = p.nudge_dager ?? NUDGE_DAGER_STANDARD;
      const grense = new Date(Date.now() - terskel * 86_400_000).toISOString();

      const { data: rader } = await supabase
        .from("venter_pa_svar")
        .select("*")
        .eq("user_id", p.user_id)
        .eq("status", "venter")
        .lte("sendt_dato", grense)
        .order("sendt_dato", { ascending: true })
        .limit(NUDGE_MAKS_PER_DAG);

      for (const rad of (rader ?? []) as any[]) {
        // Finn navn og selskap på personen
        let personNavn = rad.e_post || "kontakten";
        let selskap: string | null = null;

        if (rad.kontakt_id) {
          const { data: k } = await supabase
            .from("kontakter").select("navn, selskap_id").eq("id", rad.kontakt_id).maybeSingle();
          if (k?.navn) personNavn = k.navn;
          if (k?.selskap_id) {
            const { data: s } = await supabase
              .from("selskaper").select("firmanavn").eq("id", k.selskap_id).maybeSingle();
            selskap = s?.firmanavn ?? null;
          }
        } else if (rad.lead_id) {
          const { data: l } = await supabase
            .from("leads").select("kontaktperson, firmanavn").eq("id", rad.lead_id).maybeSingle();
          if (l?.kontaktperson) personNavn = l.kontaktperson;
          selskap = l?.firmanavn ?? null;
        } else if (rad.selskap_id) {
          const { data: s } = await supabase
            .from("selskaper").select("firmanavn").eq("id", rad.selskap_id).maybeSingle();
          selskap = s?.firmanavn ?? null;
        }

        const { lenke, tekst } = dyplenke(rad);

        const res = await sendTemplateEmail("follow-up-nudge", p.email, {
          idempotencyKey: `nudge-${rad.id}`,
          templateData: {
            personNavn,
            selskap,
            dagerSiden: dagerSiden(rad.sendt_dato),
            emne: rad.emne ?? "",
            begrunnelse: rad.ai_begrunnelse ?? "",
            lenke,
            lenkeTekst: tekst,
            signaturNavn: p.signatur_navn || p.display_name || "",
            signaturTittel: p.signatur_tittel ?? null,
            signaturSelskap: p.signatur_selskap ?? null,
            appUrl: APP_URL,
          },
        });

        await supabase
          .from("venter_pa_svar")
          .update({ status: "varslet", varslet_at: new Date().toISOString() })
          .eq("id", rad.id);

        if (res.sent) sendt++;
        detaljer.push({ bruker: p.user_id, person: personNavn, sendt: res.sent });
      }
    }

    return new Response(JSON.stringify({ success: true, sendt, detaljer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("nudge-awaiting-reply error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Ukjent feil" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
