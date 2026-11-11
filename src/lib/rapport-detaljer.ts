import { endOfMonth } from "date-fns";
import type { Lead, Partner, Salgsmulighet, Selskap } from "@/data/crm-data";
import type { KundeRef } from "@/hooks/use-kort";

/** Én rad i detaljlisten under en graf på Rapporter. */
export interface RapportRad {
  id: string;
  navn: string;
  under?: string;
  dato?: string;
  verdi?: number;
  status?: string;
  kunde?: KundeRef;
  selskapId?: string;
  partnerId?: string;
}

export interface RapportMoete {
  id: string;
  dato: string;
  no_show: boolean;
  tittel: string | null;
  beskrivelse: string | null;
  lead_id: string | null;
  kontakt_id: string | null;
  salgsmulighet_id: string | null;
  selskap_id: string | null;
}

/** Samme månedsregel som grafene bruker, så listen alltid stemmer med søylen. */
export function iMaaned(dato: string | null | undefined, mnd: Date): boolean {
  if (!dato) return false;
  const d = new Date(dato);
  if (Number.isNaN(d.getTime())) return false;
  return d.getMonth() === mnd.getMonth() && d.getFullYear() === mnd.getFullYear();
}

export const iMaaneder = (dato: string | null | undefined, mnd: Date[]) => mnd.some(m => iMaaned(dato, m));

// --- Utvalg (brukes både til tall i grafen og til listen) ---
export const leadsI = (leads: Lead[], mnd: Date[]) => leads.filter(l => iMaaneder(l.opprettet_dato, mnd));
export const vunnetI = (sm: Salgsmulighet[], mnd: Date[]) => sm.filter(s => s.status === "Vunnet" && iMaaneder(s.vunnet_dato, mnd));
export const taptI = (sm: Salgsmulighet[], mnd: Date[]) => sm.filter(s => s.status === "Tapt" && iMaaneder(s.tapt_dato, mnd));
export const lukketI = (selskaper: Selskap[], mnd: Date[]) => selskaper.filter(s => iMaaneder(s.lukkedato, mnd));
export const moeterI = <T extends { dato: string }>(moeter: T[], mnd: Date[]) => moeter.filter(m => iMaaneder(m.dato, mnd));

/** Kunder som var aktive (lukket og ikke kansellert) ved utgangen av måneden. */
export function aktiveVed(selskaper: Selskap[], mnd: Date): Selskap[] {
  const slutt = endOfMonth(mnd);
  return selskaper.filter(s => {
    if (!s.lukkedato || new Date(s.lukkedato) > slutt) return false;
    if (s.kundestatus === "Kansellert" && s.kansellert_dato && new Date(s.kansellert_dato) <= slutt) return false;
    return true;
  });
}
export const erLiveVed = (s: Selskap, mnd: Date) => !!s.go_live_dato && new Date(s.go_live_dato) <= endOfMonth(mnd);

// --- Rader ---
const nyestFoerst = (a: RapportRad, b: RapportRad) => (b.dato || "").localeCompare(a.dato || "") || a.navn.localeCompare(b.navn, "nb");
export const sorter = (rader: RapportRad[]) => [...rader].sort(nyestFoerst);

export function leadRad(l: Lead): RapportRad {
  const navn = l.firmanavn?.trim() || l.kontaktperson?.trim() || l.e_post || "Uten navn";
  const under = [l.firmanavn?.trim() && l.kontaktperson?.trim() ? l.kontaktperson.trim() : "", l.kilde].filter(Boolean).join(" · ");
  return { id: `lead:${l.id}`, navn, under, dato: l.opprettet_dato, status: l.status, kunde: { type: "lead", id: l.id } };
}

export function smRad(s: Salgsmulighet, selskaper: Selskap[], opts: { dato?: string; verdi?: number } = {}): RapportRad {
  const sel = s.selskap_id ? selskaper.find(x => x.id === s.selskap_id) : undefined;
  const under = [sel?.firmanavn, s.ansvarlig].filter(Boolean).join(" · ");
  return { id: `sm:${s.id}`, navn: s.navn || sel?.firmanavn || "Uten navn", under, dato: opts.dato, verdi: opts.verdi, status: s.status, kunde: { type: "sm", id: s.id }, selskapId: sel?.id };
}

export function selskapRad(s: Selskap, opts: { dato?: string; verdi?: number; status?: string; under?: string } = {}): RapportRad {
  return {
    id: `selskap:${s.id}`, navn: s.firmanavn || "Uten navn", under: opts.under ?? (s.kundeansvarlig || undefined),
    dato: opts.dato, verdi: opts.verdi, status: opts.status ?? s.kundestatus, selskapId: s.id,
  };
}

export function partnerRad(p: Partner, opts: { verdi?: number } = {}): RapportRad {
  return { id: `partner:${p.id}`, navn: p.partnernavn || "Uten navn", under: [p.partnertype, p.kontaktperson].filter(Boolean).join(" · "), status: p.partnerstatus, verdi: opts.verdi, partnerId: p.id };
}

export function moeteRad(m: RapportMoete, selskaper: Selskap[]): RapportRad {
  const kunde: KundeRef | undefined = m.lead_id ? { type: "lead", id: m.lead_id }
    : m.salgsmulighet_id ? { type: "sm", id: m.salgsmulighet_id }
    : m.kontakt_id ? { type: "kontakt", id: m.kontakt_id } : undefined;
  const sel = m.selskap_id ? selskaper.find(s => s.id === m.selskap_id) : undefined;
  return {
    id: `moete:${m.id}`, navn: m.tittel?.trim() || m.beskrivelse?.trim().slice(0, 80) || "Møte", under: sel?.firmanavn,
    dato: m.dato, status: m.no_show ? "No-show" : undefined, kunde, selskapId: sel?.id,
  };
}
