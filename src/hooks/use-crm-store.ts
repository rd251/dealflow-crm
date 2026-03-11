// CRM global store - backed by Supabase
import { useState, useCallback, useEffect, useRef, createContext, useContext, createElement, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Lead, Salgsmulighet, Prosjekt, Selskap, Kontakt, Oppgave, Partner,
} from "@/data/crm-data";

// Map DB row to app type (handle nulls)
function rowToLead(r: any): Lead {
  return {
    id: r.id, firmanavn: r.firmanavn, kontaktperson: r.kontaktperson || "",
    e_post: r.e_post || "", telefon: r.telefon || "", kilde: r.kilde || "Annet",
    status: r.status || "Ny", ansvarlig: r.ansvarlig || "", neste_steg: r.neste_steg || "",
    notater: r.notater || "", opprettet_dato: r.opprettet_dato || "", sist_aktivitet: r.sist_aktivitet || "",
    konvertert_dato: r.konvertert_dato || "", rolle_i_firma: r.rolle_i_firma || "", use_case: r.use_case || "",
  };
}
function rowToSelskap(r: any): Selskap {
  return {
    id: r.id, firmanavn: r.firmanavn, bransje: r.bransje || "", kundeansvarlig: r.kundeansvarlig || "",
    kundestatus: r.kundestatus || "Ikke kunde", live_status: r.live_status || false,
    onboarding_status: r.onboarding_status || "Ikke startet", mrr: Number(r.mrr) || 0,
    arr: Number(r.arr) || 0, oppstartskostnad: Number(r.oppstartskostnad) || 0,
    go_live_dato: r.go_live_dato || "", kansellert_dato: r.kansellert_dato || "",
    kanselleringsaarsak: r.kanselleringsaarsak || "", kanselleringsnotat: r.kanselleringsnotat || "",
    kundetilstand: r.kundetilstand || "Bra", sist_aktivitet: r.sist_aktivitet || "",
    neste_steg: r.neste_steg || "", notater: r.notater || "",
    kilde: r.kilde || "Direkte salg", partner_id: r.partner_id || "",
    lukkedato: r.lukkedato || "",
  };
}
function rowToKontakt(r: any): Kontakt {
  return {
    id: r.id, selskap_id: r.selskap_id || "", navn: r.navn, rolle: r.rolle || "",
    e_post: r.e_post || "", telefon: r.telefon || "", linkedin: r.linkedin || "", notater: r.notater || "",
  };
}
function rowToSalgsmulighet(r: any): Salgsmulighet {
  return {
    id: r.id, navn: r.navn, selskap_id: r.selskap_id || "", kontakt_id: r.kontakt_id || "",
    ansvarlig: r.ansvarlig || "", status: r.status || "Ny mulighet",
    forventet_mrr: Number(r.forventet_mrr) || 0, sla: Number(r.sla) || 0,
    oppstartskostnad: Number(r.oppstartskostnad) || 0, kontraktslengde_mnd: r.kontraktslengde_mnd || 12,
    sannsynlighet: r.sannsynlighet || 50, forventet_lukkedato: r.forventet_lukkedato || "",
    vunnet_dato: r.vunnet_dato || "", tapt_dato: r.tapt_dato || "", tapsaarsak: r.tapsaarsak || "",
    neste_steg: r.neste_steg || "", notater: r.notater || "", opprettet_dato: r.opprettet_dato || "",
    sist_aktivitet: r.sist_aktivitet || "", kilde: r.kilde || "Direkte salg",
    partner_id: r.partner_id || "", partner_provisjon: Number(r.partner_provisjon) || 0,
    partner_kostnad: Number(r.partner_kostnad) || 0, netto_inntekt: Number(r.netto_inntekt) || 0,
    rolle_i_firma: r.rolle_i_firma || "", use_case: r.use_case || "",
  };
}
function rowToProsjekt(r: any): Prosjekt {
  return {
    id: r.id, prosjektnavn: r.prosjektnavn, selskap_id: r.selskap_id || "",
    salgsmulighet_id: r.salgsmulighet_id || "", ansvarlig: r.ansvarlig || "",
    status: r.status || "Ny", startdato: r.startdato || "", forventet_go_live: r.forventet_go_live || "",
    go_live_dato: r.go_live_dato || "", oppstartskostnad: Number(r.oppstartskostnad) || 0,
    oppstart_fakturert: r.oppstart_fakturert || false, oppstart_faktura_dato: r.oppstart_faktura_dato || "",
    oppstart_betalt: r.oppstart_betalt || false, integrasjon: r.integrasjon || "Ingen", notater: r.notater || "",
  };
}
function rowToOppgave(r: any): Oppgave {
  return {
    id: r.id, oppgave: r.oppgave, lead_id: r.lead_id || "", selskap_id: r.selskap_id || "",
    salgsmulighet_id: r.salgsmulighet_id || "", ansvarlig: r.ansvarlig || "",
    frist: r.frist || "", prioritet: r.prioritet || "Medium", status: r.status || "Åpen",
    paaminnelse: r.paaminnelse ?? true, notater: r.notater || "",
  };
}
function rowToPartner(r: any): Partner {
  return {
    id: r.id, partnernavn: r.partnernavn, partnertype: r.partnertype || "Salgspartner",
    kontaktperson: r.kontaktperson || "", e_post: r.e_post || "", telefon: r.telefon || "",
    partnerstatus: r.partnerstatus || "Under onboarding", pipeline_status: r.pipeline_status || "Ny partner",
    ansvarlig: r.ansvarlig || "", provisjonsprosent: Number(r.provisjonsprosent) || 0,
    provisjonstype: r.provisjonstype || "", selskap_id: r.selskap_id || "",
    opprettet_dato: r.opprettet_dato || "", sist_aktivitet: r.sist_aktivitet || "", notater: r.notater || "",
  };
}

