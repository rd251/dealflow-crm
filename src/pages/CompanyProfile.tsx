import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCrmStore } from "@/hooks/use-crm-store";
import { beregnTotalKontraktsverdi, beregnVektetPipeline } from "@/data/crm-data";
import StatCard from "@/components/StatCard";
import InlineTaskForm from "@/components/InlineTaskForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Building2, ArrowLeft, DollarSign, TrendingUp, Briefcase, Users,
  Mail, Phone, Linkedin, FileText, CalendarDays, ChevronRight, Plus, X, Shield,
} from "lucide-react";
import { Kundestatus, OnboardingStatus, Kundetilstand, SalgsmulighetStatus, Kontakt } from "@/data/crm-data";

const kundestatuser: Kundestatus[] = ["Ikke kunde", "Pilot", "Live", "Pause", "Kansellert"];
const onboardingStatuser: OnboardingStatus[] = ["Ikke startet", "Pågår", "Venter på kunde", "Klar for live", "Ferdig"];
const kundetilstander: Kundetilstand[] = ["Bra", "Usikker", "Risiko"];

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

const smStatusColors: Record<SalgsmulighetStatus, string> = {
  "Ny mulighet": "bg-stage-new-lead/10 text-stage-new-lead",
  "Møte booket": "bg-stage-contacted/10 text-stage-contacted",
  "Demo gjennomført": "bg-stage-demo/10 text-stage-demo",
  "Tilbud sendt": "bg-stage-proposal/10 text-stage-proposal",
  "Forhandling": "bg-stage-qualified/10 text-stage-qualified",
  "Vunnet": "bg-success/10 text-success",
  "Tapt": "bg-destructive/10 text-destructive",
};

