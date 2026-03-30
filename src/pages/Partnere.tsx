import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import DetailPanelShell, { DetailSection, DetailField, DetailDivider } from "@/components/DetailPanelShell";
import { Plus, Search, Trash2, Users, DollarSign, BarChart3, Percent } from "lucide-react";
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
  const { canEdit } = useAuth();
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
    const nyPartner: Partner = {
      id, partnernavn: form.partnernavn || "", partnertype: form.partnertype as Partnertype || "Salgspartner",
      kontaktperson: form.kontaktperson || "", e_post: form.e_post || "", telefon: form.telefon || "",
      partnerstatus: form.partnerstatus as Partnerstatus || "Under onboarding",
      pipeline_status: "Ny partnermulighet", ansvarlig: form.ansvarlig || "",
      provisjonsprosent: 0, provisjonstype: "", selskap_id: form.selskap_id || "",
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
      actions={canEdit ? (
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
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Koble til selskap</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={form.selskap_id || ""} onChange={e => setForm(f => ({ ...f, selskap_id: e.target.value }))}>
                  <option value="">Ingen selskap</option>
                  {selskaper.map(s => <option key={s.id} value={s.id}>{s.firmanavn}</option>)}
                </select>
              </div>
              <Textarea placeholder="Notater" value={form.notater} onChange={e => setForm(f => ({ ...f, notater: e.target.value }))} />
              <Button onClick={addPartner} className="w-full" disabled={!form.partnernavn}>Opprett partner</Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : undefined}
    >
      {/* ─── KPI ─── */}
      {(() => {
        const nok = (n: number) => n.toLocaleString("nb-NO", { maximumFractionDigits: 0 }) + " NOK";
        const totalPartnere = partnere.length;
        const aktivePartnere = partnere.filter(p => p.partnerstatus === "Aktiv").length;
        const partnerKunder = selskaper.filter(s => s.partner_id && partnere.some(p => p.id === s.partner_id) && s.kundestatus === "Live");
        const partnerMRR = partnerKunder.reduce((sum, s) => sum + s.mrr, 0);
        const partnerARR = partnerMRR * 12;
        const totalLiveMRR = selskaper.filter(s => s.kundestatus === "Live").reduce((sum, s) => sum + s.mrr, 0);
        const andelMRR = totalLiveMRR > 0 ? ((partnerMRR / totalLiveMRR) * 100).toFixed(1) : "0.0";
        const kpis = [
          { label: "Partnere", value: `${totalPartnere}`, icon: <Users className="w-4 h-4" />, sub: `${aktivePartnere} aktive` },
          { label: "MRR fra partnere", value: nok(partnerMRR), icon: <DollarSign className="w-4 h-4" /> },
          { label: "ARR fra partnere", value: nok(partnerARR), icon: <BarChart3 className="w-4 h-4" /> },
          { label: "Kunder via partner", value: `${partnerKunder.length}`, icon: <Users className="w-4 h-4" /> },
          { label: "Andel av MRR", value: `${andelMRR}%`, icon: <Percent className="w-4 h-4" /> },
        ];
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
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
                <th className="text-left px-4 py-3 font-medium">Selskap</th>
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
                    <td className="px-4 py-3">{(() => {
                      const selskap = selskaper.find(s => s.id === partner.selskap_id);
                      return selskap ? (
                        <button className="text-primary hover:underline text-sm" onClick={e => { e.stopPropagation(); navigate(`/selskaper/${selskap.id}`); }}>{selskap.firmanavn}</button>
                      ) : <span className="text-muted-foreground text-xs">—</span>;
                    })()}</td>
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

      <DetailPanelShell
        open={!!currentPartner}
        onClose={() => setSelectedPartner(null)}
        title={currentPartner?.partnernavn || ""}
        subtitle={currentPartner?.kontaktperson || undefined}
        badges={currentPartner ? (
          <>
            <Badge className={`text-xs ${statusColors[currentPartner.partnerstatus]}`}>{currentPartner.partnerstatus}</Badge>
            <Badge variant="secondary" className="text-xs">{currentPartner.partnertype}</Badge>
          </>
        ) : undefined}
        tabContent={currentPartner ? (() => {
          const updateField = (field: string, value: any) => {
            const today = new Date().toISOString().split("T")[0];
            updatePartnere(prev => prev.map(p =>
              p.id === currentPartner.id ? { ...p, [field]: value, sist_aktivitet: today } : p
            ));
          };
          return {
            detaljer: (
              <div className="space-y-3">
                {/* Compact key metrics */}
                {(() => {
                  const stats = getPartnerStats(currentPartner.id);
                  return (
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Kunder", value: stats.antallKunder },
                        { label: "MRR", value: stats.totalMrr.toLocaleString("no-NO") },
                        { label: "ARR", value: stats.totalArr.toLocaleString("no-NO") },
                        { label: "Avtaler", value: stats.antallAktiveAvtaler },
                      ].map(m => (
                        <div key={m.label} className="rounded-lg bg-muted/40 p-2 text-center">
                          <div className="text-sm font-semibold">{m.value}</div>
                          <div className="text-[10px] text-muted-foreground">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Partner details – compact grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-xs"><span className="text-muted-foreground">Partnernavn</span>
                    <Input value={currentPartner.partnernavn} onChange={e => updateField("partnernavn", e.target.value)} className="h-7 text-xs mt-0.5" />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Partnertype</span>
                    <select className="w-full border rounded px-2 py-1 text-xs bg-background h-7 mt-0.5" value={currentPartner.partnertype} onChange={e => updateField("partnertype", e.target.value)}>
                      {partnertypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Status</span>
                    <select className={`w-full border rounded px-2 py-1 text-xs bg-background h-7 mt-0.5 ${statusColors[currentPartner.partnerstatus]}`} value={currentPartner.partnerstatus} onChange={e => updateField("partnerstatus", e.target.value)}>
                      {partnerstatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Ansvarlig</span>
                    <Input value={currentPartner.ansvarlig} onChange={e => updateField("ansvarlig", e.target.value)} className="h-7 text-xs mt-0.5" />
                  </div>
                </div>

                <div className="border-t" />

                {/* Provisjon – compact */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-xs"><span className="text-muted-foreground">Provisjonstype</span>
                    <select className="w-full border rounded px-2 py-1 text-xs bg-background h-7 mt-0.5" value={currentPartner.provisjonstype} onChange={e => updateField("provisjonstype", e.target.value)}>
                      <option value="">Velg...</option>
                      {provisjonstypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Provisjon %</span>
                    <Input type="number" value={currentPartner.provisjonsprosent || ""} onChange={e => updateField("provisjonsprosent", Number(e.target.value))} className="h-7 text-xs mt-0.5" />
                  </div>
                </div>

                {/* Contact info */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-xs"><span className="text-muted-foreground">Kontaktperson</span>
                    <Input value={currentPartner.kontaktperson} onChange={e => updateField("kontaktperson", e.target.value)} className="h-7 text-xs mt-0.5" />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">E-post</span>
                    <Input value={currentPartner.e_post} onChange={e => updateField("e_post", e.target.value)} className="h-7 text-xs mt-0.5" />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Telefon</span>
                    <Input value={currentPartner.telefon} onChange={e => updateField("telefon", e.target.value)} className="h-7 text-xs mt-0.5" />
                  </div>
                  <div className="text-xs"><span className="text-muted-foreground">Opprettet</span>
                    <div className="h-7 flex items-center text-xs text-muted-foreground mt-0.5">{currentPartner.opprettet_dato || "–"}</div>
                  </div>
                </div>

                <Button size="sm" variant="ghost" className="w-full text-xs text-destructive hover:text-destructive h-8" onClick={() => {
                  updatePartnere(prev => prev.filter(p => p.id !== currentPartner.id));
                  setSelectedPartner(null);
                }}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Slett partner
                </Button>
              </div>
            ),
            notater: (
              <DetailField label="Notater">
                <Textarea value={currentPartner.notater} onChange={e => updateField("notater", e.target.value)} rows={6} />
              </DetailField>
            ),
          };
        })() : undefined}
      />
    </PageShell>
  );
}
