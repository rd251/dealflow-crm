import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import EntityCalendarTab from "@/components/EntityCalendarTab";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, nok } from "@/lib/utils";
import { Plus, Search, Building2, ChevronRight, CalendarIcon, X, Upload, Trash2, ArrowRightLeft, Undo2, DollarSign, TrendingUp, Target, PieChart, Users, BarChart3, ArrowDownRight, ArrowUpRight, Trophy, XCircle, UserMinus, AlertTriangle, ArrowUp, ArrowDown, ChevronsUpDown, Rocket, FileText } from "lucide-react";
import CompanyLogo from "@/components/CompanyLogo";
import { beregnTotalKontraktsverdi } from "@/data/crm-data";
import { useNavigate } from "react-router-dom";
import InlineTaskForm from "@/components/InlineTaskForm";
import { Selskap, Kundestatus, OnboardingStatus, Kundetilstand, Kanselleringsaarsak, Prosjekt, ProsjektStatus, Integrasjon } from "@/data/crm-data";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DataImportDialog from "@/components/DataImportDialog";
import LastActivityBadge from "@/components/LastActivityBadge";
import CompanyDocuments from "@/components/CompanyDocuments";
import KundeKort from "@/components/kunde/KundeKort";
import { INAKTIV_DAGER, dagerSiden, erSammeMaaned } from "@/lib/kundeforhold";

