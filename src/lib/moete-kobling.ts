/**
 * Regelen for «booket møte → salgsmulighet». Speiler databasefunksjonen
 * public.moete_til_salgsmulighet (som gjør selve jobben ved lagring/synk),
 * og brukes i Innboks for å finne møter uten kobling.
 */
export const GENERISKE_DOMENER = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "live.com", "icloud.com", "me.com",
  "msn.com", "aol.com", "protonmail.com", "proton.me", "online.no", "hotmail.no",
]);

export interface MoeteInput {
  type: string;
  lead_id?: string | null;
  salgsmulighet_id?: string | null;
  eksterne_deltakere?: string[] | null;
}
export interface LeadInput { id: string; e_post?: string | null; status: string; konvertert_dato?: string | null }
export interface SmInput { id: string; status: string; e_post?: string | null }

export type MoeteBeslutning =
  | { type: "ingen"; grunn: string }
  | { type: "koble"; salgsmulighet_id: string }
  | { type: "konverter"; lead_id: string }
  | { type: "forslag" };

const domene = (e: string) => (e.split("@")[1] || "").toLowerCase();

export function eksterneDeltakere(m: MoeteInput): string[] {
  return Array.from(new Set((m.eksterne_deltakere || [])
    .map(e => e.trim().toLowerCase())
    .filter(e => e.includes("@") && !e.endsWith("@snakk.ai"))));
}

export function vurderMoete(m: MoeteInput, leads: LeadInput[], sms: SmInput[], kjente: Set<string> = new Set()): MoeteBeslutning {
  if (m.type !== "Møte") return { type: "ingen", grunn: "ikke møte" };
  if (m.salgsmulighet_id) return { type: "ingen", grunn: "allerede koblet" };
  const eksterne = eksterneDeltakere(m);
  const ferdig = (l: LeadInput) => ["Konvertert til salg", "Konvertert til partner", "Ikke aktuelt"].includes(l.status);
  const sorter = (a: LeadInput, b: LeadInput) => Number(ferdig(a)) - Number(ferdig(b));

  let lead: LeadInput | undefined;
  if (m.lead_id) lead = leads.find(l => l.id === m.lead_id);
  else if (eksterne.length === 0) return { type: "ingen", grunn: "internt møte" };
  else {
    lead = leads.filter(l => l.e_post && eksterne.includes(l.e_post.toLowerCase())).sort(sorter)[0];
    if (!lead) {
      const domener = new Set(eksterne.map(domene));
      lead = leads.filter(l => {
        const d = domene(l.e_post || "");
        return d && !GENERISKE_DOMENER.has(d) && domener.has(d);
      }).sort(sorter)[0];
    }
  }
  if (!lead) {
    if (eksterne.length === 0) return { type: "ingen", grunn: "ingen lead" };
    // Kjent kontakt/selskap/salgsmulighet i CRM-et → ikke et forslag.
    const kjent = eksterne.some(e => kjente.has(e) || kjente.has(domene(e)) || sms.some(s => (s.e_post || "").toLowerCase() === e));
    return kjent ? { type: "ingen", grunn: "kjent i CRM" } : { type: "forslag" };
  }
  if (lead.status === "Ikke aktuelt" || lead.status === "Konvertert til partner") return { type: "ingen", grunn: "lead utenfor salg" };

  const epost = (lead.e_post || "").toLowerCase();
  const apen = epost ? sms.find(s => !["Vunnet", "Tapt"].includes(s.status) && (s.e_post || "").toLowerCase() === epost) : undefined;
  if (apen) return { type: "koble", salgsmulighet_id: apen.id };
  if (lead.status === "Konvertert til salg" || lead.konvertert_dato) return { type: "ingen", grunn: "allerede konvertert" };
  return { type: "konverter", lead_id: lead.id };
}
