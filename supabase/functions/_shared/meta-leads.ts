// Shared, dependency-free helpers for the Meta Lead Ads integration.
// Kept pure so they can be unit tested without network or database access.

export const DEFAULT_GRAPH_VERSION = "v21.0";
export const MAX_BODY_BYTES = 512 * 1024; // 512 kB hard limit on webhook bodies
export const MAX_ATTEMPTS = 6;

/**
 * Fields that actually exist on a leadgen node. `form_name` does NOT exist there —
 * asking for it makes Graph reject the whole query with (#100).
 * The form's display name is fetched separately from the form node as optional enrichment.
 */
export const LEAD_GRAPH_FIELDS = [
  "id",
  "created_time",
  "field_data",
  "form_id",
  "ad_id",
  "adset_id",
  "campaign_id",
  "campaign_name",
  "ad_name",
  "platform",
  "is_organic",
] as const;

/** Timing-safe-ish comparison of two hex strings. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body with the app secret).
 * Missing header, missing secret or malformed header all fail closed.
 */
export async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | null | undefined,
): Promise<boolean> {
  if (!appSecret) return false;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  return safeEqual(toHex(sig), provided);
}

export interface ChallengeResult {
  status: number;
  body: string;
}

/** Handle Meta's GET verification handshake. */
export function handleChallenge(url: URL, verifyToken: string | null | undefined): ChallengeResult {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (!verifyToken) return { status: 503, body: "verify token not configured" };
  if (mode !== "subscribe") return { status: 400, body: "bad mode" };
  if (!token || !safeEqual(token, verifyToken)) return { status: 403, body: "forbidden" };
  if (!challenge) return { status: 400, body: "missing challenge" };
  return { status: 200, body: challenge };
}

export interface LeadgenEvent {
  leadgenId: string;
  pageId: string;
  formId: string | null;
  adId: string | null;
  adgroupId: string | null;
  createdTime: string | null;
  raw: unknown;
}

/** Pull every leadgen change out of every entry in a webhook payload. */
export function extractLeadgenEvents(payload: unknown): LeadgenEvent[] {
  const out: LeadgenEvent[] = [];
  const body = payload as { object?: string; entry?: unknown[] } | null;
  if (!body || body.object !== "page" || !Array.isArray(body.entry)) return out;

  for (const entry of body.entry) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const c = change as { field?: string; value?: Record<string, unknown> };
      if (c?.field !== "leadgen" || !c.value) continue;
      const v = c.value;
      const leadgenId = v.leadgen_id != null ? String(v.leadgen_id) : "";
      const pageId = v.page_id != null ? String(v.page_id) : "";
      if (!leadgenId || !pageId) continue;
      out.push({
        leadgenId,
        pageId,
        formId: v.form_id != null ? String(v.form_id) : null,
        adId: v.ad_id != null ? String(v.ad_id) : null,
        adgroupId: v.adgroup_id != null ? String(v.adgroup_id) : null,
        createdTime: v.created_time != null ? new Date(Number(v.created_time) * 1000).toISOString() : null,
        raw: change,
      });
    }
  }
  return out;
}

