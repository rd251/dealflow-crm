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
import { Plus, Search, Trash2 } from "lucide-react";
import { Partner, Partnertype, Partnerstatus, Provisjonstype, beregnTotalKontraktsverdi } from "@/data/crm-data";
import { Badge } from "@/components/ui/badge";
import LastActivityBadge from "@/components/LastActivityBadge";

const partnertypeOptions: Partnertype[] = ["Provisjonspartner", "Integrasjonspartner", "Salgspartner", "Strategisk partner"];
const partnerstatusOptions: Partnerstatus[] = ["Aktiv", "Under onboarding", "Inaktiv"];
const provisjonstypeOptions: Provisjonstype[] = ["Engangsprovisjon", "Løpende provisjon", "Hybrid"];

const statusColors: Record<Partnerstatus, string> = {
  "Aktiv": "bg-success/10 text-success",
  "Under onboarding": "bg-warning/10 text-warning",
  "Inaktiv": "bg-muted text-muted-foreground",
};

export default function Partnere() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { partnere, updatePartnere, selskaper, salgsmuligheter, generateId } = useCrmStore();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [form, setForm] = useState<Partial<Partner>>({
    partnernavn: "", partnertype: "Salgspartner", kontaktperson: "", e_post: "", telefon: "",
    partnerstatus: "Under onboarding", ansvarlig: "", notater: "",
  });

  const filtered = partnere.filter(p =>
    p.partnernavn.toLowerCase().includes(search.toLowerCase()) ||
    p.kontaktperson.toLowerCase().includes(search.toLowerCase())
  );

  const getPartnerStats = (partnerId: string) => {
    const kunder = selskaper.filter(s => s.partner_id === partnerId && s.kundestatus === "Live");
    const alleKunder = selskaper.filter(s => s.partner_id === partnerId);
    const avtaler = salgsmuligheter.filter(s => s.partner_id === partnerId);
    const aktiveAvtaler = avtaler.filter(a => a.status !== "Tapt");
    const totalMrr = kunder.reduce((sum, s) => sum + s.mrr, 0);
    const totalArr = totalMrr * 12;
    return { antallKunder: alleKunder.length, totalMrr, totalArr, antallAktiveAvtaler: aktiveAvtaler.length };
  };

  const addPartner = () => {
    const today = new Date().toISOString().split("T")[0];
    const id = generateId("PA", partnere);
    // Create selskap for partner
    const selskapId = generateId("S", selskaper);
    const nyPartner: Partner = {
      id, partnernavn: form.partnernavn || "", partnertype: form.partnertype as Partnertype || "Salgspartner",
      kontaktperson: form.kontaktperson || "", e_post: form.e_post || "", telefon: form.telefon || "",
      partnerstatus: form.partnerstatus as Partnerstatus || "Under onboarding",
      pipeline_status: "Ny partner", ansvarlig: form.ansvarlig || "",
      provisjonsprosent: 0, provisjonstype: "", selskap_id: selskapId,
      opprettet_dato: today, sist_aktivitet: today, notater: form.notater || "",
    };
    updatePartnere(prev => [...prev, nyPartner]);
    setDialogOpen(false);
    setForm({ partnernavn: "", partnertype: "Salgspartner", kontaktperson: "", e_post: "", telefon: "", partnerstatus: "Under onboarding", ansvarlig: "", notater: "" });
  };

  const currentPartner = selectedPartner ? partnere.find(p => p.id === selectedPartner.id) || selectedPartner : null;

  return (
    <PageShell
      title="Partnere"
      subtitle={`${partnere.filter(p => p.partnerstatus === "Aktiv").length} aktive partnere`}
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />{!isMobile && "Ny partner"}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader><DialogTitle>Ny partner</DialogTitle><DialogDescription>Fyll inn detaljer for den nye partneren.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Partnernavn" value={form.partnernavn} onChange={e => setForm(f => ({ ...f, partnernavn: e.target.value }))} />
              <Input placeholder="Kontaktperson" value={form.kontaktperson} onChange={e => setForm(f => ({ ...f, kontaktperson: e.target.value }))} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="E-post" value={form.e_post} onChange={e => setForm(f => ({ ...f, e_post: e.target.value }))} />
                <Input placeholder="Telefon" value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select className="border rounded-lg px-3 py-2 text-sm bg-background" value={form.partnertype} onChange={e => setForm(f => ({ ...f, partnertype: e.target.value as Partnertype }))}>
                  {partnertypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select className="border rounded-lg px-3 py-2 text-sm bg-background" value={form.partnerstatus} onChange={e => setForm(f => ({ ...f, partnerstatus: e.target.value as Partnerstatus }))}>
                  {partnerstatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <Input placeholder="Ansvarlig" value={form.ansvarlig} onChange={e => setForm(f => ({ ...f, ansvarlig: e.target.value }))} />
              <Textarea placeholder="Notater" value={form.notater} onChange={e => setForm(f => ({ ...f, notater: e.target.value }))} />
              <Button onClick={addPartner} className="w-full" disabled={!form.partnernavn}>Opprett partner</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Søk partnere..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isMobile ? (
        <div className="space-y-3">
          {filtered.map(partner => {
            const stats = getPartnerStats(partner.id);
            return (
              <div key={partner.id} className="bg-card border rounded-xl p-4 space-y-2 cursor-pointer" onClick={() => navigate(`/partnere/${partner.id}`)}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm truncate">{partner.partnernavn}</p>
                  <Badge className={`text-[10px] shrink-0 ${statusColors[partner.partnerstatus]}`}>{partner.partnerstatus}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{partner.kontaktperson}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px]">{partner.partnertype}</Badge>
                  <span>{stats.antallKunder} kunder</span>
                  <span className="font-mono">{stats.totalMrr.toLocaleString("no-NO")} MRR</span>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Ingen partnere å vise</p>}
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Partnernavn</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Kontaktperson</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Kunder</th>
                <th className="text-right px-4 py-3 font-medium">MRR</th>
                <th className="text-right px-4 py-3 font-medium">ARR</th>
                <th className="text-right px-4 py-3 font-medium">Avtaler</th>
                <th className="text-left px-4 py-3 font-medium">Sist aktivitet</th>
                <th className="text-left px-4 py-3 font-medium">Opprettet</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(partner => {
                const stats = getPartnerStats(partner.id);
                return (
                  <tr key={partner.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/partnere/${partner.id}`)}>
                    <td className="px-4 py-3 font-medium">{partner.partnernavn}</td>
                    <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">{partner.partnertype}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{partner.kontaktperson}</td>
                    <td className="px-4 py-3"><Badge className={`text-xs ${statusColors[partner.partnerstatus]}`}>{partner.partnerstatus}</Badge></td>
                    <td className="px-4 py-3 text-right">{stats.antallKunder}</td>
                    <td className="px-4 py-3 text-right font-mono">{stats.totalMrr.toLocaleString("no-NO")}</td>
                    <td className="px-4 py-3 text-right font-mono">{stats.totalArr.toLocaleString("no-NO")}</td>
                    <td className="px-4 py-3 text-right">{stats.antallAktiveAvtaler}</td>
                    <td className="px-4 py-3"><LastActivityBadge partner_id={partner.id} sist_aktivitet={partner.sist_aktivitet} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{partner.opprettet_dato}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Ingen partnere å vise</p>}
        </div>
      )}

      {/* Detail drawer */}
      <Sheet open={!!currentPartner} onOpenChange={open => !open && setSelectedPartner(null)}>
        <SheetContent className="w-full sm:w-[400px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader><SheetTitle>{currentPartner?.partnernavn}</SheetTitle></SheetHeader>
          {currentPartner && (() => {
            const updateField = (field: string, value: any) => {
              const today = new Date().toISOString().split("T")[0];
              updatePartnere(prev => prev.map(p =>
                p.id === currentPartner.id ? { ...p, [field]: value, sist_aktivitet: today } : p
              ));
            };
            return (
              <div className="mt-6 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Partnernavn</span>
                    <Input value={currentPartner.partnernavn} onChange={e => updateField("partnernavn", e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Partnertype</span>
                    <select className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background h-8" value={currentPartner.partnertype} onChange={e => updateField("partnertype", e.target.value)}>
                      {partnertypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Status</span>
                    <select className={`w-full border rounded-lg px-3 py-1.5 text-sm bg-background h-8 ${statusColors[currentPartner.partnerstatus]}`} value={currentPartner.partnerstatus} onChange={e => updateField("partnerstatus", e.target.value)}>
                      {partnerstatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Provisjonstype</span>
                    <select className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background h-8" value={currentPartner.provisjonstype} onChange={e => updateField("provisjonstype", e.target.value)}>
                      <option value="">Velg...</option>
                      {provisjonstypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Provisjon %</span>
                    <Input type="number" value={currentPartner.provisjonsprosent || ""} onChange={e => updateField("provisjonsprosent", Number(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Ansvarlig</span>
                    <Input value={currentPartner.ansvarlig} onChange={e => updateField("ansvarlig", e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Notater</span>
                  <Textarea value={currentPartner.notater} onChange={e => updateField("notater", e.target.value)} rows={3} />
                </div>
                <Button size="sm" variant="destructive" className="w-full" onClick={() => {
                  updatePartnere(prev => prev.filter(p => p.id !== currentPartner.id));
                  setSelectedPartner(null);
                }}>
                  <Trash2 className="w-4 h-4 mr-1" /> Slett partner
                </Button>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
