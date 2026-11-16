// Deterministisk matching mot Brønnøysundregistrene (data.brreg.no). Ingen AI, ingen skraping.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import {
  avgjoer, type BrregData, type BrregKandidat, type BrregStatus, domeneSoeketekst, enhetStatus, erOrgnr, erProblem,
  erTullesvar, finnRolle, firmadomene, formaterAdresse, personNoekkel, type Rolle, scorKandidat, selskapsfelterFraBrreg,
} from "../_shared/brreg-match.ts";
import { authenticateCronRequest } from "../_shared/cron-auth.ts";

const ER = "https://data.brreg.no/enhetsregisteret/api";
const RR = "https://data.brreg.no/regnskapsregisteret/regnskap";
const TIMEOUT = 8000;

class BrregNede extends Error {}

const svar = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

let sisteKall = 0;
let struping = 0; // ms mellom kall (500 = maks 2/s i massejobber)

// deno-lint-ignore no-explicit-any
async function hent(url: string): Promise<any | null> {
  if (struping) {
    const vent = sisteKall + struping - Date.now();
    if (vent > 0) await new Promise((r) => setTimeout(r, vent));
    sisteKall = Date.now();
  }
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT) });
  } catch (e) {
    throw new BrregNede(`Brønnøysund svarte ikke: ${(e as Error).message}`);
  }
  if (res.status === 404 || res.status === 410) { await res.body?.cancel(); return null; }
  if (!res.ok) { await res.body?.cancel(); throw new BrregNede(`Brønnøysund svarte ${res.status}`); }
  return await res.json();
}

// deno-lint-ignore no-explicit-any
function tilKandidat(e: any): Omit<BrregKandidat, "score" | "begrunnelse"> {
  return {
    orgnr: e.organisasjonsnummer,
    navn: e.navn,
    organisasjonsform: e.organisasjonsform?.kode ?? null,
    kommune: e.forretningsadresse?.kommune ?? e.postadresse?.kommune ?? null,
    bransje: e.naeringskode1?.beskrivelse ?? null,
    ansatte: e.antallAnsatte ?? null,
    hjemmeside: e.hjemmeside ?? null,
    status: enhetStatus(e),
  };
}

async function hentRoller(orgnr: string): Promise<Rolle[]> {
  const d = await hent(`${ER}/enheter/${orgnr}/roller`);
  const ut: Rolle[] = [];
  for (const g of d?.rollegrupper ?? []) {
    for (const r of g.roller ?? []) {
      const p = r.person?.navn;
      if (!p || r.fratraadt || r.person?.erDoed) continue;
      ut.push({
        type: r.type?.kode ?? "",
        beskrivelse: r.type?.beskrivelse ?? "",
        noekkel: personNoekkel(p.fornavn ?? "", p.etternavn ?? ""),
        navn: [p.fornavn, p.mellomnavn, p.etternavn].filter(Boolean).join(" "),
      });
    }
  }
  return ut;
}

async function hentRegnskap(orgnr: string): Promise<BrregData["regnskap"]> {
  const d = await hent(`${RR}/${orgnr}`);
  if (!Array.isArray(d) || !d.length) return null;
  const siste = [...d].sort((a, b) => String(b.regnskapsperiode?.tilDato).localeCompare(String(a.regnskapsperiode?.tilDato)))[0];
  const res = siste.resultatregnskapResultat ?? {};
  return {
    aar: Number(String(siste.regnskapsperiode?.tilDato ?? "").slice(0, 4)) || 0,
    driftsinntekter: res.driftsresultat?.driftsinntekter?.sumDriftsinntekter ?? null,
    driftsresultat: res.driftsresultat?.driftsresultat ?? null,
    aarsresultat: res.aarsresultat ?? null,
    egenkapital: siste.egenkapitalGjeld?.egenkapital?.sumEgenkapital ?? null,
  };
}

