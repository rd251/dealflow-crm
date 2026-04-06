import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domene, firmanavn } = await req.json();
    if (!domene && !firmanavn) {
      return new Response(JSON.stringify({ error: "domene eller firmanavn er påkrevd" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Clean domain
    let cleanDomain = (domene || "").trim().toLowerCase();
    if (cleanDomain.startsWith("http")) {
      try { cleanDomain = new URL(cleanDomain).hostname; } catch { /* keep as-is */ }
    }
    cleanDomain = cleanDomain.replace(/^www\./, "");

    // Check cache first (max 7 days old)
    if (cleanDomain) {
      const { data: cached } = await supabase
        .from("selskap_innsikt")
        .select("*")
        .eq("domene", cleanDomain)
        .single();

      if (cached) {
        const age = Date.now() - new Date(cached.updated_at).getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (age < sevenDays) {
          return new Response(JSON.stringify({ success: true, data: cached, source: "cache" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Gather data from sources
    const kildeData: Record<string, unknown> = {};
    let websiteText = "";
    let websiteTitle = "";
    let websiteDescription = "";

    // 1. Scrape website
    if (cleanDomain) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`https://${cleanDomain}`, {
          signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SnakkCRM/1.0)" },
        });
        clearTimeout(timeout);
        const html = await res.text();

        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        websiteTitle = titleMatch?.[1]?.trim() || "";

        // Extract meta description
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        websiteDescription = descMatch?.[1]?.trim() || "";

        // Extract visible text (simplified)
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        if (bodyMatch) {
          websiteText = bodyMatch[1]
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 3000);
        }

        kildeData.website = { title: websiteTitle, description: websiteDescription, textLength: websiteText.length };
      } catch (e) {
        kildeData.website = { error: String(e).slice(0, 200) };
      }
    }

    // 2. Brønnøysundregistrene (brreg.no) – free API
    let brregData: any = null;
    const searchName = firmanavn || cleanDomain?.split(".")[0] || "";
    if (searchName && searchName.length >= 2) {
      try {
        const brregRes = await fetch(
          `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(searchName)}&size=3`,
          { headers: { Accept: "application/json" } }
        );
        if (brregRes.ok) {
          const brregJson = await brregRes.json();
          const enheter = brregJson?._embedded?.enheter || [];
          if (enheter.length > 0) {
            // Try to find best match
            const best = enheter.find((e: any) =>
              e.navn?.toLowerCase().includes(searchName.toLowerCase())
            ) || enheter[0];
            brregData = {
              organisasjonsnummer: best.organisasjonsnummer,
              navn: best.navn,
              naeringskode: best.naeringskode1?.beskrivelse,
              antallAnsatte: best.antallAnsatte,
              organisasjonsform: best.organisasjonsform?.beskrivelse,
              stiftelsesdato: best.stiftelsesdato,
              hjemmeside: best.hjemmeside,
            };
            kildeData.brreg = brregData;
          }
        }
      } catch (e) {
        kildeData.brreg = { error: String(e).slice(0, 200) };
      }
    }

    // 3. Use AI to analyze and enrich
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiPrompt = `Analyser følgende selskapsdata og returner et JSON-objekt.

INPUT:
- Firmanavn: ${firmanavn || "ukjent"}
- Domene: ${cleanDomain || "ukjent"}
- Nettside tittel: ${websiteTitle}
- Nettside beskrivelse: ${websiteDescription}
- Nettside tekst (utdrag): ${websiteText.slice(0, 1500)}
- Brønnøysund data: ${brregData ? JSON.stringify(brregData) : "ingen"}

RETURNER kun et JSON-objekt med disse feltene:
{
  "bransje": "bransje/industri (f.eks. Regnskap, IT, Restaurant, Helse)",
  "beskrivelse": "kort beskrivelse av hva selskapet gjør, maks 2 setninger",
  "stoerrelse": "Mikro|Liten|Mellomstor|Stor",
  "estimert_ansatte": "estimert antall ansatte som tekst, f.eks. '1-10', '10-50', '50-200', '200+'",
  "estimert_omsetning": "estimert omsetning som tekst, f.eks. '~5 MNOK', '~50 MNOK', eller 'Ukjent'"
}

Regler:
- Bruk Brønnøysund-data som primærkilde for ansatte hvis tilgjengelig
- Bruk nettside-info for bransje og beskrivelse
- Hvis lite data: estimer størrelse basert på domene-kvalitet og merkevare
- Mikro = 1-10 ansatte, Liten = 10-50, Mellomstor = 50-250, Stor = 250+
- Svar KUN med JSON, ingen tekst rundt`;

    const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.1,
        messages: [{ role: "user", content: aiPrompt }],
      }),
    });

    let enriched: any = {};
    if (aiRes.ok) {
      const aiJson = await aiRes.json();
      const content = aiJson.choices?.[0]?.message?.content || "";
      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          enriched = JSON.parse(jsonMatch[0]);
        } catch {
          enriched = {};
        }
      }
    }

    // Build result
    const result = {
      domene: cleanDomain,
      firmanavn: firmanavn || brregData?.navn || websiteTitle || "",
      bransje: enriched.bransje || brregData?.naeringskode || null,
      beskrivelse: enriched.beskrivelse || websiteDescription || null,
      stoerrelse: enriched.stoerrelse || null,
      estimert_ansatte: enriched.estimert_ansatte || (brregData?.antallAnsatte != null ? String(brregData.antallAnsatte) : null),
      estimert_omsetning: enriched.estimert_omsetning || null,
      orgnr: brregData?.organisasjonsnummer || null,
      kilde_data: kildeData,
    };

    // Upsert into cache
    if (cleanDomain) {
      await supabase.from("selskap_innsikt").upsert(
        { ...result, updated_at: new Date().toISOString() },
        { onConflict: "domene" }
      );
    }

    return new Response(JSON.stringify({ success: true, data: result, source: "enriched" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Company enrich error:", e);
    return new Response(JSON.stringify({ error: "Feil under berikelse" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
