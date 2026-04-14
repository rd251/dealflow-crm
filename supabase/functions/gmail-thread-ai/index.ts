import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function getGmailAccessToken(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("google_calendar_connections")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) throw new Error("Ingen Gmail-tilkobling funnet. Koble til Google først.");

  const expiresAt = new Date(data.token_expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) return data.access_token;

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: data.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const tokens = await res.json();
  if (!res.ok) throw new Error("Kunne ikke fornye Gmail-token");

  const newExpiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
  await supabase
    .from("google_calendar_connections")
    .update({ access_token: tokens.access_token, token_expires_at: newExpiry })
    .eq("user_id", userId);

  return tokens.access_token;
}

function decodeBody(part: any): string {
  const data = part?.body?.data;
  if (!data) return "";
  try {
    const binary = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function extractTextFromParts(parts: any[]): string {
  let text = "";
  for (const part of parts) {
    if (part.mimeType === "text/plain") {
      text += decodeBody(part) + "\n";
    } else if (part.parts) {
      text += extractTextFromParts(part.parts);
    }
  }
  return text;
}

function extractThreadMessages(thread: any): string[] {
  const msgs: string[] = [];
  for (const message of thread.messages || []) {
    const headers = message.payload?.headers || [];
    const from = headers.find((h: any) => h.name.toLowerCase() === "from")?.value || "Ukjent";
    const to = headers.find((h: any) => h.name.toLowerCase() === "to")?.value || "";
    const date = headers.find((h: any) => h.name.toLowerCase() === "date")?.value || "";
    const subject = headers.find((h: any) => h.name.toLowerCase() === "subject")?.value || "";

    let body = "";
    if (message.payload?.parts) {
      body = extractTextFromParts(message.payload.parts);
    } else {
      body = decodeBody(message.payload);
    }

    msgs.push(`Fra: ${from}\nTil: ${to}\nDato: ${date}\nEmne: ${subject}\n\n${body.trim()}`);
  }
  return msgs;
}

const PROMPTS: Record<string, (msgs: string) => string> = {
  summarize: (msgs) =>
    `Du er en CRM-assistent for et norsk SaaS-selskap. Analyser følgende e-posttråd grundig og gi en oppsummering på norsk.

Strukturér svaret slik:

**Hovedpunkter:**
- (de viktigste temaene/beslutningene i tråden)

**Status i dialogen:**
- Hvem venter på hvem? Er ballen hos oss eller kunden?
- Er det ubesvarte spørsmål?

**Kundesignal:**
- Vurder kundens interesse/hastegrad basert på tone og responstid
- Er det tegn på positivt momentum, nøling eller avvisning?

**Viktige detaljer:**
- Nevnte datoer, beløp, navn eller avtaler

**Anbefalt neste handling:**
- Én konkret ting å gjøre basert på tråden

E-posttråd:
${msgs}`,

  extract: (msgs) =>
    `Du er en CRM-assistent. Analyser følgende e-posttråd og trekk ut ALL viktig forretningsinformasjon på norsk.

Returner i følgende format:

**Kontaktpersoner nevnt:**
- Navn, rolle, e-post, telefon (hvis nevnt)

**Datoer og frister:**
- Alle nevnte datoer med kontekst

**Beløp og økonomi:**
- Priser, budsjetter, MRR, kostnader nevnt

**Avtaler og beslutninger:**
- Hva er avtalt eller besluttet
- Hva er fortsatt åpent

**Tekniske krav:**
- Integrasjoner, systemer, spesifikasjoner nevnt

**Konkurrenter:**
- Andre leverandører/løsninger nevnt

**Neste steg:**
- Planlagte handlinger med dato hvis nevnt

Hvis en kategori ikke har relevant info, skriv "Ingen funnet".

E-posttråd:
${msgs}`,

  draft: (msgs) =>
    `Du er en profesjonell CRM-assistent som skriver e-poster på norsk. Basert på følgende e-posttråd, skriv et profesjonelt svar. Svaret skal:
- Være kort og presist (3-5 setninger)
- Adressere de viktigste punktene fra tråden
- Foreslå et konkret neste steg
- Ha en profesjonell men vennlig tone

Skriv KUN selve e-postteksten, ingen emne eller hilsen-forslag.

E-posttråd:
${msgs}`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { threadId, action } = await req.json();
    if (!threadId || !["summarize", "extract", "draft"].includes(action)) {
      return new Response(JSON.stringify({ error: "Ugyldig forespørsel. Krev threadId og action (summarize|extract|draft)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getGmailAccessToken(supabase, userId);

    const gmailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!gmailRes.ok) {
      const errText = await gmailRes.text();
      console.error("Gmail API error:", gmailRes.status, errText);
      return new Response(JSON.stringify({ error: "Kunne ikke hente e-posttråd fra Gmail" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const thread = await gmailRes.json();
    const messages = extractThreadMessages(thread);

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "Ingen meldinger funnet i tråden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Increase truncation limit for richer context
    const threadText = messages.join("\n---\n").substring(0, 25000);
    const prompt = PROMPTS[action](threadText);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const aiRes = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Du er en profesjonell CRM-assistent for et norsk SaaS-selskap. Svar alltid på norsk. Vær grundig og trekk ut all relevant forretningsinformasjon." },
          { role: "user", content: prompt },
        ],
        temperature: 0,
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "AI-tjenesten er midlertidig overbelastet. Prøv igjen om litt." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI-kreditter oppbrukt. Legg til mer i innstillinger." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      throw new Error("AI-analyse feilet");
    }

    const aiData = await aiRes.json();
    const result = aiData.choices?.[0]?.message?.content || "Kunne ikke generere resultat.";

    return new Response(JSON.stringify({ result, messageCount: messages.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gmail-thread-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Ukjent feil" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