async function fullData(orgnr: string, kontaktperson?: string | null): Promise<BrregData | null> {
  const e = await hent(`${ER}/enheter/${orgnr}`);
  if (!e) return null;
  const roller = await hentRoller(orgnr);
  const regnskap = await hentRegnskap(orgnr);
  const rolle = finnRolle(roller, kontaktperson);
  return {
    orgnr,
    navn: e.navn,
    organisasjonsform: e.organisasjonsform ? { kode: e.organisasjonsform.kode, beskrivelse: e.organisasjonsform.beskrivelse } : null,
    naeringskode1: e.naeringskode1 ? { kode: e.naeringskode1.kode, beskrivelse: e.naeringskode1.beskrivelse } : null,
    antallAnsatte: e.antallAnsatte ?? null,
    forretningsadresse: formaterAdresse(e.forretningsadresse),
    postadresse: formaterAdresse(e.postadresse),
    kommune: e.forretningsadresse?.kommune ?? e.postadresse?.kommune ?? null,
    hjemmeside: e.hjemmeside ?? null,
    epostadresse: e.epostadresse ?? null,
    telefon: e.telefon ?? null,
    mobil: e.mobil ?? null,
    stiftelsesdato: e.stiftelsesdato ?? null,
    registrertIMvaregisteret: !!e.registrertIMvaregisteret,
    konkurs: !!e.konkurs,
    underAvvikling: !!e.underAvvikling,
    underTvangsavviklingEllerTvangsopplosning: !!e.underTvangsavviklingEllerTvangsopplosning,
    slettedato: e.slettedato ?? null,
    status: enhetStatus(e),
    daglig_leder: roller.find((r) => r.type === "DAGL")?.navn ?? null,
    styreleder: roller.find((r) => r.type === "LEDE")?.navn ?? null,
    kontakt_rolle: rolle ? { navn: rolle.navn, rolle: rolle.beskrivelse } : null,
    regnskap,
  };
}

interface MatchResultat {
  status: BrregStatus;
  melding: string | null;
  orgnr: string | null;
  kandidater: BrregKandidat[];
  data: BrregData | null;
  sokt: boolean;
}

async function match(firmanavn: string, e_post: string | null, kontaktperson: string | null): Promise<MatchResultat> {
  const domene = firmadomene(e_post);
  const navn = (firmanavn ?? "").trim();
  const tom = !navn || (kontaktperson && navn.toLowerCase() === kontaktperson.trim().toLowerCase());
  if (erTullesvar(navn, kontaktperson) && !(tom && domene)) {
    return { status: "ingen", melding: "Firmanavn ikke oppgitt", orgnr: null, kandidater: [], data: null, sokt: false };
  }
  const soekNavn = erTullesvar(navn, kontaktperson) ? domeneSoeketekst(domene!) : navn;

  const orgnr = erOrgnr(navn);
  if (orgnr) {
    const data = await fullData(orgnr, kontaktperson);
    if (!data) return { status: "ingen", melding: "Org.nr finnes ikke i registeret", orgnr: null, kandidater: [], data: null, sokt: true };
    const k: BrregKandidat = {
      orgnr, navn: data.navn, organisasjonsform: data.organisasjonsform?.kode ?? null, kommune: data.kommune,
      bransje: data.naeringskode1?.beskrivelse ?? null, ansatte: data.antallAnsatte, hjemmeside: data.hjemmeside,
      status: data.status, score: 100, begrunnelse: ["Oppgitt org.nr (direkte oppslag)"], rolle: data.kontakt_rolle?.rolle ?? null,
    };
    return { status: "sikker", melding: null, orgnr, kandidater: [k], data, sokt: true };
  }

  const erKommune = /\bkommune\b/i.test(soekNavn);
  const sokTekst = soekNavn.replace(/\s+(as|asa|enk|da|sa|ans)\.?$/i, "").trim();
  const urler = [`${ER}/enheter?navn=${encodeURIComponent(sokTekst)}&size=${domene && soekNavn === domeneSoeketekst(domene) ? 100 : 20}${erKommune ? "&organisasjonsform=KOMM" : ""}`];
  if (domene && soekNavn !== domeneSoeketekst(domene)) urler.push(`${ER}/enheter?navn=${encodeURIComponent(domeneSoeketekst(domene))}&size=100`);

  const alle = new Map<string, BrregKandidat>();
  for (const u of urler) {
    const d = await hent(u);
    for (const e of d?._embedded?.enheter ?? []) {
      if (alle.has(e.organisasjonsnummer)) continue;
      const base = tilKandidat(e);
      const { score, begrunnelse } = scorKandidat(soekNavn, base, domene);
      alle.set(base.orgnr, { ...base, score, begrunnelse });
    }
  }
  let kandidater = [...alle.values()].filter((k) => k.score > (erKommune ? 5 : 0)).sort((a, b) => b.score - a.score);

  if (kontaktperson) {
    for (const k of kandidater.slice(0, 3)) {
      const rolle = finnRolle(await hentRoller(k.orgnr), kontaktperson);
      if (rolle) { k.score += 40; k.rolle = rolle.beskrivelse; k.begrunnelse.push(`${kontaktperson} står som ${rolle.beskrivelse} (+40)`); }
    }
    kandidater.sort((a, b) => b.score - a.score);
  }
  kandidater = kandidater.slice(0, 5);

  const a = avgjoer(kandidater, erKommune);
  if (a.status === "sikker" && a.valgt) {
    const data = await fullData(a.valgt.orgnr, kontaktperson);
    return { status: "sikker", melding: null, orgnr: a.valgt.orgnr, kandidater, data, sokt: true };
  }
  return { status: a.status, melding: a.melding, orgnr: null, kandidater: a.status === "ingen" ? [] : kandidater, data: null, sokt: true };
}

