import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import DetailPanelShell, { DetailSection, DetailField, DetailDivider, DetailStatGrid, DetailStatCard } from "@/components/DetailPanelShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, GripVertical, Trophy, XCircle, Trash2, Phone, User, AlertTriangle, Clock } from "lucide-react";
import EntityLinkPicker from "@/components/EntityLinkPicker";
import { Badge } from "@/components/ui/badge";
import { Salgsmulighet, SalgsmulighetStatus, Tapsaarsak, beregnTotalKontraktsverdi, beregnVektetPipeline } from "@/data/crm-data";
import InlineTaskForm from "@/components/InlineTaskForm";
import ActivityLog from "@/components/ActivityLog";

const openStatuses: SalgsmulighetStatus[] = ["Møte booket", "Behov avklart", "Løsning presentert", "Tilbud sendt", "Beslutning"];
const tapsaarsaker: Tapsaarsak[] = ["Pris", "Ikke riktig timing", "Valgte annen leverandør", "Ikke behov", "Teknisk / integrasjon", "Annet"];

const statusColors: Record<SalgsmulighetStatus, string> = {
  "Møte booket": "bg-stage-contacted",
  "Behov avklart": "bg-stage-qualified",
  "Løsning presentert": "bg-stage-demo",
  "Tilbud sendt": "bg-stage-proposal",
  "Beslutning": "bg-stage-negotiation",
  "Vunnet": "bg-stage-won",
  "Tapt": "bg-stage-lost",
};

// Activity signal: days since last activity
function activitySignal(sist_aktivitet: string): { color: string; border: string; label: string } {
  if (!sist_aktivitet) return { color: "bg-destructive", border: "border-l-destructive", label: ">3 dager" };
  const days = Math.floor((Date.now() - new Date(sist_aktivitet).getTime()) / (1000 * 60 * 60 * 24));
  if (days > 3) return { color: "bg-destructive", border: "border-l-destructive", label: `${days}d` };
  if (days >= 1) return { color: "bg-warning", border: "border-l-warning", label: `${days}d` };
  return { color: "bg-success", border: "border-l-success", label: "i dag" };
}

// Sort deals: least recent activity first, then highest value
function sortDeals(deals: Salgsmulighet[]): Salgsmulighet[] {
  return [...deals].sort((a, b) => {
    // Primary: least recent activity first (oldest first)
    const dateA = a.sist_aktivitet ? new Date(a.sist_aktivitet).getTime() : 0;
    const dateB = b.sist_aktivitet ? new Date(b.sist_aktivitet).getTime() : 0;
    if (dateA !== dateB) return dateA - dateB;
    // Secondary: highest value first
    return b.forventet_mrr - a.forventet_mrr;
  });
}

