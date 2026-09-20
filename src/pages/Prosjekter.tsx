import { useMemo, useState } from "react";
import PageShell from "@/components/PageShell";
import StatCard from "@/components/StatCard";
import { useCrmStore } from "@/hooks/use-crm-store";
import { Button } from "@/components/ui/button";
import { Rocket, Layers, CalendarCheck, Timer, Sparkles } from "lucide-react";
import ProsjektKort from "@/components/prosjekt/ProsjektKort";
import ProsjektDrawer from "@/components/prosjekt/ProsjektDrawer";
import { PROSJEKT_STATUSER, erSammeMaaned } from "@/lib/kundeforhold";
import type { Prosjekt, ProsjektStatus } from "@/data/crm-data";

type Filter = "Alle" | ProsjektStatus;
const FILTRE: Filter[] = ["Alle", ...PROSJEKT_STATUSER];

export default function Prosjekter() {
  const { prosjekter, selskaper, updateProsjekter, settProsjektLive } = useCrmStore();
  const [filter, setFilter] = useState<Filter>("Alle");
  const [valgtId, setValgtId] = useState<string | null>(null);

  const selskap = (id: string) => selskaper.find(s => s.id === id);
  const firmanavn = (id: string) => selskap(id)?.firmanavn || "Ukjent selskap";

  const kpi = useMemo(() => {
    const aktive = prosjekter.filter(p => p.status !== "Live" && p.status !== "Blokkert").length;
    const klare = prosjekter.filter(p => p.status === "Klar for live").length;
    const liveDenneMnd = prosjekter.filter(p => p.status === "Live" && erSammeMaaned(p.go_live_dato)).length;
    const ferdige = prosjekter.filter(p => p.status === "Live" && p.go_live_dato && (p.created_at || p.startdato));
    const snitt = ferdige.length
      ? Math.round(ferdige.reduce((sum, p) => {
          const start = new Date(p.created_at || p.startdato).getTime();
          const slutt = new Date(p.go_live_dato).getTime();
          return sum + Math.max(0, (slutt - start) / 86400000);
        }, 0) / ferdige.length)
      : 0;
    return { aktive, klare, liveDenneMnd, snitt };
  }, [prosjekter]);

  const synlige = useMemo(() => {
    const rader = filter === "Alle" ? prosjekter : prosjekter.filter(p => p.status === filter);
    return [...rader].sort((a, b) =>
      (b.created_at || b.startdato || "").localeCompare(a.created_at || a.startdato || ""));
  }, [prosjekter, filter]);

  const valgt = valgtId ? prosjekter.find(p => p.id === valgtId) || null : null;

  const endre = (patch: Partial<Prosjekt>) => {
    if (!valgtId) return;
    updateProsjekter(prev => prev.map(p => p.id === valgtId ? { ...p, ...patch } : p));
  };

  return (
    <PageShell title="Prosjekter" subtitle={`${prosjekter.length} prosjekter`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Aktive prosjekter" value={String(kpi.aktive)} icon={<Layers className="w-5 h-5" />} />
        <StatCard label="Klar for go-live" value={String(kpi.klare)} icon={<CalendarCheck className="w-5 h-5" />} />
        <StatCard label="Snitt onboardingtid" value={`${kpi.snitt} dager`} icon={<Timer className="w-5 h-5" />} />
        <StatCard label="Live denne måneden" value={String(kpi.liveDenneMnd)} icon={<Sparkles className="w-5 h-5" />} />
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTRE.map(f => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="h-7 text-xs" onClick={() => setFilter(f)}>
            {f}
            <span className="ml-1.5 tabular-nums opacity-70">
              {f === "Alle" ? prosjekter.length : prosjekter.filter(p => p.status === f).length}
            </span>
          </Button>
        ))}
      </div>

      {synlige.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Rocket className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Ingen prosjekter her. Prosjekter opprettes fra kundeprofilen.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {synlige.map(p => (
            <ProsjektKort
              key={p.id}
              prosjekt={p}
              firmanavn={firmanavn(p.selskap_id)}
              domene={selskap(p.selskap_id)?.domene}
              onClick={() => setValgtId(p.id)}
            />
          ))}
        </div>
      )}

      <ProsjektDrawer
        prosjekt={valgt}
        firmanavn={valgt ? firmanavn(valgt.selskap_id) : ""}
        onClose={() => setValgtId(null)}
        onEndre={endre}
        onSettLive={() => { if (valgtId) settProsjektLive(valgtId); }}
      />
    </PageShell>
  );
}