// ---------- Lagring ----------

// deno-lint-ignore no-explicit-any
async function oppdaterSelskap(sb: SupabaseClient, selskapId: string, data: BrregData, status: BrregStatus, kandidater?: BrregKandidat[] | null, eks?: any) {
  const s = eks ?? (await sb.from("selskaper").select("telefon, e_post, domene").eq("id", selskapId).maybeSingle()).data ?? {};
  const felt = selskapsfelterFraBrreg(data, s);
  await sb.from("selskaper").update({
    ...felt, brreg_status: status, brreg_data: data, brreg_hentet: new Date().toISOString(),
    ...(kandidater !== undefined ? { brreg_kandidater: kandidater } : {}),
  }).eq("id", selskapId);
}

async function lagreLead(sb: SupabaseClient, leadId: string, r: MatchResultat, oppgitt: string) {
  const { data: lead } = await sb.from("leads").select("rolle_i_firma, firmanavn").eq("id", leadId).maybeSingle();
  // deno-lint-ignore no-explicit-any
  const upd: Record<string, any> = {
    brreg_status: r.status,
    brreg_kandidater: r.kandidater,
    brreg_data: r.data ? { ...r.data, oppgitt_firmanavn: oppgitt } : { oppgitt_firmanavn: oppgitt, melding: r.melding },
    brreg_hentet: new Date().toISOString(),
    orgnr: r.orgnr,
  };
  if (r.data?.kontakt_rolle && !(lead?.rolle_i_firma ?? "").trim()) upd.rolle_i_firma = r.data.kontakt_rolle.rolle;
  await sb.from("leads").update(upd).eq("id", leadId);
}

async function matchLead(sb: SupabaseClient, leadId: string, overstyr?: { firmanavn?: string; e_post?: string | null; kontaktperson?: string | null }) {
  const { data: rad } = await sb.from("leads").select("id, firmanavn, e_post, kontaktperson, brreg_status").eq("id", leadId).maybeSingle();
  if (!rad) throw new Error("Fant ikke leadet");
  const l = { ...rad, ...(overstyr?.firmanavn !== undefined ? { firmanavn: overstyr.firmanavn } : {}), ...(overstyr?.e_post !== undefined && overstyr.e_post !== null ? { e_post: overstyr.e_post } : {}), ...(overstyr?.kontaktperson ? { kontaktperson: overstyr.kontaktperson } : {}) };
  const r = await match(l.firmanavn, l.e_post, l.kontaktperson);
  await lagreLead(sb, leadId, r, l.firmanavn);
  return r;
}

async function matchSelskap(sb: SupabaseClient, selskapId: string) {
  const { data: s } = await sb.from("selskaper").select("id, firmanavn, e_post, orgnr, telefon, domene").eq("id", selskapId).maybeSingle();
  if (!s) throw new Error("Fant ikke selskapet");
  if (erOrgnr(s.orgnr)) {
    const data = await fullData(erOrgnr(s.orgnr)!);
    if (data) { await oppdaterSelskap(sb, s.id, data, "manuell", null, s); return { status: "manuell", orgnr: data.orgnr, data, kandidater: [], melding: null }; }
  }
  const epost = s.e_post || (s.domene ? `x@${s.domene}` : null);
  const r = await match(s.firmanavn, epost, null);
  if (r.status === "sikker" && r.data) await oppdaterSelskap(sb, s.id, r.data, "sikker", r.kandidater, s);
  else await sb.from("selskaper").update({ brreg_status: r.status, brreg_kandidater: r.kandidater, brreg_data: r.melding ? { melding: r.melding } : null, brreg_hentet: new Date().toISOString() }).eq("id", s.id);
  return r;
}