export default function Salgsmuligheter() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { canEdit } = useAuth();
  const { salgsmuligheter, selskaper, kontakter, updateSalgsmuligheter, updateKontakter, vinnSalgsmulighet, tapSalgsmulighet, generateId } = useCrmStore();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [selectedSm, setSelectedSm] = useState<Salgsmulighet | null>(null);
  const [lossDialog, setLossDialog] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState<Tapsaarsak>("Pris");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [moveBlockedId, setMoveBlockedId] = useState<string | null>(null);
  const [form, setForm] = useState({ navn: "", selskap_id: "", kontakt_id: "", forventet_mrr: 0, sla: 0, oppstartskostnad: 0, kontraktslengde_mnd: 12, sannsynlighet: 50, forventet_lukkedato: "", neste_steg: "", rolle_i_firma: "", use_case: "", kontaktperson: "", e_post: "", telefon: "" });

  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId && salgsmuligheter.length > 0) {
      const found = salgsmuligheter.find(s => s.id === openId);
      if (found) {
        setSelectedSm(found);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, salgsmuligheter]);

  const getSelskapNavn = (id: string) => selskaper.find(s => s.id === id)?.firmanavn || "–";

  const handleDrop = (e: React.DragEvent, stage: SalgsmulighetStatus) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggedId) return;

    // Block move if neste_steg is empty (for open stages)
    if (stage !== "Vunnet" && stage !== "Tapt") {
      const deal = salgsmuligheter.find(s => s.id === draggedId);
      if (deal && !deal.neste_steg?.trim()) {
        setMoveBlockedId(draggedId);
        setTimeout(() => setMoveBlockedId(null), 2500);
        setDraggedId(null);
        return;
      }
    }

    if (stage === "Vunnet") { vinnSalgsmulighet(draggedId); }
    else if (stage === "Tapt") { setLossDialog(draggedId); }
    else {
      updateSalgsmuligheter(prev => prev.map(s =>
        s.id === draggedId ? { ...s, status: stage, sist_aktivitet: new Date().toISOString().split("T")[0] } : s
      ));
    }
    setDraggedId(null);
  };

  const addSm = () => {
    const today = new Date().toISOString().split("T")[0];
    const id = generateId("SM", salgsmuligheter);
    const nySm: Salgsmulighet = {
      id, navn: form.navn, selskap_id: form.selskap_id, kontakt_id: form.kontakt_id,
      ansvarlig: "", status: "Møte booket", forventet_mrr: form.forventet_mrr, sla: form.sla,
      oppstartskostnad: form.oppstartskostnad, kontraktslengde_mnd: form.kontraktslengde_mnd,
      sannsynlighet: form.sannsynlighet, forventet_lukkedato: form.forventet_lukkedato,
      vunnet_dato: "", tapt_dato: "", tapsaarsak: "", neste_steg: form.neste_steg, notater: "",
      opprettet_dato: today, sist_aktivitet: today,
      kilde: "Direkte salg", partner_id: "", partner_provisjon: 0, partner_kostnad: 0, netto_inntekt: 0,
      rolle_i_firma: form.rolle_i_firma, use_case: form.use_case,
      kontaktperson: form.kontaktperson, e_post: form.e_post, telefon: form.telefon,
    };
    updateSalgsmuligheter(prev => [...prev, nySm]);
    setDialogOpen(false);
    setForm({ navn: "", selskap_id: "", kontakt_id: "", forventet_mrr: 0, sla: 0, oppstartskostnad: 0, kontraktslengde_mnd: 12, sannsynlighet: 50, forventet_lukkedato: "", neste_steg: "", rolle_i_firma: "", use_case: "", kontaktperson: "", e_post: "", telefon: "" });
  };

  const now = new Date();
  const thisMonth = (d: string) => { const dt = new Date(d); return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear(); };

  const openDeals = salgsmuligheter.filter(s => openStatuses.includes(s.status));
  const wonThisMonth = salgsmuligheter.filter(s => s.status === "Vunnet" && thisMonth(s.vunnet_dato));
  const lostThisMonth = salgsmuligheter.filter(s => s.status === "Tapt" && thisMonth(s.tapt_dato));
  const allClosed = salgsmuligheter.filter(s => s.status === "Vunnet" || s.status === "Tapt");

  const currentSm = selectedSm ? salgsmuligheter.find(s => s.id === selectedSm.id) || selectedSm : null;

  const nok = (v: number) => v.toLocaleString("no-NO");

  return (
    <PageShell
      title="Salgsmuligheter"
      subtitle={`${openDeals.length} åpne · ${nok(openDeals.reduce((s, d) => s + d.forventet_mrr, 0))} MRR i pipeline`}
      actions={canEdit ? (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />{!isMobile && "Ny mulighet"}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader><DialogTitle>Ny salgsmulighet</DialogTitle><DialogDescription>Fyll inn detaljer for den nye salgsmuligheten.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Navn" value={form.navn} onChange={e => setForm(f => ({ ...f, navn: e.target.value }))} />
              <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={form.selskap_id} onChange={e => setForm(f => ({ ...f, selskap_id: e.target.value }))}>
                <option value="">Velg selskap</option>
                {selskaper.map(s => <option key={s.id} value={s.id}>{s.firmanavn}</option>)}
              </select>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Input type="number" placeholder="Forventet MRR" value={form.forventet_mrr || ""} onChange={e => setForm(f => ({ ...f, forventet_mrr: Number(e.target.value) }))} />
                <Input type="number" placeholder="SLA" value={form.sla || ""} onChange={e => setForm(f => ({ ...f, sla: Number(e.target.value) }))} />
                <Input type="number" placeholder="Oppstartskostnad" value={form.oppstartskostnad || ""} onChange={e => setForm(f => ({ ...f, oppstartskostnad: Number(e.target.value) }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" placeholder="Kontraktslengde (mnd)" value={form.kontraktslengde_mnd || ""} onChange={e => setForm(f => ({ ...f, kontraktslengde_mnd: Number(e.target.value) }))} />
                <Input type="number" placeholder="Sannsynlighet %" value={form.sannsynlighet || ""} onChange={e => setForm(f => ({ ...f, sannsynlighet: Number(e.target.value) }))} />
              </div>
              <Input type="date" placeholder="Forventet lukkedato" value={form.forventet_lukkedato} onChange={e => setForm(f => ({ ...f, forventet_lukkedato: e.target.value }))} />
              <Input placeholder="Neste steg *" value={form.neste_steg} onChange={e => setForm(f => ({ ...f, neste_steg: e.target.value }))} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Kontaktperson" value={form.kontaktperson} onChange={e => setForm(f => ({ ...f, kontaktperson: e.target.value }))} />
                <Input placeholder="E-post" value={form.e_post} onChange={e => setForm(f => ({ ...f, e_post: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Telefon" value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
                <Input placeholder="Rolle i firma" value={form.rolle_i_firma} onChange={e => setForm(f => ({ ...f, rolle_i_firma: e.target.value }))} />
              </div>
              <Input placeholder="Use case" value={form.use_case} onChange={e => setForm(f => ({ ...f, use_case: e.target.value }))} />
              <Button onClick={addSm} className="w-full" disabled={!form.navn || !form.neste_steg}>Opprett</Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : undefined}
    >
      {/* Loss reason dialog */}
      <Dialog open={!!lossDialog} onOpenChange={open => !open && setLossDialog(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader><DialogTitle>Tapsårsak</DialogTitle><DialogDescription>Velg årsaken til at denne dealen ble tapt.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={lossReason} onChange={e => setLossReason(e.target.value as Tapsaarsak)}>
              {tapsaarsaker.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <Button className="w-full" onClick={() => { if (lossDialog) { tapSalgsmulighet(lossDialog, lossReason); setLossDialog(null); } }}>Bekreft tap</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="pipeline">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="pipeline" className="text-xs sm:text-sm">Pipeline</TabsTrigger>
          <TabsTrigger value="won" className="text-xs sm:text-sm">Vunnet ({wonThisMonth.length})</TabsTrigger>
          <TabsTrigger value="lost" className="text-xs sm:text-sm">Tapt ({lostThisMonth.length})</TabsTrigger>
          <TabsTrigger value="all" className="text-xs sm:text-sm">Avsluttede</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          {/* Pipeline summary panel */}
          {(() => {
            const totalPipeline = openDeals.reduce((s, d) => s + beregnTotalKontraktsverdi(d), 0);
            const totalVektet = openDeals.reduce((s, d) => s + beregnVektetPipeline(d), 0);
            const nearClosing = openDeals.filter(d => d.status === "Tilbud sendt" || d.status === "Beslutning");
            const nearClosingValue = nearClosing.reduce((s, d) => s + beregnTotalKontraktsverdi(d), 0);
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-card border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">Total pipeline</p>
                  <p className="text-lg font-bold tracking-tight">{nok(totalPipeline)} kr</p>
                  <p className="text-[11px] text-muted-foreground">{openDeals.length} åpne deals</p>
                </div>
                <div className="bg-card border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">Vektet verdi</p>
                  <p className="text-lg font-bold tracking-tight">{nok(totalVektet)} kr</p>
                  <p className="text-[11px] text-muted-foreground">justert for sannsynlighet</p>
                </div>
                <div className="bg-card border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">Nær closing</p>
                  <p className="text-lg font-bold tracking-tight">{nearClosing.length} deals</p>
                  <p className="text-[11px] text-muted-foreground">{nok(nearClosingValue)} kr i verdi</p>
                </div>
                <div className="bg-card border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">Snitt MRR</p>
                  <p className="text-lg font-bold tracking-tight">{nok(openDeals.length ? Math.round(openDeals.reduce((s, d) => s + d.forventet_mrr, 0) / openDeals.length) : 0)} kr</p>
                  <p className="text-[11px] text-muted-foreground">per deal</p>
                </div>
              </div>
            );
          })()}
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-thin items-start">
            {openStatuses.map(stage => {
              const stageDeals = sortDeals(openDeals.filter(d => d.status === stage));
              const stageMrr = stageDeals.reduce((s, d) => s + d.forventet_mrr, 0);
              return (
                <div key={stage} className={`${isMobile ? "min-w-[260px] w-[260px]" : "min-w-[290px] w-[290px]"} flex-shrink-0 flex flex-col rounded-xl p-2 -m-2 transition-colors ${dragOverStage === stage ? "bg-primary/10 ring-2 ring-primary/30" : ""}`}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverStage(stage); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null); }}
                  onDragEnd={() => { setDragOverStage(null); setDraggedId(null); }}
                  onDrop={e => handleDrop(e, stage)}>
                  <div className="mb-2 flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColors[stage]}`} />
                    <h3 className="font-semibold text-xs sm:text-sm">{stage}</h3>
                    <span className="text-xs text-muted-foreground ml-auto">{stageDeals.length}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3 font-mono">{nok(stageMrr)} MRR</p>
                  <div className="space-y-2 max-h-[calc(75vh-80px)] overflow-y-auto pr-1 scrollbar-thin">
                    {stageDeals.map(deal => {
                      const signal = activitySignal(deal.sist_aktivitet);
                      const missingNeste = !deal.neste_steg?.trim();
                      const isBlocked = moveBlockedId === deal.id;
                      return (
                        <div key={deal.id} draggable onDragStart={e => { setDraggedId(deal.id); e.dataTransfer.effectAllowed = "move"; }}
                          onClick={() => setSelectedSm(deal)}
                          className={`bg-card border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group border-l-[3px] ${signal.border} ${isBlocked ? "ring-2 ring-destructive animate-pulse" : ""}`}>
                          <div className="flex items-start gap-2">
                            {!isMobile && <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
                            <div className="flex-1 min-w-0">
                              {/* Row 1: Company + MRR */}
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-foreground truncate cursor-pointer hover:text-primary hover:underline" onClick={e => { e.stopPropagation(); navigate(`/selskaper/${deal.selskap_id}`); }}>{getSelskapNavn(deal.selskap_id)}</p>
                                <span className="text-xs font-mono font-bold shrink-0">{nok(deal.forventet_mrr)}</span>
                              </div>

                              {/* Row 2: Deal name */}
                              <p className="font-semibold text-sm truncate mt-0.5">{deal.navn}</p>

                              {/* Row 3: Neste steg or warning */}
                              {missingNeste ? (
                                <div className="flex items-center gap-1 mt-1 text-destructive">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span className="text-[10px] font-medium">Neste steg mangler!</span>
                                </div>
                              ) : (
                                <p className="text-[10px] text-muted-foreground mt-1 truncate">→ {deal.neste_steg}</p>
                              )}

                              {/* Row 4: Activity signal + ansvarlig */}
                              <div className="flex items-center justify-between gap-2 mt-1.5">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-2 h-2 rounded-full ${signal.color}`} />
                                  <span className="text-[10px] text-muted-foreground">{signal.label}</span>
                                </div>
                                {deal.ansvarlig && (
                                  <span className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                                    <User className="w-3 h-3 shrink-0" />{deal.ansvarlig}
                                  </span>
                                )}
                              </div>

                              {isBlocked && (
                                <p className="text-[10px] text-destructive mt-1 font-medium">⛔ Fyll inn neste steg før flytting</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {stageDeals.length === 0 && (
                      <div className="border-2 border-dashed rounded-lg p-6 text-center text-xs text-muted-foreground">Dra hit</div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Vunnet / Tapt drop zones */}
            {(["Vunnet", "Tapt"] as const).map(stage => (
              <div key={stage} className={`${isMobile ? "min-w-[160px] w-[160px]" : "min-w-[200px] w-[200px]"} flex-shrink-0 rounded-xl p-2 -m-2 transition-colors ${dragOverStage === stage ? (stage === "Vunnet" ? "bg-success/10 ring-2 ring-success/30" : "bg-destructive/10 ring-2 ring-destructive/30") : ""}`}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverStage(stage); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null); }}
                onDragEnd={() => { setDragOverStage(null); setDraggedId(null); }}
                onDrop={e => handleDrop(e, stage)}>
                <div className="mb-3 flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${statusColors[stage]}`} />
                  <h3 className="font-semibold text-xs sm:text-sm">{stage}</h3>
                </div>
                <div className="border-2 border-dashed rounded-lg p-6 sm:p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  {stage === "Vunnet" ? <Trophy className="w-5 h-5 text-success" /> : <XCircle className="w-5 h-5 text-destructive" />}
                  Dra deal hit
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="won">
          <DealList deals={wonThisMonth} getSelskapNavn={getSelskapNavn} onSelect={setSelectedSm} label="Vunnet denne måneden" onNavigateSelskap={id => navigate(`/selskaper/${id}`)} isMobile={isMobile} />
        </TabsContent>
        <TabsContent value="lost">
          <DealList deals={lostThisMonth} getSelskapNavn={getSelskapNavn} onSelect={setSelectedSm} label="Tapt denne måneden" onNavigateSelskap={id => navigate(`/selskaper/${id}`)} isMobile={isMobile} />
        </TabsContent>
        <TabsContent value="all">
          <DealList deals={allClosed} getSelskapNavn={getSelskapNavn} onSelect={setSelectedSm} label="Alle avsluttede salg" onNavigateSelskap={id => navigate(`/selskaper/${id}`)} isMobile={isMobile} />
        </TabsContent>
      </Tabs>

      <DetailPanelShell
        open={!!currentSm}
        onClose={() => setSelectedSm(null)}
        title={currentSm?.navn || ""}
        onTitleChange={canEdit && currentSm ? (value) => {
          const today = new Date().toISOString().split("T")[0];
          updateSalgsmuligheter(prev => prev.map(s => s.id === currentSm.id ? { ...s, navn: value, sist_aktivitet: today } : s));
        } : undefined}
        subtitle={currentSm ? getSelskapNavn(currentSm.selskap_id) : undefined}
        badges={currentSm ? (
          <>
            <Badge variant="secondary" className="text-xs">{currentSm.status}</Badge>
            {currentSm.sannsynlighet != null && <Badge variant="outline" className="text-xs">{currentSm.sannsynlighet}%</Badge>}
            {(() => {
              const sig = activitySignal(currentSm.sist_aktivitet);
              return <Badge className={`text-[10px] gap-1 ${sig.color === "bg-destructive" ? "bg-destructive/10 text-destructive" : sig.color === "bg-warning" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                <Clock className="w-3 h-3" />{sig.label}
              </Badge>;
            })()}
          </>
        ) : undefined}
        actions={canEdit && currentSm && openStatuses.includes(currentSm.status as any) ? (
          <>
            <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => { vinnSalgsmulighet(currentSm.id); setSelectedSm(null); }}>
              <Trophy className="w-3.5 h-3.5 mr-1.5" />Vunnet
            </Button>
            <Button size="sm" variant="destructive" onClick={() => { setSelectedSm(null); setLossDialog(currentSm.id); }}>
              <XCircle className="w-3.5 h-3.5 mr-1.5" />Tapt
            </Button>
          </>
        ) : undefined}
        tabContent={currentSm ? (() => {
          const updateField = (field: string, value: any) => {
            const today = new Date().toISOString().split("T")[0];
            updateSalgsmuligheter(prev => prev.map(s =>
              s.id === currentSm.id ? { ...s, [field]: value, sist_aktivitet: today } : s
            ));
          };
          const arr = currentSm.forventet_mrr * 12;
          const slaArr = (currentSm.sla || 0) * 12;
          const totalKontraktsverdi = beregnTotalKontraktsverdi(currentSm);
          const vektetVerdi = beregnVektetPipeline(currentSm);

          return {
            detaljer: (
              <>
                {/* Neste steg – always visible at top */}
                <div className="rounded-lg border p-3 space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Neste steg</label>
                  <Input value={currentSm.neste_steg} onChange={e => updateField("neste_steg", e.target.value)} className={`h-8 text-sm ${!currentSm.neste_steg?.trim() ? "border-destructive ring-1 ring-destructive/30" : ""}`} readOnly={!canEdit} placeholder="Hva er neste steg?" />
                  {!currentSm.neste_steg?.trim() && (
                    <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Obligatorisk</p>
                  )}
                </div>

                {/* Compact key metrics row */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-xs font-bold">{nok(arr)}</p>
                    <p className="text-[10px] text-muted-foreground">ARR</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-xs font-bold">{nok(slaArr)}</p>
                    <p className="text-[10px] text-muted-foreground">SLA</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-xs font-bold">{nok(totalKontraktsverdi)}</p>
                    <p className="text-[10px] text-muted-foreground">Kontrakt</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-xs font-bold">{nok(vektetVerdi)}</p>
                    <p className="text-[10px] text-muted-foreground">Vektet</p>
                  </div>
                </div>

                {/* Sales details – compact inline grid */}
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Salgsdetaljer</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground text-xs">Selskap</span>
                    <span className="cursor-pointer hover:text-primary hover:underline text-xs font-medium" onClick={() => navigate(`/selskaper/${currentSm.selskap_id}`)}>{getSelskapNavn(currentSm.selskap_id)}</span>
                  </div>
                  <DetailField label="Status">
                    <select className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background"
                      value={currentSm.status}
                      disabled={!canEdit}
                      onChange={e => {
                        const newStatus = e.target.value as SalgsmulighetStatus;
                        if (newStatus === "Vunnet") { vinnSalgsmulighet(currentSm.id); setSelectedSm(null); }
                        else if (newStatus === "Tapt") { setSelectedSm(null); setLossDialog(currentSm.id); }
                        else updateField("status", newStatus);
                      }}>
                      {[...openStatuses, "Vunnet", "Tapt"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </DetailField>
                  <div className="grid grid-cols-2 gap-2">
                    <DetailField label="MRR">
                      <Input type="number" value={currentSm.forventet_mrr || ""} onChange={e => updateField("forventet_mrr", Number(e.target.value))} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                    <DetailField label="SLA">
                      <Input type="number" value={currentSm.sla || ""} onChange={e => updateField("sla", Number(e.target.value))} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                    <DetailField label="Oppstart">
                      <Input type="number" value={currentSm.oppstartskostnad || ""} onChange={e => updateField("oppstartskostnad", Number(e.target.value))} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                    <DetailField label="Mnd">
                      <Input type="number" value={currentSm.kontraktslengde_mnd || ""} onChange={e => updateField("kontraktslengde_mnd", Number(e.target.value))} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                    <DetailField label="Sannsynlighet">
                      <Input type="number" min={0} max={100} value={currentSm.sannsynlighet || ""} onChange={e => updateField("sannsynlighet", Number(e.target.value))} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                    <DetailField label="Lukkedato">
                      <Input type="date" value={currentSm.forventet_lukkedato} onChange={e => updateField("forventet_lukkedato", e.target.value)} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                  </div>
                  <DetailField label="Use case">
                    <Input value={currentSm.use_case} onChange={e => updateField("use_case", e.target.value)} className="h-7 text-xs" readOnly={!canEdit} />
                  </DetailField>
                </div>

                {/* Kontakt – compact */}
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Kontakt</p>
                  <div className="grid grid-cols-2 gap-2">
                    <DetailField label="Kontaktperson">
                      <Input value={currentSm.kontaktperson} onChange={e => updateField("kontaktperson", e.target.value)} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                    <DetailField label="Rolle">
                      <Input value={currentSm.rolle_i_firma} onChange={e => updateField("rolle_i_firma", e.target.value)} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                    <DetailField label="E-post">
                      <Input value={currentSm.e_post} onChange={e => updateField("e_post", e.target.value)} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                    <DetailField label="Telefon">
                      <Input value={currentSm.telefon} onChange={e => updateField("telefon", e.target.value)} className="h-7 text-xs" readOnly={!canEdit} />
                    </DetailField>
                  </div>
                  {canEdit && (
                    <EntityLinkPicker
                      options={(() => {
                        const sameCompany = kontakter
                          .filter(k => currentSm.selskap_id && k.selskap_id === currentSm.selskap_id)
                          .map(k => ({ id: k.id, label: k.navn, sublabel: k.e_post || k.rolle || undefined }));
                        const others = kontakter
                          .filter(k => !currentSm.selskap_id || k.selskap_id !== currentSm.selskap_id)
                          .map(k => ({ id: k.id, label: k.navn, sublabel: k.e_post || k.rolle || undefined }));
                        return [...sameCompany, ...others];
                      })()}
                      value={currentSm.kontakt_id || null}
                      onChange={(id) => {
                        if (id) {
                          const kontakt = kontakter.find(k => k.id === id);
                          if (kontakt) {
                            updateField("kontakt_id", kontakt.id);
                            updateField("kontaktperson", kontakt.navn);
                            updateField("e_post", kontakt.e_post);
                            updateField("telefon", kontakt.telefon);
                            updateField("rolle_i_firma", kontakt.rolle);
                          }
                        } else {
                          updateField("kontakt_id", "");
                        }
                      }}
                      placeholder="Koble til kontakt..."
                    />
                  )}
                </div>

                {currentSm.status === "Tapt" && currentSm.tapsaarsak && (
                  <div className="p-2 bg-destructive/10 rounded-lg text-destructive text-xs">
                    <strong>Tapsårsak:</strong> {currentSm.tapsaarsak} · {currentSm.tapt_dato}
                  </div>
                )}
                {currentSm.status === "Vunnet" && (
                  <div className="p-2 bg-success/10 rounded-lg text-success text-xs">
                    <strong>Vunnet:</strong> {currentSm.vunnet_dato}
                  </div>
                )}

                {canEdit && (
                  <Button size="sm" variant="ghost" className="w-full text-destructive hover:bg-destructive/10 text-xs" onClick={() => {
                    updateSalgsmuligheter(prev => prev.filter(s => s.id !== currentSm.id));
                    setSelectedSm(null);
                  }}>
                    <Trash2 className="w-3 h-3 mr-1" />Slett
                  </Button>
                )}
              </>
            ),
            interaksjoner: (
              <>
                <InlineTaskForm salgsmulighet_id={currentSm.id} selskap_id={currentSm.selskap_id} />
                <ActivityLog salgsmulighet_id={currentSm.id} onActivityLogged={() => {
                  updateSalgsmuligheter(prev => prev.map(s => s.id === currentSm.id ? { ...s, sist_aktivitet: new Date().toISOString().split("T")[0] } : s));
                }} />
              </>
            ),
            notater: (
              <DetailField label="Notater">
                <Textarea value={currentSm.notater} onChange={e => updateField("notater", e.target.value)} rows={6} readOnly={!canEdit} />
              </DetailField>
            ),
          };
        })() : undefined}
      />
    </PageShell>
  );
}

function DealList({ deals, getSelskapNavn, onSelect, label, onNavigateSelskap, isMobile }: { deals: Salgsmulighet[]; getSelskapNavn: (id: string) => string; onSelect: (s: Salgsmulighet) => void; label: string; onNavigateSelskap?: (id: string) => void; isMobile: boolean }) {
  if (deals.length === 0) return <div className="text-center py-12 text-muted-foreground text-sm">{label}: ingen</div>;

  if (isMobile) {
    return (
      <div className="space-y-3">
        {deals.map(d => (
          <div key={d.id} className="bg-card border rounded-xl p-4 space-y-1" onClick={() => onSelect(d)}>
            <p className="font-semibold text-sm truncate">{d.kontaktperson || "–"}</p>
            {d.use_case && <p className="text-xs text-muted-foreground">{d.use_case}</p>}
            <p className="text-xs text-muted-foreground cursor-pointer" onClick={e => { e.stopPropagation(); onNavigateSelskap?.(d.selskap_id); }}>{getSelskapNavn(d.selskap_id)}</p>
            {d.oppstartskostnad > 0 && <p className="text-xs font-mono">{d.oppstartskostnad.toLocaleString("no-NO")} oppstart</p>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-3 font-medium">Kontaktperson</th>
            <th className="text-left px-4 py-3 font-medium">Use case</th>
            <th className="text-left px-4 py-3 font-medium">Selskap</th>
            <th className="text-right px-4 py-3 font-medium">Oppstartskostnad</th>
          </tr>
        </thead>
        <tbody>
          {deals.map(d => (
            <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => onSelect(d)}>
              <td className="px-4 py-3 font-medium">{d.kontaktperson || "–"}</td>
              <td className="px-4 py-3 text-muted-foreground">{d.use_case || "–"}</td>
              <td className="px-4 py-3 text-muted-foreground"><span className="cursor-pointer hover:text-primary hover:underline" onClick={e => { e.stopPropagation(); onNavigateSelskap?.(d.selskap_id); }}>{getSelskapNavn(d.selskap_id)}</span></td>
              <td className="px-4 py-3 text-right font-mono">{d.oppstartskostnad ? d.oppstartskostnad.toLocaleString("no-NO") : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
