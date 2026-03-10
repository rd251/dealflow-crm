import { useState } from "react";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Search, ArrowRightCircle, Trash2 } from "lucide-react";
import { Lead, LeadStatus, LeadKilde } from "@/data/crm-data";
import { Badge } from "@/components/ui/badge";
import InlineTaskForm from "@/components/InlineTaskForm";

const statusOptions: LeadStatus[] = ["Ny", "Kontaktet", "Kvalifisert", "Ikke aktuelt", "Konvertert til salg"];
const kildeOptions: LeadKilde[] = ["Nettside", "LinkedIn", "Partner", "Referanse", "Kald outbound", "E-post", "Telefon", "Annet"];

const statusColors: Record<LeadStatus, string> = {
  "Ny": "bg-stage-new-lead/10 text-stage-new-lead",
  "Kontaktet": "bg-stage-contacted/10 text-stage-contacted",
  "Kvalifisert": "bg-stage-qualified/10 text-stage-qualified",
  "Ikke aktuelt": "bg-muted text-muted-foreground",
  "Konvertert til salg": "bg-success/10 text-success",
};

export default function Leads() {
  const isMobile = useIsMobile();
  const { leads, updateLeads, konverterLead, generateId } = useCrmStore();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<Partial<Lead>>({ firmanavn: "", kontaktperson: "", e_post: "", telefon: "", kilde: "Nettside", status: "Ny", ansvarlig: "", neste_steg: "", notater: "" });

  const filtered = leads.filter(l =>
    l.firmanavn.toLowerCase().includes(search.toLowerCase()) ||
    l.kontaktperson.toLowerCase().includes(search.toLowerCase())
  );

  const addLead = () => {
    const today = new Date().toISOString().split("T")[0];
    const id = generateId("L", leads);
    const newLead: Lead = {
      id, firmanavn: form.firmanavn || "", kontaktperson: form.kontaktperson || "",
      e_post: form.e_post || "", telefon: form.telefon || "", kilde: form.kilde as LeadKilde || "Annet",
      status: "Ny", ansvarlig: form.ansvarlig || "", neste_steg: form.neste_steg || "",
      notater: form.notater || "", opprettet_dato: today, sist_aktivitet: today, konvertert_dato: "",
    };
    updateLeads(prev => [...prev, newLead]);
    setDialogOpen(false);
    setForm({ firmanavn: "", kontaktperson: "", e_post: "", telefon: "", kilde: "Nettside", status: "Ny", ansvarlig: "", neste_steg: "", notater: "" });
  };

  const changeStatus = (id: string, status: LeadStatus) => {
    updateLeads(prev => prev.map(l => l.id === id ? { ...l, status, sist_aktivitet: new Date().toISOString().split("T")[0] } : l));
  };

  const currentLead = selectedLead ? leads.find(l => l.id === selectedLead.id) || selectedLead : null;

  return (
    <PageShell
      title="Leads"
      subtitle={`${leads.filter(l => l.status !== "Konvertert til salg" && l.status !== "Ikke aktuelt").length} aktive leads`}
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />{!isMobile && "Nytt lead"}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader><DialogTitle>Nytt lead</DialogTitle><DialogDescription>Fyll inn detaljer for det nye leadet.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Firmanavn" value={form.firmanavn} onChange={e => setForm(f => ({ ...f, firmanavn: e.target.value }))} />
              <Input placeholder="Kontaktperson" value={form.kontaktperson} onChange={e => setForm(f => ({ ...f, kontaktperson: e.target.value }))} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="E-post" value={form.e_post} onChange={e => setForm(f => ({ ...f, e_post: e.target.value }))} />
                <Input placeholder="Telefon" value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select className="border rounded-lg px-3 py-2 text-sm bg-background" value={form.kilde} onChange={e => setForm(f => ({ ...f, kilde: e.target.value as LeadKilde }))}>
                  {kildeOptions.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <Input placeholder="Ansvarlig" value={form.ansvarlig} onChange={e => setForm(f => ({ ...f, ansvarlig: e.target.value }))} />
              </div>
              <Input placeholder="Neste steg" value={form.neste_steg} onChange={e => setForm(f => ({ ...f, neste_steg: e.target.value }))} />
              <Textarea placeholder="Notater" value={form.notater} onChange={e => setForm(f => ({ ...f, notater: e.target.value }))} />
              <Button onClick={addLead} className="w-full" disabled={!form.firmanavn}>Opprett lead</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Søk leads..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Mobile: card layout */}
      {isMobile ? (
        <div className="space-y-3">
          {filtered.map(lead => (
            <div key={lead.id} className="bg-card border rounded-xl p-4 space-y-2" onClick={() => setSelectedLead(lead)}>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm truncate">{lead.firmanavn}</p>
                <Badge className={`text-[10px] shrink-0 ${statusColors[lead.status]}`}>{lead.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{lead.kontaktperson}</p>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px]">{lead.kilde}</Badge>
                {lead.neste_steg && <span className="text-[10px] text-muted-foreground truncate ml-2">→ {lead.neste_steg}</span>}
              </div>
              {lead.status !== "Konvertert til salg" && lead.status !== "Ikke aktuelt" && (
                <Button size="sm" variant="ghost" className="text-xs gap-1 w-full mt-1" onClick={e => { e.stopPropagation(); konverterLead(lead.id); }}>
                  <ArrowRightCircle className="w-3.5 h-3.5" />Konverter
                </Button>
              )}
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Ingen leads å vise</p>}
        </div>
      ) : (
        /* Desktop: table layout */
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Firma</th>
                <th className="text-left px-4 py-3 font-medium">Kontaktperson</th>
                <th className="text-left px-4 py-3 font-medium">Kilde</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Neste steg</th>
                <th className="text-left px-4 py-3 font-medium">Opprettet</th>
                <th className="text-right px-4 py-3 font-medium">Handling</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => (
                <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedLead(lead)}>
                  <td className="px-4 py-3 font-medium">{lead.firmanavn}</td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.kontaktperson}</td>
                  <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">{lead.kilde}</Badge></td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <select
                      className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${statusColors[lead.status]}`}
                      value={lead.status}
                      onChange={e => changeStatus(lead.id, e.target.value as LeadStatus)}
                      disabled={lead.status === "Konvertert til salg"}
                    >
                      {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{lead.neste_steg}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{lead.opprettet_dato}</td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    {lead.status !== "Konvertert til salg" && lead.status !== "Ikke aktuelt" && (
                      <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => konverterLead(lead.id)}>
                        <ArrowRightCircle className="w-3.5 h-3.5" />Konverter
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!currentLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <SheetContent className="w-full sm:w-[400px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader><SheetTitle>{currentLead?.firmanavn}</SheetTitle></SheetHeader>
          {currentLead && (() => {
            const updateField = (field: string, value: any) => {
              const today = new Date().toISOString().split("T")[0];
              updateLeads(prev => prev.map(l =>
                l.id === currentLead.id ? { ...l, [field]: value, sist_aktivitet: today } : l
              ));
            };
            return (
            <div className="mt-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Firmanavn</span>
                  <Input value={currentLead.firmanavn} onChange={e => updateField("firmanavn", e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Kontaktperson</span>
                  <Input value={currentLead.kontaktperson} onChange={e => updateField("kontaktperson", e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">E-post</span>
                  <Input value={currentLead.e_post} onChange={e => updateField("e_post", e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Telefon</span>
                  <Input value={currentLead.telefon} onChange={e => updateField("telefon", e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Kilde</span>
                  <select className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background h-8" value={currentLead.kilde}
                    onChange={e => updateField("kilde", e.target.value)}>
                    {kildeOptions.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Status</span>
                  <select className={`w-full border rounded-lg px-3 py-1.5 text-sm bg-background h-8 ${statusColors[currentLead.status]}`}
                    value={currentLead.status}
                    onChange={e => updateField("status", e.target.value)}
                    disabled={currentLead.status === "Konvertert til salg"}>
                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Ansvarlig</span>
                  <Input value={currentLead.ansvarlig} onChange={e => updateField("ansvarlig", e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Opprettet</span>
                  <span className="text-sm font-mono">{currentLead.opprettet_dato}</span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs mb-1">Neste steg</span>
                <Input value={currentLead.neste_steg} onChange={e => updateField("neste_steg", e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <span className="text-muted-foreground block text-xs mb-1">Notater</span>
                <Textarea value={currentLead.notater} onChange={e => updateField("notater", e.target.value)} rows={3} />
              </div>

              <div className="border-t pt-4">
                <InlineTaskForm lead_id={currentLead.id} selskap_id="" />
              </div>

              {currentLead.konvertert_dato && (
                <div className="p-3 bg-success/10 rounded-lg text-success text-xs font-medium">
                  Konvertert {currentLead.konvertert_dato}
                </div>
              )}

              {currentLead.status !== "Konvertert til salg" && currentLead.status !== "Ikke aktuelt" && (
                <Button size="sm" className="w-full" onClick={() => { konverterLead(currentLead.id); setSelectedLead(null); }}>
                  <ArrowRightCircle className="w-4 h-4 mr-1" /> Konverter til salgsmulighet
                </Button>
              )}
              <Button size="sm" variant="destructive" className="w-full" onClick={() => {
                updateLeads(prev => prev.filter(l => l.id !== currentLead.id));
                setSelectedLead(null);
              }}>
                <Trash2 className="w-4 h-4 mr-1" /> Slett lead
              </Button>
            </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
