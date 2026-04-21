import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FollowupSuggestion {
  sammendrag: string;          // 1-2 setninger oppsummering av møtet
  hovedpunkter: string[];      // 3-5 stikkord
  kundesignal: "Høy" | "Medium" | "Lav" | "Ukjent";
  foreslatt_oppgave: {
    tittel: string;
    frist_dager: number;       // 1-14
    prioritet: "Lav" | "Medium" | "Høy";
  };
  generert_dato: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { aktivitet_id, force } = await req.json();
    if (!aktivitet_id || typeof aktivitet_id !== "string") {
      return new Response(JSON.stringify({ error: "aktivitet_id påkrevd" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY mangler");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Hent møtet
    const { data: akt, error: aktErr } = await supabase
      .from("aktiviteter")
      .select("id, type, dato, tittel, beskrivelse, moetenotater, ai_oppsummering, salgsmulighet_id, selskap_id, kontakt_id, aktivitet_kilde")
      .eq("id", aktivitet_id)
      .maybeSingle();

    if (aktErr || !akt) {
      return new Response(JSON.stringify({ error: "Møte ikke funnet" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (akt.type !== "Møte" || !akt.moetenotater?.trim()) {
      return new Response(JSON.stringify({ error: "Aktiviteten er ikke et møte med notater" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bruk cached forslag hvis ikke force
    if (!force && akt.ai_oppsummering && typeof akt.ai_oppsummering === "object") {
      const cached = akt.ai_oppsummering as any;
      if (cached.foreslatt_oppgave) {
        return new Response(JSON.stringify({ ok: true, suggestion: cached, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Bygg kontekst
    let dealLine = "";
    if (akt.salgsmulighet_id) {
      const { data: sm } = await supabase
        .from("salgsmuligheter")
        .select("navn, status, neste_steg, valgt_pakke, forventet_mrr")
        .eq("id", akt.salgsmulighet_id).maybeSingle();
      if (sm) {
        dealLine = `Deal: ${sm.navn} (status: ${sm.status}, MRR: ${sm.forventet_mrr || 0}, pakke: ${sm.valgt_pakke || "-"})\nForrige neste steg: ${sm.neste_steg || "-"}`;
      }
    }
    let firmaLine = "";
    if (akt.selskap_id) {
      const { data: s } = await supabase
        .from("selskaper").select("firmanavn, bransje").eq("id", akt.selskap_id).maybeSingle();
      if (s) firmaLine = `Selskap: ${s.firmanavn} (${s.bransje || "ukjent bransje"})`;
    }

    // Strip transcript-del
    const TRANSCRIPT_MARKER = "---\n**Transkripsjon:**";
    const notesMain = akt.moetenotater.includes(TRANSCRIPT_MARKER)
      ? akt.moetenotater.split(TRANSCRIPT_MARKER)[0].trim()
      : akt.moetenotater.trim();

    const ctx = [
      firmaLine,
      dealLine,
      `Møtetittel: ${akt.tittel || "Møte"}`,
      `Møtedato: ${akt.dato?.slice(0, 10) || "-"}`,
      `\n--- MØTENOTATER ---\n${notesMain.slice(0, 6000)}`,
    ].filter(Boolean).join("\n");

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
            content: "Du er en salgsrådgiver for et norsk B2B SaaS-selskap (Snakk.ai – AI-plattform for kundeservice). Basert på møtenotater, generer kort sammendrag og foreslå én konkret oppfølgingsoppgave for selger. Vær spesifikk og handlingsrettet. Svar alltid på norsk (bokmål)."
          },
          { role: "user", content: ctx }
        ],
        temperature: 0,
        tools: [{
          type: "function",
          function: {
            name: "followup_suggest",
            description: "Strukturert oppfølgingsforslag etter møte",
            parameters: {
              type: "object",
              properties: {
                sammendrag: { type: "string", description: "1-2 setninger om hva som ble snakket om" },
                hovedpunkter: {
                  type: "array",
                  items: { type: "string" },
                  description: "3-5 korte stikkord/temaer fra møtet"
                },
                kundesignal: { type: "string", enum: ["Høy", "Medium", "Lav", "Ukjent"] },
                foreslatt_oppgave: {
                  type: "object",
                  properties: {
                    tittel: { type: "string", description: "Konkret oppgavetittel, maks 120 tegn (f.eks. 'Send demo-tilbud til Hauk basert på Strayes use case')" },
                    frist_dager: { type: "integer", description: "Antall virkedager til frist (1-14)" },
                    prioritet: { type: "string", enum: ["Lav", "Medium", "Høy"] }
                  },
                  required: ["tittel", "frist_dager", "prioritet"],
                  additionalProperties: false
                }
              },
              required: ["sammendrag", "hovedpunkter", "kundesignal", "foreslatt_oppgave"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "followup_suggest" } }
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
      return new Response(JSON.stringify({ error: "Ingen forslag returnert" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const suggestion: FollowupSuggestion = {
      ...parsed,
      generert_dato: new Date().toISOString(),
    };

    // Lagre i ai_oppsummering på aktiviteten
    await supabase
      .from("aktiviteter")
      .update({ ai_oppsummering: suggestion as any })
      .eq("id", aktivitet_id);

    return new Response(JSON.stringify({ ok: true, suggestion, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meeting-followup-suggest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Ukjent feil" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
