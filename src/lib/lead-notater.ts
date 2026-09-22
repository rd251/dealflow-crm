/** Henter strukturert info ut av lead-notater (f.eks. skjemasvar fra Meta Lead Ads). */

export interface SkjemaSvar {
  sporsmal: string;
  svar: string;
}

/** Rydder spørsmålstekst fra skjema: "hva_vil_dere_ha_hjelp_med?" -> "hva vil dere ha hjelp med?" */
function ryddSporsmal(s: string): string {
  return s.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

/** Parser linjer på formen "- spørsmål: svar" fra notatfeltet. */
export function skjemaSvarFraNotater(notater?: string | null): SkjemaSvar[] {
  if (!notater) return [];
  const ut: SkjemaSvar[] = [];
  for (const linje of notater.split("\n")) {
    const m = linje.match(/^\s*-\s*([^:]+):\s*(.+)$/);
    if (!m) continue;
    const svar = m[2].trim();
    if (!svar) continue;
    ut.push({ sporsmal: ryddSporsmal(m[1]), svar });
  }
  return ut;
}

/**
 * Kort tekst om hva leadet ønsker, hentet fra skjemasvarene.
 * Hopper over kontaktfelt (e-post, telefon, navn) og viser selve behovet.
 */
const KONTAKT_FELT = /e[- ]?post|telefon|tel|phone|navn|name|firma/i;

export function skjemaOnske(notater?: string | null): string | null {
  const svar = skjemaSvarFraNotater(notater).filter(s => !KONTAKT_FELT.test(s.sporsmal));
  if (svar.length === 0) return null;
  return svar.map(s => s.svar).join(" · ");
}

/** Produktinteresse gjenkjent i skjemasvar/use_case, i prioritert visningsrekkefølge. */
const PRODUKT_REGLER: { produkt: string; matcher: RegExp }[] = [
  { produkt: "Telefon", matcher: /telefon|ring|anrop|samtale|kundesvar|reservasjon|bestilling.*telefon/i },
  { produkt: "Chat", matcher: /chat|chatbot|nettside/i },
  { produkt: "Møter", matcher: /møte|referat|transkrib|notat/i },
  { produkt: "E-post", matcher: /e[- ]?post|mail|innboks/i },
];

/** Finner hvilke produkter leadet er på jakt etter, ut fra notater og use_case. */
export function produktInteresse(notater?: string | null, useCase?: string | null): string[] {
  const tekst = [skjemaSvarFraNotater(notater).map(s => `${s.sporsmal} ${s.svar}`).join(" "), useCase || ""].join(" ");
  if (!tekst.trim()) return [];
  return PRODUKT_REGLER.filter(r => r.matcher.test(tekst)).map(r => r.produkt);
}
