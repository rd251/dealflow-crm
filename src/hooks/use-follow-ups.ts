import { useState, useEffect, useMemo } from "react";
import { differenceInHours, differenceInDays } from "date-fns";

const API_URL = import.meta.env.VITE_SUPABASE_URL + "/rest/v1";
const API_HEADERS = {
  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  "Content-Type": "application/json",
};

export type FollowUpType = "lead_stale" | "sm_stale" | "post_meeting" | "email_no_reply" | "email_awaiting_reply" | "email_needs_reply";
export type FollowUpPriority = "high" | "medium" | "low";

export interface FollowUpItem {
  id: string;
  type: FollowUpType;
  entityId: string;
  entityType: "lead" | "salgsmulighet";
  navn: string;
  kontaktperson: string | null;
  selskapNavn: string;
  ePost: string | null;
  selskapId: string | null;
  kontaktId: string | null;
  sistAktivitet: string | null;
  sistAktivitetType: string | null;
  anbefalHandling: string;
  verdi: number;
  priority: FollowUpPriority;
  hoursInactive: number;
  dismissed: boolean;
}

interface Aktivitet {
  id: string;
  type: string;
  dato: string;
  beskrivelse: string;
  tittel: string | null;
  lead_id: string | null;
  salgsmulighet_id: string | null;
  selskap_id: string | null;
  aktivitet_kilde: string | null;
}

