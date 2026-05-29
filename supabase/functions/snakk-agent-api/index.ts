// Snakk Voice Agent CRM API
// Single POST endpoint with action-based dispatch, so the Snakk agent
// (platform.snakk.ai) can call CRM functions as tools.
//
// Auth: X-API-Key header must match CRM_STATS_API_KEY secret.
// Body: { action: string, params?: object }
//
// All write actions require user_email to attribute changes to the right CRM user.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const key = req.headers.get("x-api-key");
  if (!key || key !== Deno.env.get("CRM_STATS_API_KEY")) {
    return json({ error: "Unauthorized. Provide valid X-API-Key header." }, 401);
  }

  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action || "").trim();
  // params may arrive as object OR as a JSON string (Snakk platform only supports String/Number/Boolean params)
  let p: any = body.params ?? {};
  if (typeof p === "string") {
    const s = p.trim();
    if (!s) {
      p = {};
    } else {
      try {
        p = JSON.parse(s);
      } catch {
        return json({ error: "params must be valid JSON object or JSON string", got: s }, 400);
      }
    }
  }
  // Also accept user_email at top level (some agent setups send it as a sibling field)
  if (body.user_email && !p.user_email) p.user_email = body.user_email;

  try {
    switch (action) {
      // ── READ ────────────────────────────────────────────
      case "list_actions":
        return json({ actions: ACTIONS });
      case "search":
        return json(await searchAll(p.query, p.type));
      case "get_lead":
        return json(await getOne("leads", p.id));
      case "get_salgsmulighet":
        return json(await getSalgsmulighet(p.id));
      case "get_selskap":
        return json(await getSelskap(p.id));
      case "get_kontakt":
        return json(await getOne("kontakter", p.id));
      case "my_tasks":
        return json(await myTasks(p.user_email, p.include_completed));
      case "my_meetings":
        return json(await myMeetings(p.user_email, p.days || 1));
      case "overdue_followups":
        return json(await overdueFollowups());
      case "pipeline_summary":
        return json(await pipelineSummary());
      case "recent_activities":
        return json(await recentActivities(p.entity_type, p.entity_id, p.limit || 10));

      // ── WRITE ───────────────────────────────────────────
      case "create_activity":
        return json(await createActivity(p));
      case "create_task":
        return json(await createTask(p));
      case "update_lead":
        return json(await updateRow("leads", p));
      case "update_salgsmulighet":
        return json(await updateRow("salgsmuligheter", p));
      case "update_selskap":
        return json(await updateRow("selskaper", p));
      case "complete_task":
        return json(await updateRow("oppgaver", { id: p.id, status: "Ferdig" }));

      default:
        return json({ error: "Unknown action", available: ACTIONS.map((a) => a.name) }, 400);
    }
  } catch (e: any) {
    console.error("snakk-agent-api error:", action, e);
    return json({ error: e?.message || "Internal error", action }, 500);
  }
});

// ── Helpers ───────────────────────────────────────────────

async function userIdFromEmail(email?: string): Promise<{ user_id: string | null; display_name: string | null }> {
  if (!email) return { user_id: null, display_name: null };
  const { data } = await sb
    .from("profiles")
    .select("user_id, display_name")
    .ilike("email", email)
    .maybeSingle();
  return { user_id: data?.user_id || null, display_name: data?.display_name || null };
}

