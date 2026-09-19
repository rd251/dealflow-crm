import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Building2, Handshake } from "lucide-react";
import PageShell from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import LogActivityButton from "@/components/LogActivityButton";
import { useCrmStore } from "@/hooks/use-crm-store";
import { cn } from "@/lib/utils";
import {
  RELASJON_KALD_DAGER,
  RELASJON_LUNKEN_DAGER,
  relasjonEtikett,
  relasjonFarge,
  relasjonTilstand,
  sorterEtterEldstKontakt,
  type RelasjonTilstand,
} from "@/lib/relationship";

type Filter = "alle" | "lunken" | "forsomt";

interface Rad {
  id: string;
  navn: string;
  undertekst: string;
  mennesketype: "Kunde" | "Partner";
  sist: string;
  tilstand: RelasjonTilstand;
  lenke: string;
  target: { selskap_id?: string; partner_id?: string };
}

export default function Relasjoner() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selskaper, partnere, refresh } = useCrmStore();

  const filter = (searchParams.get("filter") as Filter) || "alle";

  const rader = useMemo<Rad[]>(() => {
    const kunder: Rad[] = selskaper
      .filter(s => s.kundestatus === "Live" || s.kundestatus === "Pilot")
      .map(s => ({
        id: s.id,
        navn: s.firmanavn,
        undertekst: s.kundeansvarlig ? `Kundeansvarlig: ${s.kundeansvarlig}` : s.bransje || "Kunde",
        mennesketype: "Kunde" as const,
        sist: s.sist_aktivitet,
        tilstand: relasjonTilstand(s.sist_aktivitet),
        lenke: `/selskaper/${s.id}`,
        target: { selskap_id: s.id },
      }));
    const parts: Rad[] = partnere
      .filter(p => p.partnerstatus === "Aktiv" || p.partnerstatus === "Under onboarding")
      .map(p => ({
        id: p.id,
        navn: p.partnernavn,
        undertekst: p.kontaktperson ? `${p.partnertype} · ${p.kontaktperson}` : p.partnertype,
        mennesketype: "Partner" as const,
        sist: p.sist_aktivitet,
        tilstand: relasjonTilstand(p.sist_aktivitet),
        lenke: `/partnere/${p.id}`,
        target: { partner_id: p.id },
      }));
    return [...kunder, ...parts].sort((a, b) => sorterEtterEldstKontakt(a.sist, b.sist));
  }, [selskaper, partnere]);

  const antallLunken = rader.filter(r => r.tilstand === "lunken").length;
  const antallForsomt = rader.filter(r => r.tilstand === "forsomt" || r.tilstand === "ukjent").length;

  const synlige = rader.filter(r =>
    filter === "alle" ? true :
    filter === "lunken" ? r.tilstand === "lunken" :
    r.tilstand === "forsomt" || r.tilstand === "ukjent"
  );

  const settFilter = (f: Filter) => {
    if (f === "alle") setSearchParams({});
    else setSearchParams({ filter: f });
  };

  const knapper: { verdi: Filter; etikett: string; antall: number }[] = [
    { verdi: "alle", etikett: "Alle", antall: rader.length },
    { verdi: "lunken", etikett: `Ikke snakket på en stund (${RELASJON_LUNKEN_DAGER}+ dager)`, antall: antallLunken },
    { verdi: "forsomt", etikett: `Forsømte (${RELASJON_KALD_DAGER}+ dager)`, antall: antallForsomt },
  ];

  return (
    <PageShell
      title="Relasjoner som trenger kontakt"
      subtitle={`${rader.length} aktive kunder og partnere · lengst uten kontakt øverst`}
      actions={
        <div className="flex flex-wrap gap-2">
          {knapper.map(k => (
            <Button
              key={k.verdi}
              size="sm"
              variant={filter === k.verdi ? "default" : "outline"}
              onClick={() => settFilter(k.verdi)}
              className="gap-1.5"
            >
              {k.etikett}
              <span className="tabular-nums text-xs opacity-75">{k.antall}</span>
            </Button>
          ))}
        </div>
      }
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="overflow-hidden rounded-lg border bg-card shadow-card">
          {synlige.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">Ingen relasjoner i denne visningen. Godt jobbet.</p>
          ) : (
            <ul className="divide-y">
              {synlige.map(rad => (
                <li key={`${rad.mennesketype}-${rad.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40">
                  <span className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                    rad.mennesketype === "Kunde" ? "bg-success/10 text-success" : "bg-partner/10 text-partner"
                  )}>
                    {rad.mennesketype === "Kunde" ? <Building2 className="h-4 w-4" /> : <Handshake className="h-4 w-4" />}
                  </span>
                  <button type="button" onClick={() => navigate(rad.lenke)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium">{rad.navn}</span>
                    <span className="block truncate text-xs text-muted-foreground">{rad.undertekst}</span>
                  </button>
                  <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">{rad.mennesketype}</Badge>
                  <Badge variant="outline" className={cn("tabular-nums text-[11px]", relasjonFarge[rad.tilstand])}>
                    {relasjonEtikett(rad.sist)}
                  </Badge>
                  <LogActivityButton
                    target={rad.target}
                    entityName={rad.navn}
                    variant="outline"
                    label="Logg aktivitet"
                    onLogged={() => refresh(true)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageShell>
  );
}
