// Deterministiske regler for matching mot Brønnøysundregistrene. Ingen AI.
// Speilet i supabase/functions/_shared/brreg-match.ts – hold filene identiske.

export type BrregStatus = "sikker" | "usikker" | "ingen" | "manuell";

export const TULLESVAR = ["noting", "nothing", "ingen", "nei", "privat", "privatperson", "ukjent", "-", ".", "n/a", "na", "x"];

export const GENERISKE_DOMENER = [
  "gmail", "googlemail", "hotmail", "outlook", "yahoo", "live", "icloud", "me", "msn", "aol",
  "proton", "protonmail", "pm", "online", "mail", "gmx", "yandex", "zoho", "frisurf", "start", "c2i", "getmail", "broadpark", "altibox",
];

const SELSKAPSFORMER = ["as", "asa", "enk", "da", "sa", "ans"];

export interface BrregKandidat {
  orgnr: string;
  navn: string;
  organisasjonsform: string | null;
  kommune: string | null;
  bransje: string | null;
  ansatte: number | null;
  hjemmeside: string | null;
  status: string | null; // «Konkurs», «Slettet» osv., null = aktiv
  score: number;
  begrunnelse: string[];
  rolle?: string | null;
}

export function normaliserNavn(navn: string | null | undefined): string {
  const ord = (navn ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((o) => !SELSKAPSFORMER.includes(o));
  return ord.join(" ");
}

export function erTullesvar(firmanavn: string | null | undefined, kontaktperson?: string | null): boolean {
  const f = (firmanavn ?? "").trim().toLowerCase();
  if (!f) return true;
  if (TULLESVAR.includes(f)) return true;
  const k = (kontaktperson ?? "").trim().toLowerCase();
  if (k && f.replace(/\s+/g, " ") === k.replace(/\s+/g, " ")) return true;
  return false;
}

export function erOrgnr(tekst: string | null | undefined): string | null {
  const s = (tekst ?? "").replace(/\s/g, "");
  return /^\d{9}$/.test(s) ? s : null;
}

/** Firmadomene fra e-post (f.eks. «snakk.ai»), null for gmail o.l. */
export function firmadomene(e_post: string | null | undefined): string | null {
  const d = (e_post ?? "").trim().toLowerCase().split("@")[1];
  if (!d || !d.includes(".")) return null;
  const forste = d.split(".")[0];
  if (GENERISKE_DOMENER.includes(forste)) return null;
  return d;
}

export function domeneFraUrl(url: string | null | undefined): string | null {
  let d = (url ?? "").trim().toLowerCase();
  if (!d) return null;
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  return d || null;
}

/** Domenenavnet uten toppdomene («snakk.ai» → «snakk»). */
export function domeneSoeketekst(domene: string): string {
  const deler = domene.split(".");
  return deler.slice(0, -1).join(" ").replace(/-/g, " ");
}

export function enhetStatus(e: { konkurs?: boolean; underAvvikling?: boolean; underTvangsavviklingEllerTvangsopplosning?: boolean; slettedato?: string | null }): string | null {
  if (e.slettedato) return "Slettet";
  if (e.konkurs) return "Konkurs";
  if (e.underTvangsavviklingEllerTvangsopplosning) return "Under tvangsavvikling";
  if (e.underAvvikling) return "Under avvikling";
  return null;
}

/** Poeng for én kandidat (uten rollematch). */
export function scorKandidat(
  soekNavn: string,
  kandidat: { navn: string; hjemmeside?: string | null; status?: string | null },
  domene: string | null,
): { score: number; begrunnelse: string[] } {
  const begrunnelse: string[] = [];
  let score = 0;
  const a = normaliserNavn(soekNavn);
  const b = normaliserNavn(kandidat.navn);
  if (a) {
    const ordA = a.split(" ");
    const ordB = b.split(" ");
    if (a === b) { score += 60; begrunnelse.push("Navnet er likt (+60)"); }
    if (ordA.every((o) => ordB.includes(o))) { score += 30; begrunnelse.push("Alle ord finnes i navnet (+30)"); }
    else if (ordA.some((o) => ordB.includes(o))) { score += 5; begrunnelse.push("Delvis navnelikhet (+5)"); }
  }
  if (domene && domeneFraUrl(kandidat.hjemmeside) === domene) { score += 40; begrunnelse.push("Nettsiden har samme domene som e-posten (+40)"); }
  if (kandidat.status) { score -= 50; begrunnelse.push(`${kandidat.status} (−50)`); }
  return { score, begrunnelse };
}

/** Fornavn + etternavn, ignorer mellomnavn og store/små bokstaver. */
export function personNoekkel(fornavn: string, etternavn: string): string {
  return `${fornavn.trim().split(/\s+/)[0]} ${etternavn.trim().split(/\s+/).pop()}`.toLowerCase();
}

export function kontaktNoekkel(kontaktperson: string | null | undefined): string | null {
  const ord = (kontaktperson ?? "").trim().split(/\s+/).filter(Boolean);
  if (ord.length < 2) return null;
  return personNoekkel(ord[0], ord[ord.length - 1]);
}

export interface Rolle { type: string; beskrivelse: string; noekkel: string; navn: string }

export const ROLLE_PRIORITET = ["DAGL", "LEDE", "INNH", "DTPR", "DTSO", "KOMP", "STYR", "NEST", "MEDL", "VARA"];

/** Finn beste rolle for kontaktpersonen (Daglig leder før Styremedlem osv.). */
export function finnRolle(roller: Rolle[], kontaktperson: string | null | undefined): Rolle | null {
  const n = kontaktNoekkel(kontaktperson);
  if (!n) return null;
  const treff = roller.filter((r) => r.noekkel === n);
  if (!treff.length) return null;
  treff.sort((x, y) => {
    const px = ROLLE_PRIORITET.indexOf(x.type), py = ROLLE_PRIORITET.indexOf(y.type);
    return (px < 0 ? 99 : px) - (py < 0 ? 99 : py);
  });
  return treff[0];
}

export interface Avgjoerelse { status: BrregStatus; valgt: BrregKandidat | null; melding: string | null }

export function avgjoer(kandidater: BrregKandidat[], erKommune = false): Avgjoerelse {
  const sortert = [...kandidater].sort((a, b) => b.score - a.score);
  if (erKommune && !sortert.some((k) => k.organisasjonsform === "KOMM" && !k.status && k.score >= 90)) {
    return { status: "ingen", valgt: null, melding: "Kommunen finnes ikke i registeret, kan være sammenslått" };
  }
  if (!sortert.length) return { status: "ingen", valgt: null, melding: null };
  const [en, to] = sortert;
  if (en.score >= 80 && en.score - (to?.score ?? 0) >= 25) return { status: "sikker", valgt: en, melding: null };
  return { status: "usikker", valgt: null, melding: null };
}

export interface BrregData {
  orgnr: string;
  navn: string;
  organisasjonsform: { kode: string; beskrivelse: string } | null;
  naeringskode1: { kode: string; beskrivelse: string } | null;
  antallAnsatte: number | null;
  forretningsadresse: string | null;
  postadresse: string | null;
  kommune: string | null;
  hjemmeside: string | null;
  epostadresse: string | null;
  telefon: string | null;
  mobil: string | null;
  stiftelsesdato: string | null;
  registrertIMvaregisteret: boolean;
  konkurs: boolean;
  underAvvikling: boolean;
  underTvangsavviklingEllerTvangsopplosning: boolean;
  slettedato: string | null;
  status: string | null;
  daglig_leder: string | null;
  styreleder: string | null;
  kontakt_rolle: { navn: string; rolle: string } | null;
  regnskap: { aar: number; driftsinntekter: number | null; driftsresultat: number | null; aarsresultat: number | null; egenkapital: number | null } | null;
  oppgitt_firmanavn?: string | null;
  melding?: string | null;
}

// deno-lint-ignore no-explicit-any
export function formaterAdresse(a: any): string | null {
  if (!a) return null;
  const linjer = [...(a.adresse ?? []), [a.postnummer, a.poststed].filter(Boolean).join(" ")].filter(Boolean);
  return linjer.length ? linjer.join(", ") : null;
}

/** Felter som skal skrives på selskapet: låste felt alltid, kontaktfelt bare når tomme. Firmanavn aldri. */
export function selskapsfelterFraBrreg(
  d: BrregData,
  eksisterende: { telefon?: string | null; e_post?: string | null; domene?: string | null },
): Record<string, string> {
  const ut: Record<string, string> = { orgnr: d.orgnr };
  if (d.forretningsadresse) ut.firmaadresse = d.forretningsadresse;
  if (d.postadresse || d.forretningsadresse) ut.postadresse = (d.postadresse || d.forretningsadresse)!;
  if (d.naeringskode1?.beskrivelse) ut.bransje = d.naeringskode1.beskrivelse;
  const tlf = d.telefon || d.mobil;
  if (!(eksisterende.telefon ?? "").trim() && tlf) ut.telefon = tlf;
  if (!(eksisterende.e_post ?? "").trim() && d.epostadresse) ut.e_post = d.epostadresse;
  const dom = domeneFraUrl(d.hjemmeside);
  if (!(eksisterende.domene ?? "").trim() && dom) ut.domene = dom;
  return ut;
}

export function erProblem(d: Pick<BrregData, "konkurs" | "underAvvikling" | "underTvangsavviklingEllerTvangsopplosning" | "slettedato"> | null | undefined): boolean {
  return !!d && (!!d.konkurs || !!d.underAvvikling || !!d.underTvangsavviklingEllerTvangsopplosning || !!d.slettedato);
}
