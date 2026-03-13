import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, GripVertical, Trophy, XCircle, Trash2, Mail, Phone, User, Briefcase } from "lucide-react";
import { Salgsmulighet, SalgsmulighetStatus, Tapsaarsak, beregnTotalKontraktsverdi, beregnVektetPipeline } from "@/data/crm-data";
import InlineTaskForm from "@/components/InlineTaskForm";
import ActivityLog from "@/components/ActivityLog";

const openStatuses: SalgsmulighetStatus[] = ["Ny mulighet", "Møte booket", "Demo gjennomført", "Tilbud sendt", "Forhandling"];
const tapsaarsaker: Tapsaarsak[] = ["Pris", "Ikke riktig timing", "Valgte annen leverandør", "Ikke behov", "Teknisk / integrasjon", "Annet"];

const statusColors: Record<SalgsmulighetStatus, string> = {
  "Ny mulighet": "bg-stage-new-lead",
  "Møte booket": "bg-stage-contacted",
  "Demo gjennomført": "bg-stage-demo",
  "Tilbud sendt": "bg-stage-proposal",
  "Forhandling": "bg-stage-negotiation",
  "Vunnet": "bg-stage-won",
  "Tapt": "bg-stage-lost",
};

export default function Salgsmuligheter() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { salgsmuligheter, selskaper, kontakter, updateSalgsmuligheter, updateKontakter, vinnSalgsmulighet, tapSalgsmulighet, generateId } = useCrmStore();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [selectedSm, setSelectedSm] = useState<Salgsmulighet | null>(null);
  const [lossDialog, setLossDialog] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState<Tapsaarsak>("Pris");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ navn: "", selskap_id: "", kontakt_id: "", forventet_mrr: 0, sla: 0, oppstartskostnad: 0, kontraktslengde_mnd: 12, sannsynlighet: 50, forventet_lukkedato: "", neste_steg: "", rolle_i_firma: "", use_case: "", kontaktperson: "", e_post: "", telefon: "" });

  const getSelskapNavn = (id: string) => selskaper.find(s => s.id === id)?.firmanavn || "–";

  const handleDrop = (e: React.DragEvent, stage: SalgsmulighetStatus) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggedId) return;
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
      ansvarlig: "", status: "Ny mulighet", forventet_mrr: form.forventet_mrr, sla: form.sla,
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

  return (
    <PageShell
      title="Salgsmuligheter"
      subtitle={`${openDeals.length} åpne muligheter`}
      actions={
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
              <Input placeholder="Neste steg" value={form.neste_steg} onChange={e => setForm(f => ({ ...f, neste_steg: e.target.value }))} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Kontaktperson" value={form.kontaktperson} onChange={e => setForm(f => ({ ...f, kontaktperson: e.target.value }))} />
                <Input placeholder="E-post" value={form.e_post} onChange={e => setForm(f => ({ ...f, e_post: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Telefon" value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
                <Input placeholder="Rolle i firma" value={form.rolle_i_firma} onChange={e => setForm(f => ({ ...f, rolle_i_firma: e.target.value }))} />
              </div>
              <Input placeholder="Use case" value={form.use_case} onChange={e => setForm(f => ({ ...f, use_case: e.target.value }))} />
              <Button onClick={addSm} className="w-full" disabled={!form.navn || !form.selskap_id}>Opprett</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
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
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-thin items-start">
            {openStatuses.map(stage => {
              const stageDeals = openDeals.filter(d => d.status === stage);
              const stageValue = stageDeals.reduce((s, d) => s + beregnTotalKontraktsverdi(d), 0);
              return (
                <div key={stage} className={`${isMobile ? "min-w-[240px] w-[240px]" : "min-w-[280px] w-[280px]"} flex-shrink-0 flex flex-col rounded-xl p-2 -m-2 transition-colors ${dragOverStage === stage ? "bg-primary/10 ring-2 ring-primary/30" : ""}`}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverStage(stage); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null); }}
                  onDragEnd={() => { setDragOverStage(null); setDraggedId(null); }}
                  onDrop={e => handleDrop(e, stage)}>
                  <div className="mb-3 flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColors[stage]}`} />
                    <h3 className="font-semibold text-xs sm:text-sm">{stage}</h3>
                    <span className="text-xs text-muted-foreground ml-auto">{stageDeals.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 font-mono">{stageValue.toLocaleString("no-NO")} NOK</p>
                  <div className="space-y-2.5 max-h-[calc(75vh-80px)] overflow-y-auto pr-1 scrollbar-thin">
                    {stageDeals.map(deal => (
                      <div key={deal.id} draggable onDragStart={e => { setDraggedId(deal.id); e.dataTransfer.effectAllowed = "move"; }}
                        onClick={() => setSelectedSm(deal)}
                        className="bg-card border rounded-lg p-3 sm:p-3.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group">
                        <div className="flex items-start gap-2">
                          {!isMobile && <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{deal.navn}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate cursor-pointer hover:text-primary hover:underline" onClick={e => { e.stopPropagation(); navigate(`/selskaper/${deal.selskap_id}`); }}>{getSelskapNavn(deal.selskap_id)}</p>
                            {(() => {
                              const contactName = deal.kontaktperson || kontakter.find(k => k.id === deal.kontakt_id)?.navn;
                              const contactPhone = deal.telefon || kontakter.find(k => k.id === deal.kontakt_id)?.telefon;
                              return contactName ? (
                                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                                  <span className="flex items-center gap-1 truncate"><User className="w-3 h-3 shrink-0" />{contactName}</span>
                                  {contactPhone && <span className="flex items-center gap-1 shrink-0"><Phone className="w-3 h-3" />{contactPhone}</span>}
                                </div>
                              ) : null;
                            })()}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-xs font-mono font-semibold">{deal.forventet_mrr.toLocaleString("no-NO")} MRR</span>
                              {(deal.sla || 0) > 0 && <span className="text-[10px] text-muted-foreground">SLA: {deal.sla.toLocaleString("no-NO")}</span>}
                              <span className="text-[10px] text-muted-foreground">{deal.sannsynlighet}%</span>
                            </div>
                            {deal.neste_steg && <p className="text-[10px] text-muted-foreground mt-1 truncate">→ {deal.neste_steg}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
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

      {/* Detail drawer */}
      <Sheet open={!!currentSm} onOpenChange={open => !open && setSelectedSm(null)}>
        <SheetContent className="w-full sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
          <SheetHeader><SheetTitle>{currentSm?.navn}</SheetTitle></SheetHeader>
          {currentSm && (() => {
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

            return (
              <div className="mt-6 space-y-4 text-sm">
                <Field label="Selskap" value={<span className="cursor-pointer hover:text-primary hover:underline" onClick={() => navigate(`/selskaper/${currentSm.selskap_id}`)}>{getSelskapNavn(currentSm.selskap_id)}</span>} />

                {/* Kontaktinformasjon */}
                <div className="space-y-2">
                  <span className="text-muted-foreground block text-xs font-medium uppercase tracking-wide">Kontaktinformasjon</span>
                  <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1 flex items-center gap-1"><User className="w-3 h-3" />Kontaktperson</span>
                        <Input value={currentSm.kontaktperson} onChange={e => updateField("kontaktperson", e.target.value)} className="h-8 text-sm" placeholder="Navn" />
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1 flex items-center gap-1"><Briefcase className="w-3 h-3" />Rolle</span>
                        <Input value={currentSm.rolle_i_firma} onChange={e => updateField("rolle_i_firma", e.target.value)} className="h-8 text-sm" placeholder="Rolle" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1 flex items-center gap-1"><Mail className="w-3 h-3" />E-post</span>
                        <Input value={currentSm.e_post} onChange={e => updateField("e_post", e.target.value)} className="h-8 text-sm" placeholder="E-post" />
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1 flex items-center gap-1"><Phone className="w-3 h-3" />Telefon</span>
                        <Input value={currentSm.telefon} onChange={e => updateField("telefon", e.target.value)} className="h-8 text-sm" placeholder="Telefon" />
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs mb-1">Koble til kontakt</span>
                      <select className="w-full border rounded-lg px-3 py-1.5 text-xs bg-background"
                        value={currentSm.kontakt_id}
                        onChange={e => {
                          const kontakt = kontakter.find(k => k.id === e.target.value);
                          if (kontakt) {
                            updateField("kontakt_id", kontakt.id);
                            updateField("kontaktperson", kontakt.navn);
                            updateField("e_post", kontakt.e_post);
                            updateField("telefon", kontakt.telefon);
                            updateField("rolle_i_firma", kontakt.rolle);
                          } else {
                            updateField("kontakt_id", "");
                          }
                        }}>
                        <option value="">Ingen koblet kontakt</option>
                        {kontakter.map(k => <option key={k.id} value={k.id}>{k.navn}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Status</span>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                    value={currentSm.status}
                    onChange={e => {
                      const newStatus = e.target.value as SalgsmulighetStatus;
                      if (newStatus === "Vunnet") { vinnSalgsmulighet(currentSm.id); setSelectedSm(null); }
                      else if (newStatus === "Tapt") { setSelectedSm(null); setLossDialog(currentSm.id); }
                      else updateField("status", newStatus);
                    }}>
                    {[...openStatuses, "Vunnet", "Tapt"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Editable number fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Forventet MRR</span>
                    <Input type="number" value={currentSm.forventet_mrr || ""} onChange={e => updateField("forventet_mrr", Number(e.target.value))} />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">SLA</span>
                    <Input type="number" value={currentSm.sla || ""} onChange={e => updateField("sla", Number(e.target.value))} />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Oppstartskostnad</span>
                    <Input type="number" value={currentSm.oppstartskostnad || ""} onChange={e => updateField("oppstartskostnad", Number(e.target.value))} />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Kontraktslengde (mnd)</span>
                    <Input type="number" value={currentSm.kontraktslengde_mnd || ""} onChange={e => updateField("kontraktslengde_mnd", Number(e.target.value))} />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Sannsynlighet %</span>
                    <Input type="number" min={0} max={100} value={currentSm.sannsynlighet || ""} onChange={e => updateField("sannsynlighet", Number(e.target.value))} />
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Forventet lukkedato</span>
                  <Input type="date" value={currentSm.forventet_lukkedato} onChange={e => updateField("forventet_lukkedato", e.target.value)} />
                </div>

                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Use case</span>
                  <Input value={currentSm.use_case} onChange={e => updateField("use_case", e.target.value)} className="h-8 text-sm" />
                </div>

                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Neste steg</span>
                  <Input value={currentSm.neste_steg} onChange={e => updateField("neste_steg", e.target.value)} />
                </div>

                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Notater</span>
                  <Textarea value={currentSm.notater} onChange={e => updateField("notater", e.target.value)} rows={3} />
                </div>

                {/* Calculated fields */}
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Beregnede verdier</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Field label="ARR" value={`${arr.toLocaleString("no-NO")} NOK`} />
                    <Field label="SLA (årlig)" value={`${slaArr.toLocaleString("no-NO")} NOK`} />
                    <Field label="Total kontraktsverdi" value={`${totalKontraktsverdi.toLocaleString("no-NO")} NOK`} />
                    <Field label="Vektet pipelineverdi" value={`${vektetVerdi.toLocaleString("no-NO")} NOK`} />
                  </div>
                </div>

                {currentSm.status === "Tapt" && currentSm.tapsaarsak && (
                  <div className="p-3 bg-destructive/10 rounded-lg text-destructive text-xs">
                    <strong>Tapsårsak:</strong> {currentSm.tapsaarsak} · {currentSm.tapt_dato}
                  </div>
                )}
                {currentSm.status === "Vunnet" && (
                  <div className="p-3 bg-success/10 rounded-lg text-success text-xs">
                    <strong>Vunnet:</strong> {currentSm.vunnet_dato}
                  </div>
                )}
                <div className="border-t pt-4">
                  <InlineTaskForm salgsmulighet_id={currentSm.id} selskap_id={currentSm.selskap_id} />
                </div>

                <ActivityLog salgsmulighet_id={currentSm.id} onActivityLogged={() => {
                  updateSalgsmuligheter(prev => prev.map(s => s.id === currentSm.id ? { ...s, sist_aktivitet: new Date().toISOString().split("T")[0] } : s));
                }} />

                <div className="flex gap-2 pt-2 flex-wrap">
                  {openStatuses.includes(currentSm.status as any) && (
                    <>
                      <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => { vinnSalgsmulighet(currentSm.id); setSelectedSm(null); }}>
                        <Trophy className="w-3.5 h-3.5 mr-1" />Vunnet
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => { setSelectedSm(null); setLossDialog(currentSm.id); }}>
                        <XCircle className="w-3.5 h-3.5 mr-1" />Tapt
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 ml-auto" onClick={() => {
                    updateSalgsmuligheter(prev => prev.filter(s => s.id !== currentSm.id));
                    setSelectedSm(null);
                  }}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />Slett
                  </Button>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}

function Field({ label, value, badge }: { label: string; value: React.ReactNode; badge?: string }) {
  return (
    <div>
      <span className="text-muted-foreground block text-xs">{label}</span>
      {badge ? <span className={`inline-block mt-0.5 w-2 h-2 rounded-full ${badge} mr-1.5`} /> : null}
      <span className="text-sm">{value}</span>
    </div>
  );
}

function DealList({ deals, getSelskapNavn, onSelect, label, onNavigateSelskap, isMobile }: { deals: Salgsmulighet[]; getSelskapNavn: (id: string) => string; onSelect: (s: Salgsmulighet) => void; label: string; onNavigateSelskap?: (id: string) => void; isMobile: boolean }) {
  if (deals.length === 0) return <div className="text-center py-12 text-muted-foreground text-sm">{label}: ingen</div>;

  if (isMobile) {
    return (
      <div className="space-y-3">
        {deals.map(d => (
          <div key={d.id} className="bg-card border rounded-xl p-4 space-y-1" onClick={() => onSelect(d)}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm truncate">{d.navn}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${d.status === "Vunnet" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{d.status}</span>
            </div>
            <p className="text-xs text-muted-foreground" onClick={e => { e.stopPropagation(); onNavigateSelskap?.(d.selskap_id); }}>{getSelskapNavn(d.selskap_id)}</p>
            <p className="text-xs font-mono">{d.forventet_mrr.toLocaleString("no-NO")} MRR</p>
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
            <th className="text-left px-4 py-3 font-medium">Navn</th>
            <th className="text-left px-4 py-3 font-medium">Selskap</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="text-right px-4 py-3 font-medium">MRR</th>
          </tr>
        </thead>
        <tbody>
          {deals.map(d => (
            <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => onSelect(d)}>
              <td className="px-4 py-3 font-medium">{d.navn}</td>
              <td className="px-4 py-3 text-muted-foreground"><span className="cursor-pointer hover:text-primary hover:underline" onClick={e => { e.stopPropagation(); onNavigateSelskap?.(d.selskap_id); }}>{getSelskapNavn(d.selskap_id)}</span></td>
              <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.status === "Vunnet" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{d.status}</span></td>
              <td className="px-4 py-3 text-right font-mono">{d.forventet_mrr.toLocaleString("no-NO")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
