import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { meetingNotes, meetingTitle, dealName, companyName } = await req.json();

    if (!meetingNotes || typeof meetingNotes !== "string" || meetingNotes.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "Møtenotater må være minst 10 tegn." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const contextParts: string[] = [];
    if (dealName) contextParts.push(`Deal: ${dealName}`);
    if (companyName) contextParts.push(`Selskap: ${companyName}`);
    if (meetingTitle) contextParts.push(`Møtetittel: ${meetingTitle}`);
    const contextStr = contextParts.length > 0 ? `\nKontekst:\n${contextParts.join("\n")}\n` : "";

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
            content: `Du er en salgs-AI-assistent for et norsk CRM-system (Snakk CRM). Analyser møtenotater og gi en kort oppsummering og foreslå konkrete neste steg.

Svar alltid på norsk. Vær konkret og handlingsorientert. Formater svaret slik:

**Oppsummering:**
(2-3 setninger som oppsummerer det viktigste fra møtet)

**Foreslåtte neste steg:**
1. (konkret handling med tidsperspektiv)
2. (konkret handling)
3. (eventuelt flere)

**Kundesignal:**
(kort vurdering av kundens interesse/status basert på notater, f.eks. "Høy interesse", "Avventende", "Behov for mer info")`
          },
          {
            role: "user",
            content: `${contextStr}\nMøtenotater:\n${meetingNotes}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "meeting_summary",
              description: "Return structured meeting summary with next steps",
              parameters: {
                type: "object",
                properties: {
                  oppsummering: { type: "string", description: "2-3 sentence summary of the meeting" },
                  neste_steg: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of concrete next steps"
                  },
                  kundesignal: { type: "string", description: "Assessment of customer interest level" },
                  foreslatt_neste_steg_tekst: { type: "string", description: "Single short sentence for the 'neste steg' field in the CRM deal" }
                },
                required: ["oppsummering", "neste_steg", "kundesignal", "foreslatt_neste_steg_tekst"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "meeting_summary" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "For mange forespørsler. Prøv igjen om litt." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI-kreditter brukt opp. Legg til mer i innstillinger." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI-feil. Prøv igjen." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: return raw content
    const content = data.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ oppsummering: content, neste_steg: [], kundesignal: "", foreslatt_neste_steg_tekst: "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meeting-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Ukjent feil" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
