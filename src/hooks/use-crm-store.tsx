import { useState, useCallback, createContext, useContext, ReactNode } from "react";
import {
  Lead, Salgsmulighet, Prosjekt, Selskap, Kontakt, Oppgave,
  initialLeads, initialSalgsmuligheter, initialProsjekter,
  initialSelskaper, initialKontakter, initialOppgaver,
} from "@/data/crm-data";

function load<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch { return fallback; }
}

function save<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

function generateId(prefix: string, items: { id: string }[]) {
  const maxNum = items.reduce((max, item) => {
    const num = parseInt(item.id.split("-")[1], 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  return `${prefix}-${String(maxNum + 1).padStart(4, "0")}`;
}

type CrmStore = ReturnType<typeof useCrmStoreInternal>;

const CrmContext = createContext<CrmStore | null>(null);

function useCrmStoreInternal() {
  const [leads, setLeads] = useState<Lead[]>(() => load("crm_leads", initialLeads));
  const [salgsmuligheter, setSalgsmuligheter] = useState<Salgsmulighet[]>(() => load("crm_salgsmuligheter", initialSalgsmuligheter));
  const [prosjekter, setProsjekter] = useState<Prosjekt[]>(() => load("crm_prosjekter", initialProsjekter));
  const [selskaper, setSelskaper] = useState<Selskap[]>(() => load("crm_selskaper", initialSelskaper));
  const [kontakter, setKontakter] = useState<Kontakt[]>(() => load("crm_kontakter", initialKontakter));
  const [oppgaver, setOppgaver] = useState<Oppgave[]>(() => load("crm_oppgaver", initialOppgaver));

  const updateLeads = useCallback((fn: (prev: Lead[]) => Lead[]) => {
    setLeads(prev => { const next = fn(prev); save("crm_leads", next); return next; });
  }, []);
  const updateSalgsmuligheter = useCallback((fn: (prev: Salgsmulighet[]) => Salgsmulighet[]) => {
    setSalgsmuligheter(prev => { const next = fn(prev); save("crm_salgsmuligheter", next); return next; });
  }, []);
  const updateProsjekter = useCallback((fn: (prev: Prosjekt[]) => Prosjekt[]) => {
    setProsjekter(prev => { const next = fn(prev); save("crm_prosjekter", next); return next; });
  }, []);
  const updateSelskaper = useCallback((fn: (prev: Selskap[]) => Selskap[]) => {
    setSelskaper(prev => { const next = fn(prev); save("crm_selskaper", next); return next; });
  }, []);
  const updateKontakter = useCallback((fn: (prev: Kontakt[]) => Kontakt[]) => {
    setKontakter(prev => { const next = fn(prev); save("crm_kontakter", next); return next; });
  }, []);
  const updateOppgaver = useCallback((fn: (prev: Oppgave[]) => Oppgave[]) => {
    setOppgaver(prev => { const next = fn(prev); save("crm_oppgaver", next); return next; });
  }, []);

  // Convert lead → salgsmulighet + selskap + kontakt
  const konverterLead = useCallback((leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const today = new Date().toISOString().split("T")[0];

    // Create or find selskap
    let selskapId = selskaper.find(s => s.firmanavn.toLowerCase() === lead.firmanavn.toLowerCase())?.id;
    if (!selskapId) {
      selskapId = generateId("S", selskaper);
      const nyttSelskap: Selskap = {
        id: selskapId, firmanavn: lead.firmanavn, bransje: "", kundeansvarlig: lead.ansvarlig,
        kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet",
        mrr: 0, arr: 0, oppstartskostnad: 0, go_live_dato: "", kansellert_dato: "",
        kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra",
        sist_aktivitet: today, neste_steg: "", notater: "",
      };
      updateSelskaper(prev => [...prev, nyttSelskap]);
    }

    // Create or find kontakt
    let kontaktId = kontakter.find(k => k.e_post.toLowerCase() === lead.e_post.toLowerCase())?.id;
    if (!kontaktId && lead.kontaktperson) {
      kontaktId = generateId("K", kontakter);
      const nyKontakt: Kontakt = {
        id: kontaktId, selskap_id: selskapId, navn: lead.kontaktperson,
        e_post: lead.e_post, telefon: lead.telefon, rolle: "", linkedin: "", notater: "",
      };
      updateKontakter(prev => [...prev, nyKontakt]);
    }

    // Create salgsmulighet
    const smId = generateId("SM", salgsmuligheter);
    const nySm: Salgsmulighet = {
      id: smId, navn: lead.firmanavn, selskap_id: selskapId, kontakt_id: kontaktId || "",
      ansvarlig: lead.ansvarlig, status: "Ny mulighet", forventet_mrr: 0, sla: 0, oppstartskostnad: 0,
      kontraktslengde_mnd: 12, sannsynlighet: 50, forventet_lukkedato: "", vunnet_dato: "",
      tapt_dato: "", tapsaarsak: "", neste_steg: lead.neste_steg, notater: lead.notater,
      opprettet_dato: today, sist_aktivitet: today,
    };
    updateSalgsmuligheter(prev => [...prev, nySm]);

    // Update lead
    updateLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, status: "Konvertert til salg" as const, konvertert_dato: today, sist_aktivitet: today } : l
    ));
  }, [leads, selskaper, kontakter, salgsmuligheter, updateLeads, updateSalgsmuligheter, updateSelskaper, updateKontakter]);

  // Win deal → create prosjekt + update selskap
  const vinnSalgsmulighet = useCallback((smId: string) => {
    const sm = salgsmuligheter.find(s => s.id === smId);
    if (!sm) return;
    const today = new Date().toISOString().split("T")[0];

    updateSalgsmuligheter(prev => prev.map(s =>
      s.id === smId ? { ...s, status: "Vunnet" as const, vunnet_dato: today, sist_aktivitet: today } : s
    ));

    // Create prosjekt
    const pId = generateId("P", prosjekter);
    const nyttProsjekt: Prosjekt = {
      id: pId, prosjektnavn: sm.navn, selskap_id: sm.selskap_id, salgsmulighet_id: smId,
      ansvarlig: sm.ansvarlig, status: "Ny", startdato: today, forventet_go_live: "",
      go_live_dato: "", oppstartskostnad: sm.oppstartskostnad, oppstart_fakturert: false,
      oppstart_faktura_dato: "", oppstart_betalt: false, integrasjon: "Ingen", notater: "",
    };
    updateProsjekter(prev => [...prev, nyttProsjekt]);

    // Update selskap to Pilot
    updateSelskaper(prev => prev.map(s =>
      s.id === sm.selskap_id ? {
        ...s, kundestatus: "Pilot" as const, live_status: false,
        onboarding_status: "Ikke startet" as const,
        mrr: sm.forventet_mrr, arr: sm.forventet_mrr * 12,
        oppstartskostnad: sm.oppstartskostnad, sist_aktivitet: today,
      } : s
    ));
  }, [salgsmuligheter, prosjekter, selskaper, updateSalgsmuligheter, updateProsjekter, updateSelskaper]);

  // Lose deal
  const tapSalgsmulighet = useCallback((smId: string, tapsaarsak: Salgsmulighet["tapsaarsak"]) => {
    const today = new Date().toISOString().split("T")[0];
    updateSalgsmuligheter(prev => prev.map(s =>
      s.id === smId ? { ...s, status: "Tapt" as const, tapt_dato: today, tapsaarsak, sist_aktivitet: today } : s
    ));
  }, [updateSalgsmuligheter]);

  // Project go live
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

  // Cancel selskap
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

  return {
    leads, salgsmuligheter, prosjekter, selskaper, kontakter, oppgaver,
    updateLeads, updateSalgsmuligheter, updateProsjekter, updateSelskaper, updateKontakter, updateOppgaver,
    konverterLead, vinnSalgsmulighet, tapSalgsmulighet, settProsjektLive, kansellerSelskap,
    generateId,
  };
}

export function CrmProvider({ children }: { children: ReactNode }) {
  const store = useCrmStoreInternal();
  return <CrmContext.Provider value={store}>{children}</CrmContext.Provider>;
}

export function useCrmStore() {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrmStore must be used within CrmProvider");
  return ctx;
}
