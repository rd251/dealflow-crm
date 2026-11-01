/** Rene regler for kundekortet i «Følg opp nå». */

export type SamtaleUtfall = "fikk_svar" | "ikke_svar" | "beskjed" | "ring_senere" | "ikke_interessert" | "booket";

export const SAMTALE_UTFALL: { id: SamtaleUtfall; label: string }[] = [
  { id: "fikk_svar", label: "Fikk svar" },
  { id: "ikke_svar", label: "Ikke svar" },
  { id: "beskjed", label: "La igjen beskjed" },
  { id: "ring_senere", label: "Ring tilbake senere" },
  { id: "ikke_interessert", label: "Ikke interessert" },
  { id: "booket", label: "Booket møte" },
];

/** Foreslått antall dager til ny oppfølging. null = ingen ny oppgave foreslås. */
export function forslagDager(u: SamtaleUtfall): number | null {
  switch (u) {
    case "ikke_svar": return 2;
    case "beskjed": return 3;
    case "ring_senere": return 3;
    case "fikk_svar": return 7;
    default: return null;
  }
}

/** Ny lead-status etter et utfall (uendret = samme status tilbake). */
export function leadStatusEtterUtfall(status: string, u: SamtaleUtfall): string {
  if (u === "ikke_interessert") return "Ikke aktuelt";
  if (u === "ikke_svar") return status === "Ny" || status === "Ikke fått tak i ennå" ? "Svarte ikke telefon" : status;
  if (u === "booket") return status;
  return status === "Ny" || status === "Svarte ikke telefon" || status === "Ikke fått tak i ennå" ? "Kontaktet" : status;
}

export interface MeldingMal { id: string; navn: string; tekst: string; emne?: string }

export const SMS_MALER: MeldingMal[] = [
  { id: "sms-forsok", navn: "Prøvde å ringe", tekst: "Hei {fornavn}! Jeg prøvde å ringe deg nå. Når passer det å ta en kort prat om Snakk for {firma}? Mvh Snakk" },
  { id: "sms-oppfolging", navn: "Oppfølging", tekst: "Hei {fornavn}, takk for praten! Jeg sender over mer info om hvordan Snakk kan hjelpe {firma}. Mvh Snakk" },
  { id: "sms-moete", navn: "Bekreft møte", tekst: "Hei {fornavn}! Bekrefter møtet vårt om Snakk for {firma}. Gi beskjed om noe endrer seg. Mvh Snakk" },
];

export const EPOST_MALER: MeldingMal[] = [
  { id: "epost-forsok", navn: "Prøvde å ringe", emne: "Snakk AI – kort prat?", tekst: "Hei {fornavn},\n\nJeg prøvde å ringe deg i dag. Har du 15 minutter denne uka til en kort prat om hvordan Snakk kan hjelpe {firma}?\n\nVennlig hilsen" },
  { id: "epost-oppfolging", navn: "Oppfølging", emne: "Oppfølging fra Snakk", tekst: "Hei {fornavn},\n\nTakk for praten! Som lovet kommer her litt mer om hvordan Snakk kan hjelpe {firma}.\n\nVennlig hilsen" },
];

export function fyllMal(tekst: string, v: { fornavn?: string; firma?: string }): string {
  return tekst.replace(/\{fornavn\}/g, (v.fornavn || "").trim() || "der").replace(/\{firma\}/g, (v.firma || "").trim() || "dere");
}

export function smsLenke(telefon: string, tekst: string): string {
  return `sms:${telefon.replace(/\s/g, "")}?body=${encodeURIComponent(tekst)}`;
}
export function mailtoLenke(epost: string, emne: string, tekst: string): string {
  return `mailto:${epost}?subject=${encodeURIComponent(emne)}&body=${encodeURIComponent(tekst)}`;
}
