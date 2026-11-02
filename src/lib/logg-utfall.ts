/** Felles regler for «Hva skjedde?» – brukes av LoggUtfall overalt i appen. */

export type LoggValg =
  | "snakket" | "svarte_ikke" | "ring_tilbake" | "booket"
  | "ikke_naa" | "ikke_interessert" | "melding" | "notat";

export type RingTilbake = "10min" | "1t" | "ettermiddag" | "imorgen" | "egen";

export const LOGG_VALG: { id: LoggValg; label: string; hint: string }[] = [
  { id: "snakket", label: "📞 Snakket med", hint: "Notat og ny oppfølging" },
  { id: "svarte_ikke", label: "Svarte ikke", hint: "Ny ring om 2 dager" },
  { id: "ring_tilbake", label: "Ring tilbake", hint: "Velg tidspunkt" },
  { id: "booket", label: "Booket møte", hint: "Blir salgsmulighet" },
  { id: "ikke_naa", label: "Ikke nå", hint: "Ny kontakt om 30 dager" },
  { id: "ikke_interessert", label: "Ikke interessert", hint: "Ut av oppfølging" },
  { id: "melding", label: "Melding sendt", hint: "SMS eller e-post" },
  { id: "notat", label: "Notat", hint: "Bare notat" },
];

export const RING_TILBAKE_VALG: { id: RingTilbake; label: string }[] = [
  { id: "10min", label: "Om 10 min" },
  { id: "1t", label: "Om 1 time" },
  { id: "ettermiddag", label: "I ettermiddag (14:00)" },
  { id: "imorgen", label: "I morgen 09:00" },
  { id: "egen", label: "Egendefinert" },
];

const pad = (n: number) => String(n).padStart(2, "0");
export const lokalDato = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const lokalTid = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const plussDager = (naa: Date, dager: number) => { const d = new Date(naa); d.setDate(d.getDate() + dager); return lokalDato(d); };

export interface Oppfolging { dato: string; tid: string }

/** Tidspunkt for «Ring tilbake», avrundet opp til nærmeste 5 minutter. */
export function ringTilbakeTid(valg: RingTilbake, naa: Date = new Date()): Oppfolging {
  const d = new Date(naa);
  d.setSeconds(0, 0);
  if (valg === "10min" || valg === "1t") {
    d.setMinutes(d.getMinutes() + (valg === "10min" ? 10 : 60));
    const rest = d.getMinutes() % 5;
    if (rest) d.setMinutes(d.getMinutes() + 5 - rest);
    return { dato: lokalDato(d), tid: lokalTid(d) };
  }
  if (valg === "ettermiddag") {
    if (naa.getHours() >= 14) d.setDate(d.getDate() + 1);
    return { dato: lokalDato(d), tid: "14:00" };
  }
  d.setDate(d.getDate() + 1);
  return { dato: lokalDato(d), tid: "09:00" };
}

/** Forhåndsutfylt «Neste oppfølging» per valg. Tom dato = ingen ny oppgave. */
export function forslagOppfolging(valg: LoggValg, naa: Date = new Date()): Oppfolging {
  switch (valg) {
    case "snakket": return { dato: plussDager(naa, 7), tid: "" };
    case "svarte_ikke": return { dato: plussDager(naa, 2), tid: "" };
    case "ring_tilbake": return ringTilbakeTid("1t", naa);
    case "booket": return { dato: plussDager(naa, 1), tid: "10:00" };
    case "ikke_naa": return { dato: plussDager(naa, 30), tid: "" };
    case "melding": return { dato: plussDager(naa, 3), tid: "" };
    default: return { dato: "", tid: "" };
  }
}

/** Automatisk tittel på oppfølgingsoppgaven («Ring …» får 📞 i visning). */
export function oppfolgingTittel(valg: LoggValg, navn: string): string {
  const n = navn.trim() || "kunden";
  if (valg === "booket") return `Møte med ${n}`;
  if (valg === "ring_tilbake") return `Ring ${n} tilbake`;
  if (valg === "svarte_ikke" || valg === "ikke_naa") return `Ring ${n} igjen`;
  return `Følg opp ${n}`;
}

/** Ny lead-status etter valget (samme status tilbake = uendret). */
export function leadStatusEtterValg(status: string, valg: LoggValg): string {
  if (valg === "ikke_interessert") return "Ikke aktuelt";
  if (valg === "notat" || valg === "booket" || valg === "melding") return status;
  const tidlig = status === "Ny" || status === "Ikke fått tak i ennå";
  if (valg === "svarte_ikke") return tidlig ? "Svarte ikke telefon" : status;
  return tidlig || status === "Svarte ikke telefon" ? "Kontaktet" : status;
}

/** Om valget lukker gjeldende oppfølgingsoppgave. Rene notater gjør ikke det. */
export const lukkerOppgave = (valg: LoggValg) => valg !== "notat";

/** Åpne oppgaver som regnes som «gjeldende oppfølging»: forfalt/i dag, eller ringeoppgaver. */
export function erGjeldendeOppfolging(o: { status?: string; frist?: string | null; oppgave: string }, idag: string): boolean {
  if (o.status === "Ferdig") return false;
  return Boolean((o.frist && o.frist.slice(0, 10) <= idag) || /^ring\b/i.test(o.oppgave.trim()));
}
