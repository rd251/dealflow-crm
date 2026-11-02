/**
 * Felles rensing av aktivitetsforhåndsvisninger.
 *
 * Gmail-synken lagrer e-postaktiviteter med tekniske prefikser i beskrivelsen:
 *   `[threadId:1a178580a1570447] [jr@utvendigrenhold.no] Hei Jonathan, …`
 * Disse reglene fjerner prefiksene VED VISNING. Lagrede data endres aldri.
 */

const TRAAD_RE = /\[threadId:([^\]]*)\]/i;
const ADRESSE_RE = /\[([^\[\]@]+@[^\[\]@]+)\]/g;

/** Gmail-tråd-ID hvis aktiviteten har en. */
export function epostTraadId(beskrivelse?: string | null): string | null {
  const m = (beskrivelse || "").match(TRAAD_RE);
  const id = m?.[1]?.trim();
  return id || null;
}

/** E-postadressene som ligger i [klammer] i beskrivelsen, i rekkjefølgje. */
export function epostAdresser(beskrivelse?: string | null): string[] {
  const ut: string[] = [];
  for (const m of (beskrivelse || "").matchAll(ADRESSE_RE)) {
    const a = m[1].trim().toLowerCase();
    if (a && !ut.includes(a)) ut.push(a);
  }
  return ut;
}

/** Brødtekst utan threadId- og adressetaggar. */
export function renAktivitetstekst(beskrivelse?: string | null): string {
  return (beskrivelse || "")
    .replace(new RegExp(TRAAD_RE, "gi"), " ")
    .replace(ADRESSE_RE, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Diskret kontaktlinje: «til x@y.no» for utgåande, «fra x@y.no» for innkommande. */
export function epostKontaktTekst(beskrivelse?: string | null, sendt?: boolean): string | null {
  const [forste] = epostAdresser(beskrivelse);
  if (!forste) return null;
  return `${sendt ? "til" : "fra"} ${forste}`;
}

/** Er dette ei e-postaktivitet med ei tråd som kan opnast? */
export function harEpostTraad(beskrivelse?: string | null): boolean {
  return !!epostTraadId(beskrivelse);
}
