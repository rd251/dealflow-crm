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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const userId = await requireAdmin(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Krever administratortilgang" }), { status: 403, headers: jsonHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  let action = "status";
  if (req.method === "POST") {
    try { action = (await req.json())?.action ?? "status"; } catch { /* default */ }
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
