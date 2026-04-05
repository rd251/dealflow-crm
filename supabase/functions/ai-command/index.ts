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

    // ─── FETCH EMAIL DATA SERVER-SIDE ───
    let emailContext = "";
    const userId = context?.user_id;
    if (userId) {
      try {
        emailContext = await buildEmailContext(supabase, userId, context);
      } catch (e) {
        console.error("Error building email context:", e);
      }
    }

    // Build CRM context summary from passed data
    const systemPrompt = buildSystemPrompt(context, emailContext);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0,
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
                        auto_create: { type: "boolean", description: "Set to true when the user explicitly asks to create a task (e.g. 'opprett oppgave', 'lag oppgave', 'legg til oppgave'). The task will be created automatically without confirmation." },
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
                        auto_create: { type: "boolean", description: "Set to true when the user explicitly asks to log/register an activity (e.g. 'logg aktivitet', 'registrer samtale', 'logg at jeg ringte'). The activity will be logged automatically without confirmation." },
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
                  suggested_leads: {
                    type: "array",
                    description: "Leads to create in the CRM. Generate these when the user mentions a new potential customer, a person/company they've spoken to, received inquiry from, or wants to register. ALWAYS suggest a lead when the user describes a new contact or interaction with someone not in the CRM.",
                    items: {
                      type: "object",
                      properties: {
                        firmanavn: { type: "string", description: "Company name. If unknown, use the person's email domain or name." },
                        kontaktperson: { type: "string", description: "Contact person name" },
                        e_post: { type: "string", description: "Email address if provided" },
                        telefon: { type: "string", description: "Phone number if provided" },
                        kilde: { type: "string", enum: ["Nettside", "LinkedIn", "Partner", "Referanse", "Kald outbound", "E-post", "Telefon", "Annet"], description: "Lead source. Infer from context." },
                        notater: { type: "string", description: "Notes about the lead, including context from the conversation" },
                        use_case: { type: "string", description: "Use case if mentioned" },
                        rolle_i_firma: { type: "string", description: "Role in company if mentioned" },
                        auto_create: { type: "boolean", description: "Set to true when the user explicitly asks to register/create/add the lead (e.g. 'registrer', 'legg inn', 'opprett lead for', 'lag lead'). When true the lead will be created automatically without user confirmation." },
                      },
                      required: ["firmanavn", "kontaktperson"],
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
                  suggested_status_updates: {
                    type: "array",
                    description: "Status updates for existing deals or leads. Generate when user asks to move/update/change status of a deal or lead.",
                    items: {
                      type: "object",
                      properties: {
                        entity_type: { type: "string", enum: ["salgsmulighet", "lead"], description: "Type of entity to update" },
                        entity_id: { type: "string", description: "ID of the entity to update. MUST come from CRM context." },
                        entity_name: { type: "string", description: "Name of the entity for display" },
                        new_status: { type: "string", description: "New status value. For salgsmulighet: Ny mulighet|Møte booket|Demo gjennomført|Behov avklart|Løsning presentert|Tilbud sendt|Forhandling|Beslutning|Vunnet|Tapt. For lead: Ny|Kontaktet|Kvalifisert|Ikke aktuelt" },
                        neste_steg: { type: "string", description: "Optional next step to set" },
                        auto_apply: { type: "boolean", description: "Set true when user explicitly asks to update status. Applied automatically." },
                      },
                      required: ["entity_type", "entity_id", "entity_name", "new_status"],
                    },
                  },
                  suggested_conversions: {
                    type: "array",
                    description: "Convert leads to salgsmuligheter. Generate when user asks to convert a lead to an opportunity/deal.",
                    items: {
                      type: "object",
                      properties: {
                        lead_id: { type: "string", description: "ID of the lead to convert. MUST come from CRM context." },
                        lead_name: { type: "string", description: "Lead company name for display" },
                        navn: { type: "string", description: "Name for the new salgsmulighet" },
                        forventet_mrr: { type: "number", description: "Expected MRR if mentioned" },
                        kontaktperson: { type: "string", description: "Contact person from the lead" },
                        e_post: { type: "string", description: "Email from the lead" },
                        telefon: { type: "string", description: "Phone from the lead" },
                        use_case: { type: "string", description: "Use case from the lead" },
                        auto_apply: { type: "boolean", description: "Set true when user explicitly asks to convert. Applied automatically." },
                      },
                      required: ["lead_id", "lead_name", "navn"],
                    },
                  },
                  suggested_companies: {
                    type: "array",
                    description: "Companies to create. Generate when user asks to create/add a new company/selskap.",
                    items: {
                      type: "object",
                      properties: {
                        firmanavn: { type: "string", description: "Company name" },
                        bransje: { type: "string", description: "Industry/branch if mentioned" },
                        notater: { type: "string", description: "Notes about the company" },
                        auto_create: { type: "boolean", description: "Set true when user explicitly asks to create. Created automatically." },
                      },
                      required: ["firmanavn"],
                    },
                  },
                  suggested_contacts: {
                    type: "array",
                    description: "Contacts to create in the CRM. Generate when user asks to add/create a contact person.",
                    items: {
                      type: "object",
                      properties: {
                        navn: { type: "string", description: "Full name of the contact" },
                        e_post: { type: "string", description: "Email address if provided" },
                        telefon: { type: "string", description: "Phone number if provided" },
                        rolle: { type: "string", description: "Role/title if mentioned" },
                        selskap_id: { type: "string", description: "ID of the company to link to. MUST come from CRM context (selskaper list)." },
                        selskap_navn: { type: "string", description: "Company name for display" },
                        linkedin: { type: "string", description: "LinkedIn URL if provided" },
                        notater: { type: "string", description: "Notes about the contact" },
                        auto_create: { type: "boolean", description: "Set true when user explicitly asks to create/add a contact. Created automatically." },
                      },
                      required: ["navn"],
                    },
                  },
                  suggested_ringeliste: {
                    type: "object",
                    description: "A smart call/follow-up list to create as a ringeliste. Generate when the user asks to create a ringeliste, follow-up list, or asks about contacts that need follow-up based on email/dialog status. This creates a ringeliste folder with contacts.",
                    properties: {
                      navn: { type: "string", description: "Descriptive list name, e.g. 'Oppfølging – tilbud sendt uten svar'" },
                      segment: { type: "string", description: "Segment category: SMB, Enterprise, Kommune, Helse, Restaurant, Hotell, Annet" },
                      kanal: { type: "string", description: "Channel: Direkte, Partner, Inbound, Outbound" },
                      kilde_segment: { type: "string", description: "Source: LinkedIn, Web, Event, Telefon, E-post, Referanse, Annet" },
                      underkilde: { type: "string", description: "Sub-source free text, e.g. 'AI-generert oppfølgingsliste'" },
                      notater: { type: "string", description: "Notes explaining the list criteria and why contacts were selected" },
                      signal: { type: "string", description: "Short signal description shown to user, e.g. 'Sendt tilbud + ingen respons siste 4 dager'" },
                      kontakter: {
                        type: "array",
                        description: "Contacts to add to the list. Each must have a name.",
                        items: {
                          type: "object",
                          properties: {
                            navn: { type: "string", description: "Contact/company name" },
                            selskap: { type: "string", description: "Company name" },
                            e_post: { type: "string", description: "Email if available" },
                            telefon: { type: "string", description: "Phone if available" },
                            rolle: { type: "string", description: "Role/title" },
                            prioritet: { type: "string", enum: ["Høy", "Medium", "Lav"], description: "Priority based on dialog status" },
                            kontakt_id: { type: "string", description: "Existing kontakt ID if available" },
                            selskap_id: { type: "string", description: "Existing selskap ID if available" },
                            salgsmulighet_id: { type: "string", description: "Related salgsmulighet ID" },
                            lead_id: { type: "string", description: "Related lead ID" },
                            dialog_status: { type: "string", description: "Current dialog status for this contact, e.g. 'Ingen svar etter tilbud', 'Aktiv dialog', 'Venter på kunde'" },
                            grunn: { type: "string", description: "Why this contact is included in the list" },
                          },
                          required: ["navn", "prioritet", "dialog_status", "grunn"],
                        },
                      },
                      auto_create: { type: "boolean", description: "Set true when user explicitly asks to create the list. Created automatically." },
                    },
                    required: ["navn", "segment", "kanal", "kilde_segment", "kontakter", "signal"],
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

// ─── EMAIL CONTEXT BUILDER ───
async function buildEmailContext(supabase: any, userId: string, context: any): Promise<string> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Fetch recent email activities (sent and received via Gmail)
  const { data: emailActivities } = await supabase
    .from("aktiviteter")
    .select("id, tittel, beskrivelse, dato, type, kontakt_id, lead_id, salgsmulighet_id, selskap_id, ekstern_provider, aktivitet_kilde")
    .eq("type", "E-post")
    .gte("dato", thirtyDaysAgo.toISOString())
    .order("dato", { ascending: false })
    .limit(200);

  // Fetch email contacts with activity stats
  const { data: emailContacts } = await supabase
    .from("email_contacts")
    .select("primary_email, display_name, total_emails_sent, total_emails_received, last_contacted_at, last_activity_type, kontakt_id, lead_id, salgsmulighet_id, selskap_id")
    .eq("user_id", userId)
    .order("last_contacted_at", { ascending: false, nullsFirst: false })
    .limit(100);

  // Fetch recent meeting notes (Møte-aktiviteter med notater)
  const { data: meetingNotes } = await supabase
    .from("aktiviteter")
    .select("id, tittel, beskrivelse, moetenotater, dato, kontakt_id, lead_id, salgsmulighet_id, selskap_id")
    .eq("type", "Møte")
    .gte("dato", thirtyDaysAgo.toISOString())
    .order("dato", { ascending: false })
    .limit(50);

  let emailCtx = "";

  // ─── MEETING NOTES CONTEXT ───
  if (meetingNotes?.length) {
    emailCtx += `\n## MØTENOTATER (${meetingNotes.length} siste 30 dager)\n`;
    for (const m of meetingNotes.slice(0, 25)) {
      const noteText = m.moetenotater || m.beskrivelse || "";
      if (!noteText || noteText.length < 5) continue;
      const dateStr = new Date(m.dato).toLocaleDateString("no-NO", { day: "numeric", month: "short" });
      // Find entity name from context
      let entityInfo = "";
      if (m.salgsmulighet_id) {
        const sm = context?.salgsmuligheter?.find((s: any) => s.id === m.salgsmulighet_id);
        entityInfo = sm ? `deal: ${sm.navn}` : `salgsmulighet_id: ${m.salgsmulighet_id}`;
      }
      if (m.selskap_id) {
        const sel = context?.selskaper?.find((s: any) => s.id === m.selskap_id);
        entityInfo += entityInfo ? `, selskap: ${sel?.firmanavn || m.selskap_id}` : `selskap: ${sel?.firmanavn || m.selskap_id}`;
      }
      if (m.lead_id) {
        const lead = context?.leads?.find((l: any) => l.id === m.lead_id);
        entityInfo += entityInfo ? `, lead: ${lead?.firmanavn || m.lead_id}` : `lead: ${lead?.firmanavn || m.lead_id}`;
      }
      const snippet = noteText.substring(0, 200);
      emailCtx += `- [${dateStr}] ${m.tittel || "Møte"} (${entityInfo || "ukoblet"}) – notater: "${snippet}"\n`;
    }
    emailCtx += `\nBRUK MØTENOTATENE til å forstå hva som ble diskutert, avtalt og lovet. Før du foreslår en handling, sjekk om det allerede er avtalt noe i et nylig møte. Ikke foreslå oppfølging som motstrir det som ble avtalt i et møte.\n`;
  }

  if (!emailActivities?.length && !emailContacts?.length && !meetingNotes?.length) return "";

  if (!emailActivities?.length && !emailContacts?.length) return emailCtx;

  emailCtx += "\n## E-POSTDATA OG DIALOGSTATUS\n";

  // Build per-entity email summaries
  const entityEmailMap = new Map<string, {
    entityType: string;
    entityId: string;
    entityName: string;
    emails: Array<{ dato: string; tittel: string; retning: string; snippet: string }>;
    lastSent: string | null;
    lastReceived: string | null;
    totalSent: number;
    totalReceived: number;
  }>();

  // Helper to determine email direction
  const getDirection = (beskrivelse: string, kilde: string | null): string => {
    if (kilde === "gmail_sendt") return "sendt";
    if (beskrivelse?.includes("📤") || beskrivelse?.toLowerCase().includes("sendt")) return "sendt";
    if (beskrivelse?.includes("📥") || beskrivelse?.toLowerCase().includes("mottatt")) return "mottatt";
    return "ukjent";
  };

  // Process email activities into entity-grouped summaries
  for (const email of (emailActivities || [])) {
    const entityKeys: Array<{ type: string; id: string }> = [];
    if (email.lead_id) entityKeys.push({ type: "lead", id: email.lead_id });
    if (email.salgsmulighet_id) entityKeys.push({ type: "salgsmulighet", id: email.salgsmulighet_id });
    if (email.kontakt_id) entityKeys.push({ type: "kontakt", id: email.kontakt_id });
    if (email.selskap_id && entityKeys.length === 0) entityKeys.push({ type: "selskap", id: email.selskap_id });

    if (entityKeys.length === 0) continue;

    const direction = getDirection(email.beskrivelse, email.aktivitet_kilde);

    for (const ek of entityKeys) {
      const key = `${ek.type}:${ek.id}`;
      if (!entityEmailMap.has(key)) {
        let name = "";
        if (ek.type === "lead") {
          const lead = context?.leads?.find((l: any) => l.id === ek.id);
          name = lead?.firmanavn || lead?.kontaktperson || "";
        } else if (ek.type === "salgsmulighet") {
          const sm = context?.salgsmuligheter?.find((s: any) => s.id === ek.id);
          name = sm?.navn || "";
        } else if (ek.type === "kontakt") {
          const k = context?.kontakter?.find((c: any) => c.id === ek.id);
          name = k?.navn || "";
        }

        entityEmailMap.set(key, {
          entityType: ek.type,
          entityId: ek.id,
          entityName: name,
          emails: [],
          lastSent: null,
          lastReceived: null,
          totalSent: 0,
          totalReceived: 0,
        });
      }

      const entry = entityEmailMap.get(key)!;
      const snippet = (email.tittel || email.beskrivelse || "").substring(0, 80);
      entry.emails.push({ dato: email.dato, tittel: email.tittel || "", retning: direction, snippet });

      if (direction === "sendt") {
        entry.totalSent++;
        if (!entry.lastSent || email.dato > entry.lastSent) entry.lastSent = email.dato;
      } else if (direction === "mottatt") {
        entry.totalReceived++;
        if (!entry.lastReceived || email.dato > entry.lastReceived) entry.lastReceived = email.dato;
      }
    }
  }

  // Compute dialog status for each entity
  const hoursAgo = (dateStr: string | null) => {
    if (!dateStr) return Infinity;
    return (now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
  };

  const dialogStatuses: Array<{
    entityType: string;
    entityId: string;
    entityName: string;
    status: string;
    detail: string;
    totalSent: number;
    totalReceived: number;
    lastSentHoursAgo: number;
    lastReceivedHoursAgo: number;
  }> = [];

  for (const [_key, entry] of entityEmailMap) {
    const lastSentH = hoursAgo(entry.lastSent);
    const lastReceivedH = hoursAgo(entry.lastReceived);

    let status = "Ukjent";
    let detail = "";

    if (entry.totalSent > 0 && entry.totalReceived === 0) {
      status = "Ingen svar";
      detail = `Sendt ${entry.totalSent} e-post(er), ingen svar. Sist sendt: ${Math.round(lastSentH)}t siden`;
    } else if (entry.totalSent > 0 && entry.totalReceived > 0) {
      if (lastSentH < lastReceivedH) {
        status = "Venter på kunde";
        detail = `Vi sendte sist (${Math.round(lastSentH)}t siden). ${entry.totalSent} sendt, ${entry.totalReceived} mottatt`;
      } else {
        if (lastReceivedH < 72) {
          status = "Aktiv dialog";
          detail = `Kunde svarte sist (${Math.round(lastReceivedH)}t siden). ${entry.totalSent} sendt, ${entry.totalReceived} mottatt`;
        } else {
          status = "Venter på oss";
          detail = `Kunde svarte for ${Math.round(lastReceivedH)}t siden – vi bør følge opp`;
        }
      }
    } else if (entry.totalReceived > 0 && entry.totalSent === 0) {
      status = "Innkommende – ikke besvart";
      detail = `Mottatt ${entry.totalReceived} e-post(er), vi har ikke svart`;
    }

    // Check for "tilbud sendt" pattern
    const salgsmulighet = entry.entityType === "salgsmulighet"
      ? context?.salgsmuligheter?.find((s: any) => s.id === entry.entityId)
      : null;
    if (salgsmulighet?.status === "Tilbud sendt" && status === "Ingen svar") {
      status = "Tilbud sendt uten svar";
      detail = `Tilbud sendt, ingen respons etter ${Math.round(lastSentH)}t`;
    } else if (salgsmulighet?.status === "Tilbud sendt" && status === "Venter på kunde") {
      status = "Tilbud sendt – venter på kunde";
    }

    dialogStatuses.push({
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityName: entry.entityName,
      status,
      detail,
      totalSent: entry.totalSent,
      totalReceived: entry.totalReceived,
      lastSentHoursAgo: Math.round(lastSentH),
      lastReceivedHoursAgo: Math.round(lastReceivedH),
    });
  }

  // Sort: most urgent first
  const statusPriority: Record<string, number> = {
    "Tilbud sendt uten svar": 1,
    "Innkommende – ikke besvart": 2,
    "Venter på oss": 3,
    "Ingen svar": 4,
    "Aktiv dialog": 5,
    "Tilbud sendt – venter på kunde": 6,
    "Venter på kunde": 7,
    "Ukjent": 8,
  };
  dialogStatuses.sort((a, b) => (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99));

  if (dialogStatuses.length > 0) {
    emailCtx += `\n### Dialogstatuser (${dialogStatuses.length} entiteter med e-posthistorikk):\n`;
    for (const ds of dialogStatuses.slice(0, 40)) {
      emailCtx += `- [${ds.status}] ${ds.entityName || ds.entityId} (${ds.entityType}) – ${ds.detail} – id: ${ds.entityId}\n`;
    }
  }

  // Add email contact stats for unlinked contacts
  if (emailContacts?.length) {
    const unlinked = emailContacts.filter((ec: any) => !ec.kontakt_id && !ec.lead_id && !ec.salgsmulighet_id);
    if (unlinked.length > 0) {
      emailCtx += `\n### Ukoblede e-postkontakter (${unlinked.length}):\n`;
      for (const ec of unlinked.slice(0, 15)) {
        emailCtx += `- ${ec.display_name} (${ec.primary_email}) – sendt: ${ec.total_emails_sent}, mottatt: ${ec.total_emails_received} – sist: ${ec.last_contacted_at || "—"}\n`;
      }
    }
  }

  return emailCtx;
}

function buildSystemPrompt(context: any, emailContext: string): string {
  const today = new Date().toISOString().split("T")[0];
  const dayOfWeek = new Date().toLocaleDateString("no-NO", { weekday: "long" });

  let prompt = `Du er en AI-assistent for et CRM-system kalt Snakk. Du svarer alltid på norsk.
Dagens dato er ${today} (${dayOfWeek}).

REGLER:
- Prioriter alltid høy-verdi deals først
- Prioriter alltid entiteter med manglende/gammel aktivitet
- Aldri foreslå handlinger på ferdige deals (Vunnet/Tapt)
- VIKTIG: Sjekk ALLTID møtenotatene FØR du foreslår en handling. Hvis et møte nylig diskuterte neste steg, bruk det som grunnlag. Ikke foreslå noe som motstrider det som ble avtalt i et møte.
- Hvis møtenotater viser at noe ble avtalt (f.eks. "kunden skal sende tilbakemelding innen fredag"), ikke foreslå oppfølging før den avtalte fristen er passert.
- Når du foreslår oppgaver, sett alltid realistiske frister (i dag eller innen noen dager)
- Sett auto_create=true på oppgaver når brukeren eksplisitt ber om å opprette/lage en oppgave (f.eks. "opprett oppgave", "lag oppgave", "legg til oppgave"). Da opprettes oppgaven automatisk uten bekreftelse.
- Når brukeren nevner samtaler, møter, e-poster eller andre interaksjoner, foreslå å logge disse som aktiviteter
- Sett auto_create=true på aktiviteter når brukeren eksplisitt ber om å logge/registrere en aktivitet (f.eks. "logg at jeg ringte", "registrer samtale med", "logg møte med"). Da logges aktiviteten automatisk uten bekreftelse.
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

UKESRAPPORT REGLER:
- Når brukeren ber om "Ukesrapport" eller "oppsummer uken", gi en strukturert oppsummering av aktiviteter, lukkede deals, nye leads, oppgaver fullført, og hva som bør prioriteres neste uke
- Bruk markdown med overskrifter og punktlister
- Inkluder nøkkeltall (antall aktiviteter, nye leads, deals vunnet/tapt, oppgaver fullført)

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

LEAD-OPPRETTING REGLER:
- Når brukeren nevner en ny person, selskap eller henvendelse som IKKE finnes i CRM-konteksten, ALLTID generer et suggested_leads-objekt
- Sjekk alltid om personen/selskapet allerede finnes som lead, kontakt eller selskap i konteksten under
- Ikke opprett leads for folk som allerede er i systemet
- Utled kilde fra kontekst: e-post → "E-post", telefon → "Telefon", LinkedIn → "LinkedIn", nettskjema → "Nettside"
- Inkluder relevant kontekst fra samtalen i notater-feltet
- Bruk firmanavn fra konteksten, eller utled fra e-postdomene (f.eks. daniel@straye.no → "Straye" eller "straye.no")
- Sett auto_create=true når brukeren eksplisitt ber om å registrere/opprette/legge inn et lead (f.eks. "registrer", "legg inn", "opprett lead for", "lag lead"). Da opprettes leadet automatisk uten bekreftelse.

STATUSOPPDATERING REGLER:
- Når brukeren ber om å flytte/oppdatere/endre status på en deal eller et lead, generer suggested_status_updates
- Entity ID MÅ komme fra CRM-konteksten
- Sett auto_apply=true når brukeren eksplisitt ber om oppdateringen
- Gyldige statuser for salgsmulighet: Ny mulighet, Møte booket, Demo gjennomført, Behov avklart, Løsning presentert, Tilbud sendt, Forhandling, Beslutning, Vunnet, Tapt
- Gyldige statuser for lead: Ny, Kontaktet, Kvalifisert, Ikke aktuelt

KONVERTERING REGLER:
- Når brukeren ber om å konvertere et lead til salgsmulighet/deal, generer suggested_conversions
- Lead ID MÅ komme fra CRM-konteksten
- Overfør kontaktperson, e-post, telefon og use_case fra leadet
- Sett auto_apply=true når brukeren eksplisitt ber om konverteringen

SELSKAPSOPPRETTING REGLER:
- Når brukeren ber om å opprette/lage et selskap, generer suggested_companies
- Sjekk at selskapet ikke allerede finnes i konteksten
- Sett auto_create=true når brukeren eksplisitt ber om det

KONTAKTOPPRETTING REGLER:
- Når brukeren ber om å legge til/opprette en kontaktperson, generer suggested_contacts
- Match selskapsnavnet mot selskaper i CRM-konteksten for å finne riktig selskap_id
- Sjekk at kontakten ikke allerede finnes blant kontakter i konteksten
- Sett auto_create=true når brukeren eksplisitt ber om det

RINGELISTE-OPPRETTING REGLER:
- Når brukeren ber om å lage en ringeliste, oppfølgingsliste, eller spør om kontakter som trenger oppfølging basert på e-post/dialog, generer et suggested_ringeliste-objekt
- Bruk E-POSTDATA OG DIALOGSTATUS fra konteksten for å identifisere de riktige kontaktene
- AI skal identifisere og inkludere kontakter basert på dialogstatus:
  * "Ingen svar" – vi sendte e-post men fikk aldri svar
  * "Aktiv dialog" – frem og tilbake med meldinger
  * "Venter på kunde" – vi sendte sist, venter på deres svar
  * "Venter på oss" – kunden svarte, vi har ikke fulgt opp
  * "Tilbud sendt uten svar" – tilbud sendt uten respons
  * "Innkommende – ikke besvart" – mottatt e-post vi ikke har svart på
- Gi listen et tydelig, beskrivende navn som forklarer hva den inneholder
- Inkluder signal-feltet som kort forklarer kriteriene (vises til bruker)
- Sett prioritet basert på hastegrad: Tilbud uten svar = Høy, Venter på oss = Høy, Aktiv dialog = Medium, Ingen svar = Medium/Lav
- Ikke legg til duplikater – bruk eksisterende koblinger (kontakt_id, selskap_id, salgsmulighet_id, lead_id)
- Koble e-post til riktig selskap og salgsmulighet
- Forklar i grunn-feltet HVORFOR hver kontakt er med i listen
- Sett auto_create=true når brukeren eksplisitt ber om å opprette/lage listen
- Eksempler på forespørsler som skal utløse ringeliste:
  * "Lag ringeliste for leads uten svar siste 3 dager"
  * "Opprett oppfølgingsliste for deals med tilbud sendt uten respons"
  * "Hvem bør jeg ringe i dag?"
  * "Lag liste over kontakter med aktiv dialog"
  * "Varme leads uten neste steg"
  * "Hvem venter på svar fra oss?"

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
      prompt += `- ${sm.navn} (${sm.selskapNavn || "—"}) – status: ${sm.status} – MRR: ${sm.forventet_mrr || 0} kr – neste steg: ${sm.neste_steg || "—"} – sist aktivitet: ${sm.sist_aktivitet || "aldri"} – id: ${sm.id} – selskap_id: ${sm.selskap_id || "—"} – e_post: ${sm.e_post || "—"} – kontaktperson: ${sm.kontaktperson || "—"} – telefon: ${sm.telefon || "—"}\n`;
    }
  }

  if (context?.leads?.length > 0) {
    prompt += `\n## Aktive leads (${context.leads.length}):\n`;
    for (const l of context.leads.slice(0, 15)) {
      prompt += `- ${l.firmanavn} (${l.kontaktperson || "—"}) – status: ${l.status} – sist aktivitet: ${l.sist_aktivitet || "aldri"} – e_post: ${l.e_post || "—"} – telefon: ${l.telefon || "—"} – id: ${l.id}\n`;
    }
  }

  if (context?.oppgaver?.length > 0) {
    prompt += `\n## Åpne oppgaver (${context.oppgaver.length}):\n`;
    for (const o of context.oppgaver.slice(0, 10)) {
      prompt += `- ${o.oppgave} – frist: ${o.frist || "—"} – prioritet: ${o.prioritet} – status: ${o.status} – id: ${o.id}\n`;
    }
  }

  if (context?.selskaper?.length > 0) {
    prompt += `\n## Selskaper (${context.selskaper.length}):\n`;
    for (const s of context.selskaper.slice(0, 20)) {
      prompt += `- ${s.firmanavn} – status: ${s.kundestatus} – id: ${s.id}\n`;
    }
  }

  // Append email context
  if (emailContext) {
    prompt += emailContext;
  }

  return prompt;
}
