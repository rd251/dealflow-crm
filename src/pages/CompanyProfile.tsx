import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { beregnTotalKontraktsverdi, beregnVektetPipeline, Prosjekt, ProsjektStatus, Integrasjon } from "@/data/crm-data";
import StatCard from "@/components/StatCard";
import InlineTaskForm from "@/components/InlineTaskForm";
import ActivityLog from "@/components/ActivityLog";
import EntityChangelog from "@/components/EntityChangelog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Building2, ArrowLeft, DollarSign, TrendingUp, Briefcase, Users,
  Mail, Phone, Linkedin, FileText, CalendarDays, ChevronRight, Plus, X, Shield, Trash2, Send,
} from "lucide-react";
import SendEmailDialog from "@/components/SendEmailDialog";
import CompanyLogo from "@/components/CompanyLogo";
import SelskapInnsikt from "@/components/SelskapInnsikt";
import { Kundestatus, OnboardingStatus, Kundetilstand, SalgsmulighetStatus, Kontakt } from "@/data/crm-data";
import { Rocket } from "lucide-react";
import { toast } from "sonner";
import CompanyDocuments from "@/components/CompanyDocuments";

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
  "Møte booket": "bg-stage-contacted/10 text-stage-contacted",
  "Behov avklart": "bg-stage-qualified/10 text-stage-qualified",
  "Løsning presentert": "bg-stage-demo/10 text-stage-demo",
  "Kontrakt sendt": "bg-stage-proposal/10 text-stage-proposal",
  "Vunnet": "bg-success/10 text-success",
  "Tapt": "bg-destructive/10 text-destructive",
};

