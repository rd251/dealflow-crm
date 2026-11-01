/** Visningshjelpere for leadkort og lead-detaljpanel (kun UI, ingen datamodell). */

const MND = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

function dagStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** «29. okt» */
export function kortDato(dato?: string): string {
  if (!dato) return "";
  const d = new Date(`${dato.slice(0, 10)}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  return `${d.getDate()}. ${MND[d.getMonth()]}`;
}

/** «I dag», «I går» eller «29. okt». */
export function komInnTekst(dato?: string, now: Date = new Date()): string {
  if (!dato) return "";
  const dag = dato.slice(0, 10);
  if (dag === dagStr(now)) return "I dag";
  const igaar = new Date(now);
  igaar.setDate(igaar.getDate() - 1);
  if (dag === dagStr(igaar)) return "I går";
  return kortDato(dag);
}

/** Linjen «Neste: …» på kortet. `haster` = forfalt eller i dag. */
export function nesteTekst(dato: string | undefined, status: string, now: Date = new Date()): { tekst: string; haster: boolean } | null {
  if (status === "Ikke aktuelt" || !dato) return null;
  const dag = dato.slice(0, 10);
  if (dag <= dagStr(now)) return { tekst: "Neste: Ring i dag", haster: true };
  return { tekst: `${status === "Ny" ? "Ring" : "Ring igjen"} ${kortDato(dag)}`, haster: false };
}

const FYLLTEKST = /(ikke oppgitt|har ikke (skrevet|oppgitt)|ingen beskrivelse|^[-–—\s]*$)/i;

/** «Ønsker»-tekst kun hvis leadet faktisk har skrevet noe. */
export function ekteOnske(tekst?: string | null): string | null {
  const t = (tekst || "").trim();
  if (!t || FYLLTEKST.test(t)) return null;
  return t;
}

export interface LeadKvalitet {
  firmaUklart: boolean;
  telefonUgyldig: boolean;
  meldinger: string[];
}

/** Gyldig norsk mobil/fastnummer: 8 sifre som starter på 2–9, ev. med +47/0047. */
export function erGyldigNorskTelefon(telefon: string): boolean {
  const raw = telefon.trim().replace(/[\s\-().]/g, "");
  if (!raw) return true;
  let sifre = raw;
  if (sifre.startsWith("+")) {
    if (!sifre.startsWith("+47")) return false;
    sifre = sifre.slice(3);
  } else if (sifre.startsWith("0047")) {
    sifre = sifre.slice(4);
  }
  if (!/^\d+$/.test(sifre)) return false;
  if (raw.replace(/\D/g, "").length > 12) return false;
  return /^[2-9]\d{7}$/.test(sifre);
}

export function leadKvalitet(lead: { firmanavn?: string; kontaktperson?: string; telefon?: string }): LeadKvalitet {
  const firma = (lead.firmanavn || "").trim();
  const fornavn = (lead.kontaktperson || "").trim().split(/\s+/)[0]?.toLocaleLowerCase("nb") || "";
  const firmaUklart =
    (firma.length >= 1 && firma.length <= 2) ||
    firma.length > 40 ||
    (!!fornavn && firma.toLocaleLowerCase("nb") === fornavn);
  const telefonUgyldig = !!(lead.telefon || "").trim() && !erGyldigNorskTelefon(lead.telefon || "");
  const meldinger: string[] = [];
  if (firmaUklart) meldinger.push(`Firmanavnet «${firma}» ser ikke ut som et firma. Spør om firma i samtalen og rett det her.`);
  if (telefonUgyldig) meldinger.push(`Telefonnummeret «${lead.telefon}» ser ikke ut som et gyldig norsk nummer. Sjekk nummeret før du ringer.`);
  return { firmaUklart, telefonUgyldig, meldinger };
}