async function searchAll(query: string, type?: string) {
  if (!query || query.length < 2) return { results: [], note: "Query too short" };
  const q = `%${query}%`;
  const wanted = (t: string) => !type || type === t;
  const results: any[] = [];

  if (wanted("lead")) {
    const { data } = await sb
      .from("leads")
      .select("id, firmanavn, kontaktperson, status, ansvarlig, e_post, sist_aktivitet")
      .or(`firmanavn.ilike.${q},kontaktperson.ilike.${q},e_post.ilike.${q}`)
      .limit(10);
    for (const r of data || []) results.push({ type: "lead", ...r });
  }
  if (wanted("salgsmulighet")) {
    const { data } = await sb
      .from("salgsmuligheter")
      .select("id, navn, status, forventet_mrr, ansvarlig, kontaktperson, e_post, sist_aktivitet")
      .or(`navn.ilike.${q},kontaktperson.ilike.${q},e_post.ilike.${q}`)
      .limit(10);
    for (const r of data || []) results.push({ type: "salgsmulighet", ...r });
  }
  if (wanted("selskap")) {
    const { data } = await sb
      .from("selskaper")
      .select("id, firmanavn, kundestatus, mrr, kundeansvarlig, sist_aktivitet")
      .or(`firmanavn.ilike.${q},domene.ilike.${q}`)
      .limit(10);
    for (const r of data || []) results.push({ type: "selskap", ...r });
  }
  if (wanted("kontakt")) {
    const { data } = await sb
      .from("kontakter")
      .select("id, navn, rolle, e_post, telefon, selskap_id")
      .or(`navn.ilike.${q},e_post.ilike.${q}`)
      .limit(10);
    for (const r of data || []) results.push({ type: "kontakt", ...r });
  }
  return { results, count: results.length };
}

async function getOne(table: string, id: string) {
  if (!id) throw new Error("id required");
  const { data, error } = await sb.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data || { error: "Not found" };
}

async function getSalgsmulighet(id: string) {
  const sm = await getOne("salgsmuligheter", id);
  if ((sm as any)?.error) return sm;
  const { data: acts } = await sb
    .from("aktiviteter")
    .select("id, type, dato, tittel, beskrivelse, aktivitet_kilde")
    .eq("salgsmulighet_id", id)
    .order("dato", { ascending: false })
    .limit(10);
  return { ...sm, siste_aktiviteter: acts || [] };
}

async function getSelskap(id: string) {
  const s = await getOne("selskaper", id);
  if ((s as any)?.error) return s;
  const { data: kontakter } = await sb.from("kontakter").select("id, navn, rolle, e_post, telefon").eq("selskap_id", id);
  const { data: sm } = await sb
    .from("salgsmuligheter")
    .select("id, navn, status, forventet_mrr")
    .eq("selskap_id", id);
  return { ...s, kontakter: kontakter || [], salgsmuligheter: sm || [] };
}

async function myTasks(email: string, includeCompleted = false) {
  const { user_id, display_name } = await userIdFromEmail(email);
  if (!user_id && !display_name) return { tasks: [], note: "User not found" };
  let q = sb.from("oppgaver").select("id, oppgave, frist, prioritet, status, ansvarlig, lead_id, salgsmulighet_id, selskap_id");
  if (!includeCompleted) q = q.neq("status", "Ferdig");
  // match by user_id OR by ansvarlig display_name
  const orFilter = [user_id ? `user_id.eq.${user_id}` : null, display_name ? `ansvarlig.eq.${display_name}` : null]
    .filter(Boolean)
    .join(",");
  const { data, error } = await q.or(orFilter).order("frist", { ascending: true }).limit(50);
  if (error) throw error;
  return { tasks: data || [], user: display_name || email };
}

async function myMeetings(email: string, days: number) {
  const { user_id, display_name } = await userIdFromEmail(email);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + days * 86400000);
  let q = sb
    .from("aktiviteter")
    .select("id, tittel, dato, start_tid, slutt_tid, beskrivelse, salgsmulighet_id, kontakt_id, selskap_id")
    .eq("type", "Møte")
    .gte("dato", from.toISOString())
    .lte("dato", to.toISOString())
    .order("dato", { ascending: true });
  if (user_id) q = q.eq("user_id", user_id);
  const { data, error } = await q.limit(50);
  if (error) throw error;
  return { meetings: data || [], user: display_name || email, days };
}

