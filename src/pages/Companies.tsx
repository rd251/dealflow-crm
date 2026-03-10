import { useState } from "react";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Building2 } from "lucide-react";
import InlineTaskForm from "@/components/InlineTaskForm";
import { Selskap, Kundestatus, OnboardingStatus, Kundetilstand, Kanselleringsaarsak } from "@/data/crm-data";
import { Badge } from "@/components/ui/badge";

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
  const { selskaper, updateSelskaper, kansellerSelskap } = useCrmStore();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Selskap | null>(null);
  const [cancelDialog, setCancelDialog] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<Kanselleringsaarsak>("Pris");
  const [cancelNote, setCancelNote] = useState("");
  const [form, setForm] = useState({ firmanavn: "", bransje: "", kundeansvarlig: "" });

  const filtered = selskaper.filter(s => s.firmanavn.toLowerCase().includes(search.toLowerCase()));

  const addSelskap = () => {
    const id = `S-${String(selskaper.length + 1).padStart(4, "0")}`;
    const nyttSelskap: Selskap = {
      id, firmanavn: form.firmanavn, bransje: form.bransje, kundeansvarlig: form.kundeansvarlig,
      kundestatus: "Ikke kunde", live_status: false, onboarding_status: "Ikke startet",
      mrr: 0, arr: 0, oppstartskostnad: 0, go_live_dato: "", kansellert_dato: "",
      kanselleringsaarsak: "", kanselleringsnotat: "", kundetilstand: "Bra",
      sist_aktivitet: new Date().toISOString().split("T")[0], neste_steg: "", notater: "",
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
      subtitle={`${selskaper.length} selskaper · ${selskaper.filter(s => s.kundestatus === "Live").length} live`}
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nytt selskap</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nytt selskap</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Firmanavn" value={form.firmanavn} onChange={e => setForm(f => ({ ...f, firmanavn: e.target.value }))} />
              <Input placeholder="Bransje" value={form.bransje} onChange={e => setForm(f => ({ ...f, bransje: e.target.value }))} />
              <Input placeholder="Kundeansvarlig" value={form.kundeansvarlig} onChange={e => setForm(f => ({ ...f, kundeansvarlig: e.target.value }))} />
              <Button onClick={addSelskap} className="w-full" disabled={!form.firmanavn}>Opprett selskap</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      {/* Cancel dialog */}
      <Dialog open={!!cancelDialog} onOpenChange={open => !open && setCancelDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kanseller kunde</DialogTitle></DialogHeader>
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

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Søk selskaper..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

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
              <th className="text-right px-4 py-3 font-medium">Oppstart</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelected(s)}>
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
                <td className="px-4 py-3 text-right font-mono">{s.oppstartskostnad.toLocaleString("no-NO")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!currentSelskap} onOpenChange={open => !open && setSelected(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader><SheetTitle>{currentSelskap?.firmanavn}</SheetTitle></SheetHeader>
          {currentSelskap && (
            <div className="mt-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground block text-xs">Bransje</span>{currentSelskap.bransje || "–"}</div>
                <div><span className="text-muted-foreground block text-xs">Kundeansvarlig</span>{currentSelskap.kundeansvarlig || "–"}</div>
                <div><span className="text-muted-foreground block text-xs">Kundestatus</span><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${kundestatusColors[currentSelskap.kundestatus]}`}>{currentSelskap.kundestatus}</span></div>
                <div><span className="text-muted-foreground block text-xs">Live</span>{currentSelskap.live_status ? "Ja" : "Nei"}</div>
                <div><span className="text-muted-foreground block text-xs">Onboarding</span>{currentSelskap.onboarding_status}</div>
                <div><span className="text-muted-foreground block text-xs">Kundetilstand</span><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tilstandColors[currentSelskap.kundetilstand]}`}>{currentSelskap.kundetilstand}</span></div>
                <div><span className="text-muted-foreground block text-xs">MRR</span>{currentSelskap.mrr.toLocaleString("no-NO")} NOK</div>
                <div><span className="text-muted-foreground block text-xs">ARR</span>{currentSelskap.arr.toLocaleString("no-NO")} NOK</div>
                <div><span className="text-muted-foreground block text-xs">Oppstartskostnad</span>{currentSelskap.oppstartskostnad.toLocaleString("no-NO")} NOK</div>
                <div><span className="text-muted-foreground block text-xs">Go-live dato</span>{currentSelskap.go_live_dato || "–"}</div>
                <div><span className="text-muted-foreground block text-xs">Neste steg</span>{currentSelskap.neste_steg || "–"}</div>
                <div><span className="text-muted-foreground block text-xs">Sist aktivitet</span>{currentSelskap.sist_aktivitet}</div>
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
          )}
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
