import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import CompanyLogo from "@/components/CompanyLogo";
import LeadQuickActions from "@/components/LeadQuickActions";
import { useCrmStore } from "@/hooks/use-crm-store";
import { Check, Clock } from "lucide-react";
import { relativTid, dagerSiden, idag } from "@/lib/sales-flow";
import type { Lead } from "@/data/crm-data";

type Grunn = "Ingen aktivitet på 3 dager" | "Ny lead eldre enn 2 dager" | "Ringeoppgave med frist i dag";

interface Rad {
  lead: Lead;
  grunn: Grunn;
  oppgaveId?: string;
}

export default function RingelisteIdag() {
  const navigate = useNavigate();
  const { leads, oppgaver, updateOppgaver } = useCrmStore();
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

  const haandtert = (rad: Rad) => {
    if (rad.oppgaveId) updateOppgaver(prev => prev.map(o => o.id === rad.oppgaveId ? { ...o, status: "Ferdig" } : o));
    setFerdige(f => [...f, rad.lead.id]);
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

            <LeadQuickActions
              className="mt-3"
              lead={l}
              onHandled={() => haandtert(rad)}
              onBookMoete={() => navigate(`/leads?open=${l.id}`)}
            />
          </div>
        );
      })}
    </div>
  );
}