/** Brukeren har valgt et selskap (org.nr) manuelt. */
async function velg(sb: SupabaseClient, orgnr: string, leadId?: string, selskapId?: string) {
  let kontakt: string | null = null;
  let oppgitt = "";
  if (leadId) {
    const { data: l } = await sb.from("leads").select("kontaktperson, firmanavn").eq("id", leadId).maybeSingle();
    kontakt = l?.kontaktperson ?? null; oppgitt = l?.firmanavn ?? "";
  }
  const data = await fullData(orgnr, kontakt);
  if (!data) throw new Error("Fant ikke org.nr i registeret");
  if (leadId) {
    const { data: l } = await sb.from("leads").select("rolle_i_firma").eq("id", leadId).maybeSingle();
    // deno-lint-ignore no-explicit-any
    const upd: Record<string, any> = { orgnr, brreg_status: "manuell", brreg_data: { ...data, oppgitt_firmanavn: oppgitt }, brreg_hentet: new Date().toISOString() };
    if (data.kontakt_rolle && !(l?.rolle_i_firma ?? "").trim()) upd.rolle_i_firma = data.kontakt_rolle.rolle;
    await sb.from("leads").update(upd).eq("id", leadId);
  }
  if (selskapId) await oppdaterSelskap(sb, selskapId, data, "manuell");
  return data;
}

async function sok(q: string) {
  const orgnr = erOrgnr(q);
  if (orgnr) {
    const e = await hent(`${ER}/enheter/${orgnr}`);
    return e ? [tilKandidat(e)] : [];
  }
  const d = await hent(`${ER}/enheter?navn=${encodeURIComponent(q.trim())}&size=10`);
  return (d?._embedded?.enheter ?? []).map(tilKandidat);
}

// ---------- Massejobber (ukentlig oppdatering og admin-matching) ----------

