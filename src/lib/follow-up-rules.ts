import type { SalgsmulighetStatus } from "@/data/crm-data";
import { dagerSiden, idag, datoOm, tilKanbanStadium } from "@/lib/sales-flow";

/* ============================================================
   Alle terskler samlet ett sted – enkle å justere.
   ============================================================ */

/** Utfall på en lead-aktivitet → antall dager til neste oppfølging. */
export const LEAD_OPPFOLGING_DAGER = {
  /** «Svarte ikke» */
  svarte_ikke: 2,
  /** «Snakket / interessert» */
  snakket: 5,
  /** «Ikke nå» */
  ikke_naa: 30,
} as const;

export type LeadUtfallNokkel = keyof typeof LEAD_OPPFOLGING_DAGER;

/** Nytt lead uten aktivitet: første oppfølging. */
export const NYTT_LEAD_OPPFOLGING_DAGER = 2;

/** Dager uten aktivitet før et lead regnes som kaldt. */
export const LEAD_KALD_DAGER = 21;

/** Tidsbudsjett per pipeline-stadium (dager uten aktivitet). */
export const STADIUM_BUDSJETT_DAGER: Record<string, number> = {
  "Møte booket": 7,
  "Demo gjennomført": 14,
  "Demo-prosjekt": 30,
  "Kontrakt sendt": 14,
};

/** Dager uten aktivitet før en deal foreslås tapt. */
export const AUTO_TAP_DAGER = 90;

/** «bekreft» = ett klikk for å flytte til Tapt. «automatisk» = flytt uten bekreftelse. */
export const AUTO_TAP_MODUS: "bekreft" | "automatisk" = "bekreft";

/** Antall kort som vises i en kanban-kolonne før «vis alle». */
export const KANBAN_SYNLIGE_KORT = 12;

/* ============================================================
   Leads
   ============================================================ */

/** Flytt en dato som faller i helg til påfølgende mandag. */
export function unngaHelg(dato: string): string {
  const d = new Date(`${dato}T00:00:00`);
  if (isNaN(d.getTime())) return dato;
  const dag = d.getDay(); // 0 = søndag, 6 = lørdag
  if (dag === 6) d.setDate(d.getDate() + 2);
  else if (dag === 0) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Dato om N dager, aldri i helg (lørdag/søndag → mandag). */
export function oppfolgingDatoOm(dager: number): string {
  return unngaHelg(datoOm(dager));
}

/** Neste oppfølgingsdato ut fra utfall, aldri i helg. */
export function nesteOppfolgingFraUtfall(utfall: LeadUtfallNokkel): string {
  return oppfolgingDatoOm(LEAD_OPPFOLGING_DAGER[utfall]);
}

/** Dager til (positivt) eller etter (negativt) oppfølgingsdatoen. */
export function dagerTilOppfolging(dato?: string | null): number | null {
  if (!dato) return null;
  const d = new Date(`${dato}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  const naa = new Date(`${idag()}T00:00:00`);
  return Math.round((d.getTime() - naa.getTime()) / 86400000);
}

export type OppfolgingTilstand = "forfalt" | "i-dag" | "kommende" | "mangler";

export function oppfolgingTilstand(dato?: string | null): OppfolgingTilstand {
  const d = dagerTilOppfolging(dato);
  if (d === null) return "mangler";
  if (d < 0) return "forfalt";
  if (d === 0) return "i-dag";
  return "kommende";
}

export const oppfolgingFarge: Record<OppfolgingTilstand, string> = {
  forfalt: "bg-warning/10 text-warning border-warning/25",
  "i-dag": "bg-pipeline/10 text-pipeline border-pipeline/20",
  kommende: "bg-muted text-muted-foreground border-border",
  mangler: "bg-warning/10 text-warning border-warning/25",
};

export function oppfolgingEtikett(dato?: string | null): string {
  const d = dagerTilOppfolging(dato);
  if (d === null) return "Mangler oppfølging";
  if (d < 0) return `Forfalt ${Math.abs(d)} d`;
  if (d === 0) return "I dag";
  if (d === 1) return "I morgen";
  return `Om ${d} d`;
}

/** Faller tilbake til en beregnet dato slik at ingen lead står uten oppfølging. */
export function effektivOppfolging(lead: { neste_oppfolging?: string; sist_aktivitet?: string; opprettet_dato?: string }): string {
  if (lead.neste_oppfolging) return lead.neste_oppfolging;
  const basis = lead.sist_aktivitet || lead.opprettet_dato;
  if (!basis) return idag();
  const d = new Date(`${basis}T00:00:00`);
  if (isNaN(d.getTime())) return idag();
  d.setDate(d.getDate() + LEAD_OPPFOLGING_DAGER.snakket);
  return unngaHelg(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
}

/** Kaldt lead: ingen aktivitet på LEAD_KALD_DAGER dager. */
export function erKaldtLead(lead: { sist_aktivitet?: string; opprettet_dato?: string }): boolean {
  const d = dagerSiden(lead.sist_aktivitet || lead.opprettet_dato);
  return d !== null && d >= LEAD_KALD_DAGER;
}

/* ============================================================
   Salgsmuligheter
   ============================================================ */

export function stadiumBudsjett(status: SalgsmulighetStatus): number {
  return STADIUM_BUDSJETT_DAGER[tilKanbanStadium(status)] ?? 14;
}

/** Dager uten aktivitet. */
export function dagerUtenAktivitet(deal: { sist_aktivitet?: string; opprettet_dato?: string }): number {
  return dagerSiden(deal.sist_aktivitet || deal.opprettet_dato) ?? 999;
}

/** Kald deal: har brukt opp tidsbudsjettet for stadiet uten aktivitet. */
export function erKaldDeal(deal: { status: SalgsmulighetStatus; sist_aktivitet?: string; opprettet_dato?: string }): boolean {
  return dagerUtenAktivitet(deal) > stadiumBudsjett(deal.status);
}

/** Foreslått tapt: svært lenge uten aktivitet. */
export function erForeslaattTapt(deal: { sist_aktivitet?: string; opprettet_dato?: string }): boolean {
  return dagerUtenAktivitet(deal) >= AUTO_TAP_DAGER;
}
