import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CompanyLogo from "@/components/CompanyLogo";
import LeadQuickActions from "@/components/LeadQuickActions";
import { Check, ChevronDown } from "lucide-react";
import { relativTid } from "@/lib/sales-flow";
import {
  effektivOppfolging,
  erKaldtLead,
  oppfolgingEtikett,
  oppfolgingFarge,
  oppfolgingTilstand,
  dagerTilOppfolging,
} from "@/lib/follow-up-rules";
import type { Lead } from "@/data/crm-data";

/** Antall leads som vises før «vis alle». */
const SYNLIGE = 8;

interface Props {
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
}

/** Dagens startpunkt: leads med oppfølging i dag eller forfalt, forfalte først. */
export default function FolgOppIDag({ leads, onOpenLead }: Props) {
  const [visAlle, setVisAlle] = useState(false);

  const rader = useMemo(() => {
    return leads
      .filter(l => !erKaldtLead(l))
      .map(l => ({ lead: l, dato: effektivOppfolging(l) }))
      .filter(r => (dagerTilOppfolging(r.dato) ?? 0) <= 0)
      .sort((a, b) => (dagerTilOppfolging(a.dato) ?? 0) - (dagerTilOppfolging(b.dato) ?? 0));
  }, [leads]);

  if (rader.length === 0) {
    return (
      <div className="mb-5 rounded-xl border bg-card p-6 text-center">
        <Check className="mx-auto mb-2 h-5 w-5 text-success" />
        <p className="text-sm font-medium">Ingen oppfølginger forfaller i dag</p>
        <p className="mt-1 text-xs text-muted-foreground">Alle leads har en dato fram i tid.</p>
      </div>
    );
  }

  const synlige = visAlle ? rader : rader.slice(0, SYNLIGE);

  return (
    <div className="mb-5 space-y-2 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Følg opp i dag</h2>
        <span className="text-xs tabular-nums text-muted-foreground">{rader.length} leads</span>
      </div>

      <div className="space-y-2">
        {synlige.map(({ lead, dato }) => {
          const tilstand = oppfolgingTilstand(dato);
          return (
            <div key={lead.id} className="rounded-lg border bg-background p-3">
              <div className="flex items-start gap-3">
                <CompanyLogo firmanavn={lead.firmanavn} kontaktEmails={lead.e_post ? [lead.e_post] : undefined} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="text-sm font-semibold hover:underline" onClick={() => onOpenLead(lead)}>
                      {lead.kontaktperson || lead.firmanavn}
                    </button>
                    <span className="truncate text-xs text-muted-foreground">{lead.firmanavn}</span>
                    <Badge variant="outline" className={`text-[10px] ${oppfolgingFarge[tilstand]}`}>
                      {oppfolgingEtikett(dato)}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    {lead.telefon ? (
                      <a href={`tel:${lead.telefon}`} className="hover:text-foreground">{lead.telefon}</a>
                    ) : (
                      <span>Mangler telefonnummer</span>
                    )}
                    <span>Sist kontakt: {relativTid(lead.sist_aktivitet)}</span>
                    {lead.neste_steg && <span className="truncate">→ {lead.neste_steg}</span>}
                  </div>
                </div>
              </div>
              <LeadQuickActions className="mt-3" lead={lead} onBookMoete={() => onOpenLead(lead)} />
            </div>
          );
        })}
      </div>

      {rader.length > SYNLIGE && (
        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setVisAlle(v => !v)}>
          <ChevronDown className={`mr-1 h-3.5 w-3.5 transition-transform ${visAlle ? "rotate-180" : ""}`} />
          {visAlle ? "Vis færre" : `Vis alle ${rader.length}`}
        </Button>
      )}
    </div>
  );
}
