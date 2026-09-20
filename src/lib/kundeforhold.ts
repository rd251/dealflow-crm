import type { Kundetilstand, Kundestatus, ProsjektStatus } from "@/data/crm-data";

/** Antall dager uten aktivitet før en kunde regnes som inaktiv. */
export const INAKTIV_DAGER = 14;

/** Standard timepris for konsulent- og assistert onboarding (kr/t). */
export const STANDARD_TIMEPRIS = 1500;

/** Standard ansvarlig for nye onboardingprosjekter. */
export const STANDARD_PROSJEKTANSVARLIG = "Roberto Garcia Bjertnes";

export type OnboardingType = "Selvbetjening" | "Assistert" | "Konsulent";

export const ONBOARDING_TYPER: { verdi: OnboardingType; beskrivelse: string }[] = [
  { verdi: "Selvbetjening", beskrivelse: "Kunden gjør det selv med AI-byggeren" },
  { verdi: "Assistert", beskrivelse: "Vi hjelper kunden underveis" },
  { verdi: "Konsulent", beskrivelse: "Vi gjør hele jobben og fakturerer timer" },
];

const FELLES_STEG = ["Kontrakt signert", "Kickoff-møte gjennomført"];

export const ONBOARDING_STEG: Record<OnboardingType, string[]> = {
  Selvbetjening: [...FELLES_STEG, "Kunde bygger agent selv", "Test og godkjenning", "Go-live"],
  Assistert: [...FELLES_STEG, "Oppsett-sesjon med kunde", "Finjustering", "Test og godkjenning", "Go-live"],
  Konsulent: [...FELLES_STEG, "Agent bygges av Snakk-teamet", "KB-opplasting og trening", "Test med kunde", "Go-live"],
};

/** Timeregistrering vises kun for disse onboardingtypene. */
export const TYPER_MED_TIMER: OnboardingType[] = ["Assistert", "Konsulent"];

export const harTimeregistrering = (type: string) =>
  TYPER_MED_TIMER.includes(type as OnboardingType);

export const TIME_TYPER = ["Oppsett", "Integrasjon", "Møte", "Opplæring", "Support", "Annet"] as const;
export type TimeType = (typeof TIME_TYPER)[number];

export interface ProsjektTime {
  id: string;
  prosjekt_id: string | null;
  selskap_id: string | null;
  type: string;
  beskrivelse: string;
  dato: string;
  timer: number;
  timepris: number;
  fakturert: boolean;
  fakturert_dato: string | null;
  opprettet_av: string | null;
}

export const PROSJEKT_STATUSER: ProsjektStatus[] = [
  "Ny",
  "I produksjon",
  "Test med kunde",
  "Klar for live",
  "Live",
  "Blokkert",
];

export const prosjektStatusFarge: Record<string, string> = {
  "Ny": "bg-muted text-muted-foreground",
  "Skjema mottatt": "bg-primary/10 text-primary",
  "I produksjon": "bg-stage-contacted/10 text-stage-contacted",
  "Test med kunde": "bg-stage-demo/10 text-stage-demo",
  "Klar for live": "bg-warning/10 text-warning",
  "Live": "bg-success/10 text-success",
  "Blokkert": "bg-destructive/10 text-destructive",
};

export const kundestatusFarge: Record<Kundestatus, string> = {
  "Ikke kunde": "bg-muted text-muted-foreground",
  "Pilot": "bg-stage-contacted/10 text-stage-contacted",
  "Live": "bg-success/10 text-success",
  "Pause": "bg-warning/10 text-warning",
  "Kansellert": "bg-destructive/10 text-destructive",
};

export const tilstandFarge: Record<Kundetilstand, string> = {
  "Bra": "bg-success/10 text-success",
  "Usikker": "bg-warning/10 text-warning",
  "Risiko": "bg-destructive/10 text-destructive",
};

export function dagerSiden(dato?: string | null): number | null {
  if (!dato) return null;
  const d = new Date(dato);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export function relativTid(dato?: string | null): string {
  const dager = dagerSiden(dato);
  if (dager === null) return "Ingen aktivitet";
  if (dager <= 0) return "I dag";
  if (dager === 1) return "I går";
  if (dager < 7) return `For ${dager} dager siden`;
  if (dager < 31) {
    const uker = Math.floor(dager / 7);
    return `For ${uker} uke${uker === 1 ? "" : "r"} siden`;
  }
  const mnd = Math.floor(dager / 30);
  return `For ${mnd} måned${mnd === 1 ? "" : "er"} siden`;
}

export function initialer(navn: string): string {
  return navn
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(d => d[0]?.toUpperCase() ?? "")
    .join("");
}

export const iDag = () => new Date().toISOString().split("T")[0];

export function erSammeMaaned(dato?: string | null): boolean {
  if (!dato) return false;
  const d = new Date(dato);
  if (Number.isNaN(d.getTime())) return false;
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}
