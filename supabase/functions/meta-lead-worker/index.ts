import { createClient } from "npm:@supabase/supabase-js@2";
import {
  LEAD_GRAPH_FIELDS,
  MAX_ATTEMPTS,
  buildNotes,
  graphVersion,
  isAllowedPage,
  isRetryableStatus,
  mapLeadFields,
  parsePageAllowlist,
  retryDelaySeconds,
  callerFromRoleRow,
} from "../_shared/meta-leads.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const GRAPH_TIMEOUT_MS = 15_000;
const LEASE_SECONDS = 120;
const BATCH_SIZE = 10;

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

type Caller = "service" | "admin" | "trigger" | null;

/** Constant-time comparison of two secrets. */
function safeEquals(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

/**
 * Accepted callers, all server-side or verified humans:
 * - "service": the service role key (internal wake-up from the webhook / admin endpoint).
 * - "trigger": the scheduled run, authenticated with a server-only token that lives
 *   encrypted in the database vault and is verified there in constant time.
 *   It may only start processing and never receives per-lead details.
 * - "admin": a signed-in CRM user whose admin role is verified server-side.
 * Publishable/anon keys and unverified tokens are always rejected.
 */
async function authorize(req: Request): Promise<Caller> {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  if (!token) return null;

  if (safeEquals(token, SERVICE_KEY)) return "service";

  const service = createClient(SUPABASE_URL, SERVICE_KEY);

  // Scheduled run: server-only token verified against the encrypted vault.
  const { data: workerOk, error: workerError } = await service
    .rpc("verify_meta_worker_token", { p_token: token });
  if (workerError) console.error("meta-lead-worker: token verification failed", workerError.message);
  if (workerOk === true) return "trigger";

  // Signed-in CRM administrator.
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!anonKey) return null;
  const anon = createClient(SUPABASE_URL, anonKey, {
    global: { headers: { Authorization: header } },
  });
  const { data, error } = await anon.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  const { data: role } = await service
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return callerFromRoleRow(role);
}

interface GraphResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown> | null;
  error?: string;
}

