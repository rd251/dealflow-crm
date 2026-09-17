import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import CompanyLogo from "@/components/CompanyLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { nok } from "@/lib/utils";
import { Search, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { LeadStatus, SalgsmulighetStatus } from "@/data/crm-data";

/** Én enkel salgsflyt – fra lead til vunnet kunde. */
const STEG = ["Ny", "Kontaktet", "Kvalifisert", "Møte", "Tilbud", "Kontrakt", "Vunnet", "Tapt"] as const;
type Steg = (typeof STEG)[number];

const LEAD_STEG: Steg[] = ["Ny", "Kontaktet", "Kvalifisert"];

const STEG_FARGE: Record<Steg, string> = {
  "Ny": "bg-muted text-muted-foreground",
  "Kontaktet": "bg-stage-contacted/10 text-stage-contacted",
  "Kvalifisert": "bg-stage-qualified/10 text-stage-qualified",
  "Møte": "bg-primary/10 text-primary",
  "Tilbud": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "Kontrakt": "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  "Vunnet": "bg-success/10 text-success",
  "Tapt": "bg-destructive/10 text-destructive",
};

const DEAL_TIL_STEG: Record<SalgsmulighetStatus, Steg> = {
  "Møte booket": "Møte",
  "Behov avklart": "Tilbud",
  "Løsning presentert": "Tilbud",
  "Demo gjennomført": "Tilbud",
  "Kontrakt sendt": "Kontrakt",
  "Vunnet": "Vunnet",
  "Tapt": "Tapt",
};

const STEG_TIL_DEAL: Partial<Record<Steg, SalgsmulighetStatus>> = {
  "Møte": "Møte booket",
  "Tilbud": "Behov avklart",
  "Kontrakt": "Kontrakt sendt",
};

interface Rad {
  id: string;
  kind: "lead" | "deal";
  navn: string;
  selskap: string;
  kontakt: string;
  steg: Steg;
  mrr: number;
  neste_steg: string;
  ansvarlig: string;
  sist_aktivitet: string;
}

export default function Salg() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { canEdit } = useAuth();
  const {
    leads, salgsmuligheter, selskaper,
    updateLeads, updateSalgsmuligheter,
    konverterLead, vinnSalgsmulighet, tapSalgsmulighet,
  } = useCrmStore();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"aktive" | Steg>("aktive");

  const rader = useMemo<Rad[]>(() => {
    const leadRader: Rad[] = leads
      .filter(l => !l.konvertert_dato && !l.konvertert_til && l.status !== "Konvertert til salg" && l.status !== "Konvertert til partner")
      .map(l => ({
        id: l.id,
        kind: "lead" as const,
        navn: l.firmanavn,
        selskap: l.firmanavn,
        kontakt: l.kontaktperson || "",
        steg: (l.status === "Ikke aktuelt"
          ? "Tapt"
          : l.status === "Svarte ikke telefon" || l.status === "Ikke fått tak i ennå"
            ? "Kontaktet"
            : l.status) as Steg,
        mrr: 0,
        neste_steg: l.neste_steg || "",
        ansvarlig: l.ansvarlig || "",
        sist_aktivitet: l.sist_aktivitet || l.opprettet_dato || "",
      }));

    const dealRader: Rad[] = salgsmuligheter.map(s => {
      const selskap = selskaper.find(x => x.id === s.selskap_id);
      return {
        id: s.id,
        kind: "deal" as const,
        navn: selskap?.firmanavn || s.navn,
        selskap: selskap?.firmanavn || "",
        kontakt: s.kontaktperson || "",
        steg: DEAL_TIL_STEG[s.status] || "Møte",
        mrr: s.forventet_mrr || 0,
        neste_steg: s.neste_steg || "",
        ansvarlig: s.ansvarlig || "",
        sist_aktivitet: s.sist_aktivitet || s.opprettet_dato || "",
      };
    });

    return [...leadRader, ...dealRader].sort((a, b) =>
      (b.sist_aktivitet || "").localeCompare(a.sist_aktivitet || "")
    );
  }, [leads, salgsmuligheter, selskaper]);

  const synlige = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rader.filter(r => {
      if (filter === "aktive" ? (r.steg === "Vunnet" || r.steg === "Tapt") : r.steg !== filter) return false;
      if (!q) return true;
      return [r.navn, r.kontakt, r.ansvarlig, r.neste_steg].some(v => v.toLowerCase().includes(q));
    });
  }, [rader, filter, search]);

  const aktive = rader.filter(r => r.steg !== "Vunnet" && r.steg !== "Tapt");
  const pipelineMrr = aktive.reduce((sum, r) => sum + r.mrr, 0);

  const antall = (steg: Steg) => rader.filter(r => r.steg === steg).length;

  const endreSteg = (rad: Rad, nytt: Steg) => {
    if (!canEdit) return;
    const today = new Date().toISOString().split("T")[0];

    if (rad.kind === "lead") {
      if (nytt === "Tapt" || LEAD_STEG.includes(nytt)) {
        const status: LeadStatus = nytt === "Tapt" ? "Ikke aktuelt" : (nytt as LeadStatus);
        updateLeads(prev => prev.map(l => l.id === rad.id ? { ...l, status, sist_aktivitet: today } : l));
        return;
      }
      const smId = konverterLead(rad.id);
      if (!smId) return;
      const dealStatus = STEG_TIL_DEAL[nytt];
      if (dealStatus && dealStatus !== "Møte booket") {
        updateSalgsmuligheter(prev => prev.map(s => s.id === smId ? { ...s, status: dealStatus, sist_aktivitet: today } : s));
      }
      toast.success(`${rad.navn} er nå en salgsmulighet`, {
        action: { label: "Åpne", onClick: () => navigate(`/salgsmuligheter?open=${smId}`) },
      });
      return;
    }

    if (nytt === "Vunnet") { vinnSalgsmulighet(rad.id); toast.success(`${rad.navn} er vunnet 🎉`); return; }
    if (nytt === "Tapt") { tapSalgsmulighet(rad.id, "Annet"); return; }
    const dealStatus = STEG_TIL_DEAL[nytt];
    if (dealStatus) {
      updateSalgsmuligheter(prev => prev.map(s => s.id === rad.id ? { ...s, status: dealStatus, sist_aktivitet: today } : s));
    }
  };

  const aapne = (rad: Rad) =>
    navigate(rad.kind === "lead" ? `/leads?open=${rad.id}` : `/salgsmuligheter?open=${rad.id}`);

  const stegValg = (rad: Rad): Steg[] =>
    rad.kind === "lead" ? ["Ny", "Kontaktet", "Kvalifisert", "Møte", "Tilbud", "Kontrakt", "Tapt"] : [...STEG.filter(s => !LEAD_STEG.includes(s))];

  const chips: { key: "aktive" | Steg; label: string; count: number }[] = [
    { key: "aktive", label: "Aktive", count: aktive.length },
    ...STEG.map(s => ({ key: s as Steg, label: s, count: antall(s) })),
  ];

  return (
    <PageShell
      title="Salg"
      subtitle={`${aktive.length} aktive · ${nok(pipelineMrr)} i pipeline`}
      actions={
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Søk selskap, kontakt eller eier…"
              className="pl-9 h-9"
            />
          </div>
          {canEdit && (
            <Button size="sm" className="h-9" onClick={() => navigate("/leads?ny=1")}>
              <Plus className="w-4 h-4 mr-1" /> Ny lead
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-wrap gap-1.5 mb-5">
        {chips.map(c => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === c.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {c.label} <span className="opacity-60">{c.count}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        {synlige.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Ingen treff.</div>
        ) : isMobile ? (
          <div className="divide-y">
            {synlige.map(rad => (
              <div key={rad.id} className="p-3 space-y-2" onClick={() => aapne(rad)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <CompanyLogo firmanavn={rad.navn} size="sm" />
                    <span className="font-medium truncate">{rad.navn}</span>
                  </div>
                  <Badge variant="secondary" className={`shrink-0 ${STEG_FARGE[rad.steg]}`}>{rad.steg}</Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {[rad.kontakt, rad.mrr ? `${nok(rad.mrr)}/mnd` : "", rad.neste_steg].filter(Boolean).join(" · ")}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
                <th className="px-4 py-2.5 font-medium">Selskap</th>
                <th className="px-4 py-2.5 font-medium">Kontakt</th>
                <th className="px-4 py-2.5 font-medium w-[170px]">Steg</th>
                <th className="px-4 py-2.5 font-medium text-right">MRR</th>
                <th className="px-4 py-2.5 font-medium">Neste steg</th>
                <th className="px-4 py-2.5 font-medium">Eier</th>
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {synlige.map(rad => (
                <tr key={rad.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-2.5">
                    <button className="flex items-center gap-2 min-w-0 text-left" onClick={() => aapne(rad)}>
                      <CompanyLogo firmanavn={rad.navn} size="sm" />
                      <span className="font-medium truncate">{rad.navn}</span>
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[180px]">{rad.kontakt || "—"}</td>
                  <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                    {canEdit ? (
                      <Select value={rad.steg} onValueChange={v => endreSteg(rad, v as Steg)}>
                        <SelectTrigger className={`h-7 w-[150px] border-0 text-xs font-medium ${STEG_FARGE[rad.steg]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {stegValg(rad).map(s => (
                            <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className={STEG_FARGE[rad.steg]}>{rad.steg}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{rad.mrr ? nok(rad.mrr) : "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[240px]">{rad.neste_steg || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[140px]">{rad.ansvarlig || "—"}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => aapne(rad)} className="text-muted-foreground hover:text-foreground" title="Åpne">
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageShell>
  );
}
