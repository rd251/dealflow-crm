import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, context } = await req.json();
    if (!message || typeof message !== "string" || message.length > 2000) {
      return new Response(JSON.stringify({ error: "Invalid message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Build CRM context summary from passed data
    const systemPrompt = buildSystemPrompt(context);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "crm_response",
              description: "Return a structured CRM response with text, action items, suggested tasks, and optionally a meeting to create",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "A conversational summary answering the user's question in Norwegian. Use markdown formatting.",
                  },
                  items: {
                    type: "array",
                    description: "Structured list of actionable items",
                    items: {
                      type: "object",
                      properties: {
                        navn: { type: "string", description: "Name of the deal, lead, or contact" },
                        selskap: { type: "string", description: "Company name" },
                        handling: { type: "string", description: "Recommended action" },
                        prioritet: { type: "string", enum: ["høy", "medium", "lav"] },
                        type: { type: "string", enum: ["deal", "lead", "meeting", "task", "general"] },
                        entityId: { type: "string", description: "ID of the entity if available" },
                        entityType: { type: "string", enum: ["salgsmulighet", "lead", "selskap", "oppgave"] },
                      },
                      required: ["navn", "selskap", "handling", "prioritet", "type"],
                    },
                  },
                  suggested_tasks: {
                    type: "array",
                    description: "Tasks that can be created in the CRM",
                    items: {
                      type: "object",
                      properties: {
                        oppgave: { type: "string", description: "Task description" },
                        frist: { type: "string", description: "Due date in YYYY-MM-DD format" },
                        prioritet: { type: "string", enum: ["Høy", "Medium", "Lav"] },
                        salgsmulighet_id: { type: "string", description: "ID of related sales opportunity" },
                        selskap_id: { type: "string", description: "ID of related company" },
                        lead_id: { type: "string", description: "ID of related lead" },
                      },
                      required: ["oppgave", "prioritet"],
                    },
                  },
                  suggested_activities: {
                    type: "array",
                    description: "Activities that can be logged in the CRM. Suggest these when the user mentions calls, emails, meetings or other interactions they have completed or plan to do.",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["Telefonsamtale", "E-post", "LinkedIn-melding", "SMS", "Møte", "Notat"], description: "Type of activity" },
                        tittel: { type: "string", description: "Short title for the activity" },
                        beskrivelse: { type: "string", description: "Description of what happened or should be logged" },
                        salgsmulighet_id: { type: "string", description: "ID of related sales opportunity if applicable" },
                        selskap_id: { type: "string", description: "ID of related company if applicable" },
                        lead_id: { type: "string", description: "ID of related lead if applicable" },
                        kontakt_id: { type: "string", description: "ID of related contact if applicable" },
                      },
                      required: ["type", "tittel", "beskrivelse"],
                    },
                  },
                  suggested_emails: {
                    type: "array",
                    description: "Follow-up emails that can be sent via Gmail. Generate these when the user asks about follow-ups, what to do today, or asks to write emails.",
                    items: {
                      type: "object",
                      properties: {
                        to: { type: "string", description: "Recipient email address" },
                        to_name: { type: "string", description: "Recipient name for display" },
                        subject: { type: "string", description: "Email subject line in Norwegian" },
                        body: { type: "string", description: "Email body text in Norwegian. Short, natural, with clear CTA. Use newlines for paragraphs." },
                        reason: { type: "string", description: "Why this follow-up is suggested (shown to user)" },
                        entity_id: { type: "string", description: "ID of the related salgsmulighet or lead" },
                        entity_type: { type: "string", enum: ["salgsmulighet", "lead"], description: "Type of entity" },
                        entity_name: { type: "string", description: "Name of the deal or lead" },
                        selskap_id: { type: "string", description: "Company ID if available" },
                        selskap_navn: { type: "string", description: "Company name for display" },
                        kontakt_id: { type: "string", description: "Contact ID if available" },
                        prioritet: { type: "string", enum: ["høy", "medium", "lav"], description: "Priority level" },
                      },
                      required: ["to_name", "subject", "body", "reason", "prioritet"],
                    },
                  },
                  suggested_meeting: {
                    type: "object",
                    description: "A meeting to create. Generate this ONLY when the user explicitly asks to create/book/schedule a meeting. Parse natural language dates like 'i morgen', 'på fredag', 'neste uke', 'kl 12' etc. into proper ISO dates and times.",
                    properties: {
                      tittel: { type: "string", description: "Meeting title / subject" },
                      deltaker_navn: { type: "string", description: "Name of the person to meet" },
                      deltaker_epost: { type: "string", description: "Email of the person to meet, if provided" },
                      dato: { type: "string", description: "Meeting date in YYYY-MM-DD format. Parse Norwegian relative dates: 'i morgen' = tomorrow, 'på fredag' = next friday, 'neste uke' = next monday, etc." },
                      start_tid: { type: "string", description: "Start time in HH:MM format (24h). Parse 'kl 12' = 12:00, 'kl 14:30' = 14:30, etc." },
                      slutt_tid: { type: "string", description: "End time in HH:MM format (24h). Default to 30 minutes after start if not specified." },
                      beskrivelse: { type: "string", description: "Meeting description if provided" },
                      kontakt_id: { type: "string", description: "ID of existing contact if matched from CRM context" },
                      selskap_id: { type: "string", description: "ID of related company if contact is linked to a company" },
                      salgsmulighet_id: { type: "string", description: "ID of related sales opportunity if relevant" },
                    },
                    required: ["tittel", "deltaker_navn", "dato", "start_tid", "slutt_tid"],
                  },
                },
                required: ["summary", "items", "suggested_tasks", "suggested_activities", "suggested_emails"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "crm_response" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "For mange forespørsler. Prøv igjen om litt." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI-kreditter brukt opp." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI-feil. Prøv igjen." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(
          JSON.stringify({
            summary: data.choices?.[0]?.message?.content || "Beklager, noe gikk galt.",
            items: [],
            suggested_tasks: [],
            suggested_activities: [],
            suggested_emails: [],
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fallback if no tool call
    return new Response(
      JSON.stringify({
        summary: data.choices?.[0]?.message?.content || "Beklager, noe gikk galt.",
        items: [],
        suggested_tasks: [],
        suggested_activities: [],
        suggested_emails: [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-command error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Ukjent feil" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildSystemPrompt(context: any): string {
  const today = new Date().toISOString().split("T")[0];
  const dayOfWeek = new Date().toLocaleDateString("no-NO", { weekday: "long" });

  let prompt = `Du er en AI-assistent for et CRM-system kalt Snakk. Du svarer alltid på norsk.
Dagens dato er ${today} (${dayOfWeek}).

REGLER:
- Prioriter alltid høy-verdi deals først
- Prioriter alltid entiteter med manglende/gammel aktivitet
- Aldri foreslå handlinger på ferdige deals (Vunnet/Tapt)
- Når du foreslår oppgaver, sett alltid realistiske frister (i dag eller innen noen dager)
- Når brukeren nevner samtaler, møter, e-poster eller andre interaksjoner, foreslå å logge disse som aktiviteter
- Hold svarene korte og handlingsorienterte
- Bruk markdown for formatering
- Alle IDer du refererer til MÅ komme fra konteksten under

MØTEBOOKING REGLER:
- Når brukeren ber om å opprette/booke/lage et møte, generer ALLTID et suggested_meeting-objekt
- Parse norske datoer korrekt relativt til dagens dato ${today}:
  - "i morgen" = neste dag
  - "i dag" = dagens dato
  - "på mandag/tirsdag/onsdag/torsdag/fredag" = neste forekomst av den ukedagen
  - "neste uke" = neste mandag
  - "om to dager" = 2 dager fra nå
- Parse norske klokkeslett: "kl 12" = 12:00, "klokken 14:30" = 14:30
- Hvis klokkeslett mangler, IKKE generer suggested_meeting. I stedet, spør brukeren om klokkeslett i summary
- Hvis slutttid ikke er oppgitt, sett den til 30 minutter etter starttid
- Sjekk om deltakeren finnes blant kontakter i CRM-konteksten (match på navn eller e-post). Hvis ja, bruk kontakt_id og selskap_id
- Tittel: Bruk "emne" fra meldingen, eller lag en passende tittel basert på konteksten

OPPFØLGINGS-E-POST REGLER:
- Når brukeren spør "hva bør jeg gjøre i dag", "deals som trenger oppfølging", "skriv oppfølging" o.l., generer suggested_emails for de viktigste kandidatene
- E-poster skal være korte (3-5 setninger), naturlige, profesjonelle og på norsk
- Adresser mottaker ved fornavn ("Hei [Fornavn],")
- Referer naturlig til siste kontakt/møte/aktivitet
- Avslutt med et konkret forslag til neste steg (CTA)
- Bruk e-postadressen fra konteksten (e_post-feltet) som "to"-adresse
- Ikke foreslå e-post til entiteter uten e-postadresse
- Ikke foreslå oppfølging hvis nylig aktivitet (< 48 timer for leads, < 72 timer for salgsmuligheter)
- Prioriter: tilbud sendt uten svar > etter møte uten oppfølging > lang inaktivitet
- Emnelinjen skal være kort og relevant

CRM-DATA:
`;

  if (context?.kontakter?.length > 0) {
    prompt += `\n## Kontakter (${context.kontakter.length}):\n`;
    for (const k of context.kontakter.slice(0, 30)) {
      prompt += `- ${k.navn}${k.e_post ? ` (${k.e_post})` : ""}${k.selskap_id ? ` – selskap_id: ${k.selskap_id}` : ""} – id: ${k.id}\n`;
    }
  }

  if (context?.meetings?.length > 0) {
    prompt += `\n## Møter i dag (${context.meetings.length}):\n`;
    for (const m of context.meetings) {
      const tid = m.start_tid ? new Date(m.start_tid).toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" }) : "";
      prompt += `- ${tid} ${m.tittel || "Uten tittel"} (selskap: ${m.selskapNavn || "—"}, salgsmulighet_id: ${m.salgsmulighet_id || "—"})\n`;
    }
  } else {
    prompt += "\n## Ingen møter i dag\n";
  }

  if (context?.followUps?.length > 0) {
    prompt += `\n## Oppfølginger som trengs (${context.followUps.length}):\n`;
    for (const f of context.followUps.slice(0, 15)) {
      prompt += `- [${f.priority}] ${f.navn} (${f.selskapNavn}) – ${f.anbefalHandling} – ${f.hoursInactive}t inaktiv – type: ${f.entityType} – id: ${f.entityId}${f.verdi > 0 ? ` – verdi: ${f.verdi} kr` : ""}\n`;
    }
  }

  if (context?.salgsmuligheter?.length > 0) {
    prompt += `\n## Åpne salgsmuligheter (${context.salgsmuligheter.length}):\n`;
    for (const sm of context.salgsmuligheter.slice(0, 20)) {
      prompt += `- ${sm.navn} (${sm.selskapNavn || "—"}) – status: ${sm.status} – MRR: ${sm.forventet_mrr || 0} kr – neste steg: ${sm.neste_steg || "—"} – sist aktivitet: ${sm.sist_aktivitet || "aldri"} – id: ${sm.id} – selskap_id: ${sm.selskap_id || "—"}\n`;
    }
  }

  if (context?.leads?.length > 0) {
    prompt += `\n## Aktive leads (${context.leads.length}):\n`;
    for (const l of context.leads.slice(0, 15)) {
      prompt += `- ${l.firmanavn} (${l.kontaktperson || "—"}) – status: ${l.status} – sist aktivitet: ${l.sist_aktivitet || "aldri"} – id: ${l.id}\n`;
    }
  }

  if (context?.oppgaver?.length > 0) {
    prompt += `\n## Åpne oppgaver (${context.oppgaver.length}):\n`;
    for (const o of context.oppgaver.slice(0, 10)) {
      prompt += `- ${o.oppgave} – frist: ${o.frist || "—"} – prioritet: ${o.prioritet} – status: ${o.status} – id: ${o.id}\n`;
    }
  }

  return prompt;
}
