// Speiler supabase/functions/_shared/meta-capi.ts (serveren) og public.meta_capi_steg() i databasen.
// Brukes av Innstillinger → Meta-leads og av testene. Endres alltid sammen med serverfila.

export const LEAD_EVENT_SOURCE = "Snakk CRM";
export const ACTION_SOURCE = "system_generated";
export const EVENT_SOURCE = "crm";
export const MAX_FORSOK = 8;
/** Meta accepts event_time up to 7 days back; keep a 10 minute safety margin. */
export const MAKS_ALDER_SEKUNDER = 7 * 24 * 3600 - 600;
/** Clock skew tolerated before an event_time counts as being in the future. */
export const MAKS_FREMTID_SEKUNDER = 300;

export type CrmType = "lead" | "salgsmulighet";
export interface Steg { key: string; navn: string }

/** CRM stage -> Meta event_name. Unknown or empty statuses are never reported. */
export const STEG: Record<CrmType, Record<string, Steg>> = {
  lead: {
    "Ny": { key: "lead_ny", navn: "Lead: Ny" },
    "Kontaktet": { key: "lead_kontaktet", navn: "Lead: Kontaktet" },
    "Svarte ikke telefon": { key: "lead_svarte_ikke", navn: "Lead: Svarte ikke telefon" },
    "Kvalifisert": { key: "lead_kvalifisert", navn: "Lead: Kvalifisert" },
    "Ikke aktuelt": { key: "lead_ikke_aktuelt", navn: "Lead: Ikke aktuelt" },
    "Konvertert til salg": { key: "lead_til_salgsmulighet", navn: "Lead: Konvertert til salgsmulighet" },
    "Konvertert til partner": { key: "lead_til_partner", navn: "Lead: Konvertert til partner" },
  },
  salgsmulighet: {
    "Møte booket": { key: "salg_mote_booket", navn: "Salgsmulighet: Møte booket" },
    "Demo gjennomført": { key: "salg_demo_gjennomfort", navn: "Salgsmulighet: Demo gjennomført" },
    "Behov avklart": { key: "salg_demo_gjennomfort", navn: "Salgsmulighet: Demo gjennomført" },
    "Løsning presentert": { key: "salg_demo_gjennomfort", navn: "Salgsmulighet: Demo gjennomført" },
    "Demo-prosjekt": { key: "salg_demo_prosjekt", navn: "Salgsmulighet: Demo-prosjekt" },
    "Tilbud sendt": { key: "salg_tilbud_sendt", navn: "Salgsmulighet: Tilbud sendt" },
    "Kontrakt sendt": { key: "salg_kontrakt_sendt", navn: "Salgsmulighet: Kontrakt sendt" },
    "Vunnet": { key: "salg_vunnet", navn: "Salgsmulighet: Vunnet" },
    "Tapt": { key: "salg_tapt", navn: "Salgsmulighet: Tapt" },
  },
};

/** The only stage that is a final conversion (a won customer). */
export const SLUTTKONVERTERING = "salg_vunnet";

export function metaCapiSteg(type: CrmType, status: string | null | undefined): Steg | null {
  if (!status) return null;
  return STEG[type]?.[status] ?? null;
}

export function erGyldigLeadgenId(id: unknown): id is string {
  return typeof id === "string" && /^[0-9]{6,20}$/.test(id);
}

export function erGyldigDatasettId(id: unknown): boolean {
  return typeof id === "string" && /^[0-9]{5,20}$/.test(id.trim());
}

export function erGyldigTestkode(kode: unknown): kode is string {
  return typeof kode === "string" && /^[A-Za-z0-9_-]{4,64}$/.test(kode);
}

/** Deterministic, idempotent keys: one milestone per Meta lead and stage. */
export function milestoneKey(leadgenId: string, stageKey: string): string {
  return `${leadgenId}:${stageKey}`;
}
export function eventId(leadgenId: string, stageKey: string): string {
  return `snakk-crm:${milestoneKey(leadgenId, stageKey)}`;
}

export interface KoRad {
  event_id: string;
  event_name: string;
  event_time: string;
  leadgen_id: string;
}

/**
 * Build one Conversion Leads event. Only the Meta lead ID is sent as customer data,
 * as a string so 15–17 digit IDs keep full precision. No value, contact data or free text.
 */
export function byggCapiHendelse(rad: KoRad) {
  if (!erGyldigLeadgenId(rad.leadgen_id)) throw new Error("Ugyldig Meta lead-ID");
  return {
    event_name: rad.event_name,
    event_time: Math.floor(new Date(rad.event_time).getTime() / 1000),
    event_id: rad.event_id,
    action_source: ACTION_SOURCE,
    user_data: { lead_id: rad.leadgen_id },
    custom_data: { event_source: EVENT_SOURCE, lead_event_source: LEAD_EVENT_SOURCE },
  };
}

export type TidsVurdering = { ok: true } | { ok: false; grunn: "for_gammel" | "fremtid" | "for_lead" | "ugyldig" };

