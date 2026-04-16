import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature",
};

async function verifySignature(body: string, signatureHeader: string | null, secret: string | null): Promise<boolean> {
  if (!secret || !signatureHeader) return true;
  const expectedSig = signatureHeader.replace("sha256=", "");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hexSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hexSig === expectedSig;
}

/** Extract action items from Trale summary markdown */
function extractActionItems(summary: string): string[] {
  const items: string[] = [];
  const lines = summary.split("\n");
  let inActionSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // Detect action/tiltak section headers
    if (/^#{1,4}\s*(tiltak|action|oppfølging|neste steg|to.do)/i.test(trimmed)) {
      inActionSection = true;
      continue;
    }
    // New header = end of action section
    if (inActionSection && /^#{1,4}\s/.test(trimmed) && !/tiltak|action/i.test(trimmed)) {
      inActionSection = false;
      continue;
    }
    // Collect bullet items in action section
    if (inActionSection && /^[-*]\s+/.test(trimmed)) {
      const item = trimmed.replace(/^[-*]\s+/, "").trim();
      if (item.length > 5 && item.length < 200) {
        items.push(item);
      }
    }
  }
  return items;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "active", service: "trale-webhook" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();

  try {
    // Verify signature
    const webhookSecret = Deno.env.get("TRALE_WEBHOOK_SECRET");
    const signatureHeader = req.headers.get("x-signature");

    if (webhookSecret && !await verifySignature(rawBody, signatureHeader, webhookSecret)) {
      console.error("Trale webhook: Signature verification failed");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = JSON.parse(rawBody);
    console.log("Trale webhook payload keys:", JSON.stringify(Object.keys(body)));

    const { event, meeting, attendees, summary, transcript } = body;

    if (event !== "meeting.completed") {
      return new Response(JSON.stringify({ received: true, skipped: true, reason: "Not meeting.completed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!meeting) {
      return new Response(JSON.stringify({ received: true, warning: "Missing meeting data" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 0. Duplikatsjekk
    if (meeting.id) {
      const { data: existing } = await supabase
        .from("aktiviteter")
        .select("id")
        .eq("ekstern_id", meeting.id)
        .eq("ekstern_provider", "trale")
        .maybeSingle();

      if (existing) {
        console.log("Trale webhook: Duplicate meeting skipped:", meeting.id);
        return new Response(JSON.stringify({
          received: true, skipped: true,
          reason: "Duplicate meeting", existing_activity_id: existing.id,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Build transcript text
    const transcriptText = Array.isArray(transcript) && transcript.length > 0
      ? transcript.map((t: any) => `[${t.speaker || "Ukjent"}] (${t.timestamp || ""}): ${t.text}`).join("\n")
      : "";

    const meetingNotes = [
      summary || "",
      transcriptText ? `\n\n---\n**Transkripsjon:**\n${transcriptText}` : "",
    ].filter(Boolean).join("");

    // Extract attendee emails
    const attendeeEmails: string[] = (attendees || [])
      .map((a: any) => (a.email || "").toLowerCase())
      .filter((e: string) => e.length > 0);

    // Find matching kontakter by email
    let matchedKontakter: any[] = [];
    if (attendeeEmails.length > 0) {
      const { data: kontakter } = await supabase
        .from("kontakter")
        .select("id, navn, e_post, selskap_id, linkedin")
        .in("e_post", attendeeEmails);
      matchedKontakter = kontakter || [];
    }

    // 1. LinkedIn-berikelse
    const linkedinUpdates: string[] = [];
    for (const attendee of (attendees || [])) {
      const linkedinUrl = attendee.linkedinUrl || attendee.linkedin_url || attendee.linkedin;
      if (!linkedinUrl || !attendee.email) continue;
      const matchedKontakt = matchedKontakter.find(
        (k: any) => k.e_post?.toLowerCase() === attendee.email.toLowerCase()
      );
      if (matchedKontakt && !matchedKontakt.linkedin) {
        await supabase.from("kontakter").update({ linkedin: linkedinUrl }).eq("id", matchedKontakt.id);
        linkedinUpdates.push(`${matchedKontakt.navn}: ${linkedinUrl}`);
      }
    }

    // 2. Match salgsmulighet — first via email
    let matchedSm: any = null;
    if (attendeeEmails.length > 0) {
      const { data: smByEmail } = await supabase
        .from("salgsmuligheter")
        .select("id, navn, ansvarlig, selskap_id, kontakt_id, neste_steg")
        .in("e_post", attendeeEmails)
        .not("status", "in", '("Vunnet","Tapt")')
        .order("updated_at", { ascending: false })
        .limit(1);
      if (smByEmail && smByEmail.length > 0) matchedSm = smByEmail[0];
    }

    // Fallback: match via kontakt_id
    if (!matchedSm && matchedKontakter.length > 0) {
      const kontaktIds = matchedKontakter.map((k: any) => k.id);
      const { data: smByKontakt } = await supabase
        .from("salgsmuligheter")
        .select("id, navn, ansvarlig, selskap_id, kontakt_id, neste_steg")
        .in("kontakt_id", kontaktIds)
        .not("status", "in", '("Vunnet","Tapt")')
        .order("updated_at", { ascending: false })
        .limit(1);
      if (smByKontakt && smByKontakt.length > 0) matchedSm = smByKontakt[0];
    }

    // 3. NEW: Match via meetingUrl against Google Calendar events
    let calendarMatch: any = null;
    const meetingUrl = meeting.meetingUrl || meeting.meeting_url;
    if (!matchedSm && meetingUrl) {
      // Search for Google Calendar events that contain this meeting URL
      const { data: calEvents } = await supabase
        .from("aktiviteter")
        .select("id, salgsmulighet_id, selskap_id, kontakt_id, tittel")
        .eq("ekstern_provider", "google_calendar")
        .ilike("beskrivelse", `%${meetingUrl}%`)
        .order("dato", { ascending: false })
        .limit(1);

      if (calEvents && calEvents.length > 0) {
        calendarMatch = calEvents[0];
        console.log("Trale webhook: Matched via meetingUrl to calendar event:", calendarMatch.id, calendarMatch.tittel);

        // If calendar event has a linked salgsmulighet, use it
        if (calendarMatch.salgsmulighet_id) {
          const { data: sm } = await supabase
            .from("salgsmuligheter")
            .select("id, navn, ansvarlig, selskap_id, kontakt_id, neste_steg")
            .eq("id", calendarMatch.salgsmulighet_id)
            .maybeSingle();
          if (sm) matchedSm = sm;
        }
      }
    }

    // Determine selskap & kontakt from best available source
    const selskapId = matchedSm?.selskap_id
      || calendarMatch?.selskap_id
      || (matchedKontakter.length > 0 ? matchedKontakter[0].selskap_id : null);

    const kontaktId = matchedSm?.kontakt_id
      || calendarMatch?.kontakt_id
      || (matchedKontakter.length > 0 ? matchedKontakter[0].id : null);

    const today = new Date().toISOString();
    const todayDate = today.split("T")[0];

    // Build attendee description (handle null names)
    const attendeeDesc = (attendees || [])
      .map((a: any) => {
        const name = a.name || a.email || "Ukjent";
        return a.email ? `${name} (${a.email})` : name;
      })
      .join(", ");

    // 4. Create aktivitet (Møte)
    const aktivitetData: any = {
      type: "Møte",
      tittel: meeting.name || meeting.title || "Trale-møte",
      beskrivelse: `Deltakere: ${attendeeDesc}`,
      moetenotater: meetingNotes,
      dato: meeting.createdAt || today,
      start_tid: meeting.createdAt || null,
      slutt_tid: meeting.duration
        ? new Date(new Date(meeting.createdAt || today).getTime() + meeting.duration * 1000).toISOString()
        : null,
      aktivitet_kilde: "trale",
      ekstern_id: meeting.id || null,
      ekstern_provider: "trale",
      salgsmulighet_id: matchedSm?.id || null,
      selskap_id: selskapId,
      kontakt_id: kontaktId,
    };

    const { data: createdActivity, error: activityError } = await supabase
      .from("aktiviteter")
      .insert(aktivitetData)
      .select("id")
      .single();

    if (activityError) {
      console.error("Trale webhook: Error creating activity:", activityError);
    }

    // 5. AI neste steg + action items
    let aiNesteSteg: string | null = null;
    const actionItems = summary ? extractActionItems(summary) : [];

    if (matchedSm && summary) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        try {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                  content: "Du er en salgsrådgiver for et norsk SaaS-selskap. Basert på et møtesammendrag, foreslå ett konkret og handlingsrettet neste steg. Svar med kun én setning på norsk, maks 100 tegn. Ikke bruk anførselstegn."
                },
                {
                  role: "user",
                  content: `Møtesammendrag:\n${summary}\n\nForeslå neste steg:`
                }
              ],
              temperature: 0,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            aiNesteSteg = aiData.choices?.[0]?.message?.content?.trim() || null;
          }
        } catch (aiErr) {
          console.error("Trale webhook: AI neste steg failed:", aiErr);
        }
      }

      // Update salgsmulighet
      const updateData: any = { sist_aktivitet: todayDate };
      if (aiNesteSteg) updateData.neste_steg = aiNesteSteg;
      await supabase.from("salgsmuligheter").update(updateData).eq("id", matchedSm.id);

      // Append meeting note to salgsmulighet
      const notePrefix = `\n\n---\n📝 Trale møtenotat (${todayDate}):\n`;
      const { data: currentSm } = await supabase
        .from("salgsmuligheter").select("notater").eq("id", matchedSm.id).single();
      await supabase.from("salgsmuligheter").update({
        notater: (currentSm?.notater || "") + notePrefix + (summary || ""),
      }).eq("id", matchedSm.id);
    }

    // 6. Auto-oppgaver fra action items (eller AI neste steg)
    const createdTaskIds: string[] = [];
    const ansvarligName = matchedSm?.ansvarlig || null;
    let ansvarligUserId: string | null = null;

    if (ansvarligName) {
      const { data: profile } = await supabase
        .from("profiles").select("user_id").eq("display_name", ansvarligName).maybeSingle();
      ansvarligUserId = profile?.user_id || null;
    }

    // Calculate deadline: 2 business days
    const frist = new Date();
    let daysAdded = 0;
    while (daysAdded < 2) {
      frist.setDate(frist.getDate() + 1);
      const day = frist.getDay();
      if (day !== 0 && day !== 6) daysAdded++;
    }
    const fristStr = frist.toISOString().split("T")[0];

    if (actionItems.length > 0 && (matchedSm || selskapId)) {
      // Create tasks from parsed action items
      for (const item of actionItems.slice(0, 5)) { // Max 5 tasks
        const { data: task } = await supabase
          .from("oppgaver")
          .insert({
            oppgave: item,
            ansvarlig: ansvarligName,
            user_id: ansvarligUserId,
            salgsmulighet_id: matchedSm?.id || null,
            selskap_id: selskapId,
            kontakt_id: kontaktId,
            frist: fristStr,
            prioritet: "Høy",
            status: "Åpen",
            notater: `Automatisk fra Trale-møte: ${meeting.name || meeting.title || "Møte"}`,
          })
          .select("id")
          .single();
        if (task?.id) createdTaskIds.push(task.id);
      }
    } else if (aiNesteSteg && matchedSm) {
      // Fallback: single task from AI suggestion
      const { data: task } = await supabase
        .from("oppgaver")
        .insert({
          oppgave: aiNesteSteg,
          ansvarlig: ansvarligName,
          user_id: ansvarligUserId,
          salgsmulighet_id: matchedSm.id,
          selskap_id: selskapId,
          kontakt_id: kontaktId,
          frist: fristStr,
          prioritet: "Høy",
          status: "Åpen",
          notater: `Automatisk fra Trale-møte: ${meeting.name || meeting.title || "Møte"}`,
        })
        .select("id")
        .single();
      if (task?.id) createdTaskIds.push(task.id);
    }

    // 7. Notify responsible user
    if (ansvarligUserId) {
      await supabase.from("varsler").insert({
        user_id: ansvarligUserId,
        type: "trale_meeting",
        tittel: `Møtenotat fra Trale: ${meeting.name || meeting.title || "Møte"}`,
        beskrivelse: aiNesteSteg
          ? `Foreslått neste steg: ${aiNesteSteg}`
          : `Møtesammendrag lagret${matchedSm ? ` for ${matchedSm.navn}` : ""}`,
        lenke: matchedSm ? `/salgsmuligheter?id=${matchedSm.id}` : null,
      });
    }

    // 8. Update selskap sist_aktivitet
    if (selskapId) {
      await supabase.from("selskaper").update({ sist_aktivitet: todayDate }).eq("id", selskapId);
    }

    const matchSource = matchedSm ? "email/kontakt" : calendarMatch ? "meetingUrl" : "none";

    console.log("Trale webhook processed:", {
      meetingName: meeting.name || meeting.title,
      matchedSm: matchedSm?.navn || "none",
      matchSource,
      kontaktMatches: matchedKontakter.length,
      aiNesteSteg,
      actionItemsParsed: actionItems.length,
      activityId: createdActivity?.id,
      taskIds: createdTaskIds,
      linkedinUpdates: linkedinUpdates.length,
      hasTranscript: transcriptText.length > 0,
    });

    return new Response(JSON.stringify({
      received: true,
      activity_id: createdActivity?.id,
      matched_deal: matchedSm?.namn || null,
      match_source: matchSource,
      matched_contacts: matchedKontakter.length,
      ai_neste_steg: aiNesteSteg,
      action_items_parsed: actionItems.length,
      task_ids: createdTaskIds,
      linkedin_updates: linkedinUpdates.length,
      has_transcript: transcriptText.length > 0,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Trale webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error", message: err instanceof Error ? err.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
