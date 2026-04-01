import { useState } from "react";
import { format } from "date-fns";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import DetailPanelShell, { DetailSection, DetailField, DetailDivider, DetailStatGrid, DetailStatCard } from "@/components/DetailPanelShell";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Plus, Search, Building2, ChevronRight, CalendarIcon, X, Upload, Trash2, ArrowRightLeft, Undo2, DollarSign, TrendingUp, Target, PieChart, Users, BarChart3, ArrowDownRight, ArrowUpRight, Trophy, XCircle, UserMinus, AlertTriangle } from "lucide-react";
import CompanyLogo from "@/components/CompanyLogo";
import { beregnTotalKontraktsverdi } from "@/data/crm-data";
import { useNavigate } from "react-router-dom";
import InlineTaskForm from "@/components/InlineTaskForm";
import { Selskap, Kundestatus, OnboardingStatus, Kundetilstand, Kanselleringsaarsak } from "@/data/crm-data";
import { Badge } from "@/components/ui/badge";
import DataImportDialog from "@/components/DataImportDialog";
import LastActivityBadge from "@/components/LastActivityBadge";

const kundestatuser: Kundestatus[] = ["Ikke kunde", "Pilot", "Live", "Pause", "Kansellert"];
const onboardingStatuser: OnboardingStatus[] = ["Ikke startet", "Pågår", "Venter på kunde", "Klar for live", "Ferdig"];
const kundetilstander: Kundetilstand[] = ["Bra", "Usikker", "Risiko"];
const kanselleringsaarsaker: Kanselleringsaarsak[] = ["Pris", "Lav bruk", "Teknisk utfordring", "Manglende verdi", "Byttet leverandør", "Midlertidig stopp", "Annet"];

const kundestatusColors: Record<Kundestatus, string> = {
  "Ikke kunde": "bg-muted text-muted-foreground",
  "Pilot": "bg-stage-contacted/10 text-stage-contacted",
  "Live": "bg-success/10 text-success",
  "Pause": "bg-warning/10 text-warning",
  "Kansellert": "bg-destructive/10 text-destructive",
};

const tilstandColors: Record<Kundetilstand, string> = {
  "Bra": "bg-success/10 text-success",
  "Usikker": "bg-warning/10 text-warning",
  "Risiko": "bg-destructive/10 text-destructive",
};