export default function CompanyProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    selskaper, updateSelskaper, kontakter, updateKontakter, salgsmuligheter, prosjekter, oppgaver,
  } = useCrmStore();

  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ navn: "", rolle: "", e_post: "", telefon: "", linkedin: "" });

  const selskap = selskaper.find(s => s.id === id);
  if (!selskap) {
    return (
      <div className="ml-60 min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Selskap ikke funnet</p>
          <Button variant="ghost" className="mt-2" onClick={() => navigate("/selskaper")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Tilbake
          </Button>
        </div>
      </div>
    );
  }

  const selskapKontakter = kontakter.filter(k => k.selskap_id === id);
  const selskapSm = salgsmuligheter.filter(s => s.selskap_id === id);
  const selskapProsjekter = prosjekter.filter(p => p.selskap_id === id);
  const selskapOppgaver = oppgaver.filter(o => o.selskap_id === id);

  const totalKontraktsverdi = selskapSm.reduce((sum, s) => sum + beregnTotalKontraktsverdi(s), 0);
  const totalOppstart = selskapSm.reduce((sum, s) => sum + s.oppstartskostnad, 0) || selskap.oppstartskostnad;
  const totalSla = selskapSm.filter(s => s.status !== "Tapt").reduce((sum, s) => sum + (s.sla || 0), 0);
  const totalVerdi = totalKontraktsverdi + totalOppstart;

  const today = new Date().toISOString().split("T")[0];
  const updateField = (field: string, value: any) => {
    updateSelskaper(prev => prev.map(s =>
      s.id === id ? { ...s, [field]: value, sist_aktivitet: today } : s
    ));
  };

  return (
    <div className="ml-60 min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b px-8 py-5">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/selskaper")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Kundeforhold
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{selskap.firmanavn}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={kundestatusColors[selskap.kundestatus]}>{selskap.kundestatus}</Badge>
                {selskap.bransje && <span className="text-sm text-muted-foreground">{selskap.bransje}</span>}
                {selskap.live_status && <Badge className="bg-success/10 text-success">Live</Badge>}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="p-8 space-y-8">
        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Aktiv MRR" value={`${selskap.mrr.toLocaleString("no-NO")} kr`} icon={<DollarSign className="w-5 h-5" />} />
          <StatCard label="ARR" value={`${selskap.arr.toLocaleString("no-NO")} kr`} icon={<TrendingUp className="w-5 h-5" />} />
          <StatCard label="SLA (månedlig)" value={`${totalSla.toLocaleString("no-NO")} kr`} icon={<Shield className="w-5 h-5" />} trend={`Årlig: ${(totalSla * 12).toLocaleString("no-NO")} kr`} />
          <StatCard label="Sum oppstartskostnader" value={`${totalOppstart.toLocaleString("no-NO")} kr`} icon={<Briefcase className="w-5 h-5" />} />
          <StatCard label="Total kontraktsverdi" value={`${totalKontraktsverdi.toLocaleString("no-NO")} kr`} icon={<FileText className="w-5 h-5" />} />
          <StatCard label="Total verdi" value={`${totalVerdi.toLocaleString("no-NO")} kr`} icon={<TrendingUp className="w-5 h-5" />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column – Selskapsinfo */}
          <div className="space-y-6">
            <div className="bg-card border rounded-xl p-5 space-y-4">
              <h2 className="font-semibold text-base">Selskapsinfo</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Firmanavn</span>
                  <Input value={selskap.firmanavn} onChange={e => updateField("firmanavn", e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Bransje</span>
                  <Input value={selskap.bransje} onChange={e => updateField("bransje", e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Kundeansvarlig</span>
                  <Input value={selskap.kundeansvarlig} onChange={e => updateField("kundeansvarlig", e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Kundestatus</span>
                  <select className={`w-full border rounded-lg px-3 py-1.5 text-sm bg-background ${kundestatusColors[selskap.kundestatus]}`}
                    value={selskap.kundestatus} onChange={e => {
                      const val = e.target.value as Kundestatus;
                      updateField("kundestatus", val);
                      if (val === "Live") updateField("live_status", true);
                      else if (val !== "Pilot") updateField("live_status", false);
                    }}>
                    {kundestatuser.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">Live</span>
                  <Switch checked={selskap.live_status} onCheckedChange={v => {
                    updateField("live_status", v);
                    if (v) updateField("kundestatus", "Live");
                  }} />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Onboarding</span>
                  <select className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background" value={selskap.onboarding_status}
                    onChange={e => updateField("onboarding_status", e.target.value)}>
                    {onboardingStatuser.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Kundetilstand</span>
                  <select className={`w-full border rounded-lg px-3 py-1.5 text-sm bg-background ${tilstandColors[selskap.kundetilstand]}`}
                    value={selskap.kundetilstand} onChange={e => updateField("kundetilstand", e.target.value)}>
                    {kundetilstander.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">MRR</span>
                  <Input type="number" value={selskap.mrr || ""} onChange={e => {
                    const mrr = Number(e.target.value);
                    updateSelskaper(prev => prev.map(s => s.id === id ? { ...s, mrr, arr: mrr * 12, sist_aktivitet: today } : s));
                  }} className="h-8 text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Oppstartskostnad</span>
                  <Input type="number" value={selskap.oppstartskostnad || ""} onChange={e => updateField("oppstartskostnad", Number(e.target.value))} className="h-8 text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Go-live dato</span>
                  <Input type="date" value={selskap.go_live_dato} onChange={e => updateField("go_live_dato", e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Neste steg</span>
                  <Input value={selskap.neste_steg} onChange={e => updateField("neste_steg", e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Notater</span>
                  <Textarea value={selskap.notater} onChange={e => updateField("notater", e.target.value)} rows={3} />
                </div>
              </div>
            </div>

            {/* Kontaktpersoner */}
            <div className="bg-card border rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base flex items-center gap-2">
                  <Users className="w-4 h-4" /> Kontaktpersoner ({selskapKontakter.length})
                </h2>
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
                  <Input placeholder="LinkedIn URL" value={contactForm.linkedin} onChange={e => setContactForm(f => ({ ...f, linkedin: e.target.value }))} className="h-8 text-sm" />
                  <Button size="sm" className="w-full" disabled={!contactForm.navn} onClick={() => {
                    const newId = `K-${String(kontakter.length + 1).padStart(4, "0")}`;
                    const nyKontakt: Kontakt = {
                      id: newId, selskap_id: id!, navn: contactForm.navn,
                      rolle: contactForm.rolle, e_post: contactForm.e_post,
                      telefon: contactForm.telefon, linkedin: contactForm.linkedin, notater: "",
                    };
                    updateKontakter(prev => [...prev, nyKontakt]);
                    setContactForm({ navn: "", rolle: "", e_post: "", telefon: "", linkedin: "" });
                    setShowAddContact(false);
                  }}>Legg til kontakt</Button>
                </div>
              )}

              {selskapKontakter.length === 0 && !showAddContact ? (
                <p className="text-xs text-muted-foreground">Ingen kontakter registrert</p>
              ) : (
                <div className="space-y-3">
                  {selskapKontakter.map(k => (
                    <div key={k.id} className="p-3 bg-muted/50 rounded-lg space-y-1">
                      <p className="font-medium text-sm">{k.navn}</p>
                      {k.rolle && <p className="text-xs text-muted-foreground">{k.rolle}</p>}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {k.e_post && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{k.e_post}</span>}
                        {k.telefon && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{k.telefon}</span>}
                        {k.linkedin && <a href={k.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline"><Linkedin className="w-3 h-3" />LinkedIn</a>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Middle column – Salgsmuligheter & Prosjekter */}
          <div className="space-y-6">
            <div className="bg-card border rounded-xl p-5 space-y-3">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> Salgsmuligheter ({selskapSm.length})
              </h2>
              {selskapSm.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ingen salgsmuligheter</p>
              ) : (
                <div className="space-y-2">
                  {selskapSm.map(sm => (
                    <Link to={`/salgsmuligheter`} key={sm.id} className="block p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">{sm.navn}</p>
                        <Badge className={`text-[10px] ${smStatusColors[sm.status]}`}>{sm.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>MRR: {sm.forventet_mrr.toLocaleString("no-NO")} kr</span>
                        <span>Oppstart: {sm.oppstartskostnad.toLocaleString("no-NO")} kr</span>
                        <span>Kontraktslengde: {sm.kontraktslengde_mnd} mnd</span>
                        <span>Sannsynlighet: {sm.sannsynlighet}%</span>
                        <span>Total: {beregnTotalKontraktsverdi(sm).toLocaleString("no-NO")} kr</span>
                        <span>Vektet: {beregnVektetPipeline(sm).toLocaleString("no-NO")} kr</span>
                      </div>
                      {sm.neste_steg && <p className="text-xs mt-1 text-primary">{sm.neste_steg}</p>}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card border rounded-xl p-5 space-y-3">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <FileText className="w-4 h-4" /> Prosjekter ({selskapProsjekter.length})
              </h2>
              {selskapProsjekter.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ingen prosjekter</p>
              ) : (
                <div className="space-y-2">
                  {selskapProsjekter.map(p => (
                    <Link to={`/prosjekter`} key={p.id} className="block p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">{p.prosjektnavn}</p>
                        <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                        <span>Start: {p.startdato || "–"}</span>
                        <span>Go-live: {p.go_live_dato || p.forventet_go_live || "–"}</span>
                        <span>Oppstart: {p.oppstartskostnad.toLocaleString("no-NO")} kr</span>
                        <span>Integrasjon: {p.integrasjon}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column – Oppgaver & Aktivitetslogg */}
          <div className="space-y-6">
            <div className="bg-card border rounded-xl p-5">
              <InlineTaskForm selskap_id={id!} />
            </div>

            <div className="bg-card border rounded-xl p-5 space-y-3">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <CalendarDays className="w-4 h-4" /> Aktivitetslogg
              </h2>
              <div className="space-y-2 text-xs">
                {/* Compile activity from all sources */}
                {[
                  ...selskapSm.filter(s => s.vunnet_dato).map(s => ({ dato: s.vunnet_dato, tekst: `Salgsmulighet "${s.navn}" vunnet`, type: "success" as const })),
                  ...selskapSm.filter(s => s.tapt_dato).map(s => ({ dato: s.tapt_dato, tekst: `Salgsmulighet "${s.navn}" tapt – ${s.tapsaarsak}`, type: "destructive" as const })),
                  ...selskapSm.map(s => ({ dato: s.opprettet_dato, tekst: `Salgsmulighet "${s.navn}" opprettet`, type: "default" as const })),
                  ...selskapProsjekter.filter(p => p.go_live_dato).map(p => ({ dato: p.go_live_dato, tekst: `Prosjekt "${p.prosjektnavn}" gikk live`, type: "success" as const })),
                  ...selskapProsjekter.filter(p => p.startdato).map(p => ({ dato: p.startdato, tekst: `Prosjekt "${p.prosjektnavn}" startet`, type: "default" as const })),
                  ...(selskap.go_live_dato ? [{ dato: selskap.go_live_dato, tekst: "Selskapet gikk live", type: "success" as const }] : []),
                  ...(selskap.kansellert_dato ? [{ dato: selskap.kansellert_dato, tekst: `Kansellert – ${selskap.kanselleringsaarsak}`, type: "destructive" as const }] : []),
                ].sort((a, b) => b.dato.localeCompare(a.dato)).map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                    <span className="text-muted-foreground shrink-0 w-20">{entry.dato}</span>
                    <span className={entry.type === "success" ? "text-success" : entry.type === "destructive" ? "text-destructive" : "text-foreground"}>
                      {entry.tekst}
                    </span>
                  </div>
                ))}
                {selskapSm.length === 0 && selskapProsjekter.length === 0 && !selskap.go_live_dato && (
                  <p className="text-muted-foreground">Ingen aktivitet registrert</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