/** Server-configured page allowlist. Empty allowlist means nothing is accepted. */
export function parsePageAllowlist(raw: string | null | undefined): string[] {
  return (raw ?? "").split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

export function isAllowedPage(pageId: string, allowlist: string[]): boolean {
  return allowlist.includes(pageId);
}

export interface MetaFieldEntry {
  name?: string;
  values?: unknown[];
}

export interface MappedLead {
  firmanavn: string;
  kontaktperson: string;
  e_post: string;
  telefon: string;
  use_case: string;
  rolle_i_firma: string;
  /** All question/answer pairs, in the order Meta returned them. */
  qa: Array<{ question: string; answer: string }>;
}

const ALIASES: Record<keyof Omit<MappedLead, "qa">, string[]> = {
  kontaktperson: ["full_name", "name", "navn", "fullt_navn", "kontaktperson", "first_name", "fornavn"],
  e_post: ["email", "e_post", "epost", "e-post", "work_email", "jobb_e_post"],
  telefon: ["phone_number", "phone", "telefon", "telefonnummer", "mobil", "mobile_number"],
  firmanavn: ["company_name", "company", "firmanavn", "firma", "bedrift", "bedriftsnavn", "selskap"],
  rolle_i_firma: ["job_title", "role", "rolle", "stilling", "rolle_i_firma", "tittel"],
  use_case: ["use_case", "bruksomrade", "bruksområde", "produktinteresse", "product_interest", "interesse", "tjeneste"],
};

const LAST_NAME_KEYS = ["last_name", "etternavn", "surname"];

function firstValue(entry: MetaFieldEntry): string {
  const v = entry.values;
  if (!Array.isArray(v) || v.length === 0) return "";
  return v.map((x) => (x == null ? "" : String(x))).filter(Boolean).join(", ").trim();
}

/**
 * Map Meta field_data to CRM lead fields.
 * Every question/answer pair is preserved verbatim in `qa`; nothing is invented.
 */
export function mapLeadFields(fieldData: MetaFieldEntry[] | null | undefined): MappedLead {
  const mapped: MappedLead = {
    firmanavn: "", kontaktperson: "", e_post: "", telefon: "", use_case: "", rolle_i_firma: "", qa: [],
  };
  if (!Array.isArray(fieldData)) return mapped;

  let firstName = "";
  let lastName = "";

  for (const entry of fieldData) {
    const rawName = String(entry?.name ?? "").trim();
    const value = firstValue(entry ?? {});
    if (!rawName) continue;
    if (value) mapped.qa.push({ question: rawName, answer: value });
    if (!value) continue;

    const key = rawName.toLowerCase();
    if (LAST_NAME_KEYS.includes(key)) { lastName = value; continue; }
    if (key === "first_name" || key === "fornavn") { firstName = value; }

    for (const [target, aliases] of Object.entries(ALIASES) as Array<[keyof MappedLead, string[]]>) {
      if (target === "qa") continue;
      if (aliases.includes(key) && !mapped[target]) {
        (mapped as unknown as Record<string, string>)[target as string] = value;
        break;
      }
    }
  }

  if (lastName) {
    const base = firstName || mapped.kontaktperson;
    mapped.kontaktperson = base ? `${base} ${lastName}`.trim() : lastName;
  }
  return mapped;
}

/** Build the Norwegian notes block from the mapped answers and Meta metadata. */
export function buildNotes(
  mapped: MappedLead,
  meta: { formName?: string | null; formId?: string | null; adName?: string | null; adId?: string | null; campaignName?: string | null; campaignId?: string | null; leadgenId: string; createdTime?: string | null },
): string {
  const lines: string[] = ["Lead fra Meta Lead Ads (Instant Form)."];
  if (mapped.qa.length) {
    lines.push("", "Svar fra skjemaet:");
    for (const { question, answer } of mapped.qa) lines.push(`- ${question}: ${answer}`);
  }
  const metaLines: string[] = [];
  if (meta.formName) metaLines.push(`Skjema: ${meta.formName}${meta.formId ? ` (${meta.formId})` : ""}`);
  else if (meta.formId) metaLines.push(`Skjema-ID: ${meta.formId}`);
  if (meta.adName) metaLines.push(`Annonse: ${meta.adName}${meta.adId ? ` (${meta.adId})` : ""}`);
  else if (meta.adId) metaLines.push(`Annonse-ID: ${meta.adId}`);
  if (meta.campaignName) metaLines.push(`Kampanje: ${meta.campaignName}${meta.campaignId ? ` (${meta.campaignId})` : ""}`);
  else if (meta.campaignId) metaLines.push(`Kampanje-ID: ${meta.campaignId}`);
  metaLines.push(`Meta lead-ID: ${meta.leadgenId}`);
  if (meta.createdTime) metaLines.push(`Innsendt: ${meta.createdTime}`);
  lines.push("", ...metaLines);
  return lines.join("\n");
}

/** Exponential backoff with a cap, in seconds. attempt is 1-based. */
export function retryDelaySeconds(attempt: number): number {
  const base = 60 * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(base, 3600);
}

/** Graph/HTTP failures that are worth retrying. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

export function graphVersion(): string {
  const v = (Deno.env.get("META_GRAPH_VERSION") ?? "").trim();
  return /^v\d+\.\d+$/.test(v) ? v : DEFAULT_GRAPH_VERSION;
}

/**
 * Decides whether a signed-in user may call the worker. Only an explicit
 * admin row in public.user_roles grants access; every other role is denied.
 */
export function callerFromRoleRow(row: { role?: string } | null | undefined): "admin" | null {
  return row?.role === "admin" ? "admin" : null;
}
