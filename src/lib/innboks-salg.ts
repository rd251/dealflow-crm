/** Enkle regler for «Salgsmulighet» fra personpanelet i Innboks. */

export const FOERSTE_STEG = "Møte booket";
const AVSLUTTET = new Set(["Vunnet", "Tapt"]);
const GENERISKE = /^(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|me|mac|msn|aol|mail|protonmail|proton|gmx|yandex|online|frisurf|broadpark|getmail)\./i;

interface SelskapLite { id: string; firmanavn: string; domene?: string | null }
interface SmLite { id: string; navn: string; selskap_id?: string | null; status?: string | null }

export const epostDomene = (email: string) => (email.split("@")[1] || "").toLowerCase().trim();
export const erGeneriskDomene = (domene: string) => !domene || GENERISKE.test(domene);
const norm = (v?: string | null) => (v || "").toLowerCase().trim().replace(/^www\./, "");

/** Eksisterende selskap med samme navn eller domene (ingen duplikater). */
export function finnSelskap(selskaper: SelskapLite[], navn: string, domene: string): SelskapLite | null {
  const n = norm(navn);
  const d = erGeneriskDomene(domene) ? "" : norm(domene);
  return selskaper.find(s => n && norm(s.firmanavn) === n)
    || (d ? selskaper.find(s => norm(s.domene) === d) : undefined)
    || null;
}

/** Forslag til selskap: koblet selskap, ellers domenematch (domene-felt eller navn som inneholder domenebasen). */
export function foreslaaSelskap(selskaper: SelskapLite[], email: string, koblet?: string | null): SelskapLite | null {
  if (koblet) { const s = selskaper.find(x => x.id === koblet); if (s) return s; }
  const d = epostDomene(email);
  if (erGeneriskDomene(d)) return null;
  const base = d.split(".")[0];
  return selskaper.find(s => norm(s.domene) === d)
    || (base.length >= 2 ? selskaper.find(s => norm(s.firmanavn).includes(base)) : undefined)
    || null;
}

/** Navneforslag for nytt selskap ut fra e-postdomenet («boels.de» → «Boels»). */
export function navnFraDomene(email: string): string {
  const d = epostDomene(email);
  if (erGeneriskDomene(d)) return "";
  const base = d.split(".")[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Første åpne (ikke vunnet/tapt) salgsmulighet på selskapet. */
export function aapenSalgsmulighet<T extends SmLite>(sm: T[], selskapId?: string | null): T | null {
  if (!selskapId) return null;
  return sm.find(s => s.selskap_id === selskapId && !AVSLUTTET.has(s.status || "")) || null;
}