/** Statusfiltre på kundeoversikten. */
type Kundefilter = "Alle" | "Live" | "Risiko" | "Pilot" | "Kansellert";
const KUNDEFILTRE: Kundefilter[] = ["Alle", "Live", "Risiko", "Pilot", "Kansellert"];

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
  const { selskaper, kontakter, salgsmuligheter, prosjekter, partnere, updateSelskaper, updateProsjekter, kansellerSelskap, slettSelskap, konverterSelskapTilPartner, angreTilSalgsmulighet, generateId } = useCrmStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Kundefilter>("Alle");
  const [portfolio, setPortfolio] = useState<"egen" | "partner">("egen");
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
  const [newProjectDialog, setNewProjectDialog] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState({ prosjektnavn: "", integrasjon: "Ingen" as Integrasjon });
  const [editProject, setEditProject] = useState<Prosjekt | null>(null);
  type SortKey = "firmanavn" | "bransje" | "kundestatus" | "live" | "tilstand" | "mrr" | "arr" | "sla" | "oppstart" | "lukkedato" | "sist_aktivitet";
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [partnerPakker, setPartnerPakker] = useState<Array<{ id: string; partner_id: string; navn: string; inkluderte_minutter: number; utsalgspris_sluttkunde: number }>>([]);
  const [partnerTrinn, setPartnerTrinn] = useState<Array<{ partner_id: string; min_kunder: number; max_kunder: number | null; kostpris_per_minutt: number }>>([]);

  const reloadPartnerPakker = async () => {
    const { data } = await supabase.from("partner_pakker").select("id, partner_id, navn, inkluderte_minutter, utsalgspris_sluttkunde").eq("aktiv", true);
    setPartnerPakker(data || []);
  };

  useEffect(() => {
    (async () => {
      const [{ data: pk }, { data: pm }] = await Promise.all([
        supabase.from("partner_pakker").select("id, partner_id, navn, inkluderte_minutter, utsalgspris_sluttkunde").eq("aktiv", true),
        supabase.from("partner_prismodell").select("partner_id, min_kunder, max_kunder, kostpris_per_minutt"),
      ]);
      setPartnerPakker(pk || []);
      setPartnerTrinn(pm || []);
    })();
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  // Only show companies that have an active agreement (not "Ikke kunde")
  const filteredUnsorted = selskaper.filter(s => {
    if (!s.firmanavn.toLowerCase().includes(search.toLowerCase())) return false;
    if (s.kundestatus === "Ikke kunde") return false;
    const isPartnerCust = !!s.partner_id;
    if (portfolio === "egen" && isPartnerCust) return false;
    if (portfolio === "partner" && !isPartnerCust) return false;
    if (statusFilter === "Risiko" && s.kundetilstand !== "Risiko") return false;
    if (statusFilter !== "Alle" && statusFilter !== "Risiko" && s.kundestatus !== statusFilter) return false;
    if (lukkedatoFra || lukkedatoTil) {
      if (!s.lukkedato) return false;
      const ld = new Date(s.lukkedato);
      if (lukkedatoFra && ld < lukkedatoFra) return false;
      if (lukkedatoTil && ld > lukkedatoTil) return false;
    }
    return true;
  });

  const filtered = [...filteredUnsorted].sort((a, b) => {
    if (!sortKey) return 0;
    const dir = sortDir === "asc" ? 1 : -1;
    const slaFor = (s: Selskap) => salgsmuligheter.filter(sm => sm.selskap_id === s.id && sm.status !== "Tapt").reduce((sum, sm) => sum + (sm.sla || 0), 0);
    switch (sortKey) {
      case "firmanavn": return dir * a.firmanavn.localeCompare(b.firmanavn, "nb");
      case "bransje": return dir * (a.bransje || "").localeCompare(b.bransje || "", "nb");
      case "kundestatus": return dir * a.kundestatus.localeCompare(b.kundestatus, "nb");
      case "live": return dir * (Number(a.live_status) - Number(b.live_status));
      case "tilstand": return dir * (a.kundetilstand || "").localeCompare(b.kundetilstand || "", "nb");
      case "mrr": return dir * (a.mrr - b.mrr);
      case "arr": return dir * (a.arr - b.arr);
      case "sla": return dir * (slaFor(a) - slaFor(b));
      case "oppstart": return dir * (a.oppstartskostnad - b.oppstartskostnad);
      case "lukkedato": return dir * (a.lukkedato || "").localeCompare(b.lukkedato || "");
      case "sist_aktivitet": return dir * (a.sist_aktivitet || "").localeCompare(b.sist_aktivitet || "");
      default: return 0;
    }
  });

  const addSelskap = () => {
    const id = generateId("S", selskaper);
    const nyttSelskap: Selskap = {
      id, firmanavn: form.firmanavn, bransje: form.bransje, kundeansvarlig: form.kundeansvarlig,

      kundestatus: "Pilot", live_status: false, onboarding_status: "Ikke startet",
      mrr: 0, arr: 0, oppstartskostnad: 0, go_live_dato: "", kansellert_dato: "",
      kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra",
      sist_aktivitet: new Date().toISOString().split("T")[0], neste_steg: "", notater: "",
      kilde: "Direkte salg", partner_id: "", lukkedato: "", domene: "", orgnr: "", firmaadresse: "", postadresse: "",
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
                lukkedato: "", domene: "", orgnr: "", firmaadresse: "", postadresse: "",
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
              if (deleteDialog && slettSelskap(deleteDialog)) setDeleteDialog(null);
            }}>Slett</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delegate to partner dialog */}
      <DelegateToPartnerDialog
        selskapId={transferDialog}
        onClose={() => setTransferDialog(null)}
        selskaper={selskaper}
        partnere={partnere}
        partnerPakker={partnerPakker}
        updateSelskaper={updateSelskaper}
        onPakkerChanged={reloadPartnerPakker}
      />

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

      <div className="mx-auto max-w-[1500px] space-y-6">
      {/* ─── Portfolio tabs ─── */}
      <Tabs value={portfolio} onValueChange={v => setPortfolio(v as "egen" | "partner")}>
        <TabsList className="border bg-card p-1 shadow-card">
          <TabsTrigger value="egen">Vår portefølje</TabsTrigger>
          <TabsTrigger value="partner">Partner-portefølje</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ─── Hoved-KPI (2x2) ─── */}
      {(() => {
        const scope = selskaper.filter(s => portfolio === "partner" ? !!s.partner_id : !s.partner_id);
        const live = scope.filter(s => s.kundestatus === "Live");
        const kansellertDenneMnd = scope.filter(s => s.kundestatus === "Kansellert" && erSammeMaaned(s.kansellert_dato));
        const basis = live.length + kansellertDenneMnd.length;
        const churn = basis > 0 ? Math.round((kansellertDenneMnd.length / basis) * 100) : 0;
        const kort = [
          { label: "Aktive kunder", value: `${live.length}`, icon: <Users className="w-4 h-4" />, tone: "bg-success/10 text-success" },
          { label: "Total MRR", value: nok(live.reduce((sum, s) => sum + s.mrr, 0)), icon: <DollarSign className="w-4 h-4" />, tone: "bg-success/10 text-success" },
          { label: "Kansellerte denne måneden", value: `${kansellertDenneMnd.length}`, icon: <UserMinus className="w-4 h-4" />, tone: "bg-warning/10 text-warning" },
          { label: "Churn-rate denne måneden", value: `${churn}%`, icon: <PieChart className="w-4 h-4" />, tone: "bg-warning/10 text-warning" },
        ];
        return (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {kort.map(k => (
              <div key={k.label} className="flex min-h-24 items-center gap-3 rounded-xl border bg-card p-4 shadow-card">
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", k.tone)}>{k.icon}</div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
                  <p data-metric className="truncate text-2xl font-semibold tabular-nums">{k.value}</p>
                </div>
              </div>
            ))}
          </section>
        );
      })()}

      {/* ─── Flere nøkkeltall ─── */}
      {(() => {
        const scopeSelskaper = selskaper.filter(s => portfolio === "partner" ? !!s.partner_id : !s.partner_id);
        const scopeIds = new Set(scopeSelskaper.map(s => s.id));
        const scopeSm = salgsmuligheter.filter(sm => scopeIds.has(sm.selskap_id) || (portfolio === "partner" ? !!sm.partner_id : !sm.partner_id));

        const liveSelskaper = scopeSelskaper.filter(s => s.kundestatus === "Live");
        const aktiveKunder = liveSelskaper.length;
        let totalMRR = liveSelskaper.reduce((sum, s) => sum + s.mrr, 0);
        let totalARR = totalMRR * 12;

        // Fakturerbart MRR fra partner-kunder (alltid beregnet, basert på live partner-kunder)
        // = sum av inkluderte minutter på tildelte pakker × kostpris per minutt fra partner-tier
        let fakturerbartMRR = 0;
        {
          const livePartnerSelskaper = selskaper.filter(s => s.kundestatus === "Live" && !!s.partner_id);
          const liveByPartner: Record<string, typeof livePartnerSelskaper> = {};
          for (const s of livePartnerSelskaper) {
            (liveByPartner[s.partner_id!] ||= []).push(s);
          }
          for (const [pid, kunder] of Object.entries(liveByPartner)) {
            const count = kunder.length;
            const tiers = partnerTrinn
              .filter(t => t.partner_id === pid)
              .sort((a, b) => a.min_kunder - b.min_kunder);
            const tier = tiers.find(t => count >= t.min_kunder && (t.max_kunder == null || count <= t.max_kunder))
              ?? tiers[tiers.length - 1];
            const costPerMin = tier?.kostpris_per_minutt || 0;
            const pakkerById = new Map(partnerPakker.filter(p => p.partner_id === pid).map(p => [p.id, p]));
            for (const k of kunder) {
              const pk = k.partner_pakke_id ? pakkerById.get(k.partner_pakke_id) : null;
              if (pk) fakturerbartMRR += pk.inkluderte_minutter * costPerMin;
            }
          }
        }
        const fakturerbartARR = fakturerbartMRR * 12;

        // På "Vår portefølje" plusses fakturerbart fra partner-kunder inn i totalen
        if (portfolio === "egen") {
          totalMRR += fakturerbartMRR;
          totalARR += fakturerbartARR;
        }




        // Netto MRR: new MRR this month minus lost MRR this month
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nyMRR = scopeSelskaper
          .filter(s => s.kundestatus === "Live" && s.go_live_dato && new Date(s.go_live_dato) >= monthStart)
          .reduce((sum, s) => sum + s.mrr, 0);
        const taptMRR = scopeSelskaper
          .filter(s => s.kundestatus === "Kansellert" && s.kansellert_dato && new Date(s.kansellert_dato) >= monthStart)
          .reduce((sum, s) => sum + s.mrr, 0);
        const nettoMRR = nyMRR - taptMRR;

        // Ikke-live MRR/ARR (Pilot, Pause etc.)
        const ikkeLiveSelskaper = scopeSelskaper.filter(s => s.kundestatus !== "Live" && s.kundestatus !== "Kansellert" && s.kundestatus !== "Ikke kunde");
        const ikkeLiveMRR = ikkeLiveSelskaper.reduce((sum, s) => sum + s.mrr, 0);
        const ikkeLiveARR = ikkeLiveMRR * 12;

        const openSm = scopeSm.filter(s => s.status !== "Vunnet" && s.status !== "Tapt");
        const pipelineVerdi = openSm.reduce((sum, s) => sum + beregnTotalKontraktsverdi(s), 0);
        const allClosed = scopeSm.filter(s => s.status === "Vunnet" || s.status === "Tapt");
        const wonCount = scopeSm.filter(s => s.status === "Vunnet").length;
        const winRate = allClosed.length > 0 ? Math.round((wonCount / allClosed.length) * 100) : 0;
        const kansellertCount = scopeSelskaper.filter(s => s.kundestatus === "Kansellert").length;
        const totalKunder = scopeSelskaper.filter(s => ["Live", "Kansellert"].includes(s.kundestatus)).length;
        const churnRate = totalKunder > 0 ? Math.round((kansellertCount / totalKunder) * 100) : 0;

        // Denne måneden
        const vunnetDenneMnd = scopeSm.filter(s => s.status === "Vunnet" && s.vunnet_dato && new Date(s.vunnet_dato) >= monthStart).length;
        const taptDenneMnd = scopeSm.filter(s => s.status === "Tapt" && s.tapt_dato && new Date(s.tapt_dato) >= monthStart).length;
        const kansellertDenneMnd = scopeSelskaper.filter(s => s.kundestatus === "Kansellert" && s.kansellert_dato && new Date(s.kansellert_dato) >= monthStart).length;

        const mrrLabel = portfolio === "partner" ? "Partner MRR" : "MRR";
        const arrLabel = portfolio === "partner" ? "Partner ARR" : "ARR";

        const kpis = [
          { label: mrrLabel, value: nok(totalMRR), icon: <DollarSign className="w-4 h-4" /> },
          { label: arrLabel, value: nok(totalARR), icon: <BarChart3 className="w-4 h-4" /> },
          ...(portfolio === "partner" ? [
            { label: "Fakturerbart MRR", value: nok(fakturerbartMRR), icon: <DollarSign className="w-4 h-4" />, sub: "Til oss fra partner" },
            { label: "Fakturerbart ARR", value: nok(fakturerbartARR), icon: <BarChart3 className="w-4 h-4" />, sub: "Til oss fra partner" },
          ] : []),
          { label: "Netto MRR", value: `${nettoMRR >= 0 ? "" : "−"}${nok(Math.abs(nettoMRR))}`, icon: nettoMRR >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" /> },
          { label: "Aktive kunder", value: `${aktiveKunder}`, icon: <Users className="w-4 h-4" /> },
          { label: "Ikke-live MRR", value: nok(ikkeLiveMRR), icon: <DollarSign className="w-4 h-4" /> },
          { label: "Ikke-live ARR", value: nok(ikkeLiveARR), icon: <BarChart3 className="w-4 h-4" /> },
          { label: "Pipeline", value: nok(pipelineVerdi), icon: <TrendingUp className="w-4 h-4" /> },
          { label: "Win rate", value: `${winRate}%`, icon: <Target className="w-4 h-4" />, sub: `${wonCount} av ${allClosed.length}` },
          { label: "Churn", value: `${churnRate}%`, icon: <PieChart className="w-4 h-4" />, sub: `${kansellertCount} kansellert` },
          { label: "Vunnet", value: `${wonCount}`, icon: <Trophy className="w-4 h-4" />, sub: `${vunnetDenneMnd} denne mnd` },
          { label: "Tapt", value: `${scopeSm.filter(s => s.status === "Tapt").length}`, icon: <XCircle className="w-4 h-4" />, sub: `${taptDenneMnd} denne mnd` },

          { label: "Kansellerte", value: `${kansellertCount}`, icon: <UserMinus className="w-4 h-4" />, sub: `${kansellertDenneMnd} denne mnd` },
        ];
        return (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {kpis.map(kpi => (
              <div key={kpi.label} className="flex min-h-24 items-center gap-3 rounded-lg border bg-card p-4 shadow-card">
                <div className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                  ["MRR", "ARR", "Netto MRR", "Aktive kunder", "Vunnet"].includes(kpi.label) && "bg-success/10 text-success",
                  ["Pipeline", "Ikke-live MRR", "Ikke-live ARR"].includes(kpi.label) && "bg-primary/10 text-primary",
                  ["Win rate", "Churn", "Kansellerte", "Tapt"].includes(kpi.label) && "bg-warning/10 text-warning",
                  kpi.label.startsWith("Partner") && "bg-primary/10 text-primary",
                  kpi.label.startsWith("Fakturerbart") && "bg-primary/10 text-primary",
                )}>{kpi.icon}</div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                  <p data-metric className="truncate text-lg font-semibold">{kpi.value}</p>
                  {(kpi as any).sub && <p className="text-[10px] text-muted-foreground">{(kpi as any).sub}</p>}
                </div>
              </div>
            ))}
          </section>
        );
      })()}

      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-card sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:max-w-sm">
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
      </section>

      {/* Kundeliste i to seksjoner */}
      {(() => {
        const pakkeNavnFor = (s: Selskap) => partnerPakker.find(p => p.id === s.partner_pakke_id)?.navn;
        const emailsFor = (s: Selskap) => kontakter.filter(k => k.selskap_id === s.id).map(k => k.e_post);
        const trengerOppmerksomhet = filtered.filter(s => {
          if (s.kundetilstand === "Risiko" || s.kundetilstand === "Usikker") return true;
          const dager = dagerSiden(s.sist_aktivitet);
          return dager === null || dager > INAKTIV_DAGER;
        });
        const attentionIds = new Set(trengerOppmerksomhet.map(s => s.id));
        const ovrige = filtered
          .filter(s => !attentionIds.has(s.id))
          .sort((a, b) => (b.sist_aktivitet || "").localeCompare(a.sist_aktivitet || ""));

        const Seksjon = ({ tittel, rader, varselFarge }: { tittel: string; rader: Selskap[]; varselFarge: boolean }) => (
          <section className="space-y-3">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {tittel} <span className="tabular-nums">({rader.length})</span>
            </h2>
            {rader.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen kunder her.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {rader.map(s => (
                  <KundeKort
                    key={s.id}
                    selskap={s}
                    pakkenavn={pakkeNavnFor(s)}
                    kontaktEmails={emailsFor(s)}
                    varsel={varselFarge ? (s.kundetilstand === "Risiko" ? "risiko" : "usikker") : null}
                    onClick={() => navigate(`/selskaper/${s.id}`)}
                  />
                ))}
              </div>
            )}
          </section>
        );

        return (
          <div className="space-y-8">
            <Seksjon tittel="Krever oppmerksomhet" rader={trengerOppmerksomhet} varselFarge />
            <Seksjon tittel="Live kunder" rader={ovrige} varselFarge={false} />
          </div>
        );
      })()}
      </div>

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
              <Badge variant="outline" className="status-positive text-xs">Live</Badge>
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

                <div className="border-t" />

                {/* Prosjekter */}
                {(() => {
                  const selskapProsjekter = prosjekter.filter(p => p.selskap_id === currentSelskap.id);
                  return (
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          Prosjekter ({selskapProsjekter.length})
                        </div>
                        {canEdit && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
                            setProjectForm({ prosjektnavn: currentSelskap.firmanavn, integrasjon: "Ingen" });
                            setNewProjectDialog(currentSelskap.id);
                          }}>
                            <Plus className="w-3 h-3" /> Nytt prosjekt
                          </Button>
                        )}
                      </div>
                      {selskapProsjekter.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Ingen prosjekter</p>
                      ) : (
                        <div className="space-y-1.5">
                          {selskapProsjekter.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => setEditProject({ ...p })}>
                              <div>
                                <div className="text-sm font-medium">{p.prosjektnavn}</div>
                                <div className="text-[10px] text-muted-foreground">{p.status}{p.forventet_go_live ? ` · Go-live: ${p.forventet_go_live}` : ""}</div>
                              </div>
                              <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
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
            kalender: (
              <EntityCalendarTab selskap_id={currentSelskap.id} />
            ),
            dokumenter: (
              <CompanyDocuments selskapId={currentSelskap.id} />
            ),
          };
        })() : undefined}
      />

      {/* Nytt prosjekt dialog */}
      <Dialog open={!!newProjectDialog} onOpenChange={open => { if (!open) setNewProjectDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Opprett nytt prosjekt</DialogTitle>
            <DialogDescription>Legg til et prosjekt for dette selskapet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs"><span className="text-muted-foreground">Prosjektnavn</span>
              <Input value={projectForm.prosjektnavn} onChange={e => setProjectForm(f => ({ ...f, prosjektnavn: e.target.value }))} className="h-8 text-sm mt-0.5" placeholder="Prosjektnavn" />
            </div>
            <div className="text-xs"><span className="text-muted-foreground">Integrasjon</span>
              <select className="w-full border rounded px-2 py-1.5 text-sm bg-background mt-0.5"
                value={projectForm.integrasjon} onChange={e => setProjectForm(f => ({ ...f, integrasjon: e.target.value as Integrasjon }))}>
                {(["Ingen", "GastroPlanner", "HubSpot", "Lime", "Salesforce", "API", "Annet"] as Integrasjon[]).map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setNewProjectDialog(null)}>Avbryt</Button>
            <Button disabled={!projectForm.prosjektnavn.trim()} onClick={() => {
              if (!newProjectDialog || !projectForm.prosjektnavn.trim()) return;
              const today = new Date().toISOString().split("T")[0];
              const selskap = selskaper.find(s => s.id === newProjectDialog);
              const newP: Prosjekt = {
                id: generateId("p", prosjekter),
                prosjektnavn: projectForm.prosjektnavn.trim(),
                selskap_id: newProjectDialog,
                salgsmulighet_id: "",
                ansvarlig: selskap?.kundeansvarlig || "",
                status: "Ny",
                startdato: today,
                forventet_go_live: "",
                go_live_dato: "",
                oppstartskostnad: 0,
                oppstart_fakturert: false,
                oppstart_faktura_dato: "",
                oppstart_betalt: false,
                integrasjon: projectForm.integrasjon,
                notater: "",
              };
              updateProsjekter(prev => [...prev, newP]);
              setNewProjectDialog(null);
              toast.success("Prosjekt opprettet");
            }}>
              <Rocket className="w-3.5 h-3.5 mr-1.5" />Opprett
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rediger prosjekt dialog */}
      <Dialog open={!!editProject} onOpenChange={open => { if (!open) setEditProject(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rediger prosjekt</DialogTitle>
            <DialogDescription>Oppdater prosjektdetaljer.</DialogDescription>
          </DialogHeader>
          {editProject && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-xs col-span-2"><span className="text-muted-foreground">Prosjektnavn</span>
                  <Input value={editProject.prosjektnavn} onChange={e => setEditProject(p => p ? { ...p, prosjektnavn: e.target.value } : p)} className="h-8 text-sm mt-0.5" />
                </div>
                <div className="text-xs"><span className="text-muted-foreground">Status</span>
                  <select className="w-full border rounded px-2 py-1.5 text-sm bg-background mt-0.5"
                    value={editProject.status} onChange={e => setEditProject(p => p ? { ...p, status: e.target.value as ProsjektStatus } : p)}>
                    {(["Ny", "I produksjon", "Test med kunde", "Live", "Blokkert"] as ProsjektStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="text-xs"><span className="text-muted-foreground">Integrasjon</span>
                  <select className="w-full border rounded px-2 py-1.5 text-sm bg-background mt-0.5"
                    value={editProject.integrasjon} onChange={e => setEditProject(p => p ? { ...p, integrasjon: e.target.value as Integrasjon } : p)}>
                    {(["Ingen", "GastroPlanner", "HubSpot", "Lime", "Salesforce", "API", "Annet"] as Integrasjon[]).map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div className="text-xs"><span className="text-muted-foreground">Ansvarlig</span>
                  <Input value={editProject.ansvarlig} onChange={e => setEditProject(p => p ? { ...p, ansvarlig: e.target.value } : p)} className="h-8 text-sm mt-0.5" />
                </div>
                <div className="text-xs"><span className="text-muted-foreground">Startdato</span>
                  <Input type="date" value={editProject.startdato} onChange={e => setEditProject(p => p ? { ...p, startdato: e.target.value } : p)} className="h-8 text-sm mt-0.5" />
                </div>
                <div className="text-xs"><span className="text-muted-foreground">Forventet go-live</span>
                  <Input type="date" value={editProject.forventet_go_live} onChange={e => setEditProject(p => p ? { ...p, forventet_go_live: e.target.value } : p)} className="h-8 text-sm mt-0.5" />
                </div>
                <div className="text-xs"><span className="text-muted-foreground">Go-live dato</span>
                  <Input type="date" value={editProject.go_live_dato} onChange={e => setEditProject(p => p ? { ...p, go_live_dato: e.target.value } : p)} className="h-8 text-sm mt-0.5" />
                </div>
                <div className="text-xs"><span className="text-muted-foreground">Oppstartskostnad</span>
                  <Input type="number" value={editProject.oppstartskostnad || ""} onChange={e => setEditProject(p => p ? { ...p, oppstartskostnad: Number(e.target.value) } : p)} className="h-8 text-sm mt-0.5" />
                </div>
                <div className="text-xs flex items-end gap-2 pb-1">
                  <span className="text-muted-foreground">Fakturert</span>
                  <Switch checked={editProject.oppstart_fakturert} onCheckedChange={v => setEditProject(p => p ? { ...p, oppstart_fakturert: v } : p)} />
                </div>
                <div className="text-xs flex items-end gap-2 pb-1">
                  <span className="text-muted-foreground">Betalt</span>
                  <Switch checked={editProject.oppstart_betalt} onCheckedChange={v => setEditProject(p => p ? { ...p, oppstart_betalt: v } : p)} />
                </div>
                <div className="text-xs col-span-2"><span className="text-muted-foreground">Notater</span>
                  <Textarea value={editProject.notater} onChange={e => setEditProject(p => p ? { ...p, notater: e.target.value } : p)} rows={3} className="text-sm mt-0.5" />
                </div>
              </div>
              <div className="flex justify-between gap-2 mt-2">
                <Button variant="destructive" size="sm" onClick={() => {
                  if (!editProject) return;
                  updateProsjekter(prev => prev.filter(p => p.id !== editProject.id));
                  setEditProject(null);
                  toast.success("Prosjekt slettet");
                }}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" />Slett
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditProject(null)}>Avbryt</Button>
                  <Button onClick={() => {
                    if (!editProject) return;
                    updateProsjekter(prev => prev.map(p => p.id === editProject.id ? editProject : p));
                    setEditProject(null);
                    toast.success("Prosjekt oppdatert");
                  }}>Lagre endringer</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function DelegateToPartnerDialog({
  selskapId, onClose, selskaper, partnere, partnerPakker, updateSelskaper, onPakkerChanged,
}: {
  selskapId: string | null;
  onClose: () => void;
  selskaper: Selskap[];
  partnere: any[];
  partnerPakker: Array<{ id: string; partner_id: string; navn: string; inkluderte_minutter: number; utsalgspris_sluttkunde: number }>;
  updateSelskaper: (updater: (prev: Selskap[]) => Selskap[]) => void;
  onPakkerChanged: () => Promise<void>;
}) {
  const PRESETS = [
    { navn: "Chatbot + 100 min", inkluderte_minutter: 100, utsalgspris_sluttkunde: 990, beskrivelse: "Unlimited chat + 100 min voice" },
    { navn: "Starter", inkluderte_minutter: 500, utsalgspris_sluttkunde: 2500, beskrivelse: "500 min/mo" },
    { navn: "800 min", inkluderte_minutter: 800, utsalgspris_sluttkunde: 4000, beskrivelse: "800 min/mo" },
    { navn: "Growth", inkluderte_minutter: 1500, utsalgspris_sluttkunde: 7500, beskrivelse: "1 500 min/mo — MEST POPULÆR" },
    { navn: "Pro", inkluderte_minutter: 2500, utsalgspris_sluttkunde: 12500, beskrivelse: "2 500 min/mo" },
    { navn: "Team", inkluderte_minutter: 3000, utsalgspris_sluttkunde: 15000, beskrivelse: "3 000 min/mo" },
    { navn: "Business", inkluderte_minutter: 6000, utsalgspris_sluttkunde: 30000, beskrivelse: "6 000 min/mo" },
    { navn: "Enterprise", inkluderte_minutter: 22500, utsalgspris_sluttkunde: 0, beskrivelse: "22 500+ min/mo — Custom" },
  ];

  const selskap = selskapId ? selskaper.find(s => s.id === selskapId) : null;
  const [partnerId, setPartnerId] = useState<string>("");
  const [pakkeSelection, setPakkeSelection] = useState<string>(""); // "existing:<id>" or "preset:<idx>" or ""
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selskap) {
      setPartnerId(selskap.partner_id || "");
      const existing = (selskap as any).partner_pakke_id;
      setPakkeSelection(existing ? `existing:${existing}` : "");
    }
  }, [selskap?.id]);

  if (!selskap) return null;

  const partnerPakkerFor = partnerPakker.filter(p => p.partner_id === partnerId);
  const missingPresets = PRESETS.filter(preset =>
    !partnerPakkerFor.some(pp => pp.inkluderte_minutter === preset.inkluderte_minutter && (pp.navn || "").toLowerCase() === preset.navn.toLowerCase())
  );

  const resolvePakkeId = async (): Promise<string | null> => {
    if (!pakkeSelection) return null;
    if (pakkeSelection.startsWith("existing:")) return pakkeSelection.split(":")[1];
    if (pakkeSelection.startsWith("preset:")) {
      const idx = Number(pakkeSelection.split(":")[1]);
      const preset = PRESETS[idx];
      if (!preset) return null;
      // Insert into partner_pakker for this partner
      const nextSort = (partnerPakkerFor.length || 0) + 1;
      const { data, error } = await supabase.from("partner_pakker").insert({
        partner_id: partnerId,
        navn: preset.navn,
        beskrivelse: preset.beskrivelse,
        inkluderte_minutter: preset.inkluderte_minutter,
        utsalgspris_sluttkunde: preset.utsalgspris_sluttkunde,
        ekstra_min_pris: 0,
        aktiv: true,
        sortering: nextSort,
      }).select("id").single();
      if (error) { toast.error("Kunne ikke opprette pakke: " + error.message); return null; }
      await onPakkerChanged();
      return data.id;
    }
    return null;
  };

  const handleDelegate = async () => {
    if (!partnerId) { toast.error("Velg en partner"); return; }
    setSaving(true);
    const pakkeId = await resolvePakkeId();
    const today = new Date().toISOString().split("T")[0];
    updateSelskaper(prev => prev.map(s => s.id === selskap.id ? {
      ...s,
      partner_id: partnerId,
      partner_pakke_id: pakkeId || null,
      kilde: "Partner",
      sist_aktivitet: today,
    } as Selskap : s));
    toast.success(`${selskap.firmanavn} delegert til partner`);
    setSaving(false);
    onClose();
  };

  const handleTakeBack = () => {
    const today = new Date().toISOString().split("T")[0];
    updateSelskaper(prev => prev.map(s => s.id === selskap.id ? {
      ...s,
      partner_id: "",
      partner_pakke_id: null,
      kilde: "Direkte salg",
      sist_aktivitet: today,
    } as Selskap : s));
    toast.success(`${selskap.firmanavn} tatt tilbake fra partner`);
    onClose();
  };

  const currentPartner = selskap.partner_id ? partnere.find(p => p.id === selskap.partner_id) : null;

  return (
    <Dialog open={!!selskapId} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{currentPartner ? "Endre partner-tilknytning" : "Delegér kunde til partner"}</DialogTitle>
          <DialogDescription>
            {currentPartner
              ? `${selskap.firmanavn} er i dag tilknyttet ${currentPartner.partnernavn}. Bytt partner, endre pakke, eller ta kunden tilbake til egen portefølje.`
              : `Overfør ansvaret for ${selskap.firmanavn} til en partner. Kunden flyttes til «Partner-portefølje» og fakturering beregnes ut fra partnerens avtale.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Partner</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              value={partnerId}
              onChange={e => { setPartnerId(e.target.value); setPakkeSelection(""); }}
            >
              <option value="">– Velg partner –</option>
              {partnere
                .filter(p => p.partnerstatus === "Aktiv" || p.id === selskap.partner_id)
                .map(p => <option key={p.id} value={p.id}>{p.partnernavn}</option>)}
            </select>
          </div>
          {partnerId && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Pakke (valgfritt)</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                value={pakkeSelection}
                onChange={e => setPakkeSelection(e.target.value)}
              >
                <option value="">– Ingen pakke –</option>
                {partnerPakkerFor.length > 0 && (
                  <optgroup label="Partnerens pakker">
                    {partnerPakkerFor.map(pk => (
                      <option key={pk.id} value={`existing:${pk.id}`}>
                        {pk.navn} — {pk.inkluderte_minutter} min ({nok(pk.utsalgspris_sluttkunde)})
                      </option>
                    ))}
                  </optgroup>
                )}
                {missingPresets.length > 0 && (
                  <optgroup label="Standard Snakk-pakker (legges til automatisk)">
                    {missingPresets.map(preset => {
                      const idx = PRESETS.indexOf(preset);
                      return (
                        <option key={idx} value={`preset:${idx}`}>
                          + {preset.navn} — {preset.inkluderte_minutter.toLocaleString("no-NO")} min{preset.utsalgspris_sluttkunde ? ` (${nok(preset.utsalgspris_sluttkunde)})` : ""}
                        </option>
                      );
                    })}
                  </optgroup>
                )}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Standard-pakker blir opprettet på partneren første gang de velges.
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2 justify-between pt-2">
          {currentPartner ? (
            <Button variant="outline" size="sm" onClick={handleTakeBack}>
              Ta tilbake til egen portefølje
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Avbryt</Button>
            <Button onClick={handleDelegate} disabled={!partnerId || saving}>
              {saving ? "Lagrer..." : currentPartner ? "Oppdater" : "Delegér"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
