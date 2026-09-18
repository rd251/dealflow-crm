import { createClient } from "npm:@supabase/supabase-js@2";
import { graphVersion, parsePageAllowlist } from "../_shared/meta-leads.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function requireAdmin(req: Request): Promise<string | null> {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  // The anon key is not a user session and must never pass as admin.
  if (token === Deno.env.get("SUPABASE_ANON_KEY") || token === SERVICE_KEY) return null;

  const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: header } },
  });
  const { data, error } = await anon.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: role } = await admin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return role ? String(userId) : null;
}

const APP_ID = "923876804118645";

/** Call the Graph API with the server-only page token. Tokens are never returned or logged. */
async function graph(path: string, init?: RequestInit & { form?: Record<string, string> }) {
  const token = Deno.env.get("META_PAGE_ACCESS_TOKEN");
  if (!token) return { ok: false, status: 503, body: { error: { message: "META_PAGE_ACCESS_TOKEN mangler" } } };
  const url = `https://graph.facebook.com/${graphVersion()}${path}`;
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init?.form ? new URLSearchParams(init.form).toString() : undefined,
  });
  const text = await res.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 500) }; }
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const userId = await requireAdmin(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Krever administratortilgang" }), { status: 403, headers: jsonHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  let action = "status";
  let payload: Record<string, any> = {};
  if (req.method === "POST") {
    try { payload = (await req.json()) ?? {}; } catch { /* default */ }
    action = payload.action ?? "status";
  }

  const allowed = parsePageAllowlist(Deno.env.get("META_PAGE_IDS"));
  const pageId = allowed[0];

  // --- Meta-side diagnostics (read-only) ---
  if (action === "diagnose") {
    if (!pageId) return new Response(JSON.stringify({ error: "META_PAGE_IDS mangler" }), { status: 503, headers: jsonHeaders });
    const page = await graph(`/${pageId}?fields=id,name,category`);
    const subs = await graph(`/${pageId}/subscribed_apps?fields=id,name,subscribed_fields`);
    const forms = await graph(`/${pageId}/leadgen_forms?fields=id,name,status&limit=50`);
    return new Response(JSON.stringify({
      page: { ok: page.ok, status: page.status, body: page.body },
      subscribed_apps: { ok: subs.ok, status: subs.status, body: subs.body },
      leadgen_forms: { ok: forms.ok, status: forms.status, body: forms.body },
      expected_app_id: APP_ID,
      graph_version: graphVersion(),
    }), { status: 200, headers: jsonHeaders });
  }

  // --- Subscribe our app to leadgen on the page (idempotent, leaves other apps alone) ---
  if (action === "subscribe") {
    if (!pageId) return new Response(JSON.stringify({ error: "META_PAGE_IDS mangler" }), { status: 503, headers: jsonHeaders });
    const before = await graph(`/${pageId}/subscribed_apps?fields=id,name,subscribed_fields`);
    const existing = (before.body?.data ?? []).find((a: any) => String(a.id) === APP_ID);
    if (existing && (existing.subscribed_fields ?? []).includes("leadgen")) {
      return new Response(JSON.stringify({ already_subscribed: true, subscribed_apps: before.body }), { status: 200, headers: jsonHeaders });
    }
    const res = await graph(`/${pageId}/subscribed_apps`, { method: "POST", form: { subscribed_fields: "leadgen" } });
    const after = await graph(`/${pageId}/subscribed_apps?fields=id,name,subscribed_fields`);
    return new Response(JSON.stringify({ subscribe: { ok: res.ok, status: res.status, body: res.body }, subscribed_apps: after.body }), {
      status: res.ok ? 200 : 502, headers: jsonHeaders,
    });
  }

  // --- Locate a specific existing lead at Meta and put it through the durable queue ---
  if (action === "enqueue_existing") {
    if (!pageId) return new Response(JSON.stringify({ error: "META_PAGE_IDS mangler" }), { status: 503, headers: jsonHeaders });
    const wantedEmail = String(payload.email ?? "").trim().toLowerCase();
    const wantedId = payload.leadgen_id ? String(payload.leadgen_id) : null;
    const sinceIso = payload.since ? String(payload.since) : null;
    if (!wantedEmail && !wantedId) {
      return new Response(JSON.stringify({ error: "Oppgi email eller leadgen_id" }), { status: 400, headers: jsonHeaders });
    }

    const matches: any[] = [];
    const scanned: any[] = [];

    if (wantedId) {
      const one = await graph(`/${wantedId}?fields=id,created_time,field_data,form_id,ad_id,campaign_id`);
      if (!one.ok) return new Response(JSON.stringify({ error: "Graph-feil", status: one.status, body: one.body }), { status: 502, headers: jsonHeaders });
      matches.push(one.body);
    } else {
      const forms = await graph(`/${pageId}/leadgen_forms?fields=id,name&limit=100`);
      if (!forms.ok) return new Response(JSON.stringify({ error: "Graph-feil ved skjemaliste", status: forms.status, body: forms.body }), { status: 502, headers: jsonHeaders });
      for (const form of (forms.body?.data ?? [])) {
        const q = `/${form.id}/leads?fields=id,created_time,field_data,form_id,ad_id,campaign_id&limit=100` +
          (sinceIso ? `&filtering=${encodeURIComponent(JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: Math.floor(new Date(sinceIso).getTime() / 1000) }]))}` : "");
        const leads = await graph(q);
        scanned.push({ form_id: form.id, form_name: form.name, ok: leads.ok, status: leads.status, count: leads.body?.data?.length ?? 0, error: leads.ok ? undefined : leads.body });
        for (const l of (leads.body?.data ?? [])) {
          const emails = (l.field_data ?? []).flatMap((f: any) => (f.values ?? [])).map((v: any) => String(v).toLowerCase());
          if (emails.includes(wantedEmail)) matches.push({ ...l, form_name: form.name });
        }
      }
    }

    const enqueued: any[] = [];
    for (const m of matches) {
      const { error } = await supabase.from("meta_lead_events").upsert({
        leadgen_id: String(m.id),
        page_id: pageId,
        form_id: m.form_id ?? null,
        form_name: m.form_name ?? null,
        ad_id: m.ad_id ?? null,
        created_time: m.created_time ?? null,
        raw_change: { source: "admin_backfill", leadgen_id: String(m.id) },
      }, { onConflict: "leadgen_id", ignoreDuplicates: true });
      enqueued.push({ leadgen_id: String(m.id), queued: !error, error: error?.message });
    }

    if (enqueued.some((e) => e.queued)) {
      await fetch(`${SUPABASE_URL}/functions/v1/meta-lead-worker`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
        body: "{}",
      }).catch((e) => console.error("worker kick failed", e));
    }

    const { data: rows } = await supabase
      .from("meta_lead_events")
      .select("leadgen_id, status, attempts, last_error, lead_id, form_name")
      .in("leadgen_id", matches.map((m) => String(m.id)));

    return new Response(JSON.stringify({ found: matches.length, scanned, enqueued, queue: rows ?? [] }), { status: 200, headers: jsonHeaders });
  }


  if (action === "retry") {
    const { error } = await supabase
      .from("meta_lead_events")
      .update({ status: "pending", next_attempt_at: new Date().toISOString(), locked_until: null })
      .in("status", ["failed"]);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: jsonHeaders });
    }
    // Kick the worker immediately with the service role.
    await fetch(`${SUPABASE_URL}/functions/v1/meta-lead-worker`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: "{}",
    }).catch((e) => console.error("worker kick failed", e));
  }

  const pageIds = parsePageAllowlist(Deno.env.get("META_PAGE_IDS"));
  const config = {
    META_VERIFY_TOKEN: !!Deno.env.get("META_VERIFY_TOKEN"),
    META_APP_SECRET: !!Deno.env.get("META_APP_SECRET"),
    META_PAGE_ACCESS_TOKEN: !!Deno.env.get("META_PAGE_ACCESS_TOKEN"),
    META_PAGE_IDS: pageIds.length > 0,
  };

  const { data: state } = await supabase.from("meta_integration_state").select("*").eq("id", "default").maybeSingle();
  const { data: events } = await supabase
    .from("meta_lead_events")
    .select("id, leadgen_id, page_id, form_name, status, attempts, last_error, received_at, processed_at, lead_id, next_attempt_at")
    .order("received_at", { ascending: false })
    .limit(25);

  const counts: Record<string, number> = { pending: 0, processing: 0, done: 0, failed: 0, ignored: 0 };
  for (const s of Object.keys(counts)) {
    const { count } = await supabase.from("meta_lead_events").select("id", { count: "exact", head: true }).eq("status", s);
    counts[s] = count ?? 0;
  }

  const fullyConfigured = Object.values(config).every(Boolean);
  const tilstand = !fullyConfigured
    ? "Mangler konfigurasjon"
    : state?.connection_verified
      ? "Aktiv"
      : "Venter på Meta-oppsett";

  return new Response(JSON.stringify({
    tilstand,
    config,
    page_ids: pageIds,
    graph_version: graphVersion(),
    callback_url: `${SUPABASE_URL}/functions/v1/meta-lead-webhook`,
    state: state ?? null,
    counts,
    events: events ?? [],
  }), { status: 200, headers: jsonHeaders });
});
