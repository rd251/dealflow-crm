import { dagerSiden } from "@/lib/sales-flow";

/* ============================================================
   Relasjonsvarme – terskler samlet ett sted, enkle å justere.
   ============================================================ */

/** Dager uten kontakt før relasjonen regnes som lunken. */
export const RELASJON_LUNKEN_DAGER = 60;

/** Dager uten kontakt før relasjonen regnes som forsømt. */
export const RELASJON_KALD_DAGER = 120;

export type RelasjonTilstand = "fersk" | "lunken" | "forsomt" | "ukjent";

export function dagerSidenKontakt(sist?: string | null): number | null {
  return dagerSiden(sist || undefined);
}

export function relasjonTilstand(sist?: string | null): RelasjonTilstand {
  const d = dagerSidenKontakt(sist);
  if (d === null) return "ukjent";
  if (d >= RELASJON_KALD_DAGER) return "forsomt";
  if (d >= RELASJON_LUNKEN_DAGER) return "lunken";
  return "fersk";
}

export const relasjonFarge: Record<RelasjonTilstand, string> = {
  fersk: "bg-success/10 text-success border-success/25",
  lunken: "bg-warning/10 text-warning border-warning/25",
  forsomt: "bg-destructive/10 text-destructive border-destructive/25",
  ukjent: "bg-destructive/10 text-destructive border-destructive/25",
};

export function relasjonEtikett(sist?: string | null): string {
  const d = dagerSidenKontakt(sist);
  if (d === null) return "Aldri kontaktet";
  if (d === 0) return "Kontaktet i dag";
  if (d === 1) return "Kontaktet i går";
  return `${d} dager siden kontakt`;
}

/** Kort variant til tabeller og kort. */
export function sistKontaktetKort(sist?: string | null): string {
  const d = dagerSidenKontakt(sist);
  if (d === null) return "Aldri";
  if (d === 0) return "I dag";
  if (d === 1) return "I går";
  return `${d} d siden`;
}

export function trengerKontakt(sist?: string | null): boolean {
  const t = relasjonTilstand(sist);
  return t === "lunken" || t === "forsomt";
}

/** Sorteringsnøkkel: lengst tid siden kontakt først. */
export function sorterEtterEldstKontakt(a?: string | null, b?: string | null): number {
  const da = dagerSidenKontakt(a) ?? Number.MAX_SAFE_INTEGER;
  const db = dagerSidenKontakt(b) ?? Number.MAX_SAFE_INTEGER;
  return db - da;
}
