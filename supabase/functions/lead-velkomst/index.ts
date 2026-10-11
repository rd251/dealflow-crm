// Sender en personlig «Skal vi ta en prat?»-e-post fra Robins Gmail ca. 5 min etter at et nytt lead kom inn.
// Vekkes av en minuttsjobb som bare finnes mens leads venter, og som stopper seg selv når køen er tom.
import { createClient } from "npm:@supabase/supabase-js@2";
import { registrerVenterPaSvar } from "../_shared/awaiting-reply.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AVSENDER_EPOST = "rd@snakk.ai";
const FORSINKELSE_MINUTTER = 4;
const MAKS_ALDER_TIMER = 24;
const BATCH = 5;
const EMNE = "Snakk AI – Skal vi ta en prat?";
const MODEL = "openai/gpt-6-astra";
const json = { "Content-Type": "application/json" };

async function hentToken(sb: any, conn: any): Promise<string | null> {
  if (new Date(conn.token_expires_at).getTime() > Date.now() + 60000) return conn.access_token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const r = await res.json();
  await sb.from("google_calendar_connections").update({
    access_token: r.access_token,
    token_expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString(),
  }).eq("user_id", conn.user_id);
  return r.access_token;
}

const b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));

function fornavn(navn: string | null): string {
  return (navn || "").trim().split(/\s+/)[0] || "";
}

function malTekst(l: any): string {
  const n = fornavn(l.kontaktperson);
  const firma = l.firmanavn && l.firmanavn !== l.kontaktperson && l.firmanavn !== "Ukjent" ? ` i ${l.firmanavn}` : "";
  return `Hei${n ? " " + n : ""}! 😊

Så hyggelig at du har vist interesse for Snakk AI!

Kunne vi satt opp et kort møte hvor vi går litt dypere inn i hvordan dere jobber${firma} i dag, hvilke behov dere har, og hvordan vi eventuelt kan hjelpe dere med å automatisere og effektivisere arbeidsflyten?

Jeg viser deg gjerne mulighetene i den nye plattformen vår, så kan vi sammen se hva som kan være relevant for dere.

Har du anledning til en prat en dag denne uken?

Ser frem til å høre fra deg! 😊`;
}

