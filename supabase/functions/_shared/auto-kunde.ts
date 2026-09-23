// Oppretter kundeforhold automatisk når en kunde signerer selv via plattformen.
// Leser signerte DealBuilder-avtaler, henter pris fra selve kontrakten (PDF),
// og bygger selskap + salgsmulighet (Vunnet) + prosjekt + konverterer leadet.

import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

const DEALBUILDER_API = "https://api.dealbuilder.io/v1/Documents?PageSize=1000";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

/** Kilde som settes på selskap og salgsmulighet ved selvbetjent signering. */
export const AUTO_KILDE = "Nettside";
/** Statuser i DealBuilder som betyr at avtalen er signert. */
export const SIGNERTE_STATUSER = ["Signed", "Accepted", "Completed"];
/** Maks antall dokumenter som behandles i én kjøring. */
export const MAKS_PER_KJORING = 20;

export interface DbDokument {
  id: string;
  title?: string;
  status?: string;
  createdDate?: string;
  signedDate?: string;
  pdfUrl?: string;
  uploadedDocumentUrl?: string;
  parties?: Array<Record<string, unknown>>;
}

export interface KontraktPris {
  pakke: string;
  maanedspris: number;
  oppstartskostnad: number;
}

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const iDag = () => new Date().toISOString().split("T")[0];

export async function hentDealBuilderDokumenter(): Promise<DbDokument[]> {
  const key = Deno.env.get("DEALBUILDER_API_KEY");
  if (!key) return [];
  const res = await fetch(DEALBUILDER_API, { headers: { "x-api-key": key } });
  if (!res.ok) return [];
  const data = await res.json();
  const list = data?.data?.items || data?.data || data?.items || data || [];
  return Array.isArray(list) ? list : [];
}

export function erPartneravtale(tittel: string): boolean {
  const t = tittel.toLowerCase();
  return t.includes("samarbeid") || t.includes("partner");
}

export function eksternSignatar(doc: DbDokument) {
  const parties = doc.parties || [];
  const p = (parties.find((x) => Array.isArray(x.roles) && (x.roles as string[]).includes("ExternalSignatory")) ||
    parties[0] || {}) as Record<string, string>;
  const navn = [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || String(p.name || "").trim();
  return {
    navn,
    epost: String(p.email || "").toLowerCase().trim(),
    telefon: String(p.phoneNumber || "").trim(),
    firmanavn: String(p.companyName || "").trim(),
    orgnr: digits(p.companyOrgNumber),
    adresse: String(p.address || p.visitAddress || "").trim(),
  };
}

/** Henter tekst fra den signerte PDF-en. */
async function pdfTekst(doc: DbDokument): Promise<string> {
  const url = doc.uploadedDocumentUrl || doc.pdfUrl;
  if (!url) return "";
  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    const buf = new Uint8Array(await res.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    return String(text || "");
  } catch (e) {
    console.error("auto-kunde: kunne ikke lese PDF", String(e));
    return "";
  }
}

const prisSkjema = {
  type: "object",
  additionalProperties: false,
  required: ["pakke", "maanedspris", "oppstartskostnad"],
  properties: {
    pakke: { type: "string" },
    maanedspris: { type: "number" },
    oppstartskostnad: { type: "number" },
  },
};

const PRIS_SYSTEM =
  "Du leser en signert norsk avtaletekst fra Snakk Teknologi AS og henter ut prisen kunden har valgt. " +
  "«pakke» er navnet på den valgte pakken (f.eks. «Telefon Basis», «Møter Ubegrenset»), tom streng hvis den ikke står. " +
  "«maanedspris» er totalen kunden betaler per måned i hele kroner eks. mva. (se «Til sammen per måned» eller «Valgt pakke»). " +
  "«oppstartskostnad» er engangsbeløpet ved oppstart i hele kroner, 0 hvis det ikke finnes. " +
  "Aldri gjett: står ikke beløpet i teksten, bruk 0.";

/** Leser pakke og beløp ut av kontraktsteksten. Returnerer null når det ikke lar seg lese. */
export async function lesPrisFraKontrakt(doc: DbDokument): Promise<KontraktPris | null> {
  const tekst = await pdfTekst(doc);
  if (!tekst.trim()) return null;
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      reasoning: { effort: "low" },
      instructions: PRIS_SYSTEM,
      input: [{ role: "user", content: [{ type: "input_text", text: tekst.slice(0, 12000) }] }],
      text: { format: { type: "json_schema", name: "kontraktpris", strict: true, schema: prisSkjema } },
    }),
  });
  if (!res.ok) {
    console.error("auto-kunde: gateway", res.status, (await res.text().catch(() => "")).slice(0, 300));
    return null;
  }
  const data = await res.json();
  const raw = data.output_text ??
    data.output?.flatMap((o: any) => o.content || []).find((c: any) => c.type === "output_text")?.text ?? "";
  try {
    const p = JSON.parse(raw);
    return {
      pakke: String(p.pakke || "").trim(),
      maanedspris: Math.max(0, Math.round(Number(p.maanedspris) || 0)),
      oppstartskostnad: Math.max(0, Math.round(Number(p.oppstartskostnad) || 0)),
    };
  } catch {
    return null;
  }
}

