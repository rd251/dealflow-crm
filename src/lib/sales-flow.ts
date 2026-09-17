import type { LeadStatus, SalgsmulighetStatus } from "@/data/crm-data";

/* ---------- Tid ---------- */

export function dagerSiden(dato?: string): number | null {
  if (!dato) return null;
  const d = new Date(dato);
  if (isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export function relativTid(dato?: string): string {
  const d = dagerSiden(dato);
  if (d === null) return "—";
  if (d === 0) return "i dag";
  if (d === 1) return "i går";
  if (d < 7) return `${d} dager siden`;
  if (d < 14) return "1 uke siden";
  if (d < 60) return `${Math.floor(d / 7)} uker siden`;
  return `${Math.floor(d / 30)} mnd siden`;
}

export const idag = () => new Date().toISOString().split("T")[0];

export function datoOm(dager: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dager);
  return d.toISOString().split("T")[0];
}

/* ---------- Lead-status ---------- */

export const LEAD_STATUSER: LeadStatus[] = [
  "Ny",
  "Kontaktet",
  "Kvalifisert",
  "Ikke aktuelt",
  "Konvertert til salg",
  "Konvertert til partner",
];

export const leadStatusFarge: Record<string, string> = {
  "Ny": "bg-pipeline/10 text-pipeline border-pipeline/20",
  "Kontaktet": "bg-warning/10 text-warning border-warning/25",
  "Kvalifisert": "bg-success/10 text-success border-success/20",
  "Ikke aktuelt": "bg-muted text-muted-foreground border-border",
  "Konvertert til salg": "bg-pipeline/10 text-pipeline border-pipeline/20",
  "Konvertert til partner": "bg-partner/10 text-partner border-partner/20",
};

export const leadStatusKort: Record<string, string> = {
  "Konvertert til salg": "Konvertert",
  "Konvertert til partner": "Konvertert",
};

/* ---------- Kilde-grupper ---------- */

export type KildeGruppe = "Inbound" | "Outbound" | "Partner" | "Referanse" | "Annet";

export const KILDE_GRUPPER: KildeGruppe[] = ["Inbound", "Outbound", "Partner", "Referanse", "Annet"];

const KILDE_MAP: Record<string, KildeGruppe> = {
  "Nettside": "Inbound",
  "Organisk": "Inbound",
  "E-post": "Inbound",
  "Telefon": "Inbound",
  "Agent Builder": "Inbound",
  "Facebook ads": "Inbound",
  "Google ads": "Inbound",
  "Kald outbound": "Outbound",
  "Instantly kald e-post": "Outbound",
  "Kasoleads": "Outbound",
  "LinkedIn": "Outbound",
  "Partner": "Partner",
  "Referanse": "Referanse",
};

export function kildeGruppe(kilde?: string): KildeGruppe {
  if (!kilde) return "Annet";
  return KILDE_MAP[kilde] || "Annet";
}

/* ---------- Deal-stadier ---------- */

export const KANBAN_STADIER = [
  "Møte booket",
  "Demo gjennomført",
  "Kontrakt sendt",
  "Vunnet",
  "Tapt",
] as const;

export type KanbanStadium = (typeof KANBAN_STADIER)[number];

/** Eldre statuser vises i «Demo gjennomført»-kolonnen. */
export function tilKanbanStadium(status: SalgsmulighetStatus): KanbanStadium {
  switch (status) {
    case "Behov avklart":
    case "Løsning presentert":
    case "Demo gjennomført":
      return "Demo gjennomført";
    case "Kontrakt sendt":
      return "Kontrakt sendt";
    case "Vunnet":
      return "Vunnet";
    case "Tapt":
      return "Tapt";
    default:
      return "Møte booket";
  }
}

export const stadiumFarge: Record<KanbanStadium, string> = {
  "Møte booket": "bg-pipeline/10 text-pipeline border-pipeline/20",
  "Demo gjennomført": "bg-pipeline/10 text-pipeline border-pipeline/20",
  "Kontrakt sendt": "bg-partner/10 text-partner border-partner/20",
  "Vunnet": "bg-success/10 text-success border-success/20",
  "Tapt": "bg-muted text-muted-foreground border-border",
};

export const stadiumStripe: Record<KanbanStadium, string> = {
  "Møte booket": "bg-pipeline",
  "Demo gjennomført": "bg-pipeline",
  "Kontrakt sendt": "bg-partner",
  "Vunnet": "bg-success",
  "Tapt": "bg-muted-foreground/40",
};

export const kontraktStatusFarge: Record<string, string> = {
  "Ikke sendt": "bg-muted text-muted-foreground border-border",
  "Sendt": "bg-pipeline/10 text-pipeline border-pipeline/20",
  "Åpnet": "bg-warning/10 text-warning border-warning/25",
  "Signert": "bg-success/10 text-success border-success/20",
  "Utløpt": "bg-destructive/12 text-destructive border-destructive/25",
};

export function initialer(navn?: string): string {
  if (!navn) return "?";
  return navn
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || "")
    .join("");
}

/** Ingen aktivitet siste 7 dager = kaldt. */
export function erKald(sistAktivitet?: string): boolean {
  const d = dagerSiden(sistAktivitet);
  return d === null || d >= 7;
}
