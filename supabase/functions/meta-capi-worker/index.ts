// CRM -> Meta Conversions API worker (Conversion Leads).
// Isolated: reads only META_CAPI_ACCESS_TOKEN, META_CAPI_DATASET_ID and META_PAGE_IDS.
// Never reads the page token, never returns or logs secrets or contact data.
import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateCronRequest } from "../_shared/cron-auth.ts";
import { graphVersion, parsePageAllowlist } from "../_shared/meta-leads.ts";
import {
  LEASE_SEKUNDER,
  MAX_FORSOK,
  SIGNALER,
  TID_GRUNN_TEKST,
  byggCapiHendelse,
  driftsstatus,
  erGyldigLeadgenId,
  erGyldigTestkode,
  harTidTilNesteRad,
  kanAktiveres,
  klassifiserSvar,
  lesKonfig,
  metaFeiltekst,
  redigerFeil,
  sideGodkjent,
  ventetidSekunder,
  vurderTid,
} from "../_shared/meta-capi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TIMEOUT_MS = 15_000;
const BATCH = 25;
const PAUSE_MELLOM_MS = 250;
const AUTH_VENT_SEKUNDER = 3600;

type Caller = "service" | "cron" | "admin";
const svar = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });
const sov = (ms: number) => new Promise((r) => setTimeout(r, ms));

function safeEquals(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

async function authorize(req: Request): Promise<{ caller: Caller; userId?: string } | null> {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  if (!token) return null;
  if (safeEquals(token, SERVICE_KEY)) return { caller: "service" };
  if (Deno.env.get("LOVABLE_CRON_SECRET") && authenticateCronRequest(req) === null) return { caller: "cron" };

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!anonKey || token === anonKey) return null;
  const anon = createClient(SUPABASE_URL, anonKey, { global: { headers: { Authorization: header } } });
  const { data, error } = await anon.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) return null;
  const service = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: role } = await service.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return role?.role === "admin" ? { caller: "admin", userId: String(userId) } : null;
}

const db = () => createClient(SUPABASE_URL, SERVICE_KEY);

async function lesTilstand(supabase: ReturnType<typeof db>) {
  const { data } = await supabase.from("meta_capi_state").select("*").eq("id", "default").maybeSingle();
  return data as Record<string, any> | null;
}

async function settTilstand(supabase: ReturnType<typeof db>, felt: Record<string, unknown>) {
  await supabase.from("meta_capi_state").upsert({ id: "default", ...felt, updated_at: new Date().toISOString() });
}

interface SendResultat { status: number; body: Record<string, unknown> | null }

