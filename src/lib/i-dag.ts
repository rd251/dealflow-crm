/** Ren logikk for «I dag»-siden (Oversikt). Ingen datamodell-endringer. */

export function dagStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Hele dager mellom dato (YYYY-MM-DD…) og i dag. Negativ = frem i tid. */
export function dagerForfalt(dato: string, now: Date = new Date()): number {
  const a = new Date(`${dato.slice(0, 10)}T00:00:00`).getTime();
  const b = new Date(`${dagStr(now)}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

const LUKKET_LEAD = ["Ikke aktuelt", "Konvertert til salg", "Konvertert til partner"];

export interface FolgOppOppgave { id: string; oppgave: string; frist: string; status: string; ansvarlig: string; lead_id?: string; kontakt_id?: string; selskap_id?: string; salgsmulighet_id?: string }
export interface FolgOppLead { id: string; kontaktperson: string; firmanavn: string; telefon: string; status: string; neste_oppfolging?: string; ansvarlig: string }

export interface FolgOppRad {
  key: string;
  type: "oppgave" | "lead";
  id: string;
  navn: string;
  hva: string;
  dato: string;
  dagerForfalt: number;
  telefon: string;
  ansvarlig: string;
}

/** Slår sammen åpne oppgaver (frist ≤ i dag) og leads (neste_oppfolging ≤ i dag), eldst først. */
export function folgOppNa(
  oppgaver: FolgOppOppgave[],
  leads: FolgOppLead[],
  now: Date = new Date(),
  telefonFor: (o: FolgOppOppgave) => string = () => "",
): FolgOppRad[] {
  const i = dagStr(now);
  const rader: FolgOppRad[] = [];
  for (const o of oppgaver) {
    if (o.status === "Ferdig" || !o.frist || o.frist.slice(0, 10) > i) continue;
    rader.push({ key: `o-${o.id}`, type: "oppgave", id: o.id, navn: o.oppgave, hva: "Oppgave", dato: o.frist.slice(0, 10), dagerForfalt: dagerForfalt(o.frist, now), telefon: telefonFor(o), ansvarlig: o.ansvarlig });
  }
  for (const l of leads) {
    if (LUKKET_LEAD.includes(l.status) || !l.neste_oppfolging || l.neste_oppfolging.slice(0, 10) > i) continue;
    rader.push({
      key: `l-${l.id}`, type: "lead", id: l.id,
      navn: [l.kontaktperson, l.firmanavn].filter(Boolean).join(" · ") || "Lead",
      hva: l.status === "Ny" ? "Ring" : "Ring igjen",
      dato: l.neste_oppfolging.slice(0, 10), dagerForfalt: dagerForfalt(l.neste_oppfolging, now), telefon: l.telefon, ansvarlig: l.ansvarlig,
    });
  }
  return rader.sort((a, b) => a.dato.localeCompare(b.dato) || a.navn.localeCompare(b.navn));
}

export interface VenterRad { id: string; status: string; sendt_dato: string; user_id: string }

/** Kun «venter» og «varslet» (ikke besvart/avsluttet), eldst først. */
export function filtrerVenter<T extends VenterRad>(rader: T[]): T[] {
  return rader.filter(r => r.status === "venter" || r.status === "varslet").sort((a, b) => a.sendt_dato.localeCompare(b.sendt_dato));
}

export type Eierskap = "mine" | "teamet";
export interface Meg { userId: string; navn: string[] }

/** Mine = ansvarlig/eier/user_id er meg. Teamet = alt. */
export function erMin(filter: Eierskap, meg: Meg, felt: { ansvarlig?: string | null; eier_id?: string | null; user_id?: string | null }): boolean {
  if (filter === "teamet") return true;
  if (meg.userId && (felt.eier_id === meg.userId || felt.user_id === meg.userId || felt.ansvarlig === meg.userId)) return true;
  const a = (felt.ansvarlig || "").trim().toLowerCase();
  if (!a) return false;
  return meg.navn.filter(Boolean).some(n => { const m = n.toLowerCase(); return a === m || a.includes(m) || m.includes(a); });
}

export interface StilleSm { id: string; navn: string; status: string; neste_steg: string; sist_aktivitet: string; opprettet_dato?: string }

/** Åpne salgsmuligheter uten neste steg eller uten aktivitet på 7+ dager. */
export function salgSomStarStille<T extends StilleSm>(sms: T[], now: Date = new Date()): (T & { mangler: string })[] {
  return sms
    .filter(s => !["Vunnet", "Tapt"].includes(s.status))
    .map(s => {
      const sist = s.sist_aktivitet || s.opprettet_dato || "";
      const dager = sist ? dagerForfalt(sist, now) : null;
      const mangler = !s.neste_steg?.trim() ? "Mangler neste steg" : dager !== null && dager >= 7 ? `${dager} dager uten aktivitet` : "";
      return { ...s, mangler, _d: dager ?? 9999 };
    })
    .filter(s => s.mangler)
    .sort((a, b) => b._d - a._d)
    .map(({ _d, ...s }) => s as T & { mangler: string });
}