// Convert empty strings to null for DB
function emptyToNull(v: string | undefined) { return v === "" || v === undefined ? null : v; }
function numOrNull(v: number | undefined) { return v === 0 || v === undefined ? 0 : v; }

type CrmStore = ReturnType<typeof useCrmStoreInternal>;
const CrmContext = createContext<CrmStore | null>(null);

function useCrmStoreInternal() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [salgsmuligheter, setSalgsmuligheter] = useState<Salgsmulighet[]>([]);
  const [prosjekter, setProsjekter] = useState<Prosjekt[]>([]);
  const [selskaper, setSelskaper] = useState<Selskap[]>([]);
  const [kontakter, setKontakter] = useState<Kontakt[]>([]);
  const [oppgaver, setOppgaver] = useState<Oppgave[]>([]);
  const [partnere, setPartnere] = useState<Partner[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Fetch all data
  const refresh = useCallback(async () => {
    const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
      supabase.from("leads").select("*"),
      supabase.from("salgsmuligheter").select("*"),
      supabase.from("prosjekter").select("*"),
      supabase.from("selskaper").select("*"),
      supabase.from("kontakter").select("*"),
      supabase.from("oppgaver").select("*"),
      supabase.from("partnere").select("*"),
    ]);
    [r1, r2, r3, r4, r5, r6, r7].forEach((r, i) => {
      if (r.error) console.error(`Fetch error (table ${i}):`, r.error);
    });
    if (r1.data) setLeads(r1.data.map(rowToLead));
    if (r2.data) setSalgsmuligheter(r2.data.map(rowToSalgsmulighet));
    if (r3.data) setProsjekter(r3.data.map(rowToProsjekt));
    if (r4.data) setSelskaper(r4.data.map(rowToSelskap));
    if (r5.data) setKontakter(r5.data.map(rowToKontakt));
    if (r6.data) setOppgaver(r6.data.map(rowToOppgave));
    if (r7.data) setPartnere(r7.data.map(rowToPartner));
    setLoaded(true);
  }, []);

  useEffect(() => { if (user) refresh(); }, [user, refresh]);

  // Use refs to always have latest state available in sync callbacks
  const leadsRef = useRef(leads);
  leadsRef.current = leads;
  const selskaperRef = useRef(selskaper);
  selskaperRef.current = selskaper;
  const kontakterRef = useRef(kontakter);
  kontakterRef.current = kontakter;
  const salgsmuligheterRef = useRef(salgsmuligheter);
  salgsmuligheterRef.current = salgsmuligheter;
  const prosjekterRef = useRef(prosjekter);
  prosjekterRef.current = prosjekter;
  const oppgaverRef = useRef(oppgaver);
  oppgaverRef.current = oppgaver;
  const partnereRef = useRef(partnere);
  partnereRef.current = partnere;

  const updateLeads = useCallback((fn: (prev: Lead[]) => Lead[]) => {
    const prev = leadsRef.current;
    const next = fn(prev);
    setLeads(next);
    syncLeads(prev, next).catch(e => console.error("syncLeads error:", e));
  }, []);

  const updateSelskaper = useCallback((fn: (prev: Selskap[]) => Selskap[]) => {
    const prev = selskaperRef.current;
    const next = fn(prev);
    setSelskaper(next);
    syncSelskaper(prev, next).catch(e => console.error("syncSelskaper error:", e));
  }, []);

  const updateKontakter = useCallback((fn: (prev: Kontakt[]) => Kontakt[]) => {
    const prev = kontakterRef.current;
    const next = fn(prev);
    setKontakter(next);
    syncKontakter(prev, next).catch(e => console.error("syncKontakter error:", e));
  }, []);

  const updateSalgsmuligheter = useCallback((fn: (prev: Salgsmulighet[]) => Salgsmulighet[]) => {
    const prev = salgsmuligheterRef.current;
    const next = fn(prev);
    setSalgsmuligheter(next);
    syncSalgsmuligheter(prev, next).catch(e => console.error("syncSalgsmuligheter error:", e));
  }, []);

  const updateProsjekter = useCallback((fn: (prev: Prosjekt[]) => Prosjekt[]) => {
    const prev = prosjekterRef.current;
    const next = fn(prev);
    setProsjekter(next);
    syncProsjekter(prev, next).catch(e => console.error("syncProsjekter error:", e));
  }, []);

  const updateOppgaver = useCallback((fn: (prev: Oppgave[]) => Oppgave[]) => {
    const prev = oppgaverRef.current;
    const next = fn(prev);
    setOppgaver(next);
    syncOppgaver(prev, next).catch(e => console.error("syncOppgaver error:", e));
  }, []);

  const updatePartnere = useCallback((fn: (prev: Partner[]) => Partner[]) => {
    const prev = partnereRef.current;
    const next = fn(prev);
    setPartnere(next);
    syncPartnere(prev, next).catch(e => console.error("syncPartnere error:", e));
  }, []);

  // Sync helpers - detect new/updated/deleted items
  async function syncLeads(prev: Lead[], next: Lead[]) {
    const prevIds = new Set(prev.map(i => i.id));
    const nextIds = new Set(next.map(i => i.id));
    for (const item of next) {
      if (!prevIds.has(item.id)) {
        const { error } = await supabase.from("leads").insert({
          id: item.id, firmanavn: item.firmanavn, kontaktperson: emptyToNull(item.kontaktperson),
          e_post: emptyToNull(item.e_post), telefon: emptyToNull(item.telefon),
          kilde: item.kilde as any, status: item.status as any, ansvarlig: emptyToNull(item.ansvarlig),
          neste_steg: emptyToNull(item.neste_steg), notater: emptyToNull(item.notater),
          opprettet_dato: emptyToNull(item.opprettet_dato), sist_aktivitet: emptyToNull(item.sist_aktivitet),
           konvertert_dato: emptyToNull(item.konvertert_dato),
          rolle_i_firma: emptyToNull(item.rolle_i_firma), use_case: emptyToNull(item.use_case),
        });
        if (error) console.error("Insert lead error:", error);
      }
    }
    for (const item of next) {
      const old = prev.find(p => p.id === item.id);
      if (old && JSON.stringify(old) !== JSON.stringify(item)) {
        const { error } = await supabase.from("leads").update({
          firmanavn: item.firmanavn, kontaktperson: emptyToNull(item.kontaktperson),
          e_post: emptyToNull(item.e_post), telefon: emptyToNull(item.telefon),
          kilde: item.kilde as any, status: item.status as any, ansvarlig: emptyToNull(item.ansvarlig),
          neste_steg: emptyToNull(item.neste_steg), notater: emptyToNull(item.notater),
          opprettet_dato: emptyToNull(item.opprettet_dato), sist_aktivitet: emptyToNull(item.sist_aktivitet),
           konvertert_dato: emptyToNull(item.konvertert_dato),
          rolle_i_firma: emptyToNull(item.rolle_i_firma), use_case: emptyToNull(item.use_case),
        }).eq("id", item.id);
        if (error) console.error("Update lead error:", error);
      }
    }
    for (const item of prev) {
      if (!nextIds.has(item.id)) {
        const { error } = await supabase.from("leads").delete().eq("id", item.id);
        if (error) console.error("Delete lead error:", error);
      }
    }
  }

  async function syncSelskaper(prev: Selskap[], next: Selskap[]) {
    const prevIds = new Set(prev.map(i => i.id));
    const nextIds = new Set(next.map(i => i.id));
    for (const item of next) {
      if (!prevIds.has(item.id)) {
        const { error } = await supabase.from("selskaper").insert({
          id: item.id, firmanavn: item.firmanavn, bransje: emptyToNull(item.bransje),
          kundeansvarlig: emptyToNull(item.kundeansvarlig), kundestatus: item.kundestatus as any,
          live_status: item.live_status, onboarding_status: item.onboarding_status as any,
          mrr: item.mrr, arr: item.arr, oppstartskostnad: item.oppstartskostnad,
          go_live_dato: emptyToNull(item.go_live_dato), kansellert_dato: emptyToNull(item.kansellert_dato),
          kanselleringsaarsak: emptyToNull(item.kanselleringsaarsak) as any,
          kanselleringsnotat: emptyToNull(item.kanselleringsnotat),
          kundetilstand: item.kundetilstand as any, sist_aktivitet: emptyToNull(item.sist_aktivitet),
          neste_steg: emptyToNull(item.neste_steg), notater: emptyToNull(item.notater),
          kilde: item.kilde as any, partner_id: emptyToNull(item.partner_id),
          lukkedato: emptyToNull(item.lukkedato),
        });
        if (error) console.error("Insert selskap error:", error);
      }
    }
    for (const item of next) {
      const old = prev.find(p => p.id === item.id);
      if (old && JSON.stringify(old) !== JSON.stringify(item)) {
        const { error } = await supabase.from("selskaper").update({
          firmanavn: item.firmanavn, bransje: emptyToNull(item.bransje),
          kundeansvarlig: emptyToNull(item.kundeansvarlig), kundestatus: item.kundestatus as any,
          live_status: item.live_status, onboarding_status: item.onboarding_status as any,
          mrr: item.mrr, arr: item.arr, oppstartskostnad: item.oppstartskostnad,
          go_live_dato: emptyToNull(item.go_live_dato), kansellert_dato: emptyToNull(item.kansellert_dato),
          kanselleringsaarsak: emptyToNull(item.kanselleringsaarsak) as any,
          kanselleringsnotat: emptyToNull(item.kanselleringsnotat),
          kundetilstand: item.kundetilstand as any, sist_aktivitet: emptyToNull(item.sist_aktivitet),
          neste_steg: emptyToNull(item.neste_steg), notater: emptyToNull(item.notater),
          kilde: item.kilde as any, partner_id: emptyToNull(item.partner_id),
          lukkedato: emptyToNull(item.lukkedato),
        }).eq("id", item.id);
        if (error) console.error("Update selskap error:", error);
      }
    }
    for (const item of prev) {
      if (!nextIds.has(item.id)) {
        const { error } = await supabase.from("selskaper").delete().eq("id", item.id);
        if (error) console.error("Delete selskap error:", error);
      }
    }
  }

  async function syncKontakter(prev: Kontakt[], next: Kontakt[]) {
    const prevIds = new Set(prev.map(i => i.id));
    const nextIds = new Set(next.map(i => i.id));
    for (const item of next) {
      if (!prevIds.has(item.id)) {
        await supabase.from("kontakter").insert({
          id: item.id, selskap_id: emptyToNull(item.selskap_id), navn: item.navn,
          rolle: emptyToNull(item.rolle), e_post: emptyToNull(item.e_post),
          telefon: emptyToNull(item.telefon), linkedin: emptyToNull(item.linkedin),
          notater: emptyToNull(item.notater),
        });
      }
    }
    for (const item of next) {
      const old = prev.find(p => p.id === item.id);
      if (old && JSON.stringify(old) !== JSON.stringify(item)) {
        await supabase.from("kontakter").update({
          selskap_id: emptyToNull(item.selskap_id), navn: item.navn,
          rolle: emptyToNull(item.rolle), e_post: emptyToNull(item.e_post),
          telefon: emptyToNull(item.telefon), linkedin: emptyToNull(item.linkedin),
          notater: emptyToNull(item.notater),
        }).eq("id", item.id);
      }
    }
    for (const item of prev) {
      if (!nextIds.has(item.id)) {
        await supabase.from("kontakter").delete().eq("id", item.id);
      }
    }
  }

  async function syncSalgsmuligheter(prev: Salgsmulighet[], next: Salgsmulighet[]) {
    const prevIds = new Set(prev.map(i => i.id));
    const nextIds = new Set(next.map(i => i.id));
    for (const item of next) {
      if (!prevIds.has(item.id)) {
        await supabase.from("salgsmuligheter").insert({
          id: item.id, navn: item.navn, selskap_id: emptyToNull(item.selskap_id),
          kontakt_id: emptyToNull(item.kontakt_id), ansvarlig: emptyToNull(item.ansvarlig),
          status: item.status as any, forventet_mrr: item.forventet_mrr, sla: item.sla,
          oppstartskostnad: item.oppstartskostnad, kontraktslengde_mnd: item.kontraktslengde_mnd,
          sannsynlighet: item.sannsynlighet, forventet_lukkedato: emptyToNull(item.forventet_lukkedato),
          vunnet_dato: emptyToNull(item.vunnet_dato), tapt_dato: emptyToNull(item.tapt_dato),
          tapsaarsak: emptyToNull(item.tapsaarsak) as any, neste_steg: emptyToNull(item.neste_steg),
          notater: emptyToNull(item.notater), opprettet_dato: emptyToNull(item.opprettet_dato),
          sist_aktivitet: emptyToNull(item.sist_aktivitet), kilde: item.kilde as any,
          partner_id: emptyToNull(item.partner_id), partner_provisjon: item.partner_provisjon,
          partner_kostnad: item.partner_kostnad, netto_inntekt: item.netto_inntekt,
          rolle_i_firma: emptyToNull(item.rolle_i_firma), use_case: emptyToNull(item.use_case),
        });
      }
    }
    for (const item of next) {
      const old = prev.find(p => p.id === item.id);
      if (old && JSON.stringify(old) !== JSON.stringify(item)) {
        await supabase.from("salgsmuligheter").update({
          navn: item.navn, selskap_id: emptyToNull(item.selskap_id),
          kontakt_id: emptyToNull(item.kontakt_id), ansvarlig: emptyToNull(item.ansvarlig),
          status: item.status as any, forventet_mrr: item.forventet_mrr, sla: item.sla,
          oppstartskostnad: item.oppstartskostnad, kontraktslengde_mnd: item.kontraktslengde_mnd,
          sannsynlighet: item.sannsynlighet, forventet_lukkedato: emptyToNull(item.forventet_lukkedato),
          vunnet_dato: emptyToNull(item.vunnet_dato), tapt_dato: emptyToNull(item.tapt_dato),
          tapsaarsak: emptyToNull(item.tapsaarsak) as any, neste_steg: emptyToNull(item.neste_steg),
          notater: emptyToNull(item.notater), opprettet_dato: emptyToNull(item.opprettet_dato),
          sist_aktivitet: emptyToNull(item.sist_aktivitet), kilde: item.kilde as any,
          partner_id: emptyToNull(item.partner_id), partner_provisjon: item.partner_provisjon,
          partner_kostnad: item.partner_kostnad, netto_inntekt: item.netto_inntekt,
        }).eq("id", item.id);
      }
    }
    for (const item of prev) {
      if (!nextIds.has(item.id)) {
        await supabase.from("salgsmuligheter").delete().eq("id", item.id);
      }
    }
  }

  async function syncProsjekter(prev: Prosjekt[], next: Prosjekt[]) {
    const prevIds = new Set(prev.map(i => i.id));
    const nextIds = new Set(next.map(i => i.id));
    for (const item of next) {
      if (!prevIds.has(item.id)) {
        await supabase.from("prosjekter").insert({
          id: item.id, prosjektnavn: item.prosjektnavn, selskap_id: emptyToNull(item.selskap_id),
          salgsmulighet_id: emptyToNull(item.salgsmulighet_id), ansvarlig: emptyToNull(item.ansvarlig),
          status: item.status as any, startdato: emptyToNull(item.startdato),
          forventet_go_live: emptyToNull(item.forventet_go_live), go_live_dato: emptyToNull(item.go_live_dato),
          oppstartskostnad: item.oppstartskostnad, oppstart_fakturert: item.oppstart_fakturert,
          oppstart_faktura_dato: emptyToNull(item.oppstart_faktura_dato), oppstart_betalt: item.oppstart_betalt,
          integrasjon: item.integrasjon as any, notater: emptyToNull(item.notater),
        });
      }
    }
    for (const item of next) {
      const old = prev.find(p => p.id === item.id);
      if (old && JSON.stringify(old) !== JSON.stringify(item)) {
        await supabase.from("prosjekter").update({
          prosjektnavn: item.prosjektnavn, selskap_id: emptyToNull(item.selskap_id),
          salgsmulighet_id: emptyToNull(item.salgsmulighet_id), ansvarlig: emptyToNull(item.ansvarlig),
          status: item.status as any, startdato: emptyToNull(item.startdato),
          forventet_go_live: emptyToNull(item.forventet_go_live), go_live_dato: emptyToNull(item.go_live_dato),
          oppstartskostnad: item.oppstartskostnad, oppstart_fakturert: item.oppstart_fakturert,
          oppstart_faktura_dato: emptyToNull(item.oppstart_faktura_dato), oppstart_betalt: item.oppstart_betalt,
          integrasjon: item.integrasjon as any, notater: emptyToNull(item.notater),
        }).eq("id", item.id);
      }
    }
    for (const item of prev) {
      if (!nextIds.has(item.id)) {
        await supabase.from("prosjekter").delete().eq("id", item.id);
      }
    }
  }

  async function syncOppgaver(prev: Oppgave[], next: Oppgave[]) {
    const prevIds = new Set(prev.map(i => i.id));
    const nextIds = new Set(next.map(i => i.id));
    for (const item of next) {
      if (!prevIds.has(item.id)) {
        await supabase.from("oppgaver").insert({
          id: item.id, oppgave: item.oppgave, user_id: user!.id,
          lead_id: emptyToNull(item.lead_id), selskap_id: emptyToNull(item.selskap_id),
          salgsmulighet_id: emptyToNull(item.salgsmulighet_id), ansvarlig: emptyToNull(item.ansvarlig),
          frist: emptyToNull(item.frist), prioritet: item.prioritet as any,
          status: item.status as any, paaminnelse: item.paaminnelse, notater: emptyToNull(item.notater),
        });
      }
    }
    for (const item of next) {
      const old = prev.find(p => p.id === item.id);
      if (old && JSON.stringify(old) !== JSON.stringify(item)) {
        await supabase.from("oppgaver").update({
          oppgave: item.oppgave, lead_id: emptyToNull(item.lead_id),
          selskap_id: emptyToNull(item.selskap_id), salgsmulighet_id: emptyToNull(item.salgsmulighet_id),
          ansvarlig: emptyToNull(item.ansvarlig), frist: emptyToNull(item.frist),
          prioritet: item.prioritet as any, status: item.status as any,
          paaminnelse: item.paaminnelse, notater: emptyToNull(item.notater),
        }).eq("id", item.id);
      }
    }
    for (const item of prev) {
      if (!nextIds.has(item.id)) {
        await supabase.from("oppgaver").delete().eq("id", item.id);
      }
    }
  }

  async function syncPartnere(prev: Partner[], next: Partner[]) {
    const prevIds = new Set(prev.map(i => i.id));
    const nextIds = new Set(next.map(i => i.id));
    for (const item of next) {
      if (!prevIds.has(item.id)) {
        await supabase.from("partnere").insert({
          id: item.id, partnernavn: item.partnernavn, partnertype: item.partnertype as any,
          kontaktperson: emptyToNull(item.kontaktperson), e_post: emptyToNull(item.e_post),
          telefon: emptyToNull(item.telefon), partnerstatus: item.partnerstatus as any,
          pipeline_status: item.pipeline_status as any, ansvarlig: emptyToNull(item.ansvarlig),
          provisjonsprosent: item.provisjonsprosent,
          provisjonstype: emptyToNull(item.provisjonstype) as any,
          selskap_id: emptyToNull(item.selskap_id),
          opprettet_dato: emptyToNull(item.opprettet_dato), sist_aktivitet: emptyToNull(item.sist_aktivitet),
          notater: emptyToNull(item.notater),
        });
      }
    }
    for (const item of next) {
      const old = prev.find(p => p.id === item.id);
      if (old && JSON.stringify(old) !== JSON.stringify(item)) {
        await supabase.from("partnere").update({
          partnernavn: item.partnernavn, partnertype: item.partnertype as any,
          kontaktperson: emptyToNull(item.kontaktperson), e_post: emptyToNull(item.e_post),
          telefon: emptyToNull(item.telefon), partnerstatus: item.partnerstatus as any,
          pipeline_status: item.pipeline_status as any, ansvarlig: emptyToNull(item.ansvarlig),
          provisjonsprosent: item.provisjonsprosent,
          provisjonstype: emptyToNull(item.provisjonstype) as any,
          selskap_id: emptyToNull(item.selskap_id),
          opprettet_dato: emptyToNull(item.opprettet_dato), sist_aktivitet: emptyToNull(item.sist_aktivitet),
          notater: emptyToNull(item.notater),
        }).eq("id", item.id);
      }
    }
    for (const item of prev) {
      if (!nextIds.has(item.id)) {
        await supabase.from("partnere").delete().eq("id", item.id);
      }
    }
  }

  // ID generator - uses crypto UUID now
  const generateId = useCallback((_prefix: string, _items: { id: string }[]) => {
    return crypto.randomUUID();
  }, []);

  // Convert lead → salgsmulighet + selskap + kontakt
  const konverterLead = useCallback((leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const today = new Date().toISOString().split("T")[0];

    let selskapId = selskaper.find(s => s.firmanavn.toLowerCase() === lead.firmanavn.toLowerCase())?.id;
    if (!selskapId) {
      selskapId = crypto.randomUUID();
      const nyttSelskap: Selskap = {
        id: selskapId, firmanavn: lead.firmanavn, bransje: "", kundeansvarlig: lead.ansvarlig,
        kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet",
        mrr: 0, arr: 0, oppstartskostnad: 0, go_live_dato: "", kansellert_dato: "",
        kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra",
        sist_aktivitet: today, neste_steg: "", notater: "",
        kilde: "Direkte salg", partner_id: "", lukkedato: "",
      };
      updateSelskaper(prev => [...prev, nyttSelskap]);
    }

    let kontaktId = kontakter.find(k => k.e_post.toLowerCase() === lead.e_post.toLowerCase())?.id;
    if (!kontaktId && lead.kontaktperson) {
      kontaktId = crypto.randomUUID();
      const nyKontakt: Kontakt = {
        id: kontaktId, selskap_id: selskapId, navn: lead.kontaktperson,
        e_post: lead.e_post, telefon: lead.telefon, rolle: "", linkedin: "", notater: "",
      };
      updateKontakter(prev => [...prev, nyKontakt]);
    }

    const smId = crypto.randomUUID();
    const nySm: Salgsmulighet = {
      id: smId, navn: lead.firmanavn, selskap_id: selskapId, kontakt_id: kontaktId || "",
      ansvarlig: lead.ansvarlig, status: "Ny mulighet", forventet_mrr: 0, sla: 0, oppstartskostnad: 0,
      kontraktslengde_mnd: 12, sannsynlighet: 50, forventet_lukkedato: "", vunnet_dato: "",
      tapt_dato: "", tapsaarsak: "", neste_steg: lead.neste_steg, notater: lead.notater,
      opprettet_dato: today, sist_aktivitet: today,
      kilde: "Direkte salg", partner_id: "", partner_provisjon: 0, partner_kostnad: 0, netto_inntekt: 0,
      rolle_i_firma: lead.rolle_i_firma || "", use_case: lead.use_case || "",
    };
    updateSalgsmuligheter(prev => [...prev, nySm]);

    updateLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, status: "Konvertert til salg" as const, konvertert_dato: today, sist_aktivitet: today } : l
    ));
  }, [leads, selskaper, kontakter, updateLeads, updateSalgsmuligheter, updateSelskaper, updateKontakter]);

  const konverterTilPartner = useCallback((leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const today = new Date().toISOString().split("T")[0];

    // Only create partner – no selskap in kundeforhold for partner leads
    const partnerId = crypto.randomUUID();
    const nyPartner: Partner = {
      id: partnerId, partnernavn: lead.firmanavn, partnertype: "Salgspartner",
      kontaktperson: lead.kontaktperson, e_post: lead.e_post, telefon: lead.telefon,
      partnerstatus: "Under onboarding", pipeline_status: "Ny partner",
      ansvarlig: lead.ansvarlig, provisjonsprosent: 0, provisjonstype: "",
      selskap_id: "", opprettet_dato: today, sist_aktivitet: today, notater: lead.notater,
    };
    updatePartnere(prev => [...prev, nyPartner]);

    updateLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, status: "Konvertert til partner" as const, konvertert_dato: today, sist_aktivitet: today } : l
    ));
  }, [leads, updateLeads, updatePartnere]);

  const vinnSalgsmulighet = useCallback((smId: string) => {
    const sm = salgsmuligheter.find(s => s.id === smId);
    if (!sm) return;
    const today = new Date().toISOString().split("T")[0];

    updateSalgsmuligheter(prev => prev.map(s =>
      s.id === smId ? { ...s, status: "Vunnet" as const, vunnet_dato: today, sist_aktivitet: today } : s
    ));

    const pId = crypto.randomUUID();
    const nyttProsjekt: Prosjekt = {
      id: pId, prosjektnavn: sm.navn, selskap_id: sm.selskap_id, salgsmulighet_id: smId,
      ansvarlig: sm.ansvarlig, status: "Ny", startdato: today, forventet_go_live: "",
      go_live_dato: "", oppstartskostnad: sm.oppstartskostnad, oppstart_fakturert: false,
      oppstart_faktura_dato: "", oppstart_betalt: false, integrasjon: "Ingen", notater: "",
    };
    updateProsjekter(prev => [...prev, nyttProsjekt]);

    updateSelskaper(prev => prev.map(s =>
      s.id === sm.selskap_id ? {
        ...s, kundestatus: "Pilot" as const, live_status: false,
        onboarding_status: "Ikke startet" as const,
        mrr: sm.forventet_mrr, arr: sm.forventet_mrr * 12,
        oppstartskostnad: sm.oppstartskostnad, sist_aktivitet: today,
        lukkedato: today,
      } : s
    ));
  }, [salgsmuligheter, updateSalgsmuligheter, updateProsjekter, updateSelskaper]);

  const tapSalgsmulighet = useCallback((smId: string, tapsaarsak: Salgsmulighet["tapsaarsak"]) => {
    const today = new Date().toISOString().split("T")[0];
    updateSalgsmuligheter(prev => prev.map(s =>
      s.id === smId ? { ...s, status: "Tapt" as const, tapt_dato: today, tapsaarsak, sist_aktivitet: today } : s
    ));
  }, [updateSalgsmuligheter]);

  const settProsjektLive = useCallback((pId: string) => {
    const prosjekt = prosjekter.find(p => p.id === pId);
    if (!prosjekt) return;
    const today = new Date().toISOString().split("T")[0];

    updateProsjekter(prev => prev.map(p =>
      p.id === pId ? { ...p, status: "Live" as const, go_live_dato: today } : p
    ));

    updateSelskaper(prev => prev.map(s =>
      s.id === prosjekt.selskap_id ? {
        ...s, kundestatus: "Live" as const, live_status: true,
        onboarding_status: "Ferdig" as const,
        go_live_dato: s.go_live_dato || today, sist_aktivitet: today,
      } : s
    ));
  }, [prosjekter, updateProsjekter, updateSelskaper]);

  const kansellerSelskap = useCallback((selskapId: string, aarsak: Selskap["kanselleringsaarsak"], notat: string) => {
    const today = new Date().toISOString().split("T")[0];
    updateSelskaper(prev => prev.map(s =>
      s.id === selskapId ? {
        ...s, kundestatus: "Kansellert" as const, live_status: false,
        kansellert_dato: today, kanselleringsaarsak: aarsak, kanselleringsnotat: notat,
        sist_aktivitet: today,
      } : s
    ));
  }, [updateSelskaper]);

  const slettSelskap = useCallback((selskapId: string) => {
    updateSelskaper(prev => prev.filter(s => s.id !== selskapId));
  }, [updateSelskaper]);

  const angreTilSalgsmulighet = useCallback((selskapId: string) => {
    const today = new Date().toISOString().split("T")[0];
    // Find linked salgsmuligheter that were won for this selskap
    const vunnetSm = salgsmuligheter.filter(sm => sm.selskap_id === selskapId && sm.status === "Vunnet");
    // Reopen them back to "Forhandling"
    if (vunnetSm.length > 0) {
      updateSalgsmuligheter(prev => prev.map(sm =>
        sm.selskap_id === selskapId && sm.status === "Vunnet"
          ? { ...sm, status: "Forhandling" as const, vunnet_dato: "", sist_aktivitet: today }
          : sm
      ));
    }
    // Remove auto-created projects linked to these salgsmuligheter
    const smIds = new Set(vunnetSm.map(sm => sm.id));
    updateProsjekter(prev => prev.filter(p => !smIds.has(p.salgsmulighet_id)));
    // Reset selskap back to "Ikke kunde"
    updateSelskaper(prev => prev.map(s =>
      s.id === selskapId ? {
        ...s, kundestatus: "Ikke kunde" as const, live_status: false,
        onboarding_status: "Ikke startet" as const,
        mrr: 0, arr: 0, oppstartskostnad: 0, lukkedato: "",
        sist_aktivitet: today,
      } : s
    ));
  }, [salgsmuligheter, updateSalgsmuligheter, updateProsjekter, updateSelskaper]);

  const konverterSelskapTilPartner = useCallback((selskapId: string) => {
    const selskap = selskaper.find(s => s.id === selskapId);
    if (!selskap) return;
    const today = new Date().toISOString().split("T")[0];

    const partnerId = crypto.randomUUID();
    const nyPartner: Partner = {
      id: partnerId, partnernavn: selskap.firmanavn, partnertype: "Salgspartner",
      kontaktperson: "", e_post: "", telefon: "",
      partnerstatus: "Under onboarding", pipeline_status: "Ny partner",
      ansvarlig: selskap.kundeansvarlig, provisjonsprosent: 0, provisjonstype: "",
      selskap_id: "", opprettet_dato: today, sist_aktivitet: today, notater: selskap.notater,
    };
    updatePartnere(prev => [...prev, nyPartner]);
    updateSelskaper(prev => prev.filter(s => s.id !== selskapId));
  }, [selskaper, updatePartnere, updateSelskaper]);

  return {
    leads, salgsmuligheter, prosjekter, selskaper, kontakter, oppgaver, partnere,
    updateLeads, updateSalgsmuligheter, updateProsjekter, updateSelskaper, updateKontakter, updateOppgaver, updatePartnere,
    konverterLead, konverterTilPartner, vinnSalgsmulighet, tapSalgsmulighet, settProsjektLive, kansellerSelskap,
    slettSelskap, konverterSelskapTilPartner, angreTilSalgsmulighet,
    generateId, loaded, refresh,
  };
}

export function CrmProvider({ children }: { children: ReactNode }) {
  const store = useCrmStoreInternal();
  return createElement(CrmContext.Provider, { value: store }, children);
}

export function useCrmStore() {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrmStore must be used within CrmProvider");
  return ctx;
}