async function sendTilMeta(hendelse: unknown, testkode: string | null): Promise<SendResultat> {
  const token = (Deno.env.get("META_CAPI_ACCESS_TOKEN") ?? "").trim();
  const datasett = (Deno.env.get("META_CAPI_DATASET_ID") ?? "").trim();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const body: Record<string, unknown> = { data: [hendelse] };
    if (testkode) body.test_event_code = testkode;
    const res = await fetch(`https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(datasett)}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let parsed: Record<string, unknown> | null = null;
    try { parsed = JSON.parse(text); } catch { /* keep null */ }
    return { status: res.status, body: parsed };
  } catch (e) {
    const timeout = e instanceof DOMException && e.name === "AbortError";
    return { status: timeout ? 408 : 599, body: { error: { message: timeout ? "Tidsavbrudd mot Meta" : "Nettverksfeil mot Meta" } } };
  } finally {
    clearTimeout(timer);
  }
}

type Utfall = "sendt" | "hoppet_over" | "ny_runde" | "feilet" | "auth" | "rate" | "tapt_lease";

/** Process one claimed row. Every write is guarded by the claim token from this worker's claim. */
async function behandle(supabase: ReturnType<typeof db>, ev: Record<string, any>, sider: string[]): Promise<Utfall> {
  const naa = new Date().toISOString();
  const oppdater = async (felt: Record<string, unknown>): Promise<boolean> => {
    const { data } = await supabase.from("meta_capi_events")
      .update({ ...felt, locked_until: null, updated_at: naa })
      .eq("id", ev.id).eq("claim_token", ev.claim_token).eq("status", "processing")
      .select("id");
    return Array.isArray(data) && data.length === 1;
  };
  // Still ours? A row whose lease ran out may already be claimed by another worker.
  const eierFortsatt = async (): Promise<boolean> => {
    const { data } = await supabase.from("meta_capi_events").select("id")
      .eq("id", ev.id).eq("claim_token", ev.claim_token).eq("status", "processing")
      .gt("locked_until", new Date().toISOString());
    return Array.isArray(data) && data.length === 1;
  };

  if (!erGyldigLeadgenId(ev.leadgen_id)) {
    return (await oppdater({ status: "skipped", last_error: "Ugyldig Meta lead-ID" })) ? "hoppet_over" : "tapt_lease";
  }

  // Only Meta leads that came in through an approved page.
  if (ev.miljo === "produksjon") {
    let sideOk = false;
    if (ev.meta_lead_event_id) {
      const { data: kilde } = await supabase.from("meta_lead_events").select("page_id, status").eq("id", ev.meta_lead_event_id).maybeSingle();
      sideOk = !!kilde && kilde.status === "done" && sideGodkjent(kilde.page_id, sider);
    }
    if (!sideOk) {
      return (await oppdater({ status: "skipped", last_error: "Meta-leadet er ikke koblet til godkjent side" })) ? "hoppet_over" : "tapt_lease";
    }
  }

  const tid = vurderTid(ev.event_time, ev.lead_opprettet_meta);
  if (!tid.ok) {
    return (await oppdater({ status: "skipped", last_error: TID_GRUNN_TEKST[tid.grunn] })) ? "hoppet_over" : "tapt_lease";
  }

  const hendelse = byggCapiHendelse(ev as any);
  if (!(await eierFortsatt())) return "tapt_lease";
  const res = await sendTilMeta(hendelse, ev.miljo === "test" ? ev.test_event_code : null);
  const klasse = klassifiserSvar(res.status, res.body, 1);
  const respons = { events_received: res.body?.events_received ?? null, fbtrace_id: res.body?.fbtrace_id ?? null, http: res.status };

  if (klasse === "sendt") {
    return (await oppdater({ status: "sent", sent_at: naa, last_error: null, meta_respons: respons })) ? "sendt" : "tapt_lease";
  }

  const feil = res.status >= 200 && res.status < 300
    ? "Meta bekreftet ikke mottak (events_received ≠ 1)"
    : metaFeiltekst(res.status, res.body);
  const forsok = Number(ev.attempts ?? 1);

  if (klasse === "auth") {
    // Expired or invalid login is a waiting condition: refund the attempt and wait.
    await oppdater({
      status: "pending", attempts: Math.max(0, forsok - 1), last_error: feil, meta_respons: respons,
      next_attempt_at: new Date(Date.now() + AUTH_VENT_SEKUNDER * 1000).toISOString(),
    });
    return "auth";
  }
  if ((klasse === "rate" || klasse === "midlertidig") && forsok < MAX_FORSOK) {
    await oppdater({
      status: "pending", last_error: feil, meta_respons: respons,
      next_attempt_at: new Date(Date.now() + ventetidSekunder(forsok) * 1000).toISOString(),
    });
    return klasse === "rate" ? "rate" : "ny_runde";
  }
  await oppdater({ status: "failed", last_error: feil, meta_respons: respons });
  return "feilet";
}

/**
 * Drain the queue ONE row per claim: the 120 s lease only ever covers a single send
 * (max ~20 s), and behandle() re-checks ownership right before sending. A run stops
 * claiming when its time budget is used, so no row is held while waiting behind others.
 */
async function kjor(supabase: ReturnType<typeof db>, miljo: "produksjon" | "test", id?: string) {
  const sider = parsePageAllowlist(Deno.env.get("META_PAGE_IDS"));
  const start = Date.now();
  const telling: Record<string, number> = { sendt: 0, hoppet_over: 0, ny_runde: 0, feilet: 0, auth: 0, rate: 0, tapt_lease: 0 };
  let behandlet = 0;
  let sisteFeil: { tekst: string; type: string } | null = null;
  const maks = id ? 1 : BATCH;

  while (behandlet < maks && harTidTilNesteRad(start, Date.now())) {
    const { data: rader, error } = await supabase.rpc("meta_capi_claim", {
      p_miljo: miljo, p_limit: 1, p_lease_seconds: LEASE_SEKUNDER, p_id: id ?? null,
    });
    if (error) throw new Error(`Kunne ikke hente kø: ${redigerFeil(error.message)}`);
    const ev = ((rader ?? []) as Array<Record<string, any>>)[0];
    if (!ev) break;
    behandlet++;

    let utfall: Utfall;
    try {
      utfall = await behandle(supabase, ev, sider);
    } catch (e) {
      const tekst = redigerFeil(e instanceof Error ? e.message : String(e));
      await supabase.from("meta_capi_events").update({
        status: Number(ev.attempts ?? 1) >= MAX_FORSOK ? "failed" : "pending", locked_until: null, last_error: tekst,
        next_attempt_at: new Date(Date.now() + ventetidSekunder(Number(ev.attempts ?? 1)) * 1000).toISOString(),
      }).eq("id", ev.id).eq("claim_token", ev.claim_token).eq("status", "processing");
      utfall = "ny_runde";
      sisteFeil = { tekst, type: "intern" };
    }
    telling[utfall]++;
    if (utfall === "auth" || utfall === "rate") {
      // Stop the run; the remaining rows were never claimed, so they keep their attempts.
      sisteFeil = { tekst: utfall === "auth" ? "Meta-innloggingen for CRM-tilbakemelding er utløpt eller ugyldig" : "Meta begrenser antall kall – prøver igjen senere", type: utfall };
      break;
    }
    if (utfall === "feilet" && !sisteFeil) sisteFeil = { tekst: "En hendelse ble avvist av Meta", type: "avvist" };
    await sov(PAUSE_MELLOM_MS);
  }

  if (miljo === "produksjon") {
    const felt: Record<string, unknown> = { last_run_at: new Date().toISOString() };
    if (telling.sendt > 0) felt.last_sent_at = new Date().toISOString();
    if (sisteFeil) Object.assign(felt, { last_error: sisteFeil.tekst, last_error_kind: sisteFeil.type, last_error_at: new Date().toISOString() });
    else if (telling.sendt > 0) Object.assign(felt, { last_error: null, last_error_kind: null });
    await settTilstand(supabase, felt);
  }
  return { behandlet, ...telling };
}

async function status(supabase: ReturnType<typeof db>) {
  const konfig = lesKonfig(Deno.env);
  const tilstand = await lesTilstand(supabase);
  const counts: Record<string, number> = { pending: 0, processing: 0, sent: 0, failed: 0, skipped: 0 };
  for (const s of Object.keys(counts)) {
    const { count } = await supabase.from("meta_capi_events").select("id", { count: "exact", head: true })
      .eq("miljo", "produksjon").eq("status", s);
    counts[s] = count ?? 0;
  }
  const { data: siste } = await supabase.from("meta_capi_events")
    .select("id, event_name, status, event_time, sent_at, last_error, attempts")
    .eq("miljo", "produksjon").order("created_at", { ascending: false }).limit(10);
  return {
    driftsstatus: driftsstatus(konfig, tilstand),
    konfig,
    kan_aktiveres: kanAktiveres(konfig, tilstand),
    tilstand: tilstand ? {
      produksjon_aktiv: tilstand.produksjon_aktiv, pauset: tilstand.pauset, aktivert_at: tilstand.aktivert_at,
      test_ok_at: tilstand.test_ok_at, test_sist_at: tilstand.test_sist_at, test_sist_resultat: tilstand.test_sist_resultat,
      last_run_at: tilstand.last_run_at, last_sent_at: tilstand.last_sent_at,
      last_error: tilstand.last_error, last_error_at: tilstand.last_error_at, last_error_kind: tilstand.last_error_kind,
    } : null,
    counts,
    siste: siste ?? [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await authorize(req);
  if (!auth) return svar({ error: "Ikke autorisert" }, 401);

  let body: Record<string, any> = {};
  if (req.method === "POST") { try { body = (await req.json()) ?? {}; } catch { /* default */ } }
  const action = String(body.action ?? "run");
  const supabase = db();

  try {
    if (action === "run") {
      const konfig = lesKonfig(Deno.env);
      const tilstand = await lesTilstand(supabase);
      const drift = driftsstatus(konfig, tilstand);
      if (drift !== "aktiv") {
        // Missing config, switched off or paused: the queue simply waits. Nothing is marked sent.
        await settTilstand(supabase, { last_run_at: new Date().toISOString() });
        return svar({ venter: drift });
      }
      const resultat = await kjor(supabase, "produksjon");
      return svar(auth.caller === "cron" ? { behandlet: resultat.behandlet } : resultat);
    }

    if (auth.caller !== "admin") return svar({ error: "Krever administratortilgang" }, 403);

    if (action === "status") return svar(await status(supabase));

    if (action === "pause" || action === "fortsett") {
      await settTilstand(supabase, { pauset: action === "pause" });
      return svar(await status(supabase));
    }

    if (action === "retry") {
      await supabase.from("meta_capi_events").update({
        status: "pending", attempts: 0, next_attempt_at: new Date().toISOString(), locked_until: null, updated_at: new Date().toISOString(),
      }).eq("miljo", "produksjon").eq("status", "failed");
      return svar(await status(supabase));
    }

    if (action === "test") {
      const konfig = lesKonfig(Deno.env);
      if (!konfig.token || !konfig.datasett) return svar({ error: "Mangler tilgangstoken eller datasett-ID", konfig }, 409);
      const testkode = String(body.test_event_code ?? "").trim();
      if (!erGyldigTestkode(testkode)) return svar({ error: "Lim inn testkoden fra Meta Events Manager (Testhendelser)" }, 400);
      const sider = parsePageAllowlist(Deno.env.get("META_PAGE_IDS"));
      if (sider.length === 0) return svar({ error: "Mangler godkjent Meta-side" }, 409);
      const { data: kilde } = await supabase.from("meta_lead_events")
        .select("id, leadgen_id, created_time").eq("status", "done").not("lead_id", "is", null)
        .in("page_id", sider)
        .order("received_at", { ascending: false }).limit(1).maybeSingle();
      if (!kilde || !erGyldigLeadgenId(kilde.leadgen_id)) return svar({ error: "Fant ingen importert Meta-lead å teste med" }, 409);
      const unik = crypto.randomUUID();
      const { data: rad, error } = await supabase.from("meta_capi_events").insert({
        miljo: "test", milestone_key: `test:${unik}`, event_id: `snakk-crm-test:${unik}`,
        event_name: SIGNALER.leads, stage_key: "test", event_time: new Date().toISOString(),
        leadgen_id: kilde.leadgen_id, lead_opprettet_meta: kilde.created_time, meta_lead_event_id: kilde.id,
        kilde: "admin_test", test_event_code: testkode,
      }).select("id").single();
      if (error) return svar({ error: redigerFeil(error.message) }, 500);
      const resultat = await kjor(supabase, "test", rad.id);
      const { data: etter } = await supabase.from("meta_capi_events").select("status, last_error").eq("id", rad.id).maybeSingle();
      const ok = etter?.status === "sent";
      await settTilstand(supabase, {
        test_sist_at: new Date().toISOString(),
        test_sist_resultat: ok ? "Godkjent – Meta bekreftet mottak" : (etter?.last_error ?? "Ikke bekreftet"),
        ...(ok ? { test_ok_at: new Date().toISOString() } : {}),
      });
      return svar({ ok, resultat, status: await status(supabase) });
    }

    if (action === "aktiver") {
      const konfig = lesKonfig(Deno.env);
      const tilstand = await lesTilstand(supabase);
      if (!kanAktiveres(konfig, tilstand)) return svar({ error: "Krever tilgangstoken, datasett-ID og godkjent testhendelse" }, 409);
      if (body.bekreft !== true) return svar({ error: "Aktivering må bekreftes" }, 400);
      await settTilstand(supabase, { produksjon_aktiv: true, pauset: false, aktivert_at: new Date().toISOString(), aktivert_av: auth.userId });
      return svar(await status(supabase));
    }

    if (action === "deaktiver") {
      await settTilstand(supabase, { produksjon_aktiv: false });
      return svar(await status(supabase));
    }

    return svar({ error: "Ukjent handling" }, 400);
  } catch (e) {
    const tekst = redigerFeil(e instanceof Error ? e.message : String(e));
    console.error("meta-capi-worker:", tekst);
    return svar({ error: tekst }, 500);
  }
});
