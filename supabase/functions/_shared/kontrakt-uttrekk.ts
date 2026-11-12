// Felles regler for kontraktsuttrekk fra PDF. Ren TypeScript (ingen Deno-/npm-import),
// slik at samme kode brukes av edge-funksjonen og testene i src/test.

export interface KontraktPakke {
  navn: string;
  manedspris: number;
  minutter: string;
}

export interface KontraktUttrekk {
  firmanavn: string;
  orgnr: string;
  adresse: string;
  kontaktperson: string;
  e_post: string;
  telefon: string;
  pakker: KontraktPakke[];
  /** Sum faste månedlige lisensbeløp. SLA og oppstart er IKKE med. */
  mrr: number;
  /** Beregnes alltid i kode: mrr × 12. */
  arr: number;
  sla_per_mnd: number | null;
  oppstartskostnad: number | null;
  bindingstid_mnd: number | null;
  startdato: string;
  oppsigelsestid: string;
  avtaledato: string;
  usikre_felt: string[];
}

export const UTTREKK_FELT = [
  "firmanavn", "orgnr", "adresse", "kontaktperson", "e_post", "telefon", "pakker", "mrr",
  "sla_per_mnd", "oppstartskostnad", "bindingstid_mnd", "startdato", "oppsigelsestid", "avtaledato",
] as const;

/** JSON-skjema AI-en må svare etter. */
export const UTTREKK_SKJEMA = {
  type: "object",
  additionalProperties: false,
  required: [...UTTREKK_FELT, "usikre_felt"],
  properties: {
    firmanavn: { type: "string" },
    orgnr: { type: "string" },
    adresse: { type: "string" },
    kontaktperson: { type: "string" },
    e_post: { type: "string" },
    telefon: { type: "string" },
    pakker: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["navn", "manedspris", "minutter"],
        properties: {
          navn: { type: "string" },
          manedspris: { type: "number" },
          minutter: { type: "string" },
        },
      },
    },
    mrr: { type: "number" },
    sla_per_mnd: { type: ["number", "null"] },
    oppstartskostnad: { type: ["number", "null"] },
    bindingstid_mnd: { type: ["number", "null"] },
    startdato: { type: "string" },
    oppsigelsestid: { type: "string" },
    avtaledato: { type: "string" },
    usikre_felt: { type: "array", items: { type: "string", enum: [...UTTREKK_FELT] } },
  },
} as const;

export const UTTREKK_INSTRUKS =
  "Du leser en ferdig kundekontrakt (PDF) fra Snakk Teknologi AS og henter ut kontraktsinformasjon om KUNDEN. " +
  "Snakk Teknologi AS er leverandøren – bruk aldri Snakk sine opplysninger som kundens. " +
  "Regler: " +
  "1) Beløp er tall i norske kroner eks. mva., uten mellomrom eller valutategn. " +
  "2) «pakker» er hver fast månedlig lisens/modul med navn, månedspris og inkludert kapasitet (minutter, chat, e-post) som tekst. " +
  "3) «mrr» er summen av FASTE MÅNEDLIGE lisensbeløp etter eventuelle rabatter. SLA/support-avgift og oppstarts-/etableringskostnad skal IKKE med i mrr. " +
  "Er en lisens gratis (f.eks. 3 for 2), skal den ha månedspris 0. " +
  "4) «sla_per_mnd» er månedlig SLA/support-avgift, «oppstartskostnad» er engangsbeløp. Bruk null hvis kontrakten ikke nevner dem. " +
  "5) «bindingstid_mnd» i hele måneder (pilot uten binding = 0); null hvis ikke nevnt. " +
  "6) Datoer som ÅÅÅÅ-MM-DD, tom streng hvis ikke oppgitt. «oppsigelsestid» som kort tekst, f.eks. «1 måned». " +
  "7) Kontaktperson/e-post/telefon er kundens signatar eller kontaktperson. " +
  "8) Ikke finn på noe. Ukjente tekstfelt er tom streng. List alle felt du er usikker på eller måtte gjette i «usikre_felt».";

const tekst = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

function tall(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d,.-]/g, "").replace(",", "."));
    return v.trim() !== "" && Number.isFinite(n) ? n : null;
  }
  return null;
}

function dato(v: unknown): string {
  const s = tekst(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

/** Rydder AI-svaret og beregner ARR i kode (aldri fra AI). */
export function normaliserUttrekk(raw: unknown): KontraktUttrekk {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pakker: KontraktPakke[] = Array.isArray(r.pakker)
    ? (r.pakker as Record<string, unknown>[])
        .map((p) => ({ navn: tekst(p?.navn), manedspris: Math.max(0, tall(p?.manedspris) ?? 0), minutter: tekst(p?.minutter) }))
        .filter((p) => p.navn)
    : [];
  const usikre = new Set<string>(
    Array.isArray(r.usikre_felt) ? (r.usikre_felt as unknown[]).map(tekst).filter((f) => (UTTREKK_FELT as readonly string[]).includes(f)) : [],
  );
  let mrr = tall(r.mrr);
  if (mrr === null || mrr < 0) {
    mrr = pakker.reduce((s, p) => s + p.manedspris, 0);
    usikre.add("mrr");
  }
  const datoRaa = { startdato: tekst(r.startdato), avtaledato: tekst(r.avtaledato) };
  const startdato = dato(r.startdato);
  const avtaledato = dato(r.avtaledato);
  if (datoRaa.startdato && !startdato) usikre.add("startdato");
  if (datoRaa.avtaledato && !avtaledato) usikre.add("avtaledato");
  const e_post = tekst(r.e_post).toLowerCase();
  if (e_post && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e_post)) usikre.add("e_post");
  const binding = tall(r.bindingstid_mnd);

  return {
    firmanavn: tekst(r.firmanavn),
    orgnr: tekst(r.orgnr),
    adresse: tekst(r.adresse),
    kontaktperson: tekst(r.kontaktperson),
    e_post,
    telefon: tekst(r.telefon),
    pakker,
    mrr,
    arr: beregnArr(mrr),
    sla_per_mnd: tall(r.sla_per_mnd),
    oppstartskostnad: tall(r.oppstartskostnad),
    bindingstid_mnd: binding === null ? null : Math.max(0, Math.round(binding)),
    startdato,
    oppsigelsestid: tekst(r.oppsigelsestid),
    avtaledato,
    usikre_felt: [...usikre],
  };
}

/** ARR = MRR × 12. SLA og oppstart holdes alltid utenfor. */
export function beregnArr(mrr: number): number {
  return Math.round((Number(mrr) || 0) * 12 * 100) / 100;
}
