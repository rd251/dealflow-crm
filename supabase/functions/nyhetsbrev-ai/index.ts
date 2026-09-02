import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "Mangler LOVABLE_API_KEY" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "Ikke autentisert" }, 401);

    const body = await req.json().catch(() => ({}));
    const brief: string = (body.brief ?? "").toString().slice(0, 4000);
    const tone: string = (body.tone ?? "Profesjonell og vennlig").toString().slice(0, 100);
    const lengde: string = (body.lengde ?? "medium").toString();
    const bruk_crm: boolean = !!body.bruk_crm;
    const eksisterende = body.eksisterende_blokker;

    if (!brief.trim() && !bruk_crm) return json({ error: "Beskriv hva nyhetsbrevet skal handle om" }, 400);

    let crmKontekst = "";
    if (bruk_crm) {
      const now = new Date();
      const fom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const [{ data: vunnet }, { data: nyeKunder }] = await Promise.all([
        supabase
          .from("salgsmuligheter")
          .select("navn, forventet_mrr, vunnet_dato")
          .gte("vunnet_dato", fom)
          .limit(20),
        supabase
          .from("selskaper")
          .select("firmanavn, kundestatus, go_live_dato")
          .gte("go_live_dato", fom)
          .limit(20),
      ]);
      crmKontekst = `\n\nCRM-høydepunkter siste periode (bruk kun det som er relevant, ikke del sensitive tall som MRR):\n- Vunne avtaler: ${(vunnet ?? []).map((d: any) => d.navn).join(", ") || "ingen"}\n- Nye kunder live: ${(nyeKunder ?? []).map((c: any) => c.firmanavn).join(", ") || "ingen"}`;
    }

    const lengdeHint =
      lengde === "kort" ? "2–3 blokker totalt" : lengde === "lang" ? "6–8 blokker totalt" : "4–5 blokker totalt";

    const systemPrompt = `Du er en norsk e-postmarkedsfører for Snakk AI (snakk.ai) – et selskap som leverer AI-taleagenter og AI-løsninger for norske bedrifter.
Du lager innhold til nyhetsbrev som bygges av blokker.

Returner KUN gyldig JSON på dette formatet:
{
  "emne": "e-post-emne, maks 60 tegn, uten emoji-spam",
  "preheader": "forhåndsvisningstekst, maks 100 tegn",
  "blokker": [
    { "type": "header", "overskrift": "..." },
    { "type": "tekst", "tekst": "..." },
    { "type": "nyhet", "emoji": "🚀", "overskrift": "...", "tekst": "...", "lenke_url": "https://snakk.ai", "lenke_tekst": "Les mer" },
    { "type": "deler", "overskrift": "SEKSJONSNAVN" },
    { "type": "cta", "lenke_tekst": "Book en demo", "lenke_url": "https://snakk.ai" }
  ]
}

Regler:
- Alt innhold på norsk (bokmål).
- Gyldige blokktyper: header, tekst, nyhet, deler, cta. Start alltid med én header og avslutt med én cta.
- ${lengdeHint}.
- Tekst kan bruke **fet**, *kursiv* og [lenketekst](https://url). Ingen HTML.
- Tone: ${tone}.
- Vær konkret og verdiorientert, unngå tomme markedsføringsfraser.
- Ikke oppgi interne tall (MRR, priser) med mindre brukeren eksplisitt ber om det.`;

    const userPrompt = `${brief || "Lag et generelt månedlig nyhetsbrev fra Snakk AI."}${crmKontekst}${
      eksisterende ? `\n\nEksisterende utkast (forbedre/bygg videre på dette):\n${JSON.stringify(eksisterende).slice(0, 6000)}` : ""
    }`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (res.status === 429) return json({ error: "For mange forespørsler. Prøv igjen om litt." }, 429);
    if (res.status === 402) return json({ error: "AI-kreditter er brukt opp. Fyll på i Lovable." }, 402);
    if (!res.ok) {
      const t = await res.text();
      console.error("AI-feil", res.status, t);
      return json({ error: "AI-tjenesten svarte ikke som forventet." }, 502);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : null;
    }
    if (!parsed?.blokker || !Array.isArray(parsed.blokker)) {
      return json({ error: "Klarte ikke tolke AI-svaret. Prøv igjen." }, 502);
    }

    const gyldige = new Set(["header", "tekst", "nyhet", "deler", "cta"]);
    const blokker = parsed.blokker
      .filter((b: any) => b && gyldige.has(b.type))
      .slice(0, 15)
      .map((b: any) => ({
        id: crypto.randomUUID(),
        type: b.type,
        overskrift: b.overskrift ?? undefined,
        tekst: b.tekst ?? undefined,
        emoji: b.emoji ?? undefined,
        lenke_url: b.lenke_url ?? undefined,
        lenke_tekst: b.lenke_tekst ?? undefined,
      }));

    return json({
      emne: typeof parsed.emne === "string" ? parsed.emne.slice(0, 150) : "",
      preheader: typeof parsed.preheader === "string" ? parsed.preheader.slice(0, 200) : "",
      blokker,
    });
  } catch (err) {
    console.error("nyhetsbrev-ai feil:", err);
    return json({ error: "Uventet feil" }, 500);
  }
});
