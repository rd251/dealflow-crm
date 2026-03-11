import { useState } from "react";
import { format } from "date-fns";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Plus, Search, Building2, ChevronRight, CalendarIcon, X, Upload, Trash2, ArrowRightLeft, Undo2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import InlineTaskForm from "@/components/InlineTaskForm";
import { Selskap, Kundestatus, OnboardingStatus, Kundetilstand, Kanselleringsaarsak } from "@/data/crm-data";
import { Badge } from "@/components/ui/badge";
import DataImportDialog from "@/components/DataImportDialog";

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

  // Hide selskaper with "Ikke kunde" status unless they have a won salgsmulighet or a project
  const filtered = selskaper.filter(s => {
    if (!s.firmanavn.toLowerCase().includes(search.toLowerCase())) return false;
    if (s.kundestatus === "Ikke kunde") {
      const hasWonSm = salgsmuligheter.some(sm => sm.selskap_id === s.id && sm.status === "Vunnet");
      const hasProject = prosjekter.some(p => p.selskap_id === s.id);
      if (!hasWonSm && !hasProject) return false;
    }
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
      actions={
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
      }
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
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setTransferDialog(s.id)}>
                    <ArrowRightLeft className="w-3 h-3" /> Partner
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteDialog(s.id)}>
                    <Trash2 className="w-3 h-3" /> Slett
                  </Button>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
                </div>
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
                <th className="text-right px-4 py-3 font-medium">Handlinger</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const selskapSm = salgsmuligheter.filter(sm => sm.selskap_id === s.id && sm.status !== "Tapt");
                const totalSla = selskapSm.reduce((sum, sm) => sum + (sm.sla || 0), 0);
                return (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/selskaper/${s.id}`)}>
                  <td className="px-4 py-3 font-medium">{s.firmanavn}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.bransje || "–"}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <select className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${kundestatusColors[s.kundestatus]}`}
                      value={s.kundestatus} onChange={e => changeKundestatus(s.id, e.target.value as Kundestatus)}>
                      {kundestatuser.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <Switch checked={s.live_status} onCheckedChange={v => toggleLive(s.id, v)} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tilstandColors[s.kundetilstand]}`}>{s.kundetilstand}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{s.mrr.toLocaleString("no-NO")}</td>
                  <td className="px-4 py-3 text-right font-mono">{s.arr.toLocaleString("no-NO")}</td>
                  <td className="px-4 py-3 text-right font-mono">{totalSla.toLocaleString("no-NO")}</td>
                  <td className="px-4 py-3 text-right font-mono">{s.oppstartskostnad.toLocaleString("no-NO")}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{s.lukkedato || "–"}</td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Overfør til partner" onClick={() => setTransferDialog(s.id)}>
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Slett" onClick={() => setDeleteDialog(s.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!currentSelskap} onOpenChange={open => !open && setSelected(null)}>
        <SheetContent className="w-full sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
          <SheetHeader><SheetTitle>{currentSelskap?.firmanavn}</SheetTitle></SheetHeader>
          {currentSelskap && (() => {
            const updateField = (field: string, value: any) => {
              const today = new Date().toISOString().split("T")[0];
              updateSelskaper(prev => prev.map(s =>
                s.id === currentSelskap.id ? { ...s, [field]: value, sist_aktivitet: today } : s
              ));
            };

            return (
              <div className="mt-6 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Firmanavn</span>
                    <Input value={currentSelskap.firmanavn} onChange={e => updateField("firmanavn", e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Bransje</span>
                    <Input value={currentSelskap.bransje} onChange={e => updateField("bransje", e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Kundeansvarlig</span>
                    <Input value={currentSelskap.kundeansvarlig} onChange={e => updateField("kundeansvarlig", e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Kundestatus</span>
                    <select className={`w-full border rounded-lg px-3 py-1.5 text-sm bg-background ${kundestatusColors[currentSelskap.kundestatus]}`}
                      value={currentSelskap.kundestatus}
                      onChange={e => {
                        const val = e.target.value as Kundestatus;
                        if (val === "Kansellert") {
                          changeKundestatus(currentSelskap.id, val);
                        } else {
                          updateField("kundestatus", val);
                          if (val === "Live") updateField("live_status", true);
                          else if (val !== "Pilot") updateField("live_status", false);
                        }
                      }}>
                      {kundestatuser.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Live</span>
                    <Switch checked={currentSelskap.live_status} onCheckedChange={v => toggleLive(currentSelskap.id, v)} />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Onboarding</span>
                    <select className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background" value={currentSelskap.onboarding_status}
                      onChange={e => updateField("onboarding_status", e.target.value)}>
                      {(["Ikke startet", "Pågår", "Venter på kunde", "Klar for live", "Ferdig"] as OnboardingStatus[]).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Kundetilstand</span>
                    <select className={`w-full border rounded-lg px-3 py-1.5 text-sm bg-background ${tilstandColors[currentSelskap.kundetilstand]}`}
                      value={currentSelskap.kundetilstand} onChange={e => updateField("kundetilstand", e.target.value)}>
                      {(["Bra", "Usikker", "Risiko"] as Kundetilstand[]).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">MRR</span>
                    <Input type="number" value={currentSelskap.mrr || ""} onChange={e => {
                      const mrr = Number(e.target.value);
                      updateSelskaper(prev => prev.map(s => s.id === currentSelskap.id ? { ...s, mrr, arr: mrr * 12, sist_aktivitet: new Date().toISOString().split("T")[0] } : s));
                    }} className="h-8 text-sm" />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">ARR</span>
                    <span className="text-sm font-mono">{(currentSelskap.mrr * 12).toLocaleString("no-NO")} NOK</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Oppstartskostnad</span>
                    <Input type="number" value={currentSelskap.oppstartskostnad || ""} onChange={e => updateField("oppstartskostnad", Number(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Lukkedato</span>
                    <Input type="date" value={currentSelskap.lukkedato} onChange={e => updateField("lukkedato", e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Go-live dato</span>
                    <Input type="date" value={currentSelskap.go_live_dato} onChange={e => updateField("go_live_dato", e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Neste steg</span>
                  <Input value={currentSelskap.neste_steg} onChange={e => updateField("neste_steg", e.target.value)} className="h-8 text-sm" />
                </div>

                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Notater</span>
                  <Textarea value={currentSelskap.notater} onChange={e => updateField("notater", e.target.value)} rows={3} />
                </div>

                {currentSelskap.kundestatus === "Kansellert" && (
                  <div className="p-3 bg-destructive/10 rounded-lg text-destructive text-xs">
                    <strong>Kansellert:</strong> {currentSelskap.kansellert_dato} – {currentSelskap.kanselleringsaarsak}
                    {currentSelskap.kanselleringsnotat && <p className="mt-1">{currentSelskap.kanselleringsnotat}</p>}
                  </div>
                )}

                <div className="border-t pt-4">
                  <InlineTaskForm selskap_id={currentSelskap.id} />
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
