// Regler for å føre kontraktsinfo fra en opplastet PDF over på salgsmulighet og kundeforhold.
import type { PakkeLinje, Salgsmulighet, Selskap } from "@/data/crm-data";
import { beregnArr, type KontraktUttrekk, type KontraktPakke } from "../../supabase/functions/_shared/kontrakt-uttrekk";

export { beregnArr, normaliserUttrekk } from "../../supabase/functions/_shared/kontrakt-uttrekk";
export type { KontraktUttrekk, KontraktPakke };

/** Maks filstørrelse for AI-lesing og sending til DealBuilder. */
export const MAKS_KONTRAKT_BYTES = 10 * 1024 * 1024;

export const NY_SALGSMULIGHET = "ny";

export const UTTREKK_ETIKETTER: Record<string, string> = {
  firmanavn: "Firmanavn", orgnr: "Org.nr.", adresse: "Adresse", kontaktperson: "Kontaktperson",
  e_post: "E-post", telefon: "Telefon", pakker: "Pakker", mrr: "MRR", sla_per_mnd: "SLA per mnd",
  oppstartskostnad: "Oppstartskostnad", bindingstid_mnd: "Bindingstid", startdato: "Startdato",
  oppsigelsestid: "Oppsigelsestid", avtaledato: "Avtaledato",
};

const erLukket = (s: Salgsmulighet) => s.status === "Vunnet" || s.status === "Tapt";

/** Salgsmuligheter på selskapet, åpne først, deretter vunnet, tapt sist. */
export function salgsmuligheterForSelskap(alle: Salgsmulighet[], selskapId: string): Salgsmulighet[] {
  const rang = (s: Salgsmulighet) => (s.status === "Tapt" ? 2 : s.status === "Vunnet" ? 1 : 0);
  return alle
    .filter((s) => s.selskap_id === selskapId)
    .sort((a, b) => rang(a) - rang(b) || (b.sist_aktivitet || "").localeCompare(a.sist_aktivitet || ""));
}

/**
 * Forhåndsvalg: den eneste åpne salgsmuligheten, ellers det eneste aktive kundeforholdet (ikke tapt).
 * Ingen salgsmuligheter → «ny». Flere kandidater → "" (brukeren må velge).
 */
export function standardSalgsmulighet(sms: Salgsmulighet[]): string {
  if (sms.length === 0) return NY_SALGSMULIGHET;
  const aapne = sms.filter((s) => !erLukket(s));
  if (aapne.length === 1) return aapne[0].id;
  if (aapne.length === 0) {
    const aktive = sms.filter((s) => s.status !== "Tapt");
    if (aktive.length === 1) return aktive[0].id;
  }
  return "";
}

export function pakkeLinjer(pakker: KontraktPakke[]): PakkeLinje[] {
  return pakker.filter((p) => p.navn.trim()).map((p) => ({ pakke: p.navn.trim(), pris: Number(p.manedspris) || 0, minutter: p.minutter.trim() }));
}

export function sumPakker(pakker: KontraktPakke[]): number {
  return pakker.reduce((s, p) => s + (Number(p.manedspris) || 0), 0);
}

/**
 * Oppdaterer salgsmuligheten med kontraktsdata. MRR er brukerens bekreftede beløp;
 * SLA og oppstart lagres i egne felt og holdes utenfor MRR. Tomme felt i uttrekket beholder eksisterende verdi.
 */
export function medKontraktsinfo(sm: Salgsmulighet, u: KontraktUttrekk, iDag: string): Salgsmulighet {
  const linjer = pakkeLinjer(u.pakker);
  return {
    ...sm,
    valgte_pakker: linjer.length ? linjer : sm.valgte_pakker,
    valgt_pakke: linjer.length ? linjer.map((l) => l.pakke).join(" + ") : sm.valgt_pakke,
    forventet_mrr: Number(u.mrr) || 0,
    sla: u.sla_per_mnd ?? sm.sla,
    oppstartskostnad: u.oppstartskostnad ?? sm.oppstartskostnad,
    kontraktslengde_mnd: u.bindingstid_mnd ?? sm.kontraktslengde_mnd,
    kontrakt_startdato: u.startdato || sm.kontrakt_startdato || "",
    kontaktperson: sm.kontaktperson || u.kontaktperson,
    e_post: sm.e_post || u.e_post,
    telefon: sm.telefon || u.telefon,
    sist_aktivitet: iDag,
  };
}

/** Kundeforholdet (selskapet): MRR/ARR/oppstart når valgt, og manglende org.nr./adresse fylles inn. */
export function selskapMedKontraktsinfo(
  s: Selskap,
  u: KontraktUttrekk,
  valg: { oppdaterMrr: boolean; fyllInnMangler: boolean },
): Selskap {
  const neste = { ...s };
  if (valg.oppdaterMrr) {
    neste.mrr = Number(u.mrr) || 0;
    neste.arr = beregnArr(neste.mrr);
    if (u.oppstartskostnad !== null) neste.oppstartskostnad = u.oppstartskostnad;
  }
  if (valg.fyllInnMangler) {
    if (!s.orgnr && u.orgnr) neste.orgnr = u.orgnr;
    if (!s.firmaadresse && u.adresse) neste.firmaadresse = u.adresse;
  }
  return neste;
}

/** Kort sammendrag til aktivitetsloggen. */
export function kontraktsinfoSammendrag(u: KontraktUttrekk, filnavn: string, fmt: (v: number) => string): string {
  const deler = [
    `Fra «${filnavn}»`,
    u.pakker.length ? `Pakker: ${u.pakker.map((p) => p.navn).join(", ")}` : "",
    `MRR ${fmt(Number(u.mrr) || 0)} (ARR ${fmt(beregnArr(u.mrr))})`,
    u.sla_per_mnd !== null ? `SLA ${fmt(u.sla_per_mnd)}/mnd` : "",
    u.oppstartskostnad !== null ? `Oppstart ${fmt(u.oppstartskostnad)}` : "",
    u.bindingstid_mnd !== null ? `Binding ${u.bindingstid_mnd} mnd` : "",
    u.startdato ? `Start ${u.startdato}` : "",
  ];
  return deler.filter(Boolean).join(" · ");
}

/** Tomt uttrekk når AI ikke er kjørt (f.eks. manuell utfylling). */
export function tomtUttrekk(): KontraktUttrekk {
  return {
    firmanavn: "", orgnr: "", adresse: "", kontaktperson: "", e_post: "", telefon: "", pakker: [],
    mrr: 0, arr: 0, sla_per_mnd: null, oppstartskostnad: null, bindingstid_mnd: null,
    startdato: "", oppsigelsestid: "", avtaledato: "", usikre_felt: [],
  };
}