export default function Companies() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { canEdit } = useAuth();
  const { selskaper, salgsmuligheter, prosjekter, updateSelskaper, kansellerSelskap, slettSelskap, konverterSelskapTilPartner, angreTilSalgsmulighet, generateId } = useCrmStore();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Selskap | null>(null);
  const [cancelDialog, setCancelDialog] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [transferDialog, setTransferDialog] = useState<string | null>(null);
  const [revertDialog, setRevertDialog] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<Kanselleringsaarsak>("Pris");
  const [cancelNote, setCancelNote] = useState("");
  const [form, setForm] = useState({ firmanavn: "", bransje: "", kundeansvarlig: "" });
  const [lukkedatoFra, setLukkedatoFra] = useState<Date | undefined>(undefined);
  const [lukkedatoTil, setLukkedatoTil] = useState<Date | undefined>(undefined);

  // Only show companies that have an active agreement (not "Ikke kunde")
  const filtered = selskaper.filter(s => {
    if (!s.firmanavn.toLowerCase().includes(search.toLowerCase())) return false;
    // Kundeforhold only shows companies with a customer relationship
    if (s.kundestatus === "Ikke kunde") return false;
    if (lukkedatoFra || lukkedatoTil) {
      if (!s.lukkedato) return false;
      const ld = new Date(s.lukkedato);
      if (lukkedatoFra && ld < lukkedatoFra) return false;
      if (lukkedatoTil && ld > lukkedatoTil) return false;
    }
    return true;
  });

  const addSelskap = () => {
    const id = generateId("S", selskaper);
    const nyttSelskap: Selskap = {
      id, firmanavn: form.firmanavn, bransje: form.bransje, kundeansvarlig: form.kundeansvarlig,

      kundestatus: "Pilot", live_status: false, onboarding_status: "Ikke startet",
      mrr: 0, arr: 0, oppstartskostnad: 0, go_live_dato: "", kansellert_dato: "",
      kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra",
      sist_aktivitet: new Date().toISOString().split("T")[0], neste_steg: "", notater: "",
      kilde: "Direkte salg", partner_id: "", lukkedato: "",
    };
    updateSelskaper(prev => [...prev, nyttSelskap]);
    setDialogOpen(false);
    setForm({ firmanavn: "", bransje: "", kundeansvarlig: "" });
  };

  const changeKundestatus = (id: string, status: Kundestatus) => {
    if (status === "Kansellert") {
      setCancelDialog(id);
      return;
    }
    updateSelskaper(prev => prev.map(s => s.id === id ? {
      ...s, kundestatus: status, live_status: status === "Live",
      sist_aktivitet: new Date().toISOString().split("T")[0],
    } : s));
  };

  const toggleLive = (id: string, live: boolean) => {
    updateSelskaper(prev => prev.map(s => s.id === id ? {
      ...s,
      live_status: live,
      kundestatus: live ? "Live" : (s.kundestatus === "Live" ? "Pause" : s.kundestatus),
      sist_aktivitet: new Date().toISOString().split("T")[0],
    } : s));
  };

  const currentSelskap = selected ? selskaper.find(s => s.id === selected.id) || selected : null;

  return (
    <PageShell
      title="Kundeforhold"
      subtitle={`${filtered.length} selskaper · ${selskaper.filter(s => s.kundestatus === "Live").length} live`}
      actions={canEdit ? (
        <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-1" />{!isMobile && "Importer"}</Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />{!isMobile && "Nytt selskap"}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader><DialogTitle>Nytt selskap</DialogTitle><DialogDescription>Fyll inn detaljer for det nye selskapet.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Firmanavn" value={form.firmanavn} onChange={e => setForm(f => ({ ...f, firmanavn: e.target.value }))} />
              <Input placeholder="Bransje" value={form.bransje} onChange={e => setForm(f => ({ ...f, bransje: e.target.value }))} />
              <Input placeholder="Kundeansvarlig" value={form.kundeansvarlig} onChange={e => setForm(f => ({ ...f, kundeansvarlig: e.target.value }))} />
              <Button onClick={addSelskap} className="w-full" disabled={!form.firmanavn}>Opprett selskap</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      ) : undefined}
    >
      <DataImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        target="selskaper"
        onImport={async (rows) => {
          let success = 0, errors = 0;
          const today = new Date().toISOString().split("T")[0];
          const newItems: Selskap[] = [];
          for (const row of rows) {
            try {
              newItems.push({
                id: crypto.randomUUID(),
                firmanavn: String(row.firmanavn || ""),
                bransje: String(row.bransje || ""),
                kundeansvarlig: String(row.kundeansvarlig || ""),
                kundestatus: "Pilot",
                live_status: false,
                onboarding_status: "Ikke startet",
                mrr: Number(row.mrr) || 0,
                arr: Number(row.arr) || 0,
                oppstartskostnad: 0,
                go_live_dato: "",
                kansellert_dato: "",
                kanselleringsaarsak: "",
                kanselleringsnotat: "",
                kundetilstand: "Bra",
                sist_aktivitet: today,
                neste_steg: "",
                notater: String(row.notater || ""),
                kilde: "Direkte salg",
                partner_id: "",
                lukkedato: "",
              });
              success++;
            } catch { errors++; }
          }
          if (newItems.length > 0) {
            updateSelskaper(prev => [...prev, ...newItems]);
          }
          return { success, errors };
        }}
      />
      {/* Cancel dialog */}
      <Dialog open={!!cancelDialog} onOpenChange={open => !open && setCancelDialog(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader><DialogTitle>Kanseller kunde</DialogTitle><DialogDescription>Velg årsak og legg til notat.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={cancelReason} onChange={e => setCancelReason(e.target.value as Kanselleringsaarsak)}>
              {kanselleringsaarsaker.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <Textarea placeholder="Kanselleringsnotat (valgfritt)" value={cancelNote} onChange={e => setCancelNote(e.target.value)} />
            <Button variant="destructive" className="w-full" onClick={() => {
              if (cancelDialog) { kansellerSelskap(cancelDialog, cancelReason, cancelNote); setCancelDialog(null); setCancelNote(""); }
            }}>Bekreft kansellering</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={open => !open && setDeleteDialog(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle>Slett selskap</DialogTitle><DialogDescription>Er du sikker på at du vil slette dette selskapet? Handlingen kan ikke angres.</DialogDescription></DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Avbryt</Button>
            <Button variant="destructive" onClick={() => {
              if (deleteDialog) { slettSelskap(deleteDialog); setDeleteDialog(null); }
            }}>Slett</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer to partner dialog */}
      <Dialog open={!!transferDialog} onOpenChange={open => !open && setTransferDialog(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle>Overfør til partner</DialogTitle><DialogDescription>Selskapet flyttes til partnersiden og fjernes fra kundeforhold.</DialogDescription></DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setTransferDialog(null)}>Avbryt</Button>
            <Button onClick={() => {
              if (transferDialog) { konverterSelskapTilPartner(transferDialog); setTransferDialog(null); }
            }}>Overfør</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revert to salgsmulighet dialog */}
      <Dialog open={!!revertDialog} onOpenChange={open => !open && setRevertDialog(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle>Angre til salgsmulighet</DialogTitle><DialogDescription>Selskapet settes tilbake til «Ikke kunde», tilknyttede vunnede salgsmuligheter gjenåpnes, og auto-opprettede prosjekter fjernes.</DialogDescription></DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setRevertDialog(null)}>Avbryt</Button>
            <Button variant="default" onClick={() => {
              if (revertDialog) { angreTilSalgsmulighet(revertDialog); setRevertDialog(null); }
            }}>Angre</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── KPI ─── */}
      {(() => {
        const nok = (n: number) => n.toLocaleString("nb-NO", { maximumFractionDigits: 0 }) + " NOK";
        const liveSelskaper = selskaper.filter(s => s.kundestatus === "Live");
        const aktiveKunder = liveSelskaper.length;
        const totalMRR = liveSelskaper.reduce((sum, s) => sum + s.mrr, 0);
        const totalARR = totalMRR * 12;

        // Netto MRR: new MRR this month minus lost MRR this month
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nyMRR = selskaper
          .filter(s => s.kundestatus === "Live" && s.lukkedato && new Date(s.lukkedato) >= monthStart)
          .reduce((sum, s) => sum + s.mrr, 0);
        const taptMRR = selskaper
          .filter(s => s.kundestatus === "Kansellert" && s.kansellert_dato && new Date(s.kansellert_dato) >= monthStart)
          .reduce((sum, s) => sum + s.mrr, 0);
        const nettoMRR = nyMRR - taptMRR;

        // Ikke-live MRR/ARR (Pilot, Pause etc.)
        const ikkeLiveSelskaper = selskaper.filter(s => s.kundestatus !== "Live" && s.kundestatus !== "Kansellert" && s.kundestatus !== "Ikke kunde");
        const ikkeLiveMRR = ikkeLiveSelskaper.reduce((sum, s) => sum + s.mrr, 0);
        const ikkeLiveARR = ikkeLiveMRR * 12;

        const openSm = salgsmuligheter.filter(s => s.status !== "Vunnet" && s.status !== "Tapt");
        const pipelineVerdi = openSm.reduce((sum, s) => sum + beregnTotalKontraktsverdi(s), 0);
        const allClosed = salgsmuligheter.filter(s => s.status === "Vunnet" || s.status === "Tapt");
        const wonCount = salgsmuligheter.filter(s => s.status === "Vunnet").length;
        const winRate = allClosed.length > 0 ? Math.round((wonCount / allClosed.length) * 100) : 0;
        const kansellertCount = selskaper.filter(s => s.kundestatus === "Kansellert").length;
        const totalKunder = selskaper.filter(s => ["Live", "Kansellert"].includes(s.kundestatus)).length;
        const churnRate = totalKunder > 0 ? Math.round((kansellertCount / totalKunder) * 100) : 0;

        // Denne måneden
        const vunnetDenneMnd = salgsmuligheter.filter(s => s.status === "Vunnet" && s.vunnet_dato && new Date(s.vunnet_dato) >= monthStart).length;
        const taptDenneMnd = salgsmuligheter.filter(s => s.status === "Tapt" && s.tapt_dato && new Date(s.tapt_dato) >= monthStart).length;
        const kansellertDenneMnd = selskaper.filter(s => s.kundestatus === "Kansellert" && s.kansellert_dato && new Date(s.kansellert_dato) >= monthStart).length;

        const kpis = [
          { label: "MRR", value: nok(totalMRR), icon: <DollarSign className="w-4 h-4" /> },
          { label: "ARR", value: nok(totalARR), icon: <BarChart3 className="w-4 h-4" /> },
          { label: "Netto MRR", value: `${nettoMRR >= 0 ? "" : "−"}${nok(Math.abs(nettoMRR))}`, icon: nettoMRR >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" /> },
          { label: "Aktive kunder", value: `${aktiveKunder}`, icon: <Users className="w-4 h-4" /> },
          { label: "Ikke-live MRR", value: nok(ikkeLiveMRR), icon: <DollarSign className="w-4 h-4" /> },
          { label: "Ikke-live ARR", value: nok(ikkeLiveARR), icon: <BarChart3 className="w-4 h-4" /> },
          { label: "Pipeline", value: nok(pipelineVerdi), icon: <TrendingUp className="w-4 h-4" /> },
          { label: "Win rate", value: `${winRate}%`, icon: <Target className="w-4 h-4" />, sub: `${wonCount} av ${allClosed.length}` },
          { label: "Churn", value: `${churnRate}%`, icon: <PieChart className="w-4 h-4" />, sub: `${kansellertCount} kansellert` },
          { label: "Vunnet", value: `${wonCount}`, icon: <Trophy className="w-4 h-4" />, sub: `${vunnetDenneMnd} denne mnd` },
          { label: "Tapt", value: `${salgsmuligheter.filter(s => s.status === "Tapt").length}`, icon: <XCircle className="w-4 h-4" />, sub: `${taptDenneMnd} denne mnd` },
          { label: "Kansellerte", value: `${kansellertCount}`, icon: <UserMinus className="w-4 h-4" />, sub: `${kansellertDenneMnd} denne mnd` },
        ];
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            {kpis.map(kpi => (
              <div key={kpi.label} className="bg-card border rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="text-muted-foreground">{kpi.icon}</div>
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-lg font-bold tracking-tight">{kpi.value}</p>
                  {(kpi as any).sub && <p className="text-[10px] text-muted-foreground">{(kpi as any).sub}</p>}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Søk selskaper..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", lukkedatoFra && "border-primary text-primary")}>
              <CalendarIcon className="w-3.5 h-3.5" />
              {lukkedatoFra ? format(lukkedatoFra, "dd.MM.yyyy") : "Fra dato"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={lukkedatoFra} onSelect={setLukkedatoFra} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", lukkedatoTil && "border-primary text-primary")}>
              <CalendarIcon className="w-3.5 h-3.5" />
              {lukkedatoTil ? format(lukkedatoTil, "dd.MM.yyyy") : "Til dato"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={lukkedatoTil} onSelect={setLukkedatoTil} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>

        {(lukkedatoFra || lukkedatoTil) && (
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={() => { setLukkedatoFra(undefined); setLukkedatoTil(undefined); }}>
            <X className="w-3.5 h-3.5" /> Nullstill
          </Button>
        )}
      </div>

      {/* Mobile: card layout */}
      {isMobile ? (
        <div className="space-y-3">
          {filtered.map(s => {
            const selskapSm = salgsmuligheter.filter(sm => sm.selskap_id === s.id && sm.status !== "Tapt");
            const totalSla = selskapSm.reduce((sum, sm) => sum + (sm.sla || 0), 0);
            return (
              <div key={s.id} className="bg-card border rounded-xl p-4 space-y-2" onClick={() => navigate(`/selskaper/${s.id}`)}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm truncate">{s.firmanavn}</p>
                  <Badge className={`text-[10px] shrink-0 ${kundestatusColors[s.kundestatus]}`}>{s.kundestatus}</Badge>
                </div>
                {s.bransje && <p className="text-xs text-muted-foreground">{s.bransje}</p>}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono">MRR: {s.mrr.toLocaleString("no-NO")}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${tilstandColors[s.kundetilstand]}`}>{s.kundetilstand}</span>
                </div>
                {canEdit && (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setRevertDialog(s.id)}>
                    <Undo2 className="w-3 h-3" /> Angre
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setTransferDialog(s.id)}>
                    <ArrowRightLeft className="w-3 h-3" /> Partner
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteDialog(s.id)}>
                    <Trash2 className="w-3 h-3" /> Slett
                  </Button>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
                </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Ingen selskaper å vise</p>}
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Firma</th>
                <th className="text-left px-4 py-3 font-medium">Bransje</th>
                <th className="text-left px-4 py-3 font-medium">Kundestatus</th>
                <th className="text-left px-4 py-3 font-medium">Live</th>
                <th className="text-left px-4 py-3 font-medium">Tilstand</th>
                <th className="text-right px-4 py-3 font-medium">MRR</th>
                <th className="text-right px-4 py-3 font-medium">ARR</th>
                <th className="text-right px-4 py-3 font-medium">SLA</th>
                <th className="text-right px-4 py-3 font-medium">Oppstart</th>
                <th className="text-left px-4 py-3 font-medium">Lukkedato</th>
                <th className="text-left px-4 py-3 font-medium">Sist aktivitet</th>
                {canEdit && <th className="text-right px-4 py-3 font-medium">Handlinger</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const selskapSm = salgsmuligheter.filter(sm => sm.selskap_id === s.id && sm.status !== "Tapt");
                const totalSla = selskapSm.reduce((sum, sm) => sum + (sm.sla || 0), 0);
                return (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/selskaper/${s.id}`)}>
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <CompanyLogo firmanavn={s.firmanavn} size="sm" />
                      {s.firmanavn}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.bransje || "–"}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <select className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${kundestatusColors[s.kundestatus]}`}
                      value={s.kundestatus} onChange={e => changeKundestatus(s.id, e.target.value as Kundestatus)} disabled={!canEdit}>
                      {kundestatuser.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <Switch checked={s.live_status} onCheckedChange={v => toggleLive(s.id, v)} disabled={!canEdit} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tilstandColors[s.kundetilstand]}`}>{s.kundetilstand}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{s.mrr.toLocaleString("no-NO")}</td>
                  <td className="px-4 py-3 text-right font-mono">{s.arr.toLocaleString("no-NO")}</td>
                  <td className="px-4 py-3 text-right font-mono">{totalSla.toLocaleString("no-NO")}</td>
                  <td className="px-4 py-3 text-right font-mono">{s.oppstartskostnad.toLocaleString("no-NO")}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{s.lukkedato || "–"}</td>
                  <td className="px-4 py-3"><LastActivityBadge selskap_id={s.id} sist_aktivitet={s.sist_aktivitet} /></td>
                  {canEdit && (
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Angre til salgsmulighet" onClick={() => setRevertDialog(s.id)}>
                        <Undo2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Overfør til partner" onClick={() => setTransferDialog(s.id)}>
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Slett" onClick={() => setDeleteDialog(s.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DetailPanelShell
        open={!!currentSelskap}
        onClose={() => setSelected(null)}
        title={currentSelskap?.firmanavn || ""}
        subtitle={currentSelskap?.bransje || undefined}
        badges={currentSelskap ? (
          <>
            <Badge className={`text-xs ${kundestatusColors[currentSelskap.kundestatus]}`}>{currentSelskap.kundestatus}</Badge>
            {currentSelskap.kundetilstand && (
              <Badge className={`text-xs ${tilstandColors[currentSelskap.kundetilstand]}`}>{currentSelskap.kundetilstand}</Badge>
            )}
            {currentSelskap.live_status && (
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400">Live</Badge>
            )}
          </>
        ) : undefined}
        tabContent={currentSelskap ? (() => {
          const updateField = (field: string, value: any) => {
            const today = new Date().toISOString().split("T")[0];
            updateSelskaper(prev => prev.map(s =>
              s.id === currentSelskap.id ? { ...s, [field]: value, sist_aktivitet: today } : s
            ));
          };
          return {
            detaljer: (
              <div className="space-y-3">
                {/* Neste steg – prominent at top */}
                <div className={`rounded-lg border p-3 ${!currentSelskap.neste_steg ? "border-warning bg-warning/5" : "bg-muted/30"}`}>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Neste steg</label>
                  <Input value={currentSelskap.neste_steg} onChange={e => updateField("neste_steg", e.target.value)} className="h-7 text-xs mt-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" placeholder="Hva er neste steg?" readOnly={!canEdit} />
                  {!currentSelskap.neste_steg && <p className="text-[10px] text-warning mt-0.5">⚠ Mangler neste steg</p>}
                </div>

                {/* Compact key metrics */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "MRR", value: `${(currentSelskap.mrr || 0).toLocaleString("no-NO")}` },
                    { label: "ARR", value: `${(currentSelskap.mrr * 12).toLocaleString("no-NO")}` },
                    { label: "Oppstart", value: `${(currentSelskap.oppstartskostnad || 0).toLocaleString("no-NO")}` },
                    { label: "Tilstand", value: currentSelskap.kundetilstand },
                  ].map(m => (
                    <div key={m.label} className="rounded-lg bg-muted/40 p-2 text-center">
                      <div className="text-sm font-semibold">{m.value}</div>
                      <div className="text-[10px] text-muted-foreground">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Status & info – compact grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-xs"><span className="text-muted-foreground">Kundestatus</span>
                    <select className={`w-full border rounded px-2 py-1 text-xs bg-background h-7 mt-0.5 ${kundestatusColors[currentSelskap.kundestatus]}`}
                      value={currentSelskap.kundestatus} disabled={!canEdit}
                      onChange={e => {
                        const val = e.target.value as Kundestatus;
                        if (val === "Kansellert") { changeKundestatus(currentSelskap.id, val); }
                        else { updateField("kundestatus", val); if (val === "Live") updateField("live_status", true); else if (val !== "Pilot") updateField("live_status", false); }
                      }}>
                      {kundestatuser.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Onboarding</span>
                    <select className="w-full border rounded px-2 py-1 text-xs bg-background h-7 mt-0.5" value={currentSelskap.onboarding_status}
                      onChange={e => updateField("onboarding_status", e.target.value)} disabled={!canEdit}>
                      {(["Ikke startet", "Pågår", "Venter på kunde", "Klar for live", "Ferdig"] as OnboardingStatus[]).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Kundetilstand</span>
                    <select className={`w-full border rounded px-2 py-1 text-xs bg-background h-7 mt-0.5 ${tilstandColors[currentSelskap.kundetilstand]}`}
                      value={currentSelskap.kundetilstand} onChange={e => updateField("kundetilstand", e.target.value)} disabled={!canEdit}>
                      {(["Bra", "Usikker", "Risiko"] as Kundetilstand[]).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="text-xs flex items-end gap-2 pb-0.5">
                    <span className="text-muted-foreground">Live</span>
                    <Switch checked={currentSelskap.live_status} onCheckedChange={v => toggleLive(currentSelskap.id, v)} disabled={!canEdit} />
                  </div>
                </div>

                <div className="border-t" />

                {/* Company details */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-xs"><span className="text-muted-foreground">Firmanavn</span>
                    <Input value={currentSelskap.firmanavn} onChange={e => updateField("firmanavn", e.target.value)} className="h-7 text-xs mt-0.5" readOnly={!canEdit} />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Bransje</span>
                    <Input value={currentSelskap.bransje} onChange={e => updateField("bransje", e.target.value)} className="h-7 text-xs mt-0.5" readOnly={!canEdit} />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Kundeansvarlig</span>
                    <Input value={currentSelskap.kundeansvarlig} onChange={e => updateField("kundeansvarlig", e.target.value)} className="h-7 text-xs mt-0.5" readOnly={!canEdit} />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">MRR</span>
                    <Input type="number" value={currentSelskap.mrr || ""} onChange={e => {
                      const mrr = Number(e.target.value);
                      updateSelskaper(prev => prev.map(s => s.id === currentSelskap.id ? { ...s, mrr, arr: mrr * 12, sist_aktivitet: new Date().toISOString().split("T")[0] } : s));
                    }} className="h-7 text-xs mt-0.5" readOnly={!canEdit} />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Lukkedato</span>
                    <Input type="date" value={currentSelskap.lukkedato} onChange={e => updateField("lukkedato", e.target.value)} className="h-7 text-xs mt-0.5" readOnly={!canEdit} />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Go-live dato</span>
                    <Input type="date" value={currentSelskap.go_live_dato} onChange={e => updateField("go_live_dato", e.target.value)} className="h-7 text-xs mt-0.5" readOnly={!canEdit} />
                  </div>
                </div>

                {currentSelskap.kundestatus === "Kansellert" && (
                  <div className="p-2.5 bg-destructive/10 rounded-lg text-destructive text-xs">
                    <strong>Kansellert:</strong> {currentSelskap.kansellert_dato} – {currentSelskap.kanselleringsaarsak}
                    {currentSelskap.kanselleringsnotat && <p className="mt-1">{currentSelskap.kanselleringsnotat}</p>}
                  </div>
                )}
              </div>
            ),
            interaksjoner: (
              <InlineTaskForm selskap_id={currentSelskap.id} />
            ),
            notater: (
              <DetailField label="Notater">
                <Textarea value={currentSelskap.notater} onChange={e => updateField("notater", e.target.value)} rows={6} readOnly={!canEdit} />
              </DetailField>
            ),
          };
        })() : undefined}
      />
    </PageShell>
  );
}
