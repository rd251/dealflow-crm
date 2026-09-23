// Finner selvbetjente signeringer i DealBuilder og oppretter kundeforholdet i CRM-et.
// Kjøres på cron og kan kjøres manuelt.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  hentDealBuilderDokumenter,
  opprettKundeFraDokument,
  erPartneravtale,
  erFerskSignering,
  SIGNERTE_STATUSER,
  MAKS_PER_KJORING,
  type AutoResultat,
} from "../_shared/auto-kunde.ts";
import { behandleHendelse } from "../_shared/crm-varsel/hendelser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const bare = url.searchParams.get("dokument_id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const alle = await hentDealBuilderDokumenter();
    const aktuelle = alle
      .filter((d) => SIGNERTE_STATUSER.includes(String(d.status)))
      .filter((d) => !erPartneravtale(String(d.title || "")))
      .filter((d) => (bare ? String(d.id) === bare : true))
      .slice(0, MAKS_PER_KJORING);

    const resultater: AutoResultat[] = [];
    for (const doc of aktuelle) {
      const res = await opprettKundeFraDokument(supabase, doc);
      resultater.push(res);
      if (res.status === "opprettet" && res.salgsmulighet_id && erFerskSignering(res.signert_dato)) {
        try {
          await behandleHendelse(supabase, {
            hendelse: "kontrakt_signert",
            salgsmulighet_id: res.salgsmulighet_id,
            signert_dato: new Date().toISOString(),
          });
        } catch (e) {
          console.error("auto-kunde: varsel feilet", String(e));
        }
      }
    }

    return new Response(
      JSON.stringify({
        sjekket: aktuelle.length,
        opprettet: resultater.filter((r) => r.status === "opprettet").length,
        resultater,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