async function fetchLeadFromGraph(leadgenId: string, token: string): Promise<GraphResult> {
  // NB: form_name is not a valid field on a leadgen node — requesting it fails the whole query.
  const fields = LEAD_GRAPH_FIELDS.join(",");
  const url = `https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(leadgenId)}?fields=${fields}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GRAPH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    });
    const text = await res.text();
    let body: Record<string, unknown> | null = null;
    try { body = JSON.parse(text); } catch { /* keep null */ }
    if (!res.ok) {
      return { ok: false, status: res.status, body, error: text.slice(0, 500) };
    }
    return { ok: true, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 599, body: null, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Optional enrichment: the form's display name lives on the form node, not the lead.
 * Any failure here (missing permission, timeout) must never block the lead import.
 */
async function fetchFormName(formId: string | null, token: string): Promise<string | null> {
  if (!formId) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GRAPH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(formId)}?fields=name`,
      { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal },
    );
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    const name = body?.name;
    return typeof name === "string" && name.length > 0 ? name : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const caller = await authorize(req);
  if (!caller) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const pageToken = Deno.env.get("META_PAGE_ACCESS_TOKEN");
  const allowlist = parsePageAllowlist(Deno.env.get("META_PAGE_IDS"));

  if (!pageToken || allowlist.length === 0) {
    return new Response(
      JSON.stringify({ error: "Mangler serverkonfigurasjon", missing: { META_PAGE_ACCESS_TOKEN: !pageToken, META_PAGE_IDS: allowlist.length === 0 } }),
      { status: 503, headers: jsonHeaders },
    );
  }

  const { data: claimed, error: claimError } = await supabase
    .rpc("claim_meta_lead_events", { p_limit: BATCH_SIZE, p_lease_seconds: LEASE_SECONDS });

  if (claimError) {
    console.error("meta-lead-worker: claim failed", claimError.message);
    return new Response(JSON.stringify({ error: "Kunne ikke hente kø", details: claimError.message }), { status: 500, headers: jsonHeaders });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const ev of (claimed ?? []) as Array<Record<string, any>>) {
    const fail = async (message: string, permanent: boolean) => {
      const attempts = ev.attempts as number;
      const isPermanent = permanent || attempts >= MAX_ATTEMPTS;
      await supabase.from("meta_lead_events").update({
        status: isPermanent ? "failed" : "pending",
        locked_until: null,
        last_error: message.slice(0, 1000),
        next_attempt_at: new Date(Date.now() + retryDelaySeconds(attempts) * 1000).toISOString(),
      }).eq("id", ev.id);
      await supabase.from("meta_integration_state").upsert({
        id: "default", last_error: message.slice(0, 500), last_error_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      results.push({ leadgen_id: ev.leadgen_id, status: isPermanent ? "failed" : "retry", error: message.slice(0, 200) });
    };

    // Page must still be part of the integration.
    if (!isAllowedPage(ev.page_id, allowlist)) {
      await supabase.from("meta_lead_events").update({
        status: "ignored", locked_until: null, processed_at: new Date().toISOString(),
        last_error: `Side ${ev.page_id} er ikke en del av integrasjonen`,
      }).eq("id", ev.id);
      results.push({ leadgen_id: ev.leadgen_id, status: "ignored" });
      continue;
    }

    const graph = await fetchLeadFromGraph(ev.leadgen_id, pageToken);
    if (!graph.ok) {
      await fail(`Graph API ${graph.status}: ${graph.error ?? "ukjent feil"}`, !isRetryableStatus(graph.status));
      continue;
    }

    const lead = graph.body ?? {};
    const formId = lead.form_id != null ? String(lead.form_id) : ev.form_id;
    const mapped = mapLeadFields(lead.field_data as any);

    const createdTime = (lead.created_time as string | undefined) ?? ev.created_time ?? null;
    const formName = (await fetchFormName(formId, pageToken)) ?? ev.form_name ?? null;
    const notater = buildNotes(mapped, {
      formName,
      formId,
      adName: (lead.ad_name as string) ?? null,
      adId: (lead.ad_id as string) ?? ev.ad_id,
      campaignName: (lead.campaign_name as string) ?? null,
      campaignId: (lead.campaign_id as string) ?? null,
      leadgenId: ev.leadgen_id,
      createdTime,
    });

    if (!mapped.firmanavn && !mapped.kontaktperson && !mapped.e_post) {
      await fail("Innsendingen mangler navn, firmanavn og e-post", true);
      continue;
    }

    const today = new Date().toISOString().split("T")[0];

    try {
      // Duplicate handling: same person (e-post/telefon) keeps its existing lead,
      // status, owner and notes. The new interest is logged as an activity instead.
      let existingId: string | null = null;
      if (mapped.e_post) {
        const { data } = await supabase.from("leads").select("id").ilike("e_post", mapped.e_post).limit(1).maybeSingle();
        existingId = data?.id ?? null;
      }
      if (!existingId && mapped.telefon) {
        const { data } = await supabase.from("leads").select("id").eq("telefon", mapped.telefon).limit(1).maybeSingle();
        existingId = data?.id ?? null;
      }

      let leadId: string;
      let created = false;

      if (existingId) {
        leadId = existingId;
        await supabase.from("leads").update({ sist_aktivitet: today }).eq("id", leadId);
      } else {
        const { data, error } = await supabase.from("leads").insert({
          firmanavn: mapped.firmanavn || mapped.kontaktperson || "Ukjent",
          kontaktperson: mapped.kontaktperson,
          e_post: mapped.e_post,
          telefon: mapped.telefon,
          notater,
          kilde: "Meta Lead Ads",
          status: "Ny",
          opprettet_dato: createdTime ? String(createdTime).split("T")[0] : today,
          sist_aktivitet: today,
          use_case: mapped.use_case,
          rolle_i_firma: mapped.rolle_i_firma,
        }).select("id").single();
        if (error) throw new Error(error.message);
        leadId = data.id;
        created = true;
      }

      await supabase.from("aktiviteter").insert({
        type: "Notat",
        tittel: created ? "Nytt lead fra Meta Lead Ads" : "Ny interesse fra Meta Lead Ads",
        beskrivelse: notater,
        dato: createdTime ?? new Date().toISOString(),
        lead_id: leadId,
        ekstern_id: ev.leadgen_id,
        ekstern_provider: "meta_lead_ads",
        aktivitet_kilde: "meta_lead_ads",
      });

      await supabase.from("meta_lead_events").update({
        status: "done",
        locked_until: null,
        processed_at: new Date().toISOString(),
        lead_id: leadId,
        last_error: null,
        form_id: formId,
        form_name: formName,
        ad_name: (lead.ad_name as string) ?? null,
        campaign_id: (lead.campaign_id as string) ?? null,
        campaign_name: (lead.campaign_name as string) ?? null,
        lead_payload: lead,
      }).eq("id", ev.id);

      await supabase.from("meta_integration_state").upsert({
        id: "default",
        connection_verified: true,
        verified_page_id: ev.page_id,
        last_processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      results.push({ leadgen_id: ev.leadgen_id, status: created ? "created" : "duplicate", lead_id: leadId });
    } catch (e) {
      await fail(`CRM-feil: ${e instanceof Error ? e.message : String(e)}`, false);
    }
  }

  const payload = caller === "trigger"
    ? { processed: results.length }
    : { processed: results.length, results };
  return new Response(JSON.stringify(payload), { status: 200, headers: jsonHeaders });
});
