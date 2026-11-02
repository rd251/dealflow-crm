import type { Lead, Oppgave } from "@/data/crm-data";
import { lokalDato } from "@/lib/logg-utfall";

type Upd<T> = (fn: (prev: T[]) => T[]) => void;

/** «Ta opp nå»: avslutt «Senere» med en gang og flytt oppfølgingen til i dag. */
export function taActivNaa(lead: Lead, updateLeads: Upd<Lead>, updateOppgaver: Upd<Oppgave>) {
  const dag = lokalDato(new Date());
  const gammel = lead.senere_til?.slice(0, 10);
  updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, senere_til: "", neste_oppfolging: dag } : l));
  updateOppgaver(prev => prev.map(o => o.lead_id === lead.id && o.status !== "Ferdig" && gammel && o.frist?.slice(0, 10) === gammel ? { ...o, frist: dag } : o));
}
