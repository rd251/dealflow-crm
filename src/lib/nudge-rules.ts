/* ============================================================
   Terskler for «venter på svar»-påminnelser – enkle å justere.
   ============================================================ */

/** Antall dager uten svar før en påminnelse sendes. */
export const NUDGE_DAGER_STANDARD = 3;

/** Maks antall påminnelser én bruker kan få per dag. */
export const NUDGE_MAKS_PER_DAG = 5;

/** Laveste og høyeste terskel brukeren kan velge selv. */
export const NUDGE_DAGER_MIN = 1;
export const NUDGE_DAGER_MAKS = 14;

export type VenterStatus = "venter" | "besvart" | "varslet" | "avbrutt";

/** Dager siden vår siste melding i samtalen. */
export function dagerSidenSendt(sendtDato: string): number {
  const d = new Date(sendtDato);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