async function aiTekst(l: any): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  const instr = `Du skriver en kort, varm og personlig første e-post på norsk (bokmål) fra Robin i Snakk AI til et nytt lead.
Følg denne malen tett i tone, lengde og struktur, men tilpass setning 3 til det leadet faktisk har skrevet/meldt interesse for (bruksområde, notater, bedrift). Ikke finn på detaljer som ikke står i dataene. Ikke ta med hilsen/signatur til slutt – den legges på automatisk. Ingen plassholdere i klammer.

MAL:
${malTekst({ kontaktperson: "Stig Arne", firmanavn: "EasyMarketing" }).replace("Så hyggelig at du har vist interesse for Snakk AI!", "Så hyggelig at du har vist interesse for Snakk AI!\n\nJeg så at du hadde meldt interesse for løsningen vår for kundeservice og saksbehandling.")}`;
  const data = {
    kontaktperson: l.kontaktperson, firmanavn: l.firmanavn, rolle: l.rolle_i_firma,
    bruksomraade: l.use_case, kilde: l.kilde, notater: (l.notater || "").slice(0, 3000),
  };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { ...json, "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: MODEL,
        reasoning: { effort: "low" },
        instructions: instr,
        input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify(data) }] }],
        text: { format: { type: "json_schema", name: "epost", strict: true, schema: {
          type: "object", additionalProperties: false, required: ["tekst"], properties: { tekst: { type: "string" } },
        } } },
      }),
    });
    if (!res.ok) { console.error("AI feilet", res.status, (await res.text()).slice(0, 300)); return null; }
    const r = await res.json();
    const out = r.output_text ?? r.output?.flatMap((o: any) => o.content ?? []).find((c: any) => c.type === "output_text")?.text;
    const tekst = JSON.parse(out || "{}").tekst?.trim();
    if (!tekst || /\[[^\]]{1,80}\]/.test(tekst)) return null;
    return tekst;
  } catch (e) { console.error("AI-feil", e); return null; }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const naa = Date.now();
  const resultater: any[] = [];

  // Gamle ventende (eldre enn 24 t) sendes ikke – de markeres som hoppet over.
  await sb.from("leads").update({ velkomst_status: "hoppet_over", velkomst_feil: "For gammel" })
    .eq("velkomst_status", "venter").lt("created_at", new Date(naa - MAKS_ALDER_TIMER * 3600e3).toISOString());

  const { data: klare } = await sb.from("leads")
    .select("id").eq("velkomst_status", "venter")
    .lte("created_at", new Date(naa - FORSINKELSE_MINUTTER * 60e3).toISOString())
    .order("created_at").limit(BATCH);

  if (klare?.length) {
    const { data: prof } = await sb.from("profiles").select("user_id, signatur_navn, display_name").eq("email", AVSENDER_EPOST).maybeSingle();
    const { data: conn } = prof ? await sb.from("google_calendar_connections").select("*").eq("user_id", prof.user_id).eq("gmail_sync_enabled", true).maybeSingle() : { data: null };
    const token = conn ? await hentToken(sb, conn) : null;

    for (const { id } of klare) {
      // Atomisk krav – hindrer dobbel sending hvis to kjøringer overlapper.
      const { data: l } = await sb.from("leads").update({ velkomst_status: "sender" })
        .eq("id", id).eq("velkomst_status", "venter").select("*").maybeSingle();
      if (!l) continue;
      const feil = async (m: string) => {
        await sb.from("leads").update({ velkomst_status: "feilet", velkomst_feil: m.slice(0, 500) }).eq("id", id);
        resultater.push({ id, feil: m });
      };
      if (!token || !prof) { await feil("Gmail for rd@snakk.ai er ikke koblet til"); continue; }

      // Hopp over hvis noen allerede har tatt kontakt eller adressen finnes fra før.
      const { count: kontakt } = await sb.from("aktiviteter").select("id", { count: "exact", head: true })
        .eq("lead_id", id).in("type", ["E-post", "Telefonsamtale", "Møte"]);
      const { count: dupl } = await sb.from("leads").select("id", { count: "exact", head: true })
        .ilike("e_post", l.e_post).neq("id", id);
      if ((kontakt ?? 0) > 0 || (dupl ?? 0) > 0) {
        await sb.from("leads").update({ velkomst_status: "hoppet_over", velkomst_feil: kontakt ? "Allerede kontaktet" : "Eksisterende kontakt" }).eq("id", id);
        resultater.push({ id, hoppet_over: true });
        continue;
      }

      const navn = prof.signatur_navn || prof.display_name || "Robin Sæter Diallo";
      const tekst = `${(await aiTekst(l)) ?? malTekst(l)}\n\nMvh\n${navn}\nSnakk AI`;
      const raw = [
        `From: =?UTF-8?B?${b64(navn)}?= <${AVSENDER_EPOST}>`,
        `To: ${l.e_post}`,
        `Subject: =?UTF-8?B?${b64(EMNE)}?=`,
        "MIME-Version: 1.0",
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: base64",
        "",
        b64(tekst),
      ].join("\r\n");
      const send = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, ...json },
        body: JSON.stringify({ raw: b64(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") }),
      });
      if (!send.ok) { await feil(`Gmail ${send.status}: ${(await send.text()).slice(0, 300)}`); continue; }
      const s = await send.json();

      const { data: akt } = await sb.from("aktiviteter").insert({
        type: "E-post", tittel: `→ ${EMNE}`, beskrivelse: `[${l.e_post}] ${tekst.slice(0, 1500)}`,
        dato: new Date().toISOString(), lead_id: id, ekstern_id: s.id, ekstern_provider: "gmail",
        aktivitet_kilde: "gmail_sendt", user_id: prof.user_id,
      }).select("id").maybeSingle();
      await sb.from("leads").update({ velkomst_status: "sendt", velkomst_sendt_at: new Date().toISOString(), velkomst_feil: null }).eq("id", id);
      await registrerVenterPaSvar(sb, {
        userId: prof.user_id, threadId: s.threadId || s.id, emne: EMNE, tekst,
        ePost: l.e_post, leadId: id, aktivitetId: akt?.id ?? null,
      });
      resultater.push({ id, sendt: true });
    }
  }

  await sb.rpc("lead_velkomst_stopp");
  return new Response(JSON.stringify({ behandlet: resultater }), { headers: json });
});
