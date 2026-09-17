import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import CompanyLogo from "@/components/CompanyLogo";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, CalendarDays, X, Ban, Check, Clock, PhoneMissed } from "lucide-react";
import { relativTid, dagerSiden, idag, datoOm } from "@/lib/sales-flow";
import type { Lead } from "@/data/crm-data";

type Grunn = "Ingen aktivitet på 3 dager" | "Ny lead eldre enn 2 dager" | "Ringeoppgave med frist i dag";

interface Rad {
  lead: Lead;
  grunn: Grunn;
  oppgaveId?: string;
}

export default function RingelisteIdag() {
  const navigate = useNavigate();
  const { leads, oppgaver, updateLeads, updateOppgaver } = useCrmStore();
  const { canEdit, user } = useAuth();
  const [notatFor, setNotatFor] = useState<string | null>(null);
  const [notat, setNotat] = useState("");
  const [ferdige, setFerdige] = useState<string[]>([]);

  const rader = useMemo<Rad[]>(() => {
    const aktive = leads.filter(
      l => !l.konvertert_dato && !l.konvertert_til && l.status !== "Ikke aktuelt" &&
        l.status !== "Konvertert til salg" && l.status !== "Konvertert til partner"
    );

    const ut = new Map<string, Rad>();

    // 1) Ringeoppgaver med frist i dag
    for (const o of oppgaver) {
      if (o.status === "Ferdig") continue;
      if (o.frist !== idag()) continue;
      if (!/ring/i.test(o.oppgave)) continue;
      const lead = aktive.find(l => l.id === o.lead_id);
      if (lead && !ut.has(lead.id)) ut.set(lead.id, { lead, grunn: "Ringeoppgave med frist i dag", oppgaveId: o.id });
    }

    // 2) Nye leads eldre enn 2 dager
    for (const l of aktive) {
      if (l.status !== "Ny") continue;
      const d = dagerSiden(l.opprettet_dato);
      if (d !== null && d > 2 && !ut.has(l.id)) ut.set(l.id, { lead: l, grunn: "Ny lead eldre enn 2 dager" });
    }

    // 3) Ingen aktivitet siste 3 dager
    for (const l of aktive) {
      const d = dagerSiden(l.sist_aktivitet || l.opprettet_dato);
      if (d !== null && d >= 3 && !ut.has(l.id)) ut.set(l.id, { lead: l, grunn: "Ingen aktivitet på 3 dager" });
    }

    return Array.from(ut.values())
      .filter(r => !ferdige.includes(r.lead.id))
      .sort((a, b) => (dagerSiden(b.lead.sist_aktivitet) ?? 999) - (dagerSiden(a.lead.sist_aktivitet) ?? 999));
  }, [leads, oppgaver, ferdige]);

  const loggAktivitet = async (lead: Lead, tittel: string, beskrivelse: string) => {
    try {
      await supabase.from("aktiviteter").insert({
        type: "Telefonsamtale",
        tittel,
        beskrivelse,
        dato: new Date().toISOString(),
        lead_id: lead.id,
        aktivitet_kilde: "manuell",
      });
    } catch (err) {
      console.warn("Kunne ikke logge aktivitet", err);
    }
    updateLeads(prev => prev.map(l => l.id === lead.id ? { ...l, sist_aktivitet: idag() } : l));
  };

  const fullfoerOppgave = (oppgaveId?: string) => {
    if (!oppgaveId) return;
    updateOppgaver(prev => prev.map(o => o.id === oppgaveId ? { ...o, status: "Ferdig" } : o));
  };

  const ringt = async (rad: Rad) => {
    await loggAktivitet(rad.lead, `Ringt ${rad.lead.kontaktperson || rad.lead.firmanavn}`, "Samtale gjennomført");
    updateLeads(prev => prev.map(l => l.id === rad.lead.id ? { ...l, status: l.status === "Ny" ? "Kontaktet" : l.status, sist_aktivitet: idag() } : l));
    fullfoerOppgave(rad.oppgaveId);
    setNotatFor(rad.lead.id);
    setNotat("");
    toast.success("Samtale logget");
  };

  const ikkeSvar = async (rad: Rad) => {
    await loggAktivitet(rad.lead, `Forsøkte å ringe ${rad.lead.kontaktperson || rad.lead.firmanavn}`, "Ikke svar");
    updateLeads(prev => prev.map(l => l.id === rad.lead.id ? { ...l, status: "Svarte ikke telefon", sist_aktivitet: idag() } : l));
    updateOppgaver(prev => [...prev, {
      id: crypto.randomUUID(),
      oppgave: `Ring ${rad.lead.kontaktperson || rad.lead.firmanavn} igjen`,
      lead_id: rad.lead.id,
      selskap_id: "",
      salgsmulighet_id: "",
      kontakt_id: "",
      ansvarlig: rad.lead.ansvarlig || user?.id || "",
      frist: datoOm(2),
      prioritet: "Medium",
      status: "Åpen",
      paaminnelse: true,
      notater: "",
    }]);
    fullfoerOppgave(rad.oppgaveId);
    setFerdige(f => [...f, rad.lead.id]);
    toast("Ikke svar – ny ringeoppgave om 2 dager");
  };

  const ikkeFaattTak = async (rad: Rad) => {
    await loggAktivitet(rad.lead, `Ikke fått tak i ${rad.lead.kontaktperson || rad.lead.firmanavn}`, "Ikke fått tak i ennå");
    updateLeads(prev => prev.map(l => l.id === rad.lead.id ? { ...l, status: "Ikke fått tak i ennå", sist_aktivitet: idag() } : l));
    updateOppgaver(prev => [...prev, {
      id: crypto.randomUUID(),
      oppgave: `Prøv ${rad.lead.kontaktperson || rad.lead.firmanavn} igjen`,
      lead_id: rad.lead.id,
      selskap_id: "",
      salgsmulighet_id: "",
      kontakt_id: "",
      ansvarlig: rad.lead.ansvarlig || user?.id || "",
      frist: datoOm(2),
      prioritet: "Medium",
      status: "Åpen",
      paaminnelse: true,
      notater: "",
    }]);
    fullfoerOppgave(rad.oppgaveId);
    setFerdige(f => [...f, rad.lead.id]);
    toast("Markert som ikke fått tak i – ny oppgave om 2 dager");
  };

  const ikkeAktuelt = async (rad: Rad) => {
    await loggAktivitet(rad.lead, `Ringt ${rad.lead.kontaktperson || rad.lead.firmanavn}`, "Ikke aktuelt");
    updateLeads(prev => prev.map(l => l.id === rad.lead.id ? { ...l, status: "Ikke aktuelt", sist_aktivitet: idag() } : l));
    fullfoerOppgave(rad.oppgaveId);
    setFerdige(f => [...f, rad.lead.id]);
    toast("Markert som ikke aktuelt");
  };

  const lagreNotat = async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    if (notat.trim()) {
      await loggAktivitet(lead, "Samtalenotat", notat.trim());
      updateLeads(prev => prev.map(l => l.id === leadId ? { ...l, neste_steg: l.neste_steg || notat.trim().slice(0, 120) } : l));
    }
    setNotatFor(null);
    setNotat("");
    setFerdige(f => [...f, leadId]);
  };

  if (rader.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center">
        <Check className="w-6 h-6 mx-auto mb-2 text-success" />
        <p className="text-sm font-medium">Ingen flere å ringe i dag</p>
        <p className="text-xs text-muted-foreground mt-1">Alle leads er fulgt opp.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{rader.length} å ringe i dag</p>
      {rader.map(rad => {
        const l = rad.lead;
        return (
          <div key={l.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <CompanyLogo firmanavn={l.firmanavn} kontaktEmails={l.e_post ? [l.e_post] : undefined} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <button className="font-semibold text-sm hover:underline" onClick={() => navigate(`/leads?open=${l.id}`)}>
                    {l.kontaktperson || l.firmanavn}
                  </button>
                  <span className="text-xs text-muted-foreground truncate">{l.firmanavn}</span>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Clock className="w-2.5 h-2.5" />{rad.grunn}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  {l.telefon ? <a href={`tel:${l.telefon}`} className="hover:text-foreground">{l.telefon}</a> : <span>Mangler telefonnummer</span>}
                  <span>Sist kontakt: {relativTid(l.sist_aktivitet)}</span>
                  {l.neste_steg && <span className="truncate">→ {l.neste_steg}</span>}
                </div>
              </div>
            </div>

            {canEdit && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => ringt(rad)}>
                  <Phone className="w-3.5 h-3.5 mr-1.5" />Ringt ✓
                </Button>
                <Button size="sm" variant="outline" onClick={() => ikkeSvar(rad)}>
                  <X className="w-3.5 h-3.5 mr-1.5" />Ikke svar
                </Button>
                <Button size="sm" variant="outline" onClick={() => ikkeFaattTak(rad)}>
                  <PhoneMissed className="w-3.5 h-3.5 mr-1.5" />Ikke fått tak i ennå
                </Button>
                <Button size="sm" variant="outline" onClick={() => ikkeAktuelt(rad)}>
                  <Ban className="w-3.5 h-3.5 mr-1.5" />Ikke aktuelt
                </Button>
                <Button size="sm" variant="secondary" onClick={() => navigate(`/leads?open=${l.id}`)}>
                  <CalendarDays className="w-3.5 h-3.5 mr-1.5" />Book møte
                </Button>
              </div>
            )}

            {notatFor === l.id && (
              <div className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium">Hva kom ut av samtalen?</p>
                <Textarea value={notat} onChange={e => setNotat(e.target.value)} rows={3} placeholder="Notat fra samtalen…" />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => lagreNotat(l.id)}>Lagre notat</Button>
                  <Button size="sm" variant="secondary" onClick={() => { lagreNotat(l.id); navigate(`/leads?open=${l.id}`); }}>
                    <CalendarDays className="w-3.5 h-3.5 mr-1.5" />Book møte nå
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setNotatFor(null); setNotat(""); setFerdige(f => [...f, l.id]); }}>Hopp over</Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
