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
    // Midlertidig: logg hele payloaden for å kartlegge Trale-felter
    console.log("Trale webhook RAW payload keys:", JSON.stringify(Object.keys(body)));
    console.log("Trale webhook FULL payload:", JSON.stringify(body, null, 2));
    const { event, meeting, attendees, summary, transcript } = body;

    if (event !== "meeting.completed") {
      return new Response(JSON.stringify({ received: true, skipped: true, reason: "Not meeting.completed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!meeting || !attendees) {
      return new Response(JSON.stringify({ received: true, warning: "Missing meeting or attendees data" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 0. Duplikatsjekk — skip hvis møtet allerede er lagret
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
          received: true,
          skipped: true,
          reason: "Duplicate meeting (ekstern_id already exists)",
          existing_activity_id: existing.id,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Build transcript text
    const transcriptText = Array.isArray(transcript)
      ? transcript.map((t: any) => `[${t.speaker}]: ${t.text}`).join("\n")
      : "";

    const meetingNotes = [
      summary || "",
      transcriptText ? `\n---\n**Transkripsjon:**\n${transcriptText}` : "",
    ].filter(Boolean).join("\n");

    // Extract attendee emails
    const attendeeEmails: string[] = (attendees || [])
      .map((a: any) => a.email?.toLowerCase())
      .filter(Boolean);

    // Find matching kontakter by email
    let matchedKontakter: any[] = [];
    if (attendeeEmails.length > 0) {
      const { data: kontakter } = await supabase
        .from("kontakter")
        .select("id, navn, e_post, selskap_id, linkedin")
        .in("e_post", attendeeEmails);
      matchedKontakter = kontakter || [];
    }

    // 1. LinkedIn-berikelse — oppdater kontakter med LinkedIn-URL fra Trale
    const linkedinUpdates: string[] = [];
    for (const attendee of (attendees || [])) {
      const linkedinUrl = attendee.linkedinUrl || attendee.linkedin_url || attendee.linkedin;
      if (!linkedinUrl || !attendee.email) continue;

      const matchedKontakt = matchedKontakter.find(
        k => k.e_post?.toLowerCase() === attendee.email.toLowerCase()
      );

      if (matchedKontakt && !matchedKontakt.linkedin) {
        await supabase
          .from("kontakter")
          .update({ linkedin: linkedinUrl })
          .eq("id", matchedKontakt.id);
        linkedinUpdates.push(`${matchedKontakt.navn}: ${linkedinUrl}`);
      }
    }

    // Find matching salgsmuligheter by email or kontakt
    let matchedSm: any = null;
    if (attendeeEmails.length > 0) {
      const { data: smByEmail } = await supabase
        .from("salgsmuligheter")
        .select("id, navn, ansvarlig, selskap_id, kontakt_id, neste_steg")
        .in("e_post", attendeeEmails)
        .not("status", "in", '("Vunnet","Tapt")')
        .order("updated_at", { ascending: false })
        .limit(1);
      if (smByEmail && smByEmail.length > 0) {
        matchedSm = smByEmail[0];
      }
    }

    // Fallback: match via kontakt_id
    if (!matchedSm && matchedKontakter.length > 0) {
      const kontaktIds = matchedKontakter.map(k => k.id);
      const { data: smByKontakt } = await supabase
        .from("salgsmuligheter")
        .select("id, navn, ansvarlig, selskap_id, kontakt_id, neste_steg")
        .in("kontakt_id", kontaktIds)
        .not("status", "in", '("Vunnet","Tapt")')
        .order("updated_at", { ascending: false })
        .limit(1);
      if (smByKontakt && smByKontakt.length > 0) {
        matchedSm = smByKontakt[0];
      }
    }

    const selskapId = matchedSm?.selskap_id
      || (matchedKontakter.length > 0 ? matchedKontakter[0].selskap_id : null);

    const kontaktId = matchedSm?.kontakt_id
      || (matchedKontakter.length > 0 ? matchedKontakter[0].id : null);

    const today = new Date().toISOString();
    const todayDate = today.split("T")[0];

    // 2. Create aktivitet (Møte)
    const aktivitetData: any = {
      type: "Møte",
      tittel: meeting.name || "Trale-møte",
      beskrivelse: `Deltakere: ${(attendees || []).map((a: any) => `${a.name} (${a.email})`).join(", ")}`,
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

    // 3. AI neste steg + auto-oppgave
    let aiNesteSteg: string | null = null;

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
      if (aiNesteSteg) {
        updateData.neste_steg = aiNesteSteg;
      }

      await supabase
        .from("salgsmuligheter")
        .update(updateData)
        .eq("id", matchedSm.id);

      // Append meeting note to salgsmulighet
      const notePrefix = `\n\n---\n📝 Trale møtenotat (${todayDate}):\n`;
      const { data: currentSm } = await supabase
        .from("salgsmuligheter")
        .select("notater")
        .eq("id", matchedSm.id)
        .single();

      await supabase
        .from("salgsmuligheter")
        .update({
          notater: (currentSm?.notater || "") + notePrefix + (summary || ""),
        })
        .eq("id", matchedSm.id);
    }

    // 4. Auto-oppgave fra AI neste steg
    let createdTaskId: string | null = null;
    if (aiNesteSteg && matchedSm) {
      // Finn user_id for ansvarlig
      let ansvarligUserId: string | null = null;
      if (matchedSm.ansvarlig) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("display_name", matchedSm.ansvarlig)
          .maybeSingle();
        ansvarligUserId = profile?.user_id || null;
      }

      // Sett frist til 2 virkedager frem
      const frist = new Date();
      let daysAdded = 0;
      while (daysAdded < 2) {
        frist.setDate(frist.getDate() + 1);
        const day = frist.getDay();
        if (day !== 0 && day !== 6) daysAdded++;
      }

      const { data: task } = await supabase
        .from("oppgaver")
        .insert({
          oppgave: aiNesteSteg,
          ansvarlig: matchedSm.ansvarlig || null,
          user_id: ansvarligUserId,
          salgsmulighet_id: matchedSm.id,
          selskap_id: selskapId,
          kontakt_id: kontaktId,
          frist: frist.toISOString().split("T")[0],
          prioritet: "Høy",
          status: "Åpen",
          notater: `Automatisk opprettet fra Trale-møte: ${meeting.name || "Møte"}`,
        })
        .select("id")
        .single();

      createdTaskId = task?.id || null;
    }

    // 5. Notify responsible user
    if (matchedSm?.ansvarlig) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("display_name", matchedSm.ansvarlig)
        .maybeSingle();

      if (profile?.user_id) {
        await supabase.from("varsler").insert({
          user_id: profile.user_id,
          type: "trale_meeting",
          tittel: `Møtenotat fra Trale: ${meeting.name || "Møte"}`,
          beskrivelse: aiNesteSteg
            ? `Foreslått neste steg: ${aiNesteSteg}`
            : `Møtesammendrag er lagret for ${matchedSm.navn}`,
          lenke: `/salgsmuligheter?id=${matchedSm.id}`,
        });
      }
    }

    // Update selskap sist_aktivitet
    if (selskapId) {
      await supabase
        .from("selskaper")
        .update({ sist_aktivitet: todayDate })
        .eq("id", selskapId);
    }

    console.log("Trale webhook processed:", {
      meetingName: meeting.name,
      matchedSm: matchedSm?.navn || "none",
      kontaktMatches: matchedKontakter.length,
      aiNesteSteg,
      activityId: createdActivity?.id,
      taskId: createdTaskId,
      linkedinUpdates: linkedinUpdates.length,
    });

    return new Response(JSON.stringify({
      received: true,
      activity_id: createdActivity?.id,
      matched_deal: matchedSm?.navn || null,
      matched_contacts: matchedKontakter.length,
      ai_neste_steg: aiNesteSteg,
      task_id: createdTaskId,
      linkedin_updates: linkedinUpdates.length,
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