function selvKall(body: unknown) {
  // @ts-ignore EdgeRuntime finnes i Supabase
  const p = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/brreg-match`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
    body: JSON.stringify(body),
  }).catch((e) => console.error("Selvkall feilet", e));
  // @ts-ignore
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(p);
}

const BATCH_TID_MS = 100_000;

async function ukentligOppdatering(sb: SupabaseClient) {
  struping = 500;
  const start = Date.now();
  const grense = new Date(Date.now() - 6 * 86400_000).toISOString();
  let antall = 0;
  while (Date.now() - start < BATCH_TID_MS) {
    const { data: rader } = await sb.from("selskaper")
      .select("id, firmanavn, orgnr, telefon, e_post, domene, brreg_status, brreg_data, kundeansvarlig, eier_id")
      .neq("orgnr", "").or(`brreg_hentet.is.null,brreg_hentet.lt.${grense}`).order("brreg_hentet", { ascending: true, nullsFirst: true }).limit(5);
    if (!rader?.length) return { antall, ferdig: true };
    for (const s of rader) {
      const orgnr = erOrgnr(s.orgnr);
      if (!orgnr) { await sb.from("selskaper").update({ brreg_hentet: new Date().toISOString() }).eq("id", s.id); continue; }
      try {
        const data = await fullData(orgnr);
        if (!data) { await sb.from("selskaper").update({ brreg_hentet: new Date().toISOString() }).eq("id", s.id); continue; }
        const varProblem = erProblem(s.brreg_data);
        await oppdaterSelskap(sb, s.id, data, (s.brreg_status as BrregStatus) || "manuell", undefined, s);
        if (!varProblem && erProblem(data)) {
          await sb.from("oppgaver").insert({
            oppgave: `${s.firmanavn}: ${data.status} registrert i Brønnøysund`,
            ansvarlig: s.kundeansvarlig || null, user_id: s.eier_id || null, selskap_id: s.id,
            frist: new Date().toISOString().slice(0, 10), prioritet: "Høy", status: "Åpen",
            notater: `Brønnøysundregistrene viser nå «${data.status}» for org.nr ${orgnr}. Sjekk kundeforholdet.`,
          });
        }
        antall++;
      } catch (e) {
        if (e instanceof BrregNede) return { antall, ferdig: false, feil: e.message };
        console.error("Oppdatering feilet", s.id, e);
        await sb.from("selskaper").update({ brreg_hentet: new Date().toISOString() }).eq("id", s.id);
      }
    }
  }
  selvKall({ handling: "ukentlig" });
  return { antall, ferdig: false };
}

async function matchAlle(sb: SupabaseClient) {
  struping = 500;
  const start = Date.now();
  let antall = 0;
  while (Date.now() - start < BATCH_TID_MS) {
    const { data: s } = await sb.from("selskaper").select("id").is("brreg_status", null).is("brreg_hentet", null).limit(1).maybeSingle();
    const { data: l } = s ? { data: null } : await sb.from("leads").select("id").is("brreg_status", null).is("brreg_hentet", null).limit(1).maybeSingle();
    if (!s && !l) return { antall, ferdig: true };
    try {
      if (s) await matchSelskap(sb, s.id); else await matchLead(sb, l!.id);
    } catch (e) {
      if (e instanceof BrregNede) return { antall, ferdig: false, feil: e.message };
      console.error("Matching feilet", e);
      if (s) await sb.from("selskaper").update({ brreg_status: "ingen", brreg_hentet: new Date().toISOString() }).eq("id", s.id);
      else await sb.from("leads").update({ brreg_status: "ingen", brreg_hentet: new Date().toISOString() }).eq("id", l!.id);
    }
    antall++;
  }
  selvKall({ handling: "match_alle" });
  return { antall, ferdig: false };
}

// ---------- HTTP ----------

const Body = z.object({
  handling: z.enum(["ukentlig", "match_alle"]).optional(),
  lead_id: z.string().uuid().optional(),
  selskap_id: z.string().uuid().optional(),
  firmanavn: z.string().max(300).optional(),
  e_post: z.string().max(300).optional().nullable(),
  kontaktperson: z.string().max(300).optional().nullable(),
  sok: z.string().min(1).max(200).optional(),
  velg: z.string().regex(/^\d{9}$/).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return svar({ error: "Kun POST er støttet" }, 405);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const erTjeneste = token === serviceKey || (!!Deno.env.get("LOVABLE_CRON_SECRET") && authenticateCronRequest(req) === null);
  let kanRedigere = erTjeneste;
  let erAdmin = erTjeneste;
  if (!erTjeneste) {
    const { data: u } = await sb.auth.getUser(token);
    const user = u?.user;
    if (!user || !(user.email ?? "").toLowerCase().endsWith("@snakk.ai")) return svar({ error: "Du må være logget inn med en @snakk.ai-konto." }, 401);
    const { data: intern } = await sb.rpc("er_intern", { _user_id: user.id });
    if (!intern) return svar({ error: "Du har ikke tilgang til CRM-et." }, 403);
    kanRedigere = !!(await sb.rpc("kan_redigere_crm", { _user_id: user.id })).data;
    erAdmin = !!(await sb.rpc("has_role", { _user_id: user.id, _role: "admin" })).data;
  }

  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return svar({ error: "Ugyldig forespørsel", detaljer: p.error.flatten().fieldErrors }, 400);
  const b = p.data;
  const skriver = !!(b.lead_id || b.selskap_id || b.handling);
  if (skriver && !kanRedigere) return svar({ error: "Du har ikke skrivetilgang." }, 403);

  try {
    if (b.handling === "ukentlig") {
      if (!erTjeneste && !erAdmin) return svar({ error: "Kun admin" }, 403);
      return svar(await ukentligOppdatering(sb));
    }
    if (b.handling === "match_alle") {
      if (!erAdmin) return svar({ error: "Kun admin kan matche alle." }, 403);
      // Svar raskt; resten kjøres i bakgrunnen og fortsetter seg selv
      selvKallStart();
      return svar({ startet: true });
    }
    if (b.sok) return svar({ treff: await sok(b.sok) });
    if (b.velg) {
      if (!b.lead_id && !b.selskap_id) return svar({ error: "Mangler lead_id eller selskap_id" }, 400);
      return svar({ status: "manuell", data: await velg(sb, b.velg, b.lead_id, b.selskap_id) });
    }
    if (b.lead_id) return svar(await matchLead(sb, b.lead_id, { firmanavn: b.firmanavn, e_post: b.e_post, kontaktperson: b.kontaktperson }));
    if (b.selskap_id) return svar(await matchSelskap(sb, b.selskap_id));
    if (b.firmanavn !== undefined || b.e_post) return svar(await match(b.firmanavn ?? "", b.e_post ?? null, b.kontaktperson ?? null));
    return svar({ error: "Mangler input" }, 400);
  } catch (e) {
    if (e instanceof BrregNede) return svar({ error: "Brønnøysundregistrene svarer ikke akkurat nå. Prøv igjen senere.", nede: true }, 503);
    console.error(e);
    return svar({ error: (e as Error).message }, 500);
  }

  function selvKallStart() {
    const job = matchAlle(sb).catch((e) => console.error(e));
    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(job);
  }
});