export default function CompanyProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    selskaper, updateSelskaper, kontakter, updateKontakter, salgsmuligheter, updateSalgsmuligheter, prosjekter, updateProsjekter, oppgaver, partnere, generateId,
  } = useCrmStore();

  const [showAddContact, setShowAddContact] = useState(false);
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ navn: "", rolle: "", e_post: "", telefon: "", linkedin: "" });
  const [deleteTarget, setDeleteTarget] = useState<Kontakt | null>(null);
  const [deleteRelations, setDeleteRelations] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailContact, setEmailContact] = useState<Kontakt | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({ prosjektnavn: "", integrasjon: "Ingen" as Integrasjon });
  const [editProject, setEditProject] = useState<Prosjekt | null>(null);
  const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1`;
  const API_HEADERS: HeadersInit = {
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };

  const requestJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...API_HEADERS,
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Request failed (${response.status})`);
    }

    if (response.status === 204) {
      return null as T;
    }

    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  };

  const handleDeleteContact = async (kontakt: Kontakt) => {
    try {
      const encodedId = encodeURIComponent(kontakt.id);
      const [smData, aktData] = await Promise.all([
        requestJson<Array<{ id: string }>>(`/salgsmuligheter?select=id&kontakt_id=eq.${encodedId}&limit=1`, { method: "GET" }),
        requestJson<Array<{ id: string }>>(`/aktiviteter?select=id&kontakt_id=eq.${encodedId}&limit=1`, { method: "GET" }),
      ]);

      const relations: string[] = [];
      if (smData?.length > 0) relations.push("Salgsmuligheter");
      if (aktData?.length > 0) relations.push("Aktiviteter");

      setDeleteTarget(kontakt);
      setDeleteRelations(relations);
      setExpandedContact(null);
      setDeleteDialogOpen(true);
    } catch (err) {
      console.error("Delete contact relation check error:", err);
      toast.error("Kunne ikke sjekke relasjoner for kontakten");
    }
  };

  const confirmDeleteContact = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const encodedId = encodeURIComponent(deleteTarget.id);

      await requestJson(`/salgsmuligheter?kontakt_id=eq.${encodedId}`, {
        method: "PATCH",
        body: JSON.stringify({ kontakt_id: null }),
      });

      await requestJson(`/aktiviteter?kontakt_id=eq.${encodedId}`, {
        method: "PATCH",
        body: JSON.stringify({ kontakt_id: null }),
      });

      await requestJson(`/kontakter?id=eq.${encodedId}`, {
        method: "DELETE",
      });

      updateSalgsmuligheter(prev => prev.map(s => s.kontakt_id === deleteTarget.id ? { ...s, kontakt_id: "" } : s));
      updateKontakter(prev => prev.filter(k => k.id !== deleteTarget.id));

      toast.success(`Kontakten "${deleteTarget.navn}" ble slettet`);
    } catch (err) {
      console.error("Delete contact error:", err);
      toast.error("Kunne ikke slette kontakten");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const selskap = selskaper.find(s => s.id === id);
  if (!selskap) {
    return (
      <div className={`${isMobile ? "ml-0" : "ml-60"} min-h-screen bg-background flex items-center justify-center`}>
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
    <>
    <div className={`${isMobile ? "ml-0" : "ml-60"} min-h-screen bg-background transition-all duration-200`}>
      {/* Header */}
      <header className={`sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b ${isMobile ? "px-4 py-4 pl-14" : "px-8 py-5"}`}>
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/selskaper")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Kundeforhold
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <CompanyLogo domain={selskap.domene} firmanavn={selskap.firmanavn} kontaktEmails={selskapKontakter.map(k => k.e_post)} size={isMobile ? "md" : "lg"} />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{selskap.firmanavn}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge className={kundestatusColors[selskap.kundestatus]}>{selskap.kundestatus}</Badge>
                {selskap.bransje && <span className="text-sm text-muted-foreground">{selskap.bransje}</span>}
                {selskap.live_status && <Badge className="bg-success/10 text-success">Live</Badge>}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className={`${isMobile ? "p-4" : "p-8"} space-y-6 sm:space-y-8`}>
        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <StatCard label="Aktiv MRR" value={`${selskap.mrr.toLocaleString("no-NO")} kr`} icon={<DollarSign className="w-5 h-5" />} />
          <StatCard label="ARR" value={`${selskap.arr.toLocaleString("no-NO")} kr`} icon={<TrendingUp className="w-5 h-5" />} />
          <StatCard label="SLA (mnd)" value={`${totalSla.toLocaleString("no-NO")} kr`} icon={<Shield className="w-5 h-5" />} trend={!isMobile ? `Årlig: ${(totalSla * 12).toLocaleString("no-NO")} kr` : undefined} />
          <StatCard label="Oppstart" value={`${totalOppstart.toLocaleString("no-NO")} kr`} icon={<Briefcase className="w-5 h-5" />} />
          <StatCard label="Kontrakt" value={`${totalKontraktsverdi.toLocaleString("no-NO")} kr`} icon={<FileText className="w-5 h-5" />} />
          <StatCard label="Total" value={`${totalVerdi.toLocaleString("no-NO")} kr`} icon={<TrendingUp className="w-5 h-5" />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Left column – Selskapsinfo */}
          <div className="space-y-6">
            <div className="bg-card border rounded-xl p-4 sm:p-5 space-y-4">
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
                  <span className="text-muted-foreground block text-xs mb-1">Domene</span>
                  <Input placeholder="f.eks. acme.no" value={selskap.domene} onChange={e => updateField("domene", e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Firmaadresse</span>
                  <Input placeholder="Besøksadresse" value={selskap.firmaadresse || ""} onChange={e => updateField("firmaadresse", e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Postadresse</span>
                  <Input placeholder="Postadresse" value={selskap.postadresse || ""} onChange={e => updateField("postadresse", e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">Org.nr</span>
                  <Input placeholder="f.eks. 123 456 789" value={selskap.orgnr} onChange={e => updateField("orgnr", e.target.value)} className="h-8 text-sm" />
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
                  <span className="text-muted-foreground block text-xs mb-1">Lukkedato</span>
                  <Input type="date" value={selskap.lukkedato} onChange={e => updateField("lukkedato", e.target.value)} className="h-8 text-sm" />
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

            <SelskapInnsikt
              domene={selskap.domene}
              firmanavn={selskap.firmanavn}
              e_post={selskapKontakter[0]?.e_post}
              onEnriched={(innsikt) => {
                const needsBransje = innsikt.bransje && (!selskap.bransje || selskap.bransje === "");
                const needsOrgnr = innsikt.orgnr && (!selskap.orgnr || selskap.orgnr === "");
                const needsFirmaadresse = innsikt.firmaadresse && (!selskap.firmaadresse || selskap.firmaadresse === "");
                const needsPostadresse = innsikt.postadresse && (!selskap.postadresse || selskap.postadresse === "");
                if (needsBransje || needsOrgnr || needsFirmaadresse || needsPostadresse) {
                  updateSelskaper(prev => prev.map(s =>
                    s.id === selskap.id ? {
                      ...s,
                      ...(needsBransje ? { bransje: innsikt.bransje! } : {}),
                      ...(needsOrgnr ? { orgnr: innsikt.orgnr! } : {}),
                      ...(needsFirmaadresse ? { firmaadresse: innsikt.firmaadresse! } : {}),
                      ...(needsPostadresse ? { postadresse: innsikt.postadresse! } : {}),
                    } : s
                  ));
                  toast.success("Selskapsfelt oppdatert fra berikelsesdata");
                }
              }}
            />
            <div className="bg-card border rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base flex items-center gap-2">
                  <Users className="w-4 h-4" /> Kontakter ({selskapKontakter.length})
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
                    const newId = generateId("K", kontakter);
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
              {selskapKontakter.map(k => {
                    const isExpanded = expandedContact === k.id;
                    return (
                      <div key={k.id} className="p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={() => setExpandedContact(isExpanded ? null : k.id)}>
                        {/* Compact card view */}
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="font-medium text-sm">{k.navn}</p>
                            {k.rolle && <p className="text-xs text-muted-foreground">{k.rolle}</p>}
                          </div>
                          <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </div>
                        {!isExpanded && (
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap mt-1">
                            {k.e_post && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /><span className="truncate">{k.e_post}</span></span>}
                            {k.telefon && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{k.telefon}</span>}
                            {k.linkedin && <span className="flex items-center gap-1"><Linkedin className="w-3 h-3" />LinkedIn</span>}
                          </div>
                        )}
                        {/* Expanded edit view */}
                        {isExpanded && (
                          <div className="mt-3 space-y-2 border-t pt-3" onClick={e => e.stopPropagation()}>
                            <div>
                              <span className="text-muted-foreground text-xs">Navn</span>
                              <Input value={k.navn} onChange={e => updateKontakter(prev => prev.map(c => c.id === k.id ? { ...c, navn: e.target.value } : c))} className="h-8 text-sm" />
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Rolle</span>
                              <Input value={k.rolle || ""} onChange={e => updateKontakter(prev => prev.map(c => c.id === k.id ? { ...c, rolle: e.target.value } : c))} className="h-8 text-sm" placeholder="Rolle" />
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">E-post</span>
                              <Input value={k.e_post || ""} onChange={e => updateKontakter(prev => prev.map(c => c.id === k.id ? { ...c, e_post: e.target.value } : c))} className="h-8 text-sm" placeholder="E-post" />
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Telefon</span>
                              <Input value={k.telefon || ""} onChange={e => updateKontakter(prev => prev.map(c => c.id === k.id ? { ...c, telefon: e.target.value } : c))} className="h-8 text-sm" placeholder="Telefon" />
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">LinkedIn</span>
                              <Input value={k.linkedin || ""} onChange={e => updateKontakter(prev => prev.map(c => c.id === k.id ? { ...c, linkedin: e.target.value } : c))} className="h-8 text-sm" placeholder="LinkedIn URL" />
                            </div>
                            <div className="flex gap-2 mt-2">
                              {k.e_post && (
                                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => { setEmailContact(k); setEmailDialogOpen(true); }}>
                                  <Send className="w-3.5 h-3.5 mr-1" /> Send e-post
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className="flex-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteContact(k)}>
                                <Trash2 className="w-4 h-4 mr-1" /> Slett
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Middle column – Salgsmuligheter & Prosjekter */}
          <div className="space-y-6">
            <div className="bg-card border rounded-xl p-4 sm:p-5 space-y-3">
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
                        <p className="font-medium text-sm truncate">{sm.navn}</p>
                        <Badge className={`text-[10px] shrink-0 ${smStatusColors[sm.status]}`}>{sm.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>MRR: {sm.forventet_mrr.toLocaleString("no-NO")} kr</span>
                        <span>SLA: {(sm.sla || 0).toLocaleString("no-NO")} kr</span>
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

            <div className="bg-card border rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Prosjekter ({selskapProsjekter.length})
                </h2>
                <Button variant="ghost" size="sm" onClick={() => { setProjectForm({ prosjektnavn: selskap.firmanavn, integrasjon: "Ingen" }); setNewProjectOpen(true); }}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {selskapProsjekter.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ingen prosjekter</p>
              ) : (
                <div className="space-y-2">
                  {selskapProsjekter.map(p => (
                    <div key={p.id} className="block p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors cursor-pointer"
                      onClick={() => setEditProject({ ...p })}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm truncate">{p.prosjektnavn}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0">{p.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                        <span>Start: {p.startdato || "–"}</span>
                        <span>Go-live: {p.go_live_dato || p.forventet_go_live || "–"}</span>
                        <span>Oppstart: {p.oppstartskostnad.toLocaleString("no-NO")} kr</span>
                        <span>Integrasjon: {p.integrasjon}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column – Oppgaver & Aktivitetslogg */}
          <div className="space-y-6">
            <div className="bg-card border rounded-xl p-4 sm:p-5">
              <InlineTaskForm selskap_id={id!} />
            </div>

            <div className="bg-card border rounded-xl p-4 sm:p-5">
              <ActivityLog selskap_id={id!} onActivityLogged={() => {
                updateSelskaper(prev => prev.map(s => s.id === id ? { ...s, sist_aktivitet: new Date().toISOString().split("T")[0] } : s));
              }} />
              <EntityChangelog entity_type="selskap" entity_id={id!} />
            </div>

            <div className="bg-card border rounded-xl p-4 sm:p-5">
              <CompanyDocuments selskapId={id!} />
            </div>
          </div>
        </div>
      </main>
    </div>

      {/* Delete contact dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Slett kontakt</DialogTitle>
            <DialogDescription>
              Er du sikker på at du vil slette kontakten «{deleteTarget?.navn}»?
              {deleteRelations.length > 0 && (
                <span className="block mt-2 text-warning">
                  Denne kontakten er koblet til: {deleteRelations.join(", ")}. Koblingene vil bli fjernet.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Avbryt</Button>
            <Button variant="destructive" onClick={confirmDeleteContact} disabled={deleting}>
              {deleting ? "Sletter..." : "Slett"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {emailContact && selskap && (
        <SendEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          defaultTo={emailContact.e_post}
          defaultSubject={`Hei ${emailContact.navn.split(" ")[0]} – ${selskap.firmanavn}`}
          context={{
            entityType: "lead",
            entityId: emailContact.id,
            selskapNavn: selskap.firmanavn,
            kontaktperson: emailContact.navn,
            kontaktId: emailContact.id,
            selskapId: selskap.id,
          }}
        />
      )}
      {/* Nytt prosjekt dialog */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Opprett nytt prosjekt</DialogTitle>
            <DialogDescription>Legg til et prosjekt for dette selskapet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs"><span className="text-muted-foreground">Prosjektnavn</span>
              <Input value={projectForm.prosjektnavn} onChange={e => setProjectForm(f => ({ ...f, prosjektnavn: e.target.value }))} className="h-8 text-sm mt-0.5" />
            </div>
            <div className="text-xs"><span className="text-muted-foreground">Integrasjon</span>
              <select className="w-full border rounded px-2 py-1.5 text-sm bg-background mt-0.5"
                value={projectForm.integrasjon} onChange={e => setProjectForm(f => ({ ...f, integrasjon: e.target.value as Integrasjon }))}>
                {(["Ingen", "GastroPlanner", "HubSpot", "Lime", "Salesforce", "API", "Annet"] as Integrasjon[]).map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setNewProjectOpen(false)}>Avbryt</Button>
            <Button disabled={!projectForm.prosjektnavn.trim()} onClick={() => {
              const newP: Prosjekt = {
                id: generateId("p", prosjekter),
                prosjektnavn: projectForm.prosjektnavn.trim(),
                selskap_id: id!,
                salgsmulighet_id: "",
                ansvarlig: selskap.kundeansvarlig || "",
                status: "Ny",
                startdato: new Date().toISOString().split("T")[0],
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
              setNewProjectOpen(false);
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
                  updateProsjekter(prev => prev.filter(p => p.id !== editProject.id));
                  setEditProject(null);
                  toast.success("Prosjekt slettet");
                }}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" />Slett
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditProject(null)}>Avbryt</Button>
                  <Button onClick={() => {
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
    </>
  );
}