async function overdueFollowups() {
  const now = Date.now();
  const lead48 = new Date(now - 48 * 3600 * 1000).toISOString().split("T")[0];
  const sm72 = new Date(now - 72 * 3600 * 1000).toISOString().split("T")[0];

  const { data: leads } = await sb
    .from("leads")
    .select("id, firmanavn, kontaktperson, status, ansvarlig, sist_aktivitet")
    .not("status", "in", '("Ikke aktuelt","Konvertert til salg","Konvertert til partner")')
    .lt("sist_aktivitet", lead48)
    .order("sist_aktivitet", { ascending: true })
    .limit(50);

  const { data: sm } = await sb
    .from("salgsmuligheter")
    .select("id, navn, status, ansvarlig, forventet_mrr, sist_aktivitet")
    .not("status", "in", '("Vunnet","Tapt")')
    .lt("sist_aktivitet", sm72)
    .order("sist_aktivitet", { ascending: true })
    .limit(50);

  return {
    leads_stale: leads || [],
    salgsmuligheter_stale: sm || [],
    thresholds: { lead_hours: 48, salgsmulighet_hours: 72 },
  };
}

async function pipelineSummary() {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: deals } = await sb
    .from("salgsmuligheter")
    .select("status, forventet_mrr, sannsynlighet, vunnet_dato, tapt_dato");
  const { data: companies } = await sb.from("selskaper").select("mrr, kundestatus");

  const open = (deals || []).filter((d: any) => !["Vunnet", "Tapt"].includes(d.status));
  const byStage: Record<string, { count: number; mrr: number }> = {};
  for (const d of open) {
    const s = d.status || "Ukjent";
    if (!byStage[s]) byStage[s] = { count: 0, mrr: 0 };
    byStage[s].count++;
    byStage[s].mrr += d.forventet_mrr || 0;
  }
  const totalPipelineMrr = open.reduce((s: number, d: any) => s + (d.forventet_mrr || 0), 0);
  const weighted = open.reduce(
    (s: number, d: any) => s + ((d.forventet_mrr || 0) * (d.sannsynlighet || 50)) / 100,
    0,
  );
  const wonMonth = (deals || []).filter((d: any) => d.vunnet_dato && d.vunnet_dato >= firstOfMonth);
  const lostMonth = (deals || []).filter((d: any) => d.tapt_dato && d.tapt_dato >= firstOfMonth);

  const liveMrr = (companies || [])
    .filter((c: any) => c.kundestatus === "Live")
    .reduce((s: number, c: any) => s + (c.mrr || 0), 0);
  const pilotMrr = (companies || [])
    .filter((c: any) => c.kundestatus === "Pilot")
    .reduce((s: number, c: any) => s + (c.mrr || 0), 0);

  return {
    aktiv_mrr: liveMrr + pilotMrr,
    live_mrr: liveMrr,
    pilot_mrr: pilotMrr,
    pipeline_mrr: totalPipelineMrr,
    vektet_pipeline_mrr: Math.round(weighted),
    aapne_salgsmuligheter: open.length,
    vunnet_denne_maaned: { antall: wonMonth.length, mrr: wonMonth.reduce((s: number, d: any) => s + (d.forventet_mrr || 0), 0) },
    tapt_denne_maaned: { antall: lostMonth.length, mrr: lostMonth.reduce((s: number, d: any) => s + (d.forventet_mrr || 0), 0) },
    per_fase: byStage,
  };
}

async function recentActivities(entity_type: string, entity_id: string, limit: number) {
  const col = entity_type === "lead" ? "lead_id" : entity_type === "salgsmulighet" ? "salgsmulighet_id" : entity_type === "selskap" ? "selskap_id" : null;
  if (!col || !entity_id) throw new Error("entity_type (lead|salgsmulighet|selskap) and entity_id required");
  const { data } = await sb
    .from("aktiviteter")
    .select("id, type, dato, tittel, beskrivelse, aktivitet_kilde")
    .eq(col, entity_id)
    .order("dato", { ascending: false })
    .limit(limit);
  return { activities: data || [] };
}

