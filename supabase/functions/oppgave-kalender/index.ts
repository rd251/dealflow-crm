// Legger nye oppgaver i Google Kalender til ansvarlig (eller den som opprettet).
// Kalles av databasetriggeren trg_oppgave_kalender. Idempotent via oppgaver.google_event_id.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const CRM_URL = "https://snakk-ai.lovable.app/oppgaver";
const UUID = /^[0-9a-f-]{36}$/i;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

async function tilgangsnokkel(sb: any, conn: any): Promise<string | null> {
  if (new Date(conn.token_expires_at).getTime() > Date.now() + 60_000) return conn.access_token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: conn.refresh_token, grant_type: "refresh_token",
    }),
  });
  if (!res.ok) { console.error("Token-fornyelse feilet", res.status, await res.text()); return null; }
  const t = await res.json();
  await sb.from("google_calendar_connections").update({
    access_token: t.access_token,
    token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
  }).eq("user_id", conn.user_id);
  return t.access_token;
}


Deno.serve(async (req) => {
  try {
    const { oppgave_id } = await req.json().catch(() => ({}));
    if (!oppgave_id || !UUID.test(oppgave_id)) return json({ error: "oppgave_id mangler" }, 400);
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: o } = await sb.from("oppgaver").select("*").eq("id", oppgave_id).maybeSingle();
    if (!o) return json({ skipped: "fant ikke oppgaven" });
    if (o.google_event_id || o.status === "Ferdig") return json({ skipped: "allerede i kalender eller ferdig" });

    // Ansvarlig lagres som bruker-ID, eldre oppgaver som visningsnavn.
    let mottaker: string | null = null;
    if (o.ansvarlig && UUID.test(o.ansvarlig)) mottaker = o.ansvarlig;
    else if (o.ansvarlig) {
      const { data: p } = await sb.from("profiles").select("user_id").eq("display_name", o.ansvarlig).maybeSingle();
      mottaker = p?.user_id ?? null;
    }
    const kandidater = [mottaker, o.user_id].filter(Boolean) as string[];
    let conn: any = null;
    for (const id of kandidater) {
      const { data } = await sb.from("google_calendar_connections").select("*").eq("user_id", id).maybeSingle();
      if (data) { conn = data; break; }
    }
    if (!conn) return json({ skipped: "ingen tilkoblet Google-kalender" });

    const token = await tilgangsnokkel(sb, conn);
    if (!token) return json({ error: "kunne ikke fornye Google-tilgang" }, 502);

    let kobling = "";
    if (o.selskap_id) {
      const { data: s } = await sb.from("selskaper").select("firmanavn").eq("id", o.selskap_id).maybeSingle();
      if (s?.firmanavn) kobling = s.firmanavn;
    }
    // Timet oppføring (ikke heldags) slik at den ikke fyller hele kalenderdagen.
    // Bruker klokkeslett fra fristen hvis det finnes, ellers STANDARD_STARTTID.
    const TIDSSONE = "Europe/Oslo";
    const STANDARD_STARTTID = "09:00";
    const VARIGHET_MINUTTER = 30;
    const dato = (o.frist || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const tidMatch = typeof o.frist === "string" ? o.frist.match(/T(\d{2}:\d{2})/) : null;
    const startTid = tidMatch ? tidMatch[1] : STANDARD_STARTTID;
    const [t, min] = startTid.split(":").map(Number);
    const sluttMinTotal = t * 60 + min + VARIGHET_MINUTTER;
    const sluttTid = `${String(Math.floor(sluttMinTotal / 60) % 24).padStart(2, "0")}:${String(sluttMinTotal % 60).padStart(2, "0")}`;
    const event = {
      summary: `✅ ${o.oppgave}${kobling ? ` – ${kobling}` : ""}`,
      description: [o.notater, `Prioritet: ${o.prioritet}`, `Åpne i CRM: ${CRM_URL}`].filter(Boolean).join("\n\n"),
      start: { dateTime: `${dato}T${startTid}:00`, timeZone: TIDSSONE },
      end: { dateTime: `${dato}T${sluttTid}:00`, timeZone: TIDSSONE },
      transparency: "transparent",
      extendedProperties: { private: { snakk_oppgave_id: o.id } },
    };
    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Google Kalender feilet [${res.status}]: ${body}`);
      return json({ error: "Google Kalender feilet", status: res.status, details: body }, res.status);
    }
    const created = await res.json();
    await sb.from("oppgaver").update({ google_event_id: created.id }).eq("id", o.id);
    return json({ ok: true, event_id: created.id, kalender_eier: conn.user_id });
  } catch (e) {
    console.error("oppgave-kalender", e);
    return json({ error: String(e) }, 500);
  }
});
