import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INTERNAL_DOMAINS = new Set<string>(["snakk.ai", "snakk.no"]);

function isInternalEmail(email?: string | null): boolean {
  if (!email) return true;
  const d = email.toLowerCase().split("@")[1] || "";
  return INTERNAL_DOMAINS.has(d);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action || "detect";

    // ── Action: auto-fix one meeting ──
    if (action === "fix" && body.aktivitet_id) {
      return await autoFixMeeting(supabase, body.aktivitet_id);
    }

    // ── Action: detect mismatches ──
    const horizonDays = body.horizon_days ?? 14;
    const sinceDays = body.since_days ?? 7;
    const fromDate = new Date(Date.now() - sinceDays * 86400000).toISOString();
    const toDate = new Date(Date.now() + horizonDays * 86400000).toISOString();

    const { data: meetings } = await supabase
      .from("aktiviteter")
      .select("id, tittel, dato, start_tid, selskap_id, salgsmulighet_id, kontakt_id, deltakere, ekstern_id, aktivitet_kilde")
      .eq("type", "Møte")
      .gte("dato", fromDate)
      .lte("dato", toDate)
      .order("dato", { ascending: true });

    if (!meetings || meetings.length === 0) {
      return new Response(JSON.stringify({ mismatches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build attendee email map for participants
    const allDeltakerIds = Array.from(new Set(meetings.flatMap((m: any) => m.deltakere || [])));
    const { data: kontakter } = allDeltakerIds.length > 0
      ? await supabase.from("kontakter").select("id, navn, e_post, selskap_id").in("id", allDeltakerIds)
      : { data: [] };
    const kontaktMap = new Map((kontakter || []).map((k: any) => [k.id, k]));

    // Selskaper map
    const allSelskapIds = Array.from(new Set(meetings.map((m: any) => m.selskap_id).filter(Boolean)));
    const { data: selskaper } = allSelskapIds.length > 0
      ? await supabase.from("selskaper").select("id, firmanavn, domene").in("id", allSelskapIds)
      : { data: [] };
    const selskapMap = new Map((selskaper || []).map((s: any) => [s.id, s]));

    const mismatches: any[] = [];

    for (const m of meetings as any[]) {
      const reasons: string[] = [];
      const externalKontakter = (m.deltakere || [])
        .map((id: string) => kontaktMap.get(id))
        .filter((k: any) => k && !isInternalEmail(k.e_post));

      // Reason 1: company is internal (own org) but external attendees exist
      const linkedSelskap = m.selskap_id ? selskapMap.get(m.selskap_id) : null;
      const linkedDomain = linkedSelskap?.domene?.toLowerCase() || "";
      const isLinkedInternal = INTERNAL_DOMAINS.has(linkedDomain);

      if (isLinkedInternal && externalKontakter.length > 0) {
        reasons.push("Møtet er knyttet til intern organisasjon, men har eksterne deltakere");
      }

      // Reason 2: external attendee company differs from linked selskap
      let suggestedSelskapId: string | null = null;
      let suggestedKontaktId: string | null = null;
      if (externalKontakter.length > 0) {
        const extSelskapIds = Array.from(new Set(externalKontakter.map((k: any) => k.selskap_id).filter(Boolean)));
        if (extSelskapIds.length > 0 && (!m.selskap_id || (isLinkedInternal && !extSelskapIds.includes(m.selskap_id)))) {
          suggestedSelskapId = extSelskapIds[0];
          suggestedKontaktId = externalKontakter.find((k: any) => k.selskap_id === suggestedSelskapId)?.id || null;
          if (m.selskap_id && !extSelskapIds.includes(m.selskap_id)) {
            reasons.push("Selskap matcher ikke ekstern deltakers selskap");
          }
        }
      }

      // Reason 3: missing salgsmulighet despite a company being linked
      const finalSelskapId = suggestedSelskapId || m.selskap_id;
      let suggestedSalgsmulighetId: string | null = null;
      if (!m.salgsmulighet_id && finalSelskapId) {
        const { data: sm } = await supabase
          .from("salgsmuligheter")
          .select("id, navn, status")
          .eq("selskap_id", finalSelskapId)
          .not("status", "in", '("Vunnet","Tapt")')
          .order("updated_at", { ascending: false })
          .limit(1);
        if (sm && sm.length > 0) {
          suggestedSalgsmulighetId = sm[0].id;
          reasons.push("Mangler kobling til åpen salgsmulighet");
        }
      }

      if (reasons.length === 0) continue;

      // Lookup names for suggestions
      let suggestedSelskapNavn: string | null = null;
      if (suggestedSelskapId) {
        const { data: s } = await supabase.from("selskaper").select("firmanavn").eq("id", suggestedSelskapId).maybeSingle();
        suggestedSelskapNavn = s?.firmanavn || null;
      }
      let suggestedSalgsmulighetNavn: string | null = null;
      if (suggestedSalgsmulighetId) {
        const { data: s } = await supabase.from("salgsmuligheter").select("navn").eq("id", suggestedSalgsmulighetId).maybeSingle();
        suggestedSalgsmulighetNavn = s?.navn || null;
      }

      mismatches.push({
        aktivitet_id: m.id,
        tittel: m.tittel,
        dato: m.dato,
        start_tid: m.start_tid,
        current_selskap_id: m.selskap_id,
        current_selskap_navn: linkedSelskap?.firmanavn || null,
        current_salgsmulighet_id: m.salgsmulighet_id,
        suggested_selskap_id: suggestedSelskapId,
        suggested_selskap_navn: suggestedSelskapNavn,
        suggested_kontakt_id: suggestedKontaktId,
        suggested_salgsmulighet_id: suggestedSalgsmulighetId,
        suggested_salgsmulighet_navn: suggestedSalgsmulighetNavn,
        reasons,
      });
    }

    return new Response(JSON.stringify({ mismatches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meeting-mismatch-detect error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Ukjent feil" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function autoFixMeeting(supabase: any, aktivitetId: string) {
  const { data: m } = await supabase
    .from("aktiviteter")
    .select("id, deltakere, selskap_id, salgsmulighet_id, kontakt_id, lead_id")
    .eq("id", aktivitetId)
    .maybeSingle();
  if (!m) {
    return new Response(JSON.stringify({ error: "Møte ikke funnet" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: kontakter } = (m.deltakere && m.deltakere.length > 0)
    ? await supabase.from("kontakter").select("id, e_post, selskap_id").in("id", m.deltakere)
    : { data: [] };

  const externals = (kontakter || []).filter((k: any) => !isInternalEmail(k.e_post) && k.selskap_id);
  const newSelskapId = externals[0]?.selskap_id || null;
  const newKontaktId = externals[0]?.id || null;

  let newSalgsmulighetId: string | null = null;
  if (newSelskapId) {
    const { data: sm } = await supabase
      .from("salgsmuligheter")
      .select("id")
      .eq("selskap_id", newSelskapId)
      .not("status", "in", '("Vunnet","Tapt")')
      .order("updated_at", { ascending: false })
      .limit(1);
    newSalgsmulighetId = sm && sm.length > 0 ? sm[0].id : null;
  }

  // Lead fallback: if no selskap match, try to link to an open lead by external email
  let newLeadId: string | null = null;
  if (!newSelskapId && !m.lead_id) {
    const externalEmails = (kontakter || [])
      .filter((k: any) => !isInternalEmail(k.e_post) && k.e_post)
      .map((k: any) => k.e_post.toLowerCase());
    if (externalEmails.length > 0) {
      const { data: leads } = await supabase
        .from("leads")
        .select("id, e_post, status, updated_at")
        .in("e_post", externalEmails)
        .not("status", "in", '("Konvertert til salg","Konvertert til partner","Ikke aktuelt")')
        .order("updated_at", { ascending: false })
        .limit(1);
      newLeadId = leads && leads.length > 0 ? leads[0].id : null;
    }
  }

  const update: any = {};
  if (newSelskapId) update.selskap_id = newSelskapId;
  if (newKontaktId) update.kontakt_id = newKontaktId;
  if (newSalgsmulighetId) update.salgsmulighet_id = newSalgsmulighetId;
  if (newLeadId) update.lead_id = newLeadId;

  if (Object.keys(update).length === 0) {
    return new Response(JSON.stringify({ ok: false, error: "Ingen ekstern deltaker å koble mot" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase.from("aktiviteter").update(update).eq("id", aktivitetId);

  return new Response(JSON.stringify({ ok: true, updated: update }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
  const { data: m } = await supabase
    .from("aktiviteter")
    .select("id, deltakere, selskap_id, salgsmulighet_id, kontakt_id")
    .eq("id", aktivitetId)
    .maybeSingle();
  if (!m) {
    return new Response(JSON.stringify({ error: "Møte ikke funnet" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: kontakter } = (m.deltakere && m.deltakere.length > 0)
    ? await supabase.from("kontakter").select("id, e_post, selskap_id").in("id", m.deltakere)
    : { data: [] };

  const externals = (kontakter || []).filter((k: any) => !isInternalEmail(k.e_post) && k.selskap_id);
  const newSelskapId = externals[0]?.selskap_id || null;
  const newKontaktId = externals[0]?.id || null;

  let newSalgsmulighetId: string | null = null;
  if (newSelskapId) {
    const { data: sm } = await supabase
      .from("salgsmuligheter")
      .select("id")
      .eq("selskap_id", newSelskapId)
      .not("status", "in", '("Vunnet","Tapt")')
      .order("updated_at", { ascending: false })
      .limit(1);
    newSalgsmulighetId = sm && sm.length > 0 ? sm[0].id : null;
  }

  const update: any = {};
  if (newSelskapId) update.selskap_id = newSelskapId;
  if (newKontaktId) update.kontakt_id = newKontaktId;
  if (newSalgsmulighetId) update.salgsmulighet_id = newSalgsmulighetId;

  if (Object.keys(update).length === 0) {
    return new Response(JSON.stringify({ ok: false, error: "Ingen ekstern deltaker å koble mot" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase.from("aktiviteter").update(update).eq("id", aktivitetId);

  return new Response(JSON.stringify({ ok: true, updated: update }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