/** Meta discards events older than 7 days, in the future, or before the lead was generated. */
export function vurderTid(eventTime: string, leadOpprettet: string | null | undefined, naa: Date = new Date()): TidsVurdering {
  const t = new Date(eventTime).getTime();
  if (!Number.isFinite(t)) return { ok: false, grunn: "ugyldig" };
  const n = naa.getTime();
  if (t > n + MAKS_FREMTID_SEKUNDER * 1000) return { ok: false, grunn: "fremtid" };
  if (n - t > MAKS_ALDER_SEKUNDER * 1000) return { ok: false, grunn: "for_gammel" };
  if (leadOpprettet) {
    const l = new Date(leadOpprettet).getTime();
    if (Number.isFinite(l) && t < l) return { ok: false, grunn: "for_lead" };
  }
  return { ok: true };
}

export const TID_GRUNN_TEKST: Record<string, string> = {
  for_gammel: "Endringen er eldre enn 7 dager og godtas ikke av Meta",
  fremtid: "Tidspunktet ligger i fremtiden",
  for_lead: "Tidspunktet er før leadet ble sendt inn hos Meta",
  ugyldig: "Ugyldig tidspunkt",
};

export type Svarklasse = "sendt" | "auth" | "rate" | "midlertidig" | "permanent";

const RATE_KODER = new Set([4, 17, 32, 613, 80004]);
const MIDLERTIDIGE_KODER = new Set([1, 2]);

/**
 * Classify a Conversions API response. Success requires events_received to equal the
 * number of events sent — a 200 without that confirmation is not counted as sent.
 */
export function klassifiserSvar(status: number, body: Record<string, unknown> | null, antallSendt = 1): Svarklasse {
  if (status >= 200 && status < 300) {
    return Number(body?.events_received) === antallSendt ? "sendt" : "permanent";
  }
  const err = (body?.error ?? {}) as Record<string, unknown>;
  const code = Number(err.code ?? 0);
  const subcode = Number(err.error_subcode ?? 0);
  const msg = String(err.message ?? "").toLowerCase();
  if (code === 190 || subcode === 458 || subcode === 460 || subcode === 463 ||
      msg.includes("error validating access token") || msg.includes("session has expired") ||
      msg.includes("invalid oauth_access_token")) return "auth";
  if (status === 401) return "auth";
  if (status === 429 || RATE_KODER.has(code)) return "rate";
  if (status === 408 || status >= 500 || MIDLERTIDIGE_KODER.has(code) || err.is_transient === true) return "midlertidig";
  return "permanent";
}

/** Exponential backoff, 1 min → max 1 h. attempt is 1-based. */
export function ventetidSekunder(attempt: number): number {
  return Math.min(60 * Math.pow(2, Math.max(0, attempt - 1)), 3600);
}

/** Remove anything that could be a secret or contact data before storing or logging an error. */
export function redigerFeil(tekst: unknown): string {
  let t = typeof tekst === "string" ? tekst : JSON.stringify(tekst ?? "");
  t = t.replace(/(access_token|token|appsecret_proof|authorization)(["'\s:=]+)(Bearer\s+)?[A-Za-z0-9._\-|]{8,}/gi, "$1$2***");
  t = t.replace(/Bearer\s+[A-Za-z0-9._\-|]{8,}/gi, "Bearer ***");
  t = t.replace(/EAA[A-Za-z0-9]{10,}/g, "***");
  t = t.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[e-post]");
  t = t.replace(/\+?\d[\d\s-]{7,}\d/g, (m) => (/^\d{15,17}$/.test(m) ? m : "[nummer]"));
  return t.slice(0, 500);
}

/** Pick only non-sensitive fields from a Meta error body. */
export function metaFeiltekst(status: number, body: Record<string, unknown> | null): string {
  const err = (body?.error ?? null) as Record<string, unknown> | null;
  if (!err) return redigerFeil(`HTTP ${status}`);
  const deler = [
    `HTTP ${status}`,
    err.code != null ? `kode ${err.code}` : null,
    err.error_subcode != null ? `underkode ${err.error_subcode}` : null,
    err.error_user_title ? String(err.error_user_title) : null,
    err.message ? String(err.message) : null,
  ].filter(Boolean);
  return redigerFeil(deler.join(" · "));
}

export interface CapiKonfig {
  token: boolean;
  datasett: boolean;
  sider: boolean;
}

export function lesKonfig(env: { get(k: string): string | undefined | null }): CapiKonfig {
  return {
    token: !!(env.get("META_CAPI_ACCESS_TOKEN") ?? "").trim(),
    datasett: erGyldigDatasettId(env.get("META_CAPI_DATASET_ID") ?? ""),
    sider: (env.get("META_PAGE_IDS") ?? "").split(/[,\s]+/).some((s) => s.trim().length > 0),
  };
}

export interface CapiTilstand {
  produksjon_aktiv?: boolean | null;
  pauset?: boolean | null;
  test_ok_at?: string | null;
}

export type Driftsstatus = "mangler_konfigurasjon" | "deaktivert" | "pauset" | "aktiv";

/** Production sending needs every secret, an explicit switch-on, and no pause. */
export function driftsstatus(k: CapiKonfig, s: CapiTilstand | null | undefined): Driftsstatus {
  if (!k.token || !k.datasett || !k.sider) return "mangler_konfigurasjon";
  if (!s?.produksjon_aktiv) return "deaktivert";
  if (s.pauset) return "pauset";
  return "aktiv";
}

export function kanAktiveres(k: CapiKonfig, s: CapiTilstand | null | undefined): boolean {
  return k.token && k.datasett && k.sider && !!s?.test_ok_at;
}
