import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { beregnTotalKontraktsverdi } from "@/data/crm-data";
import StatCard from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Handshake, ArrowLeft, DollarSign, TrendingUp, Users, FileText,
  Mail, Phone, Plus, X,
} from "lucide-react";
import { Partnerstatus, Partnertype, Provisjonstype, Kontakt, PartnerPipelineStatus, Selskap, Salgsmulighet, Kilde } from "@/data/crm-data";
import ActivityLog from "@/components/ActivityLog";

const partnertypeOptions: Partnertype[] = ["Provisjonspartner", "Integrasjonspartner", "Salgspartner", "Strategisk partner"];
const partnerstatusOptions: Partnerstatus[] = ["Aktiv", "Under onboarding", "Inaktiv"];
const provisjonstypeOptions: Provisjonstype[] = ["Engangsprovisjon", "Løpende provisjon", "Hybrid"];
const pipelineOptions: PartnerPipelineStatus[] = ["Ny partner", "Introduksjon", "Demo / gjennomgang", "Avtale", "Aktiv partner"];

const statusColors: Record<Partnerstatus, string> = {
  "Aktiv": "bg-success/10 text-success",
  "Under onboarding": "bg-warning/10 text-warning",
  "Inaktiv": "bg-muted text-muted-foreground",
};

