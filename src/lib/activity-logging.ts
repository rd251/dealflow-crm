import { Phone, PhoneMissed, Users, Mail, FileText, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { nesteOppfolgingFraUtfall, type LeadUtfallNokkel } from "@/lib/follow-up-rules";

/** Typene som faktisk finnes i databasen — skal ikke endres. */
export type AktivitetDbType = "Telefonsamtale" | "E-post" | "LinkedIn-melding" | "SMS" | "Møte" | "Notat";

/** Valgene brukeren ser i «Logg aktivitet». */
export type LoggType = "ringte" | "ikke_svar" | "moete" | "epost" | "notat" | "neste_steg";

export interface LoggTypeDef {
  value: LoggType;
  label: string;
  dbType: AktivitetDbType;
  defaultTittel: string;
  icon: typeof Phone;
  /** Tailwind-klasser fra designsystemet. */
  tone: string;
}

export const LOGG_TYPER: LoggTypeDef[] = [
  { value: "ringte", label: "Ringte", dbType: "Telefonsamtale", defaultTittel: "Ringte", icon: Phone, tone: "text-emerald-600 bg-emerald-500/10" },
  { value: "ikke_svar", label: "Svarte ikke", dbType: "Telefonsamtale", defaultTittel: "Ringte – svarte ikke", icon: PhoneMissed, tone: "text-amber-600 bg-amber-500/10" },
  { value: "moete", label: "Møte", dbType: "Møte", defaultTittel: "Møte", icon: Users, tone: "text-blue-600 bg-blue-500/10" },
  { value: "epost", label: "E-post", dbType: "E-post", defaultTittel: "Sendte e-post", icon: Mail, tone: "text-blue-600 bg-blue-500/10" },
  { value: "notat", label: "Notat", dbType: "Notat", defaultTittel: "Notat", icon: FileText, tone: "text-muted-foreground bg-muted" },
  { value: "neste_steg", label: "Neste steg", dbType: "Notat", defaultTittel: "Neste steg avtalt", icon: ArrowRight, tone: "text-blue-600 bg-blue-500/10" },
];

export const loggTypeDef = (t: LoggType): LoggTypeDef => LOGG_TYPER.find(d => d.value === t) || LOGG_TYPER[0];

/** Oversetter en lagret databasetype til et valg i dialogen. */
export function loggTypeFraDb(dbType: string): LoggType {
  switch (dbType) {
    case "Telefonsamtale": return "ringte";
    case "Møte": return "moete";
    case "E-post": return "epost";
    default: return "notat";
  }
}

/** Hurtighandlinger med ett trykk. Enkel å redigere — legg til/fjern rader her. */
export interface QuickAction {
  id: string;
  label: string;
  logg: LoggType;
  tittel: string;
  beskrivelse: string;
  icon: typeof Phone;
  tone: string;
  /** Styrer neste oppfølgingsdato. Se LEAD_OPPFOLGING_DAGER. */
  utfall?: LeadUtfallNokkel;
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "ringte-ikke-svar",
    label: "Ringte – svarte ikke",
    logg: "ikke_svar",
    tittel: "Ringte – svarte ikke",
    beskrivelse: "Forsøkte å ringe, fikk ikke svar",
    icon: PhoneMissed,
    tone: "text-amber-600",
  },
  {
    id: "ringte-booket-moete",
    label: "Ringte – booket møte",
    logg: "ringte",
    tittel: "Ringte – booket møte",
    beskrivelse: "Samtale gjennomført, møte booket",
    icon: Phone,
    tone: "text-emerald-600",
  },
  {
    id: "sendte-epost",
    label: "Sendte e-post",
    logg: "epost",
    tittel: "Sendte e-post",
    beskrivelse: "E-post sendt",
    icon: Mail,
    tone: "text-blue-600",
  },
];

export interface ActivityTarget {
  lead_id?: string | null;
  salgsmulighet_id?: string | null;
  selskap_id?: string | null;
  partner_id?: string | null;
  prosjekt_id?: string | null;
  kontakt_id?: string | null;
}

export interface MeetingDetails {
  tittel?: string;
  dato?: string;
  startTid?: string;
  sluttTid?: string;
  deltakere?: string[];
}

export interface LoggAktivitetInput {
  logg: LoggType;
  target: ActivityTarget;
  /** Overstyrer standardtittelen for typen. */
  tittel?: string;
  /** Valgfritt kort notat. */
  notat?: string;
  /** Valgfritt neste steg — oppretter oppgave og oppdaterer posten. */
  nesteSteg?: string;
  nesteStegDato?: string;
  meeting?: MeetingDetails;
  /** Default «manuell». Brukes f.eks. av AI-assistenten. */
  kilde?: string;
  ansvarlig?: string;
  /** Utfall som styrer automatisk oppfølgingsdato på lead. */
  utfall?: LeadUtfallNokkel;
  /** Manuell overstyring av oppfølgingsdato (yyyy-mm-dd). Tom streng = ikke rør. */
  nesteOppfolging?: string;
}