export function useFollowUps(
  leads: any[],
  salgsmuligheter: any[],
  selskaper: any[]
) {
  const [aktiviteter, setAktiviteter] = useState<Aktivitet[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Fetch recent aktiviteter for matching
  useEffect(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    fetch(
      `${API_URL}/aktiviteter?dato=gte.${cutoff.toISOString()}&order=dato.desc&limit=500&select=id,type,dato,beskrivelse,tittel,lead_id,salgsmulighet_id,selskap_id,aktivitet_kilde`,
      { headers: API_HEADERS }
    )
      .then((r) => (r.ok ? r.json() : []))
      .then(setAktiviteter)
      .catch(() => setAktiviteter([]))
      .finally(() => setLoading(false));
  }, []);

  const followUps = useMemo(() => {
    const now = new Date();
    const items: FollowUpItem[] = [];

    const getSelskapNavn = (selskapId: string | null) => {
      if (!selskapId) return "—";
      return selskaper.find((s) => s.id === selskapId)?.firmanavn || "—";
    };

    // Helper: if a lead has been converted, find the matching salgsmulighet
    const resolveEntity = (entityId: string, entityType: "lead" | "salgsmulighet"): { id: string; type: "lead" | "salgsmulighet" } => {
      if (entityType === "lead") {
        const lead = leads.find((l) => l.id === entityId);
        if (lead && (lead.status === "Konvertert til salg" || lead.status === "Konvertert til partner")) {
          const sm = salgsmuligheter.find((s) => s.kontaktperson === lead.kontaktperson && s.navn === lead.firmanavn);
          if (sm) return { id: sm.id, type: "salgsmulighet" };
          // Also check by selskap match
          const selskap = selskaper.find((s) => s.firmanavn === lead.firmanavn);
          if (selskap) {
            const smBySelskap = salgsmuligheter.find((s) => s.selskap_id === selskap.id);
            if (smBySelskap) return { id: smBySelskap.id, type: "salgsmulighet" };
          }
        }
      }
      return { id: entityId, type: entityType };
    };

    const getLastActivity = (entityId: string, entityType: "lead" | "salgsmulighet") => {
      const field = entityType === "lead" ? "lead_id" : "salgsmulighet_id";
      const acts = aktiviteter.filter((a) => a[field] === entityId);
      if (acts.length === 0) return null;
      return acts[0]; // already sorted desc
    };

    const hasRecentFollowUp = (entityId: string, entityType: "lead" | "salgsmulighet") => {
      const field = entityType === "lead" ? "lead_id" : "salgsmulighet_id";
      const recent = aktiviteter.filter((a) => {
        if (a[field] !== entityId) return false;
        const hours = differenceInHours(now, new Date(a.dato));
        return hours < 4; // If activity within last 4 hours, consider follow-up already sent
      });
      return recent.length > 0;
    };

    // 1. Leads uten aktivitet siste 48 timer
    leads.forEach((lead) => {
      if (lead.status === "Ikke aktuelt" || lead.konvertert_til) return;

      const hoursInactive = lead.sist_aktivitet
        ? differenceInHours(now, new Date(lead.sist_aktivitet))
        : 999;

      if (hoursInactive < 48) return;
      if (hasRecentFollowUp(lead.id, "lead")) return;

      const lastAct = getLastActivity(lead.id, "lead");

      items.push({
        id: `lead-${lead.id}`,
        type: "lead_stale",
        entityId: lead.id,
        entityType: "lead",
        navn: lead.kontaktperson || lead.firmanavn,
        kontaktperson: lead.kontaktperson || null,
        selskapNavn: lead.firmanavn,
        ePost: lead.e_post || null,
        selskapId: null,
        kontaktId: null,
        sistAktivitet: lead.sist_aktivitet,
        sistAktivitetType: lastAct?.type || null,
        anbefalHandling: getLeadAction(lead, lastAct),
        verdi: 0,
        priority: hoursInactive > 120 ? "high" : "medium",
        hoursInactive,
        dismissed: false,
      });
    });

    // 2. Salgsmuligheter uten aktivitet siste 3-5 dager
    salgsmuligheter.forEach((sm) => {
      if (sm.status === "Vunnet" || sm.status === "Tapt") return;

      const hoursInactive = sm.sist_aktivitet
        ? differenceInHours(now, new Date(sm.sist_aktivitet))
        : 999;

      if (hoursInactive < 72) return; // 3 days
      if (hasRecentFollowUp(sm.id, "salgsmulighet")) return;

      const lastAct = getLastActivity(sm.id, "salgsmulighet");
      const verdi = (sm.forventet_mrr || 0) * (sm.kontraktslengde_mnd || 12);

      items.push({
        id: `sm-${sm.id}`,
        type: "sm_stale",
        entityId: sm.id,
        entityType: "salgsmulighet",
        navn: sm.navn,
        kontaktperson: sm.kontaktperson || null,
        selskapNavn: getSelskapNavn(sm.selskap_id),
        ePost: sm.e_post || null,
        selskapId: sm.selskap_id || null,
        kontaktId: sm.kontakt_id || null,
        sistAktivitet: sm.sist_aktivitet,
        sistAktivitetType: lastAct?.type || null,
        anbefalHandling: getSmAction(sm, lastAct),
        verdi,
        priority: verdi > 50000 ? "high" : hoursInactive > 120 ? "high" : "medium",
        hoursInactive,
        dismissed: false,
      });
    });

    // 3. Etter møte - ingen aktivitet innen 24 timer
    const meetingActs = aktiviteter.filter((a) => a.type === "Møte");
    meetingActs.forEach((meeting) => {
      const meetingDate = new Date(meeting.dato);
      if (meetingDate > now) return; // future meeting
      const hoursSince = differenceInHours(now, meetingDate);
      if (hoursSince < 24 || hoursSince > 168) return; // only 24h-7d window

      const entityId = meeting.salgsmulighet_id || meeting.lead_id;
      const entityType = meeting.salgsmulighet_id ? "salgsmulighet" : "lead";
      if (!entityId) return;

      // Check if there's activity after the meeting
      const field = entityType === "lead" ? "lead_id" : "salgsmulighet_id";
      const postMeetingActivity = aktiviteter.find(
        (a) => a[field] === entityId && new Date(a.dato) > meetingDate && a.id !== meeting.id
      );
      if (postMeetingActivity) return;

      // Check if already in items list
      if (items.find((i) => i.entityId === entityId)) return;

      const entity = entityType === "salgsmulighet"
        ? salgsmuligheter.find((s) => s.id === entityId)
        : leads.find((l) => l.id === entityId);
      if (!entity) return;
      if (entityType === "salgsmulighet" && (entity.status === "Vunnet" || entity.status === "Tapt")) return;

      items.push({
        id: `post-meeting-${meeting.id}`,
        type: "post_meeting",
        entityId,
        entityType,
        navn: entityType === "salgsmulighet" ? entity.navn : (entity.kontaktperson || entity.firmanavn),
        kontaktperson: entity.kontaktperson || null,
        selskapNavn: entityType === "salgsmulighet" ? getSelskapNavn(entity.selskap_id) : entity.firmanavn,
        ePost: entity.e_post || null,
        selskapId: entity.selskap_id || null,
        kontaktId: entityType === "salgsmulighet" ? (entity.kontakt_id || null) : null,
        sistAktivitet: meeting.dato,
        sistAktivitetType: "Møte",
        anbefalHandling: "Send oppfølging etter møte",
        verdi: entityType === "salgsmulighet" ? (entity.forventet_mrr || 0) * (entity.kontraktslengde_mnd || 12) : 0,
        priority: "high",
        hoursInactive: hoursSince,
        dismissed: false,
      });
    });

    // 4. E-post uten oppfølging – split sendt vs mottatt
    const emailActs = aktiviteter.filter((a) => a.type === "E-post");
    emailActs.forEach((email) => {
      const emailDate = new Date(email.dato);
      const hoursSince = differenceInHours(now, emailDate);
      if (hoursSince < 48 || hoursSince > 168) return;

      let entityId = email.salgsmulighet_id || email.lead_id;
      let entityType: "lead" | "salgsmulighet" = email.salgsmulighet_id ? "salgsmulighet" : "lead";
      if (!entityId) return;

      // Resolve converted leads to their salgsmulighet
      const resolved = resolveEntity(entityId, entityType);
      entityId = resolved.id;
      entityType = resolved.type;

      // Check for reply
      const field = entityType === "lead" ? "lead_id" : "salgsmulighet_id";
      const reply = aktiviteter.find(
        (a) => a[field] === entityId && new Date(a.dato) > emailDate && a.id !== email.id
      );
      if (reply) return;
      // Also check original lead_id for replies
      if (entityId !== email.lead_id && email.lead_id) {
        const replyOnLead = aktiviteter.find(
          (a) => a.lead_id === email.lead_id && new Date(a.dato) > emailDate && a.id !== email.id
        );
        if (replyOnLead) return;
      }
      if (items.find((i) => i.entityId === entityId)) return;

      const entity = entityType === "salgsmulighet"
        ? salgsmuligheter.find((s) => s.id === entityId)
        : leads.find((l) => l.id === entityId);
      if (!entity) return;
      if (entityType === "salgsmulighet" && (entity.status === "Vunnet" || entity.status === "Tapt")) return;

      const isSent = email.aktivitet_kilde === "gmail_sendt";
      const followUpType: FollowUpType = isSent ? "email_awaiting_reply" : "email_needs_reply";

      items.push({
        id: `email-${isSent ? "await" : "reply"}-${email.id}`,
        type: followUpType,
        entityId,
        entityType,
        navn: entityType === "salgsmulighet" ? entity.navn : (entity.kontaktperson || entity.firmanavn),
        kontaktperson: entity.kontaktperson || null,
        selskapNavn: entityType === "salgsmulighet" ? getSelskapNavn(entity.selskap_id) : entity.firmanavn,
        sistAktivitet: email.dato,
        sistAktivitetType: "E-post",
        anbefalHandling: isSent ? "Følg opp – venter på svar" : "Svar på e-post",
        verdi: entityType === "salgsmulighet" ? (entity.forventet_mrr || 0) * (entity.kontraktslengde_mnd || 12) : 0,
        priority: isSent ? "medium" : "high",
        hoursInactive: hoursSince,
        dismissed: false,
      });
    });

    // Sort: high value first, then longest inactive
    return items
      .filter((i) => !dismissed.has(i.id))
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority])
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        if (a.verdi !== b.verdi) return b.verdi - a.verdi;
        return b.hoursInactive - a.hoursInactive;
      });
  }, [leads, salgsmuligheter, selskaper, aktiviteter, dismissed]);

  const dismiss = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
  };

  return { followUps, loading, dismiss };
}

function getLeadAction(lead: any, lastAct: any): string {
  if (!lastAct) return "Ta første kontakt";
  if (lastAct.type === "E-post") return "Ring for å følge opp";
  if (lastAct.type === "Telefonsamtale") return "Send e-post med oppsummering";
  if (lastAct.type === "LinkedIn-melding") return "Følg opp via telefon";
  return "Send oppfølgingsmelding";
}

function getSmAction(sm: any, lastAct: any): string {
  if (sm.status === "Møte booket") return "Avklar behov med kunden";
  if (sm.status === "Behov avklart") return "Presenter løsning";
  if (sm.status === "Løsning presentert") return "Send tilbud";
  if (sm.status === "Tilbud sendt") return "Følg opp tilbud";
  if (sm.status === "Beslutning") return "Lukk avtalen";
  if (!lastAct) return "Ta kontakt";
  return "Send oppfølging";
}