/** Signeringer eldre enn dette regnes som etterslep – ingen varsel sendes. */
export const VARSEL_MAKS_ALDER_DAGER = 2;

export function erFerskSignering(signertDato?: string | null): boolean {
  if (!signertDato) return false;
  const t = Date.parse(signertDato);
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= VARSEL_MAKS_ALDER_DAGER * 24 * 60 * 60 * 1000;
}

export interface AutoResultat {
  dokument_id: string;
  status: "opprettet" | "hoppet_over";
  aarsak?: string;
  selskap_id?: string;
  salgsmulighet_id?: string;
  mrr?: number;
  signert_dato?: string;
}

/**
 * Oppretter kundeforholdet for én signert selvbetjent avtale.
 * Idempotent: hopper over dokumenter som allerede er koblet til en salgsmulighet.
 */
export async function opprettKundeFraDokument(
  supabase: any,
  doc: DbDokument,
): Promise<AutoResultat> {
  const docId = String(doc.id);
  const tittel = String(doc.title || "Avtale");

  if (!SIGNERTE_STATUSER.includes(String(doc.status))) {
    return { dokument_id: docId, status: "hoppet_over", aarsak: "ikke signert" };
  }
  if (erPartneravtale(tittel)) {
    return { dokument_id: docId, status: "hoppet_over", aarsak: "partneravtale" };
  }

  const { data: alleredeKoblet } = await supabase
    .from("salgsmuligheter").select("id").eq("dealbuilder_dokument_id", docId).maybeSingle();
  if (alleredeKoblet) {
    return { dokument_id: docId, status: "hoppet_over", aarsak: "allerede koblet", salgsmulighet_id: alleredeKoblet.id };
  }

  const sig = eksternSignatar(doc);
  if (!sig.firmanavn && !sig.epost) {
    return { dokument_id: docId, status: "hoppet_over", aarsak: "mangler signatar" };
  }
  const domene = sig.epost.includes("@") ? sig.epost.split("@")[1] : "";

  // --- Selskap: finn eller opprett ---
  let selskapId: string | null = null;
  if (sig.orgnr) {
    const { data } = await supabase.from("selskaper").select("id").eq("orgnr", sig.orgnr).limit(1).maybeSingle();
    if (data) selskapId = data.id;
  }
  if (!selskapId && sig.firmanavn) {
    const { data } = await supabase.from("selskaper").select("id").ilike("firmanavn", sig.firmanavn).limit(1).maybeSingle();
    if (data) selskapId = data.id;
  }
  if (!selskapId && domene) {
    const { data } = await supabase.from("selskaper").select("id").ilike("domene", domene).limit(1).maybeSingle();
    if (data) selskapId = data.id;
  }

  // --- Pris fra selve kontrakten ---
  const pris = await lesPrisFraKontrakt(doc);
  const mrr = pris?.maanedspris ?? 0;
  const oppstart = pris?.oppstartskostnad ?? 0;
  const pakke = pris?.pakke || "";
  const today = iDag();
  const signertDato = doc.signedDate || doc.createdDate || new Date().toISOString();

  if (!selskapId) {
    const { data: nyttSelskap, error } = await supabase.from("selskaper").insert({
      firmanavn: sig.firmanavn || domene || sig.epost,
      orgnr: sig.orgnr || "",
      domene: domene || "",
      firmaadresse: sig.adresse || "",
      postadresse: "",
      kundestatus: "Pilot",
      kilde: AUTO_KILDE,
      mrr,
      arr: mrr * 12,
      oppstartskostnad: oppstart,
      live_status: false,
      onboarding_status: "Ikke startet",
      sist_aktivitet: today,
      lukkedato: today,
    }).select("id").single();
    if (error) return { dokument_id: docId, status: "hoppet_over", aarsak: `selskap: ${error.message}` };
    selskapId = nyttSelskap.id;
  } else {
    await supabase.from("selskaper").update({
      kundestatus: "Pilot",
      live_status: false,
      onboarding_status: "Ikke startet",
      mrr,
      arr: mrr * 12,
      oppstartskostnad: oppstart,
      sist_aktivitet: today,
      lukkedato: today,
      ...(sig.orgnr ? { orgnr: sig.orgnr } : {}),
    }).eq("id", selskapId);
  }

  // --- Kontaktperson ---
  let kontaktId: string | null = null;
  if (sig.epost) {
    const { data: eksisterende } = await supabase
      .from("kontakter").select("id, selskap_id").ilike("e_post", sig.epost).limit(1).maybeSingle();
    if (eksisterende) {
      kontaktId = eksisterende.id;
      if (!eksisterende.selskap_id) await supabase.from("kontakter").update({ selskap_id: selskapId }).eq("id", kontaktId);
    } else {
      const { data: nyKontakt } = await supabase.from("kontakter").insert({
        navn: sig.navn || sig.epost,
        e_post: sig.epost,
        telefon: sig.telefon || null,
        selskap_id: selskapId,
      }).select("id").maybeSingle();
      kontaktId = nyKontakt?.id ?? null;
    }
  }

  // --- Salgsmulighet (vunnet) ---
  const { data: deal, error: dealErr } = await supabase.from("salgsmuligheter").insert({
    navn: sig.firmanavn || tittel,
    selskap_id: selskapId,
    kontakt_id: kontaktId,
    kontaktperson: sig.navn || null,
    e_post: sig.epost || null,
    telefon: sig.telefon || null,
    status: "Vunnet",
    kilde: AUTO_KILDE,
    forventet_mrr: mrr,
    oppstartskostnad: oppstart,
    valgt_pakke: pakke,
    sannsynlighet: 100,
    vunnet_dato: signertDato.split("T")[0],
    opprettet_dato: signertDato.split("T")[0],
    sist_aktivitet: today,
    kontrakt_status: "Signert",
    kontrakt_signert_dato: signertDato,
    dealbuilder_dokument_id: docId,
    notater: "Signert selvbetjent via plattformen.",
  }).select("id").single();
  if (dealErr) return { dokument_id: docId, status: "hoppet_over", aarsak: `salgsmulighet: ${dealErr.message}` };

  // --- Prosjekt ---
  await supabase.from("prosjekter").insert({
    prosjektnavn: `Onboarding — ${sig.firmanavn || tittel}`,
    selskap_id: selskapId,
    salgsmulighet_id: deal.id,
    status: "Ny",
    startdato: today,
    oppstartskostnad: oppstart,
  });

  // --- Konverter lead(ene) ---
  const leadFilter: string[] = [];
  if (sig.epost) leadFilter.push(`e_post.ilike.${sig.epost}`);
  if (domene) leadFilter.push(`e_post.ilike.%@${domene}`);
  if (sig.firmanavn) leadFilter.push(`firmanavn.ilike.${sig.firmanavn}`);
  if (domene) leadFilter.push(`firmanavn.ilike.${domene}`);
  if (leadFilter.length) {
    await supabase.from("leads").update({
      status: "Konvertert til salg",
      konvertert_dato: today,
      sist_aktivitet: today,
    }).or(leadFilter.join(",")).not("status", "in", '("Konvertert til salg","Konvertert til partner")');
  }

  // --- Dokument, aktivitet og logg ---
  const { data: finnesDok } = await supabase
    .from("selskap_dokumenter").select("id").eq("dealbuilder_dokument_id", docId).maybeSingle();
  if (!finnesDok) {
    await supabase.from("selskap_dokumenter").insert({
      selskap_id: selskapId,
      dealbuilder_dokument_id: docId,
      tittel,
      fil_navn: tittel,
      fil_sti: "",
      fil_type: "dealbuilder",
      status: "Signert",
      opprettet_dato: signertDato,
      kilde: "dealbuilder",
      opplastet_av: "DealBuilder",
    });
  }

  await supabase.from("aktiviteter").insert({
    type: "Notat",
    tittel: "Kontrakt signert (selvbetjent)",
    beskrivelse: `${sig.navn || sig.epost || "Kunden"} signerte selv via plattformen — ${pakke || "pakke ikke oppgitt"}, ${mrr} kr/mnd.`,
    salgsmulighet_id: deal.id,
    selskap_id: selskapId,
    kontakt_id: kontaktId,
    aktivitet_kilde: "dealbuilder",
    dato: signertDato,
  });

  await supabase.from("crm_changelog").insert({
    event_type: "updated",
    entity_type: "salgsmulighet",
    entity_id: deal.id,
    entity_name: sig.firmanavn || tittel,
    field_name: "kontrakt_status",
    old_value: null,
    new_value: "Signert",
  });

  return { dokument_id: docId, status: "opprettet", selskap_id: selskapId!, salgsmulighet_id: deal.id, mrr };
}
