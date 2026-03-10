// ============ TYPES ============

export type LeadStatus = "Ny" | "Kontaktet" | "Kvalifisert" | "Ikke aktuelt" | "Konvertert til salg";
export type LeadKilde = "Nettside" | "LinkedIn" | "Partner" | "Referanse" | "Kald outbound" | "E-post" | "Telefon" | "Annet";

export type SalgsmulighetStatus = "Ny mulighet" | "Møte booket" | "Demo gjennomført" | "Tilbud sendt" | "Forhandling" | "Vunnet" | "Tapt";
export type Tapsaarsak = "Pris" | "Ikke riktig timing" | "Valgte annen leverandør" | "Ikke behov" | "Teknisk / integrasjon" | "Annet";

export type ProsjektStatus = "Ny" | "I produksjon" | "Test med kunde" | "Live" | "Blokkert";
export type Integrasjon = "Ingen" | "GastroPlanner" | "HubSpot" | "Lime" | "Salesforce" | "API" | "Annet";

export type Kundestatus = "Ikke kunde" | "Pilot" | "Live" | "Pause" | "Kansellert";
export type OnboardingStatus = "Ikke startet" | "Pågår" | "Venter på kunde" | "Klar for live" | "Ferdig";
export type Kundetilstand = "Bra" | "Usikker" | "Risiko";
export type Kanselleringsaarsak = "Pris" | "Lav bruk" | "Teknisk utfordring" | "Manglende verdi" | "Byttet leverandør" | "Midlertidig stopp" | "Annet";

export type OppgaveStatus = "Åpen" | "Pågår" | "Ferdig";
export type Prioritet = "Lav" | "Medium" | "Høy";

// ============ INTERFACES ============

export interface Lead {
  id: string;
  firmanavn: string;
  kontaktperson: string;
  e_post: string;
  telefon: string;
  kilde: LeadKilde;
  status: LeadStatus;
  ansvarlig: string;
  neste_steg: string;
  notater: string;
  opprettet_dato: string;
  sist_aktivitet: string;
  konvertert_dato: string;
}

export interface Salgsmulighet {
  id: string;
  navn: string;
  selskap_id: string;
  kontakt_id: string;
  ansvarlig: string;
  status: SalgsmulighetStatus;
  forventet_mrr: number;
  sla: number;
  oppstartskostnad: number;
  kontraktslengde_mnd: number;
  sannsynlighet: number;
  forventet_lukkedato: string;
  vunnet_dato: string;
  tapt_dato: string;
  tapsaarsak: Tapsaarsak | "";
  neste_steg: string;
  notater: string;
  opprettet_dato: string;
  sist_aktivitet: string;
}

export interface Prosjekt {
  id: string;
  prosjektnavn: string;
  selskap_id: string;
  salgsmulighet_id: string;
  ansvarlig: string;
  status: ProsjektStatus;
  startdato: string;
  forventet_go_live: string;
  go_live_dato: string;
  oppstartskostnad: number;
  oppstart_fakturert: boolean;
  oppstart_faktura_dato: string;
  oppstart_betalt: boolean;
  integrasjon: Integrasjon;
  notater: string;
}

export interface Selskap {
  id: string;
  firmanavn: string;
  bransje: string;
  kundeansvarlig: string;
  kundestatus: Kundestatus;
  live_status: boolean;
  onboarding_status: OnboardingStatus;
  mrr: number;
  arr: number;
  oppstartskostnad: number;
  go_live_dato: string;
  kansellert_dato: string;
  kanselleringsaarsak: Kanselleringsaarsak | "";
  kanselleringsnotat: string;
  kundetilstand: Kundetilstand;
  sist_aktivitet: string;
  neste_steg: string;
  notater: string;
}

export interface Kontakt {
  id: string;
  navn: string;
  selskap_id: string;
  rolle: string;
  e_post: string;
  telefon: string;
  linkedin: string;
  notater: string;
}

export interface Oppgave {
  id: string;
  oppgave: string;
  lead_id: string;
  selskap_id: string;
  salgsmulighet_id: string;
  ansvarlig: string;
  frist: string;
  prioritet: Prioritet;
  status: OppgaveStatus;
  paaminnelse: boolean;
  notater: string;
}

// ============ HELPERS ============

