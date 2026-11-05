/** Ren logikk for «Gjort i dag» på Oversikt. Leser kun eksisterende aktiviteter og ferdige oppgaver. */
import { renAktivitetstekst, epostAdresser } from "@/lib/aktivitet-visning";

export type GjortType = "snakket" | "svarte_ikke" | "ring_tilbake" | "booket" | "ikke_naa" | "ikke_interessert" | "melding" | "notat" | "oppgave" | "epost" | "annet";

export interface GjortAkt { id: string; type: string; tittel: string | null; beskrivelse: string | null; dato: string; user_id: string | null; lead_id?: string | null; kontakt_id?: string | null; salgsmulighet_id?: string | null; selskap_id?: string | null }
export interface GjortOppgave { id: string; oppgave: string; updated_at: string; user_id: string | null; ansvarlig?: string | null; lead_id?: string | null; kontakt_id?: string | null; salgsmulighet_id?: string | null; selskap_id?: string | null }

export interface GjortRad {
  key: string; tid: string; type: GjortType; label: string; tittel: string; notat: string;
  user_id: string | null; ansvarlig?: string | null;
  lead_id?: string | null; kontakt_id?: string | null; salgsmulighet_id?: string | null; selskap_id?: string | null;
}

export const GJORT_LABEL: Record<GjortType, string> = {
  snakket: "📞 Snakket med", svarte_ikke: "📵 Svarte ikke", ring_tilbake: "🔁 Ring tilbake", booket: "📅 Booket møte",
  ikke_naa: "⏳ Ikke nå", ikke_interessert: "✋ Ikke interessert", melding: "✉️ Melding", notat: "📝 Notat", oppgave: "✅ Oppgave fullført", epost: "📧 E-post sendt", annet: "• Aktivitet",
};

const SAMTALE: GjortType[] = ["snakket", "svarte_ikke", "ring_tilbake", "booket", "ikke_naa", "ikke_interessert"];

/** Utfall utledes fra titlene den felles loggkomponenten skriver. */
export function klassifiser(a: Pick<GjortAkt, "type" | "tittel">): GjortType {
  const t = (a.tittel || "").trim().toLowerCase();
  if (a.type === "SMS" || a.type === "E-post" || t.startsWith("sendte ")) return "melding";
  if (t.startsWith("ringte – svarte ikke") || t.startsWith("ringte - svarte ikke")) return "svarte_ikke";
  if (t.startsWith("snakket med")) return "snakket";
  if (t.startsWith("ring tilbake")) return "ring_tilbake";
  if (t.startsWith("booket møte")) return "booket";
  if (t.startsWith("ikke nå")) return "ikke_naa";
  if (t.startsWith("ikke interessert")) return "ikke_interessert";
  if (a.type === "Telefonsamtale") return "snakket";
  if (a.type === "Notat") return "notat";
  return "annet";
}

/** Midnatt norsk tid i dag, som ISO-streng. */
export function midnattOslo(naa: Date = new Date()): string {
  const deler = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(naa);
  const g = (k: string) => Number(deler.find(p => p.type === k)?.value);
  const osloSomUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
  const offset = osloSomUtc - Math.floor(naa.getTime() / 60000) * 60000;
  return new Date(Date.UTC(g("year"), g("month") - 1, g("day")) - offset).toISOString();
}

/** Sendte Gmail-e-poster i dag. Systemvarsler fra CRM-et telles ikke. user_id mangler → tilskrives Gmail-eieren. */
export function byggEposter(eposter: GjortAkt[], manuelle: GjortAkt[], fra: string, gmailEier: string | null = null): GjortRad[] {
  const fraMs = new Date(fra).getTime();
  const manuelleEpost = manuelle.filter(a => klassifiser(a) === "melding" && (a.type === "E-post" || /e-post/i.test(a.tittel || "")));
  return eposter.filter(e => new Date(e.dato).getTime() >= fraMs && !/^→?\s*\[Snakk CRM\]/.test((e.tittel || "").trim()))
    .filter(e => {
      // Unngå dobbelttelling: manuell e-postlogg på samme kunde innen 15 min.
      const t = new Date(e.dato).getTime();
      return !manuelleEpost.some(m => Math.abs(new Date(m.dato).getTime() - t) <= 15 * 60000 &&
        ((e.lead_id && m.lead_id === e.lead_id) || (e.kontakt_id && m.kontakt_id === e.kontakt_id) || (e.salgsmulighet_id && m.salgsmulighet_id === e.salgsmulighet_id) || (e.selskap_id && m.selskap_id === e.selskap_id)));
    })
    .map(e => {
      const emne = (e.tittel || "").replace(/^→\s*/, "").trim();
      const til = epostAdresser(e.beskrivelse)[0] || "";
      return {
        key: `e-${e.id}`, tid: e.dato, type: "epost" as GjortType, label: GJORT_LABEL.epost, tittel: emne,
        notat: [til && `til ${til}`, emne].filter(Boolean).join(" · "),
        user_id: e.user_id || gmailEier, lead_id: e.lead_id, kontakt_id: e.kontakt_id, salgsmulighet_id: e.salgsmulighet_id, selskap_id: e.selskap_id,
      };
    });
}

export function byggGjort(akt: GjortAkt[], oppg: GjortOppgave[], fra: string): GjortRad[] {
  const fraMs = new Date(fra).getTime();
  const rader: GjortRad[] = [
    ...akt.filter(a => a.type !== "Møte" && new Date(a.dato).getTime() >= fraMs).map(a => {
      const type = klassifiser(a);
      const besk = renAktivitetstekst(a.beskrivelse);
      return {
        key: `a-${a.id}`, tid: a.dato, type, label: GJORT_LABEL[type], tittel: a.tittel || "",
        notat: besk && besk !== (a.tittel || "").trim() ? besk.split("\n")[0] : "",
        user_id: a.user_id, lead_id: a.lead_id, kontakt_id: a.kontakt_id, salgsmulighet_id: a.salgsmulighet_id, selskap_id: a.selskap_id,
      };
    }),
    ...oppg.filter(o => new Date(o.updated_at).getTime() >= fraMs).map(o => ({
      key: `o-${o.id}`, tid: o.updated_at, type: "oppgave" as GjortType, label: GJORT_LABEL.oppgave, tittel: o.oppgave, notat: "",
      user_id: o.user_id, ansvarlig: o.ansvarlig, lead_id: o.lead_id, kontakt_id: o.kontakt_id, salgsmulighet_id: o.salgsmulighet_id, selskap_id: o.selskap_id,
    })),
  ];
  return rader.sort((a, b) => b.tid.localeCompare(a.tid));
}

export function oppsummer(rader: GjortRad[]) {
  return {
    samtaler: rader.filter(r => SAMTALE.includes(r.type)).length,
    snakket: rader.filter(r => r.type === "snakket").length,
    booket: rader.filter(r => r.type === "booket").length,
    meldinger: rader.filter(r => r.type === "melding").length,
    oppgaver: rader.filter(r => r.type === "oppgave").length,
    eposter: rader.filter(r => r.type === "epost").length,
  };
}

/** Varsle Oversikt om at noe er logget, så «Gjort i dag» oppdateres umiddelbart. */
export const GJORT_EVENT = "crm:logget";
export const varsleLogget = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(GJORT_EVENT)); };
