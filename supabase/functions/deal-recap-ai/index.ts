import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { salgsmulighet_id } = await req.json();
    if (!salgsmulighet_id || typeof salgsmulighet_id !== "string") {
      return new Response(JSON.stringify({ error: "salgsmulighet_id påkrevd" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY mangler");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch deal + relasjoner
    const { data: sm, error: smErr } = await supabase
      .from("salgsmuligheter")
      .select("*, selskaper(firmanavn, bransje), kontakter(navn, rolle)")
      .eq("id", salgsmulighet_id)
      .maybeSingle();

    if (smErr || !sm) {
      return new Response(JSON.stringify({ error: "Salgsmulighet ikke funnet" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch siste 20 aktiviteter
    const { data: akt } = await supabase
      .from("aktiviteter")
      .select("type, dato, tittel, beskrivelse, moetenotater, no_show")
      .eq("salgsmulighet_id", salgsmulighet_id)
      .order("dato", { ascending: false })
      .limit(20);

    const ctxLines: string[] = [
      `Deal: ${sm.navn}`,
      `Selskap: ${sm.selskaper?.firmanavn || "-"} (${sm.selskaper?.bransje || "ukjent bransje"})`,
      `Kontakt: ${sm.kontakter?.navn || sm.kontaktperson || "-"} ${sm.kontakter?.rolle ? "- " + sm.kontakter.rolle : ""}`,
      `Status: ${sm.status} | Sannsynlighet: ${sm.sannsynlighet || 0}% | MRR: ${sm.forventet_mrr || 0} kr`,
      `Pakke: ${sm.valgt_pakke || "-"} | Lukkedato: ${sm.forventet_lukkedato || "-"}`,
      `Use case: ${sm.use_case || "-"}`,
      `Notater: ${(sm.notater || "").slice(0, 500)}`,
      `Neste steg (manuelt satt): ${sm.neste_steg || "-"}`,
    ];

    if (akt && akt.length > 0) {
      ctxLines.push(`\nSiste aktiviteter (${akt.length} stk):`);
      for (const a of akt) {
        const dato = a.dato?.slice(0, 10) || "";
        const navn = a.tittel || a.beskrivelse?.slice(0, 80) || "";
        ctxLines.push(`- ${dato} [${a.type}]${a.no_show ? " (NO-SHOW)" : ""} ${navn}`);
        if (a.moetenotater) ctxLines.push(`  Notat: ${a.moetenotater.slice(0, 250)}`);
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Du er en salgs-AI for Snakk CRM. Generer en kort, handlingsorientert recap av en salgsmulighet basert på all aktivitet. Vær konkret. Svar alltid på norsk (bokmål).`
          },
          {
            role: "user",
            content: ctxLines.join("\n")
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "deal_recap",
            description: "Strukturert recap av salgsmuligheten",
            parameters: {
              type: "object",
              properties: {
                sammendrag: { type: "string", description: "2-3 setninger om hvor dealen står akkurat nå" },
                kundesignal: { type: "string", enum: ["Høy", "Medium", "Lav", "Ukjent"], description: "Vurdering av kundens interesse" },
                neste_steg: { type: "string", description: "Konkret foreslått neste handling" },
                risikofaktorer: {
                  type: "array",
                  items: { type: "string" },
                  description: "0-3 punkter som kan stoppe dealen (tom liste hvis ingen)"
                }
              },
              required: ["sammendrag", "kundesignal", "neste_steg", "risikofaktorer"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "deal_recap" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI-kreditter tomme" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI-feil" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Ingen recap returnert" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recap = JSON.parse(toolCall.function.arguments);
    const ai_recap = {
      ...recap,
      generert_dato: new Date().toISOString(),
      basert_paa_aktiviteter: akt?.length || 0,
    };

    await supabase
      .from("salgsmuligheter")
      .update({ ai_recap })
      .eq("id", salgsmulighet_id);

    return new Response(JSON.stringify({ ok: true, ai_recap }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("deal-recap-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Ukjent feil" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