export function beregnArr(mrr: number) { return mrr * 12; }
export function beregnTotalMrr(s: Salgsmulighet) { return s.forventet_mrr + (s.sla || 0); }
export function beregnTotalKontraktsverdi(s: Salgsmulighet) {
  return (s.forventet_mrr * s.kontraktslengde_mnd) + s.oppstartskostnad;
}
export function beregnVektetPipeline(s: Salgsmulighet) {
  return beregnTotalKontraktsverdi(s) * (s.sannsynlighet / 100);
}

// ============ SEED DATA ============

const today = "2026-03-10";

export const initialSelskaper: Selskap[] = [
  { id: "S-0001", firmanavn: "Jobbkort AS", bransje: "HR Tech", kundeansvarlig: "", kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet", mrr: 0, arr: 0, oppstartskostnad: 0, go_live_dato: "", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0002", firmanavn: "Sporty Norge AS", bransje: "E-handel", kundeansvarlig: "", kundestatus: "Live", live_status: true, onboarding_status: "Ferdig", mrr: 12990, arr: 155880, oppstartskostnad: 15000, go_live_dato: "2026-01-15", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0003", firmanavn: "Protect Vakthold og Sikkerhet Sande AS", bransje: "Sikkerhet", kundeansvarlig: "", kundestatus: "Live", live_status: true, onboarding_status: "Ferdig", mrr: 2999, arr: 35988, oppstartskostnad: 5000, go_live_dato: "2026-02-01", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0004", firmanavn: "Uni Micro AS", bransje: "ERP", kundeansvarlig: "", kundestatus: "Live", live_status: true, onboarding_status: "Ferdig", mrr: 12900, arr: 154800, oppstartskostnad: 43700, go_live_dato: "2025-11-01", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0005", firmanavn: "Gastro Planner AS", bransje: "Restaurant Tech", kundeansvarlig: "", kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet", mrr: 0, arr: 0, oppstartskostnad: 0, go_live_dato: "", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0006", firmanavn: "RSA", bransje: "Enterprise", kundeansvarlig: "", kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet", mrr: 0, arr: 0, oppstartskostnad: 4999, go_live_dato: "", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0007", firmanavn: "Trenogmat AS", bransje: "Mat & Drikke", kundeansvarlig: "", kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet", mrr: 0, arr: 0, oppstartskostnad: 13997, go_live_dato: "", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0008", firmanavn: "Innlandet Legesenter AS", bransje: "Helse", kundeansvarlig: "", kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet", mrr: 0, arr: 0, oppstartskostnad: 10300, go_live_dato: "", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0009", firmanavn: "Drifti AS", bransje: "SaaS", kundeansvarlig: "", kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet", mrr: 0, arr: 0, oppstartskostnad: 5000, go_live_dato: "", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0010", firmanavn: "LP RESTAURANTDRIFT AS", bransje: "Restaurant", kundeansvarlig: "", kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet", mrr: 0, arr: 0, oppstartskostnad: 8997, go_live_dato: "", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0011", firmanavn: "Belron Solutions AS", bransje: "Enterprise", kundeansvarlig: "", kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet", mrr: 0, arr: 0, oppstartskostnad: 0, go_live_dato: "", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0012", firmanavn: "Outwork AS", bransje: "SaaS", kundeansvarlig: "", kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet", mrr: 0, arr: 0, oppstartskostnad: 12900, go_live_dato: "", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0013", firmanavn: "Nimbus Direct AS", bransje: "Logistikk", kundeansvarlig: "", kundestatus: "Live", live_status: true, onboarding_status: "Ferdig", mrr: 12900, arr: 154800, oppstartskostnad: 24500, go_live_dato: "2025-12-01", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0014", firmanavn: "Vanylven Kommune", bransje: "Offentlig", kundeansvarlig: "", kundestatus: "Live", live_status: true, onboarding_status: "Ferdig", mrr: 12900, arr: 154800, oppstartskostnad: 0, go_live_dato: "2025-10-15", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0015", firmanavn: "Nordic BIM Group", bransje: "Bygg & Anlegg", kundeansvarlig: "", kundestatus: "Live", live_status: true, onboarding_status: "Ferdig", mrr: 12900, arr: 154800, oppstartskostnad: 49000, go_live_dato: "2025-09-01", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0016", firmanavn: "USA kunde (navn mangler)", bransje: "Annet", kundeansvarlig: "", kundestatus: "Live", live_status: true, onboarding_status: "Ferdig", mrr: 990, arr: 11880, oppstartskostnad: 0, go_live_dato: "2026-01-01", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0017", firmanavn: "Defigo AS", bransje: "PropTech", kundeansvarlig: "", kundestatus: "Live", live_status: true, onboarding_status: "Ferdig", mrr: 10000, arr: 120000, oppstartskostnad: 98000, go_live_dato: "2025-08-01", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0018", firmanavn: "Fair Collection AS", bransje: "Finans", kundeansvarlig: "", kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet", mrr: 0, arr: 0, oppstartskostnad: 80000, go_live_dato: "", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0019", firmanavn: "BOB Trafikkskole AS", bransje: "Utdanning", kundeansvarlig: "", kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet", mrr: 0, arr: 0, oppstartskostnad: 5000, go_live_dato: "", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0020", firmanavn: "Zen Finans AS", bransje: "Finans", kundeansvarlig: "", kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet", mrr: 0, arr: 0, oppstartskostnad: 60000, go_live_dato: "", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0021", firmanavn: "Eger Group", bransje: "Retail", kundeansvarlig: "", kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet", mrr: 0, arr: 0, oppstartskostnad: 0, go_live_dato: "", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
  { id: "S-0022", firmanavn: "FF Rollerskis AS", bransje: "Sport", kundeansvarlig: "", kundestatus: "Live", live_status: true, onboarding_status: "Ferdig", mrr: 990, arr: 11880, oppstartskostnad: 0, go_live_dato: "2026-02-15", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "" },
];

export const initialKontakter: Kontakt[] = [
  { id: "K-0001", selskap_id: "S-0002", navn: "Lars Hansen", e_post: "lars@sportynorge.no", telefon: "+47 900 11 222", rolle: "CEO", linkedin: "", notater: "" },
  { id: "K-0002", selskap_id: "S-0004", navn: "Maria Olsen", e_post: "maria@unimicro.no", telefon: "+47 900 33 444", rolle: "CTO", linkedin: "", notater: "" },
  { id: "K-0003", selskap_id: "S-0013", navn: "Erik Johansen", e_post: "erik@nimbusdirect.no", telefon: "+47 900 55 666", rolle: "Salgssjef", linkedin: "", notater: "" },
  { id: "K-0004", selskap_id: "S-0015", navn: "Kari Nordmann", e_post: "kari@nordicbim.no", telefon: "+47 900 77 888", rolle: "IT-leder", linkedin: "", notater: "" },
  { id: "K-0005", selskap_id: "S-0017", navn: "Thomas Berg", e_post: "thomas@defigo.no", telefon: "+47 900 99 000", rolle: "CEO", linkedin: "", notater: "" },
  { id: "K-0006", selskap_id: "S-0018", navn: "Anne Kristiansen", e_post: "anne@faircollection.no", telefon: "+47 901 11 222", rolle: "COO", linkedin: "", notater: "" },
  { id: "K-0007", selskap_id: "S-0020", navn: "Petter Svendsen", e_post: "petter@zenfinans.no", telefon: "+47 901 33 444", rolle: "CTO", linkedin: "", notater: "" },
  { id: "K-0008", selskap_id: "S-0009", navn: "Silje Dahl", e_post: "silje@drifti.no", telefon: "+47 901 55 666", rolle: "Grunnlegger", linkedin: "", notater: "" },
  { id: "K-0009", selskap_id: "S-0014", navn: "Olav Moen", e_post: "olav@vanylven.kommune.no", telefon: "+47 901 77 888", rolle: "IT-leder", linkedin: "", notater: "" },
  { id: "K-0010", selskap_id: "S-0001", navn: "Henrik Lie", e_post: "henrik@jobbkort.no", telefon: "+47 901 99 000", rolle: "CEO", linkedin: "", notater: "" },
];

export const initialSalgsmuligheter: Salgsmulighet[] = [
  { id: "SM-0001", navn: "Outbound Info agent", selskap_id: "S-0001", kontakt_id: "K-0010", ansvarlig: "", status: "Tilbud sendt", forventet_mrr: 990, sla: 0, oppstartskostnad: 0, kontraktslengde_mnd: 12, sannsynlighet: 100, forventet_lukkedato: "2026-04-15", vunnet_dato: "", tapt_dato: "", tapsaarsak: "", neste_steg: "Avventer svar", notater: "", opprettet_dato: "2026-03-01", sist_aktivitet: today },
  { id: "SM-0002", navn: "Restaurant agenter", selskap_id: "S-0005", kontakt_id: "", ansvarlig: "", status: "Møte booket", forventet_mrr: 0, sla: 0, oppstartskostnad: 0, kontraktslengde_mnd: 12, sannsynlighet: 50, forventet_lukkedato: "2026-05-01", vunnet_dato: "", tapt_dato: "", tapsaarsak: "", neste_steg: "Gjennomfør demo", notater: "", opprettet_dato: "2026-02-20", sist_aktivitet: today },
  { id: "SM-0003", navn: "Internt system rapportering", selskap_id: "S-0006", kontakt_id: "", ansvarlig: "", status: "Møte booket", forventet_mrr: 12900, sla: 0, oppstartskostnad: 4999, kontraktslengde_mnd: 12, sannsynlighet: 50, forventet_lukkedato: "2026-04-30", vunnet_dato: "", tapt_dato: "", tapsaarsak: "", neste_steg: "Demo planlagt", notater: "", opprettet_dato: "2026-02-15", sist_aktivitet: today },
  { id: "SM-0004", navn: "Support agent", selskap_id: "S-0007", kontakt_id: "", ansvarlig: "", status: "Møte booket", forventet_mrr: 2999, sla: 0, oppstartskostnad: 13997, kontraktslengde_mnd: 12, sannsynlighet: 50, forventet_lukkedato: "2026-04-20", vunnet_dato: "", tapt_dato: "", tapsaarsak: "", neste_steg: "", notater: "", opprettet_dato: "2026-02-10", sist_aktivitet: today },
  { id: "SM-0005", navn: "Resepsjonist", selskap_id: "S-0008", kontakt_id: "", ansvarlig: "", status: "Møte booket", forventet_mrr: 12900, sla: 0, oppstartskostnad: 10300, kontraktslengde_mnd: 12, sannsynlighet: 50, forventet_lukkedato: "2026-04-25", vunnet_dato: "", tapt_dato: "", tapsaarsak: "", neste_steg: "", notater: "", opprettet_dato: "2026-02-05", sist_aktivitet: today },
  { id: "SM-0006", navn: "Support og salgs agent", selskap_id: "S-0009", kontakt_id: "K-0008", ansvarlig: "", status: "Tilbud sendt", forventet_mrr: 12900, sla: 0, oppstartskostnad: 5000, kontraktslengde_mnd: 12, sannsynlighet: 100, forventet_lukkedato: "2026-04-10", vunnet_dato: "", tapt_dato: "", tapsaarsak: "", neste_steg: "Venter på signering", notater: "", opprettet_dato: "2026-01-20", sist_aktivitet: today },
  { id: "SM-0007", navn: "Matbestilling", selskap_id: "S-0010", kontakt_id: "", ansvarlig: "", status: "Møte booket", forventet_mrr: 2999, sla: 0, oppstartskostnad: 8997, kontraktslengde_mnd: 12, sannsynlighet: 50, forventet_lukkedato: "2026-05-15", vunnet_dato: "", tapt_dato: "", tapsaarsak: "", neste_steg: "", notater: "", opprettet_dato: "2026-02-25", sist_aktivitet: today },
  { id: "SM-0008", navn: "Booking system", selskap_id: "S-0011", kontakt_id: "", ansvarlig: "", status: "Møte booket", forventet_mrr: 5990, sla: 0, oppstartskostnad: 0, kontraktslengde_mnd: 12, sannsynlighet: 50, forventet_lukkedato: "2026-05-01", vunnet_dato: "", tapt_dato: "", tapsaarsak: "", neste_steg: "", notater: "", opprettet_dato: "2026-02-18", sist_aktivitet: today },
  { id: "SM-0009", navn: "Møte booking", selskap_id: "S-0012", kontakt_id: "", ansvarlig: "", status: "Tilbud sendt", forventet_mrr: 12900, sla: 0, oppstartskostnad: 12900, kontraktslengde_mnd: 12, sannsynlighet: 100, forventet_lukkedato: "2026-04-05", vunnet_dato: "", tapt_dato: "", tapsaarsak: "", neste_steg: "Signering neste uke", notater: "", opprettet_dato: "2026-01-15", sist_aktivitet: today },
  { id: "SM-0010", navn: "Support agent", selskap_id: "S-0018", kontakt_id: "K-0006", ansvarlig: "", status: "Møte booket", forventet_mrr: 80000, sla: 0, oppstartskostnad: 80000, kontraktslengde_mnd: 24, sannsynlighet: 50, forventet_lukkedato: "2026-06-01", vunnet_dato: "", tapt_dato: "", tapsaarsak: "", neste_steg: "Enterprise demo", notater: "", opprettet_dato: "2026-01-10", sist_aktivitet: today },
  { id: "SM-0011", navn: "Chatbot", selskap_id: "S-0019", kontakt_id: "", ansvarlig: "", status: "Ny mulighet", forventet_mrr: 990, sla: 0, oppstartskostnad: 5000, kontraktslengde_mnd: 12, sannsynlighet: 50, forventet_lukkedato: "2026-05-20", vunnet_dato: "", tapt_dato: "", tapsaarsak: "", neste_steg: "Første kontakt", notater: "", opprettet_dato: "2026-03-01", sist_aktivitet: today },
  { id: "SM-0012", navn: "Support agent og salg", selskap_id: "S-0020", kontakt_id: "K-0007", ansvarlig: "", status: "Møte booket", forventet_mrr: 92900, sla: 0, oppstartskostnad: 60000, kontraktslengde_mnd: 24, sannsynlighet: 50, forventet_lukkedato: "2026-06-15", vunnet_dato: "", tapt_dato: "", tapsaarsak: "", neste_steg: "Teknisk gjennomgang", notater: "", opprettet_dato: "2026-01-05", sist_aktivitet: today },
];

export const initialLeads: Lead[] = [
  { id: "L-0001", firmanavn: "Eger Group", kontaktperson: "Nina Enger", e_post: "nina@egergroup.no", telefon: "+47 902 11 222", kilde: "LinkedIn", status: "Ny", ansvarlig: "", neste_steg: "Første kontakt", notater: "", opprettet_dato: "2026-03-08", sist_aktivitet: today, konvertert_dato: "" },
  { id: "L-0002", firmanavn: "Fjord Tech AS", kontaktperson: "Anders Fjord", e_post: "anders@fjordtech.no", telefon: "+47 902 33 444", kilde: "Nettside", status: "Kontaktet", ansvarlig: "", neste_steg: "Sende info", notater: "Interessert i support agent", opprettet_dato: "2026-03-05", sist_aktivitet: today, konvertert_dato: "" },
  { id: "L-0003", firmanavn: "Bergen Eiendom AS", kontaktperson: "Lise Berg", e_post: "lise@bergeneiendom.no", telefon: "+47 902 55 666", kilde: "Referanse", status: "Kvalifisert", ansvarlig: "", neste_steg: "Booke demo", notater: "Henvist fra Defigo", opprettet_dato: "2026-03-02", sist_aktivitet: today, konvertert_dato: "" },
];

export const initialProsjekter: Prosjekt[] = [];

export const initialOppgaver: Oppgave[] = [
  { id: "O-0001", oppgave: "Følg opp Drifti AS tilbud", lead_id: "", selskap_id: "S-0009", salgsmulighet_id: "SM-0006", ansvarlig: "", frist: "2026-03-12", prioritet: "Høy", status: "Åpen", paaminnelse: true, notater: "" },
  { id: "O-0002", oppgave: "Send kontrakt til Outwork AS", lead_id: "", selskap_id: "S-0012", salgsmulighet_id: "SM-0009", ansvarlig: "", frist: "2026-03-14", prioritet: "Høy", status: "Åpen", paaminnelse: true, notater: "" },
  { id: "O-0003", oppgave: "Demo for Fair Collection", lead_id: "", selskap_id: "S-0018", salgsmulighet_id: "SM-0010", ansvarlig: "", frist: "2026-03-18", prioritet: "Høy", status: "Åpen", paaminnelse: true, notater: "" },
  { id: "O-0004", oppgave: "Følg opp Zen Finans møte", lead_id: "", selskap_id: "S-0020", salgsmulighet_id: "SM-0012", ansvarlig: "", frist: "2026-03-15", prioritet: "Høy", status: "Åpen", paaminnelse: true, notater: "" },
  { id: "O-0005", oppgave: "Forbered onboarding Jobbkort", lead_id: "", selskap_id: "S-0001", salgsmulighet_id: "SM-0001", ansvarlig: "", frist: "2026-03-20", prioritet: "Medium", status: "Åpen", paaminnelse: false, notater: "" },
];