async function createActivity(p: any) {
  const { user_id } = await userIdFromEmail(p.user_email);
  const row = {
    type: p.type || "Notat",
    beskrivelse: p.beskrivelse || "",
    tittel: p.tittel || "",
    dato: p.dato || new Date().toISOString(),
    lead_id: p.lead_id || null,
    salgsmulighet_id: p.salgsmulighet_id || null,
    selskap_id: p.selskap_id || null,
    kontakt_id: p.kontakt_id || null,
    user_id,
    aktivitet_kilde: "snakk_voice",
  };
  const { data, error } = await sb.from("aktiviteter").insert(row).select().single();
  if (error) throw error;
  return { ok: true, aktivitet: data };
}

async function createTask(p: any) {
  const { user_id, display_name } = await userIdFromEmail(p.user_email);
  const row = {
    oppgave: p.oppgave,
    frist: p.frist || null,
    prioritet: p.prioritet || "Medium",
    status: "Åpen",
    ansvarlig: p.ansvarlig || display_name || "",
    notater: p.notater || "",
    lead_id: p.lead_id || null,
    salgsmulighet_id: p.salgsmulighet_id || null,
    selskap_id: p.selskap_id || null,
    kontakt_id: p.kontakt_id || null,
    user_id,
  };
  if (!row.oppgave) throw new Error("oppgave (task title) required");
  const { data, error } = await sb.from("oppgaver").insert(row).select().single();
  if (error) throw error;
  return { ok: true, oppgave: data };
}

async function updateRow(table: string, p: any) {
  if (!p.id) throw new Error("id required");
  const { id, user_email, ...rest } = p;
  const patch: any = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v === "" || v === undefined) continue;
    patch[k] = v;
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: "No fields to update" };
  const { data, error } = await sb.from(table).update(patch).eq("id", id).select().single();
  if (error) throw error;
  return { ok: true, row: data };
}

// ── Action catalog (for the agent to discover) ───────────
const ACTIONS = [
  { name: "search", desc: "Søk på tvers av leads, salgsmuligheter, selskaper, kontakter", params: ["query", "type?"] },
  { name: "get_lead", desc: "Hent full info om en lead", params: ["id"] },
  { name: "get_salgsmulighet", desc: "Hent salgsmulighet med siste aktiviteter", params: ["id"] },
  { name: "get_selskap", desc: "Hent selskap med kontakter og salgsmuligheter", params: ["id"] },
  { name: "get_kontakt", desc: "Hent kontaktperson", params: ["id"] },
  { name: "my_tasks", desc: "Mine åpne oppgaver", params: ["user_email", "include_completed?"] },
  { name: "my_meetings", desc: "Mine møter i dag (eller N dager)", params: ["user_email", "days?"] },
  { name: "overdue_followups", desc: "Leads/salgsmuligheter som trenger oppfølging", params: [] },
  { name: "pipeline_summary", desc: "MRR, pipeline-verdi, faser, vunnet/tapt denne måneden", params: [] },
  { name: "recent_activities", desc: "Siste aktiviteter på en entitet", params: ["entity_type", "entity_id", "limit?"] },
  { name: "create_activity", desc: "Logg en aktivitet/notat", params: ["user_email", "type", "beskrivelse", "lead_id?", "salgsmulighet_id?", "selskap_id?"] },
  { name: "create_task", desc: "Opprett oppgave", params: ["user_email", "oppgave", "frist?", "prioritet?", "lead_id?", "salgsmulighet_id?", "selskap_id?"] },
  { name: "update_lead", desc: "Oppdater lead-felter", params: ["id", "status?", "neste_steg?", "notater?", "ansvarlig?"] },
  { name: "update_salgsmulighet", desc: "Oppdater salgsmulighet", params: ["id", "status?", "neste_steg?", "forventet_mrr?", "notater?"] },
  { name: "update_selskap", desc: "Oppdater selskap", params: ["id", "kundestatus?", "neste_steg?", "notater?"] },
  { name: "complete_task", desc: "Marker oppgave som ferdig", params: ["id"] },
];