export default function PartnerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    partnere, updatePartnere, selskaper, updateSelskaper, salgsmuligheter, updateSalgsmuligheter,
    kontakter, updateKontakter, generateId,
  } = useCrmStore();

  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ navn: "", rolle: "", e_post: "", telefon: "" });
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({ firmanavn: "", bransje: "" });
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [dealForm, setDealForm] = useState({ navn: "", selskap_id: "", forventet_mrr: 0, oppstartskostnad: 0 });

  const partner = partnere.find(p => p.id === id);
  if (!partner) {
    return (
      <div className={`${isMobile ? "ml-0" : "ml-60"} min-h-screen bg-background flex items-center justify-center`}>
        <div className="text-center">
          <p className="text-muted-foreground">Partner ikke funnet</p>
          <Button variant="ghost" className="mt-2" onClick={() => navigate("/partnere")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Tilbake
          </Button>
        </div>
      </div>
    );
  }

  // Partner customers
  const partnerKunder = selskaper.filter(s => s.partner_id === id);
  const liveKunder = partnerKunder.filter(s => s.kundestatus === "Live");
  const partnerAvtaler = salgsmuligheter.filter(s => s.partner_id === id);
  const aktiveAvtaler = partnerAvtaler.filter(a => a.status !== "Tapt");
  const partnerKontakter = kontakter.filter(k => k.selskap_id === partner.selskap_id);

  // KPIs
  const antallKunder = partnerKunder.length;
  const aktivMrr = liveKunder.reduce((sum, s) => sum + s.mrr, 0);
  const arr = aktivMrr * 12;
  const totalKontraktsverdi = partnerAvtaler.reduce((sum, s) => sum + beregnTotalKontraktsverdi(s), 0);

  const today = new Date().toISOString().split("T")[0];
  const updateField = (field: string, value: any) => {
    updatePartnere(prev => prev.map(p =>
      p.id === id ? { ...p, [field]: value, sist_aktivitet: today } : p
    ));
  };

  const nok = (v: number) => v.toLocaleString("no-NO");

  const addCustomer = () => {
    const selskapId = crypto.randomUUID();
    const nyttSelskap: Selskap = {
      id: selskapId, firmanavn: customerForm.firmanavn, bransje: customerForm.bransje,
      kundeansvarlig: partner.ansvarlig, kundestatus: "Ikke kunde", live_status: false,
      onboarding_status: "Ikke startet", mrr: 0, arr: 0, oppstartskostnad: 0,
      go_live_dato: "", kansellert_dato: "", kanselleringsaarsak: "", kanselleringsnotat: "",
      kundetilstand: "Bra", sist_aktivitet: today, neste_steg: "", notater: "",
      kilde: "Partner", partner_id: id!,  lukkedato: "",
    };
    updateSelskaper(prev => [...prev, nyttSelskap]);
    setCustomerForm({ firmanavn: "", bransje: "" });
    setShowAddCustomer(false);
  };

  const addDeal = () => {
    const smId = crypto.randomUUID();
    const nySm: Salgsmulighet = {
      id: smId, navn: dealForm.navn, selskap_id: dealForm.selskap_id,
      kontakt_id: "", ansvarlig: partner.ansvarlig, status: "Ny mulighet",
      forventet_mrr: dealForm.forventet_mrr, sla: 0, oppstartskostnad: dealForm.oppstartskostnad,
      kontraktslengde_mnd: 12, sannsynlighet: 50, forventet_lukkedato: "",
      vunnet_dato: "", tapt_dato: "", tapsaarsak: "", neste_steg: "", notater: "",
      opprettet_dato: today, sist_aktivitet: today,
      kilde: "Partner", partner_id: id!, partner_provisjon: 0, partner_kostnad: 0, netto_inntekt: 0,
      rolle_i_firma: "", use_case: "", kontaktperson: "", e_post: "", telefon: "",
    };
    updateSalgsmuligheter(prev => [...prev, nySm]);
    setDealForm({ navn: "", selskap_id: "", forventet_mrr: 0, oppstartskostnad: 0 });
    setShowAddDeal(false);
  };

  return (
    <div className={`${isMobile ? "ml-0" : "ml-60"} min-h-screen bg-background transition-all duration-200`}>
      {/* Header */}
      <header className={`sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b ${isMobile ? "px-4 py-4 pl-14" : "px-8 py-5"}`}>
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/partnere")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Partnere
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="p-2 sm:p-3 rounded-xl bg-primary/10 text-primary shrink-0">
              <Handshake className={isMobile ? "w-5 h-5" : "w-6 h-6"} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{partner.partnernavn}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge className={statusColors[partner.partnerstatus]}>{partner.partnerstatus}</Badge>
                <Badge variant="secondary">{partner.partnertype}</Badge>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className={`${isMobile ? "p-4" : "p-8"} space-y-6 sm:space-y-8`}>
        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <StatCard label="Kunder fra partner" value={antallKunder} icon={<Users className="w-5 h-5" />} />
          <StatCard label="Aktiv MRR" value={`${nok(aktivMrr)} kr`} icon={<DollarSign className="w-5 h-5" />} />
          <StatCard label="ARR" value={`${nok(arr)} kr`} icon={<TrendingUp className="w-5 h-5" />} />
          <StatCard label="Total kontrakt" value={`${nok(totalKontraktsverdi)} kr`} icon={<FileText className="w-5 h-5" />} />
          <StatCard label="Aktive avtaler" value={aktiveAvtaler.length} icon={<Handshake className="w-5 h-5" />} />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="kunder">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="kunder" className="text-xs sm:text-sm">Kunder ({partnerKunder.length})</TabsTrigger>
            <TabsTrigger value="kontakter" className="text-xs sm:text-sm">Kontakter ({partnerKontakter.length})</TabsTrigger>
            <TabsTrigger value="info" className="text-xs sm:text-sm">Info</TabsTrigger>
          </TabsList>

          {/* Kunder tab */}
          <TabsContent value="kunder">
            <div className="flex items-center gap-2 mb-4">
              <Button size="sm" variant="outline" onClick={() => setShowAddCustomer(true)}>
                <Plus className="w-4 h-4 mr-1" /> Ny kunde
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddDeal(true)}>
                <Plus className="w-4 h-4 mr-1" /> Ny salgsmulighet
              </Button>
            </div>

            {partnerKunder.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Ingen kunder tilknyttet denne partneren</p>
            ) : isMobile ? (
              <div className="space-y-3">
                {partnerKunder.map(k => (
                  <div key={k.id} className="bg-card border rounded-xl p-4 space-y-1 cursor-pointer" onClick={() => navigate(`/selskaper/${k.id}`)}>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm truncate">{k.firmanavn}</p>
                      <Badge variant="outline" className="text-[10px] shrink-0">{k.kundestatus}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{k.mrr.toLocaleString("no-NO")} MRR</span>
                      {k.lukkedato && <span>Lukket: {k.lukkedato}</span>}
                      {k.go_live_dato && <span>Go-live: {k.go_live_dato}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-card border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-3 font-medium">Kunde</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-right px-4 py-3 font-medium">MRR</th>
                      <th className="text-right px-4 py-3 font-medium">Oppstart</th>
                      <th className="text-right px-4 py-3 font-medium">Kontraktsverdi</th>
                      <th className="text-left px-4 py-3 font-medium">Lukkedato</th>
                      <th className="text-left px-4 py-3 font-medium">Go-live</th>
                      <th className="text-left px-4 py-3 font-medium">Ansvarlig</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partnerKunder.map(k => {
                      const sm = salgsmuligheter.find(s => s.selskap_id === k.id && s.partner_id === id);
                      const kontraktsverdi = sm ? beregnTotalKontraktsverdi(sm) : 0;
                      return (
                        <tr key={k.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/selskaper/${k.id}`)}>
                          <td className="px-4 py-3 font-medium">{k.firmanavn}</td>
                          <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{k.kundestatus}</Badge></td>
                          <td className="px-4 py-3 text-right font-mono">{k.mrr.toLocaleString("no-NO")}</td>
                          <td className="px-4 py-3 text-right font-mono">{k.oppstartskostnad.toLocaleString("no-NO")}</td>
                          <td className="px-4 py-3 text-right font-mono">{kontraktsverdi.toLocaleString("no-NO")}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{k.lukkedato || "–"}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{k.go_live_dato || "–"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{k.kundeansvarlig || "–"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Kontakter tab */}
          <TabsContent value="kontakter">
            <div className="bg-card border rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Kontaktpersoner</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowAddContact(!showAddContact)}>
                  {showAddContact ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
              {showAddContact && (
                <div className="p-3 border border-dashed rounded-lg space-y-2">
                  <Input placeholder="Navn" value={contactForm.navn} onChange={e => setContactForm(f => ({ ...f, navn: e.target.value }))} className="h-8 text-sm" />
                  <Input placeholder="Rolle" value={contactForm.rolle} onChange={e => setContactForm(f => ({ ...f, rolle: e.target.value }))} className="h-8 text-sm" />
                  <Input placeholder="E-post" value={contactForm.e_post} onChange={e => setContactForm(f => ({ ...f, e_post: e.target.value }))} className="h-8 text-sm" />
                  <Input placeholder="Telefon" value={contactForm.telefon} onChange={e => setContactForm(f => ({ ...f, telefon: e.target.value }))} className="h-8 text-sm" />
                  <Button size="sm" className="w-full" disabled={!contactForm.navn} onClick={() => {
                    const newId = generateId("K", kontakter);
                    const nyKontakt: Kontakt = {
                      id: newId, selskap_id: partner.selskap_id, navn: contactForm.navn,
                      rolle: contactForm.rolle, e_post: contactForm.e_post,
                      telefon: contactForm.telefon, linkedin: "", notater: "",
                    };
                    updateKontakter(prev => [...prev, nyKontakt]);
                    setContactForm({ navn: "", rolle: "", e_post: "", telefon: "" });
                    setShowAddContact(false);
                  }}>Legg til kontakt</Button>
                </div>
              )}
              {partnerKontakter.length === 0 && !showAddContact ? (
                <p className="text-xs text-muted-foreground">Ingen kontakter registrert</p>
              ) : (
                <div className="space-y-3">
                  {partnerKontakter.map(k => (
                    <div key={k.id} className="p-3 bg-muted/50 rounded-lg space-y-1">
                      <p className="font-medium text-sm">{k.navn}</p>
                      {k.rolle && <p className="text-xs text-muted-foreground">{k.rolle}</p>}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {k.e_post && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{k.e_post}</span>}
                        {k.telefon && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{k.telefon}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Info tab */}
          <TabsContent value="info">
            <div className="bg-card border rounded-xl p-4 sm:p-5 space-y-4 max-w-lg">
              <h3 className="font-semibold text-base">Partnerinfo</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Partnernavn</span>
                  <Input value={partner.partnernavn} onChange={e => updateField("partnernavn", e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Partnertype</span>
                  <select className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background" value={partner.partnertype} onChange={e => updateField("partnertype", e.target.value)}>
                    {partnertypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Status</span>
                  <select className={`w-full border rounded-lg px-3 py-1.5 text-sm bg-background ${statusColors[partner.partnerstatus]}`} value={partner.partnerstatus} onChange={e => updateField("partnerstatus", e.target.value)}>
                    {partnerstatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Pipeline-status</span>
                  <select className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background" value={partner.pipeline_status} onChange={e => updateField("pipeline_status", e.target.value)}>
                    {pipelineOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Provisjonstype</span>
                    <select className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background" value={partner.provisjonstype} onChange={e => updateField("provisjonstype", e.target.value)}>
                      <option value="">Velg...</option>
                      {provisjonstypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Provisjon %</span>
                    <Input type="number" value={partner.provisjonsprosent || ""} onChange={e => updateField("provisjonsprosent", Number(e.target.value))} className="h-8 text-sm" />
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Kontaktperson</span>
                  <Input value={partner.kontaktperson} onChange={e => updateField("kontaktperson", e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">E-post</span>
                    <Input value={partner.e_post} onChange={e => updateField("e_post", e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Telefon</span>
                    <Input value={partner.telefon} onChange={e => updateField("telefon", e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Ansvarlig</span>
                  <Input value={partner.ansvarlig} onChange={e => updateField("ansvarlig", e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Notater</span>
                  <Textarea value={partner.notater} onChange={e => updateField("notater", e.target.value)} rows={3} />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Add Customer Dialog */}
      <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ny kunde for {partner.partnernavn}</DialogTitle>
            <DialogDescription>Opprett en ny kunde tilknyttet denne partneren.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Firmanavn" value={customerForm.firmanavn} onChange={e => setCustomerForm(f => ({ ...f, firmanavn: e.target.value }))} />
            <Input placeholder="Bransje" value={customerForm.bransje} onChange={e => setCustomerForm(f => ({ ...f, bransje: e.target.value }))} />
            <Button onClick={addCustomer} className="w-full" disabled={!customerForm.firmanavn}>Opprett kunde</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Deal Dialog */}
      <Dialog open={showAddDeal} onOpenChange={setShowAddDeal}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ny salgsmulighet for {partner.partnernavn}</DialogTitle>
            <DialogDescription>Opprett en salgsmulighet tilknyttet denne partneren.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Navn på salgsmulighet" value={dealForm.navn} onChange={e => setDealForm(f => ({ ...f, navn: e.target.value }))} />
            <div>
              <span className="text-muted-foreground block text-xs mb-1">Kunde (valgfritt)</span>
              <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={dealForm.selskap_id} onChange={e => setDealForm(f => ({ ...f, selskap_id: e.target.value }))}>
                <option value="">Velg kunde...</option>
                {partnerKunder.map(k => <option key={k.id} value={k.id}>{k.firmanavn}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground block text-xs mb-1">Forventet MRR</span>
                <Input type="number" value={dealForm.forventet_mrr || ""} onChange={e => setDealForm(f => ({ ...f, forventet_mrr: Number(e.target.value) }))} />
              </div>
              <div>
                <span className="text-muted-foreground block text-xs mb-1">Oppstartskostnad</span>
                <Input type="number" value={dealForm.oppstartskostnad || ""} onChange={e => setDealForm(f => ({ ...f, oppstartskostnad: Number(e.target.value) }))} />
              </div>
            </div>
            <Button onClick={addDeal} className="w-full" disabled={!dealForm.navn}>Opprett salgsmulighet</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