/** Standardutfall per aktivitetstype når ingen er oppgitt. */
const UTFALL_FRA_TYPE: Record<LoggType, LeadUtfallNokkel> = {
  ringte: "snakket",
  ikke_svar: "svarte_ikke",
  moete: "snakket",
  epost: "snakket",
  notat: "snakket",
  neste_steg: "snakket",
};

const idag = () => new Date().toISOString().split("T")[0];

const harTarget = (t: ActivityTarget) =>
  Boolean(t.lead_id || t.salgsmulighet_id || t.selskap_id || t.partner_id || t.prosjekt_id || t.kontakt_id);

/**
 * Eneste vei inn for å logge en aktivitet i CRM-et.
 * Skriver til den eksisterende `aktiviteter`-tabellen, oppdaterer «sist kontaktet»
 * og oppretter oppgave for neste steg når det er fylt ut.
 */
export async function loggAktivitet(input: LoggAktivitetInput): Promise<{ id: string | null; nesteOppfolging: string }> {
  const def = loggTypeDef(input.logg);
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id ?? null;
  const t = input.target;

  const tittel = (input.tittel ?? def.defaultTittel).trim();
  const notat = (input.notat ?? "").trim();

  const row: Record<string, unknown> = {
    type: def.dbType,
    tittel,
    beskrivelse: notat || tittel,
    dato: new Date().toISOString(),
    user_id: userId,
    aktivitet_kilde: input.kilde ?? "manuell",
    lead_id: t.lead_id || null,
    salgsmulighet_id: t.salgsmulighet_id || null,
    selskap_id: t.selskap_id || null,
    partner_id: t.partner_id || null,
    prosjekt_id: t.prosjekt_id || null,
    kontakt_id: t.kontakt_id || null,
  };

  if (input.logg === "moete" && input.meeting) {
    const m = input.meeting;
    if (m.tittel?.trim()) row.tittel = m.tittel.trim();
    if (m.dato && m.startTid) row.start_tid = `${m.dato}T${m.startTid}:00`;
    if (m.dato && m.sluttTid) row.slutt_tid = `${m.dato}T${m.sluttTid}:00`;
    if (m.deltakere?.length) row.deltakere = m.deltakere;
  }

  const { data, error } = await supabase.from("aktiviteter").insert(row as never).select("id").single();
  if (error) throw error;

  const nesteSteg = (input.nesteSteg ?? "").trim();

  // Neste steg → oppgave + felt på posten
  if (nesteSteg && harTarget(t)) {
    try {
      await supabase.from("oppgaver").insert({
        oppgave: nesteSteg,
        frist: input.nesteStegDato || null,
        prioritet: "Medium",
        status: "Åpen",
        paaminnelse: true,
        ansvarlig: input.ansvarlig || "",
        user_id: userId,
        lead_id: t.lead_id || null,
        salgsmulighet_id: t.salgsmulighet_id || null,
        selskap_id: t.selskap_id || null,
        kontakt_id: t.kontakt_id || null,
      } as never);
    } catch (err) {
      console.warn("Kunne ikke opprette oppgave for neste steg", err);
    }
  }

  // «Sist kontaktet» + neste steg på selve posten
  const dag = idag();
  const oppfolgingDato =
    input.nesteOppfolging?.trim() ||
    input.nesteStegDato?.trim() ||
    nesteOppfolgingFraUtfall(input.utfall ?? UTFALL_FRA_TYPE[input.logg]);

  const oppdater = async (tabell: "leads" | "salgsmuligheter" | "selskaper" | "partnere", id: string, medNesteSteg: boolean) => {
    const patch: Record<string, unknown> = { sist_aktivitet: dag };
    if (tabell === "leads") patch.neste_oppfolging = oppfolgingDato;
    if (medNesteSteg && nesteSteg && tabell !== "partnere") patch.neste_steg = nesteSteg;
    try {
      await supabase.from(tabell).update(patch as never).eq("id", id);
    } catch (err) {
      console.warn(`Kunne ikke oppdatere sist aktivitet på ${tabell}`, err);
    }
  };

  if (t.lead_id) await oppdater("leads", t.lead_id, true);
  if (t.salgsmulighet_id) await oppdater("salgsmuligheter", t.salgsmulighet_id, true);
  if (t.selskap_id) await oppdater("selskaper", t.selskap_id, true);
  if (t.partner_id) await oppdater("partnere", t.partner_id, false);

  return { id: (data as { id?: string } | null)?.id ?? null, nesteOppfolging: oppfolgingDato };
}
